import { useMemo, useState } from 'react';
import type { CustomerSummary, PaymentLine, PaymentMethod, PosConfig } from '../types';
import { formatMoney, parseMoneyInput } from '../money';
import { Modal, Spinner } from './Modal';

interface PaymentDialogProps {
  dueMinor: number;
  config: PosConfig;
  customer?: CustomerSummary | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (payments: PaymentLine[]) => Promise<boolean>;
}

const methodDefinitions: Array<{ value: PaymentMethod; label: string; icon: string }> = [
  { value: 'cash', label: 'نقدي', icon: '💵' },
  { value: 'card', label: 'شبكة', icon: '💳' },
  { value: 'transfer', label: 'تحويل', icon: '🏦' },
  { value: 'onAccount', label: 'آجل', icon: '📒' },
];

function createPaymentId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `pay-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function PaymentDialog({ dueMinor, config, customer, busy, onClose, onConfirm }: PaymentDialogProps) {
  const [amounts, setAmounts] = useState<Record<PaymentMethod, string>>({
    cash: (dueMinor / 100).toFixed(2),
    card: '',
    transfer: '',
    onAccount: '',
  });
  const [references, setReferences] = useState<Record<PaymentMethod, string>>({ cash: '', card: '', transfer: '', onAccount: '' });
  const [error, setError] = useState<string | null>(null);

  const paymentValues = useMemo(() => methodDefinitions.map((method) => ({
    method: method.value,
    amountMinor: parseMoneyInput(amounts[method.value]),
    reference: references[method.value].trim() || undefined,
  })), [amounts, references]);

  const paidMinor = paymentValues.reduce((sum, item) => sum + item.amountMinor, 0);
  const remainingMinor = Math.max(0, dueMinor - paidMinor);
  const changeMinor = Math.max(0, paidMinor - dueMinor);

  const setFullAmount = (method: PaymentMethod) => {
    if (method === 'onAccount' && !customer) {
      setError('يجب اختيار عميل قبل استخدام الدفع الآجل');
      return;
    }
    setError(null);
    setAmounts({
      cash: method === 'cash' ? (dueMinor / 100).toFixed(2) : '',
      card: method === 'card' ? (dueMinor / 100).toFixed(2) : '',
      transfer: method === 'transfer' ? (dueMinor / 100).toFixed(2) : '',
      onAccount: method === 'onAccount' ? (dueMinor / 100).toFixed(2) : '',
    });
  };

  const submit = async () => {
    setError(null);
    const payments = paymentValues
      .filter((item) => item.amountMinor > 0)
      .map<PaymentLine>((item) => ({ id: createPaymentId(), ...item }));

    if (payments.length === 0) {
      setError('أدخل وسيلة دفع واحدة على الأقل');
      return;
    }
    if (payments.some((item) => item.method === 'onAccount') && !customer) {
      setError('يجب اختيار عميل قبل استخدام الدفع الآجل');
      return;
    }
    if (paidMinor < dueMinor) {
      setError(`المتبقي ${formatMoney(remainingMinor, config.currency, config.locale)}`);
      return;
    }
    const succeeded = await onConfirm(payments);
    if (!succeeded) setError('لم تكتمل عملية الدفع. راجع رسالة الخطأ وحاول مرة أخرى.');
  };

  return (
    <Modal
      title="إتمام الدفع"
      onClose={() => { if (!busy) onClose(); }}
      widthClassName="max-w-3xl"
      footer={(
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-bold text-slate-600">
            {remainingMinor > 0 ? (
              <>المتبقي: <span className="font-black text-rose-600">{formatMoney(remainingMinor, config.currency, config.locale)}</span></>
            ) : (
              <>الباقي للعميل: <span className="font-black text-emerald-700">{formatMoney(changeMinor, config.currency, config.locale)}</span></>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={onClose} className="h-12 rounded-xl border border-slate-300 px-5 font-bold text-slate-700 disabled:opacity-50">إلغاء</button>
            <button type="button" disabled={busy || paidMinor < dueMinor} onClick={submit} className="h-12 min-w-44 rounded-xl bg-emerald-600 px-6 font-black text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50">
              {busy ? <Spinner label="جارٍ الاعتماد" /> : 'اعتماد وطباعة الفاتورة'}
            </button>
          </div>
        </div>
      )}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {methodDefinitions.map((method) => (
              <button
                key={method.value}
                type="button"
                onClick={() => setFullAmount(method.value)}
                className="min-h-24 rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-[#1C4576] hover:shadow-md"
              >
                <div className="text-3xl">{method.icon}</div>
                <div className="mt-2 text-sm font-extrabold text-slate-800">{method.label}</div>
              </button>
            ))}
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[100px_minmax(0,1fr)_minmax(0,1fr)] bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">
              <span>الوسيلة</span><span>المبلغ</span><span>المرجع</span>
            </div>
            {methodDefinitions.map((method) => (
              <div key={method.value} className="grid grid-cols-[100px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 border-t border-slate-100 p-2">
                <span className="text-sm font-extrabold text-slate-700">{method.icon} {method.label}</span>
                <input
                  value={amounts[method.value]}
                  onChange={(event) => setAmounts((previous) => ({ ...previous, [method.value]: event.target.value }))}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="h-11 rounded-xl border border-slate-300 px-3 text-end font-black outline-none focus:border-[#1C4576] focus:ring-2 focus:ring-[#1C4576]/10"
                />
                <input
                  value={references[method.value]}
                  onChange={(event) => setReferences((previous) => ({ ...previous, [method.value]: event.target.value }))}
                  placeholder={method.value === 'cash' ? 'اختياري' : 'رقم مرجع اختياري'}
                  className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-[#1C4576]"
                />
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-2xl bg-slate-950 p-4 text-white">
          <div className="text-xs font-bold text-slate-400">إجمالي الفاتورة</div>
          <div className="mt-1 text-3xl font-black">{formatMoney(dueMinor, config.currency, config.locale)}</div>
          <div className="my-4 border-t border-slate-700" />
          <div className="flex justify-between text-sm"><span className="text-slate-400">المدفوع</span><span className="font-black">{formatMoney(paidMinor, config.currency, config.locale)}</span></div>
          <div className="mt-3 flex justify-between text-sm"><span className="text-slate-400">المتبقي</span><span className="font-black text-amber-300">{formatMoney(remainingMinor, config.currency, config.locale)}</span></div>
          <div className="mt-3 flex justify-between text-sm"><span className="text-slate-400">الباقي</span><span className="font-black text-emerald-300">{formatMoney(changeMinor, config.currency, config.locale)}</span></div>
          {customer ? <div className="mt-5 rounded-xl bg-white/10 p-3 text-xs"><div className="text-slate-400">العميل</div><div className="mt-1 font-bold">{customer.name}</div></div> : null}
        </aside>
      </div>
      {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div> : null}
    </Modal>
  );
}
