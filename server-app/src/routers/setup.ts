/**
 * setup.ts — API الإعداد الأول والمعلومات
 * يُستخدم من معالج الإعداد الأول + شاشة معلومات النظام
 */
import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc.js';
import { db } from '../db.js';
import { organizations, users, appSettings } from '../schema.js';
import { hashPassword } from '../auth.js';
import { logger } from '../logger.js';
import { ENV } from '../env.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { eq, sql } from 'drizzle-orm';
import process from 'process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', '..');

// ── الإصدار من package.json ───────────────────────────────────────────────────
function getAppVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf-8'));
    return pkg.version ?? '1.0.0';
  } catch { return '1.0.0'; }
}

// ── إصدار PostgreSQL ──────────────────────────────────────────────────────────
async function getPgVersion(): Promise<string> {
  try {
    const result = await db.execute<{ version: string }>(`SELECT version() as version`);
    const row = (result as any).rows?.[0] ?? (result as any)[0];
    const v = row?.version ?? '';
    const m = v.match(/PostgreSQL\s+([\d.]+)/);
    return m ? m[1] : v.split(' ')[1] ?? 'unknown';
  } catch { return 'unknown'; }
}

// ── حالة النسخ الاحتياطي ─────────────────────────────────────────────────────
function getLastBackupInfo(): { date: string | null; count: number } {
  const dir = process.env.BACKUP_DIR || path.join(ROOT, 'backups');
  if (!fs.existsSync(dir)) return { date: null, count: 0 };
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql') || f.endsWith('.dump'));
  if (!files.length) return { date: null, count: 0 };
  const last = files.map(f => fs.statSync(path.join(dir, f)).mtime).sort((a, b) => b.getTime() - a.getTime())[0];
  return { date: last?.toISOString() ?? null, count: files.length };
}

// ══════════════════════════════════════════════════════════════════════════════
export const setupRouter = router({

  // ── هل أول تشغيل؟ ────────────────────────────────────────────────────────
  // dbError: true  → الخادم لم يستطع الاتصال بقاعدة البيانات (خطأ شبكة/باسورد)
  // firstRun: true → الاتصال نجح لكن لا توجد مؤسسات → يجب إعداد النظام أول مرة
  // firstRun: false → النظام جاهز → انتقل لصفحة تسجيل الدخول
  isFirstRun: publicProcedure.query(async () => {
    try {
      const result = await db.select({ cnt: sql<number>`count(*)::int` }).from(organizations);
      return { firstRun: (result[0]?.cnt ?? 0) === 0, dbError: false };
    } catch {
      // خطأ في الاتصال بقاعدة البيانات — لا يعني بالضرورة "أول تشغيل"
      return { firstRun: false, dbError: true };
    }
  }),

  // ── معلومات النظام الكاملة ────────────────────────────────────────────────
  systemInfo: protectedProcedure.query(async ({ ctx }) => {
    const [pgVersion, backupInfo] = await Promise.all([
      getPgVersion(),
      Promise.resolve(getLastBackupInfo()),
    ]);

    let schemaVersion = 'unknown';
    try {
      const { REQUIRED_SCHEMA_VERSION } = await import('../schema-version.js');
      schemaVersion = REQUIRED_SCHEMA_VERSION;
    } catch {}

    let electronVersion = 'N/A';
    try { electronVersion = process.versions.electron ?? 'N/A'; } catch {}

    return {
      app: {
        name:        'OneSoft ERP',
        version:     getAppVersion(),
        buildDate:   '2026-06-29',
        buildNumber: '888aa8f',
        schemaVersion,
        environment: ENV.nodeEnv,
        isElectron:  ENV.isElectron,
        port:        ENV.port,
      },
      runtime: {
        nodeVersion:     process.version,
        electronVersion,
        platform:        process.platform,
        arch:            process.arch,
        uptime:          Math.round(process.uptime()),
      },
      database: {
        type:     ENV.dbType,
        version:  pgVersion,
        host:     new URL(ENV.dbUrl.replace(/^[^:]+:\/\//, 'pg://')).hostname || 'localhost',
        status:   'connected',
      },
      backup: {
        lastDate:     backupInfo.date,
        count:        backupInfo.count,
        directory:    process.env.BACKUP_DIR || path.join(ROOT, 'backups'),
      },
      license: {
        status:  'active',
        type:    'standard',
        expires: null,
      },
    };
  }),

  // ── إعداد أول تشغيل ──────────────────────────────────────────────────────
  firstRun: publicProcedure
    .input(z.object({
      company: z.object({
        name:       z.string().min(2),
        nameEn:     z.string().optional(),
        taxNumber:  z.string().optional(),
        phone:      z.string().optional(),
        email:      z.string().email().optional(),
        address:    z.string().optional(),
        country:    z.string().default('SA'),
        currency:   z.string().default('SAR'),
        fiscalYear: z.number().default(new Date().getFullYear()),
        language:   z.enum(['ar','en']).default('ar'),
      }),
      admin: z.object({
        username:  z.string().min(3),
        password:  z.string().min(6),
        name:      z.string().min(2),
        email:     z.string().email().optional(),
      }),
      backup: z.object({
        enabled:    z.boolean().default(true),
        directory:  z.string().optional(),
      }).optional(),
      zatca: z.object({
        setupNow: z.boolean().default(false),
      }).optional(),
    }))
    .mutation(async ({ input }) => {
      const orgCount = await db.select({ cnt: sql<number>`count(*)::int` }).from(organizations);
      const alreadySetup = (orgCount[0]?.cnt ?? 0) > 0;
      if (alreadySetup) throw new Error('البرنامج تم إعداده مسبقاً');

      logger.info('setup', 'first-run wizard started');

      // إنشاء المؤسسة
      const [org] = await db.insert(organizations).values({
        name:     input.company.name,
        nameEn:   input.company.nameEn ?? '',
        taxNumber:input.company.taxNumber ?? '',
        phone:    input.company.phone ?? '',
        email:    input.company.email ?? '',
        address:  input.company.address ?? '',
        currency: input.company.currency,
        status:   'active',
        maxUsers: 10,
      }).returning();

      // إنشاء مستخدم المدير
      const hashedPass = await hashPassword(input.admin.password);
      await db.insert(users).values({
        orgId:        org.id,
        username:     input.admin.username,
        passwordHash: hashedPass,
        name:         input.admin.name,
        email:        input.admin.email ?? '',
        role:         'admin',
        status:       'active',
      });

      // حفظ إعدادات التطبيق
      await db.insert(appSettings).values({
        orgId:    org.id,
        key:      'company_setup_complete',
        value:    'true',
      }).onConflictDoNothing();

      await db.insert(appSettings).values({
        orgId: org.id,
        key:   'fiscal_year',
        value: String(input.company.fiscalYear),
      }).onConflictDoNothing();

      await db.insert(appSettings).values({
        orgId: org.id,
        key:   'language',
        value: input.company.language,
      }).onConflictDoNothing();

      logger.info('setup', `first-run complete: org=${org.id} (${org.name})`);

      return {
        ok:    true,
        orgId: org.id,
        setupZatca: input.zatca?.setupNow ?? false,
      };
    }),

  // ── تحديث الإعدادات من داخل البرنامج ────────────────────────────────────
  updateCompanyInfo: protectedProcedure
    .input(z.object({
      name:      z.string().min(2).optional(),
      nameEn:    z.string().optional(),
      taxNumber: z.string().optional(),
      phone:     z.string().optional(),
      email:     z.string().email().optional(),
      address:   z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin') throw new Error('غير مصرح');
      await db.update(organizations)
        .set({ ...input })
        .where(eq(organizations.id, ctx.user.orgId!));
      return { ok: true };
    }),
});
