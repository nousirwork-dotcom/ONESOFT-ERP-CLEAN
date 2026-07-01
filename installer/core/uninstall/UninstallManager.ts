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

    // 1. إيقاف وإزالة الخدمات
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

    // 2. حذف الاختصارات
    emit({ level: 'info', message: 'جارٍ حذف الاختصارات...', timestamp: now() });
    await this._removeShortcuts(emit);

    // 3. حذف قاعدة البيانات (اختياري)
    if (deleteDatabase) {
      emit({ level: 'info', message: 'جارٍ حذف قاعدة البيانات...', timestamp: now() });
      await this._dropDatabase(dbOpts, emit);
    } else {
      emit({ level: 'info', message: 'تم الاحتفاظ بقاعدة البيانات', timestamp: now() });
    }

    // 4. حذف ملفات البرنامج
    emit({ level: 'info', message: 'جارٍ حذف ملفات البرنامج...', timestamp: now() });
    this._removeDir(installDir, emit);

    // 5. حذف بيانات المستخدم (اختياري)
    if (deleteData) {
      emit({ level: 'info', message: 'جارٍ حذف بيانات المستخدم...', timestamp: now() });
      this._removeDir(dataDir, emit);
    } else {
      emit({ level: 'info', message: `تم الاحتفاظ بمجلد البيانات: ${dataDir}`, timestamp: now() });
    }

    // 6. حذف مدخل التسجيل (Registry)
    await this._removeRegistryEntry(emit);

    emit({ level: 'success', message: '✅ تم إلغاء التثبيت بالكامل', timestamp: now() });
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
