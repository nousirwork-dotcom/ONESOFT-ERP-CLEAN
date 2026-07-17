import { useEffect, useMemo, useState } from 'react';
import type { PosApi } from './api';
import type { PosConfig, Product } from './types';
import { usePosEngine } from './usePosEngine';
import { TopBar } from './components/TopBar';
import { ProductBrowser } from './components/ProductBrowser';
import { CartPanel } from './components/CartPanel';
import { ModifierDialog } from './components/ModifierDialog';
import { PaymentDialog } from './components/PaymentDialog';
import { CustomerDrawer } from './components/CustomerDrawer';
import { TableMapDialog } from './components/TableMapDialog';
import { OpenOrdersDialog } from './components/OpenOrdersDialog';

interface POSPageProps {
  api: PosApi;
  config: PosConfig;
}

type Overlay = 'customer' | 'tables' | 'orders' | 'payment' | null;

export function POSPage({ api, config }: POSPageProps) {
  const engine = usePosEngine(api, config);
  const { state, totals, filteredProducts, dispatch } = engine;
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [modifierProduct, setModifierProduct] = useState<Product | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [notice, setNotice] = useState<string | null>(null);

  const favoriteProducts = useMemo(
    () => state.catalog.products.filter((product) => product.isActive && product.isAvailable && product.isFavorite),
    [state.catalog.products],
  );

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
      if (event.key === 'F2') {
        event.preventDefault();
        document.getElementById('pos-search')?.focus();
        return;
      }
      if (event.key === 'F4') {
        event.preventDefault();
        setOverlay('customer');
        return;
      }
      if (event.key === 'F8') {
        event.preventDefault();
        if (state.draft.lines.length > 0) setOverlay('payment');
        return;
      }
      if (event.key === 'Escape') {
        if (modifierProduct) setModifierProduct(null);
        else setOverlay(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modifierProduct, state.draft.lines.length]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const handleProductClick = (product: Product) => {
    if (!product.isAvailable) return;
    const activeGroups = product.modifierGroups?.filter((group) => group.options.some((option) => option.isActive)) ?? [];
    if (activeGroups.length > 0) {
      setModifierProduct(product);
      return;
    }
    engine.addProduct(product);
  };

  const handleNewOrder = () => {
    if (state.draft.lines.length > 0) {
      const accepted = window.confirm('سيتم إلغاء المسودة الحالية وبدء طلب جديد. هل تريد المتابعة؟');
      if (!accepted) return;
    }
    engine.resetDraft();
  };

  const handleSave = async () => {
    const result = await engine.saveDraft();
    if (result) setNotice(`تم حفظ الطلب ${result.displayNumber}`);
  };

  const handleKitchen = async () => {
    const result = await engine.sendToKitchen();
    if (result) setNotice(`تم إرسال الطلب ${result.displayNumber} إلى المطبخ`);
  };

  const handleBarcodeEnter = (value: string) => {
    const product = engine.findByBarcode(value);
    if (product) handleProductClick(product);
    else if (value.trim()) setNotice('لم يتم العثور على باركود مطابق أو أن الصنف غير متاح');
  };

  return (
    <div dir="rtl" className="flex h-full min-h-[640px] flex-col overflow-hidden bg-slate-100 font-sans text-slate-900">
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
          categories={state.catalog.categories.filter((category) => category.id !== 'all')}
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
          onSave={handleSave}
          onKitchen={handleKitchen}
          onPay={() => setOverlay('payment')}
          onNew={handleNewOrder}
        />
      </main>

      {(state.error || notice) ? (
        <div className={`fixed bottom-4 start-1/2 z-[150] max-w-[90vw] -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-bold shadow-xl ${state.error ? 'bg-rose-700 text-white' : 'bg-slate-950 text-white'}`}>
          <div className="flex items-center gap-3">
            <span>{state.error ?? notice}</span>
            {state.error ? <button type="button" onClick={() => dispatch({ type: 'error', message: null })} className="rounded-md bg-white/15 px-2 py-1">إغلاق</button> : null}
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
        <CustomerDrawer
          api={api}
          config={config}
          selectedCustomer={state.draft.customer}
          onClose={() => setOverlay(null)}
          onSelect={(customer) => dispatch({ type: 'setCustomer', customer })}
        />
      ) : null}

      {overlay === 'tables' ? (
        <TableMapDialog
          api={api}
          config={config}
          selectedTable={state.draft.table}
          onClose={() => setOverlay(null)}
          onSelect={(table) => dispatch({ type: 'setTable', table })}
        />
      ) : null}

      {overlay === 'orders' ? (
        <OpenOrdersDialog api={api} config={config} onClose={() => setOverlay(null)} />
      ) : null}

      {overlay === 'payment' ? (
        <PaymentDialog
          dueMinor={totals.grandTotalMinor}
          config={config}
          customer={state.draft.customer}
          busy={state.busyAction === 'checkout'}
          onClose={() => setOverlay(null)}
          onConfirm={async (payments) => {
            const result = await engine.checkout(payments);
            if (!result) return false;
            setOverlay(null);
            setNotice(`تم اعتماد الفاتورة ${result.displayNumber} بنجاح`);
            return true;
          }}
        />
      ) : null}
    </div>
  );
}
