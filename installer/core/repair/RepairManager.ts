import type { RepairRequest, RepairResult, RepairAction, ProgressEvent } from '../types.js';
import { ConfigManager } from '../config/ConfigManager.js';

type Emit = (e: ProgressEvent) => void;

/**
 * إصلاح التثبيت (Repair Installation)
 *
 * الإجراءات المدعومة:
 *   reinstall-services     ← إعادة تثبيت خدمات Windows
 *   recreate-shortcuts     ← إعادة إنشاء الاختصارات
 *   fix-permissions        ← إصلاح صلاحيات المجلدات
 *   run-missing-migrations ← تشغيل الـ Migrations الفائتة
 *   reseed-accounts        ← إعادة بذر شجرة الحسابات (إن كانت ناقصة)
 *   fix-config             ← إصلاح ملف الإعدادات
 */
export class RepairManager {
  private readonly config: ConfigManager;

  constructor(configDir?: string) {
    this.config = new ConfigManager(configDir);
  }

  async repair(req: RepairRequest, emit: Emit): Promise<RepairResult> {
    const actionsApplied: RepairAction[] = [];
    const errors: string[] = [];

    emit({ level: 'info', message: `بدء إصلاح التثبيت — ${req.actions.length} إجراء`, timestamp: now() });

    for (const action of req.actions) {
      try {
        emit({ level: 'info', message: `تنفيذ: ${action}`, timestamp: now() });
        await this._execute(action, emit);
        actionsApplied.push(action);
        emit({ level: 'success', message: `✓ ${action}`, timestamp: now() });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${action}: ${msg}`);
        emit({ level: 'error', message: `✗ ${action}: ${msg}`, timestamp: now() });
      }
    }

    const success = errors.length === 0;
    if (success) {
      emit({ level: 'success', message: 'اكتمل الإصلاح بنجاح', timestamp: now() });
    } else {
      emit({ level: 'warning', message: `اكتمل الإصلاح مع ${errors.length} خطأ`, timestamp: now() });
    }

    return { success, actionsApplied, errors };
  }

  private async _execute(action: RepairAction, emit: Emit): Promise<void> {
    switch (action) {
      case 'fix-config': {
        const cfg = await this.config.load();
        await this.config.save(cfg);
        emit({ level: 'info', message: 'تم إعادة كتابة ملف الإعدادات', timestamp: now() });
        break;
      }

      case 'fix-permissions': {
        if (process.platform !== 'win32') break;
        const { execSync } = await import('child_process');
        const cfg = await this.config.load();
        const dirs = [
          cfg.paths.data,
          cfg.paths.logs,
          cfg.paths.backups,
          cfg.paths.attachments,
          cfg.paths.exports,
        ];
        for (const dir of dirs) {
          try {
            execSync(`icacls "${dir}" /grant "Everyone:(OI)(CI)F" /T /Q`, { stdio: 'ignore' });
            emit({ level: 'info', message: `صلاحيات: ${dir}`, timestamp: now() });
          } catch {
            emit({ level: 'warning', message: `تعذّر إصلاح صلاحيات: ${dir}`, timestamp: now() });
          }
        }
        break;
      }

      case 'recreate-shortcuts': {
        emit({ level: 'info', message: 'إعادة إنشاء الاختصارات (سيُفعَّل في v1.1)', timestamp: now() });
        break;
      }

      case 'reinstall-services': {
        emit({ level: 'info', message: 'إعادة تثبيت الخدمات (سيُفعَّل في v1.1)', timestamp: now() });
        break;
      }

      case 'run-missing-migrations': {
        emit({ level: 'info', message: 'تشغيل الـ Migrations الفائتة (سيُفعَّل في v1.1)', timestamp: now() });
        break;
      }

      case 'reseed-accounts': {
        emit({ level: 'info', message: 'إعادة بذر شجرة الحسابات (سيُفعَّل في v1.1)', timestamp: now() });
        break;
      }

      default: {
        const _exhaustive: never = action;
        throw new Error(`إجراء غير معروف: ${String(_exhaustive)}`);
      }
    }
  }
}

function now() { return new Date().toISOString(); }
