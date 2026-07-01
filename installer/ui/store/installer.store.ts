import { create } from 'zustand';
import type {
  DeploymentType, AccessMode,
  DatabaseConnectionOptions,
  OrganizationSetup, FirstUserSetup,
  RequirementsReport, HealthReport, ProgressEvent, OneSoftConfig,
} from '../../core/types';

interface InstallerStore {
  // Navigation
  currentStep: number;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;

  // Wizard data
  acceptedLicense: boolean;
  setAcceptedLicense: (v: boolean) => void;

  // ── نوع التثبيت (ما يُثبَّت على الجهاز) ────────────────────────────────
  deploymentType: DeploymentType;
  setDeploymentType: (t: DeploymentType) => void;

  // ── طرق الاستخدام (كيف يصل المستخدمون — متعددة) ──────────────────────
  accessModes: AccessMode[];
  setAccessModes: (modes: AccessMode[]) => void;
  toggleAccessMode: (mode: AccessMode) => void;

  // Database
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

  orgId: number | null;
  setOrgId: (id: number) => void;

  orgCode: string | null;
  setOrgCode: (c: string) => void;

  // Progress log
  progressLog: ProgressEvent[];
  addProgress: (e: ProgressEvent) => void;
  clearProgress: () => void;

  // Derived: database URL
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

  // ── نوع التثبيت — الافتراضي: server+client (مناسب لأغلب الحالات) ──────
  deploymentType: 'server+client',
  setDeploymentType: (t) => set({ deploymentType: t }),

  // ── طرق الاستخدام — الافتراضي: Desktop + Web ─────────────────────────
  accessModes: ['desktop', 'web'],
  setAccessModes: (modes) => set({ accessModes: modes }),
  toggleAccessMode: (mode) => set(s => {
    const current = s.accessModes;
    const next = current.includes(mode)
      ? current.filter(m => m !== mode)
      : [...current, mode];
    // يجب أن يبقى اختيار واحد على الأقل
    return { accessModes: next.length > 0 ? next : current };
  }),

  dbOpts: {
    host:     'localhost',
    port:     5432,
    database: 'onesoft_erp',
    user:     'postgres',
    password: '',
  },
  setDbOpts: (opts) => set(s => ({ dbOpts: { ...s.dbOpts, ...opts } })),

  organization: {
    code:     '1001',
    name:     '',
    nameEn:   '',
    country:  'SA',
    currency: 'SAR',
    language: 'ar',
    timezone: 'Asia/Riyadh',
    taxNumber:'',
  },
  setOrganization: (o) => set(s => ({ organization: { ...s.organization, ...o } })),

  firstUser: {
    fullName: '',
    username: 'admin',
    password: '',
  },
  setFirstUser: (u) => set(s => ({ firstUser: { ...s.firstUser, ...u } })),

  requirementsReport: null,
  setRequirementsReport: (r) => set({ requirementsReport: r }),

  healthReport: null,
  setHealthReport: (r) => set({ healthReport: r }),

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
