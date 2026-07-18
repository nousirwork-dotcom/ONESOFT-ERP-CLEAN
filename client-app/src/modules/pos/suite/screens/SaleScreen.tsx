import React from 'react';
import { InvoiceHeader } from '../components/InvoiceHeader';
import { ProductCatalog } from '../components/ProductCatalog';
import { CartPanel } from '../components/CartPanel';
import { usePOS } from '../state';

export function SaleScreen() {
  const { state, dispatch } = usePOS();
  return (
    <section className="pos-sale-screen">
      <div className="pos-sale-screen__main">
        <InvoiceHeader />
        <div className="pos-operation-bar">
          <button type="button" onClick={() => dispatch({ type: 'SET_NOTICE', notice: 'الطباعة ستستخدم نفس قوالب فاتورة المبيعات.' })}>طباعة</button>
          {state.mode === 'restaurant' ? <button type="button" onClick={() => dispatch({ type: 'SEND_TO_KITCHEN' })}>إرسال للمطبخ</button> : null}
          <button type="button" onClick={() => dispatch({ type: 'SET_NOTICE', notice: 'سيُربط الخصم بصلاحيات فاتورة المبيعات.' })}>خصم</button>
          <button type="button" onClick={() => dispatch({ type: 'SET_NOTICE', notice: 'سيُربط تغيير السعر بصلاحيات فاتورة المبيعات.' })}>تغيير السعر</button>
          <button type="button" onClick={() => dispatch({ type: 'SET_NOTICE', notice: 'يمكن إضافة ملاحظات الفاتورة والبنود هنا.' })}>ملاحظات</button>
          <button type="button" onClick={() => dispatch({ type: 'SET_SECTION', section: 'reports' })}>تقارير سريعة</button>
        </div>
        <ProductCatalog />
      </div>
      <CartPanel />
    </section>
  );
}
