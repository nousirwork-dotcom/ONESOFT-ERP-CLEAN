import React from 'react';
import { usePOS } from '../state';
import { StatusBadge } from '../components/StatusBadge';

export function TablesScreen() {
  const { state, dispatch } = usePOS();
  const areas = Array.from(new Set(state.tables.map((table) => table.areaName)));
  return (
    <section className="pos-page">
      <header className="pos-page__header">
        <div>
          <small>إدارة الصالة</small>
          <h1>المطاعم والطاولات</h1>
          <p>فتح الطلبات، معرفة حالة كل طاولة، والانتقال السريع إلى الطلب الحالي.</p>
        </div>
        <div className="pos-table-legend">
          {['available', 'occupied', 'kitchen', 'ready', 'reserved'].map((status) => <StatusBadge key={status} status={status} />)}
        </div>
      </header>
      {areas.map((area) => (
        <div className="pos-area" key={area}>
          <header><h2>{area}</h2><span>{state.tables.filter((table) => table.areaName === area).length} طاولات</span></header>
          <div className="pos-table-grid">
            {state.tables.filter((table) => table.areaName === area).map((table) => (
              <button
                type="button"
                key={table.id}
                className={`pos-table-card pos-table-card--${table.status} ${state.selectedTableId === table.id ? 'is-selected' : ''}`}
                onClick={() => {
                  dispatch({ type: 'SELECT_TABLE', tableId: table.id });
                  dispatch({ type: 'SET_SECTION', section: 'sale' });
                }}
              >
                <div className="pos-table-card__top"><strong>{table.name}</strong><StatusBadge status={table.status} /></div>
                <span>{table.seats} مقاعد</span>
                {table.activeOrderNumber ? <div><b>{table.activeOrderNumber}</b><small>{table.elapsedMinutes} دقيقة</small></div> : <em>اضغط لفتح طلب</em>}
                {table.amount != null ? <strong>{table.amount.toFixed(2)} ر.س</strong> : null}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
