import React, { useState } from 'react';
import { Modal } from '../components/Modal';
import { usePOSCatalog } from '../catalog-context';
import { providerRegistry } from './registry';
import type {
  IntegrationConnection,
  IntegrationConnectionSettings,
  IntegrationProviderMeta,
  ProductMapping,
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
  const [productMappings, setProductMappings] = useState<ProductMapping[]>([]);
  const [mappingRow, setMappingRow] = useState<string | null>(null);

  const registeredMetas = providerRegistry.listMeta();
  const allProviderOptions = [...registeredMetas, CUSTOM_META];

  const activeMeta = selectedMeta;
  const isCustom = activeMeta?.id === 'custom';
  const credentialFields = activeMeta?.credentialFields ?? [];
  const adminFields = credentialFields.filter((f) => f.adminOnly);
  const publicFields = credentialFields.filter((f) => !f.adminOnly);

  const unmappedCount = productMappings.filter((m) => m.onesoftProductId === null).length;

  const filteredMappings = productMappings.filter((m) => {
    const matchesSearch =
      !mappingSearch ||
      m.externalProductName.includes(mappingSearch) ||
      m.externalProductCode.includes(mappingSearch);
    const matchesFilter =
      mappingFilter === 'all' ||
      (mappingFilter === 'mapped' && m.onesoftProductId !== null) ||
      (mappingFilter === 'unmapped' && m.onesoftProductId === null);
    return matchesSearch && matchesFilter;
  });

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
    setProductMappings([]);
    setMappingSearch('');
    setMappingFilter('all');
    setMappingRow(null);
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

  const handleAutoMatch = () => {
    setProductMappings((prev) =>
      prev.map((m) => {
        if (m.onesoftProductId !== null) return m;
        const match = products.find(
          (p) =>
            p.name.toLowerCase().includes(m.externalProductName.toLowerCase()) ||
            p.code.toLowerCase() === m.externalProductCode.toLowerCase(),
        );
        if (!match) return m;
        return {
          ...m,
          onesoftProductId: match.id,
          onesoftProductCode: match.code,
          onesoftProductName: match.name,
        };
      }),
    );
  };

  const handleSetMapping = (externalId: string, productId: number | null) => {
    const p = productId !== null ? products.find((x) => x.id === productId) : null;
    setProductMappings((prev) =>
      prev.map((m) =>
        m.externalProductId === externalId
          ? {
              ...m,
              onesoftProductId: productId,
              onesoftProductCode: p?.code,
              onesoftProductName: p?.name,
            }
          : m,
      ),
    );
    setMappingRow(null);
  };

  const handleConfirm = () => {
    if (!activeMeta) return;
    const providerName = isCustom && customName ? customName : activeMeta.name;
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
      unmappedProductCount: unmappedCount,
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
              <button type="button" className="pos-button pos-button--primary" onClick={() => setStep(3)}>التالي →</button>
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
                <span style={{ color: 'var(--pos-muted)', fontSize: 12 }}>ربط أصناف المنصة بأصناف OneSoft</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {unmappedCount > 0 && (
                  <span className="pos-badge pos-badge--warning">{unmappedCount} غير مربوط</span>
                )}
                <button type="button" className="pos-button pos-button--secondary" style={{ minHeight: 36, fontSize: 12 }} onClick={handleAutoMatch} disabled={productMappings.length === 0}>
                  مطابقة تلقائية
                </button>
              </div>
            </div>

            <div className="pos-mapping-toolbar">
              <input
                className="pos-mapping-search"
                placeholder="بحث في أصناف المنصة..."
                value={mappingSearch}
                onChange={(e) => setMappingSearch(e.target.value)}
                disabled={productMappings.length === 0}
              />
              <div className="pos-segmented" style={{ flexShrink: 0 }}>
                {(['all', 'mapped', 'unmapped'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={mappingFilter === f ? 'is-active' : ''}
                    onClick={() => setMappingFilter(f)}
                  >
                    {f === 'all' ? 'الكل' : f === 'mapped' ? 'مربوط' : 'غير مربوط'}
                  </button>
                ))}
              </div>
            </div>

            {productMappings.length === 0 ? (
              <div className="pos-empty-state" style={{ minHeight: 160 }}>
                <span style={{ fontSize: 32 }}>🔗</span>
                <strong>لا توجد أصناف للمطابقة</strong>
                <span style={{ fontSize: 12, maxWidth: 360 }}>
                  ستظهر أصناف المنصة هنا بعد تفعيل التكامل ومزامنة الكتالوج الأولى.
                  يمكنك تخطي هذه الخطوة الآن وإتمام الربط لاحقاً من "إدارة الربط".
                </span>
              </div>
            ) : filteredMappings.length === 0 ? (
              <div className="pos-empty-state" style={{ minHeight: 120 }}>
                <strong>لا توجد نتائج</strong>
                <span>جرّب تغيير الفلتر أو كلمة البحث.</span>
              </div>
            ) : (
              <div className="pos-mapping-table-wrap">
                <table className="pos-mapping-table">
                  <thead>
                    <tr>
                      <th>كود المنصة</th>
                      <th>اسم الصنف</th>
                      <th>سعر المنصة</th>
                      <th>صنف OneSoft</th>
                      <th>حالة التوفر</th>
                      <th>الربط</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMappings.map((m) => (
                      <tr key={m.externalProductId} className={m.onesoftProductId === null ? 'is-unmapped' : ''}>
                        <td><code>{m.externalProductCode}</code></td>
                        <td>{m.externalProductName}</td>
                        <td>{m.externalPrice.toFixed(2)} ر.س</td>
                        <td>
                          {mappingRow === m.externalProductId ? (
                            <select
                              autoFocus
                              value={m.onesoftProductId ?? ''}
                              onChange={(e) => handleSetMapping(m.externalProductId, Number(e.target.value) || null)}
                              onBlur={() => setMappingRow(null)}
                              style={{ width: '100%', minHeight: 36, border: '1px solid var(--pos-border)', borderRadius: 8, padding: '0 8px' }}
                            >
                              <option value="">— اختر صنف —</option>
                              {products.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                            </select>
                          ) : (
                            <span style={{ color: m.onesoftProductId ? 'var(--pos-text)' : 'var(--pos-muted)', fontSize: 12 }}>
                              {m.onesoftProductName ?? '—'}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`pos-status pos-status--${m.available ? 'ready' : 'cancelled'}`}>
                            {m.available ? 'متاح' : 'غير متاح'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              type="button"
                              className="pos-button pos-button--secondary"
                              style={{ minHeight: 32, padding: '0 10px', fontSize: 11 }}
                              onClick={() => setMappingRow(m.externalProductId)}
                            >
                              ربط
                            </button>
                            {m.onesoftProductId !== null && (
                              <button
                                type="button"
                                className="pos-button pos-button--danger"
                                style={{ minHeight: 32, padding: '0 10px', fontSize: 11 }}
                                onClick={() => handleSetMapping(m.externalProductId, null)}
                              >
                                إزالة
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {unmappedCount > 0 && productMappings.length > 0 && (
              <div className="pos-warning-box" style={{ margin: '12px 0 0' }}>
                ⚠ {unmappedCount} أصناف غير مربوطة — الطلبات التي تحتوي على هذه الأصناف ستُصنَّف "يحتاج مراجعة".
              </div>
            )}

            <div className="pos-wizard-footer">
              <button type="button" className="pos-button pos-button--secondary" onClick={() => setStep(2)}>← رجوع</button>
              <button type="button" className="pos-button pos-button--secondary" onClick={handleConfirm}>
                {productMappings.length === 0 ? 'تخطي والحفظ' : unmappedCount > 0 ? 'حفظ مع تجاوز التحذير' : 'تأكيد الربط ✓'}
              </button>
              {testResult?.success && (
                <button type="button" className="pos-button pos-button--primary" onClick={handleConfirm}>
                  تأكيد الربط ✓
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
