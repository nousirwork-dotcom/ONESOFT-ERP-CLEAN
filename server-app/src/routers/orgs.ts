import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { router, superAdminProcedure, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { organizations, users } from '../schema.js';
import { hashPassword } from '../auth.js';

export const orgsRouter = router({
  // بيانات المؤسسة الحالية للمستخدم
  currentOrg: protectedProcedure.query(async ({ ctx }) => {
    const [org] = await db
      .select({
        id:            organizations.id,
        name:          organizations.name,
        nameEn:        organizations.nameEn,
        code:          organizations.code,
        phone:         organizations.phone,
        address:       organizations.address,
        taxNumber:     organizations.taxNumber,
        commercialReg: organizations.commercialReg,
        currency:      organizations.currency,
      })
      .from(organizations)
      .where(eq(organizations.id, ctx.user.orgId));
    return org ?? null;
  }),

  // قائمة المؤسسات (للمدير العام فقط)
  list: superAdminProcedure.query(async () => {
    return db.query.organizations.findMany({
      orderBy: (o, { asc }) => [asc(o.name)],
    });
  }),

  // إضافة مؤسسة جديدة
  create: superAdminProcedure
    .input(z.object({
      code: z.string().min(2).max(20),
      name: z.string().min(2),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      address: z.string().optional(),
      taxNumber: z.string().optional(),
      currency: z.string().default('SAR'),
      maxUsers: z.number().default(5),
      subscriptionExpiry: z.string().optional(),
      // بيانات المدير الأول
      adminUsername: z.string().min(3),
      adminPassword: z.string().min(6),
      adminName: z.string().min(2),
    }))
    .mutation(async ({ input }) => {
      const code = input.code.toUpperCase();
      
      // التحقق من عدم تكرار الكود
      const existing = await db.query.organizations.findFirst({
        where: eq(organizations.code, code),
      });
      if (existing) throw new Error('كود المؤسسة مستخدم بالفعل');

      // إنشاء المؤسسة
      const [org] = await db.insert(organizations).values({
        code,
        name: input.name,
        phone: input.phone,
        email: input.email,
        address: input.address,
        taxNumber: input.taxNumber,
        currency: input.currency,
        maxUsers: input.maxUsers,
        status: 'active',
        subscriptionExpiry: input.subscriptionExpiry ? new Date(input.subscriptionExpiry) : null,
      }).returning();

      // إنشاء مدير المؤسسة
      const passwordHash = await hashPassword(input.adminPassword);
      await db.insert(users).values({
        orgId: org.id,
        username: input.adminUsername,
        passwordHash,
        name: input.adminName,
        role: 'admin',
        isActive: true,
      });

      return org;
    }),

  // تعديل مؤسسة
  update: superAdminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      address: z.string().optional(),
      status: z.enum(['active', 'suspended', 'trial', 'expired']).optional(),
      maxUsers: z.number().optional(),
      subscriptionExpiry: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, subscriptionExpiry, ...rest } = input;
      await db.update(organizations).set({
        ...rest,
        ...(subscriptionExpiry ? { subscriptionExpiry: new Date(subscriptionExpiry) } : {}),
        updatedAt: new Date(),
      }).where(eq(organizations.id, id));
      return { success: true };
    }),

  // معلومات مؤسستي
  myOrg: protectedProcedure.query(async ({ ctx }) => {
    return db.query.organizations.findFirst({
      where: eq(organizations.id, ctx.user.orgId),
    });
  }),
});
