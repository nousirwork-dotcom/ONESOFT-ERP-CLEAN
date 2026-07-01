import * as fs from 'fs';
import * as path from 'path';
import type { RequirementResult } from '../../types.js';

const VERSION_FILE = process.platform === 'win32'
  ? path.join(process.env['ProgramData'] || 'C:\\ProgramData', 'OneSoft', 'version.json')
  : path.join(process.env['HOME'] || '/tmp', '.onesoft', 'version.json');

export async function checkPreviousVersion(): Promise<RequirementResult> {
  const id = 'previous-version';
  const label = 'فحص إصدار سابق من OneSoft';

  try {
    if (fs.existsSync(VERSION_FILE)) {
      const raw = fs.readFileSync(VERSION_FILE, 'utf-8');
      const info = JSON.parse(raw) as { version?: string; installedAt?: string };
      return {
        id, label, status: 'warn',
        detail: `تم اكتشاف إصدار سابق: v${info.version ?? '?'} — سيتم الترقية`,
        fixable: false,
      };
    }

    return { id, label, status: 'pass', detail: 'لا يوجد إصدار سابق — تثبيت جديد', fixable: false };
  } catch {
    return { id, label, status: 'warn', detail: 'تعذّر فحص الإصدار السابق', fixable: false };
  }
}
