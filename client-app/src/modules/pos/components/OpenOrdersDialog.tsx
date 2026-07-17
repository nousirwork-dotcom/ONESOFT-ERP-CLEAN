import { useEffect, useState } from 'react';
import type { PosApi } from '../api';
import type { OpenOrderSummary, PosConfig } from '../types';
import { formatMoney } from '../money';
import { Modal, Spinner } from './Modal';

interface OpenOrdersDialogProps {
  api: PosApi;
  config: PosConfig;
  onClose: () => void;
  onOpenOrder?: (order: OpenOrderSummary) => void;
}

const statusLabel: Record<OpenOrderSummary['status'], string> = {
  draft: 'مفتوح',
  sentToKitchen: 'في المطبخ',
  ready: 'جاهز',
  paid: 'مدفوع',
  cancelled: 'ملغي',
};

export function OpenOrdersDialog({ api, config, onClose, onOpenOrder }: OpenOrdersDialogProps) {
  const [orders, setOrders] = useState<OpenOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.listOpenOrders()
      .then((result) => { if (active) setOrders(result); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'تعذر تحميل الطلبات المفتوحة'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api]);

  return (
    <Modal title="الطلبات المفتوحة" onClose={onClose} widthClassName="max-w-4xl">
      {loading ? <div className="grid min-h-72 place-items-center text-[#1C4576]"><Spinner label="جارٍ تحميل الطلبات" /></div> : null}
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{error}</div> : null}
      {!loading && !error && orders.length === 0 ? <div className="py-16 text-center text-slate-500">لا توجد طلبات مفتوحة</div> : null}
      {!loading && orders.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {orders.map((order) => (
            <button
              key={order.id}
              type="button"
              onClick={() => onOpenOrder?.(order)}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-start shadow-sm transition hover:-translate-y-0.5 hover:border-[#1C4576] hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div><div className="font-black text-slate-900">{order.displayNumber}</div><div className="mt-1 text-xs text-slate-500">{order.tableName ?? order.customerName ?? 'طلب مباشر'} • {order.cashierName}</div></div>
                <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black text-[#1C4576]">{statusLabel[order.status]}</span>
              </div>
              <div className="mt-4 flex items-end justify-between"><span className="text-xs text-slate-500">منذ {Math.max(1, Math.round((Date.now() - new Date(order.openedAt).getTime()) / 60_000))} دقيقة</span><span className="text-lg font-black text-[#1C4576]">{formatMoney(order.totalMinor, config.currency, config.locale)}</span></div>
            </button>
          ))}
        </div>
      ) : null}
      <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">عند الدمج مع الخلفية: الضغط على الطلب يجب أن يجلب بنوده الفعلية ويستبدل المسودة الحالية بعد رسالة تأكيد عند وجود أصناف غير محفوظة.</div>
    </Modal>
  );
}
