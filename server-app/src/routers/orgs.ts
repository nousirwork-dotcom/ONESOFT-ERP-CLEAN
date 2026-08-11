import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, superAdminProcedure, protectedProcedure, adminProcedure } from '../trpc.js';
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
        email:         organizations.email,
        address:       organizations.address,
        taxNumber:     organizations.taxNumber,
        commercialReg: organizations.commercialReg,
        currency:      organizations.currency,
        zatcaConfig:   organizations.zatcaConfig,
      })
      .from(organizations)
      .where(eq(organizations.id, ctx.user.orgId));
    if (!org) return null;
    const cfg = (org.zatcaConfig ?? {}) as Record<string, unknown>;
    const safeZatcaConfig = {
      legalName: org.name ?? cfg.legalName ?? cfg.businessName ?? '',
      englishName: cfg.englishName ?? cfg.businessNameEn ?? org.nameEn ?? '',
      vatNumber: org.taxNumber ?? cfg.vatNumber ?? '',
      commercialReg: cfg.commercialReg ?? cfg.crNumber ?? org.commercialReg ?? '',
      activity: cfg.activity ?? cfg.businessCategory ?? '',
      country: cfg.country ?? cfg.countryName ?? '',
      city: cfg.city ?? '',
      district: cfg.district ?? '',
      street: cfg.street ?? cfg.streetName ?? '',
      buildingNumber: cfg.buildingNumber ?? '',
      postalCode: cfg.postalCode ?? '',
      additionalNumber: cfg.additionalNumber ?? '',
      phone: cfg.phone ?? org.phone ?? '',
      email: cfg.email ?? org.email ?? '',
    };
    return {
      ...org,
      legalName: safeZatcaConfig.legalName,
      englishName: safeZatcaConfig.englishName,
      vatNumber: safeZatcaConfig.vatNumber,
      commercialReg: safeZatcaConfig.commercialReg,
      activity: safeZatcaConfig.activity,
      country: safeZatcaConfig.country,
      city: safeZatcaConfig.city,
      district: safeZatcaConfig.district,
      street: safeZatcaConfig.street,
      buildingNumber: safeZatcaConfig.buildingNumber,
      postalCode: safeZatcaConfig.postalCode,
      additionalNumber: safeZatcaConfig.additionalNumber,
      phone: safeZatcaConfig.phone,
      email: safeZatcaConfig.email,
      zatcaConfig: safeZatcaConfig,
    };
  }),

  // معلومات الشركة الحالية — تُحفظ في organizations وzatca_config داخل PostgreSQL.
  updateCurrent: adminProcedure
    .input(z.object({
      legalName:       z.string().max(255).default(''),
      englishName:     z.string().max(255).default(''),
      vatNumber:       z.string().max(50).default(''),
      commercialReg:   z.string().max(50).default(''),
      activity:        z.string().max(255).default(''),
      country:         z.string().max(100).default(''),
      city:            z.string().max(100).default(''),
      district:        z.string().max(100).default(''),
      street:          z.string().max(255).default(''),
      buildingNumber:  z.string().max(20).default(''),
      postalCode:      z.string().max(20).default(''),
      additionalNumber:z.string().max(20).default(''),
      address:         z.string().max(1000).default(''),
      phone:           z.string().max(50).default(''),
      email:           z.string().max(255).default(''),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.query.organizations.findFirst({
        where: eq(organizations.id, ctx.user.orgId),
        columns: { zatcaConfig: true },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'المنشأة غير موجودة' });

      const currentConfig = (existing.zatcaConfig ?? {}) as Record<string, unknown>;
      const {
        businessName: _legacyBusinessName,
        businessNameEn: _legacyBusinessNameEn,
        crNumber: _legacyCrNumber,
        businessCategory: _legacyBusinessCategory,
        countryName: _legacyCountryName,
        streetName: _legacyStreetName,
        ...restConfig
      } = currentConfig;
      const nextConfig = {
        ...restConfig,
        legalName: input.legalName,
        englishName: input.englishName,
        vatNumber: input.vatNumber,
        commercialReg: input.commercialReg,
        activity: input.activity,
        country: input.country,
        city: input.city,
        district: input.district,
        street: input.street,
        buildingNumber: input.buildingNumber,
        postalCode: input.postalCode,
        additionalNumber: input.additionalNumber,
        phone: input.phone,
        email: input.email,
      };

      await db.update(organizations).set({
        name: input.legalName,
        nameEn: input.englishName || null,
        taxNumber: input.vatNumber || null,
        commercialReg: input.commercialReg || null,
        address: input.address || null,
        phone: input.phone || null,
        email: input.email || null,
        zatcaConfig: nextConfig,
        updatedAt: new Date(),
      }).where(eq(organizations.id, ctx.user.orgId));

      return { ok: true };
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
