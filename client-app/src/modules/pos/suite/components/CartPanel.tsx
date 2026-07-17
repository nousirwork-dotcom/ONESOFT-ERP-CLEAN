import React, { useState } from 'react';
import { usePOS } from '../state';
import { StatusBadge } from './StatusBadge';
import { Modal } from './Modal';

function money(value: number) {
  return new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function CartPanel() {
  const { state, dispatch, totals } = usePOS();
  const [paymentOpen, setPaymentOpen] = useState(false);

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
            <button type="button" onClick={() => dispatch({ type: 'SEND_TO_KITCHEN' })} disabled={!state.cart.some((line) => line.kitchenStatus === 'new')}>إرسال للمطبخ</button>
            <button type="button" onClick={() => dispatch({ type: 'SET_NOTICE', notice: 'تم تعليق الطلب في نموذج الواجهة.' })}>تعليق</button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => dispatch({ type: 'SET_NOTICE', notice: 'تم تعليق عملية البيع في نموذج الواجهة.' })}>تعليق</button>
            <button type="button" onClick={() => dispatch({ type: 'SET_NOTICE', notice: 'سيُربط استرجاع العمليات المعلقة بخدمة الحفظ لاحقًا.' })}>استرجاع</button>
          </>
        )}
        <button type="button" onClick={() => dispatch({ type: 'NEW_ORDER' })}>طلب جديد</button>
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
                  {line.modifiers.length ? <em>{line.modifiers.map((item) => item.name).join('، ')}</em> : null}
                </div>
                {state.mode === 'restaurant' ? <StatusBadge status={line.kitchenStatus} /> : null}
              </div>
              <div className="pos-cart-line__controls">
                <button type="button" onClick={() => dispatch({ type: 'CHANGE_QTY', lineId: line.id, delta: -1 })}>−</button>
                <b>{line.quantity}</b>
                <button type="button" onClick={() => dispatch({ type: 'CHANGE_QTY', lineId: line.id, delta: 1 })}>+</button>
                <span>{money(base)} ر.س</span>
                <button type="button" className="is-danger" onClick={() => dispatch({ type: 'REMOVE_LINE', lineId: line.id })}>×</button>
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
        <button type="button" className="pos-pay-button" onClick={() => setPaymentOpen(true)} disabled={!state.cart.length}>الدفع • {money(totals.total)} ر.س</button>
      </footer>

      <Modal open={paymentOpen} title="الدفع" onClose={() => setPaymentOpen(false)} width={720}>
        <div className="pos-payment">
          <div className="pos-payment__amount">
            <small>المبلغ المطلوب</small>
            <strong>{money(totals.total)} ر.س</strong>
          </div>
          <div className="pos-payment__methods">
            {['نقدي', 'شبكة', 'تحويل', 'آجل', 'دفع مختلط'].map((method) => (
              <button type="button" key={method}>{method}</button>
            ))}
          </div>
          <div className="pos-payment__note">هذه واجهة تصميم فقط. الربط النهائي سيستخدم نفس خدمة فاتورة المبيعات وطرق الدفع الحالية.</div>
          <button type="button" className="pos-button pos-button--primary" onClick={() => {
            dispatch({ type: 'SET_NOTICE', notice: 'واجهة الدفع جاهزة للربط بنفس فاتورة المبيعات العادية.' });
            setPaymentOpen(false);
          }}>تأكيد تجريبي</button>
        </div>
      </Modal>
    </aside>
  );
}
