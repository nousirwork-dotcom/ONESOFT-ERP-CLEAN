import { useState } from 'react';
import type { CustomerSummary, PosConfig } from '../types';
import { formatMoney } from '../money';
import { SidePanel, Spinner } from './Modal';

interface LiveCustomerPanelProps {
  config: PosConfig;
  customers: CustomerSummary[];
  loading: boolean;
  selectedCustomer?: CustomerSummary | null;
  onClose: () => void;
  onSelect: (customer: CustomerSummary | null) => void;
  onAddCustomer: () => void;
}

export function LiveCustomerPanel({
  config,
  customers,
  loading,
  selectedCustomer,
  onClose,
  onSelect,
  onAddCustomer,
}: LiveCustomerPanelProps) {
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? customers.filter((c) => {
        const q = query.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.phone ?? '').includes(q) ||
          (c.taxNumber ?? '').toLowerCase().includes(q)
        );
      })
    : customers;

  return (
    <SidePanel title="اختيار العميل" onClose={onClose}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="الاسم أو الجوال أو الرقم الضريبي"
        className="h-12 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-[#1C4576] focus:ring-2 focus:ring-[#1C4576]/10"
        autoFocus
      />

      <button
        type="button"
        onClick={() => { onSelect(null); onClose(); }}
        className={`mt-3 flex min-h-16 w-full items-center justify-between rounded-xl border p-3 text-start ${
          !selectedCustomer ? 'border-[#1C4576] bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
        }`}
      >
        <div>
          <div className="font-extrabold text-slate-900">عميل نقدي</div>
          <div className="text-xs text-slate-500">بيع مباشر دون ربط عميل</div>
        </div>
        {!selectedCustomer ? <span className="font-black text-[#1C4576]">✓</span> : null}
      </button>

      <button
        type="button"
        onClick={onAddCustomer}
        className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#1C4576] bg-blue-50/50 text-sm font-bold text-[#1C4576] transition hover:bg-blue-100"
      >
        + إضافة عميل جديد
      </button>

      <div className="mt-3 space-y-2">
        {loading ? (
          <div className="grid min-h-32 place-items-center text-[#1C4576]">
            <Spinner label="جارٍ التحميل" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            {query.trim() ? 'لا توجد نتائج مطابقة' : 'لا يوجد عملاء مسجلون'}
          </div>
        ) : (
          filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onSelect(c); onClose(); }}
              className={`flex min-h-20 w-full items-center justify-between rounded-xl border p-3 text-start transition ${
                selectedCustomer?.id === c.id
                  ? 'border-[#1C4576] bg-blue-50'
                  : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              <div className="min-w-0">
                <div className="truncate font-extrabold text-slate-900">{c.name}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {c.phone ?? 'بدون جوال'}
                  {c.taxNumber ? ` • ${c.taxNumber}` : ''}
                </div>
              </div>
              {c.balanceMinor ? (
                <div className="shrink-0 text-end text-[10px] text-slate-500">
                  <div>الرصيد</div>
                  <div className="font-black text-rose-600">
                    {formatMoney(c.balanceMinor, config.currency, config.locale)}
                  </div>
                </div>
              ) : null}
            </button>
          ))
        )}
      </div>
    </SidePanel>
  );
}
