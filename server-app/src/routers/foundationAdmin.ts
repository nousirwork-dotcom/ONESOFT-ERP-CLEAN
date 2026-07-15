/**
 * Foundation Admin Router
 *
 * Superadmin-only endpoints for:
 *  - setPolicy  — change record_policy / include_in_foundation on any supported table
 *  - exportTemplate — dump all "include_in_foundation=true" records to foundation-data.ts
 *  - getSummary — count of foundation records per table
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

      // Fetch current record to auto-derive foundation key
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
   * Export all include_in_foundation=true records to server-app/src/foundation-data.ts
   * so the file can be committed and later used to seed new customer DBs.
   * Only works in development (file must be writable).
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

        // Strip org-specific fields
        result[tableName] = rows.map((row: Record<string, unknown>) => {
          const { id: _id, orgId: _orgId, ...rest } = row;
          return rest;
        });
        totalRecords += rows.length;
      }

      const exportedAt = new Date().toISOString();

      const fileContent = `/**
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
}

export const FOUNDATION_DATA: FoundationData = ${JSON.stringify(
  {
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
  },
  null,
  2,
)};
`;

      // Write file relative to server-app/src/
      const outPath = path.resolve(process.cwd(), 'src', 'foundation-data.ts');
      fs.writeFileSync(outPath, fileContent, 'utf8');

      return { success: true, totalRecords, exportedAt, path: outPath };
    }),
});
