import React, { useMemo, useState } from 'react';
import { usePOS } from '../state';
import { StatusBadge } from '../components/StatusBadge';
import type { ExternalProvider } from '../types';

const providerLabel: Record<ExternalProvider, string> = {
  hungerstation: 'هنقرستيشن',
  mrsool: 'مرسول',
};

export function ExternalOrdersScreen() {
  const { state, dispatch } = usePOS();
  const [provider, setProvider] = useState<'all' | ExternalProvider>('all');
  const visibleOrders = useMemo(() => state.externalOrders.filter((order) => provider === 'all' || order.provider === provider), [state.externalOrders, provider]);
  const newCount = state.externalOrders.filter((order) => order.status === 'new').length;
  const reviewCount = state.externalOrders.filter((order) => order.status === 'needs_review').length;
  const preparingCount = state.externalOrders.filter((order) => order.status === 'preparing').length;

  return (
    <section className="pos-page">
      <header className="pos-page__header">
        <div>
          <small>Delivery Integration Hub</small>
          <h1>مركز الطلبات الخارجية</h1>
          <p>استقبال طلبات هنقرستيشن ومرسول، قبولها، ثم إدخالها في نفس مسار المطعم والمطبخ.</p>
        </div>
        <div className="pos-segmented">
          <button type="button" className={provider === 'all' ? 'is-active' : ''} onClick={() => setProvider('all')}>الكل</button>
          <button type="button" className={provider === 'hungerstation' ? 'is-active' : ''} onClick={() => setProvider('hungerstation')}>هنقرستيشن</button>
          <button type="button" className={provider === 'mrsool' ? 'is-active' : ''} onClick={() => setProvider('mrsool')}>مرسول</button>
        </div>
      </header>
      <div className="pos-kpi-grid pos-kpi-grid--compact">
        <article><small>طلبات جديدة</small><strong>{newCount}</strong></article>
        <article><small>قيد التحضير</small><strong>{preparingCount}</strong></article>
        <article className={reviewCount ? 'is-warning' : ''}><small>تحتاج مراجعة</small><strong>{reviewCount}</strong></article>
        <article><small>مبيعات المنصات اليوم</small><strong>234.00 ر.س</strong></article>
      </div>
      <div className="pos-external-orders">
        {visibleOrders.map((order) => (
          <article className={`pos-external-card provider-${order.provider}`} key={order.id}>
            <header>
              <div className="pos-provider-logo">{order.provider === 'hungerstation' ? 'H' : 'M'}</div>
              <div><small>{providerLabel[order.provider]}</small><strong>{order.externalOrderNumber}</strong></div>
              <StatusBadge status={order.status} />
            </header>
            <dl>
              <div><dt>وقت الوصول</dt><dd>{order.receivedAt}</dd></div>
              <div><dt>العميل</dt><dd>{order.customerName}</dd></div>
              <div><dt>عدد البنود</dt><dd>{order.itemCount}</dd></div>
              <div><dt>الدفع</dt><dd>{order.paymentLabel}</dd></div>
              <div className="is-total"><dt>الإجمالي</dt><dd>{order.total.toFixed(2)} ر.س</dd></div>
            </dl>
            {order.issue ? <div className="pos-warning-box">{order.issue}</div> : null}
            <footer>
              {order.status === 'new' ? (
                <>
                  <button type="button" className="pos-button pos-button--primary" onClick={() => dispatch({ type: 'ACCEPT_EXTERNAL_ORDER', orderId: order.id })}>قبول وإرسال للمطبخ</button>
                  <button type="button" className="pos-button pos-button--danger" onClick={() => dispatch({ type: 'REJECT_EXTERNAL_ORDER', orderId: order.id })}>رفض</button>
                </>
              ) : <button type="button" className="pos-button pos-button--secondary">عرض التفاصيل</button>}
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
