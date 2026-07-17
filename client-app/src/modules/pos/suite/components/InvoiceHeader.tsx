import React, { useState } from 'react';
import { usePOS } from '../state';
import { usePOSCatalog } from '../catalog-context';
import type { OrderType } from '../types';
import { Modal } from './Modal';

const orderTypes: Array<{ value: OrderType; label: string }> = [
  { value: 'dine_in', label: 'محلي' },
  { value: 'takeaway', label: 'سفري' },
  { value: 'delivery', label: 'توصيل' },
  { value: 'pickup', label: 'استلام' },
];

export function InvoiceHeader() {
  const { state, dispatch } = usePOS();
  const {
    journals,
    warehouses,
    customers,
    selectedJournalId,
    selectedWarehouseId,
    previewNumber,
    previewLoading,
    onJournalChange,
    onWarehouseChange,
    onAddCustomer,
  } = usePOSCatalog();
  const [customerOpen, setCustomerOpen] = useState(false);

  const journal = journals.find((item) => item.id === selectedJournalId);
  const warehouse = warehouses.find((item) => item.id === selectedWarehouseId);
  const today = new Intl.DateTimeFormat('en-CA').format(new Date());

  return (
    <>
      <header className="pos-invoice-header">
        <div className="pos-invoice-header__meta">

          <label className="pos-meta-chip pos-meta-chip--select">
            <small>الدفتر</small>
            <select
              value={selectedJournalId ?? ''}
              onChange={(e) => { const v = Number(e.target.value); if (v) onJournalChange(v); }}
            >
              <option value="">— اختر دفتر المبيعات —</option>
              {journals.map((j) => (
                <option key={j.id} value={j.id}>{j.code} — {j.name}</option>
              ))}
            </select>
          </label>

          <label className="pos-meta-chip pos-meta-chip--select">
            <small>المخزن</small>
            <select
              value={selectedWarehouseId ?? ''}
              onChange={(e) => { const v = Number(e.target.value); if (v) onWarehouseChange(v); }}
            >
              <option value="">— اختر مستودع —</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
              ))}
            </select>
          </label>

          <div className="pos-meta-chip">
            <small>رقم استرشادي</small>
            <strong>
              {previewLoading
                ? '...'
                : previewNumber
                  ? previewNumber
                  : journal?.previewNumber ?? (selectedJournalId ? '—' : 'اختر دفتراً')}
            </strong>
          </div>

          <div className="pos-meta-chip">
            <small>التاريخ</small>
            <strong>{today}</strong>
          </div>
        </div>

        <button
          type="button"
          className="pos-customer-button"
          onClick={() => setCustomerOpen(true)}
          title="اختيار العميل (F4)"
        >
          <span className="pos-customer-button__avatar">
            {state.customer?.name.slice(0, 1) ?? 'ع'}
          </span>
          <span>
            <small>العميل</small>
            <strong>{state.customer?.name ?? 'اختيار العميل'}</strong>
            {state.customer ? (
              <em>
                {state.customer.customerType === 'organization' ? 'مؤسسة' : 'فرد'}
                {state.customer.phone ? ` • ${state.customer.phone}` : ''}
                {state.customer.taxNumber ? ` • ض: ${state.customer.taxNumber}` : ''}
              </em>
            ) : null}
          </span>
        </button>
      </header>

      {state.mode === 'restaurant' ? (
        <div className="pos-order-types" role="tablist" aria-label="نوع الطلب">
          {orderTypes.map((item) => (
            <button
              type="button"
              key={item.value}
              className={state.orderType === item.value ? 'is-active' : ''}
              onClick={() => dispatch({ type: 'SET_ORDER_TYPE', orderType: item.value })}
            >
              {item.label}
            </button>
          ))}
          {state.orderType === 'dine_in' ? (
            <div className="pos-order-types__extra">
              <button
                type="button"
                onClick={() => dispatch({ type: 'SET_SECTION', section: 'tables' })}
              >
                {state.selectedTableId ? `الطاولة ${state.selectedTableId}` : 'اختيار الطاولة'}
              </button>
              <label>
                الضيوف
                <input
                  type="number"
                  min={1}
                  value={state.guestCount}
                  onChange={(event) =>
                    dispatch({ type: 'SET_GUEST_COUNT', guestCount: Number(event.target.value) || 1 })
                  }
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      <Modal open={customerOpen} title="اختيار العميل" onClose={() => setCustomerOpen(false)}>
        <div className="pos-customer-list">
          {customers.length === 0 ? (
            <p style={{ padding: '16px', textAlign: 'center', color: 'var(--pos-muted)' }}>
              جارٍ تحميل قائمة العملاء...
            </p>
          ) : (
            customers.map((customer) => (
              <button
                type="button"
                key={customer.id}
                className={state.customer?.id === customer.id ? 'is-selected' : ''}
                onClick={() => {
                  dispatch({ type: 'SET_CUSTOMER', customer });
                  setCustomerOpen(false);
                }}
              >
                <strong>{customer.code} — {customer.name}</strong>
                <span>
                  {customer.customerType === 'organization' ? 'مؤسسة' : 'فرد'}
                  {customer.phone ? ` • ${customer.phone}` : ''}
                </span>
                {customer.taxNumber ? (
                  <small>الرقم الضريبي: {customer.taxNumber}</small>
                ) : null}
              </button>
            ))
          )}
          <button
            type="button"
            className="pos-button pos-button--secondary"
            onClick={() => { setCustomerOpen(false); onAddCustomer(); }}
          >
            + إضافة عميل جديد
          </button>
        </div>
      </Modal>
    </>
  );
}
