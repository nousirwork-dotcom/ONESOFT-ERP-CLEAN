import { useCallback, useEffect, useMemo, useReducer } from 'react';
import type { PosApi } from './api';
import { calculateOrderTotals } from './money';
import type {
  CartLine,
  CatalogPayload,
  CheckoutResult,
  CustomerSummary,
  PaymentLine,
  PosConfig,
  PosDraft,
  PosMode,
  Product,
  ProductView,
  RestaurantTable,
  SelectedModifier,
  ServiceType,
} from './types';

function createId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function createEmptyDraft(config: PosConfig, mode = config.defaultMode): PosDraft {
  const timestamp = nowIso();
  return {
    clientDraftId: createId('draft'),
    mode,
    serviceType: mode === 'restaurant' ? 'dineIn' : 'takeaway',
    registerId: config.registerId ?? null,
    branchId: config.branchId ?? null,
    shiftId: config.shiftId ?? null,
    customer: null,
    table: null,
    guestCount: mode === 'restaurant' ? 1 : null,
    lines: [],
    orderDiscountMinor: 0,
    note: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

interface State {
  catalog: CatalogPayload;
  loadingCatalog: boolean;
  error: string | null;
  mode: PosMode;
  view: ProductView;
  selectedCategoryId: string | null;
  search: string;
  draft: PosDraft;
  busyAction: 'save' | 'kitchen' | 'checkout' | null;
  lastResult: CheckoutResult | null;
}

type Action =
  | { type: 'catalogLoading' }
  | { type: 'catalogLoaded'; payload: CatalogPayload }
  | { type: 'error'; message: string | null }
  | { type: 'setMode'; mode: PosMode }
  | { type: 'setView'; view: ProductView }
  | { type: 'setCategory'; categoryId: string | null }
  | { type: 'setSearch'; value: string }
  | { type: 'setCustomer'; customer: CustomerSummary | null }
  | { type: 'setTable'; table: RestaurantTable | null }
  | { type: 'setServiceType'; serviceType: ServiceType }
  | { type: 'setGuestCount'; guestCount: number }
  | { type: 'setOrderNote'; note: string }
  | { type: 'addLine'; line: CartLine }
  | { type: 'replaceLines'; lines: CartLine[] }
  | { type: 'setLineQuantity'; lineId: string; quantity: number }
  | { type: 'setLineNote'; lineId: string; note: string }
  | { type: 'removeLine'; lineId: string }
  | { type: 'setBusy'; action: State['busyAction'] }
  | { type: 'checkoutSuccess'; result: CheckoutResult; nextDraft: PosDraft }
  | { type: 'resetDraft'; draft: PosDraft }
  | { type: 'restoreDraft'; draft: PosDraft };

function touchDraft(draft: PosDraft): PosDraft {
  return { ...draft, updatedAt: nowIso() };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'catalogLoading':
      return { ...state, loadingCatalog: true, error: null };
    case 'catalogLoaded':
      return { ...state, catalog: action.payload, loadingCatalog: false };
    case 'error':
      return { ...state, error: action.message, loadingCatalog: false };
    case 'setMode':
      return {
        ...state,
        mode: action.mode,
        draft: touchDraft({
          ...state.draft,
          mode: action.mode,
          serviceType: action.mode === 'restaurant' ? state.draft.serviceType : 'takeaway',
          table: action.mode === 'restaurant' ? state.draft.table : null,
          guestCount: action.mode === 'restaurant' ? (state.draft.guestCount ?? 1) : null,
        }),
      };
    case 'setView':
      return { ...state, view: action.view };
    case 'setCategory':
      return { ...state, selectedCategoryId: action.categoryId };
    case 'setSearch':
      return { ...state, search: action.value };
    case 'setCustomer':
      return { ...state, draft: touchDraft({ ...state.draft, customer: action.customer }) };
    case 'setTable':
      return {
        ...state,
        draft: touchDraft({
          ...state.draft,
          table: action.table,
          serviceType: action.table ? 'dineIn' : state.draft.serviceType,
        }),
      };
    case 'setServiceType':
      return {
        ...state,
        draft: touchDraft({
          ...state.draft,
          serviceType: action.serviceType,
          table: action.serviceType === 'dineIn' ? state.draft.table : null,
        }),
      };
    case 'setGuestCount':
      return { ...state, draft: touchDraft({ ...state.draft, guestCount: Math.max(1, action.guestCount) }) };
    case 'setOrderNote':
      return { ...state, draft: touchDraft({ ...state.draft, note: action.note }) };
    case 'addLine':
      return { ...state, draft: touchDraft({ ...state.draft, lines: [...state.draft.lines, action.line] }) };
    case 'replaceLines':
      return { ...state, draft: touchDraft({ ...state.draft, lines: action.lines }) };
    case 'setLineQuantity':
      return {
        ...state,
        draft: touchDraft({
          ...state.draft,
          lines: state.draft.lines
            .map((line) => line.id === action.lineId ? { ...line, quantity: Math.max(0, action.quantity) } : line)
            .filter((line) => line.quantity > 0),
        }),
      };
    case 'setLineNote':
      return {
        ...state,
        draft: touchDraft({
          ...state.draft,
          lines: state.draft.lines.map((line) => line.id === action.lineId ? { ...line, note: action.note } : line),
        }),
      };
    case 'removeLine':
      return {
        ...state,
        draft: touchDraft({ ...state.draft, lines: state.draft.lines.filter((line) => line.id !== action.lineId) }),
      };
    case 'setBusy':
      return { ...state, busyAction: action.action };
    case 'checkoutSuccess':
      return { ...state, busyAction: null, lastResult: action.result, draft: action.nextDraft };
    case 'resetDraft':
      return { ...state, draft: action.draft, lastResult: null };
    case 'restoreDraft':
      return { ...state, mode: action.draft.mode, draft: action.draft };
    default:
      return state;
  }
}

function modifierSignature(modifiers: SelectedModifier[]): string {
  return [...modifiers]
    .sort((a, b) => `${a.groupId}:${a.optionId}`.localeCompare(`${b.groupId}:${b.optionId}`))
    .map((item) => `${item.groupId}:${item.optionId}`)
    .join('|');
}

function isValidStoredDraft(value: unknown): value is PosDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<PosDraft>;
  return typeof draft.clientDraftId === 'string' && Array.isArray(draft.lines) && typeof draft.mode === 'string';
}

export function usePosEngine(api: PosApi, config: PosConfig, externalCatalog?: CatalogPayload) {
  const preferenceKey = `onesoft-pos-preferences:${config.branchId ?? 'default'}:${config.registerId ?? 'default'}`;
  const draftKey = `onesoft-pos-draft:${config.branchId ?? 'default'}:${config.registerId ?? 'default'}`;

  const initialPreferences = (() => {
    try {
      const raw = localStorage.getItem(preferenceKey);
      return raw ? JSON.parse(raw) as Partial<{ mode: PosMode; view: ProductView }> : {};
    } catch {
      return {};
    }
  })();

  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    catalog: { categories: [], products: [] },
    loadingCatalog: true,
    error: null,
    mode: initialPreferences.mode ?? config.defaultMode,
    view: initialPreferences.view ?? config.defaultView,
    selectedCategoryId: null,
    search: '',
    draft: createEmptyDraft(config, initialPreferences.mode ?? config.defaultMode),
    busyAction: null,
    lastResult: null,
  }));

  useEffect(() => {
    if (externalCatalog !== undefined) {
      dispatch({ type: 'catalogLoaded', payload: externalCatalog });
      return;
    }
    let active = true;
    dispatch({ type: 'catalogLoading' });
    api.loadCatalog()
      .then((payload) => {
        if (active) dispatch({ type: 'catalogLoaded', payload });
      })
      .catch((error: unknown) => {
        if (active) dispatch({ type: 'error', message: error instanceof Error ? error.message : 'تعذر تحميل الأصناف' });
      });
    return () => { active = false; };
  }, [api, externalCatalog]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (isValidStoredDraft(parsed) && parsed.lines.length > 0) {
        dispatch({ type: 'restoreDraft', draft: parsed });
      }
    } catch {
      localStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  useEffect(() => {
    localStorage.setItem(preferenceKey, JSON.stringify({ mode: state.mode, view: state.view }));
  }, [preferenceKey, state.mode, state.view]);

  useEffect(() => {
    if (state.draft.lines.length === 0) {
      localStorage.removeItem(draftKey);
      return;
    }
    localStorage.setItem(draftKey, JSON.stringify(state.draft));
  }, [draftKey, state.draft]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (state.draft.lines.length === 0) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [state.draft.lines.length]);

  const totals = useMemo(
    () => calculateOrderTotals(state.draft.lines, state.draft.orderDiscountMinor),
    [state.draft.lines, state.draft.orderDiscountMinor],
  );

  const filteredProducts = useMemo(() => {
    const query = state.search.trim().toLowerCase();
    return state.catalog.products.filter((product) => {
      if (!product.isActive) return false;
      if (state.view === 'favorites' && !product.isFavorite) return false;
      if (state.selectedCategoryId && state.selectedCategoryId !== 'all' && product.categoryId !== state.selectedCategoryId) return false;
      if (!query) return true;
      return [product.name, product.shortName, product.sku, product.barcode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [state.catalog.products, state.search, state.selectedCategoryId, state.view]);

  const addProduct = useCallback((product: Product, selectedModifiers: SelectedModifier[] = []) => {
    if (!product.isActive || !product.isAvailable) return;
    const signature = modifierSignature(selectedModifiers);
    const mergeTarget = state.draft.lines.find((line) =>
      line.productId === product.id &&
      modifierSignature(line.selectedModifiers) === signature &&
      !line.note &&
      !line.sentToKitchenAt,
    );

    if (mergeTarget) {
      dispatch({ type: 'setLineQuantity', lineId: mergeTarget.id, quantity: mergeTarget.quantity + 1 });
      return;
    }

    dispatch({
      type: 'addLine',
      line: {
        id: createId('line'),
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: 1,
        unitPriceMinor: product.priceMinor,
        taxRateBps: product.taxRateBps,
        isTaxInclusive: product.isTaxInclusive ?? config.taxInclusive,
        selectedModifiers,
        note: '',
        discountMinor: 0,
        sentToKitchenAt: null,
      },
    });
  }, [config.taxInclusive, state.draft.lines]);

  const findByBarcode = useCallback((barcode: string): Product | null => {
    const normalized = barcode.trim();
    if (!normalized) return null;
    const product = state.catalog.products.find((candidate) => candidate.barcode === normalized || candidate.sku === normalized);
    if (!product || !product.isActive || !product.isAvailable) return null;
    dispatch({ type: 'setSearch', value: '' });
    return product;
  }, [state.catalog.products]);

  const resetDraft = useCallback(() => {
    dispatch({ type: 'resetDraft', draft: createEmptyDraft(config, state.mode) });
  }, [config, state.mode]);

  const saveDraft = useCallback(async () => {
    if (state.draft.lines.length === 0 || state.busyAction) return null;
    dispatch({ type: 'setBusy', action: 'save' });
    try {
      const result = await api.saveDraft(state.draft);
      dispatch({ type: 'setBusy', action: null });
      return result;
    } catch (error) {
      dispatch({ type: 'setBusy', action: null });
      dispatch({ type: 'error', message: error instanceof Error ? error.message : 'تعذر حفظ الطلب' });
      return null;
    }
  }, [api, state.busyAction, state.draft]);

  const sendToKitchen = useCallback(async () => {
    if (state.draft.lines.length === 0 || state.busyAction) return null;
    dispatch({ type: 'setBusy', action: 'kitchen' });
    try {
      const result = await api.sendToKitchen(state.draft);
      const sentAt = nowIso();
      dispatch({
        type: 'replaceLines',
        lines: state.draft.lines.map((line) => line.sentToKitchenAt ? line : { ...line, sentToKitchenAt: sentAt }),
      });
      dispatch({ type: 'setBusy', action: null });
      return result;
    } catch (error) {
      dispatch({ type: 'setBusy', action: null });
      dispatch({ type: 'error', message: error instanceof Error ? error.message : 'تعذر إرسال الطلب إلى المطبخ' });
      return null;
    }
  }, [api, state.busyAction, state.draft]);

  const checkout = useCallback(async (payments: PaymentLine[]) => {
    if (state.draft.lines.length === 0 || state.busyAction) return null;
    const paymentTotal = payments.reduce((sum, item) => sum + item.amountMinor, 0);
    if (paymentTotal < totals.grandTotalMinor) {
      dispatch({ type: 'error', message: 'مجموع الدفعات أقل من إجمالي الفاتورة' });
      return null;
    }

    dispatch({ type: 'setBusy', action: 'checkout' });
    try {
      const result = await api.checkout({
        draft: state.draft,
        payments,
        expectedGrandTotalMinor: totals.grandTotalMinor,
      });
      localStorage.removeItem(draftKey);
      dispatch({ type: 'checkoutSuccess', result, nextDraft: createEmptyDraft(config, state.mode) });
      return result;
    } catch (error) {
      dispatch({ type: 'setBusy', action: null });
      dispatch({ type: 'error', message: error instanceof Error ? error.message : 'تعذر إتمام الدفع' });
      return null;
    }
  }, [api, config, draftKey, state.busyAction, state.draft, state.mode, totals.grandTotalMinor]);

  return {
    state,
    totals,
    filteredProducts,
    dispatch,
    addProduct,
    findByBarcode,
    resetDraft,
    saveDraft,
    sendToKitchen,
    checkout,
  };
}
