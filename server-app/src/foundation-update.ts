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
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
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
  foundationTombstones,
} from './schema.js';

// ─── حقول FK التي تشير إلى جداول التأسيس أو الحسابات ──────────────────────
// المفتاح = اسم الحقل في السجل، القيمة = نوع التبعية
const FK_FIELD_MAP: Record<string, { type: 'foundation'; tableKey: string } | { type: 'account' }> = {
  warehouseId:         { type: 'foundation', tableKey: 'warehouses'      },
  branchId:            { type: 'foundation', tableKey: 'branches'        },
  documentTypeId:      { type: 'foundation', tableKey: 'documentTypes'   },
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
async function buildAccountReferenceMap(orgId: number): Promise<Map<string, number>> {
  const acctMap = new Map<string, number>();
  const rows = await db.select({
    id: chartOfAccounts.id,
    systemKey: chartOfAccounts.systemKey,
    code: chartOfAccounts.code,
  })
    .from(chartOfAccounts)
    .where(and(
      eq(chartOfAccounts.orgId, orgId),
    ));
  for (const row of rows) {
    if (row.systemKey) acctMap.set(row.systemKey, row.id);
    if (row.code) acctMap.set(row.code, row.id);
  }
  return acctMap;
}

/**
 * accountLinks lives inside paymentTypesConfig JSONB, so PostgreSQL cannot
 * enforce its organization boundary. Never carry the source organization's
 * numeric accountId through a foundation snapshot. Resolve it using the
 * exported accountCode/accountSystemKey instead.
 */
function resolveNestedAccountReferences(
  record: Record<string, unknown>,
  acctMap: Map<string, number>,
  unresolvedFks: string[],
): void {
  const config = record.paymentTypesConfig;
  if (!config || typeof config !== 'object' || Array.isArray(config)) return;

  const links = (config as Record<string, unknown>).accountLinks;
  if (!Array.isArray(links)) return;

  const resolvedLinks = links.map((rawLink, index) => {
    if (!rawLink || typeof rawLink !== 'object' || Array.isArray(rawLink)) return rawLink;
    const link = { ...(rawLink as Record<string, unknown>) };
    const reference = link.accountSystemKey ?? link.accountCode;
    const rawAccountId = link.accountId;

    if (reference === null || reference === undefined || reference === '') {
      if (typeof rawAccountId === 'number') {
        unresolvedFks.push(
          `paymentTypesConfig.accountLinks[${index}].accountId: رابط حساب رقمي بلا accountCode/accountSystemKey`,
        );
      }
      return link;
    }

    const accountId = acctMap.get(String(reference));
    if (accountId === undefined) {
      unresolvedFks.push(
        `paymentTypesConfig.accountLinks[${index}]: الحساب ذو المرجع "${reference}" غير موجود في الوجهة`,
      );
      return link;
    }

    link.accountId = accountId;
    delete link.accountSystemKey;
    return link;
  });

  record.paymentTypesConfig = {
    ...(config as Record<string, unknown>),
    accountLinks: resolvedLinks,
  };
}

/**
 * يحوّل سجلاً مُصدَّراً (يحتوي على حقول _xxx_fk) إلى كائن جاهز للإدراج
 * عبر حل المراجع إلى IDs حقيقية في المنظمة الهدف.
 * يحذف جميع حقول _xxx_fk من الكائن النهائي.
 *
 * سياسة FK الصارمة:
 *  - إذا كانت قيمة _xxx_fk = null: يُعيَّن الحقل null (مشروع).
 *  - إذا كانت قيمة _xxx_fk غير null ولم تُحَل: لا null صامت —
 *    يُضاف خطأ إلى unresolvedFks ويُترك الإدراج للمُستدعي.
 */
function resolveRecordFks(
  record: Record<string, unknown>,
  fkMap:  Map<string, number>,
  acctMap: Map<string, number>,
): { data: Record<string, unknown>; unresolvedFks: string[] } {
  const out: Record<string, unknown> = {};
  const unresolvedFks: string[] = [];

  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith('_') && key.endsWith('_fk')) continue; // نحذف حقول التوثيق
    out[key] = value;
  }

  // نحل FK fields باستخدام المرجع المُضمَّن في _xxx_fk
  for (const [fkField, fkDef] of Object.entries(FK_FIELD_MAP)) {
    const refField = `_${fkField}_fk`;
    if (!(refField in record)) continue; // الحقل غير موجود في هذا السجل — تجاهل
    const refValue = record[refField];

    if (refValue === null || refValue === undefined) {
      // المصدر كان null — مشروع، نُعيَّن null
      out[fkField] = null;
      continue;
    }

    // refValue غير null — يجب أن يُحَل
    if (fkDef.type === 'foundation') {
      const id = fkMap.get(String(refValue));
      if (id === undefined) {
        unresolvedFks.push(
          `${fkField}: "${refValue}" غير موجود في جداول التأسيس المُطبَّقة — تحقق من ترتيب التطبيق`,
        );
      } else {
        out[fkField] = id;
      }
    } else {
      // account — refValue = systemKey
      const id = acctMap.get(String(refValue));
      if (id === undefined) {
        unresolvedFks.push(
          `${fkField}: الحساب ذو systemKey="${refValue}" غير موجود في الوجهة — أضف الحساب قبل تطبيق القالب`,
        );
      } else {
        out[fkField] = id;
      }
    }
  }

  resolveNestedAccountReferences(out, acctMap, unresolvedFks);
  return { data: out, unresolvedFks };
}

// ─── محرك التطبيق المركزي ───────────────────────────────────────────────────

export interface ApplyResult {
  inserted: number;
  skipped:  number;
  errors:   string[];
}

export interface FoundationSnapshot {
  data: Record<string, unknown[]>;
  path: string;
  hash: string;
  exportedAt: string | null;
  recordsExpected: number;
}

export interface FoundationOrganizationResult {
  organizationId: number;
  organizationCode: string;
  snapshotHash: string;
  recordsExpected: number;
  recordsExisting: number;
  recordsInserted: number;
  recordsPreserved: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errors: string[];
  status: 'applied' | 'failed';
}

export interface FoundationRunSummary {
  ok: boolean;
  snapshotHash: string | null;
  exportedAt: string | null;
  recordsExpected: number;
  organizationsChecked: number;
  organizations: FoundationOrganizationResult[];
  error?: string;
}

/**
 * يطبّق بيانات قالب التأسيس على منظمة محددة.
 * - يتجاهل السجلات التي يوجد foundationKey مماثل لها مسبقاً.
 * - يحل FK بشكل تلقائي عبر الخرائط المبنية من السجلات المُدرَجة.
 * - يطبّق في ترتيب التبعيات الصحيح.
 *
 * opts.isFirstRun:
 *  - true  (fresh install): تُدرَج كل السجلات بغض النظر عن السياسة.
 *  - false (تحديث — القيمة الافتراضية): سجلات flexible المحذوفة لا تُعاد —
 *    يُحترَم قرار المستخدم بالحذف. يُعاد إدراج سجلات protected/editable فقط.
 */
export async function applyFoundationRecords(
  orgId: number,
  data:  Record<string, unknown[]>,
  opts?: { isFirstRun?: boolean },
): Promise<ApplyResult> {
  const isFirstRun = opts?.isFirstRun ?? false;
  let inserted = 0;
  let skipped  = 0;
  const errors: string[] = [];

  // نبني خرائط الحسابات والـ foundationKeys مسبقاً
  const fkMap   = await buildFoundationKeyIdMap(orgId);
  const acctMap = await buildAccountReferenceMap(orgId);

  // نحمل Tombstones للسجلات التي حذفها المستخدم عمداً
  const tombstoneRows = await db.select({
    tableName: foundationTombstones.tableName,
    foundationKey: foundationTombstones.foundationKey,
  }).from(foundationTombstones)
    .where(eq(foundationTombstones.orgId, orgId));
  const tombstoneSet = new Set(tombstoneRows.map(r => `${r.tableName}:${r.foundationKey}`));

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

      // تحقق من Tombstone: إذا حذف المستخدم هذا السجل عمداً، لا نعيده
      if (tombstoneSet.has(`${tableName}:${fKey}`)) { skipped++; continue; }

      // سياسة التحديث: سجلات flexible المحذوفة لا تُعاد أثناء الترقية.
      // تُعاد السجلات editable/protected فقط، ما لم يكن هذا أول تثبيت.
      if (!isFirstRun) {
        const policy = record['recordPolicy'] as string | undefined;
        if (policy === 'flexible') { skipped++; continue; }
      }

      try {
        const { data: resolved, unresolvedFks } = resolveRecordFks(record, fkMap, acctMap);

        // سياسة صارمة: لا null صامت — إذا كانت هناك FKs غير محلولة نتخطى السجل
        if (unresolvedFks.length > 0) {
          const msg = `${tableName}[${fKey}]: فشل حل FK — ${unresolvedFks.join('; ')}`;
          errors.push(msg);
          logger.warn('foundation-apply', msg);
          continue;
        }

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
        const cause = err?.cause;
        const detail = [
          err?.message ?? String(err),
          cause?.code ? `code=${cause.code}` : '',
          cause?.detail ? `detail=${cause.detail}` : '',
          cause?.constraint ? `constraint=${cause.constraint}` : '',
          cause?.message && cause.message !== err?.message ? `cause=${cause.message}` : '',
        ].filter(Boolean).join(' | ');
        const msg = detail;
        errors.push(`${tableName}[${fKey}]: ${msg}`);
        logger.warn('foundation-apply', `فشل إدراج ${tableName}[${fKey}]: ${msg}`);
      }
    }
  }

  return { inserted, skipped, errors };
}

// ─── الدوال العامة ───────────────────────────────────────────────────────────

/**
 * يحاول تحديد مسار foundation-data.json من عدة مواضع ممكنة:
 *  1. FOUNDATION_DATA_PATH — متغيّر بيئة (مسار صريح، يسبق كل شيء)
 *  2. process.resourcesPath — متاح مباشرةً في سياق Electron (main process / fork)
 *  3. RESOURCES_PATH env   — يُمرَّر من Electron إلى الخادم كـ child_process.spawn
 *  4. __dirname/../src     — مجاور لملف index المُجمَّع (للإنتاج)
 *  5. cwd/src              — المسار الافتراضي للتطوير
 */
function resolveFoundationJsonPath(): string | null {
  const candidates: string[] = [];

  // 1. مسار صريح عبر متغيّر بيئة
  if (process.env['FOUNDATION_DATA_PATH']) {
    candidates.push(process.env['FOUNDATION_DATA_PATH']);
  }

  // 2. process.resourcesPath — متاح مباشرةً في Electron main/fork contexts
  const electronResourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  if (electronResourcesPath) {
    candidates.push(
      path.join(electronResourcesPath, 'app', 'server-app', 'src', 'foundation-data.json'),
    );
  }

  // 3. RESOURCES_PATH كـ env var (يُمرَّر من Electron main → spawn child)
  if (process.env['RESOURCES_PATH']) {
    candidates.push(
      path.join(process.env['RESOURCES_PATH'], 'app', 'server-app', 'src', 'foundation-data.json'),
    );
  }

  // 4. مجاور للملف المُجمَّع: dist/index.mjs → dist/../src/foundation-data.json
  try {
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    candidates.push(path.join(dirname, '..', 'src', 'foundation-data.json'));
  } catch { /* ESM import.meta.url قد لا يكون متاحاً */ }

  // 5. المسار الافتراضي للتطوير
  candidates.push(path.resolve(process.cwd(), 'src', 'foundation-data.json'));

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadFoundationSnapshot(): FoundationSnapshot | null {
  const jsonPath = resolveFoundationJsonPath();
  if (!jsonPath) return null;
  try {
    const raw = fs.readFileSync(jsonPath);
    const parsed = JSON.parse(raw.toString('utf8')) as Record<string, unknown[]>;
    const recordsExpected = APPLY_ORDER.reduce((total, { dataKey }) => {
      const records = parsed[dataKey];
      return total + (Array.isArray(records)
        ? records.filter((record) => Boolean((record as Record<string, unknown>).foundationKey)).length
        : 0);
    }, 0);
    return {
      data: parsed,
      path: jsonPath,
      hash: createHash('sha256').update(raw).digest('hex'),
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null,
      recordsExpected,
    };
  } catch {
    return null;
  }
}

function loadFoundationJson(): Record<string, unknown[]> | null {
  return loadFoundationSnapshot()?.data ?? null;
}

async function countExistingFoundationRecords(orgId: number): Promise<number> {
  let count = 0;
  for (const { tableName } of APPLY_ORDER) {
    const table = getTableRef(tableName);
    const rows = await (db.select({ foundationKey: table.foundationKey }) as any)
      .from(table)
      .where(and(eq(table.orgId, orgId), sql`${table.foundationKey} IS NOT NULL`));
    count += rows.length;
  }
  return count;
}

async function findMissingFoundationKeys(
  orgId: number,
  data: Record<string, unknown[]>,
): Promise<string[]> {
  const missing: string[] = [];
  for (const { tableName, dataKey } of APPLY_ORDER) {
    const table = getTableRef(tableName);
    const expected = ((data[dataKey] as unknown[]) ?? [])
      .map((record) => (record as Record<string, unknown>).foundationKey)
      .filter((key): key is string => typeof key === 'string' && key.length > 0);
    if (expected.length === 0) continue;
    const rows = await (db.select({ foundationKey: table.foundationKey }) as any)
      .from(table)
      .where(and(eq(table.orgId, orgId), sql`${table.foundationKey} IS NOT NULL`));
    const present = new Set(rows.map((row: { foundationKey: string | null }) => row.foundationKey));
    for (const key of expected) {
      if (!present.has(key)) missing.push(`${tableName}:${key}`);
    }
  }
  return missing;
}

async function saveFoundationStatus(
  orgId: number,
  snapshotHash: string,
  status: 'applied' | 'failed',
  error: string | null,
): Promise<void> {
  await db.update(organizations).set({
    foundationSnapshotHash: snapshotHash,
    foundationAppliedAt: status === 'applied' ? new Date() : undefined,
    foundationStatus: status,
    foundationLastError: error,
    updatedAt: new Date(),
  }).where(eq(organizations.id, orgId));
}

/**
 * يُستدعى من bootstrap.ts بعد seedFoundationAccounts.
 * يطبّق قالب التأسيس على منظمة جديدة.
 * يبحث عن foundation-data.json في مسارات: process.resourcesPath → RESOURCES_PATH env → cwd/src.
 * إذا لم يكن ملف القالب موجوداً يتجاهل بصمت.
 */
export async function seedFromFoundationTemplate(orgId: number): Promise<void> {
  const resolvedPath = resolveFoundationJsonPath();
  const data = resolvedPath ? (() => {
    try { return JSON.parse(fs.readFileSync(resolvedPath, 'utf8')); } catch { return null; }
  })() : null;
  if (!data) {
    logger.info('foundation-seed', 'foundation-data.json غير موجود في أي من المسارات المتوقعة — تجاهل (no-op)');
    return;
  }

  logger.info('foundation-seed', `تطبيق قالب التأسيس على org ${orgId} (من: ${resolvedPath})...`);
  const result = await applyFoundationRecords(orgId, data, { isFirstRun: true });
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
 * فشل أي سجل تأسيسي أساسي يجعل النتيجة غير ناجحة ويمنع إعلان startup الجاهزية.
 *
 * سياسة النسخ الاحتياطي:
 *  - إذا تم توفير dbUrl يُحاوَل إنشاء نسخة احتياطية pg_dump قبل البدء.
 *  - فشل النسخة الاحتياطية = تحذير فقط (warn) ولا يُوقف التحديث.
 *  - نجاح النسخة الاحتياطية مُسجَّل في info مع مسار الملف.
 */
export async function runFoundationUpdateForAllOrgs(dbUrl?: string): Promise<FoundationRunSummary> {
  const snapshot = loadFoundationSnapshot();
  if (!snapshot) {
    const error = 'foundation-data.json غير موجود أو غير صالح';
    logger.error('foundation-update', 'FOUNDATION_INCOMPLETE', { error });
    return {
      ok: false,
      snapshotHash: null,
      exportedAt: null,
      recordsExpected: 0,
      organizationsChecked: 0,
      organizations: [],
      error,
    };
  }

  logger.info('foundation-update', 'FOUNDATION_START', {
    snapshotPath: snapshot.path,
    snapshotHash: snapshot.hash,
    snapshotExportedAt: snapshot.exportedAt,
    recordsExpected: snapshot.recordsExpected,
  });

  // ── محاولة نسخة احتياطية (اختيارية — warn فقط عند الفشل) ────────────────
  if (dbUrl) {
    logger.info('foundation-update', '📦 محاولة نسخة احتياطية pg_dump قبل التحديث...');
    const backup = await backupDatabase(dbUrl);
    if (backup.ok) {
      logger.info('foundation-update', `✅ النسخة الاحتياطية محفوظة: ${backup.path}`);
    } else {
      logger.warn('foundation-update',
        `⚠️ فشلت النسخة الاحتياطية (تابع التحديث بدونها): ${backup.error}`);
    }
  } else {
    logger.info('foundation-update', 'ℹ️ dbUrl غير متاح — تخطّى النسخ الاحتياطي');
  }

  let orgs: { id: number; code: string }[] = [];
  try {
    orgs = await db
      .select({ id: organizations.id, code: organizations.code })
      .from(organizations)
      // جميع المنظمات بغض النظر عن status (active, trial, ...)
      // foundation-update يجب أن يطبق القالب على أي مؤسسة عميل جديدة
      .where(inArray(organizations.status, ['active', 'trial']));
  } catch (err: any) {
    const error = `فشل جلب المنظمات: ${err.message}`;
    logger.error('foundation-update', 'FOUNDATION_INCOMPLETE', { error });
    return {
      ok: false,
      snapshotHash: snapshot.hash,
      exportedAt: snapshot.exportedAt,
      recordsExpected: snapshot.recordsExpected,
      organizationsChecked: 0,
      organizations: [],
      error,
    };
  }

  let totalInserted = 0;
  let totalSkipped  = 0;
  let allOk = true;
  const organizationResults: FoundationOrganizationResult[] = [];

  for (const org of orgs) {
    let recordsExisting = 0;
    try {
      recordsExisting = await countExistingFoundationRecords(org.id);
      logger.info('foundation-update', 'FOUNDATION_START', {
        organizationId: org.id,
        organizationCode: org.code,
        snapshotHash: snapshot.hash,
        recordsExpected: snapshot.recordsExpected,
        recordsExisting,
      });

      const current = await db.select({
        foundationSnapshotHash: organizations.foundationSnapshotHash,
        foundationStatus: organizations.foundationStatus,
      }).from(organizations).where(eq(organizations.id, org.id)).limit(1);
      const missingFoundationKeys = await findMissingFoundationKeys(org.id, snapshot.data);
      if (
        current[0]?.foundationSnapshotHash === snapshot.hash &&
        current[0]?.foundationStatus === 'applied' &&
        missingFoundationKeys.length === 0
      ) {
        totalSkipped += recordsExisting;
        const organizationResult: FoundationOrganizationResult = {
          organizationId: org.id,
          organizationCode: org.code,
          snapshotHash: snapshot.hash,
          recordsExpected: snapshot.recordsExpected,
          recordsExisting,
          recordsInserted: 0,
          recordsPreserved: recordsExisting,
          recordsUpdated: 0,
          recordsSkipped: recordsExisting,
          errors: [],
          status: 'applied',
        };
        organizationResults.push(organizationResult);
        logger.info('foundation-update', 'FOUNDATION_COMPLETE', {
          ...organizationResult,
          reconcile: 'not-needed',
        });
        continue;
      }

      const result = await applyFoundationRecords(org.id, snapshot.data, {
        // An organization that has never completed Foundation reconcile must
        // receive the complete snapshot, including flexible warehouse keys.
        // Once a snapshot was successfully applied, flexible records deleted
        // by the customer remain deleted on later snapshot upgrades.
        isFirstRun: current[0]?.foundationStatus !== 'applied',
      });
      totalInserted += result.inserted;
      totalSkipped  += result.skipped;
      const status = result.errors.length > 0 ? 'failed' : 'applied';
      const errorText = result.errors.length ? result.errors.join(' | ') : null;
      if (status === 'failed') allOk = false;
      await saveFoundationStatus(org.id, snapshot.hash, status, errorText);
      const organizationResult: FoundationOrganizationResult = {
        organizationId: org.id,
        organizationCode: org.code,
        snapshotHash: snapshot.hash,
        recordsExpected: snapshot.recordsExpected,
        recordsExisting,
        recordsInserted: result.inserted,
        recordsPreserved: result.skipped,
        recordsUpdated: 0,
        recordsSkipped: result.skipped,
        errors: result.errors,
        status,
      };
      organizationResults.push(organizationResult);
      logger.info(
        'foundation-update',
        status === 'applied' ? 'FOUNDATION_COMPLETE' : 'FOUNDATION_INCOMPLETE',
        organizationResult,
      );
    } catch (err: any) {
      allOk = false;
      const errorText = err?.message ?? String(err);
      try {
        await saveFoundationStatus(org.id, snapshot.hash, 'failed', errorText);
      } catch (statusErr: any) {
        logger.error('foundation-update', 'FOUNDATION_STATUS_SAVE_FAILED', {
          organizationId: org.id,
          error: statusErr?.message ?? String(statusErr),
        });
      }
      const organizationResult: FoundationOrganizationResult = {
        organizationId: org.id,
        organizationCode: org.code,
        snapshotHash: snapshot.hash,
        recordsExpected: snapshot.recordsExpected,
        recordsExisting,
        recordsInserted: 0,
        recordsPreserved: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        errors: [errorText],
        status: 'failed',
      };
      organizationResults.push(organizationResult);
      logger.error('foundation-update', 'FOUNDATION_INCOMPLETE', organizationResult);
    }
  }

  const summary: FoundationRunSummary = {
    ok: allOk,
    snapshotHash: snapshot.hash,
    exportedAt: snapshot.exportedAt,
    recordsExpected: snapshot.recordsExpected,
    organizationsChecked: orgs.length,
    organizations: organizationResults,
  };
  logger.info('foundation-update', allOk ? 'FOUNDATION_COMPLETE' : 'FOUNDATION_INCOMPLETE', {
    ...summary,
    totalInserted,
    totalSkipped,
  });
  return summary;
}
