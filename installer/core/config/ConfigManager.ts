import * as fs from 'fs';
import * as path from 'path';
import type { OneSoftConfig, InstallMode, RunMode } from '../types.js';

// ─── مسارات الإعدادات ─────────────────────────────────────────────────────────
const CONFIG_DIR = process.platform === 'win32'
  ? path.join(process.env['ProgramData'] || 'C:\\ProgramData', 'OneSoft', 'config')
  : path.join(process.env['HOME'] || '/tmp', '.onesoft', 'config');

const CONFIG_FILE = path.join(CONFIG_DIR, 'onesoft.config.json');

// ─── الإعدادات الافتراضية ─────────────────────────────────────────────────────
// ملاحظة: كلمة مرور قاعدة البيانات إلزامية — لا قيمة افتراضية لأسباب أمنية
export function buildDefaultConfig(partial: {
  installMode?: InstallMode;
  runMode?: RunMode;
  dbPassword: string;    // مطلوب دائماً — يُدخله المستخدم أثناء التثبيت
}): OneSoftConfig {
  const programData = process.platform === 'win32'
    ? path.join(process.env['ProgramData'] || 'C:\\ProgramData', 'OneSoft')
    : path.join(process.env['HOME'] || '/tmp', '.onesoft');

  return {
    version: '1.0.0',
    installMode: partial.installMode ?? 'single-user',
    runMode: partial.runMode ?? 'desktop+web',

    database: {
      host: 'localhost',
      port: 5432,
      name: 'onesoft_erp',
      user: 'onesoft_app',
      password: partial.dbPassword,   // ✅ لا قيمة افتراضية مرمّزة
      poolMin: 2,
      poolMax: 10,
    },

    server: {
      backendPort: 3000,
      frontendPort: 5000,
      host: '0.0.0.0',
      allowedOrigins: ['localhost', '127.0.0.1'],
    },

    cloud: {
      enabled: false,
      provider: null,
      syncInterval: 3600,
      endpoint: null,
    },

    backup: {
      enabled: true,
      schedule: '0 2 * * *',
      retentionDays: 30,
      path: path.join(programData, 'Backups'),
      compress: true,
      includeAttachments: true,
    },

    update: {
      autoCheck: true,
      channel: 'stable',
      updateServerUrl: 'https://updates.onesoft.app',
      checkInterval: 86400,
    },

    printing: {
      defaultPrinter: null,
      pdfOutputPath: path.join(programData, 'Exports'),
    },

    license: {
      key: null,
      type: 'trial',
      expiresAt: null,
      maxUsers: 1,
      activatedAt: null,
    },

    paths: {
      data:        path.join(programData, 'Data'),
      backups:     path.join(programData, 'Backups'),
      logs:        path.join(programData, 'Logs'),
      temp:        path.join(programData, 'Temp'),
      updates:     path.join(programData, 'Updates'),
      attachments: path.join(programData, 'Attachments'),
      exports:     path.join(programData, 'Exports'),
    },
  };
}

// ─── ConfigManager ────────────────────────────────────────────────────────────
export class ConfigManager {

  static getConfigPath(): string {
    return CONFIG_FILE;
  }

  static exists(): boolean {
    return fs.existsSync(CONFIG_FILE);
  }

  static load(): OneSoftConfig {
    if (!fs.existsSync(CONFIG_FILE)) {
      throw new Error(`Config file not found: ${CONFIG_FILE}`);
    }
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw) as OneSoftConfig;
  }

  static save(config: OneSoftConfig): void {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  }

  static patch(updates: Partial<OneSoftConfig>): OneSoftConfig {
    if (!ConfigManager.exists()) {
      throw new Error('Config file does not exist yet — call initDefault first');
    }
    const current = ConfigManager.load();
    const merged = deepMerge(current, updates) as OneSoftConfig;
    ConfigManager.save(merged);
    return merged;
  }

  static initDefault(partial: Parameters<typeof buildDefaultConfig>[0]): OneSoftConfig {
    const config = buildDefaultConfig(partial);
    ConfigManager.save(config);
    return config;
  }
}

// ─── Deep Merge ───────────────────────────────────────────────────────────────
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];
    if (sv !== null && typeof sv === 'object' && !Array.isArray(sv) &&
        tv !== null && typeof tv === 'object' && !Array.isArray(tv)) {
      result[key] = deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>);
    } else {
      result[key] = sv;
    }
  }
  return result;
}
