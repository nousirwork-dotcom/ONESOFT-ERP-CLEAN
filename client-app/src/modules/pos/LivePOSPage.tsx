import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { trpc } from '@/shared/lib/trpc';
import { useAuth } from '@/core/hooks/useAuth';
import { useTabManager } from '@/core/contexts/TabManagerContext';
import CustomerFormDialog from '@/shared/components/CustomerFormDialog';
import { OneSoftPOSSuite } from './suite/POSRoot';
import { POSCatalogProvider } from './suite/catalog-context';
import ERPToolbar from '@/shared/components/ERPToolbar';
import type { Product, ProductGroup, CustomerSummary, JournalSummary, WarehouseSummary } from './suite/types';

// ─── Data mappers ─────────────────────────────────────────────────────────────

function mapProduct(p: any, stockMap: Map<number, number>): Product {
  const isService = p.itemType === 'service';
  const qty = isService ? null : (stockMap.get(Number(p.id)) ?? null);
  return {
    id: Number(p.id),
    code: p.code ?? '',
    barcode: p.barcode ?? null,
    name: p.name,
    groupId: p.groupId != null ? Number(p.groupId) : 0,
    imageUrl: null,
    unitName: p.unitName ?? 'وحدة',
    salePrice: Number(p.salePrice ?? 0),
    taxRate: Number(p.taxRate ?? 0),
    stockQuantity: qty,
    itemType: isService ? 'service' : 'stock',
    hasModifiers: false,
  };
}

function mapProductGroup(g: any): ProductGroup {
  return {
    id: Number(g.id),
    name: g.name,
    color: g.color ?? null,
    imageUrl: null,
  };
}

function mapCustomer(c: any): CustomerSummary {
  return {
    id: Number(c.id),
    code: c.code ?? '',
    name: c.name,
    customerType: c.customerType === 'organization' ? 'organization' : 'individual',
    phone: c.phone ?? null,
    taxNumber: c.taxNumber ?? null,
  };
}

function mapJournal(j: any, previewNumber?: string | null): JournalSummary {
  return {
    id: Number(j.id),
    code: j.code ?? '',
    name: j.name,
    warehouseId: j.warehouseId != null ? Number(j.warehouseId) : null,
    previewNumber: previewNumber ?? undefined,
  };
}

function mapWarehouse(w: any): WarehouseSummary {
  return {
    id: Number(w.id),
    code: w.code ?? '',
    name: w.name,
  };
}

// ─── Loading / Error screens ──────────────────────────────────────────────────

function PageLoading() {
  return (
    <div
      className="onesoft-pos-suite"
      dir="rtl"
      style={{ display: 'grid', placeItems: 'center', background: 'var(--pos-bg, #f3f6f9)' }}
    >
      <div style={{ textAlign: 'center', color: '#1C4576' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⟳</div>
        <strong>جارٍ تحميل بيانات نقطة البيع</strong>
        <div style={{ marginTop: 6, fontSize: 13, color: '#6d7a8c' }}>
          الأصناف، الدفاتر، المستودعات...
        </div>
      </div>
    </div>
  );
}

function PageError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      className="onesoft-pos-suite"
      dir="rtl"
      style={{ display: 'grid', placeItems: 'center', background: 'var(--pos-bg, #f3f6f9)' }}
    >
      <div
        style={{
          maxWidth: 400,
          borderRadius: 20,
          border: '1px solid #fecaca',
          background: '#fff5f5',
          padding: 32,
          textAlign: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,.08)',
        }}
      >
        <div style={{ fontSize: 40 }}>⚠</div>
        <div style={{ marginTop: 12, fontWeight: 800, color: '#991b1b' }}>
          تعذّر تحميل بيانات نقطة البيع
        </div>
        <div style={{ marginTop: 6, fontSize: 14, color: '#b91c1c' }}>{message}</div>
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 20,
            background: '#1C4576',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '10px 24px',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function LivePOSPage() {
  const { user } = useAuth();
  const { isPosWorkspaceActive } = useTabManager();

  // ─── Fullscreen ─────────────────────────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false);

  const prevIsActiveRef = useRef(isPosWorkspaceActive);
  useEffect(() => {
    const wasActive = prevIsActiveRef.current;
    prevIsActiveRef.current = isPosWorkspaceActive;
    if (wasActive && !isPosWorkspaceActive && isFullscreen) {
      const erpAPI = (window as any).erpAPI;
      if (erpAPI?.setFullScreen) {
        erpAPI.setFullScreen(false);
      } else if (document.fullscreenElement) {
        document.exitFullscreen?.();
      }
    }
  }, [isPosWorkspaceActive, isFullscreen]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        handleToggleFullscreen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen]);

  const handleToggleFullscreen = useCallback(async () => {
    const erpAPI = (window as any).erpAPI;
    if (erpAPI?.setFullScreen) {
      await erpAPI.setFullScreen(!isFullscreen);
    } else if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, [isFullscreen]);

  // ─── Journal / Warehouse / Preview ──────────────────────────────────────────
  const [journalId, setJournalId] = useState<number | null>(null);
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [previewNumber, setPreviewNumber] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ─── Customer add dialog ─────────────────────────────────────────────────────
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  // ─── tRPC queries ────────────────────────────────────────────────────────────
  const warehousesQuery = trpc.warehouses.list.useQuery();
  const journalsQuery   = trpc.documentJournals.list.useQuery({
    docTypes: ['sales_invoice', 'sales'],
  });
  const productsQuery   = trpc.products.list.useQuery({});
  const groupsQuery     = trpc.productGroups.list.useQuery();
  const stockQuery      = trpc.reports.stockByWarehouse.useQuery(
    { warehouseId: warehouseId! },
    { enabled: warehouseId != null },
  );
  const customersQuery  = trpc.customers.list.useQuery();
  const utils           = trpc.useUtils();

  // ─── Journal change ──────────────────────────────────────────────────────────
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

  // ─── Stock map ────────────────────────────────────────────────────────────────
  const stockMap = useMemo(() => {
    const map = new Map<number, number>();
    if (stockQuery.data && warehouseId != null) {
      for (const row of (stockQuery.data as any[])) {
        map.set(Number(row.productId), Number(row.totalQuantity ?? 0));
      }
    }
    return map;
  }, [stockQuery.data, warehouseId]);

  // ─── Mapped data ─────────────────────────────────────────────────────────────
  const suiteProducts = useMemo(
    () =>
      ((productsQuery.data ?? []) as any[])
        .filter((p) => p.isActive !== false)
        .map((p) => mapProduct(p, stockMap)),
    [productsQuery.data, stockMap],
  );

  const suiteGroups = useMemo(
    () => ((groupsQuery.data ?? []) as any[]).map(mapProductGroup),
    [groupsQuery.data],
  );

  const suiteCustomers = useMemo(
    () => ((customersQuery.data ?? []) as any[]).map(mapCustomer),
    [customersQuery.data],
  );

  const suiteJournals = useMemo(
    () =>
      ((journalsQuery.data ?? []) as any[]).map((j) =>
        mapJournal(j, j.id === journalId ? previewNumber : null),
      ),
    [journalsQuery.data, journalId, previewNumber],
  );

  const suiteWarehouses = useMemo(
    () => ((warehousesQuery.data ?? []) as any[]).map(mapWarehouse),
    [warehousesQuery.data],
  );

  // ─── Customer saved ───────────────────────────────────────────────────────────
  const handleCustomerSaved = useCallback(() => {
    setShowAddCustomer(false);
    customersQuery.refetch();
  }, [customersQuery]);

  const cashierName =
    (user as any)?.name ?? (user as any)?.username ?? 'المستخدم';

  // ─── Critical loading gate ────────────────────────────────────────────────────
  const isCriticalLoading = productsQuery.isLoading || groupsQuery.isLoading;
  const criticalError = productsQuery.error ?? groupsQuery.error;

  if (isCriticalLoading) {
    return (
      <div dir="rtl" style={{ width: '100%', height: '100%', minHeight: 0 }}>
        <PageLoading />
      </div>
    );
  }

  if (criticalError) {
    return (
      <div dir="rtl" style={{ width: '100%', height: '100%', minHeight: 0 }}>
        <PageError
          message={(criticalError as any).message ?? 'تعذّر تحميل بيانات الأصناف'}
          onRetry={() => { productsQuery.refetch(); groupsQuery.refetch(); }}
        />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <ERPToolbar
          buttons={["new", "print", "exit"]}
          onNew={() => { (window as any).__pos_new?.(); }}
          onPrint={() => window.print()}
          onExit={() => window.history.back()}
          hideStatusBar
          enableShortcuts={false}
        />
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
      <POSCatalogProvider
        value={{
          products: suiteProducts,
          productGroups: suiteGroups,
          customers: suiteCustomers,
          journals: suiteJournals,
          warehouses: suiteWarehouses,
          isLoading: false,
          selectedJournalId: journalId,
          selectedWarehouseId: warehouseId,
          previewNumber,
          previewLoading,
          onJournalChange: handleJournalChange,
          onWarehouseChange: setWarehouseId,
          onAddCustomer: () => setShowAddCustomer(true),
          isFullscreen,
          onToggleFullscreen: handleToggleFullscreen,
          cashierName,
        }}
      >
        <OneSoftPOSSuite />
      </POSCatalogProvider>
        </div>
      </div>

      {showAddCustomer ? (
        <CustomerFormDialog
          open={showAddCustomer}
          onClose={() => setShowAddCustomer(false)}
          onSaved={handleCustomerSaved}
        />
      ) : null}
    </>
  );
}
