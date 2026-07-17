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

function newRow(overrides: Partial<ProductMapping> = {}): ProductMapping {
  return {
    rowId: `row-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    externalProductId: overrides.externalProductCode ?? `ext-${Date.now()}`,
    externalProductCode: '',
    externalProductName: '',
    externalPrice: 0,
    available: true,
    onesoftProductId: null,
    onesoftProductCode: undefined,
    onesoftProductName: undefined,
    ...overrides,
  };
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

  const [rows, setRows] = useState<ProductMapping[]>([]);
  const [mappingSearch, setMappingSearch] = useState('');
  const [mappingFilter, setMappingFilter] = useState<'all' | 'mapped' | 'unmapped'>('all');
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');

  const activeMeta = selectedMeta;
  const isCustom = activeMeta?.id === 'custom';
  const credentialFields = activeMeta?.credentialFields ?? [];
  const adminFields = credentialFields.filter((f) => f.adminOnly);
  const publicFields = credentialFields.filter((f) => !f.adminOnly);

  const allProviderOptions = [...providerRegistry.listMeta(), CUSTOM_META];

  const mappedCount = rows.filter((r) => r.onesoftProductId !== null).length;
  const unmappedCount = rows.length - mappedCount;

  const filteredRows = rows.filter((r) => {
    const q = mappingSearch.toLowerCase();
    const matchSearch =
      !q ||
      r.externalProductName.toLowerCase().includes(q) ||
      r.externalProductCode.toLowerCase().includes(q) ||
      (r.onesoftProductName ?? '').toLowerCase().includes(q);
    const matchFilter =
      mappingFilter === 'all' ||
      (mappingFilter === 'mapped' && r.onesoftProductId !== null) ||
      (mappingFilter === 'unmapped' && r.onesoftProductId === null);
    return matchSearch && matchFilter;
  });

  const handleAddRow = () => {
    if (!newName.trim()) return;
    const code = newCode.trim();
    setRows((prev) => [
      ...prev,
      newRow({
        externalProductId: code || `ext-${Date.now()}`,
        externalProductCode: code,
        externalProductName: newName.trim(),
        externalPrice: parseFloat(newPrice) || 0,
      }),
    ]);
    setNewCode('');
    setNewName('');
    setNewPrice('');
  };

  const handleAutoMatch = () => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.onesoftProductId !== null) return r;
        const match = products.find(
          (p) =>
            p.name.toLowerCase() === r.externalProductName.toLowerCase() ||
            p.code.toLowerCase() === r.externalProductCode.toLowerCase(),
        );
        return match
          ? { ...r, onesoftProductId: match.id, onesoftProductCode: match.code, onesoftProductName: match.name }
          : r;
      }),
    );
  };

  const handleLinkProduct = (rowId: string | undefined, productId: number | null) => {
    if (!rowId) return;
    const linked = productId ? products.find((p) => p.id === productId) : null;
    setRows((prev) =>
      prev.map((r) =>
        r.rowId === rowId
          ? {
              ...r,
              onesoftProductId: productId,
              onesoftProductCode: linked?.code,
              onesoftProductName: linked?.name,
            }
          : r,
      ),
    );
  };

  const handleUnlink = (rowId: string | undefined) => {
    if (!rowId) return;
    setRows((prev) =>
      prev.map((r) =>
        r.rowId === rowId
          ? { ...r, onesoftProductId: null, onesoftProductCode: undefined, onesoftProductName: undefined }
          : r,
      ),
    );
  };

  const handleDeleteRow = (rowId: string | undefined) => {
    if (!rowId) return;
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
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
    setRows([]);
    setMappingSearch('');
    setMappingFilter('all');
    setNewCode('');
    setNewName('');
    setNewPrice('');
  };

  const handleClose = () => { handleReset(); onClose(); };

  const handleTest = async () => {
    if (!activeMeta) return;
    setTesting(true);
    setTestResult(null);
    try {
      const adapter = providerRegistry.get(activeMeta.id);
      const result = adapter
        ? await adapter.testConnection(credentials)
        : await (async () => { await new Promise((r) => setTimeout(r, 600)); return { success: true, message: 'تم إضافة التكامل المخصص.' }; })();
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
      productMappings: rows,
      unmappedProductCount: unmappedCount,
      createdAt: new Date().toISOString(),
    };
    onConnected(conn);
    handleReset();
  };

  const logoInitial = activeMeta ? (isCustom && customInitial ? customInitial : activeMeta.logoInitial) : '?';
  const logoColor = activeMeta?.logoColor ?? '#6b7a8d';

  return (
    <Modal open={open} title="إضافة تكامل جديد" onClose={handleClose} width={820}>
      <div className="pos-wizard">
        <div className="pos-wizard-progress">
          {STEPS.map((label, index) => (
            <div key={label} className={`pos-wizard-step ${index === step ? 'is-active' : ''} ${index < step ? 'is-done' : ''}`}>
              <span>{index < step ? '✓' : index + 1}</span>
              <small>{label}</small>
            </div>
          ))}
        </div>

        {/* ─── Step 0: بيانات التطبيق ─────────────────────────────────── */}
        {step === 0 && (
          <div>
            <p style={{ color: 'var(--pos-muted)', marginTop: 0, marginBottom: 16, fontSize: 13 }}>
              اختر مزوداً جاهزاً، أو أضف مزوداً مخصصاً.
            </p>
            <div className="pos-provider-picker">
              {allProviderOptions.map((meta) => (
                <button
                  key={meta.id}
                  type="button"
                  className={`pos-provider-option${selectedMeta?.id === meta.id ? ' is-selected' : ''}`}
                  style={{ borderTopColor: meta.accentColor }}
                  onClick={() => { setSelectedMeta(meta); if (meta.id !== 'custom') setStep(1); }}
                >
                  <div className="pos-provider-option__logo" style={{ background: meta.logoColor }}>{meta.logoInitial}</div>
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
                <div className="pos-form-grid">
                  <label><span>اسم التطبيق</span><input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="طلبات داخلية" /></label>
                  <label><span>الاسم المختصر</span><input value={customShortName} onChange={(e) => setCustomShortName(e.target.value)} placeholder="INT-01" /></label>
                  <label><span>رمز الشعار</span><input value={customInitial} maxLength={2} onChange={(e) => setCustomInitial(e.target.value)} placeholder="م" /></label>
                  <label><span>وصف</span><input value={customDesc} onChange={(e) => setCustomDesc(e.target.value)} placeholder="وصف المزود" /></label>
                </div>
                <label className="pos-toggle" style={{ marginTop: 12 }}>
                  <input type="checkbox" checked={customActive} onChange={(e) => setCustomActive(e.target.checked)} />
                  <i /><span>تفعيل التكامل فور الإضافة</span>
                </label>
                <div className="pos-wizard-footer" style={{ marginTop: 12 }}>
                  <button type="button" className="pos-button pos-button--primary" onClick={() => setStep(1)} disabled={!customName.trim()}>التالي →</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Step 1: الاتصال ─────────────────────────────────────────── */}
        {step === 1 && activeMeta && (
          <div>
            <div className="pos-wizard-provider-info">
              <div className="pos-hub-card__logo" style={{ background: logoColor, width: 48, height: 48, borderRadius: 14 }}>{logoInitial}</div>
              <div><strong>{isCustom && customName ? customName : activeMeta.name}</strong><span style={{ color: 'var(--pos-muted)', fontSize: 12 }}>إعدادات الاتصال</span></div>
              <div className="pos-hub-card__status" style={{ marginRight: 'auto' }}>
                <span className={`pos-hub-status-dot ${testResult ? (testResult.success ? 'is-connected' : 'is-error') : 'is-disconnected'}`} />
                <span style={{ fontSize: 12 }}>{testResult ? (testResult.success ? 'متصل' : 'فشل الاتصال') : 'لم يُختبر بعد'}</span>
              </div>
            </div>
            {publicFields.length > 0 && (
              <div className="pos-form-grid" style={{ marginBottom: 14 }}>
                {publicFields.map((field) => (
                  <label key={field.key}>
                    <span>{field.label}{field.required && <strong style={{ color: 'var(--pos-red)', marginRight: 4 }}>*</strong>}</span>
                    <input type={field.type} value={credentials[field.key] ?? ''} onChange={(e) => setCredentials((c) => ({ ...c, [field.key]: e.target.value }))} placeholder={field.placeholder} />
                    {field.helpText && <small style={{ color: 'var(--pos-muted)' }}>{field.helpText}</small>}
                  </label>
                ))}
              </div>
            )}
            <button type="button" className="pos-button pos-button--secondary" style={{ width: '100%', marginBottom: 12 }} onClick={handleTest} disabled={testing}>
              {testing ? '⏳ جارٍ اختبار...' : '⚡ اختبار الاتصال'}
            </button>
            {testResult && (
              <div className={testResult.success ? 'pos-success-box' : 'pos-warning-box'} style={{ marginBottom: 14 }}>
                {testResult.success ? '✓ ' : '⚠ '}{testResult.message}
              </div>
            )}
            {adminFields.length > 0 && (
              <div className="pos-collapsible">
                <button type="button" className="pos-collapsible__trigger" onClick={() => setAdvancedOpen((v) => !v)}>
                  <span>🔒 إعدادات متقدمة (المدير)</span><span>{advancedOpen ? '▲' : '▼'}</span>
                </button>
                {advancedOpen && (
                  <div className="pos-collapsible__body">
                    <div className="pos-wizard-admin-notice">هذه الحقول تتطلب صلاحية مدير النظام.</div>
                    <div className="pos-form-grid">
                      {adminFields.map((field) => (
                        <label key={field.key}>
                          <span>{field.label}<em style={{ color: 'var(--pos-muted)', fontSize: 10, marginRight: 6 }}>(مدير)</em></span>
                          <input type={field.type === 'select' ? 'text' : field.type} value={credentials[field.key] ?? ''} onChange={(e) => setCredentials((c) => ({ ...c, [field.key]: e.target.value }))} placeholder={field.placeholder} />
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
              <div><strong>{isCustom && customName ? customName : activeMeta.name}</strong><span style={{ color: 'var(--pos-muted)', fontSize: 12 }}>إعدادات الطلبات</span></div>
            </div>
            <div className="pos-form-grid">
              <label><span>اسم الفرع</span><input value={settings.branchName ?? ''} onChange={(e) => setSettings((s) => ({ ...s, branchName: e.target.value }))} placeholder="فرع الرياض" /></label>
              <label><span>نقطة البيع</span><input value={settings.posName ?? ''} onChange={(e) => setSettings((s) => ({ ...s, posName: e.target.value }))} placeholder="كاشير 1" /></label>
              <label>
                <span>المستودع</span>
                <select value={settings.warehouseId ?? ''} onChange={(e) => setSettings((s) => ({ ...s, warehouseId: Number(e.target.value) || null }))}>
                  <option value="">— اختر —</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
                </select>
              </label>
              <label>
                <span>دفتر المبيعات</span>
                <select value={settings.journalId ?? ''} onChange={(e) => setSettings((s) => ({ ...s, journalId: Number(e.target.value) || null }))}>
                  <option value="">— اختر —</option>
                  {journals.map((j) => <option key={j.id} value={j.id}>{j.code} — {j.name}</option>)}
                </select>
              </label>
              <label>
                <span>العميل الافتراضي</span>
                <select value={settings.defaultCustomerId ?? ''} onChange={(e) => setSettings((s) => ({ ...s, defaultCustomerId: Number(e.target.value) || null }))}>
                  <option value="">— اختر —</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                </select>
              </label>
              <label>
                <span>طريقة السداد</span>
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
              {([
                ['autoAccept', 'قبول تلقائي للطلبات'],
                ['autoSendToKitchen', 'إرسال تلقائي للمطبخ بعد القبول'],
                ['soundAlert', 'تنبيه صوتي عند وصول طلب جديد'],
                ['arrivalNotification', 'إشعار عند وصول طلب جديد'],
              ] as [keyof IntegrationConnectionSettings, string][]).map(([key, label]) => (
                <label key={key} className="pos-toggle">
                  <input type="checkbox" checked={!!(settings[key])} onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.checked }))} />
                  <i /><span>{label}</span>
                </label>
              ))}
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
                <strong>ربط أصناف {isCustom && customName ? customName : activeMeta.name}</strong>
                <span style={{ color: 'var(--pos-muted)', fontSize: 12 }}>أدخل أصناف المنصة وارتبط بكل منها بصنف OneSoft المقابل</span>
              </div>
              {rows.length > 0 && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  {unmappedCount > 0 && <span className="pos-badge pos-badge--warning">{unmappedCount} غير مربوط</span>}
                  <button type="button" className="pos-button pos-button--secondary" style={{ fontSize: 12, minHeight: 36 }} onClick={handleAutoMatch}>مطابقة تلقائية</button>
                </div>
              )}
            </div>

            {/* نموذج إضافة صنف خارجي */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr auto', gap: 8, marginBottom: 12, padding: 12, background: '#f8fafc', borderRadius: 12, border: '1px solid var(--pos-border)' }}>
              <input placeholder="كود المنصة" value={newCode} onChange={(e) => setNewCode(e.target.value)} style={{ minHeight: 38, border: '1px solid var(--pos-border)', borderRadius: 8, padding: '0 10px', font: 'inherit', fontSize: 12 }} />
              <input
                placeholder="اسم الصنف على المنصة *"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddRow(); }}
                style={{ minHeight: 38, border: '1px solid var(--pos-border)', borderRadius: 8, padding: '0 10px', font: 'inherit', fontSize: 12 }}
              />
              <input placeholder="السعر (ر.س)" type="number" min="0" step="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} style={{ minHeight: 38, border: '1px solid var(--pos-border)', borderRadius: 8, padding: '0 10px', font: 'inherit', fontSize: 12 }} />
              <button type="button" className="pos-button pos-button--primary" style={{ minHeight: 38 }} onClick={handleAddRow} disabled={!newName.trim()}>+ إضافة</button>
            </div>

            {rows.length > 0 && (
              <div className="pos-mapping-toolbar">
                <input className="pos-mapping-search" placeholder="بحث..." value={mappingSearch} onChange={(e) => setMappingSearch(e.target.value)} />
                <div className="pos-segmented" style={{ flexShrink: 0 }}>
                  {(['all', 'mapped', 'unmapped'] as const).map((f) => (
                    <button key={f} type="button" className={mappingFilter === f ? 'is-active' : ''} onClick={() => setMappingFilter(f)}>
                      {f === 'all' ? `الكل (${rows.length})` : f === 'mapped' ? `مربوط (${mappedCount})` : `غير مربوط (${unmappedCount})`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {rows.length === 0 ? (
              <div className="pos-empty-state" style={{ minHeight: 120 }}>
                <span style={{ fontSize: 28 }}>📋</span>
                <strong>لا توجد أصناف بعد</strong>
                <span style={{ fontSize: 12 }}>أدخل أصناف المنصة من النموذج أعلاه.</span>
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="pos-empty-state" style={{ minHeight: 80 }}><strong>لا نتائج</strong></div>
            ) : (
              <div className="pos-mapping-table-wrap">
                <table className="pos-mapping-table">
                  <thead>
                    <tr>
                      <th>كود المنصة</th>
                      <th>اسم الصنف (خارجي)</th>
                      <th>السعر</th>
                      <th>صنف OneSoft</th>
                      <th>كود OneSoft</th>
                      <th>الحالة</th>
                      <th>متاح</th>
                      <th>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r) => (
                      <tr key={r.rowId} className={r.onesoftProductId === null ? 'is-unmapped' : ''}>
                        <td><code style={{ fontSize: 11 }}>{r.externalProductCode || '—'}</code></td>
                        <td style={{ fontWeight: 600 }}>{r.externalProductName}</td>
                        <td style={{ color: 'var(--pos-muted)', fontSize: 12 }}>{r.externalPrice > 0 ? `${r.externalPrice.toFixed(2)} ر.س` : '—'}</td>
                        <td>
                          <select
                            value={r.onesoftProductId ?? ''}
                            onChange={(e) => handleLinkProduct(r.rowId, Number(e.target.value) || null)}
                            style={{ width: '100%', minHeight: 32, border: `1px solid ${r.onesoftProductId ? 'var(--pos-border)' : '#f59e0b'}`, borderRadius: 8, padding: '0 8px', font: 'inherit', fontSize: 12 }}
                          >
                            <option value="">— اختر صنف OneSoft —</option>
                            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </td>
                        <td>
                          <code style={{ fontSize: 11, color: 'var(--pos-muted)' }}>{r.onesoftProductCode ?? '—'}</code>
                        </td>
                        <td>
                          {r.onesoftProductId !== null
                            ? <span className="pos-badge pos-badge--success" style={{ fontSize: 11 }}>مربوط</span>
                            : <span className="pos-badge pos-badge--warning" style={{ fontSize: 11 }}>غير مربوط</span>}
                        </td>
                        <td>
                          <label className="pos-toggle" style={{ minHeight: 32, padding: '0 8px', border: 'none', justifyContent: 'center' }}>
                            <input type="checkbox" checked={r.available} onChange={(e) => setRows((prev) => prev.map((x) => x.rowId === r.rowId ? { ...x, available: e.target.checked } : x))} />
                            <i />
                          </label>
                        </td>
                        <td style={{ display: 'flex', gap: 4 }}>
                          {r.onesoftProductId !== null && (
                            <button type="button" className="pos-button pos-button--secondary" style={{ minHeight: 30, padding: '0 8px', fontSize: 11 }} onClick={() => handleUnlink(r.rowId)}>
                              إلغاء الربط
                            </button>
                          )}
                          <button type="button" className="pos-button pos-button--danger" style={{ minHeight: 30, padding: '0 8px', fontSize: 11 }} onClick={() => handleDeleteRow(r.rowId)}>
                            حذف
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {unmappedCount > 0 && rows.length > 0 && (
              <div className="pos-warning-box" style={{ margin: '10px 0 0' }}>
                ⚠ {unmappedCount} أصناف لم تُربط بكتالوج OneSoft — طلبات المنصة التي تحتويها ستُصنَّف "يحتاج مراجعة".
              </div>
            )}

            <div className="pos-wizard-footer">
              <button type="button" className="pos-button pos-button--secondary" onClick={() => setStep(2)}>← رجوع</button>
              <button type="button" className="pos-button pos-button--primary" onClick={handleConfirm}>
                {rows.length === 0 ? 'تخطي والحفظ' : unmappedCount > 0 ? `حفظ مع تجاوز التحذير (${unmappedCount} غير مربوط)` : 'تأكيد الربط ✓'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
