import React, { useMemo, useState } from 'react';
import { usePOS } from '../state';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import type { ShiftSummary } from '../types';

function money(value: number) {
  return new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function ShiftsScreen() {
  const { state, dispatch } = usePOS();
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [openingCash, setOpeningCash] = useState(500);
  const [actualCash, setActualCash] = useState(0);

  const stats = useMemo(() => ({
    cashSales: state.currentShift ? 1860 : 0,
    cardSales: state.currentShift ? 3240 : 0,
    refunds: state.currentShift ? 120 : 0,
    expenses: state.currentShift ? 85 : 0,
    expectedCash: state.currentShift ? state.currentShift.openingCash + 1860 - 120 - 85 : 0,
  }), [state.currentShift]);

  const openShift = () => {
    const shift: ShiftSummary = {
      id: Date.now(),
      registerName: state.settings.registerName,
      cashierName: 'المستخدم الحالي',
      openedAt: new Date().toISOString(),
      openingCash,
      expectedCash: openingCash,
      status: 'open',
    };
    dispatch({ type: 'SET_SHIFT', shift });
    setOpenDialog(false);
  };

  const closeShift = () => {
    if (!state.currentShift) return;
    dispatch({
      type: 'SET_SHIFT',
      shift: {
        ...state.currentShift,
        expectedCash: stats.expectedCash,
        actualCash,
        status: 'pending_review',
      },
    });
    setCloseDialog(false);
  };

  return (
    <section className="pos-page">
      <header className="pos-page__header">
        <div>
          <small>إدارة الصندوق</small>
          <h1>الورديات والصندوق</h1>
          <p>فتح الوردية، متابعة النقدية وطرق الدفع، ثم الإغلاق والمراجعة.</p>
        </div>
        {!state.currentShift || state.currentShift.status !== 'open' ? (
          <button type="button" className="pos-button pos-button--primary" onClick={() => setOpenDialog(true)}>فتح وردية</button>
        ) : (
          <button type="button" className="pos-button pos-button--danger" onClick={() => setCloseDialog(true)}>إغلاق الوردية</button>
        )}
      </header>

      <div className="pos-kpi-grid">
        <article><small>المبيعات النقدية</small><strong>{money(stats.cashSales)} ر.س</strong></article>
        <article><small>مبيعات الشبكة</small><strong>{money(stats.cardSales)} ر.س</strong></article>
        <article><small>المرتجعات</small><strong>{money(stats.refunds)} ر.س</strong></article>
        <article><small>المصروفات والسحوبات</small><strong>{money(stats.expenses)} ر.س</strong></article>
        <article className="is-highlight"><small>النقد المتوقع</small><strong>{money(stats.expectedCash)} ر.س</strong></article>
      </div>

      <div className="pos-grid-2">
        <article className="pos-card">
          <header><h2>الوردية الحالية</h2>{state.currentShift ? <StatusBadge status={state.currentShift.status} /> : null}</header>
          {state.currentShift ? (
            <dl className="pos-details-list">
              <div><dt>نقطة البيع</dt><dd>{state.currentShift.registerName}</dd></div>
              <div><dt>الكاشير</dt><dd>{state.currentShift.cashierName}</dd></div>
              <div><dt>وقت الفتح</dt><dd>{new Date(state.currentShift.openedAt).toLocaleString('ar-SA')}</dd></div>
              <div><dt>الرصيد الافتتاحي</dt><dd>{money(state.currentShift.openingCash)} ر.س</dd></div>
              {state.currentShift.actualCash != null ? <div><dt>النقد الفعلي</dt><dd>{money(state.currentShift.actualCash)} ر.س</dd></div> : null}
            </dl>
          ) : <div className="pos-empty-state"><strong>لا توجد وردية مفتوحة</strong><span>افتح وردية قبل بدء البيع الفعلي.</span></div>}
        </article>
        <article className="pos-card">
          <header><h2>حركات الصندوق</h2><button type="button" className="pos-link-button">إضافة حركة</button></header>
          <div className="pos-list-rows">
            <div><span>رصيد افتتاحي</span><strong>+ {money(state.currentShift?.openingCash ?? 0)} ر.س</strong></div>
            <div><span>مصروف ضيافة</span><strong className="is-negative">- 35.00 ر.س</strong></div>
            <div><span>سحب نقدي للإدارة</span><strong className="is-negative">- 50.00 ر.س</strong></div>
          </div>
        </article>
      </div>

      <Modal open={openDialog} title="فتح وردية جديدة" onClose={() => setOpenDialog(false)}>
        <div className="pos-form-grid">
          <label><span>نقطة البيع</span><input value={state.settings.registerName} readOnly /></label>
          <label><span>الكاشير</span><input value="المستخدم الحالي" readOnly /></label>
          <label><span>الرصيد الافتتاحي</span><input type="number" min={0} value={openingCash} onChange={(event) => setOpeningCash(Number(event.target.value) || 0)} /></label>
          <label><span>ملاحظة</span><textarea placeholder="ملاحظة اختيارية" /></label>
        </div>
        <button type="button" className="pos-button pos-button--primary pos-button--block" onClick={openShift}>تأكيد فتح الوردية</button>
      </Modal>

      <Modal open={closeDialog} title="إغلاق الوردية" onClose={() => setCloseDialog(false)}>
        <div className="pos-shift-close-summary">
          <div><small>النقد المتوقع</small><strong>{money(stats.expectedCash)} ر.س</strong></div>
          <label><span>النقد الفعلي</span><input type="number" min={0} value={actualCash} onChange={(event) => setActualCash(Number(event.target.value) || 0)} /></label>
          <div className="pos-difference"><span>الفرق</span><strong>{money(actualCash - stats.expectedCash)} ر.س</strong></div>
        </div>
        <button type="button" className="pos-button pos-button--danger pos-button--block" onClick={closeShift}>إغلاق وإرسال للمراجعة</button>
      </Modal>
    </section>
  );
}
