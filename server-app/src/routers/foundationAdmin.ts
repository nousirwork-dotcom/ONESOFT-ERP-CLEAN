/**
 * Foundation Admin Router
 *
 * Superadmin-only endpoints for:
 *  - setPolicy       — change record_policy / include_in_foundation on any supported table
 *  - exportTemplate  — dump all "include_in_foundation=true" records to foundation-data.ts + .json
 *  - applyTemplate   — import foundation-data.json into the current org (skip existing foundationKeys)
 *  - getSummary      — count of foundation records per table
 */

import { z }            from 'zod';
import { TRPCError }    from '@trpc/server';
import { eq, and }      from 'drizzle-orm';
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
} from '../schema.js';
import {
  deriveFoundationKey,
  SUPPORTED_FOUNDATION_TABLES,
} from '../lib/foundation-framework.js';
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
   * Export all include_in_foundation=true records.
   * Writes two files side-by-side in server-app/src/:
   *  - foundation-data.ts   (TypeScript, for type safety)
   *  - foundation-data.json (JSON, consumed by applyTemplate at runtime)
   */
  exportTemplate: protectedProcedure
    .mutation(async ({ ctx }) => {
      requireSuperadmin(ctx.user.role);

      const tables: SupportedTable[] = [
        'document_journals', 'document_types', 'branches', 'warehouses', 'units',
        'product_groups', 'payment_methods', 'cost_centers', 'currencies',
        'document_templates', 'posting_definitions',
      ];

      const result: Record<string, unknown[]> = {};
      let totalRecords = 0;

      for (const tableName of tables) {
        const table = getTableRef(tableName);
        const rows = await (db.select() as any)
          .from(table)
          .where(and(
            eq((table as any).orgId, ctx.user.orgId),
            eq((table as any).includeInFoundation, true),
          ));

        result[tableName] = rows.map((row: Record<string, unknown>) => {
          const cleaned: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(row)) {
            if (!STRIP_KEYS.has(k)) cleaned[k] = v;
          }
          return cleaned;
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

      const srcDir = path.resolve(process.cwd(), 'src');

      // ── Write JSON (runtime-importable by applyTemplate) ──────────────────
      const jsonPath = path.join(srcDir, 'foundation-data.json');
      fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');

      // ── Write TypeScript (for type safety + code-review) ──────────────────
      const tsContent = `/**
 * Foundation Template Data
 *
 * AUTO-GENERATED on ${exportedAt} by foundationAdmin.exportTemplate
 * Exported by: ${ctx.user.role} (org: ${ctx.user.orgId})
 *
 * DO NOT EDIT MANUALLY — run "تصدير قالب التأسيس" from the superadmin panel.
 * Total records: ${totalRecords}
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
      const tsPath = path.join(srcDir, 'foundation-data.ts');
      fs.writeFileSync(tsPath, tsContent, 'utf8');

      return { success: true, totalRecords, exportedAt, jsonPath, tsPath };
    }),

  /**
   * Apply the current foundation-data.json to the requesting org.
   * Rules:
   *  - Only inserts records whose foundationKey does NOT exist in the org (never overwrites)
   *  - Sets record_origin = 'foundation' on inserted rows
   *  - Sets foundation_template_version from the JSON's exportedAt date
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
      const orgId = ctx.user.orgId;
      const templateVersion = (data.exportedAt as string).slice(0, 10); // YYYY-MM-DD

      const tableKeyMap: Array<{ tableName: SupportedTable; dataKey: string }> = [
        { tableName: 'document_journals',   dataKey: 'documentJournals'   },
        { tableName: 'document_types',      dataKey: 'documentTypes'      },
        { tableName: 'branches',            dataKey: 'branches'           },
        { tableName: 'warehouses',          dataKey: 'warehouses'         },
        { tableName: 'units',               dataKey: 'units'              },
        { tableName: 'product_groups',      dataKey: 'productGroups'      },
        { tableName: 'payment_methods',     dataKey: 'paymentMethods'     },
        { tableName: 'cost_centers',        dataKey: 'costCenters'        },
        { tableName: 'currencies',          dataKey: 'currencies'         },
        { tableName: 'document_templates',  dataKey: 'documentTemplates'  },
        { tableName: 'posting_definitions', dataKey: 'postingDefinitions' },
      ];

      let inserted = 0;
      let skipped  = 0;
      const errors: string[] = [];

      for (const { tableName, dataKey } of tableKeyMap) {
        const records: Record<string, unknown>[] = data[dataKey] ?? [];
        if (!records.length) continue;

        const table = getTableRef(tableName);

        // Load existing foundation keys for this org
        const existingRows = await (db.select({ foundationKey: (table as any).foundationKey }) as any)
          .from(table)
          .where(and(
            eq((table as any).orgId, orgId),
            eq((table as any).includeInFoundation, true),
          ));
        const existingKeys = new Set(existingRows.map((r: any) => r.foundationKey).filter(Boolean));

        for (const record of records) {
          const fKey = record['foundationKey'] as string | undefined;
          if (!fKey) continue; // skip records without a foundation key

          if (existingKeys.has(fKey)) {
            skipped++;
            continue;
          }

          try {
            await (db.insert(table) as any).values({
              ...record,
              orgId,
              recordOrigin: 'foundation',
              foundationTemplateVersion: templateVersion,
            });
            inserted++;
          } catch (err: any) {
            errors.push(`${tableName}[${fKey}]: ${err?.message ?? String(err)}`);
          }
        }
      }

      return { success: true, inserted, skipped, errors };
    }),
});
