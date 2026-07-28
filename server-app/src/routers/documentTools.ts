import { z } from 'zod';
import { and, eq, or } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import {
  journalEntries,
  salesInvoices,
  users,
} from '../schema.js';

const salesInvoiceInput = z.object({ documentId: z.number().int().positive() });

async function getSalesInvoice(documentId: number, orgId: number) {
  return db.query.salesInvoices.findFirst({
    where: and(
      eq(salesInvoices.id, documentId),
      eq(salesInvoices.orgId, orgId),
    ),
  });
}

export const documentToolsRouter = router({
  /**
   * Read-only contract for the Related Documents window.
   * Only returns journal entries that actually point at this invoice.
   */
  salesInvoiceRelations: protectedProcedure
    .input(salesInvoiceInput)
    .query(async ({ ctx, input }) => {
      const invoice = await getSalesInvoice(input.documentId, ctx.user.orgId);
      if (!invoice) return { documentExists: false, rows: [] };

      const entries = await db.query.journalEntries.findMany({
        where: and(
          eq(journalEntries.orgId, ctx.user.orgId),
          or(
            and(
              eq(journalEntries.sourceDocType, 'sales_invoice'),
              eq(journalEntries.sourceDocId, invoice.id),
            ),
            and(
              eq(journalEntries.sourceDocType, 'sales_return'),
              eq(journalEntries.sourceDocId, invoice.id),
            ),
          ),
        ),
        orderBy: (entry, { asc }) => [asc(entry.entryDate), asc(entry.id)],
      });

      const actorIds = entries
        .map((entry) => entry.userId)
        .filter((id): id is number => id !== null);
      const actors = actorIds.length
        ? await db.query.users.findMany({
            where: and(
              eq(users.orgId, ctx.user.orgId),
              // Avoid importing inArray for the empty-array case above.
              or(...actorIds.map((id) => eq(users.id, id))),
            ),
          })
        : [];
      const actorNames = new Map(actors.map((actor) => [actor.id, actor.name]));

      return {
        documentExists: true,
        rows: entries.map((entry) => ({
          documentType: entry.sourceDocType ?? 'journal_entry',
          documentId: entry.id,
          documentNumber: entry.entryNumber,
          date: entry.entryDate,
          relationType: entry.entryType === 'auto' ? 'generated_by' : 'related',
          status: entry.status,
          debit: entry.totalDebit,
          credit: entry.totalCredit,
          user: entry.userId ? actorNames.get(entry.userId) ?? null : null,
        })),
      };
    }),

  /**
   * Contract reserved for document activity. The current schema has no
   * document-level activity table, so this deliberately returns no invented rows.
   */
  salesInvoiceActivity: protectedProcedure
    .input(salesInvoiceInput)
    .query(async ({ ctx, input }) => ({
      documentExists: Boolean(await getSalesInvoice(input.documentId, ctx.user.orgId)),
      rows: [],
      available: false,
    })),

  /**
   * Contract reserved for document attachments. Attachments are not yet
   * modeled for sales invoices, therefore no synthetic records are returned.
   */
  salesInvoiceAttachments: protectedProcedure
    .input(salesInvoiceInput)
    .query(async ({ ctx, input }) => ({
      documentExists: Boolean(await getSalesInvoice(input.documentId, ctx.user.orgId)),
      rows: [],
      available: false,
    })),
});