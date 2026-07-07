/**
 * devicePrefs.ts — إعدادات الجهاز المحلية
 *
 * يُخزّن إعدادات خاصة بالجهاز مثل كود المؤسسة المحفوظ.
 * الملف: ~/.onesoft/device.prefs.json  (mode 0o600)
 * ليس مشفّراً لأن كود المؤسسة ليس سرياً بحد ذاته —
 * الأمان الحقيقي يأتي من التحقق في الخادم (ترخيص + كلمة المرور).
 */
import * as fs   from 'fs';
import * as path from 'path';
import { getOnesoftDataDir } from './deviceId.js';

const PREFS_FILE = 'device.prefs.json';

function getPrefsPath(): string {
  return path.join(getOnesoftDataDir(), PREFS_FILE);
}

export interface DevicePrefs {
  savedOrgCode?: string;   // كود المؤسسة المحفوظ (يُستخدم لتسجيل الدخول)
  savedOrgName?: string;   // اسم المؤسسة (للعرض فقط — يُحدَّث عند كل دخول)
}

export function loadDevicePrefs(): DevicePrefs {
  try {
    const p = getPrefsPath();
    if (!fs.existsSync(p)) return {};
    const raw = fs.readFileSync(p, 'utf-8').trim();
    return raw ? (JSON.parse(raw) as DevicePrefs) : {};
  } catch {
    return {};
  }
}

export function saveDevicePrefs(patch: Partial<DevicePrefs>): void {
  try {
    const dir     = getOnesoftDataDir();
    fs.mkdirSync(dir, { recursive: true });
    const current = loadDevicePrefs();
    const merged  = { ...current, ...patch };
    fs.writeFileSync(getPrefsPath(), JSON.stringify(merged, null, 2), { encoding: 'utf-8', mode: 0o600 });
  } catch { /* صامت — لا يوقف الخادم */ }
}

export function clearDeviceOrgCode(): void {
  try {
    const prefs = loadDevicePrefs();
    delete prefs.savedOrgCode;
    delete prefs.savedOrgName;
    const dir = getOnesoftDataDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getPrefsPath(), JSON.stringify(prefs, null, 2), { encoding: 'utf-8', mode: 0o600 });
  } catch { /* صامت */ }
}
