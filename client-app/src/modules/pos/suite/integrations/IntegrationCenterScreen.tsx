import React, { useState } from 'react';
import { useIntegration } from './context';
import { providerRegistry } from './registry';
import { AddIntegrationWizard } from './AddIntegrationWizard';
import type { IntegrationConnection, ConnectionStatus } from './types';

function money(v: number) {
  return new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function formatSync(iso: string | null) {
  if (!iso) return 'لم تتزامن بعد';
  try {
    return new Intl.DateTimeFormat('ar-SA', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(iso));
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

interface ConnectionCardProps {
  connection: IntegrationConnection;
  onTest: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onRemove: (id: string) => void;
  testing: boolean;
}

function ConnectionCard({ connection, onTest, onToggle, onRemove, testing }: ConnectionCardProps) {
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
          <dt>الفرع</dt>
          <dd>{connection.settings.branchName || '—'}</dd>
        </div>
        <div>
          <dt>طريقة الدفع</dt>
          <dd>{connection.settings.defaultPaymentMethod || '—'}</dd>
        </div>
        <div>
          <dt>القبول</dt>
          <dd>{connection.settings.autoAccept ? 'تلقائي' : 'يدوي'}</dd>
        </div>
      </dl>

      {connection.unmappedProductCount > 0 && (
        <div className="pos-warning-box" style={{ margin: '0 0 12px' }}>
          ⚠ {connection.unmappedProductCount} أصناف غير مربوطة — تحقق من ربط الأصناف.
        </div>
      )}

      {connection.lastSyncError && connection.lastSyncStatus === 'error' && (
        <div className="pos-warning-box" style={{ margin: '0 0 12px', fontSize: 12 }}>
          {connection.lastSyncError}
        </div>
      )}

      <div className="pos-hub-card__actions">
        <button
          type="button"
          className={`pos-hub-toggle${connection.enabled ? ' is-on' : ''}`}
          onClick={() => onToggle(connection.id, !connection.enabled)}
        >
          {connection.enabled ? 'مفعّل' : 'موقوف'}
        </button>
        <button
          type="button"
          className="pos-button pos-button--secondary"
          style={{ flex: 1 }}
          onClick={() => onTest(connection.id)}
          disabled={testing}
        >
          {testing ? 'جارٍ الاختبار...' : 'اختبار الاتصال'}
        </button>
        <button
          type="button"
          className="pos-button pos-button--danger"
          style={{ minWidth: 48 }}
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
  const { connections, addConnection, removeConnection, setEnabled, recordSync, updateConnection } = useIntegration();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const registeredProviders = providerRegistry.listMeta();
  const connectedProviderIds = new Set(connections.map((c) => c.providerId));
  const availableProviders = registeredProviders.filter((p) => !connectedProviderIds.has(p.id));

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

  const handleToggle = (id: string, enabled: boolean) => {
    setEnabled(id, enabled);
  };

  const handleRemove = (id: string) => {
    removeConnection(id);
    if (testResult?.id === id) setTestResult(null);
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
            ربط منصات التوصيل والتجارة الإلكترونية بنقطة البيع. كل تكامل جديد يظهر تلقائياً في التقارير.
          </p>
        </div>
        <button
          type="button"
          className="pos-button pos-button--primary"
          style={{ minHeight: 48 }}
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
                onTest={handleTest}
                onToggle={handleToggle}
                onRemove={handleRemove}
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
                <span>ربط أي منصة خارجية من خلال Adapter مستقل.</span>
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
            <strong>1.</strong> أنشئ ملف <code>adapters/my-provider.ts</code> يُنفّذ <code>DeliveryProviderAdapter</code>.
            <br />
            <strong>2.</strong> سجّل الـ Adapter: <code>providerRegistry.register(new MyProviderAdapter())</code> في <code>POSRoot.tsx</code>.
            <br />
            <strong>3.</strong> يظهر المزود تلقائياً في هذه الشاشة وفي فلتر مركز الطلبات الخارجية وفي التقارير.
            <br />
            <strong>4.</strong> لا حاجة لتعديل شاشة البيع أو المطبخ أو بنية الفاتورة.
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
    </div>
  );
}
