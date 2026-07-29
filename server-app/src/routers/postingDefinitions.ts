import { z } from 'zod';
import { eq, and, asc } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { postingDefinitions, postingDefinitionLines, chartOfAccounts } from '../schema.js';
import { assertCanUpdate, assertCanDelete } from '../lib/foundation-framework.js';

export const POSTING_DOC_TYPES = [
  { id: 'sales_invoice',    variant: 'cash',   label: 'فاتورة مبيعات نقدية' },
  { id: 'sales_invoice',    variant: 'credit', label: 'فاتورة مبيعات آجلة' },
  { id: 'sales_return',     variant: '',       label: 'مردود مبيعات' },
  { id: 'purchase_invoice', variant: '',       label: 'فاتورة مشتريات' },
  { id: 'purchase_return',  variant: '',       label: 'مردود مشتريات' },
  { id: 'receipt_voucher',  variant: '',       label: 'سند قبض' },
  { id: 'payment_voucher',  variant: '',       label: 'سند صرف' },
];

export const AMOUNT_SOURCES = [
  { id: 'total',              label: 'إجمالي الفاتورة' },
  { id: 'net_sales',          label: 'صافي المبيعات' },
  { id: 'tax_amount',         label: 'مبلغ الضريبة' },
  { id: 'discount',           label: 'مبلغ الخصم' },
  { id: 'cogs',               label: 'تكلفة البضاعة' },
  { id: 'shipping',           label: 'قيمة الشحن' },
  { id: 'subtotal',           label: 'المجموع قبل الخصم' },
  { id: 'down_payment',       label: 'الدفعة المقدمة' },
  { id: 'rounding',           label: 'مبلغ التقريب' },
];

const lineShape = z.object({
  description:  z.string().optional(),
  accountId:    z.number().nullable().optional(),
  direction:    z.enum(['debit', 'credit']),
  amountSource: z.string(),
  sortOrder:    z.number().default(0),
});

export const postingDefinitionsRouter = router({

  docTypes: protectedProcedure.query(() => POSTING_DOC_TYPES),

  amountSources: protectedProcedure.query(() => AMOUNT_SOURCES),

  getByDocType: protectedProcedure
    .input(z.object({ docType: z.string(), variant: z.string().default('') }))
    .query(async ({ ctx, input }) => {
      const def = await db.query.postingDefinitions.findFirst({
        where: and(
          eq(postingDefinitions.orgId, ctx.user.orgId),
          eq(postingDefinitions.docType, input.docType),
          eq(postingDefinitions.variant, input.variant),
        ),
      });
      if (!def) return { definition: null, lines: [] };
      const lines = await db.select({
        id:           postingDefinitionLines.id,
        definitionId: postingDefinitionLines.definitionId,
        description:  postingDefinitionLines.description,
        accountId:    postingDefinitionLines.accountId,
        accountCode:  chartOfAccounts.code,
        accountName:  chartOfAccounts.name,
        direction:    postingDefinitionLines.direction,
        amountSource: postingDefinitionLines.amountSource,
        sortOrder:    postingDefinitionLines.sortOrder,
      })
        .from(postingDefinitionLines)
        .leftJoin(chartOfAccounts, eq(postingDefinitionLines.accountId, chartOfAccounts.id))
        .where(eq(postingDefinitionLines.definitionId, def.id))
        .orderBy(asc(postingDefinitionLines.sortOrder), asc(postingDefinitionLines.id));
      return { definition: def, lines };
    }),

  saveLines: protectedProcedure
    .input(z.object({
      docType: z.string(),
      variant: z.string().default(''),
      name:    z.string().optional(),
      lines:   z.array(lineShape),
    }))
    .mutation(async ({ ctx, input }) => {
      let def = await db.query.postingDefinitions.findFirst({
        where: and(
          eq(postingDefinitions.orgId, ctx.user.orgId),
          eq(postingDefinitions.docType, input.docType),
          eq(postingDefinitions.variant, input.variant),
        ),
      });

      const docTypeMeta = POSTING_DOC_TYPES.find(
        d => d.id === input.docType && d.variant === input.variant
      );
      const name = input.name ?? docTypeMeta?.label ?? input.docType;

      if (!def) {
        const [created] = await db.insert(postingDefinitions).values({
          orgId: ctx.user.orgId,
          docType: input.docType,
          variant: input.variant,
          name,
          isActive: true,
          sortOrder: 0,
        }).returning();
        def = created;
      } else {
        assertCanUpdate(def.recordPolicy, def.name, ctx.user.role === 'superadmin');
        await db.update(postingDefinitions)
          .set({ name, updatedAt: new Date() })
          .where(eq(postingDefinitions.id, def.id));
      }

      await db.delete(postingDefinitionLines)
        .where(eq(postingDefinitionLines.definitionId, def.id));

      if (input.lines.length > 0) {
        await db.insert(postingDefinitionLines).values(
          input.lines.map((l, i) => ({
            orgId:        ctx.user.orgId,
            definitionId: def!.id,
            description:  l.description ?? '',
            accountId:    l.accountId ?? null,
            direction:    l.direction,
            amountSource: l.amountSource,
            sortOrder:    i,
          }))
        );
      }

      return { ok: true, definitionId: def.id };
    }),

  deleteDefinition: protectedProcedure
    .input(z.object({ docType: z.string(), variant: z.string().default('') }))
    .mutation(async ({ ctx, input }) => {
      const def = await db.query.postingDefinitions.findFirst({
        where: and(
          eq(postingDefinitions.orgId, ctx.user.orgId),
          eq(postingDefinitions.docType, input.docType),
          eq(postingDefinitions.variant, input.variant),
        ),
      });
      if (!def) return { ok: true };
      assertCanDelete(def.recordPolicy, def.name, ctx.user.role === 'superadmin');
      await db.delete(postingDefinitions).where(eq(postingDefinitions.id, def.id));
      return { ok: true };
    }),
});
