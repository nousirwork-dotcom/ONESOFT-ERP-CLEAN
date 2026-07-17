import React, { useState } from 'react';
import { Modal } from '../components/Modal';
import { usePOSCatalog } from '../catalog-context';
import { providerRegistry } from './registry';
import type {
  IntegrationConnection,
  IntegrationConnectionSettings,
  IntegrationProviderMeta,
} from './types';

const STEPS = ['بيانات التطبيق', 'الاتصال', 'إعداد الطلبات', 'ربط الأصناف'] as const;

const PAYMENT_METHODS = ['نقدي', 'شبكة', 'تحويل', 'آجل', 'حسب طلب المنصة'];
const CANCEL_OPTIONS = [
  { value: 'auto_cancel', label: 'إلغاء تلقائي' },
  { value: 'notify_only', label: 'إشعار فقط' },
  { value: 'manual', label: 'يدوي (الكاشير يقرر)' },
];

const CUSTOM_META: IntegrationProviderMeta = {
  id: 'custom',
  name: 'مزود مخصص',
  category: 'custom',
  logoInitial: '⚙',
  logoColor: '#6b7a8d',
  accentColor: '#6b7a8d',
  description: 'ربط أي منصة خارجية باستخدام Adapter مستقل يُنشئه المطور.',
  isBuiltIn: false,
  credentialFields: [
    { key: 'endpoint', label: 'عنوان API', type: 'url', required: false, adminOnly: true, placeholder: 'https://api.example.com/v1' },
    { key: 'apiKey', label: 'مفتاح API', type: 'password', required: false, adminOnly: true },
    { key: 'notes', label: 'ملاحظات للمطور', type: 'text', required: false, placeholder: 'مثال: راجع docs/my-adapter.md' },
  ],
};

/**
 * ربط الأصناف يعمل بالاتجاه الداخلي → خارجي:
 * يُعرض كتالوج OneSoft، ويُدخل المستخدم اسم الصنف كما ظهر على منصة التوصيل.
 * عند وصول طلب، يبحث النظام عن externalName ليجد الصنف المقابل.
 */
interface ProductMappingEntry {
  productId: number;
  productCode: string;
  productName: string;
  productPrice: number;
  externalName: string;
  externalCode: string;
  available: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConnected: (connection: IntegrationConnection) => void;
}

export function AddIntegrationWizard({ open, onClose, onConnected }: Props) {
  const { warehouses, journals, customers, products } = usePOSCatalog();

  const [step, setStep] = useState(0);
  const [selectedMeta, setSelectedMeta] = useState<IntegrationProviderMeta | null>(null);

  const [customName, setCustomName] = useState('');
  const [customShortName, setCustomShortName] = useState('');
  const [customInitial, setCustomInitial] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customActive, setCustomActive] = useState(true);

  const [settings, setSettings] = useState<IntegrationConnectionSettings>({
    branchName: '',
    posName: '',
    warehouseId: null,
    journalId: null,
    defaultCustomerId: null,
    defaultPaymentMethod: 'حسب طلب المنصة',
    autoAccept: false,
    autoSendToKitchen: true,
    cancelHandling: 'notify_only',
    soundAlert: true,
    arrivalNotification: true,
  });

  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [mappingSearch, setMappingSearch] = useState('');
  const [mappingFilter, setMappingFilter] = useState<'all' | 'mapped' | 'unmapped'>('all');
  const [mappings, setMappings] = useState<ProductMappingEntry[]>([]);
  const [editRow, setEditRow] = useState<number | null>(null);

  const registeredMetas = providerRegistry.listMeta();
  const allProviderOptions = [...registeredMetas, CUSTOM_META];

  const activeMeta = selectedMeta;
  const isCustom = activeMeta?.id === 'custom';
  const credentialFields = activeMeta?.credentialFields ?? [];
  const adminFields = credentialFields.filter((f) => f.adminOnly);
  const publicFields = credentialFields.filter((f) => !f.adminOnly);

  const unmappedCount = mappings.filter((m) => m.externalName.trim() === '').length;

  const filteredMappings = mappings.filter((m) => {
    const matchesSearch =
      !mappingSearch ||
      m.productName.toLowerCase().includes(mappingSearch.toLowerCase()) ||
      m.productCode.toLowerCase().includes(mappingSearch.toLowerCase()) ||
      m.externalName.toLowerCase().includes(mappingSearch.toLowerCase());
    const matchesFilter =
      mappingFilter === 'all' ||
      (mappingFilter === 'mapped' && m.externalName.trim() !== '') ||
      (mappingFilter === 'unmapped' && m.externalName.trim() === '');
    return matchesSearch && matchesFilter;
  });

  const handleEnterMappingStep = () => {
    setMappings(
      products.map((p) => ({
        productId: p.id,
        productCode: p.code,
        productName: p.name,
        productPrice: p.salePrice,
        externalName: '',
        externalCode: '',
        available: true,
      })),
    );
    setMappingSearch('');
    setMappingFilter('all');
    setEditRow(null);
    setStep(3);
  };

  const handleAutoMatch = () => {
    setMappings((prev) =>
      prev.map((m) => ({
        ...m,
        externalName: m.externalName.trim() === '' ? m.productName : m.externalName,
        externalCode: m.externalCode.trim() === '' ? m.productCode : m.externalCode,
      })),
    );
  };

  const handleRemoveMapping = (productId: number) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.productId === productId ? { ...m, externalName: '', externalCode: '' } : m,
      ),
    );
  };

  const handleReset = () => {
    setStep(0);
    setSelectedMeta(null);
    setCustomName('');
    setCustomShortName('');
    setCustomInitial('');
    setCustomDesc('');
    setCustomActive(true);
    setSettings({
      branchName: '',
      posName: '',
      warehouseId: null,
      journalId: null,
      defaultCustomerId: null,
      defaultPaymentMethod: 'حسب طلب المنصة',
      autoAccept: false,
      autoSendToKitchen: true,
      cancelHandling: 'notify_only',
      soundAlert: true,
      arrivalNotification: true,
    });
    setCredentials({});
    setAdvancedOpen(false);
    setTesting(false);
    setTestResult(null);
    setMappings([]);
    setMappingSearch('');
    setMappingFilter('all');
    setEditRow(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleTest = async () => {
    if (!activeMeta) return;
    setTesting(true);
    setTestResult(null);
    try {
      const adapter = providerRegistry.get(activeMeta.id);
      let result: { success: boolean; message: string };
      if (adapter) {
        result = await adapter.testConnection(credentials);
      } else {
        await new Promise((r) => setTimeout(r, 600));
        result = { success: true, message: 'تم إضافة التكامل المخصص. يتطلب تنفيذ Adapter من المطور.' };
      }
      setTestResult(result);
    } catch (err: unknown) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : 'خطأ غير متوقع' });
    } finally {
      setTesting(false);
    }
  };

  const handleConfirm = () => {
    if (!activeMeta) return;
    const providerName = isCustom && customName ? customName : activeMeta.name;
    const mapped = mappings.filter((m) => m.externalName.trim() !== '').length;
    const conn: IntegrationConnection = {
      id: `conn-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      providerId: isCustom ? `custom-${Date.now()}` : activeMeta.id,
      providerName,
      status: testResult?.success ? 'connected' : 'disconnected',
      enabled: isCustom ? customActive : (testResult?.success ?? false),
      lastSyncAt: testResult?.success ? new Date().toISOString() : null,
      lastSyncStatus: testResult?.success ? 'success' : 'never',
      credentials,
      settings,
      unmappedProductCount: mappings.length - mapped,
      createdAt: new Date().toISOString(),
    };
    onConnected(conn);
    handleReset();
  };

  const logoInitial = activeMeta ? (isCustom && customInitial ? customInitial : activeMeta.logoInitial) : '?';
  const logoColor = activeMeta?.logoColor ?? '#6b7a8d';

  return (
    <Modal open={open} title="إضافة تكامل جديد" onClose={handleClose} width={720}>
      <div className="pos-wizard">
        <div className="pos-wizard-progress">
          {STEPS.map((label, index) => (
            <div
              key={label}
              className={`pos-wizard-step ${index === step ? 'is-active' : ''} ${index < step ? 'is-done' : ''}`}
            >
              <span>{index < step ? '✓' : index + 1}</span>
              <small>{label}</small>
            </div>
          ))}
        </div>

        {/* ─── Step 0: بيانات التطبيق ──────────────────────────────────── */}
        {step === 0 && (
          <div>
            <p style={{ color: 'var(--pos-muted)', marginTop: 0, marginBottom: 16, fontSize: 13 }}>
              اختر مزوداً جاهزاً، أو أضف مزوداً مخصصاً باستخدام Adapter مستقل.
            </p>
            <div className="pos-provider-picker">
              {allProviderOptions.map((meta) => (
                <button
                  key={meta.id}
                  type="button"
                  className={`pos-provider-option${selectedMeta?.id === meta.id ? ' is-selected' : ''}`}
                  style={{ borderTopColor: meta.accentColor }}
                  onClick={() => {
                    setSelectedMeta(meta);
                    if (meta.id !== 'custom') setStep(1);
                  }}
                >
                  <div className="pos-provider-option__logo" style={{ background: meta.logoColor }}>
                    {meta.logoInitial}
                  </div>
                  <div>
                    <strong>{meta.name}</strong>
                    {meta.nameEn && <em>{meta.nameEn}</em>}
                    <span>{meta.description}</span>
                  </div>
                  {meta.isBuiltIn && <div className="pos-provider-option__badge">جاهز</div>}
                </button>
              ))}
            </div>

            {selectedMeta?.id === 'custom' && (
              <div style={{ marginTop: 20, padding: 16, background: '#f8fafc', borderRadius: 12, border: '1px solid var(--pos-border)' }}>
                <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: 'var(--pos-text)' }}>بيانات المزود المخصص</p>
                <div className="pos-form-grid">
                  <label>
                    <span>اسم التطبيق</span>
                    <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="مثال: طلبات داخلية" />
                  </label>
                  <label>
                    <span>الاسم المختصر</span>
                    <input value={customShortName} onChange={(e) => setCustomShortName(e.target.value)} placeholder="مثال: INT-01" />
                  </label>
                  <label>
                    <span>رمز الشعار (حرف أو رمز)</span>
                    <input value={customInitial} maxLength={2} onChange={(e) => setCustomInitial(e.target.value)} placeholder="م" />
                  </label>
                  <label>
                    <span>وصف مختصر</span>
                    <input value={customDesc} onChange={(e) => setCustomDesc(e.target.value)} placeholder="وصف المزود" />
                  </label>
                </div>
                <div style={{ marginTop: 12 }}>
                  <label className="pos-toggle">
                    <input type="checkbox" checked={customActive} onChange={(e) => setCustomActive(e.target.checked)} />
                    <i />
                    <span>تفعيل التكامل فور الإضافة</span>
                  </label>
                </div>
                <div className="pos-wizard-footer" style={{ marginTop: 0 }}>
                  <button type="button" className="pos-button pos-button--primary" onClick={() => setStep(1)} disabled={!customName.trim()}>
                    التالي →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Step 1: الاتصال ─────────────────────────────────────────── */}
        {step === 1 && activeMeta && (
          <div>
            <div className="pos-wizard-provider-info">
              <div className="pos-hub-card__logo" style={{ background: logoColor, width: 48, height: 48, borderRadius: 14 }}>
                {logoInitial}
              </div>
              <div>
                <strong>{isCustom && customName ? customName : activeMeta.name}</strong>
                <span style={{ color: 'var(--pos-muted)', fontSize: 12 }}>إعدادات الاتصال</span>
              </div>
              <div className="pos-hub-card__status" style={{ marginRight: 'auto' }}>
                <span
                  className={`pos-hub-status-dot ${testResult ? (testResult.success ? 'is-connected' : 'is-error') : 'is-disconnected'}`}
                />
                <span style={{ fontSize: 12 }}>
                  {testResult ? (testResult.success ? 'متصل' : 'فشل الاتصال') : 'لم يُختبر بعد'}
                </span>
              </div>
            </div>

            {publicFields.length > 0 && (
              <div className="pos-form-grid" style={{ marginBottom: 14 }}>
                {publicFields.map((field) => (
                  <label key={field.key}>
                    <span>{field.label}{field.required && <strong style={{ color: 'var(--pos-red)', marginRight: 4 }}>*</strong>}</span>
                    {field.type === 'select' ? (
                      <select value={credentials[field.key] ?? ''} onChange={(e) => setCredentials((c) => ({ ...c, [field.key]: e.target.value }))}>
                        <option value="">— اختر —</option>
                        {(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input type={field.type} value={credentials[field.key] ?? ''} onChange={(e) => setCredentials((c) => ({ ...c, [field.key]: e.target.value }))} placeholder={field.placeholder} />
                    )}
                    {field.helpText && <small style={{ color: 'var(--pos-muted)' }}>{field.helpText}</small>}
                  </label>
                ))}
              </div>
            )}

            <button
              type="button"
              className="pos-button pos-button--secondary"
              style={{ width: '100%', marginBottom: 12 }}
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? '⏳ جارٍ اختبار الاتصال...' : '⚡ اختبار الاتصال'}
            </button>

            {testResult && (
              <div className={testResult.success ? 'pos-success-box' : 'pos-warning-box'} style={{ marginBottom: 14 }}>
                {testResult.success ? '✓ ' : '⚠ '}{testResult.message}
              </div>
            )}

            {adminFields.length > 0 && (
              <div className="pos-collapsible">
                <button
                  type="button"
                  className="pos-collapsible__trigger"
                  onClick={() => setAdvancedOpen((v) => !v)}
                >
                  <span>🔒 إعدادات متقدمة (صلاحية المدير)</span>
                  <span>{advancedOpen ? '▲' : '▼'}</span>
                </button>
                {advancedOpen && (
                  <div className="pos-collapsible__body">
                    <div className="pos-wizard-admin-notice">هذه الحقول تتطلب صلاحية مدير النظام — لا تشاركها مع موظفي الكاشير.</div>
                    <div className="pos-form-grid">
                      {adminFields.map((field) => (
                        <label key={field.key}>
                          <span>
                            {field.label}
                            {field.required && <strong style={{ color: 'var(--pos-red)', marginRight: 4 }}>*</strong>}
                            <em style={{ color: 'var(--pos-muted)', fontSize: 10, marginRight: 6 }}>(مدير)</em>
                          </span>
                          <input
                            type={field.type === 'select' ? 'text' : field.type}
                            value={credentials[field.key] ?? ''}
                            onChange={(e) => setCredentials((c) => ({ ...c, [field.key]: e.target.value }))}
                            placeholder={field.placeholder}
                          />
                          {field.helpText && <small style={{ color: 'var(--pos-muted)' }}>{field.helpText}</small>}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="pos-wizard-footer">
              <button type="button" className="pos-button pos-button--secondary" onClick={() => setStep(0)}>← رجوع</button>
              <button type="button" className="pos-button pos-button--primary" onClick={() => setStep(2)}>التالي →</button>
            </div>
          </div>
        )}

        {/* ─── Step 2: إعداد الطلبات ───────────────────────────────────── */}
        {step === 2 && activeMeta && (
          <div>
            <div className="pos-wizard-provider-info">
              <div className="pos-hub-card__logo" style={{ background: logoColor, width: 40, height: 40, borderRadius: 12 }}>{logoInitial}</div>
              <div>
                <strong>{isCustom && customName ? customName : activeMeta.name}</strong>
                <span style={{ color: 'var(--pos-muted)', fontSize: 12 }}>إعدادات الطلبات التشغيلية</span>
              </div>
            </div>

            <div className="pos-form-grid">
              <label>
                <span>اسم الفرع</span>
                <input value={settings.branchName ?? ''} onChange={(e) => setSettings((s) => ({ ...s, branchName: e.target.value }))} placeholder="مثال: فرع الرياض" />
              </label>
              <label>
                <span>نقطة البيع</span>
                <input value={settings.posName ?? ''} onChange={(e) => setSettings((s) => ({ ...s, posName: e.target.value }))} placeholder="مثال: كاشير 1" />
              </label>
              <label>
                <span>المستودع</span>
                <select value={settings.warehouseId ?? ''} onChange={(e) => setSettings((s) => ({ ...s, warehouseId: Number(e.target.value) || null }))}>
                  <option value="">— اختر مستودع —</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
                </select>
              </label>
              <label>
                <span>دفتر المبيعات</span>
                <select value={settings.journalId ?? ''} onChange={(e) => setSettings((s) => ({ ...s, journalId: Number(e.target.value) || null }))}>
                  <option value="">— اختر دفتر مبيعات —</option>
                  {journals.map((j) => <option key={j.id} value={j.id}>{j.code} — {j.name}</option>)}
                </select>
              </label>
              <label>
                <span>العميل الافتراضي</span>
                <select value={settings.defaultCustomerId ?? ''} onChange={(e) => setSettings((s) => ({ ...s, defaultCustomerId: Number(e.target.value) || null }))}>
                  <option value="">— اختر عميل افتراضي —</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                </select>
              </label>
              <label>
                <span>طريقة السداد الافتراضية</span>
                <select value={settings.defaultPaymentMethod ?? ''} onChange={(e) => setSettings((s) => ({ ...s, defaultPaymentMethod: e.target.value }))}>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label>
                <span>التعامل مع الإلغاء</span>
                <select value={settings.cancelHandling ?? 'notify_only'} onChange={(e) => setSettings((s) => ({ ...s, cancelHandling: e.target.value as 'auto_cancel' | 'notify_only' | 'manual' }))}>
                  {CANCEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            </div>

            <div className="pos-toggle-list" style={{ marginTop: 14 }}>
              <label className="pos-toggle">
                <input type="checkbox" checked={settings.autoAccept} onChange={(e) => setSettings((s) => ({ ...s, autoAccept: e.target.checked }))} />
                <i /><span>قبول تلقائي للطلبات</span>
              </label>
              <label className="pos-toggle">
                <input type="checkbox" checked={settings.autoSendToKitchen} onChange={(e) => setSettings((s) => ({ ...s, autoSendToKitchen: e.target.checked }))} />
                <i /><span>إرسال تلقائي للمطبخ بعد القبول</span>
              </label>
              <label className="pos-toggle">
                <input type="checkbox" checked={settings.soundAlert ?? true} onChange={(e) => setSettings((s) => ({ ...s, soundAlert: e.target.checked }))} />
                <i /><span>تنبيه صوتي عند وصول طلب جديد</span>
              </label>
              <label className="pos-toggle">
                <input type="checkbox" checked={settings.arrivalNotification ?? true} onChange={(e) => setSettings((s) => ({ ...s, arrivalNotification: e.target.checked }))} />
                <i /><span>إظهار إشعار عند وصول طلب جديد</span>
              </label>
            </div>

            <div className="pos-wizard-footer">
              <button type="button" className="pos-button pos-button--secondary" onClick={() => setStep(1)}>← رجوع</button>
              <button type="button" className="pos-button pos-button--primary" onClick={handleEnterMappingStep}>التالي →</button>
            </div>
          </div>
        )}

        {/* ─── Step 3: ربط الأصناف ─────────────────────────────────────── */}
        {step === 3 && activeMeta && (
          <div>
            <div className="pos-wizard-provider-info">
              <div className="pos-hub-card__logo" style={{ background: logoColor, width: 40, height: 40, borderRadius: 12 }}>{logoInitial}</div>
              <div style={{ flex: 1 }}>
                <strong>{isCustom && customName ? customName : activeMeta.name}</strong>
                <span style={{ color: 'var(--pos-muted)', fontSize: 12 }}>حدّد اسم كل صنف كما يظهر على منصة التوصيل</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {unmappedCount > 0 && (
                  <span className="pos-badge pos-badge--warning">{unmappedCount} غير مربوط</span>
                )}
                <button
                  type="button"
                  className="pos-button pos-button--secondary"
                  style={{ minHeight: 36, fontSize: 12 }}
                  onClick={handleAutoMatch}
                  disabled={mappings.length === 0}
                >
                  مطابقة تلقائية
                </button>
              </div>
            </div>

            <div className="pos-mapping-toolbar">
              <input
                className="pos-mapping-search"
                placeholder="بحث في الأصناف..."
                value={mappingSearch}
                onChange={(e) => setMappingSearch(e.target.value)}
              />
              <div className="pos-segmented" style={{ flexShrink: 0 }}>
                {(['all', 'mapped', 'unmapped'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={mappingFilter === f ? 'is-active' : ''}
                    onClick={() => setMappingFilter(f)}
                  >
                    {f === 'all' ? `الكل (${mappings.length})` : f === 'mapped' ? 'مربوط' : 'غير مربوط'}
                  </button>
                ))}
              </div>
            </div>

            {products.length === 0 ? (
              <div className="pos-empty-state" style={{ minHeight: 140 }}>
                <span style={{ fontSize: 32 }}>📦</span>
                <strong>لا توجد أصناف في الكتالوج</strong>
                <span style={{ fontSize: 12 }}>أضف أصناف في الكتالوج أولاً، ثم عُد للربط.</span>
              </div>
            ) : filteredMappings.length === 0 ? (
              <div className="pos-empty-state" style={{ minHeight: 100 }}>
                <strong>لا توجد نتائج</strong>
                <span>جرّب تغيير الفلتر أو كلمة البحث.</span>
              </div>
            ) : (
              <div className="pos-mapping-table-wrap">
                <table className="pos-mapping-table">
                  <thead>
                    <tr>
                      <th>كود OneSoft</th>
                      <th>اسم الصنف (داخلي)</th>
                      <th>السعر</th>
                      <th>الاسم على المنصة</th>
                      <th>توفر</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMappings.map((m) => (
                      <tr key={m.productId} className={m.externalName.trim() === '' ? 'is-unmapped' : ''}>
                        <td><code>{m.productCode}</code></td>
                        <td style={{ fontWeight: 600 }}>{m.productName}</td>
                        <td style={{ color: 'var(--pos-muted)', fontSize: 12 }}>{m.productPrice.toFixed(2)} ر.س</td>
                        <td>
                          {editRow === m.productId ? (
                            <input
                              autoFocus
                              style={{ width: '100%', minHeight: 34, border: '1px solid var(--pos-blue)', borderRadius: 8, padding: '0 8px', font: 'inherit', fontSize: 12, outline: 'none' }}
                              value={m.externalName}
                              placeholder="اسم الصنف على المنصة..."
                              onChange={(e) =>
                                setMappings((prev) =>
                                  prev.map((x) =>
                                    x.productId === m.productId ? { ...x, externalName: e.target.value } : x,
                                  ),
                                )
                              }
                              onBlur={() => setEditRow(null)}
                              onKeyDown={(e) => { if (e.key === 'Enter') setEditRow(null); }}
                            />
                          ) : (
                            <button
                              type="button"
                              style={{
                                background: 'none', border: m.externalName ? '1px solid var(--pos-border)' : '1px dashed #ccc',
                                borderRadius: 8, padding: '4px 10px', width: '100%', textAlign: 'right', cursor: 'text',
                                color: m.externalName ? 'var(--pos-text)' : 'var(--pos-muted)', fontSize: 12, minHeight: 32
                              }}
                              onClick={() => setEditRow(m.productId)}
                            >
                              {m.externalName || '— انقر للإدخال —'}
                            </button>
                          )}
                        </td>
                        <td>
                          <label className="pos-toggle" style={{ minHeight: 32, padding: '0 8px', border: 'none', justifyContent: 'center' }}>
                            <input
                              type="checkbox"
                              checked={m.available}
                              onChange={(e) =>
                                setMappings((prev) =>
                                  prev.map((x) => x.productId === m.productId ? { ...x, available: e.target.checked } : x)
                                )
                              }
                            />
                            <i />
                          </label>
                        </td>
                        <td>
                          {m.externalName.trim() !== '' && (
                            <button
                              type="button"
                              className="pos-button pos-button--danger"
                              style={{ minHeight: 30, padding: '0 10px', fontSize: 11 }}
                              onClick={() => handleRemoveMapping(m.productId)}
                            >
                              إزالة
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {unmappedCount > 0 && products.length > 0 && (
              <div className="pos-warning-box" style={{ margin: '12px 0 0' }}>
                ⚠ {unmappedCount} أصناف لم يُحدَّد لها اسم على المنصة — الطلبات التي تحتويها ستُصنَّف "يحتاج مراجعة".
              </div>
            )}

            <div className="pos-wizard-footer">
              <button type="button" className="pos-button pos-button--secondary" onClick={() => setStep(2)}>← رجوع</button>
              {unmappedCount > 0 && products.length > 0 ? (
                <button type="button" className="pos-button pos-button--secondary" onClick={handleConfirm}>
                  حفظ مع تجاوز التحذير ({unmappedCount} غير مربوط)
                </button>
              ) : (
                <button type="button" className="pos-button pos-button--primary" onClick={handleConfirm}>
                  {products.length === 0 ? 'تخطي والحفظ' : 'تأكيد الربط ✓'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
