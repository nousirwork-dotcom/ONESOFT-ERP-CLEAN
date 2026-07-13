import { z } from 'zod';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { hsCustodyEntries } from '../schema.js';

// ─── التحقق من صلاحية العهدة ──────────────────────────────────────────────────
function assertCustodyPerm(user: { role: string; extraPermissions?: Record<string, boolean> | null }) {
  const isAdmin = ['admin', 'superadmin'].includes(user.role);
  const hasPerm = user.extraPermissions?.['hs_custody'] === true;
  if (!isAdmin && !hasPerm) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'ليس لديك صلاحية الوصول إلى شاشة متابعة العهد' });
  }
}

const entrySchema = z.object({
  id:              z.number().optional(),
  entryDate:       z.string().min(1),
  description:     z.string().default(''),
  referenceNumber: z.string().nullable().optional(),
  incomeDue:       z.number().default(0),
  incomeCollected: z.number().default(0),
  incomeNote:      z.string().nullable().optional(),
  expenseDue:      z.number().default(0),
  expensePaid:     z.number().default(0),
  expenseNote:     z.string().nullable().optional(),
  sortOrder:       z.number().default(0),
});

export const custodyTrackingRouter = router({

  // ── قائمة الإدخالات ────────────────────────────────────────────────────────
  listEntries: protectedProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      assertCustodyPerm(ctx.user);

      let rows = await db.select()
        .from(hsCustodyEntries)
        .where(eq(hsCustodyEntries.orgId, ctx.user.orgId))
        .orderBy(hsCustodyEntries.sortOrder, hsCustodyEntries.entryDate, hsCustodyEntries.id);

      const q = input?.search?.trim().toLowerCase();
      if (q) {
        rows = rows.filter(r =>
          r.description.toLowerCase().includes(q) ||
          (r.entryDate ?? '').includes(q) ||
          (r.referenceNumber ?? '').toLowerCase().includes(q)
        );
      }

      return rows;
    }),

  // ── حفظ (upsert) إدخال واحد ─────────────────────────────────────────────────
  saveEntry: protectedProcedure
    .input(entrySchema)
    .mutation(async ({ ctx, input }) => {
      assertCustodyPerm(ctx.user);
      const now = new Date();

      if (input.id) {
        const [existing] = await db.select({ id: hsCustodyEntries.id, orgId: hsCustodyEntries.orgId })
          .from(hsCustodyEntries).where(eq(hsCustodyEntries.id, input.id));
        if (!existing || existing.orgId !== ctx.user.orgId)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'الإدخال غير موجود' });

        const [updated] = await db.update(hsCustodyEntries)
          .set({
            entryDate:       input.entryDate,
            description:     input.description,
            referenceNumber: input.referenceNumber ?? null,
            incomeDue:       String(input.incomeDue),
            incomeCollected: String(input.incomeCollected),
            incomeNote:      input.incomeNote ?? null,
            expenseDue:      String(input.expenseDue),
            expensePaid:     String(input.expensePaid),
            expenseNote:     input.expenseNote ?? null,
            sortOrder:       input.sortOrder,
            updatedAt:       now,
          })
          .where(eq(hsCustodyEntries.id, input.id))
          .returning();
        return updated;
      }

      const [inserted] = await db.insert(hsCustodyEntries).values({
        orgId:           ctx.user.orgId,
        createdByUserId: ctx.user.id,
        entryDate:       input.entryDate,
        description:     input.description,
        referenceNumber: input.referenceNumber ?? null,
        incomeDue:       String(input.incomeDue),
        incomeCollected: String(input.incomeCollected),
        incomeNote:      input.incomeNote ?? null,
        expenseDue:      String(input.expenseDue),
        expensePaid:     String(input.expensePaid),
        expenseNote:     input.expenseNote ?? null,
        sortOrder:       input.sortOrder,
        createdAt:       now,
        updatedAt:       now,
      }).returning();
      return inserted;
    }),

  // ── حفظ مجمّع (batch save) ─────────────────────────────────────────────────
  saveBatch: protectedProcedure
    .input(z.array(entrySchema))
    .mutation(async ({ ctx, input }) => {
      assertCustodyPerm(ctx.user);
      const now = new Date();
      const results = [];

      for (const entry of input) {
        if (entry.id) {
          const [existing] = await db.select({ id: hsCustodyEntries.id, orgId: hsCustodyEntries.orgId })
            .from(hsCustodyEntries).where(eq(hsCustodyEntries.id, entry.id));
          if (!existing || existing.orgId !== ctx.user.orgId) continue;

          const [updated] = await db.update(hsCustodyEntries)
            .set({
              entryDate:       entry.entryDate,
              description:     entry.description,
              referenceNumber: entry.referenceNumber ?? null,
              incomeDue:       String(entry.incomeDue),
              incomeCollected: String(entry.incomeCollected),
              incomeNote:      entry.incomeNote ?? null,
              expenseDue:      String(entry.expenseDue),
              expensePaid:     String(entry.expensePaid),
              expenseNote:     entry.expenseNote ?? null,
              sortOrder:       entry.sortOrder,
              updatedAt:       now,
            })
            .where(eq(hsCustodyEntries.id, entry.id))
            .returning();
          if (updated) results.push(updated);
        } else {
          const [inserted] = await db.insert(hsCustodyEntries).values({
            orgId:           ctx.user.orgId,
            createdByUserId: ctx.user.id,
            entryDate:       entry.entryDate,
            description:     entry.description,
            referenceNumber: entry.referenceNumber ?? null,
            incomeDue:       String(entry.incomeDue),
            incomeCollected: String(entry.incomeCollected),
            incomeNote:      entry.incomeNote ?? null,
            expenseDue:      String(entry.expenseDue),
            expensePaid:     String(entry.expensePaid),
            expenseNote:     entry.expenseNote ?? null,
            sortOrder:       entry.sortOrder,
            createdAt:       now,
            updatedAt:       now,
          }).returning();
          if (inserted) results.push(inserted);
        }
      }

      return { saved: results.length };
    }),

  // ── حذف إدخال ──────────────────────────────────────────────────────────────
  deleteEntry: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertCustodyPerm(ctx.user);
      const [existing] = await db.select({ id: hsCustodyEntries.id, orgId: hsCustodyEntries.orgId })
        .from(hsCustodyEntries).where(eq(hsCustodyEntries.id, input.id));
      if (!existing || existing.orgId !== ctx.user.orgId)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'الإدخال غير موجود' });

      await db.delete(hsCustodyEntries).where(eq(hsCustodyEntries.id, input.id));
      return { deleted: true };
    }),
});
