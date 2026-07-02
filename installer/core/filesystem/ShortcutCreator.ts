import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import type { ProgressEvent } from '../types.js';

type Emit = (e: ProgressEvent) => void;

export class ShortcutCreator {
  async createAll(
    opts: { installDir: string; appExe: string; iconPath: string },
    emit: Emit,
  ): Promise<void> {
    emit({ level: 'info', message: 'جارٍ إنشاء الاختصارات...', timestamp: now() });
    if (process.platform !== 'win32') {
      emit({ level: 'info', message: 'تخطي الاختصارات (غير Windows)', timestamp: now() });
      return;
    }
    const { appExe, iconPath } = opts;
    const lnks = [
      `${process.env['USERPROFILE'] ?? 'C:\\Users\\Default'}\\Desktop\\OneSoft ERP.lnk`,
      `${process.env['APPDATA'] ?? 'C:\\Users\\Default\\AppData\\Roaming'}\\Microsoft\\Windows\\Start Menu\\Programs\\OneSoft ERP.lnk`,
    ];
    for (const lnk of lnks) {
      try {
        fs.mkdirSync(path.dirname(lnk), { recursive: true });
        this._createShortcut({ dest: lnk, target: appExe, icon: iconPath, description: 'OneSoft ERP' }, emit);
        if (fs.existsSync(lnk)) {
          emit({ level: 'success', message: `✅ اختصار تم إنشاؤه: ${lnk}`, timestamp: now() });
        } else {
          emit({ level: 'warning', message: `⚠️ الاختصار لم يُنشأ رغم نجاح PowerShell: ${lnk}`, timestamp: now() });
        }
      } catch (e: unknown) {
        emit({ level: 'warning', message: `⚠️ ${e instanceof Error ? e.message : String(e)}`, timestamp: now() });
      }
    }
  }

  // Legacy single-shortcut method kept for backward compat
  create(opts: {
    targetPath: string;
    iconPath: string;
    installDir: string;
  }, emit: Emit): void {
    if (process.platform !== 'win32') {
      emit({ level: 'info', message: 'تخطي إنشاء الاختصارات (غير Windows)', timestamp: now() });
      return;
    }
    emit({ level: 'info', message: 'جارٍ إنشاء الاختصارات...', timestamp: now() });

    const desktop   = getSpecialFolder('Desktop');
    const startMenu = getSpecialFolder('Programs');

    for (const [dir, label] of [[desktop, 'سطح المكتب'], [startMenu, 'قائمة Start']] as [string, string][]) {
      const lnk = path.join(dir, 'OneSoft ERP.lnk');
      this._createShortcut({
        dest: lnk,
        target: opts.targetPath,
        icon: opts.iconPath,
        description: 'OneSoft ERP',
      }, emit);
      if (fs.existsSync(lnk)) {
        emit({ level: 'success', message: `✅ اختصار ${label}: ${lnk}`, timestamp: now() });
      } else {
        emit({ level: 'warning', message: `⚠️ الاختصار غير موجود بعد الإنشاء (${label}): ${lnk}`, timestamp: now() });
      }
    }
  }

  private _createShortcut(opts: {
    dest: string;
    target: string;
    icon: string;
    description: string;
  }, emit: Emit): void {
    // نكتب سكريبت PS1 مؤقت لتجنب مشاكل quoting في -Command عند وجود مسافات في المسار
    const tmpFile = path.join(os.tmpdir(), `onesoft_sc_${Date.now()}.ps1`);
    try {
      // PS1 يستخدم single-quotes لتجنب تفسير $ و" داخل المسارات
      const d    = opts.dest.replace(/'/g, "''");
      const t    = opts.target.replace(/'/g, "''");
      const ico  = opts.icon.replace(/'/g, "''");
      const desc = opts.description.replace(/'/g, "''");

      const ps1 = [
        `$ws  = New-Object -ComObject WScript.Shell`,
        `$lnk = $ws.CreateShortcut('${d}')`,
        `$lnk.TargetPath       = '${t}'`,
        `$lnk.IconLocation     = '${ico}'`,
        `$lnk.Description      = '${desc}'`,
        `$lnk.WorkingDirectory = Split-Path '${t}' -Parent`,
        `$lnk.Save()`,
      ].join('\r\n');

      // BOM-less UTF-8 — PowerShell 5.1 يقرأه بشكل صحيح
      fs.writeFileSync(tmpFile, ps1, { encoding: 'utf8' });

      const out = execSync(
        `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpFile}"`,
        { stdio: 'pipe', encoding: 'utf-8', timeout: 20_000 },
      );
      if (out && out.trim()) {
        emit({ level: 'info', message: `PS: ${out.trim()}`, timestamp: now() });
      }
    } catch (e: unknown) {
      let msg = e instanceof Error ? e.message : String(e);
      // التقاط stderr الكامل من الـ child_process
      const ee = e as Record<string, unknown>;
      if (typeof ee['stderr'] === 'string' && ee['stderr']) {
        msg += `\nSTDERR: ${ee['stderr']}`;
      }
      if (typeof ee['stdout'] === 'string' && ee['stdout']) {
        msg += `\nSTDOUT: ${ee['stdout']}`;
      }
      emit({ level: 'warning', message: `⚠️ فشل إنشاء الاختصار: ${msg}`, timestamp: now() });
    } finally {
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    }
  }
}

function getSpecialFolder(name: 'Desktop' | 'Programs'): string {
  try {
    return execSync(
      `powershell.exe -NoProfile -NonInteractive -Command "[Environment]::GetFolderPath('${name}')"`,
      { encoding: 'utf-8', stdio: 'pipe', timeout: 10_000 },
    ).trim();
  } catch {
    return name === 'Desktop'
      ? path.join(process.env['USERPROFILE'] ?? 'C:\\Users\\Default', 'Desktop')
      : path.join(
          process.env['APPDATA'] ?? 'C:\\Users\\Default\\AppData\\Roaming',
          'Microsoft', 'Windows', 'Start Menu', 'Programs',
        );
  }
}

function now() { return new Date().toISOString(); }
