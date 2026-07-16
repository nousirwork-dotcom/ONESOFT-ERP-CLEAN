/**
 * Foundation Admin Router
 *
 * Superadmin-only endpoints for:
 *  - setPolicy          — change record_policy / include_in_foundation on any supported table
 *  - getSummary         — count of foundation records per table
 *  - previewExport      — returns records that will be exported (without writing files)
 *  - exportTemplate     — dump all "include_in_foundation=true" records to foundation-data.ts + .json
 *                         with full FK resolution (_branchId_fk, _warehouseId_fk, _xxxAccountId_fk)
 *  - getTemplateInfo    — info about the current foundation-data.json on disk
 *  - applyTemplate      — import foundation-data.json into the current org (skip existing foundationKeys)
 *                         with full FK resolution in dependency order
 *  - backupAndApply     — create pg_dump backup then apply template (aborts on backup failure)
 */

import { z }            from 'zod';
import { TRPCError }    from '@trpc/server';
import { eq, and, sql } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db }           from '../db.js';
import {
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
} from '../schema.js';
import {
  deriveFoundationKey,
  SUPPORTED_FOUNDATION_TABLES,
} from '../lib/foundation-framework.js';
import {
  applyFoundationRecords,
  backupDatabase,
} from '../foundation-update.js';
import fs   from 'node:fs';
import path from 'node:path';

const POLICY_VALUES = ['protected', 'editable', 'flexible'] as const;

// ─── requireSuperadmin guard ───────────────────────────────────────────────────
function requireSuperadmin(role: string): void {
  if (role !== 'superadmin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'هذه العملية متاحة للمدير العام فقط' });
  }
}

// ─── table accessor helpers ────────────────────────────────────────────────────
type SupportedTable = typeof SUPPORTED_FOUNDATION_TABLES[number];

function getTableRef(tableName: SupportedTable) {
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
    default:
      throw new TRPCError({ code: 'BAD_REQUEST', message: `جدول غير مدعوم: ${tableName}` });
  }
}

// Keys to strip when exporting (org-specific or auto-generated)
const STRIP_KEYS = new Set(['id', 'orgId', 'createdAt', 'updatedAt']);

// ─── حقول FK في document_journals التي تشير إلى الحسابات ──────────────────────
const ACCOUNT_FK_FIELDS = [
  'salesAccountId', 'cashAccountId', 'creditAccountId', 'taxAccountId',
  'discountAccountId', 'purchaseAccountId', 'supplierAccountId',
  'inventoryAccountId', 'cogsAccountId', 'settlementAccountId',
];

// ─── بناء خرائط FK للتصدير ────────────────────────────────────────────────────

async function buildExportFkMaps(orgId: number) {
  // خريطة id → foundationKey لكل الفروع والمخازن في هذه المنظمة
  const branchFkMap   = new Map<number, string>();
  const warehouseFkMap = new Map<number, string>();
  const accountSkMap  = new Map<number, string>(); // id → systemKey

  const branchRows = await db.select({ id: branches.id, foundationKey: branches.foundationKey })
    .from(branches).where(eq(branches.orgId, orgId));
  for (const r of branchRows) if (r.foundationKey) branchFkMap.set(r.id, r.foundationKey);

  const whRows = await db.select({ id: warehouses.id, foundationKey: warehouses.foundationKey })
    .from(warehouses).where(eq(warehouses.orgId, orgId));
  for (const r of whRows) if (r.foundationKey) warehouseFkMap.set(r.id, r.foundationKey);

  const acctRows = await db.select({ id: chartOfAccounts.id, systemKey: chartOfAccounts.systemKey })
    .from(chartOfAccounts).where(and(
      eq(chartOfAccounts.orgId, orgId),
      sql`${chartOfAccounts.systemKey} IS NOT NULL`,
    ));
  for (const r of acctRows) if (r.systemKey) accountSkMap.set(r.id, r.systemKey);

  return { branchFkMap, warehouseFkMap, accountSkMap };
}

/**
 * يُضيف حقول FK التوثيقية إلى سجل مُصدَّر.
 * حقول مثل _branchId_fk = 'br.الرئيسي' تُضاف بجانب الحقول الأصلية.
 * يُستخدم هذا لاحقاً عند التطبيق لحل FKs بدلاً من IDs الخاطئة.
 */
function enrichWithFkRefs(
  row: Record<string, unknown>,
  tableName: string,
  fkMaps: { branchFkMap: Map<number, string>; warehouseFkMap: Map<number, string>; accountSkMap: Map<number, string> },
): Record<string, unknown> {
  const enriched = { ...row };
  const { branchFkMap, warehouseFkMap, accountSkMap } = fkMaps;

  // branch FK (document_journals و warehouses)
  if (typeof row.branchId === 'number') {
    enriched['_branchId_fk'] = branchFkMap.get(row.branchId) ?? null;
  }

  // warehouse FK (document_journals)
  if (tableName === 'document_journals' && typeof row.warehouseId === 'number') {
    enriched['_warehouseId_fk'] = warehouseFkMap.get(row.warehouseId) ?? null;
  }

  // account FKs
  if (tableName === 'document_journals' || tableName === 'posting_definitions') {
    for (const field of ACCOUNT_FK_FIELDS) {
      const id = row[field];
      if (typeof id === 'number') {
        enriched[`_${field}_fk`] = accountSkMap.get(id) ?? null;
      }
    }
  }

  return enriched;
}

// ─── قراءة foundation-data.json ───────────────────────────────────────────────
function readFoundationJson(): Record<string, unknown> | null {
  const jsonPath = path.resolve(process.cwd(), 'src', 'foundation-data.json');
  if (!fs.existsSync(jsonPath)) return null;
  try { return JSON.parse(fs.readFileSync(jsonPath, 'utf8')); }
  catch { return null; }
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const foundationAdminRouter = router({

  /**
   * Update the record_policy and/or include_in_foundation of a single record.
   * Auto-generates foundation_key when includeInFoundation becomes true.
   */
  setPolicy: protectedProcedure
    .input(z.object({
      tableName:           z.enum(SUPPORTED_FOUNDATION_TABLES as [SupportedTable, ...SupportedTable[]]),
      recordId:            z.number(),
      recordPolicy:        z.enum(POLICY_VALUES),
      includeInFoundation: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireSuperadmin(ctx.user.role);

      const { tableName, recordId, recordPolicy, includeInFoundation } = input;
      const table = getTableRef(tableName);

      const [current] = await (db.select() as any)
        .from(table)
        .where(and(eq((table as any).id, recordId), eq((table as any).orgId, ctx.user.orgId)));

      if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'السجل غير موجود' });

      let foundationKey: string | null = current.foundationKey ?? null;

      if (includeInFoundation && !foundationKey) {
        foundationKey = deriveFoundationKey(tableName, current as Record<string, unknown>);
      }
      if (!includeInFoundation) {
        foundationKey = null;
      }

      const updatePayload: Record<string, unknown> = {
        recordPolicy,
        includeInFoundation,
        foundationKey,
      };
      if ('updatedAt' in (table as any)) {
        updatePayload['updatedAt'] = new Date();
      }

      await (db.update(table) as any)
        .set(updatePayload)
        .where(and(eq((table as any).id, recordId), eq((table as any).orgId, ctx.user.orgId)));

      return { success: true, foundationKey };
    }),

  /**
   * Return a count-per-table summary of foundation records in this org.
   */
  getSummary: protectedProcedure
    .query(async ({ ctx }) => {
      requireSuperadmin(ctx.user.role);

      const tables: SupportedTable[] = [
        'document_journals', 'document_types', 'branches', 'warehouses', 'units',
        'product_groups', 'payment_methods', 'cost_centers', 'currencies',
        'document_templates', 'posting_definitions',
      ];

      const counts: Record<string, number> = {};

      for (const tableName of tables) {
        const table = getTableRef(tableName);
        const rows = await (db.select({ id: (table as any).id }) as any)
          .from(table)
          .where(and(
            eq((table as any).orgId, ctx.user.orgId),
            eq((table as any).includeInFoundation, true),
          ));
        counts[tableName] = rows.length;
      }

      return counts;
    }),

  /**
   * معاينة ما سيُصدَّر — يُعيد السجلات فعلياً دون كتابة أي ملف.
   * يُستخدم في الواجهة الإدارية لعرض قائمة السجلات قبل التصدير.
   */
  previewExport: protectedProcedure
    .query(async ({ ctx }) => {
      requireSuperadmin(ctx.user.role);

      const tables: SupportedTable[] = [
        'document_journals', 'document_types', 'branches', 'warehouses', 'units',
        'product_groups', 'payment_methods', 'cost_centers', 'currencies',
        'document_templates', 'posting_definitions',
      ];

      const fkMaps = await buildExportFkMaps(ctx.user.orgId);
      const preview: Record<string, { foundationKey: string; name: string; policy: string }[]> = {};
      let totalRecords = 0;

      for (const tableName of tables) {
        const table = getTableRef(tableName);
        const rows = await (db.select() as any)
          .from(table)
          .where(and(
            eq((table as any).orgId, ctx.user.orgId),
            eq((table as any).includeInFoundation, true),
          ));

        preview[tableName] = rows.map((row: Record<string, unknown>) => ({
          foundationKey: row.foundationKey ?? '',
          name:         String(row.name ?? row.nameAr ?? row.code ?? row.typeId ?? row.id ?? ''),
          policy:       String(row.recordPolicy ?? 'flexible'),
        }));
        totalRecords += rows.length;
      }

      // فحص مشاكل FK
      const warnings: string[] = [];
      const djRows = (await (db.select() as any)
        .from(documentJournals)
        .where(and(
          eq(documentJournals.orgId, ctx.user.orgId),
          eq(documentJournals.includeInFoundation, true),
        ))) as Array<Record<string, unknown>>;

      for (const dj of djRows) {
        const brId = dj.branchId as number | null;
        if (brId && !fkMaps.branchFkMap.has(brId)) {
          warnings.push(`دفتر "${dj.name}": الفرع ${brId} غير مدرج في القالب (لا foundationKey)`);
        }
        const whId = dj.warehouseId as number | null;
        if (whId && !fkMaps.warehouseFkMap.has(whId)) {
          warnings.push(`دفتر "${dj.name}": المخزن ${whId} غير مدرج في القالب (لا foundationKey)`);
        }
      }

      return { preview, totalRecords, warnings };
    }),

  /**
   * تصدير القالب — يكتب foundation-data.json و foundation-data.ts.
   * يُضيف حقول _xxx_fk لحل FK عند التطبيق.
   */
  exportTemplate: protectedProcedure
    .mutation(async ({ ctx }) => {
      requireSuperadmin(ctx.user.role);

      const tables: SupportedTable[] = [
        'document_journals', 'document_types', 'branches', 'warehouses', 'units',
        'product_groups', 'payment_methods', 'cost_centers', 'currencies',
        'document_templates', 'posting_definitions',
      ];

      // نبني خرائط FK قبل التصدير
      const fkMaps = await buildExportFkMaps(ctx.user.orgId);

      const result: Record<string, unknown[]> = {};
      let totalRecords = 0;
      const fkWarnings: string[] = [];

      for (const tableName of tables) {
        const table = getTableRef(tableName);
        const rows = await (db.select() as any)
          .from(table)
          .where(and(
            eq((table as any).orgId, ctx.user.orgId),
            eq((table as any).includeInFoundation, true),
          ));

        result[tableName] = rows.map((row: Record<string, unknown>) => {
          // نحذف الحقول الخاصة بالمنظمة
          const cleaned: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(row)) {
            if (!STRIP_KEYS.has(k)) cleaned[k] = v;
          }
          // نُضيف مراجع FK للحل لاحقاً
          const enriched = enrichWithFkRefs(cleaned, tableName, fkMaps);

          // نتحقق من FK المفقودة
          if (tableName === 'document_journals') {
            const brId = row.branchId as number | null;
            if (brId && !fkMaps.branchFkMap.has(brId)) {
              fkWarnings.push(`دفتر "${row.name}": الفرع ${brId} بلا foundationKey`);
            }
            const whId = row.warehouseId as number | null;
            if (whId && !fkMaps.warehouseFkMap.has(whId)) {
              fkWarnings.push(`دفتر "${row.name}": المخزن ${whId} بلا foundationKey`);
            }
          }

          return enriched;
        });
        totalRecords += rows.length;
      }

      const exportedAt = new Date().toISOString();
      const payload = {
        documentJournals:   result['document_journals']   ?? [],
        documentTypes:      result['document_types']      ?? [],
        branches:           result['branches']            ?? [],
        warehouses:         result['warehouses']          ?? [],
        units:              result['units']               ?? [],
        productGroups:      result['product_groups']      ?? [],
        paymentMethods:     result['payment_methods']     ?? [],
        costCenters:        result['cost_centers']        ?? [],
        currencies:         result['currencies']          ?? [],
        documentTemplates:  result['document_templates']  ?? [],
        postingDefinitions: result['posting_definitions'] ?? [],
        exportedAt,
        totalRecords,
      };

      const srcDir  = path.resolve(process.cwd(), 'src');
      const jsonPath = path.join(srcDir, 'foundation-data.json');
      const tsPath   = path.join(srcDir, 'foundation-data.ts');

      fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');

      const tsContent = `/**
 * Foundation Template Data
 *
 * AUTO-GENERATED on ${exportedAt} by foundationAdmin.exportTemplate
 * Exported by: ${ctx.user.role} (org: ${ctx.user.orgId})
 *
 * DO NOT EDIT MANUALLY — run "تصدير قالب التأسيس" from the superadmin panel.
 * Total records: ${totalRecords}
 *
 * FK refs (_xxx_fk fields) are embedded for automatic resolution when applying.
 */

export type FoundationRecord = Record<string, unknown> & {
  foundationKey: string;
  recordPolicy: 'protected' | 'editable' | 'flexible';
};

export interface FoundationData {
  documentJournals:   FoundationRecord[];
  documentTypes:      FoundationRecord[];
  branches:           FoundationRecord[];
  warehouses:         FoundationRecord[];
  units:              FoundationRecord[];
  productGroups:      FoundationRecord[];
  paymentMethods:     FoundationRecord[];
  costCenters:        FoundationRecord[];
  currencies:         FoundationRecord[];
  documentTemplates:  FoundationRecord[];
  postingDefinitions: FoundationRecord[];
  exportedAt: string;
  totalRecords: number;
}

export const FOUNDATION_DATA: FoundationData = ${JSON.stringify(payload, null, 2)};
`;
      fs.writeFileSync(tsPath, tsContent, 'utf8');

      return { success: true, totalRecords, exportedAt, jsonPath, tsPath, fkWarnings };
    }),

  /**
   * معلومات القالب الموجود على الديسك حالياً.
   */
  getTemplateInfo: protectedProcedure
    .query(async ({ ctx }) => {
      requireSuperadmin(ctx.user.role);

      const data = readFoundationJson();
      if (!data) return { exists: false };

      const counts: Record<string, number> = {};
      const dataKeys = [
        'documentJournals', 'documentTypes', 'branches', 'warehouses', 'units',
        'productGroups', 'paymentMethods', 'costCenters', 'currencies',
        'documentTemplates', 'postingDefinitions',
      ];
      for (const k of dataKeys) {
        counts[k] = Array.isArray(data[k]) ? (data[k] as unknown[]).length : 0;
      }

      return {
        exists:        true,
        exportedAt:    data.exportedAt as string,
        totalRecords:  data.totalRecords as number,
        version:       (data.exportedAt as string).slice(0, 10),
        counts,
      };
    }),

  /**
   * Apply the current foundation-data.json to the requesting org.
   * Uses the full FK-resolution engine from foundation-update.ts.
   * Rules: only inserts new foundationKeys, never modifies existing records.
   */
  applyTemplate: protectedProcedure
    .mutation(async ({ ctx }) => {
      requireSuperadmin(ctx.user.role);

      const jsonPath = path.resolve(process.cwd(), 'src', 'foundation-data.json');
      if (!fs.existsSync(jsonPath)) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'ملف القالب غير موجود — يجب تصدير القالب أولاً من منظمة المصدر',
        });
      }

      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const result = await applyFoundationRecords(ctx.user.orgId, data);
      return { success: true, ...result };
    }),

  /**
   * نسخة احتياطية ثم تطبيق القالب — إذا فشلت النسخة الاحتياطية لا يبدأ التطبيق.
   */
  backupAndApply: protectedProcedure
    .input(z.object({ dbUrl: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireSuperadmin(ctx.user.role);

      const jsonPath = path.resolve(process.cwd(), 'src', 'foundation-data.json');
      if (!fs.existsSync(jsonPath)) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'ملف القالب غير موجود' });
      }

      // نسخة احتياطية أولاً
      const backup = await backupDatabase(input.dbUrl);
      if (!backup.ok) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `فشل النسخ الاحتياطي — التطبيق ملغى: ${backup.error}`,
        });
      }

      const data   = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const result = await applyFoundationRecords(ctx.user.orgId, data);
      return { success: true, backupPath: backup.path, ...result };
    }),
});
