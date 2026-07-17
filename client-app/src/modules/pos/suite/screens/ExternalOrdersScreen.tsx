import React, { useMemo, useState } from 'react';
import { usePOS } from '../state';
import { useIntegration } from '../integrations/context';
import { providerRegistry } from '../integrations/registry';
import { StatusBadge } from '../components/StatusBadge';

function money(v: number) {
  return new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

export function ExternalOrdersScreen() {
  const { state, dispatch } = usePOS();
  const { connections } = useIntegration();
  const [filterProvider, setFilterProvider] = useState<'all' | string>('all');

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
  const todaySales = state.externalOrders
    .filter((o) => o.status !== 'rejected' && o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.total, 0);

  return (
    <section className="pos-page">
      <header className="pos-page__header">
        <div>
          <small>Delivery Integration Hub</small>
          <h1>مركز الطلبات الخارجية</h1>
          <p>
            استقبال طلبات جميع منصات التوصيل المربوطة، قبولها، ثم إدخالها في مسار المطعم والمطبخ.
          </p>
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

      <div className="pos-kpi-grid pos-kpi-grid--compact">
        <article><small>طلبات جديدة</small><strong>{newCount}</strong></article>
        <article><small>قيد التحضير</small><strong>{preparingCount}</strong></article>
        <article className={reviewCount ? 'is-warning' : ''}>
          <small>تحتاج مراجعة</small>
          <strong>{reviewCount}</strong>
        </article>
        <article>
          <small>مبيعات المنصات (الجلسة)</small>
          <strong>{money(todaySales)} ر.س</strong>
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
            const conn = enabledConnections.find((c) => c.providerId === order.provider);
            const meta = providerRegistry.get(order.provider)?.meta;
            const logoColor = meta?.logoColor ?? '#1c4576';
            const logoInitial = meta?.logoInitial ?? order.provider.slice(0, 1).toUpperCase();
            const providerName = conn?.providerName ?? meta?.name ?? order.provider;

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
                {order.issue ? <div className="pos-warning-box">{order.issue}</div> : null}
                <footer>
                  {order.status === 'new' ? (
                    <>
                      <button
                        type="button"
                        className="pos-button pos-button--primary"
                        onClick={() => dispatch({ type: 'ACCEPT_EXTERNAL_ORDER', orderId: order.id })}
                      >
                        قبول وإرسال للمطبخ
                      </button>
                      <button
                        type="button"
                        className="pos-button pos-button--danger"
                        onClick={() => dispatch({ type: 'REJECT_EXTERNAL_ORDER', orderId: order.id })}
                      >
                        رفض
                      </button>
                    </>
                  ) : (
                    <button type="button" className="pos-button pos-button--secondary">
                      عرض التفاصيل
                    </button>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
