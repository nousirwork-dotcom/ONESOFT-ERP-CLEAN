import { z } from 'zod';
import { eq, and, sql, count, inArray, or } from 'drizzle-orm';
import { router, adminProcedure, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import {
  users, organizations, salesInvoices, purchaseInvoices, journalEntries,
  vouchers, receiptVouchers, paymentVouchers, stockVouchers, inventoryCounts,
  userCategories, appSettings, userGroups, warehouses,
  userWarehouseAssignments, userGroupMembers, userAuditLogs,
} from '../schema.js';
import { hashPassword } from '../auth.js';
import { TRPCError } from '@trpc/server';
import { getLimit } from '../lib/license.js';

// ── سياسة المؤسسة: السماح بمستخدمين بدون كلمة مرور (غير الإداريين فقط) ─────────
export const PASSWORDLESS_POLICY_KEY = 'security.allow_passwordless_users';

async function isPasswordlessAllowed(orgId: number): Promise<boolean> {
  const rows = await db.select({ value: appSettings.value }).from(appSettings)
    .where(and(eq(appSettings.orgId, orgId), eq(appSettings.key, PASSWORDLESS_POLICY_KEY)))
    .limit(1);
  if (!rows.length) return false; // الافتراضي: غير مسموح
  try { return JSON.parse(rows[0].value ?? 'false') === true; } catch { return false; }
}

// ── فحص شامل لجميع مراجع المستخدم التاريخية (كل FKs غير cascade) ─────────────
// استعلام UNION واحد يغطي كل الجداول دفعةً واحدة بدلاً من ~35 استعلام منفصل
async function countAllLinkedRefs(orgId: number, userId: number): Promise<number> {
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(c), 0)::bigint AS total FROM (
      SELECT COUNT(*) AS c FROM sales_invoices          WHERE org_id = ${orgId} AND (user_id = ${userId} OR seller_user_id = ${userId})
      UNION ALL SELECT COUNT(*) FROM purchase_invoices   WHERE org_id = ${orgId} AND user_id = ${userId}
      UNION ALL SELECT COUNT(*) FROM journal_entries     WHERE org_id = ${orgId} AND user_id = ${userId}
      UNION ALL SELECT COUNT(*) FROM vouchers            WHERE org_id = ${orgId} AND user_id = ${userId}
      UNION ALL SELECT COUNT(*) FROM receipt_vouchers    WHERE org_id = ${orgId} AND user_id = ${userId}
      UNION ALL SELECT COUNT(*) FROM payment_vouchers    WHERE org_id = ${orgId} AND user_id = ${userId}
      UNION ALL SELECT COUNT(*) FROM stock_vouchers      WHERE org_id = ${orgId} AND user_id = ${userId}
      UNION ALL SELECT COUNT(*) FROM inventory_counts    WHERE org_id = ${orgId} AND user_id = ${userId}
      UNION ALL SELECT COUNT(*) FROM document_send_logs  WHERE org_id = ${orgId} AND sent_by_user_id = ${userId}
      UNION ALL SELECT COUNT(*) FROM messages            WHERE org_id = ${orgId} AND (sender_id = ${userId} OR receiver_id = ${userId})
      UNION ALL SELECT COUNT(*) FROM security_events     WHERE org_id = ${orgId} AND user_id = ${userId}
      UNION ALL SELECT COUNT(*) FROM re_documents        WHERE org_id = ${orgId} AND (created_by = ${userId} OR updated_by = ${userId})
      UNION ALL SELECT COUNT(*) FROM re_housing_units    WHERE org_id = ${orgId} AND (created_by = ${userId} OR updated_by = ${userId})
      UNION ALL SELECT COUNT(*) FROM re_projects         WHERE org_id = ${orgId} AND (created_by = ${userId} OR updated_by = ${userId})
      UNION ALL SELECT COUNT(*) FROM re_purchase_statements WHERE org_id = ${orgId} AND (created_by = ${userId} OR updated_by = ${userId})
      UNION ALL SELECT COUNT(*) FROM re_purchases        WHERE org_id = ${orgId} AND (created_by = ${userId} OR updated_by = ${userId})
      UNION ALL SELECT COUNT(*) FROM re_tb_audit_log     WHERE org_id = ${orgId} AND user_id = ${userId}
      UNION ALL SELECT COUNT(*) FROM re_tb_entries       WHERE org_id = ${orgId} AND (created_by = ${userId} OR updated_by = ${userId})
      UNION ALL SELECT COUNT(*) FROM re_tb_settlements   WHERE org_id = ${orgId} AND (created_by = ${userId} OR updated_by = ${userId})
      UNION ALL SELECT COUNT(*) FROM re_tb_tax_returns   WHERE org_id = ${orgId} AND (created_by = ${userId} OR updated_by = ${userId})
      UNION ALL SELECT COUNT(*) FROM re_trial_balances   WHERE org_id = ${orgId} AND (created_by = ${userId} OR updated_by = ${userId})
      UNION ALL SELECT COUNT(*) FROM zatca_api_history   WHERE org_id = ${orgId} AND (user_id = ${userId} OR created_by = ${userId} OR updated_by = ${userId})
      UNION ALL SELECT COUNT(*) FROM zatca_certificates  WHERE org_id = ${orgId} AND (created_by = ${userId} OR updated_by = ${userId})
      UNION ALL SELECT COUNT(*) FROM zatca_csid          WHERE org_id = ${orgId} AND (created_by = ${userId} OR updated_by = ${userId})
      UNION ALL SELECT COUNT(*) FROM zatca_csr_requests  WHERE org_id = ${orgId} AND (created_by = ${userId} OR updated_by = ${userId})
      UNION ALL SELECT COUNT(*) FROM zatca_devices       WHERE org_id = ${orgId} AND (user_id = ${userId} OR created_by = ${userId} OR updated_by = ${userId})
      UNION ALL SELECT COUNT(*) FROM zatca_environments  WHERE org_id = ${orgId} AND (created_by = ${userId} OR updated_by = ${userId})
      UNION ALL SELECT COUNT(*) FROM zatca_error_log     WHERE org_id = ${orgId} AND (created_by = ${userId} OR updated_by = ${userId})
      UNION ALL SELECT COUNT(*) FROM zatca_invoice_transactions WHERE org_id = ${orgId} AND (created_by = ${userId} OR updated_by = ${userId})
      UNION ALL SELECT COUNT(*) FROM zatca_keys          WHERE org_id = ${orgId} AND (created_by = ${userId} OR updated_by = ${userId})
      UNION ALL SELECT COUNT(*) FROM zatca_logs          WHERE org_id = ${orgId} AND user_id = ${userId}
      UNION ALL SELECT COUNT(*) FROM zatca_qr_codes      WHERE org_id = ${orgId} AND (created_by = ${userId} OR updated_by = ${userId})
      UNION ALL SELECT COUNT(*) FROM zatca_request_log   WHERE org_id = ${orgId} AND (created_by = ${userId} OR updated_by = ${userId})
      UNION ALL SELECT COUNT(*) FROM zatca_response_log  WHERE org_id = ${orgId} AND (created_by = ${userId} OR updated_by = ${userId})
      UNION ALL SELECT COUNT(*) FROM zatca_settings      WHERE org_id = ${orgId} AND (created_by = ${userId} OR updated_by = ${userId})
      UNION ALL SELECT COUNT(*) FROM zatca_xml_documents WHERE org_id = ${orgId} AND (created_by = ${userId} OR updated_by = ${userId})
      UNION ALL SELECT COUNT(*) FROM hs_link_sections    WHERE org_id = ${orgId} AND created_by = ${userId}
      UNION ALL SELECT COUNT(*) FROM hs_links            WHERE org_id = ${orgId} AND created_by = ${userId}
    ) t
  `);
  const row = (result as any).rows?.[0] ?? (result as any)[0] ?? {};
  return Number(row.total ?? 0);
}

export const usersRouter = router({
  // قائمة مبسّطة (id + name) لقوائم الاختيار — متاحة لجميع المستخدمين
  listBasic: protectedProcedure.query(async ({ ctx }) => {
    return db.select({ id: users.id, name: users.name, username: users.username })
      .from(users)
      .where(and(eq(users.orgId, ctx.user.orgId), eq(users.isActive, true)));
  }),

  // قائمة البائعين — مفلترة بالمخزن/الفرع عبر user_warehouse_assignments (fallback: defaultWarehouseId)
  listSalespersons: protectedProcedure
    .input(z.object({ warehouseId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      const allSalespersons = await db.select({
        id: users.id,
        name: users.name,
        username: users.username,
        code: users.code,
        defaultWarehouseId: users.defaultWarehouseId,
      })
        .from(users)
        .where(and(
          eq(users.orgId, orgId),
          eq(users.isActive, true),
          eq(users.canBeSalesperson, true),
        ));

      if (!input.warehouseId || allSalespersons.length === 0) return allSalespersons;

      // جلب assignment IDs للمخزن المطلوب
      const assignedUserIds = new Set(
        (await db.select({ userId: userWarehouseAssignments.userId })
          .from(userWarehouseAssignments)
          .where(and(
            eq(userWarehouseAssignments.orgId, orgId),
            eq(userWarehouseAssignments.warehouseId, input.warehouseId),
          ))
        ).map(r => r.userId)
      );

      // فلترة: مُسنَد للمخزن عبر assignments OR defaultWarehouseId يطابق المخزن
      return allSalespersons.filter(u =>
        assignedUserIds.has(u.id) || u.defaultWarehouseId === input.warehouseId
      );
    }),

  // جلب مخازن مستخدم محدد
  listUserWarehouseAssignments: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.select({
        id: userWarehouseAssignments.id,
        warehouseId: userWarehouseAssignments.warehouseId,
        warehouseName: warehouses.name,
        createdAt: userWarehouseAssignments.createdAt,
      })
        .from(userWarehouseAssignments)
        .innerJoin(warehouses, eq(warehouses.id, userWarehouseAssignments.warehouseId))
        .where(and(
          eq(userWarehouseAssignments.orgId, ctx.user.orgId),
          eq(userWarehouseAssignments.userId, input.userId),
        ))
        .orderBy(warehouses.name);
    }),

  // إسناد مستخدم لمخزن/فرع
  addUserWarehouseAssignment: adminProcedure
    .input(z.object({ userId: z.number(), warehouseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.user.orgId;
      // تحقق أن المستخدم والمخزن ينتميان لنفس المنشأة (حماية Cross-Org على مستوى DB)
      const [userRow, warehouseRow] = await Promise.all([
        db.query.users.findFirst({ where: and(eq(users.id, input.userId), eq(users.orgId, orgId)), columns: { id: true } }),
        db.query.warehouses.findFirst({ where: and(eq(warehouses.id, input.warehouseId), eq(warehouses.orgId, orgId)), columns: { id: true } }),
      ]);
      if (!userRow) throw new TRPCError({ code: 'NOT_FOUND', message: 'المستخدم غير موجود' });
      if (!warehouseRow) throw new TRPCError({ code: 'NOT_FOUND', message: 'المخزن/الفرع غير موجود' });
      const [row] = await db.insert(userWarehouseAssignments)
        .values({ orgId, userId: input.userId, warehouseId: input.warehouseId })
        .onConflictDoNothing()
        .returning();
      return row ?? { userId: input.userId, warehouseId: input.warehouseId };
    }),

  // إزالة إسناد مستخدم من مخزن/فرع
  removeUserWarehouseAssignment: adminProcedure
    .input(z.object({ assignmentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.delete(userWarehouseAssignments)
        .where(and(
          eq(userWarehouseAssignments.id, input.assignmentId),
          eq(userWarehouseAssignments.orgId, ctx.user.orgId),
        ));
      return { ok: true };
    }),

  // قائمة مستخدمي المؤسسة (للمديرين فقط) — تشمل الموقوفين حتى يمكن إعادة تفعيلهم
  list: adminProcedure.query(async ({ ctx }) => {
    return db.query.users.findMany({
      where: eq(users.orgId, ctx.user.orgId),
      columns: { passwordHash: false },
      orderBy: (u, { desc, asc }) => [desc(u.isActive), asc(u.name)],
    });
  }),

  // قائمة مجموعات المستخدمين (للقوائم المنسدلة في نافذة المستخدم)
  listUserGroups: adminProcedure.query(async ({ ctx }) => {
    return db.select({ id: userGroups.id, name: userGroups.name })
      .from(userGroups)
      .where(and(eq(userGroups.orgId, ctx.user.orgId), eq(userGroups.isActive, true)))
      .orderBy(userGroups.name);
  }),

  // تسجيل خروج المستخدم من جميع الأجهزة (إبطال الجلسات بتحديث updatedAt)
  logoutAllSessions: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكنك تسجيل خروج حسابك الحالي من هنا — استخدم زر تسجيل الخروج العادي' });
      }
      const user = await db.query.users.findFirst({
        where: and(eq(users.id, input.userId), eq(users.orgId, ctx.user.orgId)),
        columns: { id: true, sessionVersion: true },
      });
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'المستخدم غير موجود' });
      await db.update(users).set({
        sessionVersion: (user.sessionVersion ?? 1) + 1,
        updatedAt: new Date(),
      }).where(and(eq(users.id, input.userId), eq(users.orgId, ctx.user.orgId)));
      return { success: true };
    }),

  // إضافة مستخدم جديد
  create: adminProcedure
    .input(z.object({
      code: z.string().optional(),
      username: z.string().min(3),
      password: z.string().default(''),
      name: z.string().min(2),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      role: z.enum(['admin', 'cashier', 'accountant', 'warehouse_manager', 'viewer']),
      categoryId: z.number().int().positive().optional(),
      userGroupId: z.number().int().positive().nullable().optional(),
      defaultBranchId: z.number().int().positive().nullable().optional(),
      defaultWarehouseId: z.number().int().positive().nullable().optional(),
      defaultLanguage: z.string().max(10).nullable().optional(),
      allowLogin: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // ── License enforcement: max_users ──────────────────────────────────────
      const _licenseLimit = getLimit('max_users');
      let userLimit: number | null = _licenseLimit;
      if (userLimit === null) {
        const [orgRow] = await db.select({ maxUsers: organizations.maxUsers }).from(organizations)
          .where(eq(organizations.id, ctx.user.orgId));
        userLimit = orgRow?.maxUsers ?? null;
      }
      if (userLimit !== null) {
        const [row] = await db
          .select({ cnt: count() })
          .from(users)
          .where(and(eq(users.orgId, ctx.user.orgId), eq(users.isActive, true)));
        if (Number(row.cnt) >= userLimit) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `تجاوز الحد الأقصى المسموح به (${userLimit} مستخدم). يرجى التواصل مع الدعم الفني لتحديث الترخيص.`,
          });
        }
      }

      const existing = await db.query.users.findFirst({
        where: and(eq(users.username, input.username), eq(users.orgId, ctx.user.orgId)),
      });
      if (existing) throw new Error('اسم المستخدم مستخدم بالفعل');

      // ── سياسة كلمة المرور الفارغة ──────────────────────────────────────────
      const wantsPasswordless = !input.password;
      if (wantsPasswordless) {
        if (input.role === 'admin') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'حسابات مدير النظام يجب أن تكون محمية بكلمة مرور',
          });
        }
        if (!(await isPasswordlessAllowed(ctx.user.orgId))) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'سياسة المؤسسة لا تسمح بإنشاء مستخدمين بدون كلمة مرور — فعّل الخيار من إعدادات المستخدمين أو عيّن كلمة مرور',
          });
        }
      }

      if (input.phone) {
        const phoneExists = await db.query.users.findFirst({
          where: and(eq(users.phone, input.phone), eq(users.orgId, ctx.user.orgId), eq(users.isActive, true)),
        });
        if (phoneExists) throw new TRPCError({ code: 'CONFLICT', message: 'رقم الجوال مستخدم لمستخدم آخر في هذه المؤسسة' });
      }

      // منع تكرار كود المستخدم على مستوى المنشأة
      if (input.code) {
        const codeConflict = await db.query.users.findFirst({
          where: and(eq(users.orgId, ctx.user.orgId), eq(users.code, input.code)),
          columns: { id: true },
        });
        if (codeConflict) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'كود المستخدم مستخدم من قبل' });
        }
      }

      // if category has autoNumbering and no code provided, generate next code
      let finalCode = input.code;
      if (!finalCode && input.categoryId) {
        const cats = await db.select().from(userCategories)
          .where(and(eq(userCategories.id, input.categoryId), eq(userCategories.orgId, ctx.user.orgId)))
          .limit(1);
        if (cats.length && cats[0].autoNumbering) {
          const c = cats[0];
          const prefix = c.code ?? "";
          const numDigits = Math.max(c.codeDigits - prefix.length, 1);
          const catUsers = await db.select({ code: users.code }).from(users)
            .where(and(eq(users.orgId, ctx.user.orgId), eq(users.categoryId, input.categoryId), eq(users.isActive, true)));
          let maxNum = c.firstNumber - c.increment;
          for (const u of catUsers) {
            if (!u.code) continue;
            const numPart = prefix && u.code.startsWith(prefix) ? u.code.slice(prefix.length) : u.code;
            const n = parseInt(numPart, 10);
            if (!isNaN(n) && n > maxNum) maxNum = n;
          }
          const nextNum = maxNum < c.firstNumber ? c.firstNumber : maxNum + c.increment;
          if (nextNum <= c.lastNumber) {
            finalCode = prefix + String(nextNum).padStart(numDigits, '0');
          }
        }
      }

      const passwordHash = await hashPassword(input.password);
      const [user] = await db.insert(users).values({
        orgId: ctx.user.orgId,
        code: finalCode,
        username: input.username,
        passwordHash,
        name: input.name,
        email: input.email,
        phone: input.phone,
        role: input.role,
        categoryId: input.categoryId,
        userGroupId: input.userGroupId ?? null,
        defaultBranchId: input.defaultBranchId ?? null,
        defaultWarehouseId: input.defaultWarehouseId ?? null,
        defaultLanguage: input.defaultLanguage ?? null,
        allowLogin: input.allowLogin ?? true,
        isActive: true,
        passwordStatus: wantsPasswordless ? 'not_set' : 'set',
      }).returning({ id: users.id, code: users.code, name: users.name, username: users.username, role: users.role });

      return user;
    }),

  // تعديل مستخدم
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      role: z.enum(['admin', 'cashier', 'accountant', 'warehouse_manager', 'viewer']).optional(),
      isActive: z.boolean().optional(),
      allowLogin: z.boolean().optional(),
      newPassword: z.string().min(1).optional(),
      clearPassword: z.boolean().optional(),
      userGroupId: z.number().int().positive().nullable().optional(),
      defaultBranchId: z.number().int().positive().nullable().optional(),
      defaultWarehouseId: z.number().int().positive().nullable().optional(),
      defaultLanguage: z.string().max(10).nullable().optional(),
      forcePasswordChange: z.boolean().optional(),
      canBeSalesperson: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, newPassword, clearPassword, ...rest } = input;

      const user = await db.query.users.findFirst({
        where: and(eq(users.id, id), eq(users.orgId, ctx.user.orgId)),
      });
      if (!user) throw new Error('المستخدم غير موجود');

      // ── حماية: لا يمكن إزالة كلمة مرور حسابات الإدارة ──────────────────────
      if (clearPassword && !newPassword) {
        const targetRole = rest.role ?? user.role;
        if (targetRole === 'admin' || targetRole === 'superadmin') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'لا يمكن إزالة كلمة مرور حساب مدير النظام — يجب أن يبقى محمياً بكلمة مرور',
          });
        }
        // ── سياسة المؤسسة: السماح بكلمة مرور فارغة لغير الإداريين ──────────
        if (!(await isPasswordlessAllowed(ctx.user.orgId))) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'سياسة المؤسسة لا تسمح بمستخدمين بدون كلمة مرور — فعّل الخيار من إعدادات المستخدمين أولاً',
          });
        }
      }

      // ── حماية: لا يمكن إيقاف آخر مدير نشط ────────────────────────────────
      if (rest.isActive === false && user.isActive &&
          (user.role === 'admin' || user.role === 'superadmin')) {
        const [adminRow] = await db.select({ cnt: count() }).from(users)
          .where(and(
            eq(users.orgId, ctx.user.orgId),
            eq(users.isActive, true),
            inArray(users.role, ['admin', 'superadmin']),
          ));
        if (Number(adminRow.cnt) <= 1) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'لا يمكن إيقاف آخر مدير نظام نشط في المؤسسة',
          });
        }
      }

      // ── فحص الحد عند إعادة تفعيل مستخدم موقوف ──────────────────────────
      if (rest.isActive === true && !user.isActive) {
        const [cntRow] = await db.select({ cnt: count() }).from(users)
          .where(and(eq(users.orgId, ctx.user.orgId), eq(users.isActive, true)));
        const current = Number(cntRow.cnt);
        const licLimit  = getLimit('max_users');
        let reactivateLimit: number | null = licLimit;
        if (reactivateLimit === null) {
          const [orgRow] = await db.select({ maxUsers: organizations.maxUsers }).from(organizations)
            .where(eq(organizations.id, ctx.user.orgId));
          reactivateLimit = orgRow?.maxUsers ?? null;
        }
        if (reactivateLimit !== null && current >= reactivateLimit) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `تجاوز الحد الأقصى المسموح به (${reactivateLimit} مستخدم). لا يمكن إعادة تفعيل المستخدم حتى يتم تحديث الترخيص.`,
          });
        }
      }

      if (rest.phone) {
        const phoneExists = await db.query.users.findFirst({
          where: and(eq(users.phone, rest.phone), eq(users.orgId, ctx.user.orgId), eq(users.isActive, true)),
        });
        if (phoneExists && phoneExists.id !== id) {
          throw new TRPCError({ code: 'CONFLICT', message: 'رقم الجوال مستخدم لمستخدم آخر في هذه المؤسسة' });
        }
      }

      // ── تصفير التحقق إذا تغير رقم الجوال أو البريد ─────────────────────────
      const phoneChanged = rest.phone !== undefined && rest.phone !== user.phone;
      const emailChanged = rest.email !== undefined && rest.email !== user.email;

      await db.update(users).set({
        ...rest,
        ...(newPassword ? { passwordHash: await hashPassword(newPassword), passwordStatus: 'set' } : {}),
        // إزالة كلمة المرور (دخول بدون كلمة مرور — من جهاز السيرفر فقط حسب سياسة الدخول)
        ...(!newPassword && clearPassword
          ? { passwordHash: await hashPassword(''), passwordStatus: 'not_set' }
          : {}),
        // إذا تغير الجوال → تصفير التحقق وتعطيل الاستعادة
        ...(phoneChanged ? { phoneVerifiedAt: null, recoveryEnabledPhone: false } : {}),
        // إذا تغير البريد → تصفير التحقق وتعطيل الاستعادة
        ...(emailChanged ? { emailVerifiedAt: null, recoveryEnabledEmail: false } : {}),
        updatedAt: new Date(),
      }).where(eq(users.id, id));

      return { success: true };
    }),

  // ── تحديث الصلاحيات الإضافية (extra_permissions JSONB) — للمديرين فقط ──────
  setExtraPermissions: adminProcedure
    .input(z.object({
      userId: z.number(),
      permissions: z.record(
        z.enum([
          'manage_branding',
          'help_services',
          'hs_rentals', 'hs_custody', 'hs_customers', 'hs_tasks',
          'hs_gov_links', 'hs_notes', 'hs_internal_comm',
          'hs_links_add', 'hs_links_edit', 'hs_links_delete', 'hs_links_manage_sections',
          'hs_real_estate', 'hs_re_purchases', 'hs_re_documents', 'hs_re_trial_balance',
          // المساعد الذكي
          'ai_use',
          'ai_ask_customers', 'ai_ask_rentals', 'ai_ask_custody',
          'ai_ask_projects', 'ai_ask_tasks',
          'ai_draft_messages', 'ai_propose_tasks', 'ai_confirm_tasks',
          'ai_view_history', 'ai_delete_conversations', 'ai_manage_settings',
          // إعدادات العمل
          'can_work_cashier', 'can_work_accountant',
        ]),
        z.boolean(),
      ),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await db.query.users.findFirst({
        where: and(eq(users.id, input.userId), eq(users.orgId, ctx.user.orgId)),
      });
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'المستخدم غير موجود' });

      const merged: Record<string, boolean> = {
        ...((user.extraPermissions ?? {}) as Record<string, boolean>),
        ...input.permissions,
      };

      await db.update(users).set({
        extraPermissions: merged,
        updatedAt: new Date(),
      }).where(and(eq(users.id, input.userId), eq(users.orgId, ctx.user.orgId)));

      return { success: true };
    }),

  // تحديث دور المستخدم
  updateRole: adminProcedure
    .input(z.object({
      userId: z.number(),
      role: z.enum(['admin', 'cashier', 'accountant', 'warehouse_manager', 'viewer']),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await db.query.users.findFirst({
        where: and(eq(users.id, input.userId), eq(users.orgId, ctx.user.orgId)),
      });
      if (!user) throw new Error('المستخدم غير موجود');

      await db.update(users).set({
        role: input.role,
        updatedAt: new Date(),
      }).where(and(eq(users.id, input.userId), eq(users.orgId, ctx.user.orgId)));

      return { success: true };
    }),

  // ── فحص إمكانية حذف مستخدم ───────────────────────────────────────────────
  checkDeleteEligibility: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const orgId = ctx.user.orgId;

      const targetUser = await db.query.users.findFirst({
        where: and(eq(users.id, input.id), eq(users.orgId, orgId)),
      });
      if (!targetUser) throw new TRPCError({ code: 'NOT_FOUND', message: 'المستخدم غير موجود' });

      if (input.id === ctx.user.id) {
        return { canDelete: false, canDeactivate: false, linkedCount: 0, reason: 'لا يمكنك حذف حسابك الخاص' };
      }

      const firstUser = await db.query.users.findFirst({
        where: eq(users.orgId, orgId),
        orderBy: (u, { asc }) => [asc(u.id)],
        columns: { id: true },
      });
      if (firstUser?.id === input.id) {
        return { canDelete: false, canDeactivate: false, linkedCount: 0, reason: 'لا يمكن حذف أو إيقاف المدير الأساسي للنظام' };
      }

      if (targetUser.isActive && (targetUser.role === 'admin' || targetUser.role === 'superadmin')) {
        const [adminRow] = await db.select({ cnt: count() }).from(users).where(
          and(eq(users.orgId, orgId), eq(users.isActive, true), inArray(users.role, ['admin', 'superadmin'])),
        );
        if (Number(adminRow.cnt) <= 1) {
          return { canDelete: false, canDeactivate: false, linkedCount: 0, reason: 'لا يمكن حذف أو إيقاف آخر مدير نظام نشط في المؤسسة' };
        }
      }

      // ── فحص شامل لجميع المراجع التاريخية عبر استعلام UNION واحد ─────────
      const linkedCount = await countAllLinkedRefs(orgId, input.id);

      if (linkedCount > 0) {
        return {
          canDelete: false,
          canDeactivate: targetUser.isActive,
          linkedCount,
          reason: 'لا يمكن حذف المستخدم لأنه مرتبط بحركات أو مستندات مسجلة. يمكنك إيقاف المستخدم بدلًا من حذفه.',
        };
      }

      return { canDelete: true, canDeactivate: true, linkedCount: 0, reason: undefined };
    }),

  // ── حذف مستخدم نهائياً (لا يمكن التراجع) ────────────────────────────────
  deleteUser: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.user.orgId;

      if (input.id === ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'لا يمكنك حذف حسابك الخاص' });
      }

      const targetUser = await db.query.users.findFirst({
        where: and(eq(users.id, input.id), eq(users.orgId, orgId)),
      });
      if (!targetUser) throw new TRPCError({ code: 'NOT_FOUND', message: 'المستخدم غير موجود' });

      const firstUser = await db.query.users.findFirst({
        where: eq(users.orgId, orgId),
        orderBy: (u, { asc }) => [asc(u.id)],
        columns: { id: true },
      });
      if (firstUser?.id === input.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'لا يمكن حذف المدير الأساسي للنظام' });
      }

      if (targetUser.isActive && (targetUser.role === 'admin' || targetUser.role === 'superadmin')) {
        const [adminRow] = await db.select({ cnt: count() }).from(users).where(
          and(eq(users.orgId, orgId), eq(users.isActive, true), inArray(users.role, ['admin', 'superadmin'])),
        );
        if (Number(adminRow.cnt) <= 1) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'لا يمكن حذف آخر مدير نظام نشط في المؤسسة' });
        }
      }

      // ── إعادة فحص شامل وقت الحذف الفعلي (منع race condition) ─────────────
      const linkedCount = await countAllLinkedRefs(orgId, input.id);

      if (linkedCount > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'لا يمكن حذف المستخدم لأنه مرتبط بحركات أو مستندات مسجلة. يمكنك إيقاف المستخدم بدلًا من حذفه.',
        });
      }

      const ipAddress = (ctx.req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
        ?? ctx.req.socket?.remoteAddress ?? null;

      // ── حذف نهائي + سجل تدقيق داخل transaction واحدة ────────────────────
      await db.transaction(async (tx) => {
        // 1. سجل التدقيق أولاً (قبل الحذف حتى لا تضيع البيانات)
        await tx.insert(userAuditLogs).values({
          orgId,
          actorUserId:   ctx.user.id,
          actorUsername: ctx.user.username,
          targetUserId:  input.id,
          targetCode:    targetUser.code ?? null,
          targetName:    targetUser.name,
          targetUsername: targetUser.username,
          action:        'DELETE_USER',
          ipAddress:     ipAddress ?? null,
          result:        'success',
        });
        // 2. إسنادات المخازن (لا FK cascade — يجب حذفها صراحةً)
        await tx.delete(userWarehouseAssignments).where(eq(userWarehouseAssignments.userId, input.id));
        // 3. عضوية مجموعات المستخدمين (تُخزَّن بـ memberCode — لا FK مباشر)
        if (targetUser.code) {
          await tx.delete(userGroupMembers).where(
            and(
              eq(userGroupMembers.orgId, orgId),
              eq(userGroupMembers.memberType, 'user'),
              eq(userGroupMembers.memberCode, targetUser.code),
            ),
          );
        }
        // 4. حذف سجل المستخدم (بقية علاقات onDelete:cascade تُحذف تلقائياً)
        await tx.delete(users).where(and(eq(users.id, input.id), eq(users.orgId, orgId)));
      });

      return { success: true, deletedId: input.id };
    }),

  // ── إيقاف مستخدم (يحتفظ بالبيانات التاريخية) ────────────────────────────
  deactivateUser: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const orgId = ctx.user.orgId;

      if (input.id === ctx.user.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكنك إيقاف حسابك الخاص' });
      }

      const targetUser = await db.query.users.findFirst({
        where: and(eq(users.id, input.id), eq(users.orgId, orgId)),
      });
      if (!targetUser) throw new TRPCError({ code: 'NOT_FOUND', message: 'المستخدم غير موجود' });

      const firstUser = await db.query.users.findFirst({
        where: eq(users.orgId, orgId),
        orderBy: (u, { asc }) => [asc(u.id)],
        columns: { id: true },
      });
      if (firstUser?.id === input.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'لا يمكن إيقاف المدير الأساسي للنظام' });
      }

      if (targetUser.isActive && (targetUser.role === 'admin' || targetUser.role === 'superadmin')) {
        const [adminRow] = await db.select({ cnt: count() }).from(users).where(
          and(eq(users.orgId, orgId), eq(users.isActive, true), inArray(users.role, ['admin', 'superadmin'])),
        );
        if (Number(adminRow.cnt) <= 1) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'لا يمكن إيقاف آخر مدير نظام نشط في المؤسسة' });
        }
      }

      const ipAddress = (ctx.req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
        ?? ctx.req.socket?.remoteAddress ?? null;

      // ── إيقاف + إبطال الجلسات + سجل تدقيق داخل transaction واحدة ─────────
      await db.transaction(async (tx) => {
        // 1. إيقاف المستخدم ورفع sessionVersion (يُبطل جميع JWT tokens فوراً)
        await tx.update(users).set({
          isActive:       false,
          allowLogin:     false,
          sessionVersion: sql`session_version + 1`,
          updatedAt:      new Date(),
        }).where(and(eq(users.id, input.id), eq(users.orgId, orgId)));
        // 2. سجل التدقيق
        await tx.insert(userAuditLogs).values({
          orgId,
          actorUserId:   ctx.user.id,
          actorUsername: ctx.user.username,
          targetUserId:  input.id,
          targetCode:    targetUser.code ?? null,
          targetName:    targetUser.name,
          targetUsername: targetUser.username,
          action:        'DEACTIVATE_USER',
          ipAddress:     ipAddress ?? null,
          result:        'success',
        });
      });

      return { success: true };
    }),

  // تغيير كلمة المرور الخاصة
  changeMyPassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await db.query.users.findFirst({ where: eq(users.id, ctx.user.id) });
      if (!user) throw new Error('المستخدم غير موجود');

      const { verifyPassword } = await import('../auth.js');
      const valid = await verifyPassword(input.currentPassword, user.passwordHash);
      if (!valid) throw new Error('كلمة المرور الحالية غير صحيحة');

      await db.update(users).set({
        passwordHash:   await hashPassword(input.newPassword),
        passwordStatus: 'set',
        updatedAt: new Date(),
      }).where(eq(users.id, ctx.user.id));

      return { success: true };
    }),

  // ── تعيين كلمة مرور admin (وضع تجريبي — password_status = 'not_set') ────────
  // متاح فقط للمستخدم نفسه عبر الشريط التحذيري
  setAdminPassword: protectedProcedure
    .input(z.object({
      name:            z.string().min(2).optional(),
      phone:           z.string().optional(),
      email:           z.string().email().optional().or(z.literal('')),
      password:        z.string().min(1),
      confirmPassword: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (input.password !== input.confirmPassword) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'كلمتا المرور غير متطابقتين' });
      }

      const hash = await hashPassword(input.password);
      await db.update(users).set({
        ...(input.name  ? { name: input.name }   : {}),
        ...(input.phone ? { phone: input.phone }  : {}),
        ...(input.email ? { email: input.email }  : {}),
        passwordHash:     hash,
        passwordStatus:   'set',
        passwordChangedAt: new Date(),
        updatedAt:        new Date(),
      }).where(eq(users.id, ctx.user.id));

      return { success: true };
    }),

  // ── معلومات عدد المستخدمين (للكارت في شاشة المستخدمين) ───────────────────
  getUserCountInfo: adminProcedure.query(async ({ ctx }) => {
    const [userRow] = await db
      .select({ cnt: count() })
      .from(users)
      .where(and(eq(users.orgId, ctx.user.orgId), eq(users.isActive, true)));
    const current = Number(userRow.cnt);

    // maxUsers من الترخيص، أو من المؤسسة إذا لم يكن هناك ترخيص
    const licenseLimit = getLimit('max_users');
    let max = licenseLimit ?? 5;
    if (licenseLimit === null) {
      const [orgRow] = await db
        .select({ maxUsers: organizations.maxUsers })
        .from(organizations)
        .where(eq(organizations.id, ctx.user.orgId));
      max = orgRow?.maxUsers ?? 5;
    }

    return {
      current,
      max,
      remaining: Math.max(0, max - current),
      atLimit:   current >= max,
    };
  }),
});
