import { execSync } from 'child_process';
import * as path from 'path';
import type { ProgressEvent } from '../types.js';

type Emit = (e: ProgressEvent) => void;

export class ShortcutCreator {
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

    // سطح المكتب
    const desktop = getDesktopPath();
    this._createShortcut({
      dest: path.join(desktop, 'OneSoft ERP.lnk'),
      target: opts.targetPath,
      icon: opts.iconPath,
      description: 'OneSoft ERP — نظام إدارة الأعمال',
    }, emit);

    // قائمة Start
    const startMenu = getStartMenuPath();
    this._createShortcut({
      dest: path.join(startMenu, 'OneSoft ERP.lnk'),
      target: opts.targetPath,
      icon: opts.iconPath,
      description: 'OneSoft ERP',
    }, emit);

    emit({ level: 'success', message: 'تم إنشاء الاختصارات', timestamp: now() });
  }

  private _createShortcut(opts: {
    dest: string;
    target: string;
    icon: string;
    description: string;
  }, emit: Emit): void {
    try {
      const ps = `
        $WshShell = New-Object -comObject WScript.Shell;
        $Shortcut = $WshShell.CreateShortcut("${opts.dest}");
        $Shortcut.TargetPath = "${opts.target}";
        $Shortcut.IconLocation = "${opts.icon}";
        $Shortcut.Description = "${opts.description}";
        $Shortcut.Save();
      `;
      execSync(`powershell -Command "${ps.replace(/\n/g, ' ')}"`, { stdio: 'pipe' });
      emit({ level: 'info', message: `✓ اختصار: ${opts.dest}`, timestamp: now() });
    } catch (e: unknown) {
      emit({ level: 'warning', message: `تحذير: فشل إنشاء اختصار — ${e instanceof Error ? e.message : String(e)}`, timestamp: now() });
    }
  }
}

function getDesktopPath(): string {
  return execSync('powershell -Command "[Environment]::GetFolderPath(\'Desktop\')"', {
    encoding: 'utf-8', stdio: 'pipe',
  }).trim();
}

function getStartMenuPath(): string {
  return execSync('powershell -Command "[Environment]::GetFolderPath(\'Programs\')"', {
    encoding: 'utf-8', stdio: 'pipe',
  }).trim();
}

function now() { return new Date().toISOString(); }
