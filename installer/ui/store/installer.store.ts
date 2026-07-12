import { create } from 'zustand';
import type {
  DeploymentType, AccessMode,
  DatabaseMode, MachineRole, ConnectivityMode,
  LicensingMode, UpdateChannel, BackupPolicy, BackupFrequency, BackupLocation, TelemetryConfig,
  DatabaseConnectionOptions,
  OrganizationSetup, FirstUserSetup,
  RequirementsReport, HealthReport, ProgressEvent, OneSoftConfig,
} from '../../core/types';
import type { ExistingDbInfo } from '../../core/database/ExistingDbDetector';

interface InstallerStore {
  // Navigation
  currentStep: number;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;

  // Wizard data
  acceptedLicense: boolean;
  setAcceptedLicense: (v: boolean) => void;

  // ── 1. نوع التثبيت ────────────────────────────────────────────────────────
  deploymentType: DeploymentType;
  setDeploymentType: (t: DeploymentType) => void;

  // ── 2. طرق الاستخدام (متعددة) ────────────────────────────────────────────
  accessModes: AccessMode[];
  setAccessModes: (modes: AccessMode[]) => void;
  toggleAccessMode: (mode: AccessMode) => void;

  // ── 3. وضع قاعدة البيانات ─────────────────────────────────────────────────
  databaseMode: DatabaseMode;
  setDatabaseMode: (m: DatabaseMode) => void;

  // ── 4. دور الجهاز ─────────────────────────────────────────────────────────
  machineRole: MachineRole;
  setMachineRole: (r: MachineRole) => void;

  // ── 5. طريقة الاتصال ──────────────────────────────────────────────────────
  connectivityMode: ConnectivityMode;
  setConnectivityMode: (c: ConnectivityMode) => void;

  // ── 6. نوع الترخيص ────────────────────────────────────────────────────────
  licensingMode: LicensingMode;
  setLicensingMode: (l: LicensingMode) => void;

  // ── 7. قناة التحديث ───────────────────────────────────────────────────────
  updateChannel: UpdateChannel;
  setUpdateChannel: (ch: UpdateChannel) => void;

  // ── 8. سياسة النسخ الاحتياطي ──────────────────────────────────────────────
  backupPolicy: BackupPolicy;
  setBackupFrequency: (f: BackupFrequency) => void;
  toggleBackupLocation: (loc: BackupLocation) => void;
  setBackupRetainDays: (days: number) => void;
  setBackupPath: (p: string) => void;

  // ── 9. إعدادات التشخيص (Telemetry) ───────────────────────────────────────
  telemetry: TelemetryConfig;
  setTelemetry: (t: Partial<TelemetryConfig>) => void;

  // Database connection options
  dbOpts: DatabaseConnectionOptions;
  setDbOpts: (opts: Partial<DatabaseConnectionOptions>) => void;

  // Organization
  organization: OrganizationSetup;
  setOrganization: (o: Partial<OrganizationSetup>) => void;

  // First user
  firstUser: FirstUserSetup;
  setFirstUser: (u: Partial<FirstUserSetup>) => void;

  // Results
  requirementsReport: RequirementsReport | null;
  setRequirementsReport: (r: RequirementsReport) => void;

  healthReport: HealthReport | null;
  setHealthReport: (r: HealthReport) => void;

  // ── بوابة خطوة قاعدة البيانات (يجب اكتمال: test → save → verify) ───────────
  dbConfigVerified: boolean;
  setDbConfigVerified: (v: boolean) => void;

  // ── الاتصال بقاعدة بيانات OneSoft موجودة (إعادة تثبيت آمنة) ─────────────────
  // عند true: يتخطّى المُثبِّت إنشاء المؤسسة/المستخدم وبذر الحسابات، ويشغّل
  // migrations آمنة فقط، ثم يوجّه لتسجيل الدخول بالمستخدمين الحاليين.
  connectToExisting: boolean;
  setConnectToExisting: (v: boolean) => void;
  existingDbInfo: ExistingDbInfo | null;
  setExistingDbInfo: (info: ExistingDbInfo | null) => void;

  // Install phase tracking (for unified nav bar)
  installRunning: boolean;
  installDone: boolean;
  setInstallRunning: (v: boolean) => void;
  setInstallDone:    (v: boolean) => void;
  // المنفذ الموحّد الفعلي بعد التثبيت (Backend + الواجهة معاً — لا يوجد منفذ منفصل بعد الآن)
  installedPort: number;
  setInstalledPort: (p: number) => void;

  orgId: number | null;
  setOrgId: (id: number) => void;

  orgCode: string | null;
  setOrgCode: (c: string) => void;

  // Progress log
  progressLog: ProgressEvent[];
  addProgress: (e: ProgressEvent) => void;
  clearProgress: () => void;

  // Derived
  getDatabaseUrl: () => string;

  // Config snapshot
  config: Partial<OneSoftConfig>;
  setConfig: (c: Partial<OneSoftConfig>) => void;
}

export const useInstallerStore = create<InstallerStore>((set, get) => ({
  currentStep: 1,
  setStep:   (step) => set({ currentStep: step }),
  nextStep:  () => set(s => ({ currentStep: s.currentStep + 1 })),
  prevStep:  () => set(s => ({ currentStep: Math.max(1, s.currentStep - 1) })),

  acceptedLicense: false,
  setAcceptedLicense: (v) => set({ acceptedLicense: v }),

  // ── 1. نوع التثبيت ────────────────────────────────────────────────────────
  deploymentType: 'server+client',
  setDeploymentType: (t) => set({ deploymentType: t }),

  // ── 2. طرق الاستخدام ─────────────────────────────────────────────────────
  accessModes: ['desktop', 'web'],
  setAccessModes: (modes) => set({ accessModes: modes }),
  toggleAccessMode: (mode) => set(s => {
    const next = s.accessModes.includes(mode)
      ? s.accessModes.filter(m => m !== mode)
      : [...s.accessModes, mode];
    return { accessModes: next.length > 0 ? next : s.accessModes };
  }),

  // ── 3. وضع قاعدة البيانات ─────────────────────────────────────────────────
  databaseMode: 'local-install',
  setDatabaseMode: (m) => set({ databaseMode: m }),

  // ── 4. دور الجهاز ─────────────────────────────────────────────────────────
  machineRole: 'main-server',
  setMachineRole: (r) => set({ machineRole: r }),

  // ── 5. طريقة الاتصال ──────────────────────────────────────────────────────
  connectivityMode: 'always-online',
  setConnectivityMode: (c) => set({ connectivityMode: c }),

  // ── 6. نوع الترخيص — افتراضي: تجريبي ─────────────────────────────────────
  licensingMode: 'trial',
  setLicensingMode: (l) => set({ licensingMode: l }),

  // ── 7. قناة التحديث — افتراضي: مستقر ─────────────────────────────────────
  updateChannel: 'stable',
  setUpdateChannel: (ch) => set({ updateChannel: ch }),

  // ── 8. سياسة النسخ الاحتياطي ──────────────────────────────────────────────
  backupPolicy: {
    frequency:  'daily',
    locations:  ['local'],
    retainDays: 30,
    path:       undefined,
  },
  setBackupFrequency: (f) => set(s => ({
    backupPolicy: { ...s.backupPolicy, frequency: f },
  })),
  toggleBackupLocation: (loc) => set(s => {
    const locs = s.backupPolicy.locations;
    const next = locs.includes(loc)
      ? locs.filter(l => l !== loc)
      : [...locs, loc];
    return { backupPolicy: { ...s.backupPolicy, locations: next.length > 0 ? next : locs } };
  }),
  setBackupRetainDays: (days) => set(s => ({
    backupPolicy: { ...s.backupPolicy, retainDays: days },
  })),
  setBackupPath: (p) => set(s => ({
    backupPolicy: { ...s.backupPolicy, path: p },
  })),

  // ── 9. إعدادات التشخيص — كلها معطلة افتراضياً (Opt-In) ────────────────────
  telemetry: {
    crashReports:    false,
    diagnosticLogs:  false,
    usageStatistics: false,
  },
  setTelemetry: (t) => set(s => ({ telemetry: { ...s.telemetry, ...t } })),

  // Database
  dbOpts: {
    host: 'localhost', port: 5432,
    database: 'onesoft_erp', user: 'postgres', password: '',
  },
  setDbOpts: (opts) => set(s => ({ dbOpts: { ...s.dbOpts, ...opts } })),

  // Organization
  organization: {
    code: '1001', name: '', nameEn: '',
    country: 'SA', currency: 'SAR', language: 'ar',
    timezone: 'Asia/Riyadh', taxNumber: '',
  },
  setOrganization: (o) => set(s => ({ organization: { ...s.organization, ...o } })),

  // First user
  firstUser: { fullName: '', username: 'admin', password: '' },
  setFirstUser: (u) => set(s => ({ firstUser: { ...s.firstUser, ...u } })),

  requirementsReport: null,
  setRequirementsReport: (r) => set({ requirementsReport: r }),

  healthReport: null,
  setHealthReport: (r) => set({ healthReport: r }),

  dbConfigVerified: false,
  setDbConfigVerified: (v) => set({ dbConfigVerified: v }),

  connectToExisting: false,
  setConnectToExisting: (v) => set({ connectToExisting: v }),
  existingDbInfo: null,
  setExistingDbInfo: (info) => set({ existingDbInfo: info }),

  installRunning: false,
  installDone:    false,
  setInstallRunning: (v) => set({ installRunning: v }),
  setInstallDone:    (v) => set({ installDone: v }),
  installedPort: 3000,
  setInstalledPort: (p) => set({ installedPort: p }),

  orgId: null,
  setOrgId: (id) => set({ orgId: id }),

  orgCode: null,
  setOrgCode: (c) => set({ orgCode: c }),

  progressLog: [],
  addProgress:   (e) => set(s => ({ progressLog: [...s.progressLog, e] })),
  clearProgress: ()  => set({ progressLog: [] }),

  getDatabaseUrl: () => {
    const { dbOpts } = get();
    return `postgresql://${dbOpts.user}:${encodeURIComponent(dbOpts.password)}@${dbOpts.host}:${dbOpts.port}/${dbOpts.database}`;
  },

  config: {},
  setConfig: (c) => set(s => ({ config: { ...s.config, ...c } })),
}));
