import React, { useMemo, useState } from 'react';
import { usePOS } from '../state';
import { StatusBadge } from '../components/StatusBadge';
import type { KitchenItemStatus } from '../types';

const statusOrder: KitchenItemStatus[] = ['sent', 'preparing', 'ready', 'served'];

export function KitchenScreen() {
  const { state, dispatch } = usePOS();
  const [station, setStation] = useState('الكل');
  const stations = ['الكل', ...Array.from(new Set(state.kitchenTickets.map((ticket) => ticket.stationName)))];
  const tickets = useMemo(() => state.kitchenTickets.filter((ticket) => station === 'الكل' || ticket.stationName === station), [state.kitchenTickets, station]);

  return (
    <section className="pos-page pos-kitchen-page">
      <header className="pos-page__header">
        <div>
          <small>Kitchen Display System</small>
          <h1>شاشة المطبخ KDS</h1>
          <p>متابعة البنود من الإرسال إلى التحضير ثم الجاهزية والتقديم.</p>
        </div>
        <div className="pos-segmented">
          {stations.map((item) => <button type="button" key={item} className={station === item ? 'is-active' : ''} onClick={() => setStation(item)}>{item}</button>)}
        </div>
      </header>
      <div className="pos-kitchen-grid">
        {tickets.map((ticket) => (
          <article className={`pos-kitchen-ticket ${ticket.elapsedMinutes >= 15 ? 'is-late' : ''}`} key={ticket.id}>
            <header>
              <div><small>{ticket.stationName}</small><strong>طلب {ticket.orderNumber}</strong></div>
              <div className="pos-timer">{ticket.elapsedMinutes} د</div>
            </header>
            <div className="pos-kitchen-ticket__meta">
              <span>{ticket.tableName ?? 'بدون طاولة'}</span>
              <span>{ticket.waiterName ?? 'كاشير'}</span>
              <span>{ticket.openedAt}</span>
            </div>
            <div className="pos-kitchen-items">
              {ticket.items.map((item) => {
                const index = statusOrder.indexOf(item.status);
                const nextLabel = item.status === 'sent' ? 'بدء التحضير' : item.status === 'preparing' ? 'جاهز' : item.status === 'ready' ? 'تم التقديم' : 'مكتمل';
                return (
                  <div className="pos-kitchen-item" key={item.id}>
                    <div><strong>{item.quantity}× {item.name}</strong>{item.notes ? <small>{item.notes}</small> : null}</div>
                    <StatusBadge status={item.status} />
                    <button type="button" disabled={index >= statusOrder.length - 1} onClick={() => dispatch({ type: 'ADVANCE_KITCHEN_ITEM', ticketId: ticket.id, itemId: item.id })}>{nextLabel}</button>
                  </div>
                );
              })}
            </div>
            <footer><button type="button">تأخير</button><button type="button">استدعاء النادل</button></footer>
          </article>
        ))}
      </div>
    </section>
  );
}
