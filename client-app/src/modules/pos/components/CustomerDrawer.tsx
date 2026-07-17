import { useEffect, useState } from 'react';
import type { PosApi } from '../api';
import type { CustomerSummary, PosConfig } from '../types';
import { formatMoney } from '../money';
import { SidePanel, Spinner } from './Modal';

interface CustomerDrawerProps {
  api: PosApi;
  config: PosConfig;
  selectedCustomer?: CustomerSummary | null;
  onClose: () => void;
  onSelect: (customer: CustomerSummary | null) => void;
}

export function CustomerDrawer({ api, config, selectedCustomer, onClose, onSelect }: CustomerDrawerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      api.searchCustomers(query)
        .then((customers) => { if (active) setResults(customers); })
        .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'تعذر البحث عن العملاء'); })
        .finally(() => { if (active) setLoading(false); });
    }, 220);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [api, query]);

  return (
    <SidePanel title="اختيار العميل" onClose={onClose}>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="الاسم أو الجوال أو الرقم الضريبي"
        className="h-12 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-[#1C4576] focus:ring-2 focus:ring-[#1C4576]/10"
        autoFocus
      />

      <button
        type="button"
        onClick={() => { onSelect(null); onClose(); }}
        className={`mt-3 flex min-h-16 w-full items-center justify-between rounded-xl border p-3 text-start ${!selectedCustomer ? 'border-[#1C4576] bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
      >
        <div><div className="font-extrabold text-slate-900">عميل نقدي</div><div className="text-xs text-slate-500">بيع مباشر دون ربط عميل</div></div>
        {!selectedCustomer ? <span className="font-black text-[#1C4576]">✓</span> : null}
      </button>

      <div className="mt-3 space-y-2">
        {loading ? <div className="grid min-h-32 place-items-center text-[#1C4576]"><Spinner label="جارٍ البحث" /></div> : null}
        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div> : null}
        {!loading && !error && results.length === 0 ? <div className="py-10 text-center text-sm text-slate-500">لا توجد نتائج</div> : null}
        {!loading && results.map((customer) => (
          <button
            key={customer.id}
            type="button"
            onClick={() => { onSelect(customer); onClose(); }}
            className={`flex min-h-20 w-full items-center justify-between rounded-xl border p-3 text-start transition ${selectedCustomer?.id === customer.id ? 'border-[#1C4576] bg-blue-50' : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50'}`}
          >
            <div className="min-w-0">
              <div className="truncate font-extrabold text-slate-900">{customer.name}</div>
              <div className="mt-1 text-xs text-slate-500">{customer.phone ?? 'بدون جوال'}{customer.taxNumber ? ` • ${customer.taxNumber}` : ''}</div>
            </div>
            {customer.balanceMinor ? <div className="text-end text-[10px] text-slate-500"><div>الرصيد</div><div className="font-black text-rose-600">{formatMoney(customer.balanceMinor, config.currency, config.locale)}</div></div> : null}
          </button>
        ))}
      </div>
    </SidePanel>
  );
}
