import { useEffect, useMemo, useState } from 'react';
import type { PosApi } from '../api';
import type { PosConfig, RestaurantArea, RestaurantTable, TableStatus } from '../types';
import { formatMoney } from '../money';
import { Modal, Spinner } from './Modal';

interface TableMapDialogProps {
  api: PosApi;
  config: PosConfig;
  selectedTable?: RestaurantTable | null;
  onClose: () => void;
  onSelect: (table: RestaurantTable) => void;
}

const statusStyle: Record<TableStatus, { label: string; className: string }> = {
  available: { label: 'متاحة', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  occupied: { label: 'عليها طلب', className: 'border-blue-200 bg-blue-50 text-blue-800' },
  kitchen: { label: 'في المطبخ', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  ready: { label: 'جاهز', className: 'border-violet-200 bg-violet-50 text-violet-800' },
  reserved: { label: 'محجوزة', className: 'border-slate-300 bg-slate-100 text-slate-700' },
};

export function TableMapDialog({ api, config, selectedTable, onClose, onSelect }: TableMapDialogProps) {
  const [areas, setAreas] = useState<RestaurantArea[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.loadTables()
      .then((payload) => {
        if (!active) return;
        const sorted = [...payload.areas].sort((a, b) => a.sortOrder - b.sortOrder);
        setAreas(sorted);
        setTables(payload.tables);
        setAreaId(selectedTable?.areaId ?? sorted[0]?.id ?? null);
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'تعذر تحميل الطاولات'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, selectedTable?.areaId]);

  const visibleTables = useMemo(() => tables.filter((table) => !areaId || table.areaId === areaId), [areaId, tables]);

  return (
    <Modal title="خريطة الطاولات" onClose={onClose} widthClassName="max-w-5xl">
      {loading ? <div className="grid min-h-80 place-items-center text-[#1C4576]"><Spinner label="جارٍ تحميل الطاولات" /></div> : null}
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-bold text-rose-700">{error}</div> : null}
      {!loading && !error ? (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {areas.map((area) => (
              <button key={area.id} type="button" onClick={() => setAreaId(area.id)} className={`rounded-xl px-4 py-2 text-sm font-extrabold ${areaId === area.id ? 'bg-[#1C4576] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{area.name}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visibleTables.map((table) => {
              const status = statusStyle[table.status];
              const selected = selectedTable?.id === table.id;
              const selectable = table.status === 'available' || selected;
              return (
                <button
                  key={table.id}
                  type="button"
                  disabled={!selectable}
                  title={selectable ? 'اختيار الطاولة' : 'الطاولة مرتبطة بطلب مفتوح؛ افتح الطلب من شاشة الطلبات المفتوحة'}
                  onClick={() => { if (selectable) { onSelect(table); onClose(); } }}
                  className={`min-h-36 rounded-2xl border-2 p-4 text-start shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70 ${status.className} ${selected ? 'ring-4 ring-[#1C4576]/20' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2"><span className="text-lg font-black">{table.name}</span><span className="rounded-full bg-white/70 px-2 py-1 text-[10px] font-black">{status.label}</span></div>
                  <div className="mt-3 text-xs font-bold opacity-80">👥 {table.seats} مقاعد</div>
                  {table.currentTotalMinor ? <div className="mt-2 font-black">{formatMoney(table.currentTotalMinor, config.currency, config.locale)}</div> : null}
                  {table.openedAt ? <div className="mt-1 text-[10px] opacity-70">مفتوحة منذ {Math.max(1, Math.round((Date.now() - new Date(table.openedAt).getTime()) / 60_000))} دقيقة</div> : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </Modal>
  );
}
