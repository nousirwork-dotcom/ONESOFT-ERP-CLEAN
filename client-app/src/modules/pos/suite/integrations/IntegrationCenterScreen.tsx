import React, { useState } from 'react';
import { useIntegration } from './context';
import { usePOS } from '../state';
import { usePOSCatalog } from '../catalog-context';
import { providerRegistry } from './registry';
import { AddIntegrationWizard } from './AddIntegrationWizard';
import { Modal } from '../components/Modal';
import type { IntegrationConnection, ConnectionStatus, ProductMapping } from './types';

const CANCEL_OPTIONS = [
  { value: 'auto_cancel', label: 'إلغاء تلقائي' },
  { value: 'notify_only', label: 'إشعار فقط' },
  { value: 'manual', label: 'يدوي (الكاشير يقرر)' },
];
const PAYMENT_METHODS = ['نقدي', 'شبكة', 'تحويل', 'آجل', 'حسب طلب المنصة'];

function formatSync(iso: string | null) {
  if (!iso) return 'لم تتزامن بعد';
  try {
    return new Intl.DateTimeFormat('ar-SA', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(iso));
  } catch { return '—'; }
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connected: 'متصل', disconnected: 'غير متصل', error: 'خطأ في الاتصال', pending: 'جارٍ الاتصال', paused: 'موقوف',
};
const STATUS_CLASS: Record<ConnectionStatus, string> = {
  connected: 'is-connected', disconnected: 'is-disconnected', error: 'is-error', pending: 'is-pending', paused: 'is-paused',
};

function StatusDot({ status }: { status: ConnectionStatus }) {
  return <span className={`pos-hub-status-dot ${STATUS_CLASS[status]}`} title={STATUS_LABEL[status]} />;
}

type ManageTab = 'mapping' | 'settings';

interface ManageModalProps {
  connection: IntegrationConnection;
  onClose: () => void;
}

function ManageConnectionModal({ connection, onClose }: ManageModalProps) {
  const { products, warehouses, journals, customers } = usePOSCatalog();
  const { updateConnectionSettings, updateConnectionMappings } = useIntegration();

  const [tab, setTab] = useState<ManageTab>('mapping');

  /** صفوف الربط تُحمَّل من نموذج الاتصال المحفوظ */
  const [rows, setRows] = useState<ProductMapping[]>(() =>
    connection.productMappings.map((m) => ({
      ...m,
      rowId: m.rowId ?? `row-${Math.random().toString(16).slice(2)}`,
    })),
  );
  const [mappingSearch, setMappingSearch] = useState('');
  const [mappingFilter, setMappingFilter] = useState<'all' | 'mapped' | 'unmapped'>('all');
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');

  const [localSettings, setLocalSettings] = useState({ ...connection.settings });

  const adapter = providerRegistry.get(connection.providerId);
  const meta = adapter?.meta;
  const logoColor = meta?.logoColor ?? '#1c4576';
  const logoInitial = meta?.logoInitial ?? connection.providerName.slice(0, 1);

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
      {
        rowId: `row-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        externalProductId: code || `ext-${Date.now()}`,
        externalProductCode: code,
        externalProductName: newName.trim(),
        externalPrice: parseFloat(newPrice) || 0,
        available: true,
        onesoftProductId: null,
        onesoftProductCode: undefined,
        onesoftProductName: undefined,
      },
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
          ? { ...r, onesoftProductId: productId, onesoftProductCode: linked?.code, onesoftProductName: linked?.name }
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

  const handleSave = () => {
    updateConnectionSettings(connection.id, localSettings);
    updateConnectionMappings(connection.id, rows);
    onClose();
  };

  return (
    <Modal open title={`إدارة الربط — ${connection.providerName}`} onClose={onClose} width={860}>
      <div className="pos-wizard" style={{ gap: 14 }}>
        <div className="pos-wizard-provider-info">
          <div className="pos-hub-card__logo" style={{ background: logoColor, width: 40, height: 40, borderRadius: 12 }}>{logoInitial}</div>
          <div style={{ flex: 1 }}>
            <strong>{connection.providerName}</strong>
            <span style={{ color: 'var(--pos-muted)', fontSize: 12 }}>{connection.settings.branchName || '—'} · {connection.settings.posName || '—'}</span>
          </div>
          <StatusDot status={connection.status} />
          <span style={{ fontSize: 12, color: 'var(--pos-muted)' }}>{STATUS_LABEL[connection.status]}</span>
        </div>

        <div className="pos-segmented">
          <button type="button" className={tab === 'mapping' ? 'is-active' : ''} onClick={() => setTab('mapping')}>
            ربط الأصناف
            {unmappedCount > 0 && <span className="pos-badge pos-badge--warning" style={{ marginRight: 6 }}>{unmappedCount}</span>}
          </button>
          <button type="button" className={tab === 'settings' ? 'is-active' : ''} onClick={() => setTab('settings')}>
            إعدادات التشغيل
          </button>
        </div>

        {/* ─── تبويب: ربط الأصناف ─────────────────────────────────── */}
        {tab === 'mapping' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <p style={{ margin: 0, color: 'var(--pos-muted)', fontSize: 12, flex: 1 }}>
                أدخل أصناف {connection.providerName} ثم اربط كل منها بصنفه في كتالوج OneSoft.
              </p>
              {rows.length > 0 && (
                <button type="button" className="pos-button pos-button--secondary" style={{ fontSize: 12, minHeight: 36, flexShrink: 0 }} onClick={handleAutoMatch}>
                  مطابقة تلقائية
                </button>
              )}
            </div>

            {/* نموذج إضافة صنف */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr auto', gap: 8, marginBottom: 12, padding: 12, background: '#f8fafc', borderRadius: 12, border: '1px solid var(--pos-border)' }}>
              <input placeholder="كود المنصة" value={newCode} onChange={(e) => setNewCode(e.target.value)} style={{ minHeight: 36, border: '1px solid var(--pos-border)', borderRadius: 8, padding: '0 10px', font: 'inherit', fontSize: 12 }} />
              <input
                placeholder="اسم الصنف على المنصة *"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddRow(); }}
                style={{ minHeight: 36, border: '1px solid var(--pos-border)', borderRadius: 8, padding: '0 10px', font: 'inherit', fontSize: 12 }}
              />
              <input placeholder="السعر (ر.س)" type="number" min="0" step="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} style={{ minHeight: 36, border: '1px solid var(--pos-border)', borderRadius: 8, padding: '0 10px', font: 'inherit', fontSize: 12 }} />
              <button type="button" className="pos-button pos-button--primary" style={{ minHeight: 36 }} onClick={handleAddRow} disabled={!newName.trim()}>+ إضافة</button>
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
                <strong>لا توجد أصناف مربوطة بعد</strong>
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
                      <th>الاسم الخارجي</th>
                      <th>السعر</th>
                      <th>الإضافات</th>
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
                          <input
                            style={{ width: '100%', minHeight: 30, border: '1px solid var(--pos-border)', borderRadius: 6, padding: '0 8px', font: 'inherit', fontSize: 11 }}
                            placeholder="وصف الإضافات..."
                            value={r.addons ?? ''}
                            onChange={(e) => setRows((prev) => prev.map((x) => x.rowId === r.rowId ? { ...x, addons: e.target.value } : x))}
                          />
                        </td>
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
                        <td><code style={{ fontSize: 11, color: 'var(--pos-muted)' }}>{r.onesoftProductCode ?? '—'}</code></td>
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
                          <button type="button" className="pos-button pos-button--danger" style={{ minHeight: 30, padding: '0 8px', fontSize: 11 }} onClick={() => setRows((prev) => prev.filter((x) => x.rowId !== r.rowId))}>
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
                ⚠ {unmappedCount} أصناف لم تُربط بكتالوج OneSoft بعد.
              </div>
            )}
          </div>
        )}

        {/* ─── تبويب: إعدادات التشغيل ──────────────────────────────── */}
        {tab === 'settings' && (
          <div>
            <div className="pos-form-grid">
              <label><span>اسم الفرع</span><input value={localSettings.branchName ?? ''} onChange={(e) => setLocalSettings((s) => ({ ...s, branchName: e.target.value }))} /></label>
              <label><span>نقطة البيع</span><input value={localSettings.posName ?? ''} onChange={(e) => setLocalSettings((s) => ({ ...s, posName: e.target.value }))} /></label>
              <label>
                <span>المستودع</span>
                <select value={localSettings.warehouseId ?? ''} onChange={(e) => setLocalSettings((s) => ({ ...s, warehouseId: Number(e.target.value) || null }))}>
                  <option value="">— اختر —</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
                </select>
              </label>
              <label>
                <span>دفتر المبيعات</span>
                <select value={localSettings.journalId ?? ''} onChange={(e) => setLocalSettings((s) => ({ ...s, journalId: Number(e.target.value) || null }))}>
                  <option value="">— اختر —</option>
                  {journals.map((j) => <option key={j.id} value={j.id}>{j.code} — {j.name}</option>)}
                </select>
              </label>
              <label>
                <span>العميل الافتراضي</span>
                <select value={localSettings.defaultCustomerId ?? ''} onChange={(e) => setLocalSettings((s) => ({ ...s, defaultCustomerId: Number(e.target.value) || null }))}>
                  <option value="">— اختر —</option>
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
              {([
                ['autoAccept', 'قبول تلقائي للطلبات'],
                ['autoSendToKitchen', 'إرسال تلقائي للمطبخ'],
                ['soundAlert', 'تنبيه صوتي عند وصول طلب'],
                ['arrivalNotification', 'إشعار عند وصول طلب جديد'],
              ] as const).map(([key, label]) => (
                <label key={key} className="pos-toggle">
                  <input type="checkbox" checked={!!(localSettings[key as keyof typeof localSettings])} onChange={(e) => setLocalSettings((s) => ({ ...s, [key]: e.target.checked }))} />
                  <i /><span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="pos-wizard-footer">
          <button type="button" className="pos-button pos-button--secondary" onClick={onClose}>إلغاء</button>
          <button type="button" className="pos-button pos-button--primary" onClick={handleSave}>حفظ التعديلات</button>
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

function ConnectionCard({ connection, newOrdersCount, onTest, onToggle, onRemove, onManage, testing }: ConnectionCardProps) {
  const adapter = providerRegistry.get(connection.providerId);
  const meta = adapter?.meta;
  const logoColor = meta?.logoColor ?? '#1c4576';
  const accentColor = meta?.accentColor ?? '#1c4576';

  return (
    <article className={`pos-hub-card ${connection.enabled ? 'is-enabled' : 'is-disabled'}`} style={{ borderTopColor: accentColor }}>
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
        <div><dt>آخر مزامنة</dt><dd className={connection.lastSyncStatus === 'error' ? 'is-negative' : ''}>{formatSync(connection.lastSyncAt)}</dd></div>
        <div><dt>الفرع / نقطة البيع</dt><dd>{[connection.settings.branchName, connection.settings.posName].filter(Boolean).join(' / ') || '—'}</dd></div>
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
          ⚠ {connection.unmappedProductCount} أصناف غير مربوطة.
        </div>
      )}

      {connection.lastSyncError && connection.lastSyncStatus === 'error' && (
        <div className="pos-warning-box" style={{ margin: '0 0 10px', fontSize: 12 }}>{connection.lastSyncError}</div>
      )}

      <div className="pos-hub-card__actions">
        <button type="button" className="pos-button pos-button--primary" style={{ flex: 2 }} onClick={() => onManage(connection.id)}>إدارة الربط</button>
        <button type="button" className="pos-button pos-button--secondary" style={{ flex: 2 }} onClick={() => onTest(connection.id)} disabled={testing}>{testing ? 'جارٍ...' : 'اختبار الاتصال'}</button>
        <button type="button" className={`pos-hub-toggle${connection.enabled ? ' is-on' : ''}`} onClick={() => onToggle(connection.id, !connection.enabled)}>{connection.enabled ? 'مفعّل' : 'موقوف'}</button>
        <button type="button" className="pos-button pos-button--danger" style={{ minWidth: 44, padding: '0 10px' }} title="حذف التكامل" onClick={() => { if (window.confirm(`هل تريد حذف تكامل ${connection.providerName}؟`)) onRemove(connection.id); }}>×</button>
      </div>
    </article>
  );
}

interface Props { onBack: () => void; }

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
    if (!adapter) { setTestResult({ id, success: false, message: 'المزود غير متاح في هذه البيئة.' }); return; }
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
    } finally { setTestingId(null); }
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
          <button type="button" className="pos-link-button" onClick={onBack} style={{ marginBottom: 6 }}>← الإعدادات</button>
          <h1 style={{ margin: '0 0 4px', fontSize: 22 }}>مركز التكاملات</h1>
          <p style={{ margin: 0, color: 'var(--pos-muted)', fontSize: 13 }}>ربط منصات الطلبات الخارجية (هنقرستيشن، مرسول...) بنقطة البيع.</p>
        </div>
        <button type="button" className="pos-button pos-button--primary" style={{ minHeight: 48, flexShrink: 0 }} onClick={() => setWizardOpen(true)}>
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
          <header className="pos-integration-hub__section-header"><h2>التكاملات المفعّلة</h2><span>{connections.length} تكامل</span></header>
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
          <header className="pos-integration-hub__section-header"><h2>المزودون الجاهزون</h2><span>لم يتم ربطهم بعد</span></header>
          <div className="pos-hub-available-grid">
            {availableProviders.map((meta) => (
              <button key={meta.id} type="button" className="pos-hub-available-card" style={{ borderTopColor: meta.accentColor }} onClick={() => setWizardOpen(true)}>
                <div className="pos-hub-card__logo" style={{ background: meta.logoColor }}>{meta.logoInitial}</div>
                <div><strong>{meta.name}</strong><span>{meta.description}</span></div>
                <span className="pos-hub-connect-hint">ربط ←</span>
              </button>
            ))}
            <button type="button" className="pos-hub-available-card pos-hub-available-card--custom" onClick={() => setWizardOpen(true)}>
              <div className="pos-hub-card__logo" style={{ background: '#6b7a8d' }}>⚙</div>
              <div><strong>مزود مخصص</strong><span>ربط أي منصة خارجية باستخدام Adapter مستقل.</span></div>
              <span className="pos-hub-connect-hint">إضافة ←</span>
            </button>
          </div>
        </section>
      )}

      <section className="pos-integration-hub__section" style={{ marginTop: 24 }}>
        <header className="pos-integration-hub__section-header"><h2>كيفية إضافة مزود جديد للمطورين</h2></header>
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
        onConnected={(conn) => { addConnection(conn); setWizardOpen(false); }}
      />

      {manageConn && (
        <ManageConnectionModal connection={manageConn} onClose={() => setManageId(null)} />
      )}
    </div>
  );
}
