import React, { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import type {
  CartLine,
  CustomerSummary,
  ExternalOrder,
  KitchenTicket,
  KitchenItemStatus,
  POSMode,
  POSSection,
  POSSettings,
  POSState,
  Product,
  RestaurantTable,
  ShiftSummary,
  SuspendedOrder,
} from './types';

interface RuntimeState extends POSState {
  cashCustomer: CustomerSummary | null;
  tables: RestaurantTable[];
  kitchenTickets: KitchenTicket[];
  externalOrders: ExternalOrder[];
  suspendedOrders: SuspendedOrder[];
  notice: string | null;
  suspendCounter: number;
}

type Action =
  | { type: 'SET_SECTION'; section: POSSection }
  | { type: 'SET_MODE'; mode: POSMode }
  | { type: 'ADD_PRODUCT'; product: Product }
  | { type: 'ADD_LINE'; line: CartLine }
  | { type: 'CHANGE_QTY'; lineId: string; delta: number }
  | { type: 'REMOVE_LINE'; lineId: string }
  | { type: 'SET_CUSTOMER'; customer: CustomerSummary | null }
  | { type: 'SET_CASH_CUSTOMER'; customer: CustomerSummary | null }
  | { type: 'SET_ORDER_TYPE'; orderType: POSState['orderType'] }
  | { type: 'SELECT_TABLE'; tableId: number | null }
  | { type: 'SET_GUEST_COUNT'; guestCount: number }
  | { type: 'SEND_TO_KITCHEN' }
  | { type: 'ADVANCE_KITCHEN_ITEM'; ticketId: string; itemId: string }
  | { type: 'SET_SHIFT'; shift: ShiftSummary | null }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<POSSettings> }
  | { type: 'UPDATE_RESTAURANT_SETTINGS'; settings: Partial<POSSettings['restaurant']> }
  | { type: 'ACCEPT_EXTERNAL_ORDER'; orderId: string }
  | { type: 'REJECT_EXTERNAL_ORDER'; orderId: string }
  | { type: 'SET_NOTICE'; notice: string | null }
  | { type: 'NEW_ORDER' }
  | { type: 'SUSPEND_ORDER' }
  | { type: 'RESTORE_ORDER'; orderId: string };

const defaultSettings: POSSettings = {
  mode: 'restaurant',
  registerName: 'نقطة البيع الرئيسية',
  warehouseId: null,
  journalId: null,
  cashCustomerId: null,
  openFullscreen: true,
  touchMode: true,
  showProductImages: true,
  showStock: true,
  defaultView: 'groups',
  autoFocusBarcode: true,
  repeatBarcodeIncreasesQuantity: true,
  restaurant: {
    enableTables: true,
    enableWaiter: true,
    enableGuestCount: true,
    enableKitchen: true,
    allowAddAfterKitchenSend: true,
    requireReasonForSentItemChanges: true,
    autoAcceptExternalOrders: false,
    autoSendExternalOrdersToKitchen: true,
  },
};

const initialState: RuntimeState = {
  mode: 'store',
  activeSection: 'sale',
  orderType: 'takeaway',
  orderStatus: 'open',
  cart: [],
  customer: null,
  cashCustomer: null,
  selectedTableId: null,
  guestCount: 1,
  currentShift: null,
  settings: defaultSettings,
  tables: [],
  kitchenTickets: [],
  externalOrders: [],
  suspendedOrders: [],
  notice: null,
  suspendCounter: 0,
};

function lineTotal(line: CartLine): number {
  const base = line.quantity * line.unitPrice;
  const discount = base * (line.discountPercent / 100);
  const modifiers = line.modifiers.reduce((sum, item) => sum + item.priceDelta * line.quantity, 0);
  const taxable = base - discount + modifiers;
  return taxable + taxable * (line.taxRate / 100);
}

function reducer(state: RuntimeState, action: Action): RuntimeState {
  switch (action.type) {
    case 'SET_SECTION':
      return { ...state, activeSection: action.section };
    case 'SET_MODE': {
      const nextSettings = { ...state.settings, mode: action.mode };
      const restrictedSections: POSSection[] = ['tables', 'kitchen', 'external-orders'];
      const nextSection = action.mode === 'store' && restrictedSections.includes(state.activeSection) ? 'sale' : state.activeSection;
      return {
        ...state,
        mode: action.mode,
        settings: nextSettings,
        activeSection: nextSection,
        orderType: action.mode === 'restaurant' ? state.orderType : 'takeaway',
        selectedTableId: action.mode === 'restaurant' ? state.selectedTableId : null,
      };
    }
    case 'ADD_PRODUCT': {
      const existing = state.cart.find((line) => line.productId === action.product.id && line.kitchenStatus === 'new');
      if (existing && !action.product.hasModifiers) {
        return {
          ...state,
          cart: state.cart.map((line) =>
            line.id === existing.id ? { ...line, quantity: line.quantity + 1 } : line,
          ),
        };
      }
      const line: CartLine = {
        id: `${action.product.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        productId: action.product.id,
        productCode: action.product.code,
        name: action.product.name,
        unitName: action.product.unitName,
        quantity: 1,
        unitPrice: action.product.salePrice,
        taxRate: action.product.taxRate,
        discountPercent: 0,
        imageUrl: action.product.imageUrl,
        modifiers: [],
        kitchenStatus: 'new',
      };
      return { ...state, cart: [...state.cart, line] };
    }
    case 'CHANGE_QTY':
      return {
        ...state,
        cart: state.cart
          .map((line) => (line.id === action.lineId ? { ...line, quantity: line.quantity + action.delta } : line))
          .filter((line) => line.quantity > 0),
      };
    case 'REMOVE_LINE':
      return { ...state, cart: state.cart.filter((line) => line.id !== action.lineId) };
    case 'SET_CUSTOMER':
      return { ...state, customer: action.customer };
    case 'SET_CASH_CUSTOMER':
      return {
        ...state,
        cashCustomer: action.customer,
        customer: state.customer ?? action.customer,
      };
    case 'SET_ORDER_TYPE':
      return { ...state, orderType: action.orderType, selectedTableId: action.orderType === 'dine_in' ? state.selectedTableId : null };
    case 'SELECT_TABLE':
      return { ...state, selectedTableId: action.tableId };
    case 'SET_GUEST_COUNT':
      return { ...state, guestCount: Math.max(1, action.guestCount) };
    case 'SEND_TO_KITCHEN':
      return {
        ...state,
        orderStatus: 'sent_to_kitchen',
        cart: state.cart.map((line) =>
          line.kitchenStatus === 'new' ? { ...line, kitchenStatus: 'sent' as KitchenItemStatus } : line,
        ),
        notice: 'تم تجهيز البنود الجديدة للإرسال إلى المطبخ.',
      };
    case 'ADVANCE_KITCHEN_ITEM': {
      const order: KitchenItemStatus[] = ['sent', 'preparing', 'ready', 'served'];
      return {
        ...state,
        kitchenTickets: state.kitchenTickets.map((ticket) => {
          if (ticket.id !== action.ticketId) return ticket;
          return {
            ...ticket,
            items: ticket.items.map((item) => {
              if (item.id !== action.itemId) return item;
              const index = order.indexOf(item.status);
              return { ...item, status: order[Math.min(index + 1, order.length - 1)] ?? item.status };
            }),
          };
        }),
      };
    }
    case 'SET_SHIFT':
      return { ...state, currentShift: action.shift };
    case 'UPDATE_SETTINGS': {
      const nextSettings = { ...state.settings, ...action.settings };
      return { ...state, settings: nextSettings };
    }
    case 'UPDATE_RESTAURANT_SETTINGS':
      return { ...state, settings: { ...state.settings, restaurant: { ...state.settings.restaurant, ...action.settings } } };
    case 'ACCEPT_EXTERNAL_ORDER':
      return {
        ...state,
        externalOrders: state.externalOrders.map((order) =>
          order.id === action.orderId ? { ...order, status: 'accepted', internalOrderNumber: order.internalOrderNumber ?? `R-${110 + Number(order.id.replace(/\D/g, ''))}` } : order,
        ),
      };
    case 'REJECT_EXTERNAL_ORDER':
      return {
        ...state,
        externalOrders: state.externalOrders.map((order) =>
          order.id === action.orderId ? { ...order, status: 'rejected' } : order,
        ),
      };
    case 'ADD_LINE':
      return { ...state, cart: [...state.cart, action.line] };
    case 'SET_NOTICE':
      return { ...state, notice: action.notice };
    case 'NEW_ORDER':
      return {
        ...state,
        cart: [],
        customer: state.cashCustomer ?? null,
        selectedTableId: null,
        guestCount: 1,
        orderStatus: 'open',
        notice: 'تم فتح طلب جديد.',
      };
    case 'SUSPEND_ORDER': {
      if (state.cart.length === 0) return { ...state, notice: 'السلة فارغة — لا يوجد طلب للتعليق.' };
      const counter = state.suspendCounter + 1;
      const total = state.cart.reduce((sum, line) => sum + lineTotal(line), 0);
      const suspended: SuspendedOrder = {
        id: `susp-${Date.now()}`,
        orderNumber: `S-${String(counter).padStart(3, '0')}`,
        customer: state.customer,
        tableId: state.selectedTableId,
        tableName: state.selectedTableId ? `طاولة ${state.selectedTableId}` : null,
        orderType: state.orderType,
        openedAt: new Date().toISOString(),
        total,
        itemCount: state.cart.reduce((s, l) => s + l.quantity, 0),
        cart: state.cart,
      };
      return {
        ...state,
        suspendedOrders: [...state.suspendedOrders, suspended],
        suspendCounter: counter,
        cart: [],
        customer: state.cashCustomer ?? null,
        selectedTableId: null,
        guestCount: 1,
        orderStatus: 'open',
        notice: `تم تعليق الطلب ${suspended.orderNumber} — ${suspended.itemCount} أصناف`,
      };
    }
    case 'RESTORE_ORDER': {
      const found = state.suspendedOrders.find((o) => o.id === action.orderId);
      if (!found) return state;
      return {
        ...state,
        suspendedOrders: state.suspendedOrders.filter((o) => o.id !== action.orderId),
        cart: found.cart,
        customer: found.customer,
        selectedTableId: found.tableId,
        orderType: found.orderType,
        orderStatus: 'open',
        notice: `تم استرجاع الطلب ${found.orderNumber}`,
      };
    }
    default:
      return state;
  }
}

interface POSContextValue {
  state: RuntimeState;
  dispatch: React.Dispatch<Action>;
  totals: {
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
  };
  setMode: (mode: POSMode) => void;
  setSection: (section: POSSection) => void;
  addProduct: (product: Product) => void;
}

const POSContext = createContext<POSContextValue | null>(null);

export function POSProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const totals = useMemo(() => {
    let subtotal = 0;
    let discount = 0;
    let tax = 0;
    let total = 0;
    for (const line of state.cart) {
      const base = line.quantity * line.unitPrice;
      const lineDiscount = base * (line.discountPercent / 100);
      const modifierTotal = line.modifiers.reduce((sum, item) => sum + item.priceDelta * line.quantity, 0);
      const taxable = base - lineDiscount + modifierTotal;
      subtotal += base + modifierTotal;
      discount += lineDiscount;
      tax += taxable * (line.taxRate / 100);
      total += lineTotal(line);
    }
    return { subtotal, discount, tax, total };
  }, [state.cart]);

  const setMode = useCallback((mode: POSMode) => dispatch({ type: 'SET_MODE', mode }), []);
  const setSection = useCallback((section: POSSection) => dispatch({ type: 'SET_SECTION', section }), []);
  const addProduct = useCallback((product: Product) => dispatch({ type: 'ADD_PRODUCT', product }), []);

  const value = useMemo<POSContextValue>(
    () => ({ state, dispatch, totals, setMode, setSection, addProduct }),
    [state, totals, setMode, setSection, addProduct],
  );

  return <POSContext.Provider value={value}>{children}</POSContext.Provider>;
}

export function usePOS(): POSContextValue {
  const value = useContext(POSContext);
  if (!value) throw new Error('usePOS must be used inside POSProvider');
  return value;
}
