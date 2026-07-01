import * as fs from 'fs';
import * as path from 'path';
import type {
  OneSoftConfig, DeploymentType, AccessMode, InstallMode, RunMode,
} from '../types.js';
import {
  legacyModeToDeploymentType, legacyRunModeToAccessModes,
  deploymentTypeToLegacyMode, accessModesToLegacyRunMode,
} from '../types.js';

// ─── مسارات الإعدادات ─────────────────────────────────────────────────────────
const CONFIG_DIR = process.platform === 'win32'
  ? path.join(process.env['ProgramData'] || 'C:\\ProgramData', 'OneSoft', 'config')
  : path.join(process.env['HOME'] || '/tmp', '.onesoft', 'config');

const CONFIG_FILE = path.join(CONFIG_DIR, 'onesoft.config.json');

// ─── الإعدادات الافتراضية ─────────────────────────────────────────────────────
export function buildDefaultConfig(partial: {
  deploymentType?: DeploymentType;
  accessModes?: AccessMode[];
  dbPassword: string;
}): OneSoftConfig {
  const programData = process.platform === 'win32'
    ? path.join(process.env['ProgramData'] || 'C:\\ProgramData', 'OneSoft')
    : path.join(process.env['HOME'] || '/tmp', '.onesoft');

  const deploymentType = partial.deploymentType ?? 'server+client';
  const accessModes    = partial.accessModes    ?? ['desktop', 'web'];

  return {
    version:        '1.0.0',
    configVersion:  2,

    // ── البنية الجديدة ──────────────────────────────────────────────────────
    deploymentType,
    accessModes,

    // ── Legacy fields — محسوبة تلقائياً للتوافق مع كود قديم ────────────────
    installMode: deploymentTypeToLegacyMode(deploymentType),
    runMode:     accessModesToLegacyRunMode(accessModes),

    components: {
      database: ['server', 'server+client', 'branch'].includes(deploymentType),
      backend:  ['server', 'server+client', 'branch'].includes(deploymentType),
      frontend: ['server+client', 'branch'].includes(deploymentType) || accessModes.includes('web'),
      updater:  deploymentType !== 'cloud',
      backup:   ['server', 'server+client', 'branch'].includes(deploymentType),
    },

    database: {
      host:     'localhost',
      port:     5432,
      name:     'onesoft_erp',
      user:     'onesoft_app',
      password: partial.dbPassword,
      poolMin:  2,
      poolMax:  10,
    },

    remoteServer: {
      enabled:  ['client', 'branch', 'cloud'].includes(deploymentType),
      apiUrl:   null,
      apiKey:   null,
      syncMode: 'realtime',
    },

    server: {
      backendPort:    3000,
      frontendPort:   5000,
      host:           '0.0.0.0',
      allowedOrigins: ['localhost', '127.0.0.1'],
    },

    cloud: {
      enabled:      deploymentType === 'cloud',
      provider:     null,
      syncInterval: 3600,
      endpoint:     null,
    },

    backup: {
      enabled:            true,
      schedule:           '0 2 * * *',
      retentionDays:      30,
      path:               path.join(programData, 'Backups'),
      compress:           true,
      includeAttachments: true,
    },

    update: {
      autoCheck:       true,
      channel:         'stable',
      updateServerUrl: 'https://updates.onesoft.app',
      checkInterval:   86400,
    },

    printing: {
      defaultPrinter: null,
      pdfOutputPath:  path.join(programData, 'Exports'),
    },

    license: {
      key:         null,
      type:        'trial',
      expiresAt:   null,
      maxUsers:    1,
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

  static getConfigPath(): string { return CONFIG_FILE; }

  static exists(): boolean { return fs.existsSync(CONFIG_FILE); }

  static load(): OneSoftConfig {
    if (!fs.existsSync(CONFIG_FILE)) {
      throw new Error(`Config file not found: ${CONFIG_FILE}`);
    }
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<OneSoftConfig> & {
      installMode?: InstallMode;
      runMode?: RunMode;
    };

    // ── ترحيل تلقائي من configVersion 1 إلى 2 ────────────────────────────
    return ConfigManager._migrate(parsed);
  }

  static save(config: OneSoftConfig): void {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    // نتأكد دائماً من مزامنة الحقول القديمة مع الجديدة عند الحفظ
    const synced: OneSoftConfig = {
      ...config,
      installMode: deploymentTypeToLegacyMode(config.deploymentType),
      runMode:     accessModesToLegacyRunMode(config.accessModes),
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(synced, null, 2), 'utf-8');
  }

  static patch(updates: Partial<OneSoftConfig>): OneSoftConfig {
    if (!ConfigManager.exists()) {
      throw new Error('Config file does not exist yet — call initDefault first');
    }
    const current = ConfigManager.load();
    const merged  = deepMerge(
      current  as unknown as Record<string, unknown>,
      updates  as unknown as Record<string, unknown>,
    ) as unknown as OneSoftConfig;
    ConfigManager.save(merged);
    return merged;
  }

  static initDefault(partial: Parameters<typeof buildDefaultConfig>[0]): OneSoftConfig {
    const config = buildDefaultConfig(partial);
    ConfigManager.save(config);
    return config;
  }

  // ── ترحيل تلقائي بين إصدارات Config Schema ──────────────────────────────

  private static _migrate(raw: Record<string, unknown>): OneSoftConfig {
    const version = (raw['configVersion'] as number | undefined) ?? 1;

    if (version < 2) {
      // v1 → v2: اشتق deploymentType + accessModes من installMode + runMode
      const legacyMode    = (raw['installMode'] as InstallMode | undefined) ?? 'server+client';
      const legacyRunMode = (raw['runMode']     as RunMode     | undefined) ?? 'desktop+web';

      raw['deploymentType'] = legacyModeToDeploymentType(legacyMode);
      raw['accessModes']    = legacyRunModeToAccessModes(legacyRunMode);
      raw['configVersion']  = 2;
    }

    return raw as unknown as OneSoftConfig;
  }
}

// ─── Deep Merge ───────────────────────────────────────────────────────────────
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];
    if (
      sv !== null && typeof sv === 'object' && !Array.isArray(sv) &&
      tv !== null && typeof tv === 'object' && !Array.isArray(tv)
    ) {
      result[key] = deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>);
    } else {
      result[key] = sv;
    }
  }
  return result;
}
