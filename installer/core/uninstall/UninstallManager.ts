import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { ProgressEvent, DatabaseConnectionOptions } from '../types.js';
import { ServiceManager } from '../services/ServiceManager.js';

type Emit = (e: ProgressEvent) => void;

export interface UninstallOptions {
  installDir: string;
  dataDir: string;
  dbOpts: DatabaseConnectionOptions;
  deleteDatabase: boolean;
  deleteData: boolean;
}

export class UninstallManager {

  async uninstall(opts: UninstallOptions, emit: Emit): Promise<void> {
    const { installDir, dataDir, dbOpts, deleteDatabase, deleteData } = opts;
    emit({ level: 'info', message: '🗑️ بدء إلغاء التثبيت...', timestamp: now() });
    if (!deleteDatabase) {
      emit({ level: 'info', message: 'الوضع: إزالة البرنامج مع الاحتفاظ بقاعدة البيانات', timestamp: now() });
    } else {
      emit({ level: 'warning', message: 'الوضع: إزالة كل شيء نهائياً — بما فيها قاعدة البيانات', timestamp: now() });
    }

    // 1. إنهاء عمليات OneSoft قيد التشغيل (حتى لا تمنع حذف الملفات)
    emit({ level: 'info', message: 'جارٍ إنهاء عمليات OneSoft قيد التشغيل...', timestamp: now() });
    this._killProcesses(emit);

    // 2. إيقاف وإزالة الخدمات
    emit({ level: 'info', message: 'جارٍ إيقاف وإزالة الخدمات...', timestamp: now() });
    const svcMgr = new ServiceManager();
    const services = ['OneSoft-Client', 'OneSoft-Updater', 'OneSoft-Server'] as const;
    for (const svc of services) {
      try {
        svcMgr.stop(svc);
        await sleep(1000);
        svcMgr.remove(svc);
        emit({ level: 'success', message: `تمت إزالة خدمة ${svc}`, timestamp: now() });
      } catch {
        emit({ level: 'warning', message: `لم تُوجد خدمة ${svc} أو تمت إزالتها مسبقاً`, timestamp: now() });
      }
    }

    // 3. حذف المهام المجدولة (Scheduled Tasks)
    emit({ level: 'info', message: 'جارٍ حذف المهام المجدولة...', timestamp: now() });
    this._removeScheduledTasks(emit);

    // 4. حذف قواعد جدار الحماية (Firewall Rules)
    emit({ level: 'info', message: 'جارٍ حذف قواعد جدار الحماية...', timestamp: now() });
    this._removeFirewallRules(emit);

    // 5. حذف الاختصارات
    emit({ level: 'info', message: 'جارٍ حذف الاختصارات...', timestamp: now() });
    await this._removeShortcuts(emit);

    // 6. حذف قاعدة البيانات (فقط في وضع الإزالة الكاملة)
    if (deleteDatabase) {
      emit({ level: 'info', message: 'جارٍ حذف قاعدة البيانات...', timestamp: now() });
      await this._dropDatabase(dbOpts, emit);
    } else {
      emit({ level: 'success', message: '✅ تم الاحتفاظ بقاعدة البيانات ومستخدم التطبيق', timestamp: now() });
    }

    // 7. حذف ملفات البرنامج
    emit({ level: 'info', message: 'جارٍ حذف ملفات البرنامج...', timestamp: now() });
    this._removeDir(installDir, emit);

    // 8. تنظيف بيانات المستخدم
    if (deleteData) {
      // إزالة كاملة — كامل مجلد البيانات بما فيه النسخ الاحتياطية
      emit({ level: 'info', message: 'جارٍ حذف كامل مجلد البيانات (بما فيه النسخ الاحتياطية)...', timestamp: now() });
      this._removeDir(dataDir, emit);
    } else {
      // الوضع الافتراضي — احذف فقط الملفات المؤقتة والإعداد والسجلات، مع الحفاظ
      // على النسخ الاحتياطية والمرفقات والبيانات
      emit({ level: 'info', message: 'جارٍ تنظيف ملفات الإعداد والذاكرة المؤقتة والسجلات...', timestamp: now() });
      this._cleanupTransient(dataDir, emit);
      emit({ level: 'success', message: `✅ تم الاحتفاظ بالنسخ الاحتياطية والمرفقات والبيانات في: ${dataDir}`, timestamp: now() });
    }

    // 9. حذف مدخل التسجيل (Registry)
    await this._removeRegistryEntry(emit);

    emit({ level: 'success', message: '✅ تم إلغاء التثبيت بالكامل', timestamp: now() });
  }

  /**
   * إنهاء أي عمليات OneSoft قيد التشغيل حتى لا تحجز الملفات أثناء الحذف.
   * لا نمس عمليات PostgreSQL — قاعدة البيانات تُدار بشكل منفصل.
   */
  private _killProcesses(emit: Emit): void {
    if (process.platform !== 'win32') return;
    const images = [
      'OneSoft ERP.exe',
      'OneSoft-Server.exe',
      'OneSoft-Updater.exe',
      'OneSoftERP.exe',
    ];
    for (const img of images) {
      try {
        execSync(`taskkill /F /T /IM "${img}"`, { stdio: 'pipe', timeout: 15_000 });
        emit({ level: 'info', message: `✓ أُنهيت العملية: ${img}`, timestamp: now() });
      } catch {
        // العملية غير قيد التشغيل — طبيعي
      }
    }
  }

  /**
   * حذف كل المهام المجدولة التابعة لـ OneSoft (النسخ الاحتياطي، التحديث... إلخ).
   */
  private _removeScheduledTasks(emit: Emit): void {
    if (process.platform !== 'win32') return;
    let taskNames: string[] = [];
    try {
      const out = execSync('schtasks /Query /FO LIST', { stdio: 'pipe', timeout: 20_000 }).toString();
      taskNames = out
        .split(/\r?\n/)
        .filter(l => /^TaskName:/i.test(l.trim()))
        .map(l => l.replace(/^TaskName:\s*/i, '').trim())
        .filter(n => /onesoft/i.test(n));
    } catch {
      taskNames = [];
    }
    // أسماء احتياطية معروفة إن فشل الاستعلام
    const fallback = ['\\OneSoft Backup', '\\OneSoft-Backup', '\\OneSoft Update', '\\OneSoft-Updater'];
    const all = Array.from(new Set([...taskNames, ...fallback]));
    for (const name of all) {
      try {
        execSync(`schtasks /Delete /TN "${name}" /F`, { stdio: 'pipe', timeout: 15_000 });
        emit({ level: 'info', message: `✓ حُذفت المهمة المجدولة: ${name}`, timestamp: now() });
      } catch {
        // غير موجودة — طبيعي
      }
    }
  }

  /**
   * حذف قواعد جدار الحماية التي أضافها المُثبِّت.
   */
  private _removeFirewallRules(emit: Emit): void {
    if (process.platform !== 'win32') return;
    const ruleNames = [
      'OneSoft ERP',
      'OneSoft Server',
      'OneSoft Backend',
      'OneSoft Client',
      'OneSoft-Server',
      'OneSoft-Client',
      'OneSoft ERP Backend',
      'OneSoft ERP Server',
    ];
    for (const rule of ruleNames) {
      try {
        execSync(`netsh advfirewall firewall delete rule name="${rule}"`, { stdio: 'pipe', timeout: 15_000 });
        emit({ level: 'info', message: `✓ حُذفت قاعدة جدار الحماية: ${rule}`, timestamp: now() });
      } catch {
        // غير موجودة — طبيعي
      }
    }
  }

  /**
   * تنظيف الملفات المؤقتة والإعداد والسجلات فقط — مع الحفاظ التام على
   * النسخ الاحتياطية والمرفقات والبيانات.
   */
  private _cleanupTransient(dataDir: string, emit: Emit): void {
    // مجلدات عابرة يجب حذفها
    const transientDirs = ['config', 'Temp', 'temp', 'Updates', 'Logs', 'logs', 'Cache', 'cache'];
    // مجلدات يجب الحفاظ عليها (للتوثيق والتأكيد فقط)
    const preserved = ['Backups', 'Data', 'Attachments', 'Exports', 'uploads'];

    if (!fs.existsSync(dataDir)) {
      emit({ level: 'info', message: `مجلد البيانات غير موجود: ${dataDir}`, timestamp: now() });
      return;
    }

    for (const sub of transientDirs) {
      const target = path.join(dataDir, sub);
      if (fs.existsSync(target)) {
        try {
          fs.rmSync(target, { recursive: true, force: true });
          emit({ level: 'info', message: `✓ نُظّف: ${target}`, timestamp: now() });
        } catch {
          emit({ level: 'warning', message: `تعذّر تنظيف: ${target}`, timestamp: now() });
        }
      }
    }

    // حذف ملف الإعداد المحلي وملف version.json من جذر مجلد البيانات
    // (version.json هو ما يجعل المُثبِّت يعتقد أن البرنامج مثبَّت — إن بقي بعد
    //  إلغاء التثبيت تُفتح صفحة بيضاء بدل معالج التثبيت عند إعادة التثبيت)
    for (const cfgName of ['onesoft.config.json', 'config.json', 'version.json']) {
      const cfgPath = path.join(dataDir, cfgName);
      if (fs.existsSync(cfgPath)) {
        try {
          fs.unlinkSync(cfgPath);
          emit({ level: 'info', message: `✓ حُذف ملف الإعداد: ${cfgPath}`, timestamp: now() });
        } catch {
          emit({ level: 'warning', message: `تعذّر حذف ملف الإعداد: ${cfgPath}`, timestamp: now() });
        }
      }
    }

    const kept = preserved.filter(p => fs.existsSync(path.join(dataDir, p)));
    if (kept.length > 0) {
      emit({ level: 'info', message: `مُحتفَظ به: ${kept.join('، ')}`, timestamp: now() });
    }
  }

  private async _removeShortcuts(emit: Emit): Promise<void> {
    if (process.platform !== 'win32') return;
    const shortcuts = [
      '%USERPROFILE%\\Desktop\\OneSoft ERP.lnk',
      '%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\OneSoft ERP.lnk',
    ];
    for (const s of shortcuts) {
      try {
        const expanded = s.replace('%USERPROFILE%', process.env['USERPROFILE'] ?? '')
          .replace('%APPDATA%', process.env['APPDATA'] ?? '');
        if (fs.existsSync(expanded)) {
          fs.unlinkSync(expanded);
          emit({ level: 'info', message: `✓ حُذف: ${expanded}`, timestamp: now() });
        }
      } catch {
        emit({ level: 'warning', message: `تعذّر حذف اختصار: ${s}`, timestamp: now() });
      }
    }
  }

  private async _dropDatabase(opts: DatabaseConnectionOptions, emit: Emit): Promise<void> {
    // ✅ نستخدم مكتبة pg مع Parameterized queries بدلاً من shell interpolation
    // هذا يمنع SQL Injection تماماً
    const { Pool } = await import('pg');
    const pool = new Pool({
      host: opts.host,
      port: opts.port,
      database: 'postgres',
      user: opts.user,
      password: opts.password,
      connectionTimeoutMillis: 10_000,
    });

    try {
      const client = await pool.connect();
      try {
        // إنهاء الاتصالات المفتوحة — $1 parameterized لمنع injection
        await client.query(
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
          [opts.database],
        );

        // حذف قاعدة البيانات — نتحقق من الاسم قبل interpolation
        const safeDbName = this._validateIdentifier(opts.database);
        await client.query(`DROP DATABASE IF EXISTS "${safeDbName}"`);
        emit({ level: 'success', message: `تم حذف قاعدة البيانات "${safeDbName}"`, timestamp: now() });

        // حذف مستخدم التطبيق — اسم ثابت (لا input من المستخدم)
        await client.query(`DROP USER IF EXISTS "onesoft_app"`);
        emit({ level: 'success', message: 'تم حذف مستخدم التطبيق', timestamp: now() });
      } finally {
        client.release();
      }
    } catch (e: unknown) {
      emit({ level: 'warning', message: `تحذير حذف DB: ${e instanceof Error ? e.message : String(e)}`, timestamp: now() });
    } finally {
      await pool.end().catch(() => {});
    }
  }

  /**
   * يتحقق من أن اسم المُعرِّف (قاعدة بيانات، مستخدم) آمن
   * يسمح فقط بحروف وأرقام وشرطات سفلية
   */
  private _validateIdentifier(name: string): string {
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      throw new Error(`اسم قاعدة البيانات غير صالح: "${name}" — يُسمح فقط بـ [a-z A-Z 0-9 _]`);
    }
    return name;
  }

  private _removeDir(dirPath: string, emit: Emit): void {
    if (!fs.existsSync(dirPath)) {
      emit({ level: 'info', message: `المجلد غير موجود: ${dirPath}`, timestamp: now() });
      return;
    }
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      emit({ level: 'success', message: `✓ حُذف: ${dirPath}`, timestamp: now() });
    } catch (e: unknown) {
      // Windows locked files — جرب مرة ثانية بعد تأخير
      try {
        execSync(`rd /s /q "${dirPath}"`, { stdio: 'pipe', timeout: 30_000 });
        emit({ level: 'success', message: `✓ حُذف: ${dirPath}`, timestamp: now() });
      } catch {
        emit({ level: 'warning', message: `تعذّر حذف: ${dirPath}`, timestamp: now() });
      }
    }
  }

  private async _removeRegistryEntry(emit: Emit): Promise<void> {
    if (process.platform !== 'win32') return;
    try {
      execSync(
        'reg delete "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\OneSoftERP" /f',
        { stdio: 'pipe' }
      );
      emit({ level: 'info', message: 'تم حذف مدخل التسجيل', timestamp: now() });
    } catch {
      emit({ level: 'info', message: 'لم يُوجد مدخل تسجيل', timestamp: now() });
    }
  }

  private _findPgBin(): string {
    const candidates = [
      'C:\\Program Files\\PostgreSQL\\16\\bin',
      'C:\\Program Files\\PostgreSQL\\17\\bin',
      'C:\\Program Files\\PostgreSQL\\15\\bin',
    ];
    for (const c of candidates) if (fs.existsSync(c)) return c;
    return 'C:\\Program Files\\PostgreSQL\\16\\bin';
  }
}

function now() { return new Date().toISOString(); }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
