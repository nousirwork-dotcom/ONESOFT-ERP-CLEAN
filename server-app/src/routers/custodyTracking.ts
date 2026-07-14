import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { hsCustodyRecords, hsCustodyEntries, sendSettings, organizations } from '../schema.js';

// ─── التحقق من صلاحية العهدة ──────────────────────────────────────────────────
function assertCustodyPerm(user: { role: string; extraPermissions?: Record<string, boolean> | null }) {
  const isAdmin = ['admin', 'superadmin'].includes(user.role);
  const hasPerm = user.extraPermissions?.['hs_custody'] === true;
  if (!isAdmin && !hasPerm) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'ليس لديك صلاحية الوصول إلى شاشة متابعة العهد' });
  }
}

function fmtNum(n: number): string {
  return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const entryInputSchema = z.object({
  entryDate:       z.string().min(1),
  description:     z.string().default(''),
  referenceNumber: z.string().nullable().optional(),
  amountCollected: z.number().default(0),
  amountPaid:      z.number().default(0),
  note:            z.string().nullable().optional(),
  sortOrder:       z.number().default(0),
});

export const custodyTrackingRouter = router({

  // ── قائمة سجلات العهد (مع الإجماليات) ─────────────────────────────────────
  listRecords: protectedProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      assertCustodyPerm(ctx.user);

      const rows = await db.execute(sql`
        SELECT
          r.id,
          r.record_number,
          r.custody_name,
          r.email,
          r.auto_send_email,
          r.created_at,
          r.updated_at,
          COALESCE(SUM(e.income_collected::numeric), 0)  AS total_collected,
          COALESCE(SUM(e.expense_paid::numeric),    0)   AS total_paid,
          COUNT(e.id)::int                               AS entry_count
        FROM hs_custody_records r
        LEFT JOIN hs_custody_entries e ON e.custody_id = r.id
        WHERE r.org_id = ${ctx.user.orgId}
        GROUP BY r.id
        ORDER BY r.record_number
      `);

      const q = input?.search?.trim().toLowerCase();
      const data = rows.rows as any[];
      if (!q) return data;
      return data.filter(r =>
        String(r.record_number).includes(q) ||
        (r.custody_name ?? '').toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q)
      );
    }),

  // ── جلب سجل واحد مع حركاته ────────────────────────────────────────────────
  getRecord: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      assertCustodyPerm(ctx.user);

      const [record] = await db.select()
        .from(hsCustodyRecords)
        .where(and(eq(hsCustodyRecords.id, input.id), eq(hsCustodyRecords.orgId, ctx.user.orgId)));
      if (!record) throw new TRPCError({ code: 'NOT_FOUND', message: 'السجل غير موجود' });

      const entries = await db.select()
        .from(hsCustodyEntries)
        .where(eq(hsCustodyEntries.custodyId, input.id))
        .orderBy(hsCustodyEntries.sortOrder, hsCustodyEntries.entryDate, hsCustodyEntries.id);

      return { record, entries };
    }),

  // ── إنشاء سجل جديد ──────────────────────────────────────────────────────────
  createRecord: protectedProcedure
    .input(z.object({
      custodyName:   z.string().min(1),
      email:         z.string().email().nullable().optional(),
      autoSendEmail: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      assertCustodyPerm(ctx.user);
      const now = new Date();

      const maxResult = await db.execute(sql`
        SELECT COALESCE(MAX(record_number), 0) AS max FROM hs_custody_records WHERE org_id = ${ctx.user.orgId}
      `);
      const nextNum = Number((maxResult.rows[0] as any)?.max ?? 0) + 1;

      const [inserted] = await db.insert(hsCustodyRecords).values({
        orgId:           ctx.user.orgId,
        createdByUserId: ctx.user.id,
        recordNumber:    nextNum,
        custodyName:     input.custodyName,
        email:           input.email ?? null,
        autoSendEmail:   input.autoSendEmail,
        createdAt:       now,
        updatedAt:       now,
      }).returning();
      return inserted;
    }),

  // ── تعديل سجل ───────────────────────────────────────────────────────────────
  updateRecord: protectedProcedure
    .input(z.object({
      id:            z.number(),
      custodyName:   z.string().min(1),
      email:         z.string().email().nullable().optional(),
      autoSendEmail: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      assertCustodyPerm(ctx.user);
      const now = new Date();

      const [existing] = await db.select({ id: hsCustodyRecords.id })
        .from(hsCustodyRecords)
        .where(and(eq(hsCustodyRecords.id, input.id), eq(hsCustodyRecords.orgId, ctx.user.orgId)));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'السجل غير موجود' });

      const [updated] = await db.update(hsCustodyRecords)
        .set({
          custodyName:   input.custodyName,
          email:         input.email ?? null,
          autoSendEmail: input.autoSendEmail,
          updatedAt:     now,
        })
        .where(eq(hsCustodyRecords.id, input.id))
        .returning();
      return updated;
    }),

  // ── حذف سجل (يحذف الحركات بالتتالي) ────────────────────────────────────────
  deleteRecord: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertCustodyPerm(ctx.user);

      const [existing] = await db.select({ id: hsCustodyRecords.id })
        .from(hsCustodyRecords)
        .where(and(eq(hsCustodyRecords.id, input.id), eq(hsCustodyRecords.orgId, ctx.user.orgId)));
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'السجل غير موجود' });

      await db.delete(hsCustodyEntries).where(eq(hsCustodyEntries.custodyId, input.id));
      await db.delete(hsCustodyRecords).where(eq(hsCustodyRecords.id, input.id));
      return { deleted: true };
    }),

  // ── حفظ الحركات (replace all) ────────────────────────────────────────────────
  saveEntries: protectedProcedure
    .input(z.object({
      custodyId: z.number(),
      entries:   z.array(entryInputSchema),
    }))
    .mutation(async ({ ctx, input }) => {
      assertCustodyPerm(ctx.user);
      const now = new Date();

      const [record] = await db.select({ id: hsCustodyRecords.id })
        .from(hsCustodyRecords)
        .where(and(eq(hsCustodyRecords.id, input.custodyId), eq(hsCustodyRecords.orgId, ctx.user.orgId)));
      if (!record) throw new TRPCError({ code: 'NOT_FOUND', message: 'السجل غير موجود' });

      await db.delete(hsCustodyEntries).where(eq(hsCustodyEntries.custodyId, input.custodyId));

      if (input.entries.length > 0) {
        await db.insert(hsCustodyEntries).values(
          input.entries.map((e, i) => ({
            orgId:           ctx.user.orgId,
            createdByUserId: ctx.user.id,
            custodyId:       input.custodyId,
            entryDate:       e.entryDate,
            description:     e.description,
            referenceNumber: e.referenceNumber ?? null,
            incomeDue:       '0',
            incomeCollected: String(e.amountCollected),
            incomeNote:      e.note ?? null,
            expenseDue:      '0',
            expensePaid:     String(e.amountPaid),
            expenseNote:     null,
            sortOrder:       e.sortOrder ?? i,
            createdAt:       now,
            updatedAt:       now,
          }))
        );
      }

      await db.update(hsCustodyRecords)
        .set({ updatedAt: now })
        .where(eq(hsCustodyRecords.id, input.custodyId));

      return { saved: input.entries.length };
    }),

  // ── إرسال الكشف بالبريد الإلكتروني ──────────────────────────────────────────
  sendEmail: protectedProcedure
    .input(z.object({ custodyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertCustodyPerm(ctx.user);

      const [record] = await db.select()
        .from(hsCustodyRecords)
        .where(and(eq(hsCustodyRecords.id, input.custodyId), eq(hsCustodyRecords.orgId, ctx.user.orgId)));
      if (!record) throw new TRPCError({ code: 'NOT_FOUND', message: 'السجل غير موجود' });
      if (!record.email) throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يوجد بريد إلكتروني مرتبط بهذه العهدة' });

      const [entries, cfg, org] = await Promise.all([
        db.select().from(hsCustodyEntries)
          .where(eq(hsCustodyEntries.custodyId, input.custodyId))
          .orderBy(hsCustodyEntries.sortOrder, hsCustodyEntries.entryDate),
        db.select().from(sendSettings).where(eq(sendSettings.orgId, ctx.user.orgId)).then(r => r[0] ?? null),
        db.select().from(organizations).where(eq(organizations.id, ctx.user.orgId)).then(r => r[0] ?? null),
      ]);

      const totalCollected = entries.reduce((s, e) => s + Number(e.incomeCollected), 0);
      const totalPaid      = entries.reduce((s, e) => s + Number(e.expensePaid),     0);
      const diff           = totalCollected - totalPaid;

      const rowsHtml = entries.map((e, i) => `
        <tr style="${i % 2 === 1 ? 'background:#f8f8f8' : ''}">
          <td style="text-align:center;padding:4px 6px;border:1px solid #ddd">${i + 1}</td>
          <td style="padding:4px 6px;border:1px solid #ddd">${e.entryDate}</td>
          <td style="padding:4px 6px;border:1px solid #ddd">${e.description}</td>
          <td style="padding:4px 6px;border:1px solid #ddd">${e.referenceNumber ?? ''}</td>
          <td style="text-align:left;padding:4px 6px;border:1px solid #ddd">${Number(e.incomeCollected) ? fmtNum(Number(e.incomeCollected)) : ''}</td>
          <td style="text-align:left;padding:4px 6px;border:1px solid #ddd">${Number(e.expensePaid) ? fmtNum(Number(e.expensePaid)) : ''}</td>
          <td style="padding:4px 6px;border:1px solid #ddd">${e.incomeNote ?? ''}</td>
        </tr>`).join('');

      const diffColor = diff > 0 ? '#166534' : diff < 0 ? '#991B1B' : '#1B2B5C';
      const diffMsg   = diff > 0
        ? `رصيد متبقٍ بالعهدة: ${fmtNum(diff)}`
        : diff < 0
          ? `تجاوز في المصروفات: ${fmtNum(Math.abs(diff))}`
          : 'العهدة مسواة بالكامل: 0';

      const subject  = `كشف متابعة العهدة — ${record.custodyName} (رقم ${record.recordNumber})`;
      const bodyHtml = `
        <div dir="rtl" style="font-family:Arial,sans-serif;max-width:720px;margin:auto;color:#1a1a1a">
          <h2 style="color:#1B2B5C;text-align:center;margin-bottom:8px">كشف متابعة العهدة</h2>
          <div style="background:#FEF3C7;border:1px solid #F59E0B;padding:8px 14px;font-size:12px;border-radius:4px;color:#92400E;margin-bottom:14px">
            ⚠ شاشة متابعة داخلية مستقلة — لا تؤثر على الحسابات أو الصندوق أو المخزون
          </div>
          <table style="width:100%;margin-bottom:14px;font-size:13px;border-collapse:collapse">
            <tr>
              <td style="padding:4px 8px;font-weight:bold;width:130px">اسم العهدة:</td>
              <td style="padding:4px 8px">${record.custodyName}</td>
              <td style="padding:4px 8px;font-weight:bold;width:130px">رقم المتابعة:</td>
              <td style="padding:4px 8px">${record.recordNumber}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;font-weight:bold">تاريخ الكشف:</td>
              <td colspan="3" style="padding:4px 8px">${new Date().toISOString().slice(0, 10)}</td>
            </tr>
          </table>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="background:#1B2B5C;color:white">
                <th style="padding:6px 8px;border:1px solid #1B2B5C;text-align:center">م</th>
                <th style="padding:6px 8px;border:1px solid #1B2B5C">التاريخ</th>
                <th style="padding:6px 8px;border:1px solid #1B2B5C">البيان</th>
                <th style="padding:6px 8px;border:1px solid #1B2B5C">رقم المرجع</th>
                <th style="padding:6px 8px;border:1px solid #1B2B5C;text-align:left">المبلغ المحصل</th>
                <th style="padding:6px 8px;border:1px solid #1B2B5C;text-align:left">المبلغ المسدد</th>
                <th style="padding:6px 8px;border:1px solid #1B2B5C">ملاحظة</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr style="background:#E0E7FF;font-weight:bold">
                <td colspan="4" style="text-align:center;padding:6px 8px;border:1px solid #ccc">الإجمالي</td>
                <td style="text-align:left;padding:6px 8px;border:1px solid #ccc">${fmtNum(totalCollected)}</td>
                <td style="text-align:left;padding:6px 8px;border:1px solid #ccc">${fmtNum(totalPaid)}</td>
                <td style="border:1px solid #ccc"></td>
              </tr>
            </tbody>
          </table>
          <p style="text-align:center;font-size:14px;font-weight:bold;margin-top:16px;color:${diffColor}">
            الفرق بين المحصل والمسدد: ${diffMsg}
          </p>
        </div>`;

      const apiKey    = cfg?.emailApiKey;
      const fromEmail = cfg?.emailFromEmail || 'noreply@onesoft.sa';
      const fromName  = cfg?.emailFromName  || org?.name || 'OneSoft ERP';
      let   status    = 'pending';
      let   errorMsg: string | undefined;

      if (apiKey && cfg?.emailEnabled) {
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
              from:    `${fromName} <${fromEmail}>`,
              to:      record.email,
              subject,
              html:    bodyHtml,
            }),
          });
          const json = await res.json() as { id?: string; message?: string };
          status   = res.ok ? 'sent' : 'failed';
          errorMsg = res.ok ? undefined : (json.message || `HTTP ${res.status}`);
        } catch (e: any) {
          status = 'failed'; errorMsg = e.message;
        }
      } else {
        status   = 'not_configured';
        errorMsg = 'لم يتم تهيئة خدمة البريد الإلكتروني';
      }

      return { status, emailEnabled: !!(apiKey && cfg?.emailEnabled), errorMsg };
    }),

  // ── إجراءات مُهملة — استخدم listRecords / saveEntries / deleteRecord بدلاً منها ──
  // هذه الإجراءات مُقفلة بعد إعادة هيكلة شاشة متابعة العهد إلى نموذج ذي مستويين.
  // تُبقى هنا لمنع كسر أي استدعاء قديم مع إعطاء رسالة خطأ واضحة.
  listEntries: protectedProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async () => {
      throw new TRPCError({
        code: 'METHOD_NOT_SUPPORTED',
        message: 'listEntries مهمل — استخدم listRecords بدلاً منه',
      });
    }),

  saveEntry: protectedProcedure
    .input(z.object({ id: z.number().optional() }).passthrough())
    .mutation(async () => {
      throw new TRPCError({
        code: 'METHOD_NOT_SUPPORTED',
        message: 'saveEntry مهمل — استخدم createRecord + saveEntries بدلاً منه',
      });
    }),

  saveBatch: protectedProcedure
    .input(z.array(z.any()))
    .mutation(async () => {
      throw new TRPCError({
        code: 'METHOD_NOT_SUPPORTED',
        message: 'saveBatch مهمل — استخدم saveEntries بدلاً منه',
      });
    }),

  deleteEntry: protectedProcedure
    .input(z.object({ id: z.number(), custodyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      assertCustodyPerm(ctx.user);
      // التحقق من أن الحركة تنتمي لسجل عهدة تابع لهذه المنظمة
      const [existing] = await db.select({
        id:        hsCustodyEntries.id,
        orgId:     hsCustodyEntries.orgId,
        custodyId: hsCustodyEntries.custodyId,
      })
        .from(hsCustodyEntries)
        .where(and(eq(hsCustodyEntries.id, input.id), eq(hsCustodyEntries.custodyId, input.custodyId)));
      if (!existing || existing.orgId !== ctx.user.orgId)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'الحركة غير موجودة أو لا تنتمي لهذه العهدة' });
      await db.delete(hsCustodyEntries).where(eq(hsCustodyEntries.id, input.id));
      return { deleted: true };
    }),
});
