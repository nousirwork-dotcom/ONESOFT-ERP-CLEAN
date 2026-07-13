import { z } from 'zod';
import { router, ownerOnlyProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { db } from '../db.js';
import { eq, desc } from 'drizzle-orm';
import {
  lcClients, lcLicenses, lcDevices, lcOperationsLog,
} from '../schema.js';

// ─── Module Catalog (not hardcoded in UI) ─────────────────────────────────────
export const MODULE_CATALOG = [
  { id: 'sales',         name: 'المبيعات',           group: 'core' },
  { id: 'purchases',     name: 'المشتريات',          group: 'core' },
  { id: 'inventory',     name: 'المخزون',            group: 'core' },
  { id: 'accounting',    name: 'الحسابات',           group: 'core' },
  { id: 'pos',           name: 'نقاط البيع',         group: 'core' },
  { id: 'reports',       name: 'التقارير',           group: 'core' },
  { id: 'zatca',         name: 'ربط هيئة الزكاة',    group: 'integration' },
  { id: 'hr',            name: 'الموارد البشرية',    group: 'hr' },
  { id: 'payroll',       name: 'الرواتب',            group: 'hr' },
  { id: 'assets',        name: 'الأصول الثابتة',     group: 'advanced' },
  { id: 'manufacturing', name: 'التصنيع',            group: 'advanced' },
  { id: 'branches',      name: 'الفروع',             group: 'advanced' },
  { id: 'sync',          name: 'المزامنة',           group: 'connectivity' },
  { id: 'offline',       name: 'التشغيل أوفلاين',   group: 'connectivity' },
  { id: 'api',           name: 'API',                group: 'connectivity' },
  { id: 'ecommerce',     name: 'المتجر الإلكتروني',  group: 'advanced' },
  { id: 'AI_ASSISTANT',  name: 'المساعد الذكي',      group: 'advanced' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function genLicenseId() {
  const ts  = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `LIC-${ts}-${rnd}`;
}
function genOrgId() {
  const yr  = new Date().getFullYear();
  const rnd = String(Math.floor(Math.random() * 900000 + 100000)).padStart(6, '0');
  return `ORG-${yr}-${rnd}`;
}
function genWebToken() {
  return Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join('');
}
function genActivationCode() {
  const seg = () => Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${seg()}-${seg()}-${seg()}-${seg()}`;
}

type OpType =
  | 'create_client' | 'create_license' | 'activate' | 'suspend'
  | 'resume' | 'renew' | 'revoke_device' | 'generate_key' | 'generate_activation_code'
  | 'update_client' | 'update_license' | 'export_license' | 'generate_web_setup';

async function logOp(
  clientId: number | null,
  licenseId: number | null,
  operationType: OpType,
  description: string,
  performedBy = 'admin',
) {
  await db.insert(lcOperationsLog).values({ clientId, licenseId, operationType, description, performedBy });
}

// ─── Shared input schemas ─────────────────────────────────────────────────────
const clientFields = z.object({
  name:          z.string().min(2),
  tradeName:     z.string().optional(),
  commercialReg: z.string().optional(),
  taxNumber:     z.string().optional(),
  country:       z.string().optional(),
  city:          z.string().optional(),
  phone:         z.string().optional(),
  email:         z.string().email().optional().or(z.literal('')),
  activityType:  z.string().optional(),
  contactName:   z.string().optional(),
  contactPhone:  z.string().optional(),
  contactEmail:  z.string().email().optional().or(z.literal('')),
  runType:       z.enum(['desktop', 'web', 'hybrid']).default('desktop'),
  notes:         z.string().optional(),
});

const licenseFields = z.object({
  packageName:    z.string().optional(),
  licenseType:    z.enum(['trial', 'subscription', 'lifetime']).default('subscription'),
  startDate:      z.string(),
  expiryDate:     z.string(),
  maxUsers:       z.number().int().min(1).default(5),
  maxBranches:    z.number().int().min(1).default(1),
  maxPos:         z.number().int().min(0).default(1),
  maxDevices:     z.number().int().min(1).default(3),
  maxWeb:         z.number().int().min(0).default(0),
  webAllowed:     z.boolean().default(false),
  desktopAllowed: z.boolean().default(true),
  offlineAllowed: z.boolean().default(false),
  syncAllowed:    z.boolean().default(false),
  enabledModules: z.array(z.string()).default([]),
  notes:          z.string().optional(),
});

export const licenseCenterRouter = router({

  // ── Module catalog (dynamic, not hardcoded in UI) ──────────────────────────
  listModuleCatalog: ownerOnlyProcedure.query(() => MODULE_CATALOG),

  // ── Clients ────────────────────────────────────────────────────────────────
  listClients: ownerOnlyProcedure.query(async () => {
    return db.select().from(lcClients).where(eq(lcClients.isActive, true)).orderBy(desc(lcClients.createdAt));
  }),

  listClientsDetailed: ownerOnlyProcedure.query(async () => {
    const clients  = await db.select().from(lcClients).where(eq(lcClients.isActive, true)).orderBy(desc(lcClients.createdAt));
    const licenses = await db.select().from(lcLicenses).orderBy(desc(lcLicenses.createdAt));

    return clients.map(c => {
      const clientLicenses = licenses.filter(l => l.clientId === c.id);
      const primaryLic = clientLicenses.find(l => l.status === 'active') ?? clientLicenses[0] ?? null;
      return { ...c, license: primaryLic };
    });
  }),

  getClient: ownerOnlyProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const [c] = await db.select().from(lcClients).where(eq(lcClients.id, input.id));
      if (!c) throw new TRPCError({ code: 'NOT_FOUND', message: 'العميل غير موجود' });
      return c;
    }),

  createClient: ownerOnlyProcedure
    .input(clientFields)
    .mutation(async ({ input }) => {
      const orgId = genOrgId();
      const cleanEmail = input.email || undefined;
      const cleanContactEmail = input.contactEmail || undefined;
      const [c] = await db.insert(lcClients).values({ ...input, email: cleanEmail, contactEmail: cleanContactEmail, orgId }).returning();
      await logOp(c.id, null, 'create_client', `إنشاء عميل جديد: ${c.name}`);
      return c;
    }),

  createClientWithLicense: ownerOnlyProcedure
    .input(clientFields.merge(licenseFields))
    .mutation(async ({ input }) => {
      const orgId = genOrgId();
      const { packageName, licenseType, startDate, expiryDate, maxUsers, maxBranches,
              maxPos, maxDevices, maxWeb, webAllowed, desktopAllowed, offlineAllowed,
              syncAllowed, enabledModules, notes: licNotes, ...clientData } = input;
      const cleanEmail = clientData.email || undefined;
      const cleanContactEmail = clientData.contactEmail || undefined;

      const [c] = await db.insert(lcClients).values({
        ...clientData,
        email: cleanEmail,
        contactEmail: cleanContactEmail,
        orgId,
      }).returning();

      const licenseId = genLicenseId();
      const [lic] = await db.insert(lcLicenses).values({
        licenseId, clientId: c.id, packageName, licenseType, status: 'active',
        startDate, expiryDate, maxUsers, maxBranches, maxPos, maxDevices, maxWeb,
        webAllowed, desktopAllowed, offlineAllowed, syncAllowed, enabledModules,
        notes: licNotes, issuedBy: 'OneSoft ERP',
      }).returning();

      await logOp(c.id, lic.id, 'create_client', `إنشاء عميل جديد: ${c.name} (${orgId})`);
      await logOp(c.id, lic.id, 'create_license', `إصدار ترخيص: ${licenseId} — ${licenseType}`);

      return { client: c, license: lic };
    }),

  updateClient: ownerOnlyProcedure
    .input(clientFields.partial().extend({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const cleanEmail = data.email === '' ? null : data.email;
      const cleanContactEmail = data.contactEmail === '' ? null : data.contactEmail;
      const [c] = await db.update(lcClients)
        .set({ ...data, email: cleanEmail ?? undefined, contactEmail: cleanContactEmail ?? undefined, updatedAt: new Date() })
        .where(eq(lcClients.id, id))
        .returning();
      await logOp(c.id, null, 'update_client', `تعديل بيانات العميل: ${c.name}`);
      return c;
    }),

  generateWebSetupToken: ownerOnlyProcedure
    .input(z.object({ clientId: z.number() }))
    .mutation(async ({ input }) => {
      const token = genWebToken();
      const [c] = await db.update(lcClients)
        .set({ webSetupToken: token, webSetupTokenUsed: false, updatedAt: new Date() })
        .where(eq(lcClients.id, input.clientId))
        .returning();
      await logOp(c.id, null, 'generate_web_setup', `إنشاء رابط Web Setup للعميل: ${c.name}`);
      const url = `https://app.onesoft.sa/setup/${c.orgId}/${token}`;
      return { token, url, orgId: c.orgId };
    }),

  generateActivationCode: ownerOnlyProcedure
    .input(z.object({ licenseId: z.number() }))
    .mutation(async ({ input }) => {
      const [lic] = await db.select().from(lcLicenses).where(eq(lcLicenses.id, input.licenseId));
      if (!lic) throw new TRPCError({ code: 'NOT_FOUND', message: 'الترخيص غير موجود' });
      const code = genActivationCode();
      await logOp(lic.clientId, lic.id, 'generate_activation_code', `إصدار Activation Code للترخيص: ${lic.licenseId}`);
      return { code, licenseId: lic.licenseId };
    }),

  // ── Licenses ───────────────────────────────────────────────────────────────
  listLicensesByClient: ownerOnlyProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      return db.select().from(lcLicenses)
        .where(eq(lcLicenses.clientId, input.clientId))
        .orderBy(desc(lcLicenses.createdAt));
    }),

  getLicenseWithClient: ownerOnlyProcedure
    .input(z.object({ licenseId: z.number() }))
    .query(async ({ input }) => {
      const [lic] = await db.select().from(lcLicenses).where(eq(lcLicenses.id, input.licenseId));
      if (!lic) throw new TRPCError({ code: 'NOT_FOUND', message: 'الترخيص غير موجود' });
      const [client] = await db.select().from(lcClients).where(eq(lcClients.id, lic.clientId));
      const devices = await db.select().from(lcDevices).where(eq(lcDevices.licenseId, lic.id)).orderBy(desc(lcDevices.lastActivatedAt));
      return { license: lic, client, devices };
    }),

  createLicense: ownerOnlyProcedure
    .input(licenseFields.extend({ clientId: z.number() }))
    .mutation(async ({ input }) => {
      const licenseId = genLicenseId();
      const [lic] = await db.insert(lcLicenses).values({ ...input, licenseId }).returning();
      await logOp(input.clientId, lic.id, 'create_license', `إنشاء ترخيص جديد: ${licenseId}`);
      return lic;
    }),

  updateLicense: ownerOnlyProcedure
    .input(licenseFields.partial().extend({ licenseId: z.number() }))
    .mutation(async ({ input }) => {
      const { licenseId, ...data } = input;
      const [lic] = await db.update(lcLicenses)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(lcLicenses.id, licenseId))
        .returning();
      await logOp(lic.clientId, lic.id, 'update_license', `تعديل الترخيص: ${lic.licenseId}`);
      return lic;
    }),

  suspendLicense: ownerOnlyProcedure
    .input(z.object({ licenseId: z.number() }))
    .mutation(async ({ input }) => {
      const [lic] = await db.update(lcLicenses)
        .set({ status: 'suspended', updatedAt: new Date() })
        .where(eq(lcLicenses.id, input.licenseId))
        .returning();
      await logOp(lic.clientId, lic.id, 'suspend', `إيقاف الترخيص: ${lic.licenseId}`);
      return lic;
    }),

  resumeLicense: ownerOnlyProcedure
    .input(z.object({ licenseId: z.number() }))
    .mutation(async ({ input }) => {
      const [lic] = await db.update(lcLicenses)
        .set({ status: 'active', updatedAt: new Date() })
        .where(eq(lcLicenses.id, input.licenseId))
        .returning();
      await logOp(lic.clientId, lic.id, 'resume', `إعادة تفعيل الترخيص: ${lic.licenseId}`);
      return lic;
    }),

  renewLicense: ownerOnlyProcedure
    .input(z.object({ licenseId: z.number(), newExpiryDate: z.string() }))
    .mutation(async ({ input }) => {
      const [lic] = await db.update(lcLicenses)
        .set({ expiryDate: input.newExpiryDate, status: 'active', updatedAt: new Date() })
        .where(eq(lcLicenses.id, input.licenseId))
        .returning();
      await logOp(lic.clientId, lic.id, 'renew', `تجديد الترخيص حتى: ${input.newExpiryDate}`);
      return lic;
    }),

  // ── Devices ────────────────────────────────────────────────────────────────
  listDevices: ownerOnlyProcedure
    .input(z.object({ licenseId: z.number() }))
    .query(async ({ input }) => {
      return db.select().from(lcDevices)
        .where(eq(lcDevices.licenseId, input.licenseId))
        .orderBy(desc(lcDevices.lastActivatedAt));
    }),

  addDevice: ownerOnlyProcedure
    .input(z.object({
      licenseId:     z.number(),
      deviceName:    z.string().min(1),
      deviceId:      z.string().min(1),
      hwFingerprint: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const [dev] = await db.insert(lcDevices)
        .values({ ...input, lastActivatedAt: new Date() })
        .returning();
      return dev;
    }),

  revokeDevice: ownerOnlyProcedure
    .input(z.object({ deviceId: z.number() }))
    .mutation(async ({ input }) => {
      const [dev] = await db.update(lcDevices)
        .set({ status: 'revoked' })
        .where(eq(lcDevices.id, input.deviceId))
        .returning();
      await logOp(null, dev.licenseId, 'revoke_device', `إلغاء الجهاز: ${dev.deviceName}`);
      return dev;
    }),

  // ── Operations Log ─────────────────────────────────────────────────────────
  listOperationsLog: ownerOnlyProcedure
    .input(z.object({ clientId: z.number().optional(), limit: z.number().default(20) }))
    .query(async ({ input }) => {
      const q = db.select().from(lcOperationsLog);
      if (input.clientId) {
        return q.where(eq(lcOperationsLog.clientId, input.clientId)).orderBy(desc(lcOperationsLog.createdAt)).limit(input.limit);
      }
      return q.orderBy(desc(lcOperationsLog.createdAt)).limit(input.limit);
    }),

  // ── Dashboard summary ──────────────────────────────────────────────────────
  getDashboardSummary: ownerOnlyProcedure.query(async () => {
    const clients  = await db.select().from(lcClients).where(eq(lcClients.isActive, true));
    const licenses = await db.select().from(lcLicenses);
    const devices  = await db.select().from(lcDevices).where(eq(lcDevices.status, 'active'));
    const active   = licenses.filter(l => l.status === 'active').length;
    const expiring = licenses.filter(l => {
      if (l.status !== 'active') return false;
      const days = Math.ceil((new Date(l.expiryDate + 'T23:59:59Z').getTime() - Date.now()) / 86_400_000);
      return days <= 30 && days > 0;
    }).length;
    return { totalClients: clients.length, totalLicenses: licenses.length, activeLicenses: active, expiringLicenses: expiring, activeDevices: devices.length };
  }),

  // ── Seed demo data — development only ────────────────────────────────────
  seedDemo: ownerOnlyProcedure.mutation(async () => {
    if (process.env.NODE_ENV === 'production') {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'seedDemo غير متاح في بيئة الإنتاج' });
    }
    const existing = await db.select().from(lcClients);
    if (existing.length > 0) return { seeded: false, message: 'البيانات التجريبية موجودة مسبقاً' };

    const [c] = await db.insert(lcClients).values({
      name: 'شركة النور التجارية', tradeName: 'النور', orgId: 'ORG-2024-000125',
      commercialReg: '1010456789', taxNumber: '300123456700003',
      phone: '0501234567', email: 'info@alnoor.sa',
      country: 'السعودية', city: 'الرياض', activityType: 'تجارة عامة',
      contactName: 'محمد العبدالله', contactPhone: '0551234567',
      runType: 'desktop',
    }).returning();

    const [lic] = await db.insert(lcLicenses).values({
      licenseId: 'LIC-2024-ALNOOR-001', clientId: c.id,
      packageName: 'باقة احترافية', licenseType: 'subscription', status: 'active',
      maxUsers: 10, maxBranches: 5, maxPos: 5, maxDevices: 10, maxWeb: 2,
      enabledModules: ['sales', 'purchases', 'inventory', 'accounting', 'reports', 'zatca'],
      webAllowed: true, desktopAllowed: true, offlineAllowed: true, syncAllowed: false,
      startDate: '2024-01-01', expiryDate: '2025-12-31', issuedBy: 'OneSoft ERP',
    }).returning();

    const devicesSeed = [
      { deviceName: 'DESKTOP-1A2B3C', deviceId: 'b1f8c2e4-7a21-4d91-9f65-8a2c1e5b7d11', status: 'active' as const, lastActivatedAt: new Date('2025-07-06T10:32:00') },
      { deviceName: 'SERVER-MAIN',     deviceId: 'd3a7e5f1-2b43-4c90-a7ef-34d2f8c6ae22', status: 'active' as const, lastActivatedAt: new Date('2025-07-06T08:15:00') },
      { deviceName: 'LAPTOP-OFFICE',   deviceId: 'a9d3b7c5-6e21-4f8c-9b32-0d6a7c3e5f99', status: 'active' as const, lastActivatedAt: new Date('2025-07-05T14:05:00') },
      { deviceName: 'POS-001',         deviceId: 'f7c6a2b7-9d33-4e6a-b2f1-6c8df9c0fa44', status: 'active' as const, lastActivatedAt: new Date('2025-07-05T09:10:00') },
      { deviceName: 'STORE-PC-02',     deviceId: 'e4b1f9c8-3a22-4b6d-8f51-2c1e7d3b9a66', status: 'inactive' as const, lastActivatedAt: new Date('2025-07-04T17:50:00') },
    ];
    await db.insert(lcDevices).values(devicesSeed.map(d => ({ ...d, licenseId: lic.id })));

    const opsSeed = [
      { operationType: 'renew'   as const, description: 'تجديد الترخيص', createdAt: new Date('2025-07-06T10:35:00') },
      { operationType: 'suspend' as const, description: 'تم إيقاف الترخيص', createdAt: new Date('2025-07-05T15:22:00') },
      { operationType: 'generate_activation_code' as const, description: 'إصدار Activation Code', createdAt: new Date('2025-07-05T09:15:00') },
      { operationType: 'create_client' as const, description: 'إنشاء العميل', createdAt: new Date('2025-07-04T11:08:00') },
      { operationType: 'resume' as const, description: 'إعادة تفعيل الترخيص', createdAt: new Date('2025-07-03T16:40:00') },
    ];
    for (const op of opsSeed) {
      await db.insert(lcOperationsLog).values({ clientId: c.id, licenseId: lic.id, performedBy: 'admin', ...op });
    }
    return { seeded: true, clientId: c.id, licenseId: lic.id };
  }),
});
