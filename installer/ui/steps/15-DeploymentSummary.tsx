import { useInstallerStore } from '../store/installer.store';

// ── جداول التسميات ─────────────────────────────────────────────────────────────
const DEPLOY_LABELS: Record<string, string>  = {
  'server':        'سيرفر رئيسي',
  'client':        'عميل',
  'server+client': 'سيرفر + عميل',
  'branch':        'فرع',
  'cloud':         'سحابي',
};
const ACCESS_LABELS: Record<string, string>  = {
  desktop: '🖥️ سطح المكتب',
  web:     '🌐 متصفح',
  offline: '📴 أوفلاين',
};
const DB_LABELS: Record<string, string>  = {
  'local-install':  '📦 تثبيت جديد',
  'local-existing': '🔍 موجود محلياً',
  'remote':         '🌐 بعيد (Remote)',
  'cloud':          '☁️ سحابي',
};
const ROLE_LABELS: Record<string, string>  = {
  'main-server':        '🏢 سيرفر رئيسي',
  'branch-server':      '🌿 سيرفر فرع',
  'client-workstation': '💻 محطة عمل',
  'mobile-workstation': '📱 محمول',
};
const CONN_LABELS: Record<string, string>  = {
  'always-online':  '🌍 متصل دائماً',
  'offline-first':  '📴 أوفلاين أولاً',
  'lan-only':       '🔗 شبكة محلية فقط',
  'internet+lan':   '🔀 إنترنت + شبكة محلية',
};
const LIC_LABELS: Record<string, string>  = {
  'trial':               '🧪 تجريبي',
  'standard':            '⭐ أساسي',
  'professional':        '💼 احترافي',
  'enterprise':          '🏢 مؤسسي',
  'cloud-subscription':  '☁️ اشتراك سحابي',
};
const UPD_LABELS: Record<string, string>  = {
  'stable':           '🟢 مستقر',
  'beta':             '🟡 تجريبي',
  'internal-testing': '🔴 اختبار داخلي',
};
const BKP_FREQ_LABELS: Record<string, string>  = {
  disabled: '🚫 معطّل',
  daily:    '📅 يومي',
  weekly:   '🗓️ أسبوعي',
  monthly:  '📆 شهري',
};
const BKP_LOC_LABELS: Record<string, string>  = {
  local:   '💾 محلي',
  network: '🔗 شبكة',
  cloud:   '☁️ سحابي',
};

interface SummaryRowProps {
  label: string;
  value: string;
  color?: string;
}

function SummaryRow({ label, value, color }: SummaryRowProps) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 12px',
      borderBottom: '1px solid #F1F5F9',
    }}>
      <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>{label}</span>
      <span style={{
        fontSize: 12, fontWeight: 700,
        color: color ?? '#1E344F',
        textAlign: 'left',
      }}>
        {value}
      </span>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      padding: '6px 12px', background: '#F8FAFC',
      fontSize: 11, fontWeight: 700, color: '#64748B',
      borderBottom: '1px solid #E2E8F0',
      letterSpacing: '0.05em',
    }}>
      {title}
    </div>
  );
}

export default function Step15DeploymentSummary() {
  const {
    deploymentType, accessModes, databaseMode, machineRole, connectivityMode,
    licensingMode, updateChannel, backupPolicy, telemetry,
    organization, firstUser, dbOpts,
  } = useInstallerStore();

  const telemetryList = [
    telemetry.crashReports    ? 'أعطال' : null,
    telemetry.diagnosticLogs  ? 'تشخيص' : null,
    telemetry.usageStatistics ? 'إحصاءات' : null,
  ].filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* العنوان */}
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E344F', margin: '0 0 4px' }}>
          📋 ملخص التثبيت
        </h2>
        <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>
          راجع جميع الإعدادات قبل بدء التثبيت — يمكنك العودة لأي خطوة للتعديل
        </p>
      </div>

      {/* البطاقة الرئيسية */}
      <div style={{
        background: '#fff', borderRadius: 12,
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>

        {/* ── قسم 1: البنية المعمارية ── */}
        <SectionHeader title="⚙️ البنية المعمارية" />
        <SummaryRow label="نوع التثبيت"      value={DEPLOY_LABELS[deploymentType] ?? deploymentType} />
        <SummaryRow label="طرق الاستخدام"    value={accessModes.map(m => ACCESS_LABELS[m]).join(' + ')} />
        <SummaryRow label="قاعدة البيانات"   value={DB_LABELS[databaseMode] ?? databaseMode} />
        <SummaryRow label="دور الجهاز"        value={ROLE_LABELS[machineRole] ?? machineRole} />
        <SummaryRow label="الاتصال بالشبكة"  value={CONN_LABELS[connectivityMode] ?? connectivityMode} />

        {/* ── قسم 2: الترخيص والتحديثات ── */}
        <SectionHeader title="🔑 الترخيص والتحديثات" />
        <SummaryRow label="نوع الترخيص"   value={LIC_LABELS[licensingMode] ?? licensingMode} color="#1D4ED8" />
        <SummaryRow label="قناة التحديث"  value={UPD_LABELS[updateChannel] ?? updateChannel} />

        {/* ── قسم 3: النسخ الاحتياطي ── */}
        <SectionHeader title="💾 النسخ الاحتياطي" />
        <SummaryRow
          label="التكرار"
          value={BKP_FREQ_LABELS[backupPolicy.frequency] ?? backupPolicy.frequency}
          color={backupPolicy.frequency === 'disabled' ? '#9CA3AF' : undefined}
        />
        {backupPolicy.frequency !== 'disabled' && (
          <>
            <SummaryRow
              label="وجهات التخزين"
              value={backupPolicy.locations.map(l => BKP_LOC_LABELS[l]).join(' + ')}
            />
            <SummaryRow label="الاحتفاظ"  value={`${backupPolicy.retainDays} يوماً`} />
          </>
        )}

        {/* ── قسم 4: الخصوصية ── */}
        <SectionHeader title="🔒 الخصوصية والتشخيص" />
        <SummaryRow
          label="البيانات المُشارَكة"
          value={telemetryList.length > 0 ? telemetryList.join(' + ') : '🔒 لا شيء (خصوصية كاملة)'}
          color={telemetryList.length > 0 ? '#15803D' : '#9CA3AF'}
        />

        {/* ── قسم 5: قاعدة البيانات ── */}
        <SectionHeader title="🗄️ اتصال قاعدة البيانات" />
        <SummaryRow label="السيرفر"   value={`${dbOpts.host}:${dbOpts.port}`} />
        <SummaryRow label="قاعدة البيانات" value={dbOpts.database} />
        <SummaryRow label="المستخدم"  value={dbOpts.user} />

        {/* ── قسم 6: المؤسسة والمستخدم ── */}
        <SectionHeader title="🏢 المؤسسة والمستخدم الأول" />
        <SummaryRow label="اسم المؤسسة"        value={organization.name || '—'} />
        <SummaryRow label="الدولة / العملة"    value={`${organization.country} / ${organization.currency}`} />
        <SummaryRow label="اسم المستخدم الأول" value={firstUser.username} />
        <SummaryRow label="الاسم الكامل"       value={firstUser.fullName || '—'} />
      </div>

      {/* تحذير إذا كانت بيانات المؤسسة غير مكتملة */}
      {!organization.name && (
        <div style={{
          padding: '9px 14px', background: '#FFFBEB', borderRadius: 8,
          fontSize: 12, color: '#92400E', border: '1px solid #FCD34D',
        }}>
          ⚠️ اسم المؤسسة فارغ — سيُطلب منك إدخاله في الخطوة التالية
        </div>
      )}

    </div>
  );
}

const btnSecondary: React.CSSProperties = {
  background: '#fff', color: '#6B7280', border: '1px solid #D1D5DB',
  borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
};
