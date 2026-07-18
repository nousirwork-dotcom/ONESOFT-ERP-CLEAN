import React, { useState } from 'react';
import { usePOS } from '../state';
import { usePOSCatalog } from '../catalog-context';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import type { ShiftSummary } from '../types';

function money(value: number) {
  return new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function ShiftsScreen() {
  const { state, dispatch } = usePOS();
  const { cashierName } = usePOSCatalog();
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [openingCash, setOpeningCash] = useState(500);
  const [actualCash, setActualCash] = useState(0);

  const openShift = () => {
    const shift: ShiftSummary = {
      id: Date.now(),
      registerName: state.settings.registerName,
      cashierName,
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
        actualCash,
        status: 'pending_review',
      },
    });
    setCloseDialog(false);
  };

  const openingCashAmount = state.currentShift?.openingCash ?? 0;

  return (
    <section className="pos-page">
      <header className="pos-page__header">
        <div>
          <small>إدارة الصندوق</small>
          <h1>الورديات والصندوق</h1>
          <p>فتح الوردية، متابعة النقدية وطرق الدفع، ثم الإغلاق والمراجعة.</p>
        </div>
        {!state.currentShift || state.currentShift.status !== 'open' ? (
          <button type="button" className="pos-button pos-button--primary" onClick={() => setOpenDialog(true)}>
            فتح وردية
          </button>
        ) : (
          <button type="button" className="pos-button pos-button--danger" onClick={() => setCloseDialog(true)}>
            إغلاق الوردية
          </button>
        )}
      </header>

      <div className="pos-kpi-grid">
        <article><small>المبيعات النقدية</small><strong>{money(0)} ر.س</strong></article>
        <article><small>مبيعات الشبكة</small><strong>{money(0)} ر.س</strong></article>
        <article><small>المرتجعات</small><strong>{money(0)} ر.س</strong></article>
        <article><small>المصروفات والسحوبات</small><strong>{money(0)} ر.س</strong></article>
        <article className="is-highlight">
          <small>النقد المتوقع</small>
          <strong>{money(openingCashAmount)} ر.س</strong>
        </article>
      </div>

      <div className="pos-grid-2">
        <article className="pos-card">
          <header>
            <h2>الوردية الحالية</h2>
            {state.currentShift ? <StatusBadge status={state.currentShift.status} /> : null}
          </header>
          {state.currentShift ? (
            <dl className="pos-details-list">
              <div><dt>نقطة البيع</dt><dd>{state.currentShift.registerName}</dd></div>
              <div><dt>الكاشير</dt><dd>{state.currentShift.cashierName}</dd></div>
              <div><dt>وقت الفتح</dt><dd>{new Date(state.currentShift.openedAt).toLocaleString('ar-SA')}</dd></div>
              <div><dt>الرصيد الافتتاحي</dt><dd>{money(state.currentShift.openingCash)} ر.س</dd></div>
              {state.currentShift.actualCash != null ? (
                <div><dt>النقد الفعلي</dt><dd>{money(state.currentShift.actualCash)} ر.س</dd></div>
              ) : null}
            </dl>
          ) : (
            <div className="pos-empty-state">
              <strong>لا توجد وردية مفتوحة</strong>
              <span>افتح وردية قبل بدء البيع الفعلي.</span>
            </div>
          )}
        </article>

        <article className="pos-card">
          <header>
            <h2>حركات الصندوق</h2>
            <button
              type="button"
              className="pos-link-button"
              onClick={() =>
                dispatch({ type: 'SET_NOTICE', notice: 'إضافة الحركات اليدوية ستكون متاحة في المرحلة القادمة.' })
              }
            >
              إضافة حركة
            </button>
          </header>
          {state.currentShift ? (
            <div className="pos-empty-state" style={{ minHeight: 100 }}>
              <strong>لا توجد حركات مسجّلة</strong>
              <span>ستظهر هنا حركات الصندوق بعد ربط خدمة الحفظ.</span>
            </div>
          ) : (
            <div className="pos-empty-state" style={{ minHeight: 100 }}>
              <strong>الوردية مغلقة</strong>
              <span>افتح وردية لتسجيل حركات الصندوق.</span>
            </div>
          )}
        </article>
      </div>

      <Modal open={openDialog} title="فتح وردية جديدة" onClose={() => setOpenDialog(false)}>
        <div className="pos-form-grid">
          <label><span>نقطة البيع</span><input value={state.settings.registerName} readOnly /></label>
          <label><span>الكاشير</span><input value={cashierName} readOnly /></label>
          <label>
            <span>الرصيد الافتتاحي</span>
            <input
              type="number"
              min={0}
              value={openingCash}
              onChange={(event) => setOpeningCash(Number(event.target.value) || 0)}
            />
          </label>
          <label><span>ملاحظة</span><textarea placeholder="ملاحظة اختيارية" /></label>
        </div>
        <button
          type="button"
          className="pos-button pos-button--primary pos-button--block"
          onClick={openShift}
        >
          تأكيد فتح الوردية
        </button>
      </Modal>

      <Modal open={closeDialog} title="إغلاق الوردية" onClose={() => setCloseDialog(false)}>
        <div className="pos-shift-close-summary">
          <div>
            <small>الرصيد الافتتاحي</small>
            <strong>{money(openingCashAmount)} ر.س</strong>
          </div>
          <label>
            <span>النقد الفعلي</span>
            <input
              type="number"
              min={0}
              value={actualCash}
              onChange={(event) => setActualCash(Number(event.target.value) || 0)}
            />
          </label>
          <div className="pos-difference">
            <span>الفرق عن الافتتاحي</span>
            <strong>{money(actualCash - openingCashAmount)} ر.س</strong>
          </div>
        </div>
        <button
          type="button"
          className="pos-button pos-button--danger pos-button--block"
          onClick={closeShift}
        >
          إغلاق وإرسال للمراجعة
        </button>
      </Modal>
    </section>
  );
}
