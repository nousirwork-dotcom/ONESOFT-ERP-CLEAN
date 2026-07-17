import { useState, useMemo, useEffect, useCallback } from 'react';
import { trpc } from '@/shared/lib/trpc';
import { useAuth } from '@/core/hooks/useAuth';
import CustomerFormDialog from '@/shared/components/CustomerFormDialog';
import { usePosEngine } from './usePosEngine';
import { TopBar } from './components/TopBar';
import { ProductBrowser } from './components/ProductBrowser';
import { CartPanel } from './components/CartPanel';
import { ModifierDialog } from './components/ModifierDialog';
import { TableMapDialog } from './components/TableMapDialog';
import { OpenOrdersDialog } from './components/OpenOrdersDialog';
import { LiveCustomerPanel } from './components/LiveCustomerPanel';
import type { PosApi } from './api';
import type { PosConfig, CatalogPayload, Category, Product, CustomerSummary } from './types';
import { Spinner } from './components/Modal';

// ─── Stub API (Phase 1: read-only — save/checkout not yet active) ─────────────
const STUB_API: PosApi = {
  loadCatalog: async () => ({ categories: [], products: [] }),
  searchCustomers: async () => [],
  loadTables: async () => ({ areas: [], tables: [] }),
  listOpenOrders: async () => [],
  saveDraft: async () => { throw new Error('غير مفعّل — سيتم تفعيله في المرحلة القادمة'); },
  sendToKitchen: async () => { throw new Error('غير مفعّل — سيتم تفعيله في المرحلة القادمة'); },
  checkout: async () => { throw new Error('غير مفعّل — سيتم تفعيله في المرحلة القادمة'); },
};

// ─── Build POS catalog from tRPC data ────────────────────────────────────────
function buildCatalog(
  groups: any[] | undefined,
  productRows: any[] | undefined,
  stockRows: any[] | undefined,
  warehouseId: number | null,
): CatalogPayload {
  const categories: Category[] = (groups ?? []).map((g) => ({
    id: String(g.id),
    name: g.name,
    parentId: g.parentId != null ? String(g.parentId) : null,
    color: g.color ?? null,
    sortOrder: g.level ?? 0,
    isActive: true,
  }));

  const stockMap = new Map<number, number>();
  if (stockRows && warehouseId != null) {
    for (const row of stockRows) {
      if (row.warehouseId === warehouseId) {
        stockMap.set(row.productId, Number(row.totalQuantity ?? 0));
      }
    }
  }

  const products: Product[] = (productRows ?? []).map((p) => {
    const isService = p.itemType === 'service';
    const qty = stockMap.get(p.id) ?? null;
    const isAvailable = isService || warehouseId == null || qty === null || qty > 0;
    return {
      id: String(p.id),
      sku: p.code ?? '',
      barcode: p.barcode ?? null,
      name: p.name,
      shortName: p.nameEn ?? null,
      categoryId: p.groupId != null ? String(p.groupId) : 'none',
      imageUrl: null,
      emoji: null,
      priceMinor: Math.round(Number(p.salePrice ?? 0) * 100),
      taxRateBps: Math.round(Number(p.taxRate ?? 0) * 100),
      isTaxInclusive: false,
      isActive: Boolean(p.isActive),
      isAvailable,
      isFavorite: false,
      trackStock: !isService,
      availableQuantity: isService ? null : qty,
    };
  });

  return { categories, products };
}

// ─── Map DB customer rows to POS CustomerSummary ──────────────────────────────
function mapCustomer(c: any): CustomerSummary {
  return {
    id: String(c.id),
    name: c.name,
    phone: c.phone ?? null,
    taxNumber: c.taxNumber ?? null,
    balanceMinor: Math.round(Number(c.balance ?? 0) * 100),
  };
}

function mapCustomers(rows: any[]): CustomerSummary[] {
  return rows.map(mapCustomer);
}

// ─── Error banner with retry ──────────────────────────────────────────────────
function QueryError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-rose-700/80 px-2 py-1 text-xs text-white">
      <span>⚠ {label}</span>
      <button
        type="button"
        onClick={onRetry}
        className="rounded bg-white/20 px-2 py-0.5 font-bold hover:bg-white/30"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}

// ─── Invoice header bar ───────────────────────────────────────────────────────
interface InvoiceHeaderBarProps {
  journals: any[];
  journalsLoading: boolean;
  journalsError: boolean;
  onJournalsRetry: () => void;
  selectedJournalId: number | null;
  warehouses: any[];
  warehousesLoading: boolean;
  selectedWarehouseId: number | null;
  branches: any[];
  selectedBranchId: number | null;
  previewNumber: string | null;
  previewLoading: boolean;
  invoiceDate: Date;
  customer: CustomerSummary | null | undefined;
  onJournalChange: (journalId: number) => void;
  onWarehouseChange: (warehouseId: number) => void;
  onOpenCustomer: () => void;
}

function InvoiceHeaderBar(props: InvoiceHeaderBarProps) {
  const selectedBranch = props.branches.find((b) => b.id === props.selectedBranchId);
  const selectedJournal = props.journals.find((j) => j.id === props.selectedJournalId);
  const selectedWarehouse = props.warehouses.find((w) => w.id === props.selectedWarehouseId);
  const dateStr = props.invoiceDate.toLocaleDateString('ar-SA-u-nu-latn', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  return (
    <div className="border-b border-[#1C4576]/30 bg-[#1C4576] px-3 py-2 text-white shadow-md">
      <div className="flex flex-wrap items-center gap-2">
        {/* Branch */}
        {selectedBranch ? (
          <div className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-xs">
            <span className="text-[#D8AE55]">🏢</span>
            <span className="font-bold">{selectedBranch.name}</span>
          </div>
        ) : null}

        {/* Journal selector */}
        {props.journalsError ? (
          <QueryError label="خطأ في تحميل الدفاتر" onRetry={props.onJournalsRetry} />
        ) : (
          <label className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-xs transition hover:bg-white/20">
            <span className="text-[#D8AE55]">📋</span>
            <span className="font-semibold opacity-80">الدفتر</span>
            {props.journalsLoading ? (
              <span className="animate-pulse text-[10px]">جارٍ التحميل...</span>
            ) : (
              <select
                value={props.selectedJournalId ?? ''}
                onChange={(e) => { const v = Number(e.target.value); if (v) props.onJournalChange(v); }}
                className="max-w-[200px] truncate bg-transparent text-xs font-bold outline-none"
              >
                <option value="">— اختر دفتر المبيعات —</option>
                {props.journals.map((j) => (
                  <option key={j.id} value={j.id}>{j.code} — {j.name}</option>
                ))}
              </select>
            )}
          </label>
        )}

        {/* Warehouse selector */}
        {props.warehouses.length > 0 || props.warehousesLoading ? (
          <label className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-xs transition hover:bg-white/20">
            <span className="text-[#D8AE55]">🏪</span>
            <span className="font-semibold opacity-80">المستودع</span>
            {props.warehousesLoading ? (
              <span className="animate-pulse text-[10px]">جارٍ التحميل...</span>
            ) : (
              <select
                value={props.selectedWarehouseId ?? ''}
                onChange={(e) => { const v = Number(e.target.value); if (v) props.onWarehouseChange(v); }}
                className="max-w-[160px] truncate bg-transparent text-xs font-bold outline-none"
              >
                <option value="">— اختر مستودع —</option>
                {props.warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            )}
          </label>
        ) : null}

        {/* Preview number */}
        <div
          className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-xs"
          title="رقم استرشادي — يُعتمد ويتسلسل فقط عند حفظ الفاتورة"
        >
          <span className="text-[#D8AE55]">#</span>
          <span className="font-semibold opacity-80">رقم استرشادي</span>
          <span className="font-black tabular-nums">
            {props.previewLoading ? '...' : (props.previewNumber ?? '—')}
          </span>
        </div>

        {/* Date */}
        <div className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-xs">
          <span className="text-[#D8AE55]">📅</span>
          <span className="font-bold tabular-nums">{dateStr}</span>
        </div>

        {/* Customer button */}
        <button
          type="button"
          onClick={props.onOpenCustomer}
          className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold transition ${
            props.customer
              ? 'bg-[#D8AE55]/25 ring-1 ring-[#D8AE55] hover:bg-[#D8AE55]/35'
              : 'bg-white/10 hover:bg-white/20'
          }`}
          title="F4 — اختيار عميل"
        >
          <span>👤</span>
          <span className="max-w-[160px] truncate">
            {props.customer?.name ?? 'عميل نقدي'}
          </span>
          {props.customer?.taxNumber ? (
            <span className="text-[10px] opacity-70">• {props.customer.taxNumber}</span>
          ) : null}
        </button>

        {/* Status hints */}
        <div className="ms-auto flex items-center gap-2 text-[10px] opacity-60">
          {!props.selectedJournalId && !props.journalsLoading && !props.journalsError ? (
            <span>اختر الدفتر لعرض الرقم الاسترشادي</span>
          ) : null}
          {props.selectedJournalId && !props.selectedWarehouseId ? (
            <span>• اختر المستودع لعرض المخزون</span>
          ) : null}
          {selectedJournal && selectedWarehouse ? (
            <span className="text-[#D8AE55] opacity-100">
              {selectedJournal.code} / {selectedWarehouse.name}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Full-page loading/error states ──────────────────────────────────────────
function PageLoading() {
  return (
    <div className="grid h-full place-items-center text-[#1C4576]">
      <div className="text-center">
        <Spinner label="جارٍ تحميل بيانات نقطة البيع" />
        <div className="mt-2 text-xs text-slate-500">الأصناف، الدفاتر، المستودعات...</div>
      </div>
    </div>
  );
}

function PageError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="grid h-full place-items-center">
      <div className="max-w-sm rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
        <div className="text-4xl">⚠</div>
        <div className="mt-3 font-extrabold text-rose-800">تعذّر تحميل بيانات نقطة البيع</div>
        <div className="mt-1 text-sm text-rose-700">{message}</div>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-xl bg-[#1C4576] px-5 py-2 text-sm font-bold text-white hover:bg-[#1C4576]/90"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
type Overlay = 'customer' | 'tables' | 'orders' | null;

export function LivePOSPage() {
  const { user } = useAuth();

  // ─── Invoice header state ───────────────────────────────────────────────────
  const [journalId, setJournalId] = useState<number | null>(null);
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [previewNumber, setPreviewNumber] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [invoiceDate] = useState<Date>(new Date());

  // ─── tRPC queries ───────────────────────────────────────────────────────────
  const branchesQuery = trpc.branches.list.useQuery();
  const warehousesQuery = trpc.warehouses.list.useQuery();
  const journalsQuery = trpc.documentJournals.list.useQuery({ docTypes: ['sales_invoice', 'sales'] });
  const productsQuery = trpc.products.list.useQuery({});
  const groupsQuery = trpc.productGroups.list.useQuery();
  const stockQuery = trpc.reports.stockByWarehouse.useQuery(
    { warehouseId: warehouseId! },
    { enabled: warehouseId != null },
  );
  const customersQuery = trpc.customers.list.useQuery();
  const utils = trpc.useUtils();

  // ─── Auto-select first branch ───────────────────────────────────────────────
  useEffect(() => {
    if (branchesQuery.data && branchesQuery.data.length > 0 && branchId === null) {
      setBranchId(branchesQuery.data[0].id);
    }
  }, [branchesQuery.data, branchId]);

  // ─── Journal selection: auto-fill warehouse + fetch preview number ──────────
  const handleJournalChange = useCallback(async (id: number) => {
    setJournalId(id);
    const journal = (journalsQuery.data ?? []).find((j: any) => j.id === id);
    if (journal?.warehouseId) {
      setWarehouseId(journal.warehouseId);
    }
    setPreviewLoading(true);
    setPreviewNumber(null);
    try {
      const num = await utils.documentJournals.previewNextNumber.fetch({ journalId: id });
      setPreviewNumber(num ?? null);
    } catch {
      setPreviewNumber(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [journalsQuery.data, utils]);

  // ─── Build catalog ─────────────────────────────────────────────────────────
  const catalog = useMemo<CatalogPayload>(
    () => buildCatalog(groupsQuery.data, productsQuery.data, stockQuery.data, warehouseId),
    [groupsQuery.data, productsQuery.data, stockQuery.data, warehouseId],
  );

  // ─── Map customers ─────────────────────────────────────────────────────────
  const mappedCustomers = useMemo(
    () => mapCustomers(customersQuery.data ?? []),
    [customersQuery.data],
  );

  // ─── POS config ────────────────────────────────────────────────────────────
  const selectedBranch = (branchesQuery.data ?? []).find((b: any) => b.id === branchId);
  const selectedJournal = (journalsQuery.data ?? []).find((j: any) => j.id === journalId);

  const config = useMemo<PosConfig>(() => ({
    currency: 'SAR',
    locale: 'ar-SA',
    defaultMode: 'quick',
    defaultView: 'mixed',
    taxInclusive: false,
    allowOfflineCheckout: false,
    branchId: branchId != null ? String(branchId) : undefined,
    cashierName: (user as any)?.name ?? (user as any)?.username ?? 'المستخدم',
    branchName: selectedBranch?.name,
    registerName: selectedJournal
      ? `${selectedJournal.code} — ${selectedJournal.name}`
      : 'اختر دفتر المبيعات',
  }), [branchId, selectedBranch, selectedJournal, user]);

  // ─── Engine: cart management with real catalog ─────────────────────────────
  const engine = usePosEngine(STUB_API, config, catalog);
  const { state, totals, filteredProducts, dispatch } = engine;

  // ─── UI state ──────────────────────────────────────────────────────────────
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [modifierProduct, setModifierProduct] = useState<Product | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F2') { event.preventDefault(); document.getElementById('pos-search')?.focus(); return; }
      if (event.key === 'F4') { event.preventDefault(); setOverlay('customer'); return; }
      if (event.key === 'Escape') {
        if (modifierProduct) setModifierProduct(null);
        else setOverlay(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modifierProduct]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const favoriteProducts = useMemo(
    () => state.catalog.products.filter((p) => p.isActive && p.isAvailable && p.isFavorite),
    [state.catalog.products],
  );

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleProductClick = useCallback((product: Product) => {
    if (!product.isAvailable) return;
    const activeGroups = product.modifierGroups?.filter((g) => g.options.some((o) => o.isActive)) ?? [];
    if (activeGroups.length > 0) { setModifierProduct(product); return; }
    engine.addProduct(product);
  }, [engine]);

  const handleNewOrder = useCallback(() => {
    if (state.draft.lines.length > 0) {
      if (!window.confirm('سيتم إلغاء المسودة الحالية وبدء طلب جديد. هل تريد المتابعة؟')) return;
    }
    engine.resetDraft();
  }, [engine, state.draft.lines.length]);

  const handleBarcodeEnter = useCallback((value: string) => {
    const product = engine.findByBarcode(value);
    if (product) handleProductClick(product);
    else if (value.trim()) setNotice('لم يتم العثور على باركود مطابق أو الصنف غير متاح');
  }, [engine, handleProductClick]);

  // ─── Customer: add new → auto-select after save ────────────────────────────
  const handleCustomerSaved = useCallback(async () => {
    try {
      const freshList = await utils.customers.list.fetch();
      if (freshList && freshList.length > 0) {
        const newest = freshList.reduce((a: any, b: any) => (a.id > b.id ? a : b));
        dispatch({ type: 'setCustomer', customer: mapCustomer(newest) });
      }
    } catch {
      // If fetch fails, just invalidate so the panel shows updated list
      utils.customers.list.invalidate();
    }
    setShowAddCustomer(false);
  }, [utils, dispatch]);

  // ─── Loading / error guards ────────────────────────────────────────────────
  const isCriticalLoading = productsQuery.isLoading || groupsQuery.isLoading;
  const criticalError = productsQuery.error ?? groupsQuery.error;

  if (isCriticalLoading) {
    return (
      <div dir="rtl" className="flex h-full min-h-[640px] flex-col overflow-hidden bg-slate-100 font-sans text-slate-900">
        <PageLoading />
      </div>
    );
  }

  if (criticalError) {
    return (
      <div dir="rtl" className="flex h-full min-h-[640px] flex-col overflow-hidden bg-slate-100 font-sans text-slate-900">
        <PageError
          message={criticalError.message ?? 'تعذّر تحميل بيانات الأصناف'}
          onRetry={() => {
            productsQuery.refetch();
            groupsQuery.refetch();
          }}
        />
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div dir="rtl" className="flex h-full min-h-[640px] flex-col overflow-hidden bg-slate-100 font-sans text-slate-900">
      <InvoiceHeaderBar
        journals={journalsQuery.data ?? []}
        journalsLoading={journalsQuery.isLoading}
        journalsError={Boolean(journalsQuery.error)}
        onJournalsRetry={() => journalsQuery.refetch()}
        selectedJournalId={journalId}
        warehouses={warehousesQuery.data ?? []}
        warehousesLoading={warehousesQuery.isLoading}
        selectedWarehouseId={warehouseId}
        branches={branchesQuery.data ?? []}
        selectedBranchId={branchId}
        previewNumber={previewNumber}
        previewLoading={previewLoading}
        invoiceDate={invoiceDate}
        customer={state.draft.customer}
        onJournalChange={handleJournalChange}
        onWarehouseChange={(id) => setWarehouseId(id)}
        onOpenCustomer={() => setOverlay('customer')}
      />

      <TopBar
        config={config}
        mode={state.mode}
        view={state.view}
        serviceType={state.draft.serviceType}
        search={state.search}
        customer={state.draft.customer}
        table={state.draft.table}
        online={online}
        onModeChange={(mode) => dispatch({ type: 'setMode', mode })}
        onViewChange={(view) => dispatch({ type: 'setView', view })}
        onServiceTypeChange={(serviceType) => dispatch({ type: 'setServiceType', serviceType })}
        onSearchChange={(value) => dispatch({ type: 'setSearch', value })}
        onSearchEnter={handleBarcodeEnter}
        onOpenCustomer={() => setOverlay('customer')}
        onOpenTables={() => setOverlay('tables')}
        onOpenOrders={() => setOverlay('orders')}
      />

      <main className="flex min-h-0 flex-1 overflow-hidden">
        <ProductBrowser
          categories={state.catalog.categories}
          products={filteredProducts}
          favoriteProducts={favoriteProducts}
          selectedCategoryId={state.selectedCategoryId}
          view={state.view}
          loading={state.loadingCatalog}
          config={config}
          onCategoryChange={(categoryId) => dispatch({ type: 'setCategory', categoryId })}
          onProductClick={handleProductClick}
        />

        <CartPanel
          draft={state.draft}
          totals={totals}
          config={config}
          busyAction={state.busyAction}
          showKitchen={state.mode !== 'retail'}
          onQuantityChange={(lineId, quantity) => dispatch({ type: 'setLineQuantity', lineId, quantity })}
          onLineNoteChange={(lineId, note) => dispatch({ type: 'setLineNote', lineId, note })}
          onRemove={(lineId) => dispatch({ type: 'removeLine', lineId })}
          onSave={() => setNotice('حفظ الفاتورة سيكون متاحاً في المرحلة القادمة')}
          onKitchen={() => setNotice('إرسال للمطبخ سيكون متاحاً في المرحلة القادمة')}
          onPay={() => setNotice('الدفع سيكون متاحاً في المرحلة القادمة')}
          onNew={handleNewOrder}
        />
      </main>

      {(state.error || notice) ? (
        <div className={`fixed bottom-4 start-1/2 z-[150] max-w-[90vw] -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-bold shadow-xl ${
          state.error ? 'bg-rose-700 text-white' : 'bg-slate-950 text-white'
        }`}>
          <div className="flex items-center gap-3">
            <span>{state.error ?? notice}</span>
            {state.error ? (
              <button
                type="button"
                onClick={() => dispatch({ type: 'error', message: null })}
                className="rounded-md bg-white/15 px-2 py-1"
              >
                إغلاق
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {modifierProduct ? (
        <ModifierDialog
          product={modifierProduct}
          config={config}
          onClose={() => setModifierProduct(null)}
          onConfirm={(modifiers) => {
            engine.addProduct(modifierProduct, modifiers);
            setModifierProduct(null);
          }}
        />
      ) : null}

      {overlay === 'customer' ? (
        <LiveCustomerPanel
          config={config}
          customers={mappedCustomers}
          loading={customersQuery.isLoading}
          selectedCustomer={state.draft.customer}
          onClose={() => setOverlay(null)}
          onSelect={(customer) => dispatch({ type: 'setCustomer', customer })}
          onAddCustomer={() => { setOverlay(null); setShowAddCustomer(true); }}
        />
      ) : null}

      {overlay === 'tables' ? (
        <TableMapDialog
          api={STUB_API}
          config={config}
          selectedTable={state.draft.table}
          onClose={() => setOverlay(null)}
          onSelect={(table) => dispatch({ type: 'setTable', table })}
        />
      ) : null}

      {overlay === 'orders' ? (
        <OpenOrdersDialog
          api={STUB_API}
          config={config}
          onClose={() => setOverlay(null)}
        />
      ) : null}

      {showAddCustomer ? (
        <CustomerFormDialog
          open={showAddCustomer}
          onClose={() => setShowAddCustomer(false)}
          onSaved={handleCustomerSaved}
        />
      ) : null}
    </div>
  );
}
