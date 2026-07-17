import type { CartLine, OrderTotals, PosConfig, PosDraft } from '../types';
import { calculateLineAmounts, formatMoney } from '../money';
import { Spinner } from './Modal';

interface CartPanelProps {
  draft: PosDraft;
  totals: OrderTotals;
  config: PosConfig;
  busyAction: 'save' | 'kitchen' | 'checkout' | null;
  onQuantityChange: (lineId: string, quantity: number) => void;
  onLineNoteChange: (lineId: string, note: string) => void;
  onRemove: (lineId: string) => void;
  onSave: () => void;
  onKitchen: () => void;
  onPay: () => void;
  onNew: () => void;
  showKitchen?: boolean;
}

function CartLineRow({ line, config, onQuantityChange, onLineNoteChange, onRemove }: {
  line: CartLine;
  config: PosConfig;
  onQuantityChange: (quantity: number) => void;
  onLineNoteChange: (note: string) => void;
  onRemove: () => void;
}) {
  const amounts = calculateLineAmounts(line);
  const modifierText = line.selectedModifiers.map((item) => item.optionName).join('، ');

  return (
    <article className="border-b border-slate-100 p-3 last:border-b-0">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-extrabold text-slate-900">{line.productName}</h3>
            <span className="whitespace-nowrap text-sm font-black text-[#1C4576]">
              {formatMoney(amounts.grandTotalMinor, config.currency, config.locale)}
            </span>
          </div>
          {modifierText ? <div className="mt-1 line-clamp-2 text-[11px] font-medium text-amber-700">+ {modifierText}</div> : null}
          {line.sentToKitchenAt ? <div className="mt-1 text-[10px] font-bold text-emerald-700">✓ تم الإرسال للمطبخ</div> : null}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="flex items-center overflow-hidden rounded-lg border border-slate-300 bg-white">
          <button type="button" onClick={() => onQuantityChange(line.quantity - 1)} className="grid h-9 w-9 place-items-center text-lg font-bold hover:bg-slate-100">−</button>
          <span className="grid h-9 min-w-10 place-items-center border-x border-slate-200 text-sm font-black">{line.quantity}</span>
          <button type="button" onClick={() => onQuantityChange(line.quantity + 1)} className="grid h-9 w-9 place-items-center text-lg font-bold hover:bg-slate-100">+</button>
        </div>
        <input
          value={line.note}
          onChange={(event) => onLineNoteChange(event.target.value)}
          placeholder="ملاحظة للمطبخ"
          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-[#1C4576]"
        />
        <button type="button" onClick={onRemove} className="grid h-9 w-9 place-items-center rounded-lg text-rose-600 hover:bg-rose-50" aria-label="حذف الصنف">🗑</button>
      </div>
    </article>
  );
}

function TotalRow({ label, value, strong, config }: { label: string; value: number; strong?: boolean; config: PosConfig }) {
  return (
    <div className={`flex items-center justify-between ${strong ? 'text-base font-black text-slate-950' : 'text-xs font-bold text-slate-600'}`}>
      <span>{label}</span>
      <span>{formatMoney(value, config.currency, config.locale)}</span>
    </div>
  );
}

export function CartPanel(props: CartPanelProps) {
  const isEmpty = props.draft.lines.length === 0;
  return (
    <aside className="flex min-h-0 flex-col border-s border-slate-200 bg-white" style={{ flex: '0 0 28%', minWidth: '280px', maxWidth: '400px' }}>
      <div className="border-b border-slate-200 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-black text-slate-900">الطلب الحالي</h2>
            <div className="text-xs text-slate-500">
              {props.draft.table?.name ?? (props.draft.serviceType === 'dineIn' ? 'لم يتم اختيار طاولة' : 'طلب بدون طاولة')}
              {props.draft.customer ? ` • ${props.draft.customer.name}` : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={props.onNew}
            disabled={isEmpty}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            طلب جديد
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {isEmpty ? (
          <div className="grid h-full min-h-60 place-items-center px-6 text-center text-slate-400">
            <div>
              <div className="text-6xl">🧾</div>
              <div className="mt-3 font-extrabold text-slate-600">ابدأ بإضافة الأصناف</div>
              <div className="mt-1 text-xs">اضغط على الصنف مرة واحدة لإضافته مباشرة</div>
            </div>
          </div>
        ) : (
          props.draft.lines.map((line) => (
            <CartLineRow
              key={line.id}
              line={line}
              config={props.config}
              onQuantityChange={(quantity) => props.onQuantityChange(line.id, quantity)}
              onLineNoteChange={(note) => props.onLineNoteChange(line.id, note)}
              onRemove={() => props.onRemove(line.id)}
            />
          ))
        )}
      </div>

      <div className="border-t border-slate-200 bg-slate-50 p-3">
        <div className="space-y-1.5 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <TotalRow label="الإجمالي قبل الخصم" value={props.totals.subtotalBeforeDiscountMinor} config={props.config} />
          <TotalRow label="الخصم" value={props.totals.discountMinor} config={props.config} />
          <TotalRow label="قبل الضريبة" value={props.totals.netBeforeTaxMinor} config={props.config} />
          <TotalRow label="الضريبة" value={props.totals.taxMinor} config={props.config} />
          <div className="my-2 border-t border-dashed border-slate-300" />
          <TotalRow label="الإجمالي النهائي" value={props.totals.grandTotalMinor} strong config={props.config} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isEmpty || props.busyAction !== null}
            onClick={props.onSave}
            className="min-h-11 rounded-xl border border-[#1C4576] bg-white px-3 text-xs font-extrabold text-[#1C4576] hover:bg-blue-50 disabled:opacity-50"
          >
            {props.busyAction === 'save' ? <Spinner label="حفظ" /> : 'تعليق / حفظ'}
          </button>
          {props.showKitchen !== false ? (
            <button
              type="button"
              disabled={isEmpty || props.busyAction !== null}
              onClick={props.onKitchen}
              className="min-h-11 rounded-xl border border-amber-500 bg-amber-50 px-3 text-xs font-extrabold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
            >
              {props.busyAction === 'kitchen' ? <Spinner label="إرسال" /> : 'إرسال للمطبخ'}
            </button>
          ) : (
            <button
              type="button"
              disabled={isEmpty || props.busyAction !== null}
              onClick={props.onSave}
              className="min-h-11 rounded-xl border border-slate-300 bg-slate-100 px-3 text-xs font-extrabold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              حفظ الفاتورة
            </button>
          )}
        </div>

        <button
          type="button"
          disabled={isEmpty || props.busyAction !== null}
          onClick={props.onPay}
          className="mt-2 min-h-14 w-full rounded-2xl bg-emerald-600 px-4 text-base font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {props.busyAction === 'checkout' ? <Spinner label="جارٍ إتمام الدفع" /> : `الدفع — ${formatMoney(props.totals.grandTotalMinor, props.config.currency, props.config.locale)}`}
        </button>
      </div>
    </aside>
  );
}
