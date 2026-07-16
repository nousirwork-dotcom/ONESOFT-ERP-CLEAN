/**
 * foundation-update.ts — محرك قالب التأسيس
 *
 * المهام:
 *  - backupDatabase()           — نسخة احتياطية pg_dump قبل أي تحديث
 *  - applyFoundationRecords()   — تطبيق قالب التأسيس مع حل علاقات FK تلقائياً
 *  - seedFromFoundationTemplate() — للقواعد الجديدة (يُستدعى من bootstrap.ts)
 *  - applyFoundationUpdate()    — للعملاء الحاليين (يُضيف السجلات الجديدة فقط)
 *  - runFoundationUpdateForAllOrgs() — يُستدعى من index.ts عند بدء التشغيل
 *
 * قواعد التطبيق:
 *  1. idempotent تماماً — لا يُعدّل سجلاً موجوداً بأي حال.
 *  2. ترتيب التبعيات: currencies → branches → warehouses → units → product_groups
 *     → payment_methods → cost_centers → document_types → document_templates
 *     → document_journals → posting_definitions
 *  3. حل FK تلقائياً عبر حقول _xxx_fk المُضمَّنة في ملف القالب.
 *  4. إذا فشلت النسخة الاحتياطية يتوقف التحديث ولا يبدأ.
 */

import fs   from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { db }        from './db.js';
import { logger }    from './logger.js';
import { eq, and, inArray, sql } from 'drizzle-orm';
import {
  organizations,
  documentJournals,
  documentTypes,
  branches,
  warehouses,
  units,
  productGroups,
  paymentMethods,
  costCenters,
  currencies,
  documentTemplates,
  postingDefinitions,
  chartOfAccounts,
} from './schema.js';

// ─── حقول FK التي تشير إلى جداول التأسيس أو الحسابات ──────────────────────
// المفتاح = اسم الحقل في السجل، القيمة = نوع التبعية
const FK_FIELD_MAP: Record<string, { type: 'foundation'; tableKey: string } | { type: 'account' }> = {
  warehouseId:         { type: 'foundation', tableKey: 'warehouses'  },
  branchId:            { type: 'foundation', tableKey: 'branches'    },
  salesAccountId:      { type: 'account' },
  cashAccountId:       { type: 'account' },
  creditAccountId:     { type: 'account' },
  taxAccountId:        { type: 'account' },
  discountAccountId:   { type: 'account' },
  purchaseAccountId:   { type: 'account' },
  supplierAccountId:   { type: 'account' },
  inventoryAccountId:  { type: 'account' },
  cogsAccountId:       { type: 'account' },
  settlementAccountId: { type: 'account' },
};

// ترتيب تطبيق الجداول (من لا يعتمد على غيره إلى الأكثر اعتماداً)
const APPLY_ORDER: Array<{ tableName: string; dataKey: string }> = [
  { tableName: 'currencies',          dataKey: 'currencies'         },
  { tableName: 'branches',            dataKey: 'branches'           },
  { tableName: 'warehouses',          dataKey: 'warehouses'         },
  { tableName: 'units',               dataKey: 'units'              },
  { tableName: 'product_groups',      dataKey: 'productGroups'      },
  { tableName: 'payment_methods',     dataKey: 'paymentMethods'     },
  { tableName: 'cost_centers',        dataKey: 'costCenters'        },
  { tableName: 'document_types',      dataKey: 'documentTypes'      },
  { tableName: 'document_templates',  dataKey: 'documentTemplates'  },
  { tableName: 'document_journals',   dataKey: 'documentJournals'   },
  { tableName: 'posting_definitions', dataKey: 'postingDefinitions' },
];

function getTableRef(tableName: string): any {
  switch (tableName) {
    case 'document_journals':   return documentJournals;
    case 'document_types':      return documentTypes;
    case 'branches':            return branches;
    case 'warehouses':          return warehouses;
    case 'units':               return units;
    case 'product_groups':      return productGroups;
    case 'payment_methods':     return paymentMethods;
    case 'cost_centers':        return costCenters;
    case 'currencies':          return currencies;
    case 'document_templates':  return documentTemplates;
    case 'posting_definitions': return postingDefinitions;
    default: throw new Error(`جدول غير مدعوم: ${tableName}`);
  }
}

// ─── نسخة احتياطية ──────────────────────────────────────────────────────────

export interface BackupResult {
  ok: boolean;
  path?: string;
  error?: string;
}

/**
 * ينشئ نسخة احتياطية pg_dump للقاعدة المطلوبة.
 * إذا لم يكن pg_dump متاحاً يُعيد خطأ واضحاً.
 * الملف يُحفظ في: /tmp/onesoft-backups/backup_<timestamp>.sql
 */
export async function backupDatabase(dbUrl: string): Promise<BackupResult> {
  const backupDir = '/tmp/onesoft-backups';
  try {
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const timestamp  = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup_${timestamp}.sql`);

    const result = spawnSync('pg_dump', [dbUrl, '-f', backupPath], {
      encoding: 'utf8',
      timeout:  60_000,
    });

    if (result.error) {
      return { ok: false, error: `pg_dump غير متاح: ${result.error.message}` };
    }
    if (result.status !== 0) {
      const msg = (result.stderr || '').trim() || `exit code ${result.status}`;
      return { ok: false, error: `pg_dump فشل: ${msg}` };
    }

    logger.info('foundation-backup', `✅ نسخة احتياطية: ${backupPath}`);
    return { ok: true, path: backupPath };
  } catch (err: any) {
    return { ok: false, error: err.message ?? String(err) };
  }
}

// ─── حل علاقات FK ───────────────────────────────────────────────────────────

/**
 * يبني خريطة foundationKey → ID لجميع سجلات التأسيس في منظمة معينة.
 * تُستخدم لحل الـ FK عند تطبيق القالب.
 */
async function buildFoundationKeyIdMap(orgId: number): Promise<Map<string, number>> {
  const fkMap = new Map<string, number>();

  for (const { tableName } of APPLY_ORDER) {
    try {
      const table = getTableRef(tableName);
      const rows  = await (db.select() as any)
        .from(table)
        .where(and(
          eq(table.orgId, orgId),
          sql`${table.foundationKey} IS NOT NULL`,
        ));
      for (const row of rows) {
        if (row.foundationKey) fkMap.set(row.foundationKey, row.id);
      }
    } catch { /* جدول بلا foundation_key — تجاهل */ }
  }

  return fkMap;
}

/**
 * يبني خريطة systemKey → ID لشجرة الحسابات في منظمة معينة.
 * تُستخدم لحل مراجع الحسابات (salesAccountId وما شابهها).
 */
async function buildAccountSystemKeyMap(orgId: number): Promise<Map<string, number>> {
  const acctMap = new Map<string, number>();
  const rows = await db.select({ id: chartOfAccounts.id, systemKey: chartOfAccounts.systemKey })
    .from(chartOfAccounts)
    .where(and(
      eq(chartOfAccounts.orgId, orgId),
      sql`${chartOfAccounts.systemKey} IS NOT NULL`,
    ));
  for (const row of rows) {
    if (row.systemKey) acctMap.set(row.systemKey, row.id);
  }
  return acctMap;
}

/**
 * يحوّل سجلاً مُصدَّراً (يحتوي على حقول _xxx_fk) إلى كائن جاهز للإدراج
 * عبر حل المراجع إلى IDs حقيقية في المنظمة الهدف.
 * يحذف جميع حقول _xxx_fk من الكائن النهائي.
 */
function resolveRecordFks(
  record: Record<string, unknown>,
  fkMap:  Map<string, number>,
  acctMap: Map<string, number>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith('_') && key.endsWith('_fk')) continue; // نحذف حقول التوثيق
    out[key] = value;
  }

  // نحل FK fields باستخدام المرجع المُضمَّن في _xxx_fk
  for (const [fkField, fkDef] of Object.entries(FK_FIELD_MAP)) {
    const refField = `_${fkField}_fk`;
    const refValue = record[refField];
    if (!refValue) continue;

    if (fkDef.type === 'foundation') {
      const id = fkMap.get(String(refValue));
      out[fkField] = id ?? null;
    } else {
      // account — refValue = systemKey
      const id = acctMap.get(String(refValue));
      out[fkField] = id ?? null;
    }
  }

  return out;
}

// ─── محرك التطبيق المركزي ───────────────────────────────────────────────────

export interface ApplyResult {
  inserted: number;
  skipped:  number;
  errors:   string[];
}

/**
 * يطبّق بيانات قالب التأسيس على منظمة محددة.
 * - يتجاهل السجلات التي يوجد foundationKey مماثل لها مسبقاً.
 * - يحل FK بشكل تلقائي عبر الخرائط المبنية من السجلات المُدرَجة.
 * - يطبّق في ترتيب التبعيات الصحيح.
 */
export async function applyFoundationRecords(
  orgId: number,
  data:  Record<string, unknown[]>,
): Promise<ApplyResult> {
  let inserted = 0;
  let skipped  = 0;
  const errors: string[] = [];

  // نبني خرائط الحسابات والـ foundationKeys مسبقاً
  const fkMap   = await buildFoundationKeyIdMap(orgId);
  const acctMap = await buildAccountSystemKeyMap(orgId);

  for (const { tableName, dataKey } of APPLY_ORDER) {
    const records: Record<string, unknown>[] = (data[dataKey] as any[]) ?? [];
    if (!records.length) continue;

    const table = getTableRef(tableName);

    // نجمع foundationKeys الموجودة مسبقاً في هذه المنظمة
    const existingRows = await (db.select({ foundationKey: table.foundationKey }) as any)
      .from(table)
      .where(and(
        eq(table.orgId, orgId),
        sql`${table.foundationKey} IS NOT NULL`,
      ));
    const existingKeys = new Set<string>(existingRows.map((r: any) => r.foundationKey).filter(Boolean));

    for (const record of records) {
      const fKey = record['foundationKey'] as string | undefined;
      if (!fKey) { skipped++; continue; }
      if (existingKeys.has(fKey)) { skipped++; continue; }

      try {
        const resolved = resolveRecordFks(record, fkMap, acctMap);
        const templateVersion = (data as any).exportedAt
          ? String((data as any).exportedAt).slice(0, 10)
          : null;

        const [inserted_row] = await (db.insert(table) as any).values({
          ...resolved,
          orgId,
          recordOrigin:              'foundation',
          foundationTemplateVersion: templateVersion,
        }).returning({ id: table.id });

        // نُضيف السجل الجديد للخريطة لاستخدامه في حل FKs للجداول التالية
        if (inserted_row?.id && fKey) {
          fkMap.set(fKey, inserted_row.id);
        }

        inserted++;
        existingKeys.add(fKey);
      } catch (err: any) {
        const msg = err?.message ?? String(err);
        errors.push(`${tableName}[${fKey}]: ${msg}`);
        logger.warn('foundation-apply', `فشل إدراج ${tableName}[${fKey}]: ${msg}`);
      }
    }
  }

  return { inserted, skipped, errors };
}

// ─── الدوال العامة ───────────────────────────────────────────────────────────

function loadFoundationJson(): Record<string, unknown[]> | null {
  const jsonPath = path.resolve(process.cwd(), 'src', 'foundation-data.json');
  if (!fs.existsSync(jsonPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * يُستدعى من bootstrap.ts بعد seedFoundationAccounts.
 * يطبّق قالب التأسيس على منظمة جديدة.
 * إذا لم يكن ملف القالب موجوداً يتجاهل بصمت.
 */
export async function seedFromFoundationTemplate(orgId: number): Promise<void> {
  const data = loadFoundationJson();
  if (!data) {
    logger.info('foundation-seed', 'foundation-data.json غير موجود — تجاهل (no-op)');
    return;
  }

  logger.info('foundation-seed', `تطبيق قالب التأسيس على org ${orgId}...`);
  const result = await applyFoundationRecords(orgId, data);
  logger.info('foundation-seed',
    `اكتمل: inserted=${result.inserted} skipped=${result.skipped} errors=${result.errors.length}`);
  if (result.errors.length) {
    logger.warn('foundation-seed', 'أخطاء:', result.errors);
  }
}

/**
 * يُستدعى من index.ts عند بدء التشغيل لكل org نشطة.
 * يُضيف فقط السجلات التأسيسية الجديدة التي لم تُطبَّق بعد.
 * لا يُعدّل ولا يحذف أي سجل موجود.
 */
export async function applyFoundationUpdate(
  orgId: number,
  opts?: { withBackup?: boolean; dbUrl?: string }
): Promise<{ ok: boolean; inserted: number; skipped: number; errors: string[]; backupPath?: string }> {
  const data = loadFoundationJson();
  if (!data) {
    return { ok: true, inserted: 0, skipped: 0, errors: [], backupPath: undefined };
  }

  let backupPath: string | undefined;
  if (opts?.withBackup && opts?.dbUrl) {
    const backup = await backupDatabase(opts.dbUrl);
    if (!backup.ok) {
      return { ok: false, inserted: 0, skipped: 0, errors: [`فشل النسخ الاحتياطي: ${backup.error}`] };
    }
    backupPath = backup.path;
  }

  const result = await applyFoundationRecords(orgId, data);
  return { ok: true, ...result, backupPath };
}

/**
 * يُطبّق Foundation Update على جميع المنظمات النشطة.
 * يُستدعى من index.ts بعد نجاح checkSchema.
 * هذه الدالة صامتة — لا تُوقف الخادم في حالة الخطأ.
 */
export async function runFoundationUpdateForAllOrgs(dbUrl?: string): Promise<void> {
  const data = loadFoundationJson();
  if (!data) {
    // لا يوجد قالب — تجاهل بصمت
    return;
  }

  let orgs: { id: number; code: string }[] = [];
  try {
    orgs = await db
      .select({ id: organizations.id, code: organizations.code })
      .from(organizations)
      .where(eq(organizations.status, 'active'));
  } catch (err: any) {
    logger.warn('foundation-update', `فشل جلب المنظمات: ${err.message}`);
    return;
  }

  for (const org of orgs) {
    try {
      const result = await applyFoundationRecords(org.id, data);
      if (result.inserted > 0) {
        logger.info('foundation-update',
          `org ${org.code} (${org.id}): inserted=${result.inserted} skipped=${result.skipped}`);
      }
    } catch (err: any) {
      logger.warn('foundation-update', `org ${org.code} فشل: ${err.message}`);
    }
  }
}
