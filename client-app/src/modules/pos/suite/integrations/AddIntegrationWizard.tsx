import React, { useState } from 'react';
import { Modal } from '../components/Modal';
import { usePOSCatalog } from '../catalog-context';
import { providerRegistry } from './registry';
import type { IntegrationConnection, IntegrationConnectionSettings, IntegrationProviderMeta } from './types';

const STEPS = ['اختيار المزود', 'الإعدادات الأساسية', 'إعدادات API', 'تأكيد الربط'] as const;

const PAYMENT_METHODS = ['نقدي', 'شبكة', 'تحويل', 'آجل', 'حسب طلب المنصة'];

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
  const { warehouses, journals, customers } = usePOSCatalog();

  const [step, setStep] = useState(0);
  const [selectedMeta, setSelectedMeta] = useState<IntegrationProviderMeta | null>(null);
  const [customName, setCustomName] = useState('');
  const [customInitial, setCustomInitial] = useState('');

  const [settings, setSettings] = useState<IntegrationConnectionSettings>({
    branchName: '',
    posName: '',
    warehouseId: null,
    journalId: null,
    defaultCustomerId: null,
    defaultPaymentMethod: 'حسب طلب المنصة',
    autoAccept: false,
    autoSendToKitchen: true,
  });

  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const registeredMetas = providerRegistry.listMeta();
  const allProviderOptions = [...registeredMetas, CUSTOM_META];

  const activeMeta = selectedMeta ?? null;
  const credentialFields = activeMeta?.credentialFields ?? [];
  const isCustom = activeMeta?.id === 'custom';

  const handleReset = () => {
    setStep(0);
    setSelectedMeta(null);
    setCustomName('');
    setCustomInitial('');
    setSettings({
      branchName: '',
      posName: '',
      warehouseId: null,
      journalId: null,
      defaultCustomerId: null,
      defaultPaymentMethod: 'حسب طلب المنصة',
      autoAccept: false,
      autoSendToKitchen: true,
    });
    setCredentials({});
    setTesting(false);
    setTestResult(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSelectProvider = (meta: IntegrationProviderMeta) => {
    setSelectedMeta(meta);
    setStep(1);
  };

  const handleTestAndConnect = async () => {
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
        result = { success: true, message: 'تم إضافة التكامل المخصص. يتطلب تنفيذ الـ Adapter من المطور.' };
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
    const connection: IntegrationConnection = {
      id: `conn-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      providerId: isCustom ? `custom-${Date.now()}` : activeMeta.id,
      providerName,
      status: testResult?.success ? 'connected' : 'disconnected',
      enabled: testResult?.success ?? false,
      lastSyncAt: testResult?.success ? new Date().toISOString() : null,
      lastSyncStatus: testResult?.success ? 'success' : 'never',
      credentials,
      settings,
      unmappedProductCount: 0,
      createdAt: new Date().toISOString(),
    };
    onConnected(connection);
    handleReset();
  };

  return (
    <Modal open={open} title="إضافة تكامل جديد" onClose={handleClose} width={680}>
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

        {/* ─── Step 0: اختيار المزود ─────────────────────────────────────── */}
        {step === 0 && (
          <div>
            <p style={{ color: 'var(--pos-muted)', marginTop: 0, marginBottom: 16, fontSize: 13 }}>
              اختر مزوداً جاهزاً أو أضف مزوداً مخصصاً من خلال Adapter مستقل.
            </p>
            <div className="pos-provider-picker">
              {allProviderOptions.map((meta) => (
                <button
                  key={meta.id}
                  type="button"
                  className="pos-provider-option"
                  style={{ borderTopColor: meta.accentColor }}
                  onClick={() => handleSelectProvider(meta)}
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
          </div>
        )}

        {/* ─── Step 1: الإعدادات الأساسية ──────────────────────────────── */}
        {step === 1 && activeMeta && (
          <div>
            <div className="pos-wizard-provider-info">
              <div className="pos-hub-card__logo" style={{ background: activeMeta.logoColor, width: 48, height: 48, borderRadius: 14 }}>
                {activeMeta.logoInitial}
              </div>
              <div>
                <strong>{isCustom && customName ? customName : activeMeta.name}</strong>
                <span style={{ color: 'var(--pos-muted)', fontSize: 12 }}>الإعدادات التشغيلية</span>
              </div>
            </div>

            {isCustom && (
              <div className="pos-form-grid" style={{ marginBottom: 16 }}>
                <label>
                  <span>اسم المزود</span>
                  <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="مثال: طلبات داخلية" />
                </label>
                <label>
                  <span>رمز الشعار (حرف واحد)</span>
                  <input value={customInitial} maxLength={2} onChange={(e) => setCustomInitial(e.target.value)} placeholder="م" />
                </label>
              </div>
            )}

            <div className="pos-form-grid">
              <label>
                <span>اسم الفرع</span>
                <input
                  value={settings.branchName ?? ''}
                  onChange={(e) => setSettings((s) => ({ ...s, branchName: e.target.value }))}
                  placeholder="مثال: فرع الرياض"
                />
              </label>
              <label>
                <span>اسم نقطة البيع</span>
                <input
                  value={settings.posName ?? ''}
                  onChange={(e) => setSettings((s) => ({ ...s, posName: e.target.value }))}
                  placeholder="مثال: كاشير 1"
                />
              </label>
              <label>
                <span>المستودع</span>
                <select
                  value={settings.warehouseId ?? ''}
                  onChange={(e) => setSettings((s) => ({ ...s, warehouseId: Number(e.target.value) || null }))}
                >
                  <option value="">— اختر مستودع —</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
                </select>
              </label>
              <label>
                <span>دفتر المبيعات</span>
                <select
                  value={settings.journalId ?? ''}
                  onChange={(e) => setSettings((s) => ({ ...s, journalId: Number(e.target.value) || null }))}
                >
                  <option value="">— اختر دفتر مبيعات —</option>
                  {journals.map((j) => <option key={j.id} value={j.id}>{j.code} — {j.name}</option>)}
                </select>
              </label>
              <label>
                <span>العميل الافتراضي</span>
                <select
                  value={settings.defaultCustomerId ?? ''}
                  onChange={(e) => setSettings((s) => ({ ...s, defaultCustomerId: Number(e.target.value) || null }))}
                >
                  <option value="">— اختر عميل افتراضي —</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                </select>
              </label>
              <label>
                <span>طريقة الدفع</span>
                <select
                  value={settings.defaultPaymentMethod ?? ''}
                  onChange={(e) => setSettings((s) => ({ ...s, defaultPaymentMethod: e.target.value }))}
                >
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
            </div>

            <div className="pos-toggle-list" style={{ marginTop: 12 }}>
              <label className="pos-toggle">
                <input
                  type="checkbox"
                  checked={settings.autoAccept}
                  onChange={(e) => setSettings((s) => ({ ...s, autoAccept: e.target.checked }))}
                />
                <i />
                <span>قبول تلقائي للطلبات</span>
              </label>
              <label className="pos-toggle">
                <input
                  type="checkbox"
                  checked={settings.autoSendToKitchen}
                  onChange={(e) => setSettings((s) => ({ ...s, autoSendToKitchen: e.target.checked }))}
                />
                <i />
                <span>إرسال تلقائي للمطبخ بعد القبول</span>
              </label>
            </div>

            <div className="pos-wizard-footer">
              <button type="button" className="pos-button pos-button--secondary" onClick={() => setStep(0)}>← رجوع</button>
              <button type="button" className="pos-button pos-button--primary" onClick={() => setStep(2)}>التالي →</button>
            </div>
          </div>
        )}

        {/* ─── Step 2: إعدادات API ──────────────────────────────────────── */}
        {step === 2 && activeMeta && (
          <div>
            <div className="pos-wizard-admin-notice">
              🔒 هذه الإعدادات تتطلب صلاحية مدير النظام أو الدعم الفني — لا تشاركها مع موظفي الكاشير.
            </div>
            {credentialFields.length === 0 ? (
              <p style={{ color: 'var(--pos-muted)', padding: '16px 0' }}>لا توجد إعدادات API مطلوبة لهذا المزود.</p>
            ) : (
              <div className="pos-form-grid">
                {credentialFields.map((field) => (
                  <label key={field.key}>
                    <span>
                      {field.label}
                      {field.required && <strong style={{ color: 'var(--pos-red)', marginRight: 4 }}>*</strong>}
                      {field.adminOnly && <em style={{ color: 'var(--pos-muted)', fontSize: 10, marginRight: 6 }}>(مدير)</em>}
                    </span>
                    {field.type === 'select' ? (
                      <select
                        value={credentials[field.key] ?? ''}
                        onChange={(e) => setCredentials((c) => ({ ...c, [field.key]: e.target.value }))}
                      >
                        <option value="">— اختر —</option>
                        {(field.options ?? []).map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type}
                        value={credentials[field.key] ?? ''}
                        onChange={(e) => setCredentials((c) => ({ ...c, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                      />
                    )}
                    {field.helpText && <small style={{ color: 'var(--pos-muted)' }}>{field.helpText}</small>}
                  </label>
                ))}
              </div>
            )}
            <div className="pos-wizard-footer">
              <button type="button" className="pos-button pos-button--secondary" onClick={() => setStep(1)}>← رجوع</button>
              <button type="button" className="pos-button pos-button--primary" onClick={() => setStep(3)}>التالي →</button>
            </div>
          </div>
        )}

        {/* ─── Step 3: اختبار وتأكيد ────────────────────────────────────── */}
        {step === 3 && activeMeta && (
          <div>
            <div className="pos-wizard-summary">
              <div className="pos-hub-card__logo" style={{ background: activeMeta.logoColor, width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px' }}>
                {activeMeta.logoInitial}
              </div>
              <h3 style={{ margin: '0 0 16px', textAlign: 'center' }}>
                {isCustom && customName ? customName : activeMeta.name}
              </h3>
              <dl className="pos-details-list" style={{ marginBottom: 16 }}>
                <div><dt>الفرع</dt><dd>{settings.branchName || '—'}</dd></div>
                <div><dt>المستودع</dt><dd>{warehouses.find((w) => w.id === settings.warehouseId)?.name ?? '—'}</dd></div>
                <div><dt>دفتر المبيعات</dt><dd>{journals.find((j) => j.id === settings.journalId)?.name ?? '—'}</dd></div>
                <div><dt>العميل الافتراضي</dt><dd>{customers.find((c) => c.id === settings.defaultCustomerId)?.name ?? '—'}</dd></div>
                <div><dt>القبول</dt><dd>{settings.autoAccept ? 'تلقائي' : 'يدوي'}</dd></div>
                <div><dt>إرسال للمطبخ</dt><dd>{settings.autoSendToKitchen ? 'تلقائي' : 'يدوي'}</dd></div>
              </dl>
            </div>

            {testResult && (
              <div className={testResult.success ? 'pos-success-box' : 'pos-warning-box'}>
                {testResult.success ? '✓ ' : '⚠ '}{testResult.message}
              </div>
            )}

            <div className="pos-wizard-footer">
              <button type="button" className="pos-button pos-button--secondary" onClick={() => setStep(2)}>← رجوع</button>
              <button
                type="button"
                className="pos-button pos-button--secondary"
                onClick={handleTestAndConnect}
                disabled={testing}
              >
                {testing ? 'جارٍ الاختبار...' : 'اختبار الاتصال'}
              </button>
              <button
                type="button"
                className="pos-button pos-button--primary"
                onClick={handleConfirm}
              >
                {testResult?.success ? 'تأكيد الربط ✓' : 'حفظ بدون اختبار'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
