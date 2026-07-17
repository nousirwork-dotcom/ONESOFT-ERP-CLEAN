import React, { useState } from 'react';
import { useIntegration } from './context';
import { usePOS } from '../state';
import { providerRegistry } from './registry';
import { AddIntegrationWizard } from './AddIntegrationWizard';
import { Modal } from '../components/Modal';
import type { IntegrationConnection, ConnectionStatus, ProductMapping } from './types';
import type { Product } from '../types';

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

interface ManageModalProps {
  connection: IntegrationConnection;
  products: Product[];
  onClose: () => void;
}

function ManageConnectionModal({ connection, products, onClose }: ManageModalProps) {
  const [mappings, setMappings] = useState<ProductMapping[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'mapped' | 'unmapped'>('all');
  const [editRow, setEditRow] = useState<string | null>(null);

  const unmappedCount = mappings.filter((m) => m.onesoftProductId === null).length;
  const filtered = mappings.filter((m) => {
    const matchSearch = !search || m.externalProductName.includes(search) || m.externalProductCode.includes(search);
    const matchFilter =
      filter === 'all' ||
      (filter === 'mapped' && m.onesoftProductId !== null) ||
      (filter === 'unmapped' && m.onesoftProductId === null);
    return matchSearch && matchFilter;
  });

  const handleAutoMatch = () => {
    setMappings((prev) =>
      prev.map((m) => {
        if (m.onesoftProductId !== null) return m;
        const match = products.find(
          (p) =>
            p.name.toLowerCase().includes(m.externalProductName.toLowerCase()) ||
            p.code.toLowerCase() === m.externalProductCode.toLowerCase(),
        );
        return match
          ? { ...m, onesoftProductId: match.id, onesoftProductCode: match.code, onesoftProductName: match.name }
          : m;
      }),
    );
  };

  const handleSetMapping = (externalId: string, productId: number | null) => {
    const p = productId !== null ? products.find((x) => x.id === productId) : null;
    setMappings((prev) =>
      prev.map((m) =>
        m.externalProductId === externalId
          ? { ...m, onesoftProductId: productId, onesoftProductCode: p?.code, onesoftProductName: p?.name }
          : m,
      ),
    );
    setEditRow(null);
  };

  const adapter = providerRegistry.get(connection.providerId);
  const meta = adapter?.meta;
  const logoColor = meta?.logoColor ?? '#1c4576';
  const logoInitial = meta?.logoInitial ?? connection.providerName.slice(0, 1);

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
            placeholder="بحث في أصناف المنصة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={mappings.length === 0}
          />
          <div className="pos-segmented" style={{ flexShrink: 0 }}>
            {(['all', 'mapped', 'unmapped'] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={filter === f ? 'is-active' : ''}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'الكل' : f === 'mapped' ? 'مربوط' : 'غير مربوط'}
              </button>
            ))}
          </div>
        </div>

        {mappings.length === 0 ? (
          <div className="pos-empty-state" style={{ minHeight: 160 }}>
            <span style={{ fontSize: 32 }}>🔗</span>
            <strong>لا توجد أصناف للمطابقة</strong>
            <span style={{ fontSize: 12, maxWidth: 360 }}>
              ستظهر أصناف {connection.providerName} هنا بعد المزامنة الأولى.
            </span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="pos-empty-state" style={{ minHeight: 100 }}>
            <strong>لا توجد نتائج</strong>
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
                  <th>توفر</th>
                  <th>الربط</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.externalProductId} className={m.onesoftProductId === null ? 'is-unmapped' : ''}>
                    <td><code>{m.externalProductCode}</code></td>
                    <td>{m.externalProductName}</td>
                    <td>{m.externalPrice.toFixed(2)} ر.س</td>
                    <td>
                      {editRow === m.externalProductId ? (
                        <select
                          autoFocus
                          value={m.onesoftProductId ?? ''}
                          onChange={(e) => handleSetMapping(m.externalProductId, Number(e.target.value) || null)}
                          onBlur={() => setEditRow(null)}
                          style={{ width: '100%', minHeight: 34, border: '1px solid var(--pos-border)', borderRadius: 8, padding: '0 8px' }}
                        >
                          <option value="">— اختر صنف —</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                          ))}
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
                          onClick={() => setEditRow(m.externalProductId)}
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
          ⚠ {connection.unmappedProductCount} أصناف غير مربوطة — تحقق من ربط الأصناف.
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
          className="pos-button pos-button--secondary"
          style={{ flex: 2 }}
          onClick={() => onManage(connection.id)}
          title="إدارة إعدادات التكامل وربط الأصناف"
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
          {testing ? 'جارٍ الاختبار...' : 'اختبار الاتصال'}
        </button>
        <button
          type="button"
          className={`pos-hub-toggle${connection.enabled ? ' is-on' : ''}`}
          onClick={() => onToggle(connection.id, !connection.enabled)}
          title={connection.enabled ? 'إيقاف مؤقت' : 'تفعيل'}
        >
          {connection.enabled ? 'مفعّل' : 'موقوف'}
        </button>
        <button
          type="button"
          className="pos-button pos-button--danger"
          style={{ minWidth: 44 }}
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
            ربط منصات الطلبات الخارجية (هنقرستيشن، مرسول...) بنقطة البيع. كل تكامل يظهر تلقائياً في التقارير.
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
            <strong>3.</strong> يظهر تلقائياً في هذه الشاشة وفلتر مركز الطلبات والتقارير — دون تعديل أي شاشة POS.
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
          products={[]}
          onClose={() => setManageId(null)}
        />
      )}
    </div>
  );
}
