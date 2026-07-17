import type {
  CustomerSummary,
  PosConfig,
  PosMode,
  ProductView,
  RestaurantTable,
  ServiceType,
} from '../types';

interface TopBarProps {
  config: PosConfig;
  mode: PosMode;
  view: ProductView;
  serviceType: ServiceType;
  search: string;
  customer: CustomerSummary | null | undefined;
  table: RestaurantTable | null | undefined;
  online: boolean;
  onModeChange: (mode: PosMode) => void;
  onViewChange: (view: ProductView) => void;
  onServiceTypeChange: (type: ServiceType) => void;
  onSearchChange: (value: string) => void;
  onSearchEnter: (value: string) => void;
  onOpenCustomer: () => void;
  onOpenTables: () => void;
  onOpenOrders: () => void;
}

const modes: Array<{ value: PosMode; label: string }> = [
  { value: 'quick', label: 'بيع سريع' },
  { value: 'restaurant', label: 'مطعم' },
  { value: 'retail', label: 'متجر' },
];

const views: Array<{ value: ProductView; label: string }> = [
  { value: 'mixed', label: 'مختلط' },
  { value: 'grid', label: 'صور' },
  { value: 'grouped', label: 'مجموعات' },
  { value: 'compact', label: 'قائمة' },
  { value: 'favorites', label: 'المفضلة' },
];

const serviceTypes: Array<{ value: ServiceType; label: string }> = [
  { value: 'dineIn', label: 'محلي' },
  { value: 'takeaway', label: 'سفري' },
  { value: 'delivery', label: 'توصيل' },
  { value: 'pickup', label: 'استلام' },
];

export function TopBar(props: TopBarProps) {
  return (
    <header className="border-b border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[180px] pe-2">
          <div className="text-sm font-extrabold text-slate-900">{props.config.branchName ?? 'OneSoft POS'}</div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{props.config.registerName ?? 'نقطة البيع'}</span>
            <span>•</span>
            <span>{props.config.cashierName ?? 'المستخدم'}</span>
            <span className={`inline-flex items-center gap-1 ${props.online ? 'text-emerald-700' : 'text-rose-700'}`}>
              <span className={`h-2 w-2 rounded-full ${props.online ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              {props.online ? 'متصل' : 'غير متصل'}
            </span>
          </div>
        </div>

        <div className="flex rounded-xl bg-slate-100 p-1">
          {modes.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => props.onModeChange(item.value)}
              className={`min-h-9 rounded-lg px-3 text-xs font-bold transition ${
                props.mode === item.value ? 'bg-[#1C4576] text-white shadow-sm' : 'text-slate-600 hover:bg-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px] flex-1">
          <input
            id="pos-search"
            value={props.search}
            onChange={(event) => props.onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') props.onSearchEnter(event.currentTarget.value);
            }}
            placeholder={props.mode === 'retail' ? 'بحث أو قراءة باركود — F2' : 'ابحث عن صنف أو كود — F2'}
            className="h-11 w-full rounded-xl border border-slate-300 bg-white pe-10 ps-3 text-sm font-medium outline-none transition focus:border-[#1C4576] focus:ring-2 focus:ring-[#1C4576]/15"
            autoComplete="off"
          />
          <span className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center text-slate-400">⌕</span>
        </div>

        <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700">
          <span>العرض</span>
          <select
            value={props.view}
            onChange={(event) => props.onViewChange(event.target.value as ProductView)}
            className="bg-transparent outline-none"
          >
            {views.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>

        <button
          type="button"
          onClick={props.onOpenCustomer}
          className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#1C4576] hover:text-[#1C4576]"
          title="اختيار عميل — F4"
        >
          👤 {props.customer?.name ?? 'عميل نقدي'}
        </button>

        {props.mode === 'restaurant' ? (
          <button
            type="button"
            onClick={props.onOpenTables}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-[#1C4576] hover:text-[#1C4576]"
          >
            🪑 {props.table?.name ?? 'اختيار طاولة'}
          </button>
        ) : null}

        <button
          type="button"
          onClick={props.onOpenOrders}
          className="h-11 rounded-xl bg-slate-900 px-3 text-xs font-bold text-white transition hover:bg-slate-700"
        >
          الطلبات المفتوحة
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {serviceTypes
          .filter((item) => props.mode === 'restaurant' || item.value !== 'dineIn')
          .map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => props.onServiceTypeChange(item.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                props.serviceType === item.value
                  ? 'bg-[#D8AE55] text-slate-950'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        <span className="ms-auto hidden text-[11px] text-slate-400 xl:inline">F2 بحث • F4 عميل • F8 دفع • Esc إغلاق النافذة</span>
      </div>
    </header>
  );
}
