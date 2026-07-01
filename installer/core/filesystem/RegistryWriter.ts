import { execSync } from 'child_process';
import type { ProgressEvent } from '../types.js';

type Emit = (e: ProgressEvent) => void;

export interface UninstallRegistryInfo {
  displayName: string;
  displayVersion: string;
  publisher: string;
  installLocation: string;
  uninstallString: string;
  displayIcon: string;
  estimatedSizeKB: number;
}

/**
 * يكتب مدخل التسجيل في Windows Registry
 * يجعل البرنامج يظهر في "إضافة/إزالة البرامج"
 */
export class RegistryWriter {
  private readonly key = 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\OneSoftERP';

  write(info: UninstallRegistryInfo, emit: Emit): void {
    if (process.platform !== 'win32') {
      emit({ level: 'info', message: 'تخطي كتابة Registry (غير Windows)', timestamp: now() });
      return;
    }

    emit({ level: 'info', message: 'جارٍ تسجيل البرنامج في النظام...', timestamp: now() });

    const entries: Array<[string, string, string]> = [
      ['DisplayName',          'REG_SZ',    info.displayName],
      ['DisplayVersion',       'REG_SZ',    info.displayVersion],
      ['Publisher',            'REG_SZ',    info.publisher],
      ['InstallLocation',      'REG_EXPAND_SZ', info.installLocation],
      ['UninstallString',      'REG_EXPAND_SZ', info.uninstallString],
      ['DisplayIcon',          'REG_SZ',    info.displayIcon],
      ['EstimatedSize',        'REG_DWORD', String(info.estimatedSizeKB)],
      ['NoModify',             'REG_DWORD', '1'],
      ['NoRepair',             'REG_DWORD', '1'],
      ['InstallDate',          'REG_SZ',    new Date().toISOString().slice(0, 10).replace(/-/g, '')],
    ];

    try {
      for (const [name, type, value] of entries) {
        execSync(
          `reg add "${this.key}" /v "${name}" /t ${type} /d "${value.replace(/\\/g, '\\\\')}" /f`,
          { stdio: 'pipe' }
        );
      }
      emit({ level: 'success', message: '✅ تم تسجيل البرنامج — يظهر الآن في إضافة/إزالة البرامج', timestamp: now() });
    } catch (e: unknown) {
      emit({ level: 'warning', message: `تحذير registry: ${e instanceof Error ? e.message : String(e)}`, timestamp: now() });
    }
  }

  remove(): void {
    if (process.platform !== 'win32') return;
    try {
      execSync(`reg delete "${this.key}" /f`, { stdio: 'pipe' });
    } catch { /* not found */ }
  }
}

function now() { return new Date().toISOString(); }
