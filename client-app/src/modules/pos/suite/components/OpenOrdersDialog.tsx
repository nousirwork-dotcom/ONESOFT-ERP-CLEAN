import React from 'react';
import { Modal } from './Modal';
import { usePOS } from '../state';
import { StatusBadge } from './StatusBadge';

function money(v: number) {
  return new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function formatTime(iso: string) {
  try {
    return new Intl.DateTimeFormat('ar-SA', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

const orderTypeLabel: Record<string, string> = {
  dine_in: 'محلي',
  takeaway: 'سفري',
  delivery: 'توصيل',
  pickup: 'استلام',
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export function OpenOrdersDialog({ open, onClose }: Props) {
  const { state, dispatch } = usePOS();
  const suspended = state.suspendedOrders;

  const handleRestore = (orderId: string) => {
    dispatch({ type: 'RESTORE_ORDER', orderId });
    onClose();
  };

  return (
    <Modal open={open} title="الطلبات المعلقة" onClose={onClose} width={680}>
      <div className="pos-open-orders">
        {suspended.length === 0 ? (
          <div className="pos-empty-state" style={{ minHeight: 180 }}>
            <span style={{ fontSize: 36 }}>📋</span>
            <strong>لا توجد طلبات معلقة</strong>
            <span>استخدم زر "تعليق" لحفظ الطلب الحالي واسترجاعه لاحقاً.</span>
          </div>
        ) : (
          suspended.map((order) => (
            <article className="pos-open-order-row" key={order.id}>
              <div className="pos-order-meta">
                <strong>{order.orderNumber}</strong>
                <span>
                  {orderTypeLabel[order.orderType] ?? order.orderType}
                  {order.tableName ? ` • ${order.tableName}` : ''}
                  {order.customer ? ` • ${order.customer.name}` : ''}
                </span>
                <span>
                  وقت التعليق: {formatTime(order.openedAt)} •{' '}
                  {order.itemCount} {order.itemCount === 1 ? 'صنف' : 'أصناف'}
                </span>
                <StatusBadge status="open" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <div className="pos-order-amount">{money(order.total)} ر.س</div>
                <button
                  type="button"
                  className="pos-button pos-button--primary"
                  style={{ minHeight: 42, padding: '0 18px' }}
                  onClick={() => handleRestore(order.id)}
                >
                  استرجاع
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </Modal>
  );
}
