import { execFileSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import type { ProgressEvent, DatabaseConnectionOptions } from '../types.js';
import { PostgreSQLToolsResolver } from '../database/PostgreSQLToolsResolver.js';
import { ServiceManager } from '../services/ServiceManager.js';

type Emit = (e: ProgressEvent) => void;

export type RollbackStageStatus =
  | 'success'
  | 'failed'
  | 'not-attempted'
  | 'atomic-rollback'
  | 'preserved';

export interface RollbackResult {
  ok: boolean;
  databaseRollback: RollbackStageStatus;
  roleBootstrapRollback: RollbackStageStatus;
  ownershipRollback: RollbackStageStatus;
  serviceRollback: RollbackStageStatus;
}

export class RollbackManager {
  private readonly serviceManager: Pick<ServiceManager, 'start' | 'getStatus'>;

  constructor(
    serviceManager: Pick<ServiceManager, 'start' | 'getStatus'> = new ServiceManager(),
  ) {
    this.serviceManager = serviceManager;
  }

  async rollback(opts: {
    backupDir: string;
    dbOpts: DatabaseConnectionOptions;
    roleBootstrapRollback?: RollbackStageStatus;
    ownershipRollback?: RollbackStageStatus;
    restartServer?: boolean;
  }, emit: Emit): Promise<RollbackResult> {
    const { backupDir, dbOpts } = opts;
    let databaseRollback: RollbackStageStatus = 'not-attempted';
    let configRollback: RollbackStageStatus = 'not-attempted';
    let serviceRollback: RollbackStageStatus = 'not-attempted';

    emit({ level: 'warning', message: 'جارٍ التراجع (Rollback)...', timestamp: now() });

    // استعادة قاعدة البيانات
    const dumpFile = path.join(backupDir, 'database.sql');
    if (fs.existsSync(dumpFile)) {
      emit({ level: 'info', message: 'جارٍ استعادة قاعدة البيانات...', timestamp: now() });
      try {
        // ✅ تحقق من جميع المدخلات قبل الإدراج في shell command
        const host     = validateHost(dbOpts.host);
        const port     = validatePort(dbOpts.port);
        const user     = validateIdentifier(dbOpts.user);
        const database = validateIdentifier(dbOpts.database);

        const psql = new PostgreSQLToolsResolver().resolveAll(dbOpts).psql;
        emit({ level: 'info', message: `تم اكتشاف psql.exe للاستعادة: ${psql}`, timestamp: now() });
        const env = { ...process.env, PGPASSWORD: dbOpts.password };

        execFileSync(psql, [
          '-h', host, '-p', String(port), '-U', user, '-d', database,
          '-f', dumpFile, '--no-password',
        ], { env, stdio: 'pipe', timeout: 300_000, windowsHide: true });
        emit({ level: 'success', message: 'تم استعادة قاعدة البيانات', timestamp: now() });
        databaseRollback = 'success';
      } catch (e: unknown) {
        emit({ level: 'error', message: `فشل استعادة قاعدة البيانات: ${e instanceof Error ? e.message : String(e)}`, timestamp: now() });
        databaseRollback = 'failed';
      }
    }

    // استعادة ملف الإعدادات
    const configBackup = path.join(backupDir, 'onesoft.config.json');
    const configDest = path.join(process.env['ProgramData'] || 'C:\\ProgramData', 'OneSoft', 'config', 'onesoft.config.json');
    if (fs.existsSync(configBackup)) {
      try {
        fs.copyFileSync(configBackup, configDest);
        emit({ level: 'success', message: 'تم استعادة ملف الإعدادات', timestamp: now() });
        configRollback = 'success';
      } catch (e: unknown) {
        emit({ level: 'error', message: `فشل استعادة ملف الإعدادات: ${e instanceof Error ? e.message : String(e)}`, timestamp: now() });
        configRollback = 'failed';
      }
    }

    if (opts.restartServer) {
      if (databaseRollback === 'failed' || configRollback === 'failed') {
        serviceRollback = 'not-attempted';
      } else if (this.serviceManager.getStatus('OneSoft-Server') === 'not-installed') {
        serviceRollback = 'not-attempted';
      } else {
        try {
          const started = this.serviceManager.start('OneSoft-Server');
          if (!started.success) {
            throw new Error(started.error ?? 'sc start returned a failure');
          }
          serviceRollback = 'success';
          emit({ level: 'success', message: 'تم تشغيل OneSoft-Server القديم بعد التراجع', timestamp: now() });
        } catch (e: unknown) {
          serviceRollback = 'failed';
          emit({
            level: 'error',
            message: `فشل تشغيل OneSoft-Server القديم بعد التراجع: ${e instanceof Error ? e.message : String(e)}`,
            timestamp: now(),
          });
        }
      }
    }

    const result: RollbackResult = {
      ok: databaseRollback !== 'failed' &&
        configRollback !== 'failed' &&
        isRollbackComplete(opts.roleBootstrapRollback ?? 'not-attempted') &&
        isRollbackComplete(opts.ownershipRollback ?? 'not-attempted') &&
        isRollbackComplete(serviceRollback),
      databaseRollback,
      roleBootstrapRollback: opts.roleBootstrapRollback ?? 'not-attempted',
      ownershipRollback: opts.ownershipRollback ?? 'not-attempted',
      serviceRollback,
    };
    if (result.ok) {
      emit({ level: 'success', message: 'اكتمل التراجع (Rollback) بنجاح', timestamp: now() });
    } else {
      emit({ level: 'error', message: 'اكتمل التراجع جزئياً — راجع نتائج مراحل التراجع', timestamp: now() });
    }
    return result;
  }
}

function isRollbackComplete(status: RollbackStageStatus): boolean {
  return status === 'success' || status === 'atomic-rollback' || status === 'not-attempted';
}

/** يتحقق أن الاسم يحتوي فقط على أحرف وأرقام وشرطة سفلية */
function validateIdentifier(value: string): string {
  if (!/^[a-zA-Z0-9_]+$/.test(value)) {
    throw new Error(`قيمة غير صالحة للمُعرِّف: "${value}"`);
  }
  return value;
}

/** يتحقق أن host عنوان IP أو hostname بسيط (بدون مسافات أو shell metacharacters) */
function validateHost(host: string): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(host)) {
    throw new Error(`عنوان host غير صالح: "${host}"`);
  }
  return host;
}

/** يتحقق أن المنفذ رقم صحيح */
function validatePort(port: number): number {
  const n = Number(port);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`رقم المنفذ غير صالح: "${port}"`);
  }
  return n;
}

function now() { return new Date().toISOString(); }
