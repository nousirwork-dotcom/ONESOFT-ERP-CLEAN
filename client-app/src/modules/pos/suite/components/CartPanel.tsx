import React, { useState } from 'react';
import { usePOS } from '../state';
import { StatusBadge } from './StatusBadge';
import { Modal } from './Modal';
import { OpenOrdersDialog } from './OpenOrdersDialog';

function money(value: number) {
  return new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

const PAYMENT_METHODS = ['نقدي', 'شبكة', 'تحويل', 'آجل', 'دفع مختلط'] as const;
type PaymentMethod = typeof PAYMENT_METHODS[number];

export function CartPanel() {
  const { state, dispatch, totals } = usePOS();

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [openOrdersOpen, setOpenOrdersOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('نقدي');
  const [received, setReceived] = useState('');
  const [mixedCash, setMixedCash] = useState('');
  const [mixedNetwork, setMixedNetwork] = useState('');
  const [mixedTransfer, setMixedTransfer] = useState('');

  const receivedNum = Number(received) || 0;
  const change = payMethod === 'نقدي' ? Math.max(0, receivedNum - totals.total) : 0;
  const deficit = payMethod === 'نقدي' ? Math.max(0, totals.total - receivedNum) : 0;
  const mixedSum = Number(mixedCash) + Number(mixedNetwork) + Number(mixedTransfer);
  const mixedRemaining = Math.max(0, totals.total - mixedSum);
  const mixedOver = Math.max(0, mixedSum - totals.total);

  const handleOpenPayment = () => {
    setPayMethod('نقدي');
    setReceived(totals.total.toFixed(2));
    setMixedCash('');
    setMixedNetwork('');
    setMixedTransfer('');
    setPaymentOpen(true);
  };

  const handleConfirmPayment = () => {
    dispatch({ type: 'SET_NOTICE', notice: 'واجهة الدفع جاهزة للربط بخدمة فاتورة المبيعات.' });
    setPaymentOpen(false);
  };

  const suspendedCount = state.suspendedOrders.length;

  return (
    <aside className="pos-cart">
      <header className="pos-cart__header">
        <div>
          <small>الطلب الحالي</small>
          <strong>{state.mode === 'restaurant' ? 'R-جديد' : 'فاتورة جديدة'}</strong>
        </div>
        <StatusBadge status={state.orderStatus} />
      </header>

      <div className="pos-cart__actions">
        {state.mode === 'restaurant' ? (
          <>
            <button
              type="button"
              onClick={() => dispatch({ type: 'SEND_TO_KITCHEN' })}
              disabled={!state.cart.some((line) => line.kitchenStatus === 'new')}
            >
              إرسال للمطبخ
            </button>
            <button type="button" onClick={() => dispatch({ type: 'SUSPEND_ORDER' })}>تعليق</button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => dispatch({ type: 'SUSPEND_ORDER' })}>تعليق</button>
            <button
              type="button"
              onClick={() => setOpenOrdersOpen(true)}
              style={suspendedCount > 0 ? { borderColor: 'var(--pos-gold)', color: 'var(--pos-blue)', fontWeight: 800 } : undefined}
            >
              استرجاع{suspendedCount > 0 ? ` (${suspendedCount})` : ''}
            </button>
          </>
        )}
        <button type="button" onClick={() => dispatch({ type: 'NEW_ORDER' })}>طلب جديد</button>
        {state.mode === 'restaurant' && (
          <button
            type="button"
            onClick={() => setOpenOrdersOpen(true)}
            style={suspendedCount > 0 ? { borderColor: 'var(--pos-gold)', color: 'var(--pos-blue)', fontWeight: 800 } : undefined}
          >
            معلق{suspendedCount > 0 ? ` (${suspendedCount})` : ''}
          </button>
        )}
      </div>

      <div className="pos-cart__lines">
        {state.cart.length === 0 ? (
          <div className="pos-cart__empty">
            <span>🛒</span>
            <strong>الطلب فارغ</strong>
            <small>اختر صنفًا من القائمة أو امسح الباركود.</small>
          </div>
        ) : state.cart.map((line) => {
          const base = line.quantity * line.unitPrice;
          return (
            <article className="pos-cart-line" key={line.id}>
              <div className="pos-cart-line__main">
                <span className="pos-cart-line__image">{line.name.slice(0, 1)}</span>
                <div>
                  <strong>{line.name}</strong>
                  <small>{line.productCode} • {line.unitName}</small>
                  {line.modifiers.length ? (
                    <em>{line.modifiers.map((item) => item.name).join('، ')}</em>
                  ) : null}
                  {line.notes ? <em>ملاحظة: {line.notes}</em> : null}
                </div>
                {state.mode === 'restaurant' ? <StatusBadge status={line.kitchenStatus} /> : null}
              </div>
              <div className="pos-cart-line__controls">
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'CHANGE_QTY', lineId: line.id, delta: -1 })}
                >
                  −
                </button>
                <b>{line.quantity}</b>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'CHANGE_QTY', lineId: line.id, delta: 1 })}
                >
                  +
                </button>
                <span>{money(base)} ر.س</span>
                <button
                  type="button"
                  className="is-danger"
                  onClick={() => dispatch({ type: 'REMOVE_LINE', lineId: line.id })}
                >
                  ×
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <footer className="pos-cart__footer">
        <dl>
          <div><dt>الإجمالي قبل الضريبة</dt><dd>{money(totals.subtotal - totals.discount)} ر.س</dd></div>
          <div><dt>الخصم</dt><dd>{money(totals.discount)} ر.س</dd></div>
          <div><dt>الضريبة</dt><dd>{money(totals.tax)} ر.س</dd></div>
          <div className="is-total"><dt>الإجمالي النهائي</dt><dd>{money(totals.total)} ر.س</dd></div>
        </dl>
        <button
          type="button"
          className="pos-pay-button"
          onClick={handleOpenPayment}
          disabled={!state.cart.length}
        >
          الدفع • {money(totals.total)} ر.س
        </button>
      </footer>

      {/* ─── Payment Modal ─────────────────────────────────────────────────── */}
      <Modal open={paymentOpen} title="إتمام الدفع" onClose={() => setPaymentOpen(false)} width={680}>
        <div className="pos-payment">
          <div className="pos-payment__amount">
            <small>المبلغ المطلوب</small>
            <strong>{money(totals.total)} ر.س</strong>
            <span style={{ fontSize: 12, color: 'var(--pos-muted)', marginTop: 6, display: 'block' }}>
              قبل الضريبة: {money(totals.subtotal - totals.discount)} ر.س
              &nbsp;•&nbsp;
              ضريبة القيمة المضافة: {money(totals.tax)} ر.س
            </span>
          </div>

          <div className="pos-payment__methods">
            {PAYMENT_METHODS.map((method) => (
              <button
                type="button"
                key={method}
                className={payMethod === method ? 'is-selected' : ''}
                onClick={() => setPayMethod(method)}
              >
                {method}
              </button>
            ))}
          </div>

          {payMethod === 'نقدي' && (
            <div className="pos-payment__detail">
              <label>
                المبلغ المستلم
                <input
                  type="number"
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                  min={0}
                  step="0.01"
                  autoFocus
                />
              </label>
              <div className="pos-payment__change">
                <div>
                  <small>الباقي للعميل</small>
                  <strong className={change > 0 ? 'is-positive' : 'is-negative'}>
                    {money(change)} ر.س
                  </strong>
                </div>
                {deficit > 0 && (
                  <div>
                    <small>ناقص</small>
                    <strong className="is-negative">{money(deficit)} ر.س</strong>
                  </div>
                )}
              </div>
            </div>
          )}

          {(payMethod === 'شبكة' || payMethod === 'تحويل' || payMethod === 'آجل') && (
            <div className="pos-payment__detail">
              <div className="pos-payment__change">
                <div>
                  <small>المبلغ الكامل عبر {payMethod}</small>
                  <strong>{money(totals.total)} ر.س</strong>
                </div>
                <div>
                  <small>الباقي</small>
                  <strong className="is-positive">0.00 ر.س</strong>
                </div>
              </div>
            </div>
          )}

          {payMethod === 'دفع مختلط' && (
            <div className="pos-payment__detail">
              <div className="pos-payment__mixed">
                <label>
                  نقدي
                  <input
                    type="number"
                    value={mixedCash}
                    onChange={(e) => setMixedCash(e.target.value)}
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                  />
                </label>
                <label>
                  شبكة
                  <input
                    type="number"
                    value={mixedNetwork}
                    onChange={(e) => setMixedNetwork(e.target.value)}
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                  />
                </label>
                <label>
                  تحويل
                  <input
                    type="number"
                    value={mixedTransfer}
                    onChange={(e) => setMixedTransfer(e.target.value)}
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                  />
                </label>
              </div>
              <div className="pos-payment__change">
                <div>
                  <small>المُدفوع</small>
                  <strong>{money(mixedSum)} ر.س</strong>
                </div>
                <div>
                  <small>{mixedRemaining > 0 ? 'المتبقي' : mixedOver > 0 ? 'زيادة' : 'مكتمل'}</small>
                  <strong className={mixedRemaining > 0 ? 'is-negative' : mixedOver > 0 ? 'is-positive' : ''}>
                    {mixedRemaining > 0
                      ? `${money(mixedRemaining)} ر.س`
                      : mixedOver > 0
                      ? `+${money(mixedOver)} ر.س`
                      : '✓'}
                  </strong>
                </div>
              </div>
            </div>
          )}

          <div className="pos-payment__note">
            واجهة تصميم فقط. الربط الكامل بفاتورة المبيعات وطرق الدفع في المرحلة التالية.
          </div>
          <button
            type="button"
            className="pos-button pos-button--primary pos-button--block"
            onClick={handleConfirmPayment}
          >
            تأكيد الدفع — {money(totals.total)} ر.س
          </button>
        </div>
      </Modal>

      {/* ─── Open Orders Dialog ───────────────────────────────────────────── */}
      <OpenOrdersDialog open={openOrdersOpen} onClose={() => setOpenOrdersOpen(false)} />
    </aside>
  );
}
