import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { trpc } from '@/shared/lib/trpc';
import { useAuth } from '@/core/hooks/useAuth';
import { useTabManager } from '@/core/contexts/TabManagerContext';
import CustomerFormDialog from '@/shared/components/CustomerFormDialog';
import { createPhase1PosApi } from './api';
import { usePosEngine } from './usePosEngine';
import { TopBar } from './components/TopBar';
import { ProductBrowser } from './components/ProductBrowser';
import { CartPanel } from './components/CartPanel';
import { ModifierDialog } from './components/ModifierDialog';
import { TableMapDialog } from './components/TableMapDialog';
import { OpenOrdersDialog } from './components/OpenOrdersDialog';
import { LiveCustomerPanel } from './components/LiveCustomerPanel';
import { Spinner } from './components/Modal';
import type { PosConfig, CatalogPayload, Category, Product, CustomerSummary } from './types';

// Singleton Phase-1 api (loadCatalog bypassed via externalCatalog param in usePosEngine)
const LIVE_API = createPhase1PosApi();

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

// ─── Map DB customer row → POS CustomerSummary ────────────────────────────────
// customerType in DB: 'individual' | 'organization'  (NOT 'company')
function mapCustomer(c: any): CustomerSummary {
  return {
    id: String(c.id),
    code: c.code ?? null,
    name: c.name,
    phone: c.phone ?? null,
    taxNumber: c.taxNumber ?? null,
    balanceMinor: Math.round(Number(c.balance ?? 0) * 100),
    customerType: (c.customerType === 'organization' ? 'organization' : 'individual') as CustomerSummary['customerType'],
  };
}

// ─── Small reusable pieces ────────────────────────────────────────────────────
function QueryErrorBadge({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-rose-700/80 px-2 py-1 text-xs text-white">
      <span>⚠ {label}</span>
      <button
        type="button"
        onClick={onRetry}
        className="rounded bg-white/20 px-1.5 py-0.5 font-bold hover:bg-white/30"
      >
        إعادة
      </button>
    </div>
  );
}

function QueryLoadingBadge({ label }: { label: string }) {
  return (
    <div className="flex animate-pulse items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-xs text-white/70">
      <span>⟳ {label}</span>
    </div>
  );
}

// ─── Invoice header bar ───────────────────────────────────────────────────────
// NOTE: Branch is intentionally excluded from Phase 1.
// SalesInvoicePage does not use branch either; the journal/warehouse are the
// identity anchors. Branch can be added in Phase 2 from the user session context.
interface HeaderProps {
  journals: any[];
  journalsLoading: boolean;
  journalsError: boolean;
  onJournalsRetry: () => void;
  selectedJournalId: number | null;

  warehouses: any[];
  warehousesLoading: boolean;
  warehousesError: boolean;
  onWarehousesRetry: () => void;
  selectedWarehouseId: number | null;

  previewNumber: string | null;
  previewLoading: boolean;
  invoiceDate: Date;
  customer: CustomerSummary | null | undefined;

  isFullscreen: boolean;
  onToggleFullscreen: () => void;

  onJournalChange: (id: number) => void;
  onWarehouseChange: (id: number) => void;
  onOpenCustomer: () => void;
}

function InvoiceHeaderBar(props: HeaderProps) {
  const journal   = props.journals.find((j) => j.id === props.selectedJournalId);
  const warehouse = props.warehouses.find((w) => w.id === props.selectedWarehouseId);

  // Deterministic Gregorian dd-mm-yyyy — no locale/calendar ambiguity
  const d = props.invoiceDate;
  const dateStr = [
    String(d.getDate()).padStart(2, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    d.getFullYear(),
  ].join('-');

  // warehouse display: "code — name" when code exists
  const warehouseLabel = (w: any) => (w.code ? `${w.code} — ${w.name}` : w.name);

  // customerType DB values: 'individual' | 'organization'
  const typeLabel = (t: CustomerSummary['customerType']) =>
    t === 'organization' ? 'مؤسسة' : 'فرد';

  const isOrg = props.customer?.customerType === 'organization';

  return (
    <div className="border-b border-[#1C4576]/30 bg-[#1C4576] px-3 py-2 text-white shadow-md">
      <div className="flex flex-wrap items-center gap-2">

        {/* ── Journal (sales journals only — docTypes: sales_invoice, sales) ── */}
        {props.journalsError ? (
          <QueryErrorBadge label="خطأ في تحميل الدفاتر" onRetry={props.onJournalsRetry} />
        ) : props.journalsLoading ? (
          <QueryLoadingBadge label="جارٍ تحميل الدفاتر" />
        ) : (
          <label className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-xs transition hover:bg-white/20">
            <span className="text-[#D8AE55]">📋</span>
            <span className="font-semibold opacity-75">الدفتر</span>
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
          </label>
        )}

        {/* ── Warehouse: code — name ── */}
        {props.warehousesError ? (
          <QueryErrorBadge label="خطأ في تحميل المستودعات" onRetry={props.onWarehousesRetry} />
        ) : props.warehousesLoading ? (
          <QueryLoadingBadge label="جارٍ تحميل المستودعات" />
        ) : props.warehouses.length > 0 ? (
          <label className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-xs transition hover:bg-white/20">
            <span className="text-[#D8AE55]">🏪</span>
            <span className="font-semibold opacity-75">المستودع</span>
            <select
              value={props.selectedWarehouseId ?? ''}
              onChange={(e) => { const v = Number(e.target.value); if (v) props.onWarehouseChange(v); }}
              className="max-w-[180px] truncate bg-transparent text-xs font-bold outline-none"
            >
              <option value="">— اختر مستودع —</option>
              {props.warehouses.map((w) => (
                <option key={w.id} value={w.id}>{warehouseLabel(w)}</option>
              ))}
            </select>
          </label>
        ) : null}

        {/* ── Advisory number — visible text with caption ── */}
        <div className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-xs">
          <span className="text-[#D8AE55]">#</span>
          <span className="font-semibold opacity-75">رقم استرشادي</span>
          <span className="font-black tabular-nums">
            {props.previewLoading
              ? '...'
              : props.previewNumber ?? (props.selectedJournalId ? '—' : 'اختر دفتراً')}
          </span>
          <span className="text-[9px] opacity-50">— يُعتمد عند الحفظ</span>
        </div>

        {/* ── Date dd-mm-yyyy ── */}
        <div className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-xs">
          <span className="text-[#D8AE55]">📅</span>
          <span className="font-bold tabular-nums">{dateStr}</span>
        </div>

        {/* ── Customer: code · type (فرد/مؤسسة) · name · phone · tax# ── */}
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
          {props.customer ? (
            <span className="flex flex-col items-start gap-0.5 leading-none">
              <span className="flex items-center gap-1">
                {props.customer.code ? (
                  <span className="font-black text-[#D8AE55]">{props.customer.code}</span>
                ) : null}
                <span className="max-w-[140px] truncate">{props.customer.name}</span>
                <span className="shrink-0 text-[10px] opacity-60">
                  {typeLabel(props.customer.customerType)}
                </span>
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-normal opacity-70">
                {props.customer.phone ? <span>{props.customer.phone}</span> : null}
                {/* Tax number shown only for organizations */}
                {isOrg && props.customer.taxNumber ? (
                  <span>• ض: {props.customer.taxNumber}</span>
                ) : null}
              </span>
            </span>
          ) : (
            <span>عميل نقدي</span>
          )}
        </button>

        {/* ── Status hint ── */}
        <div className="ms-auto flex items-center gap-2 text-[10px] opacity-60">
          {props.selectedJournalId && !props.selectedWarehouseId ? (
            <span className="text-[#D8AE55] opacity-100">⚠ اختر مستودعاً لمعرفة الرصيد</span>
          ) : journal && warehouse ? (
            <span className="text-[#D8AE55] opacity-100">
              {journal.code} / {warehouseLabel(warehouse)}
            </span>
          ) : null}
        </div>

        {/* ── Fullscreen toggle button ── */}
        <button
          type="button"
          onClick={props.onToggleFullscreen}
          title={props.isFullscreen ? 'خروج من ملء الشاشة (F11)' : 'ملء الشاشة (F11)'}
          className="flex shrink-0 items-center justify-center rounded-lg bg-white/10 p-1.5 transition hover:bg-white/25"
          style={{ touchAction: 'manipulation', minWidth: 48, minHeight: 48 }}
        >
          {props.isFullscreen ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
              <line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Full-page loading / error ─────────────────────────────────────────────────
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
      <div className="max-w-sm rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center shadow-lg">
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
  const { isPosWorkspaceActive, setIsPosWorkspaceActive } = useTabManager();

  // Register lifecycle intent with TabManagerContext (decorative in MDI — derived
  // tab state is the authoritative value, but mount/unmount signal is preserved).
  useEffect(() => {
    setIsPosWorkspaceActive(true);
    return () => setIsPosWorkspaceActive(false);
  }, [setIsPosWorkspaceActive]);

  // ─── Fullscreen state ─────────────────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isElectron = Boolean((window as any).erpAPI?.setFullScreen);

  // ─── Auto-exit fullscreen when POS loses active-workspace status ──────────
  // Covers: switch tab, open dashboard, minimize POS window, close POS tab.
  // Uses prevRef so it only fires on a true→false TRANSITION, never on
  // ordinary re-renders or when POS is already the active workspace.
  const prevIsActiveRef = useRef(isPosWorkspaceActive);
  useEffect(() => {
    const wasActive = prevIsActiveRef.current;
    prevIsActiveRef.current = isPosWorkspaceActive;

    if (wasActive && !isPosWorkspaceActive && isFullscreen) {
      const erpAPI = (window as any).erpAPI;
      if (erpAPI?.setFullScreen) {
        erpAPI.setFullScreen(false);          // Electron BrowserWindow
      } else if (document.fullscreenElement) {
        document.exitFullscreen?.();           // Browser DOM fullscreen
      }
    }
  }, [isPosWorkspaceActive, isFullscreen]);

  useEffect(() => {
    // DOM Fullscreen API (browser mode)
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);

    // Electron fullscreen change events (IPC)
    const erpAPI = (window as any).erpAPI;
    let cleanup: (() => void) | undefined;
    if (erpAPI?.onFullScreenChange) {
      cleanup = erpAPI.onFullScreenChange((v: boolean) => setIsFullscreen(v));
    }

    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      cleanup?.();
    };
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    const erpAPI = (window as any).erpAPI;
    if (erpAPI?.setFullScreen) {
      // Electron path
      await erpAPI.setFullScreen(!isFullscreen);
    } else if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, [isFullscreen]);

  // ─── Invoice header state ─────────────────────────────────────────────────
  const [journalId,      setJournalId]      = useState<number | null>(null);
  const [warehouseId,    setWarehouseId]    = useState<number | null>(null);
  const [previewNumber,  setPreviewNumber]  = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [invoiceDate]                       = useState<Date>(new Date());

  // ─── tRPC queries ─────────────────────────────────────────────────────────
  const warehousesQuery = trpc.warehouses.list.useQuery();
  // Only sales journals: docTypes matches what SalesInvoicePage uses
  const journalsQuery   = trpc.documentJournals.list.useQuery({ docTypes: ['sales_invoice', 'sales'] });
  const productsQuery   = trpc.products.list.useQuery({});
  const groupsQuery     = trpc.productGroups.list.useQuery();
  const stockQuery      = trpc.reports.stockByWarehouse.useQuery(
    { warehouseId: warehouseId! },
    { enabled: warehouseId != null },
  );
  const customersQuery  = trpc.customers.list.useQuery();
  const utils           = trpc.useUtils();

  // ─── Journal change: same logic as SalesInvoicePage ──────────────────────
  // Auto-assign journal.warehouseId; fetch advisory number (read-only — no sequence consumed)
  const handleJournalChange = useCallback(async (id: number) => {
    setJournalId(id);
    const found = (journalsQuery.data ?? []).find((j: any) => j.id === id);
    if (found?.warehouseId) setWarehouseId(found.warehouseId);
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

  // ─── Catalog (products + categories + stock) ──────────────────────────────
  const catalog = useMemo<CatalogPayload>(
    () => buildCatalog(groupsQuery.data, productsQuery.data, stockQuery.data, warehouseId),
    [groupsQuery.data, productsQuery.data, stockQuery.data, warehouseId],
  );

  // ─── Customers ────────────────────────────────────────────────────────────
  const mappedCustomers = useMemo(
    () => (customersQuery.data ?? []).map(mapCustomer),
    [customersQuery.data],
  );

  // ─── POS config (no branch — Phase 1 follows SalesInvoicePage pattern) ───
  const selectedJournal = (journalsQuery.data ?? []).find((j: any) => j.id === journalId);

  const config = useMemo<PosConfig>(() => ({
    currency: 'SAR',
    locale: 'ar-SA',
    defaultMode: 'quick',
    defaultView: 'mixed',
    taxInclusive: false,
    allowOfflineCheckout: false,
    cashierName: (user as any)?.name ?? (user as any)?.username ?? 'المستخدم',
    registerName: selectedJournal
      ? `${selectedJournal.code} — ${selectedJournal.name}`
      : 'اختر دفتر المبيعات',
  }), [selectedJournal, user]);

  // ─── Engine ───────────────────────────────────────────────────────────────
  const engine = usePosEngine(LIVE_API, config, catalog);
  const { state, totals, filteredProducts, dispatch } = engine;

  // ─── UI state ─────────────────────────────────────────────────────────────
  const [overlay,         setOverlay]         = useState<Overlay>(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [modifierProduct, setModifierProduct] = useState<Product | null>(null);
  const [online,          setOnline]          = useState(() => navigator.onLine);
  const [notice,          setNotice]          = useState<string | null>(null);

  useEffect(() => {
    const up = () => setOnline(true);
    const dn = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', dn);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', dn); };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); document.getElementById('pos-search')?.focus(); return; }
      if (e.key === 'F4') { e.preventDefault(); setOverlay('customer'); return; }
      if (e.key === 'F11') { e.preventDefault(); handleToggleFullscreen(); return; }
      if (e.key === 'Escape') {
        if (isElectron && isFullscreen) { handleToggleFullscreen(); return; }
        if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
        if (modifierProduct) setModifierProduct(null);
        else setOverlay(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [modifierProduct, handleToggleFullscreen, isElectron, isFullscreen]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(t);
  }, [notice]);

  const favoriteProducts = useMemo(
    () => state.catalog.products.filter((p) => p.isActive && p.isAvailable && p.isFavorite),
    [state.catalog.products],
  );

  // ─── Handlers ─────────────────────────────────────────────────────────────
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

  // ─── Auto-select newly created customer ───────────────────────────────────
  // After CustomerFormDialog.onSaved: refetch list → pick highest id (newest) → dispatch
  const handleCustomerSaved = useCallback(async () => {
    setShowAddCustomer(false);
    try {
      const freshList = await utils.customers.list.fetch();
      if (freshList && freshList.length > 0) {
        const newest = freshList.reduce((a: any, b: any) => (a.id > b.id ? a : b));
        dispatch({ type: 'setCustomer', customer: mapCustomer(newest) });
      }
    } catch {
      utils.customers.list.invalidate();
    }
  }, [utils, dispatch]);

  // ─── Critical loading / error guards ──────────────────────────────────────
  const isCriticalLoading = productsQuery.isLoading || groupsQuery.isLoading;
  const criticalError     = productsQuery.error ?? groupsQuery.error;

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
          onRetry={() => { productsQuery.refetch(); groupsQuery.refetch(); }}
        />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      dir="rtl"
      className="flex flex-col overflow-hidden bg-slate-100 font-sans text-slate-900"
      style={{ width: '100%', height: '100%', minHeight: 0 }}
    >
      <InvoiceHeaderBar
        journals={journalsQuery.data ?? []}
        journalsLoading={journalsQuery.isLoading}
        journalsError={Boolean(journalsQuery.error)}
        onJournalsRetry={() => journalsQuery.refetch()}
        selectedJournalId={journalId}

        warehouses={warehousesQuery.data ?? []}
        warehousesLoading={warehousesQuery.isLoading}
        warehousesError={Boolean(warehousesQuery.error)}
        onWarehousesRetry={() => warehousesQuery.refetch()}
        selectedWarehouseId={warehouseId}

        previewNumber={previewNumber}
        previewLoading={previewLoading}
        invoiceDate={invoiceDate}
        customer={state.draft.customer}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
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

      {/* Non-critical error banners */}
      {customersQuery.error ? (
        <div className="flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
          <span>⚠ تعذّر تحميل قائمة العملاء</span>
          <button type="button" onClick={() => customersQuery.refetch()} className="font-bold underline hover:no-underline">
            إعادة المحاولة
          </button>
        </div>
      ) : null}

      {warehouseId != null && stockQuery.error ? (
        <div className="flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
          <span>⚠ تعذّر تحميل بيانات المخزون — الأصناف تُعرض بدون تحقق من الرصيد</span>
          <button type="button" onClick={() => stockQuery.refetch()} className="font-bold underline hover:no-underline">
            إعادة
          </button>
        </div>
      ) : null}

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

      {/* Toast */}
      {(state.error || notice) ? (
        <div className={`fixed bottom-4 start-1/2 z-[150] max-w-[90vw] -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-bold shadow-xl ${
          state.error ? 'bg-rose-700 text-white' : 'bg-slate-950 text-white'
        }`}>
          <div className="flex items-center gap-3">
            <span>{state.error ?? notice}</span>
            {state.error ? (
              <button type="button" onClick={() => dispatch({ type: 'error', message: null })} className="rounded-md bg-white/15 px-2 py-1">
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
          onConfirm={(modifiers) => { engine.addProduct(modifierProduct, modifiers); setModifierProduct(null); }}
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
          api={LIVE_API}
          config={config}
          selectedTable={state.draft.table}
          onClose={() => setOverlay(null)}
          onSelect={(table) => dispatch({ type: 'setTable', table })}
        />
      ) : null}

      {overlay === 'orders' ? (
        <OpenOrdersDialog
          api={LIVE_API}
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
