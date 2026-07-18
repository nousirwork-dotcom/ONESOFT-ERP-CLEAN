import React, { useMemo, useState } from 'react';
import { usePOS } from '../state';
import { useIntegration } from '../integrations/context';
import { providerRegistry } from '../integrations/registry';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import type { ExternalOrder } from '../types';

function money(v: number) {
  return new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

interface RejectModalProps {
  order: ExternalOrder;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

function RejectModal({ order, onConfirm, onClose }: RejectModalProps) {
  const [reason, setReason] = useState('');
  return (
    <Modal open title="رفض الطلب مع سبب" onClose={onClose} width={460}>
      <div style={{ display: 'grid', gap: 14 }}>
        <p style={{ margin: 0, color: 'var(--pos-muted)', fontSize: 13 }}>
          طلب رقم <strong>{order.externalOrderNumber}</strong> من {order.customerName}.
        </p>
        <label style={{ display: 'grid', gap: 6, color: 'var(--pos-muted)', fontSize: 12, fontWeight: 700 }}>
          سبب الرفض
          <textarea
            rows={3}
            placeholder="مثال: الطلب خارج نطاق التوصيل، الفرع مغلق..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ border: '1px solid var(--pos-border)', borderRadius: 10, padding: 10, font: 'inherit', fontSize: 13, resize: 'vertical' }}
          />
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="pos-button pos-button--secondary" onClick={onClose}>إلغاء</button>
          <button
            type="button"
            className="pos-button pos-button--danger"
            onClick={() => { onConfirm(reason.trim()); onClose(); }}
          >
            تأكيد الرفض
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface DetailsModalProps {
  order: ExternalOrder;
  providerName: string;
  onClose: () => void;
}

function DetailsModal({ order, providerName, onClose }: DetailsModalProps) {
  return (
    <Modal open title={`تفاصيل الطلب — ${order.externalOrderNumber}`} onClose={onClose} width={520}>
      <div style={{ display: 'grid', gap: 0 }}>
        {[
          ['المنصة', providerName],
          ['رقم الطلب (خارجي)', order.externalOrderNumber],
          order.internalOrderNumber ? ['رقم الطلب (داخلي)', order.internalOrderNumber] : null,
          ['العميل', order.customerName],
          order.customerPhone ? ['الجوال', order.customerPhone] : null,
          ['وقت الوصول', order.receivedAt],
          ['عدد البنود', String(order.itemCount)],
          ['طريقة الدفع', order.paymentLabel],
          ['الإجمالي', `${money(order.total)} ر.س`],
        ]
          .filter(Boolean)
          .map((row) => (
            <div
              key={(row as string[])[0]}
              style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #eef1f4', fontSize: 13 }}
            >
              <span style={{ color: 'var(--pos-muted)' }}>{(row as string[])[0]}</span>
              <strong>{(row as string[])[1]}</strong>
            </div>
          ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #eef1f4', fontSize: 13 }}>
          <span style={{ color: 'var(--pos-muted)' }}>الحالة</span>
          <StatusBadge status={order.status} />
        </div>
        {order.issue && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #eef1f4', fontSize: 13 }}>
            <span style={{ color: 'var(--pos-muted)' }}>ملاحظة</span>
            <span style={{ color: 'var(--pos-orange)' }}>{order.issue}</span>
          </div>
        )}
        {order.rejectionReason && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #eef1f4', fontSize: 13 }}>
            <span style={{ color: 'var(--pos-muted)' }}>سبب الرفض</span>
            <span style={{ color: 'var(--pos-red)', fontWeight: 700 }}>{order.rejectionReason}</span>
          </div>
        )}
        {order.syncError && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', fontSize: 13 }}>
            <span style={{ color: 'var(--pos-muted)' }}>خطأ المزامنة</span>
            <span style={{ color: 'var(--pos-red)', fontSize: 12 }}>{order.syncError}</span>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button type="button" className="pos-button pos-button--secondary" onClick={onClose}>إغلاق</button>
      </div>
    </Modal>
  );
}

export function ExternalOrdersScreen() {
  const { state, dispatch } = usePOS();
  const { connections } = useIntegration();
  const [filterProvider, setFilterProvider] = useState<'all' | string>('all');
  const [rejectOrder, setRejectOrder] = useState<ExternalOrder | null>(null);
  const [detailsOrder, setDetailsOrder] = useState<ExternalOrder | null>(null);

  const enabledConnections = connections.filter((c) => c.enabled);

  const visibleOrders = useMemo(
    () =>
      state.externalOrders.filter(
        (order) => filterProvider === 'all' || order.provider === filterProvider,
      ),
    [state.externalOrders, filterProvider],
  );

  const newCount = state.externalOrders.filter((o) => o.status === 'new').length;
  const reviewCount = state.externalOrders.filter((o) => o.status === 'needs_review').length;
  const preparingCount = state.externalOrders.filter((o) => o.status === 'preparing').length;
  const syncFailedCount = state.externalOrders.filter((o) => o.status === 'sync_failed').length;
  const todaySales = state.externalOrders
    .filter((o) => o.status !== 'rejected' && o.status !== 'cancelled' && o.status !== 'sync_failed')
    .reduce((sum, o) => sum + o.total, 0);

  const getProviderName = (order: ExternalOrder) => {
    const conn = enabledConnections.find((c) => c.providerId === order.provider);
    const meta = providerRegistry.get(order.provider)?.meta;
    return conn?.providerName ?? meta?.name ?? order.provider;
  };

  return (
    <section className="pos-page">
      <header className="pos-page__header">
        <div>
          <small>Delivery Integration Hub</small>
          <h1>مركز الطلبات الخارجية</h1>
          <p>استقبال طلبات جميع منصات التوصيل المربوطة، قبولها، ثم إدخالها في مسار المطعم والمطبخ.</p>
        </div>

        <div className="pos-segmented">
          <button
            type="button"
            className={filterProvider === 'all' ? 'is-active' : ''}
            onClick={() => setFilterProvider('all')}
          >
            الكل
            {state.externalOrders.length > 0 && (
              <span style={{ marginRight: 6, fontSize: 11 }}>({state.externalOrders.length})</span>
            )}
          </button>
          {enabledConnections.map((conn) => {
            const meta = providerRegistry.get(conn.providerId)?.meta;
            const count = state.externalOrders.filter((o) => o.provider === conn.providerId).length;
            return (
              <button
                key={conn.id}
                type="button"
                className={filterProvider === conn.providerId ? 'is-active' : ''}
                onClick={() => setFilterProvider(conn.providerId)}
                style={
                  filterProvider === conn.providerId && meta?.accentColor
                    ? { borderColor: meta.accentColor, color: meta.accentColor }
                    : undefined
                }
              >
                {conn.providerName}
                {count > 0 && <span style={{ marginRight: 6, fontSize: 11 }}>({count})</span>}
              </button>
            );
          })}
        </div>
      </header>

      <div className="pos-kpi-grid" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
        <article className={newCount > 0 ? 'is-highlight' : ''}>
          <small>طلبات جديدة</small>
          <strong>{newCount}</strong>
        </article>
        <article>
          <small>قيد التحضير</small>
          <strong>{preparingCount}</strong>
        </article>
        <article className={reviewCount > 0 ? 'is-warning' : ''}>
          <small>تحتاج مراجعة</small>
          <strong>{reviewCount}</strong>
        </article>
        <article className={syncFailedCount > 0 ? 'is-warning' : ''}>
          <small>فشلت المزامنة</small>
          <strong style={{ color: syncFailedCount > 0 ? 'var(--pos-red)' : undefined }}>{syncFailedCount}</strong>
        </article>
        <article>
          <small>مبيعات المنصات (الجلسة)</small>
          <strong style={{ fontSize: 17 }}>{money(todaySales)} ر.س</strong>
        </article>
      </div>

      {enabledConnections.length === 0 ? (
        <div className="pos-empty-state" style={{ minHeight: 200 }}>
          <span style={{ fontSize: 36 }}>🔌</span>
          <strong>لا توجد تكاملات مفعّلة</strong>
          <span>
            افتح الإعدادات → مركز التكاملات لربط منصات التوصيل.
            هنقرستيشن ومرسول وأي منصة أخرى ستظهر هنا تلقائياً بعد الربط.
          </span>
        </div>
      ) : visibleOrders.length === 0 ? (
        <div className="pos-empty-state" style={{ minHeight: 200 }}>
          <strong>لا توجد طلبات خارجية</strong>
          <span>ستظهر هنا طلبات المنصات المربوطة فور ورودها.</span>
        </div>
      ) : (
        <div className="pos-external-orders">
          {visibleOrders.map((order) => {
            const meta = providerRegistry.get(order.provider)?.meta;
            const logoColor = meta?.logoColor ?? '#1c4576';
            const logoInitial = meta?.logoInitial ?? order.provider.slice(0, 1).toUpperCase();
            const providerName = getProviderName(order);

            return (
              <article
                className={`pos-external-card provider-${order.provider}`}
                key={order.id}
                style={meta?.accentColor ? { borderTopColor: meta.accentColor } : undefined}
              >
                <header>
                  <div
                    className="pos-provider-logo"
                    style={{ background: logoColor, color: '#fff', fontWeight: 800, fontSize: 18 }}
                  >
                    {logoInitial}
                  </div>
                  <div>
                    <small>{providerName}</small>
                    <strong>{order.externalOrderNumber}</strong>
                    {order.internalOrderNumber && (
                      <small style={{ color: 'var(--pos-muted)', display: 'block', fontSize: 10 }}>
                        داخلي: {order.internalOrderNumber}
                      </small>
                    )}
                  </div>
                  <StatusBadge status={order.status} />
                </header>

                <dl>
                  <div><dt>وقت الوصول</dt><dd>{order.receivedAt}</dd></div>
                  <div><dt>العميل</dt><dd>{order.customerName}</dd></div>
                  <div><dt>عدد البنود</dt><dd>{order.itemCount}</dd></div>
                  <div><dt>الدفع</dt><dd>{order.paymentLabel}</dd></div>
                  <div className="is-total">
                    <dt>الإجمالي</dt>
                    <dd>{order.total.toFixed(2)} ر.س</dd>
                  </div>
                </dl>

                {order.issue && (
                  <div className="pos-warning-box">{order.issue}</div>
                )}

                {order.status === 'sync_failed' && order.syncError && (
                  <div className="pos-warning-box" style={{ color: 'var(--pos-red)', borderRight: '3px solid var(--pos-red)' }}>
                    <strong>⚠ فشلت المزامنة:</strong> {order.syncError}
                  </div>
                )}

                {order.rejectionReason && (
                  <div className="pos-warning-box">
                    <strong>سبب الرفض:</strong> {order.rejectionReason}
                  </div>
                )}

                <footer style={{ flexWrap: 'wrap' }}>
                  {order.status === 'new' && (
                    <button
                      type="button"
                      className="pos-button pos-button--primary"
                      style={{ flex: 2, minWidth: 140 }}
                      onClick={() => dispatch({ type: 'ACCEPT_EXTERNAL_ORDER', orderId: order.id })}
                    >
                      قبول وإرسال للمطبخ
                    </button>
                  )}

                  {order.status === 'new' && (
                    <button
                      type="button"
                      className="pos-button pos-button--danger"
                      onClick={() => setRejectOrder(order)}
                    >
                      رفض مع سبب
                    </button>
                  )}

                  {order.status === 'sync_failed' && (
                    <button
                      type="button"
                      className="pos-button pos-button--primary"
                      style={{ flex: 2 }}
                      onClick={() => dispatch({ type: 'RETRY_EXTERNAL_ORDER_SYNC', orderId: order.id })}
                    >
                      ↺ إعادة المحاولة
                    </button>
                  )}

                  <button
                    type="button"
                    className="pos-button pos-button--secondary"
                    onClick={() => setDetailsOrder(order)}
                  >
                    عرض التفاصيل
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {rejectOrder && (
        <RejectModal
          order={rejectOrder}
          onConfirm={(reason) =>
            dispatch({ type: 'REJECT_EXTERNAL_ORDER_WITH_REASON', orderId: rejectOrder.id, reason })
          }
          onClose={() => setRejectOrder(null)}
        />
      )}

      {detailsOrder && (
        <DetailsModal
          order={detailsOrder}
          providerName={getProviderName(detailsOrder)}
          onClose={() => setDetailsOrder(null)}
        />
      )}
    </section>
  );
}
