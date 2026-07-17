import React, { useState } from 'react';
import { useIntegration } from './context';
import { usePOS } from '../state';
import { usePOSCatalog } from '../catalog-context';
import { providerRegistry } from './registry';
import { AddIntegrationWizard } from './AddIntegrationWizard';
import { Modal } from '../components/Modal';
import type { IntegrationConnection, ConnectionStatus } from './types';

const CANCEL_OPTIONS = [
  { value: 'auto_cancel', label: 'إلغاء تلقائي' },
  { value: 'notify_only', label: 'إشعار فقط' },
  { value: 'manual', label: 'يدوي (الكاشير يقرر)' },
];
const PAYMENT_METHODS = ['نقدي', 'شبكة', 'تحويل', 'آجل', 'حسب طلب المنصة'];

function formatSync(iso: string | null) {
  if (!iso) return 'لم تتزامن بعد';
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connected: 'متصل',
  disconnected: 'غير متصل',
  error: 'خطأ في الاتصال',
  pending: 'جارٍ الاتصال',
  paused: 'موقوف',
};

const STATUS_CLASS: Record<ConnectionStatus, string> = {
  connected: 'is-connected',
  disconnected: 'is-disconnected',
  error: 'is-error',
  pending: 'is-pending',
  paused: 'is-paused',
};

function StatusDot({ status }: { status: ConnectionStatus }) {
  return <span className={`pos-hub-status-dot ${STATUS_CLASS[status]}`} title={STATUS_LABEL[status]} />;
}

/** اتجاه الربط: من OneSoft → المنصة. نُخزّن الاسم الخارجي لكل صنف. */
interface ProductMappingEntry {
  productId: number;
  productCode: string;
  productName: string;
  productPrice: number;
  externalName: string;
  available: boolean;
}

type ManageTab = 'settings' | 'mapping';

interface ManageModalProps {
  connection: IntegrationConnection;
  onClose: () => void;
}

function ManageConnectionModal({ connection, onClose }: ManageModalProps) {
  const { products, warehouses, journals, customers } = usePOSCatalog();
  const [tab, setTab] = useState<ManageTab>('mapping');

  const [mappings, setMappings] = useState<ProductMappingEntry[]>(() =>
    products.map((p) => ({
      productId: p.id,
      productCode: p.code,
      productName: p.name,
      productPrice: p.salePrice,
      externalName: '',
      available: true,
    })),
  );
  const [mappingSearch, setMappingSearch] = useState('');
  const [mappingFilter, setMappingFilter] = useState<'all' | 'mapped' | 'unmapped'>('all');
  const [editRow, setEditRow] = useState<number | null>(null);

  const [localSettings, setLocalSettings] = useState({ ...connection.settings });

  const adapter = providerRegistry.get(connection.providerId);
  const meta = adapter?.meta;
  const logoColor = meta?.logoColor ?? '#1c4576';
  const logoInitial = meta?.logoInitial ?? connection.providerName.slice(0, 1);

  const unmappedCount = mappings.filter((m) => m.externalName.trim() === '').length;
  const filteredMappings = mappings.filter((m) => {
    const matchSearch =
      !mappingSearch ||
      m.productName.toLowerCase().includes(mappingSearch.toLowerCase()) ||
      m.productCode.toLowerCase().includes(mappingSearch.toLowerCase()) ||
      m.externalName.toLowerCase().includes(mappingSearch.toLowerCase());
    const matchFilter =
      mappingFilter === 'all' ||
      (mappingFilter === 'mapped' && m.externalName.trim() !== '') ||
      (mappingFilter === 'unmapped' && m.externalName.trim() === '');
    return matchSearch && matchFilter;
  });

  const handleAutoMatch = () => {
    setMappings((prev) =>
      prev.map((m) => ({
        ...m,
        externalName: m.externalName.trim() === '' ? m.productName : m.externalName,
      })),
    );
  };

  return (
    <Modal open title={`إدارة الربط — ${connection.providerName}`} onClose={onClose} width={740}>
      <div className="pos-wizard" style={{ gap: 14 }}>
        <div className="pos-wizard-provider-info">
          <div className="pos-hub-card__logo" style={{ background: logoColor, width: 40, height: 40, borderRadius: 12 }}>
            {logoInitial}
          </div>
          <div style={{ flex: 1 }}>
            <strong>{connection.providerName}</strong>
            <span style={{ color: 'var(--pos-muted)', fontSize: 12 }}>
              {connection.settings.branchName || '—'} · {connection.settings.posName || '—'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <StatusDot status={connection.status} />
            <span style={{ fontSize: 12, color: 'var(--pos-muted)' }}>{STATUS_LABEL[connection.status]}</span>
          </div>
        </div>

        <div className="pos-segmented" style={{ marginBottom: 0 }}>
          <button type="button" className={tab === 'mapping' ? 'is-active' : ''} onClick={() => setTab('mapping')}>
            ربط الأصناف
            {unmappedCount > 0 && (
              <span className="pos-badge pos-badge--warning" style={{ marginRight: 6 }}>{unmappedCount}</span>
            )}
          </button>
          <button type="button" className={tab === 'settings' ? 'is-active' : ''} onClick={() => setTab('settings')}>
            إعدادات التشغيل
          </button>
        </div>

        {/* ─── تبويب: ربط الأصناف ─────────────────────────────────── */}
        {tab === 'mapping' && (
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <p style={{ margin: 0, color: 'var(--pos-muted)', fontSize: 12, flex: 1 }}>
                حدّد اسم كل صنف كما يظهر على منصة {connection.providerName} لمطابقة الطلبات الواردة تلقائياً.
              </p>
              <button
                type="button"
                className="pos-button pos-button--secondary"
                style={{ minHeight: 36, fontSize: 12, flexShrink: 0 }}
                onClick={handleAutoMatch}
                disabled={products.length === 0}
              >
                مطابقة تلقائية
              </button>
            </div>

            <div className="pos-mapping-toolbar">
              <input
                className="pos-mapping-search"
                placeholder="بحث في الأصناف..."
                value={mappingSearch}
                onChange={(e) => setMappingSearch(e.target.value)}
                disabled={products.length === 0}
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
              </div>
            ) : (
              <div className="pos-mapping-table-wrap">
                <table className="pos-mapping-table">
                  <thead>
                    <tr>
                      <th>كود OneSoft</th>
                      <th>الاسم الداخلي</th>
                      <th>السعر</th>
                      <th>الاسم على {connection.providerName}</th>
                      <th>متاح</th>
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
                              style={{ width: '100%', minHeight: 32, border: '1px solid var(--pos-blue)', borderRadius: 8, padding: '0 8px', font: 'inherit', fontSize: 12, outline: 'none' }}
                              value={m.externalName}
                              placeholder="اسم الصنف على المنصة..."
                              onChange={(e) =>
                                setMappings((prev) =>
                                  prev.map((x) => x.productId === m.productId ? { ...x, externalName: e.target.value } : x)
                                )
                              }
                              onBlur={() => setEditRow(null)}
                              onKeyDown={(e) => { if (e.key === 'Enter') setEditRow(null); }}
                            />
                          ) : (
                            <button
                              type="button"
                              style={{
                                background: 'none',
                                border: m.externalName ? '1px solid var(--pos-border)' : '1px dashed #ccc',
                                borderRadius: 8, padding: '4px 10px', width: '100%', textAlign: 'right',
                                cursor: 'text', color: m.externalName ? 'var(--pos-text)' : 'var(--pos-muted)',
                                fontSize: 12, minHeight: 32,
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
                              onClick={() =>
                                setMappings((prev) =>
                                  prev.map((x) => x.productId === m.productId ? { ...x, externalName: '' } : x)
                                )
                              }
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
              <div className="pos-warning-box" style={{ margin: '10px 0 0' }}>
                ⚠ {unmappedCount} أصناف لم يُحدَّد لها اسم على المنصة.
              </div>
            )}
          </div>
        )}

        {/* ─── تبويب: إعدادات التشغيل ─────────────────────────────── */}
        {tab === 'settings' && (
          <div>
            <div className="pos-form-grid">
              <label>
                <span>اسم الفرع</span>
                <input value={localSettings.branchName ?? ''} onChange={(e) => setLocalSettings((s) => ({ ...s, branchName: e.target.value }))} placeholder="فرع الرياض" />
              </label>
              <label>
                <span>نقطة البيع</span>
                <input value={localSettings.posName ?? ''} onChange={(e) => setLocalSettings((s) => ({ ...s, posName: e.target.value }))} placeholder="كاشير 1" />
              </label>
              <label>
                <span>المستودع</span>
                <select value={localSettings.warehouseId ?? ''} onChange={(e) => setLocalSettings((s) => ({ ...s, warehouseId: Number(e.target.value) || null }))}>
                  <option value="">— اختر مستودع —</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
                </select>
              </label>
              <label>
                <span>دفتر المبيعات</span>
                <select value={localSettings.journalId ?? ''} onChange={(e) => setLocalSettings((s) => ({ ...s, journalId: Number(e.target.value) || null }))}>
                  <option value="">— اختر دفتر مبيعات —</option>
                  {journals.map((j) => <option key={j.id} value={j.id}>{j.code} — {j.name}</option>)}
                </select>
              </label>
              <label>
                <span>العميل الافتراضي</span>
                <select value={localSettings.defaultCustomerId ?? ''} onChange={(e) => setLocalSettings((s) => ({ ...s, defaultCustomerId: Number(e.target.value) || null }))}>
                  <option value="">— اختر عميل افتراضي —</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                </select>
              </label>
              <label>
                <span>طريقة السداد</span>
                <select value={localSettings.defaultPaymentMethod ?? ''} onChange={(e) => setLocalSettings((s) => ({ ...s, defaultPaymentMethod: e.target.value }))}>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label>
                <span>التعامل مع الإلغاء</span>
                <select value={localSettings.cancelHandling ?? 'notify_only'} onChange={(e) => setLocalSettings((s) => ({ ...s, cancelHandling: e.target.value as 'auto_cancel' | 'notify_only' | 'manual' }))}>
                  {CANCEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            </div>
            <div className="pos-toggle-list" style={{ marginTop: 14 }}>
              <label className="pos-toggle">
                <input type="checkbox" checked={localSettings.autoAccept} onChange={(e) => setLocalSettings((s) => ({ ...s, autoAccept: e.target.checked }))} />
                <i /><span>قبول تلقائي للطلبات</span>
              </label>
              <label className="pos-toggle">
                <input type="checkbox" checked={localSettings.autoSendToKitchen} onChange={(e) => setLocalSettings((s) => ({ ...s, autoSendToKitchen: e.target.checked }))} />
                <i /><span>إرسال تلقائي للمطبخ</span>
              </label>
              <label className="pos-toggle">
                <input type="checkbox" checked={localSettings.soundAlert ?? true} onChange={(e) => setLocalSettings((s) => ({ ...s, soundAlert: e.target.checked }))} />
                <i /><span>تنبيه صوتي عند وصول طلب</span>
              </label>
              <label className="pos-toggle">
                <input type="checkbox" checked={localSettings.arrivalNotification ?? true} onChange={(e) => setLocalSettings((s) => ({ ...s, arrivalNotification: e.target.checked }))} />
                <i /><span>إشعار عند وصول طلب جديد</span>
              </label>
            </div>
          </div>
        )}

        <div className="pos-wizard-footer">
          <button type="button" className="pos-button pos-button--primary" onClick={onClose}>
            حفظ وإغلاق
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface ConnectionCardProps {
  connection: IntegrationConnection;
  newOrdersCount: number;
  onTest: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onRemove: (id: string) => void;
  onManage: (id: string) => void;
  testing: boolean;
}

function ConnectionCard({
  connection,
  newOrdersCount,
  onTest,
  onToggle,
  onRemove,
  onManage,
  testing,
}: ConnectionCardProps) {
  const adapter = providerRegistry.get(connection.providerId);
  const meta = adapter?.meta;
  const logoColor = meta?.logoColor ?? '#1c4576';
  const accentColor = meta?.accentColor ?? '#1c4576';

  return (
    <article
      className={`pos-hub-card ${connection.enabled ? 'is-enabled' : 'is-disabled'}`}
      style={{ borderTopColor: accentColor }}
    >
      <div className="pos-hub-card__header">
        <div className="pos-hub-card__logo" style={{ background: logoColor }}>
          {meta?.logoInitial ?? connection.providerName.slice(0, 1)}
        </div>
        <div className="pos-hub-card__title">
          <strong>{connection.providerName}</strong>
          <span className="pos-hub-category-tag">{meta?.category ?? 'مخصص'}</span>
        </div>
        <div className="pos-hub-card__status">
          <StatusDot status={connection.status} />
          <span>{STATUS_LABEL[connection.status]}</span>
        </div>
      </div>

      <dl className="pos-hub-card__meta">
        <div>
          <dt>آخر مزامنة</dt>
          <dd className={connection.lastSyncStatus === 'error' ? 'is-negative' : ''}>
            {formatSync(connection.lastSyncAt)}
          </dd>
        </div>
        <div>
          <dt>الفرع / نقطة البيع</dt>
          <dd>{[connection.settings.branchName, connection.settings.posName].filter(Boolean).join(' / ') || '—'}</dd>
        </div>
        <div>
          <dt>طلبات جديدة</dt>
          <dd style={{ color: newOrdersCount > 0 ? 'var(--pos-red)' : undefined, fontWeight: newOrdersCount > 0 ? 900 : undefined }}>
            {newOrdersCount > 0 ? `${newOrdersCount} طلب` : '—'}
          </dd>
        </div>
        <div>
          <dt>أصناف غير مربوطة</dt>
          <dd style={{ color: connection.unmappedProductCount > 0 ? 'var(--pos-orange)' : undefined }}>
            {connection.unmappedProductCount > 0 ? `${connection.unmappedProductCount} صنف` : '—'}
          </dd>
        </div>
      </dl>

      {connection.unmappedProductCount > 0 && (
        <div className="pos-warning-box" style={{ margin: '0 0 10px' }}>
          ⚠ {connection.unmappedProductCount} أصناف غير مربوطة — افتح "إدارة الربط" للمعالجة.
        </div>
      )}

      {connection.lastSyncError && connection.lastSyncStatus === 'error' && (
        <div className="pos-warning-box" style={{ margin: '0 0 10px', fontSize: 12 }}>
          {connection.lastSyncError}
        </div>
      )}

      <div className="pos-hub-card__actions">
        <button
          type="button"
          className="pos-button pos-button--primary"
          style={{ flex: 2 }}
          onClick={() => onManage(connection.id)}
        >
          إدارة الربط
        </button>
        <button
          type="button"
          className="pos-button pos-button--secondary"
          style={{ flex: 2 }}
          onClick={() => onTest(connection.id)}
          disabled={testing}
        >
          {testing ? 'جارٍ...' : 'اختبار الاتصال'}
        </button>
        <button
          type="button"
          className={`pos-hub-toggle${connection.enabled ? ' is-on' : ''}`}
          onClick={() => onToggle(connection.id, !connection.enabled)}
        >
          {connection.enabled ? 'مفعّل' : 'موقوف'}
        </button>
        <button
          type="button"
          className="pos-button pos-button--danger"
          style={{ minWidth: 44, padding: '0 10px' }}
          title="حذف التكامل"
          onClick={() => {
            if (window.confirm(`هل تريد حذف تكامل ${connection.providerName}؟`)) {
              onRemove(connection.id);
            }
          }}
        >
          ×
        </button>
      </div>
    </article>
  );
}

interface Props {
  onBack: () => void;
}

export function IntegrationCenterScreen({ onBack }: Props) {
  const { connections, addConnection, removeConnection, setEnabled, recordSync } = useIntegration();
  const { state: posState } = usePOS();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [manageId, setManageId] = useState<string | null>(null);

  const registeredProviders = providerRegistry.listMeta();
  const connectedProviderIds = new Set(connections.map((c) => c.providerId));
  const availableProviders = registeredProviders.filter((p) => !connectedProviderIds.has(p.id));

  const manageConn = manageId ? connections.find((c) => c.id === manageId) ?? null : null;

  const getNewOrdersCount = (providerId: string) =>
    posState.externalOrders.filter((o) => o.provider === providerId && o.status === 'new').length;

  const handleTest = async (id: string) => {
    const conn = connections.find((c) => c.id === id);
    if (!conn) return;
    const adapter = providerRegistry.get(conn.providerId);
    if (!adapter) {
      setTestResult({ id, success: false, message: 'المزود غير متاح في هذه البيئة.' });
      return;
    }
    setTestingId(id);
    setTestResult(null);
    try {
      const result = await adapter.testConnection(conn.credentials);
      recordSync(id, result);
      setTestResult({ id, success: result.success, message: result.message });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطأ غير متوقع';
      recordSync(id, { success: false, message: msg });
      setTestResult({ id, success: false, message: msg });
    } finally {
      setTestingId(null);
    }
  };

  const handleRemove = (id: string) => {
    removeConnection(id);
    if (testResult?.id === id) setTestResult(null);
    if (manageId === id) setManageId(null);
  };

  return (
    <div className="pos-integration-hub">
      <div className="pos-integration-hub__topbar">
        <div>
          <button type="button" className="pos-link-button" onClick={onBack} style={{ marginBottom: 6 }}>
            ← الإعدادات
          </button>
          <h1 style={{ margin: '0 0 4px', fontSize: 22 }}>مركز التكاملات</h1>
          <p style={{ margin: 0, color: 'var(--pos-muted)', fontSize: 13 }}>
            ربط منصات الطلبات الخارجية (هنقرستيشن، مرسول...) بنقطة البيع.
          </p>
        </div>
        <button
          type="button"
          className="pos-button pos-button--primary"
          style={{ minHeight: 48, flexShrink: 0 }}
          onClick={() => setWizardOpen(true)}
        >
          + إضافة تكامل جديد
        </button>
      </div>

      {testResult && (
        <div className={testResult.success ? 'pos-success-box' : 'pos-warning-box'} style={{ marginBottom: 16 }}>
          {testResult.success ? '✓' : '⚠'} {testResult.message}
        </div>
      )}

      {connections.length > 0 ? (
        <section className="pos-integration-hub__section">
          <header className="pos-integration-hub__section-header">
            <h2>التكاملات المفعّلة</h2>
            <span>{connections.length} تكامل</span>
          </header>
          <div className="pos-hub-grid">
            {connections.map((conn) => (
              <ConnectionCard
                key={conn.id}
                connection={conn}
                newOrdersCount={getNewOrdersCount(conn.providerId)}
                onTest={handleTest}
                onToggle={(id, enabled) => setEnabled(id, enabled)}
                onRemove={handleRemove}
                onManage={(id) => setManageId(id)}
                testing={testingId === conn.id}
              />
            ))}
          </div>
        </section>
      ) : (
        <div className="pos-empty-state" style={{ minHeight: 160 }}>
          <span style={{ fontSize: 36 }}>🔌</span>
          <strong>لا توجد تكاملات مفعّلة</strong>
          <span>أضف أول تكامل من زر "+ إضافة تكامل جديد".</span>
        </div>
      )}

      {availableProviders.length > 0 && (
        <section className="pos-integration-hub__section" style={{ marginTop: 24 }}>
          <header className="pos-integration-hub__section-header">
            <h2>المزودون الجاهزون</h2>
            <span>لم يتم ربطهم بعد</span>
          </header>
          <div className="pos-hub-available-grid">
            {availableProviders.map((meta) => (
              <button
                key={meta.id}
                type="button"
                className="pos-hub-available-card"
                style={{ borderTopColor: meta.accentColor }}
                onClick={() => setWizardOpen(true)}
              >
                <div className="pos-hub-card__logo" style={{ background: meta.logoColor }}>
                  {meta.logoInitial}
                </div>
                <div>
                  <strong>{meta.name}</strong>
                  <span>{meta.description}</span>
                </div>
                <span className="pos-hub-connect-hint">ربط ←</span>
              </button>
            ))}
            <button
              type="button"
              className="pos-hub-available-card pos-hub-available-card--custom"
              onClick={() => setWizardOpen(true)}
            >
              <div className="pos-hub-card__logo" style={{ background: '#6b7a8d' }}>⚙</div>
              <div>
                <strong>مزود مخصص</strong>
                <span>ربط أي منصة خارجية باستخدام Adapter مستقل.</span>
              </div>
              <span className="pos-hub-connect-hint">إضافة ←</span>
            </button>
          </div>
        </section>
      )}

      <section className="pos-integration-hub__section" style={{ marginTop: 24 }}>
        <header className="pos-integration-hub__section-header">
          <h2>كيفية إضافة مزود جديد للمطورين</h2>
        </header>
        <article className="pos-card" style={{ background: '#f8fafc', fontSize: 13, lineHeight: 1.9 }}>
          <p style={{ margin: 0 }}>
            <strong>1.</strong> أنشئ <code>adapters/my-provider.ts</code> يُنفّذ <code>DeliveryProviderAdapter</code>.<br />
            <strong>2.</strong> سجّله في <code>POSRoot.tsx</code>: <code>providerRegistry.register(new MyProviderAdapter())</code>.<br />
            <strong>3.</strong> يظهر تلقائياً في هذه الشاشة وفلتر مركز الطلبات والتقارير.
          </p>
        </article>
      </section>

      <AddIntegrationWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onConnected={(conn) => {
          addConnection(conn);
          setWizardOpen(false);
        }}
      />

      {manageConn && (
        <ManageConnectionModal
          connection={manageConn}
          onClose={() => setManageId(null)}
        />
      )}
    </div>
  );
}
