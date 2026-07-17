export type POSMode = 'restaurant' | 'store';
export type POSSection =
  | 'sale'
  | 'shifts'
  | 'tables'
  | 'kitchen'
  | 'external-orders'
  | 'reports'
  | 'settings';

export type OrderType = 'dine_in' | 'takeaway' | 'delivery' | 'pickup';
export type OrderStatus =
  | 'new'
  | 'open'
  | 'sent_to_kitchen'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'awaiting_payment'
  | 'paid'
  | 'cancelled';
export type KitchenItemStatus = 'new' | 'sent' | 'preparing' | 'ready' | 'served' | 'cancelled';
export type TableStatus = 'available' | 'occupied' | 'kitchen' | 'ready' | 'reserved';
export type ExternalProvider = 'hungerstation' | 'mrsool';
export type ExternalOrderStatus =
  | 'new'
  | 'accepted'
  | 'sent_to_kitchen'
  | 'preparing'
  | 'ready'
  | 'handed_to_driver'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'needs_review';

export interface ProductGroup {
  id: number;
  name: string;
  imageUrl?: string | null;
  color?: string | null;
}

export interface Product {
  id: number;
  code: string;
  barcode?: string | null;
  name: string;
  groupId: number;
  imageUrl?: string | null;
  unitName: string;
  salePrice: number;
  taxRate: number;
  stockQuantity?: number | null;
  itemType: 'stock' | 'service';
  hasModifiers?: boolean;
}

export interface ModifierChoice {
  id: string;
  name: string;
  priceDelta: number;
}

export interface CartLine {
  id: string;
  productId: number;
  productCode: string;
  name: string;
  unitName: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountPercent: number;
  imageUrl?: string | null;
  notes?: string;
  modifiers: ModifierChoice[];
  kitchenStatus: KitchenItemStatus;
}

export interface CustomerSummary {
  id: number;
  code: string;
  name: string;
  customerType: 'individual' | 'organization';
  phone?: string | null;
  taxNumber?: string | null;
}

export interface WarehouseSummary {
  id: number;
  code: string;
  name: string;
}

export interface JournalSummary {
  id: number;
  code: string;
  name: string;
  warehouseId?: number | null;
  previewNumber?: string;
}

export interface ShiftSummary {
  id: number;
  registerName: string;
  cashierName: string;
  openedAt: string;
  openingCash: number;
  expectedCash: number;
  actualCash?: number | null;
  status: 'open' | 'pending_review' | 'closed' | 'approved';
}

export interface RestaurantTable {
  id: number;
  areaName: string;
  name: string;
  seats: number;
  status: TableStatus;
  activeOrderNumber?: string;
  elapsedMinutes?: number;
  amount?: number;
}

export interface KitchenTicketItem {
  id: string;
  name: string;
  quantity: number;
  notes?: string;
  status: KitchenItemStatus;
}

export interface KitchenTicket {
  id: string;
  orderNumber: string;
  tableName?: string;
  orderType: OrderType;
  stationName: string;
  waiterName?: string;
  openedAt: string;
  elapsedMinutes: number;
  items: KitchenTicketItem[];
}

export interface ExternalOrder {
  id: string;
  provider: ExternalProvider;
  externalOrderNumber: string;
  internalOrderNumber?: string;
  receivedAt: string;
  customerName: string;
  customerPhone?: string;
  total: number;
  paymentLabel: string;
  status: ExternalOrderStatus;
  itemCount: number;
  issue?: string;
}

export interface POSSettings {
  mode: POSMode;
  registerName: string;
  warehouseId: number | null;
  journalId: number | null;
  cashCustomerId: number | null;
  openFullscreen: boolean;
  touchMode: boolean;
  showProductImages: boolean;
  showStock: boolean;
  defaultView: 'groups' | 'products' | 'list';
  autoFocusBarcode: boolean;
  repeatBarcodeIncreasesQuantity: boolean;
  restaurant: {
    enableTables: boolean;
    enableWaiter: boolean;
    enableGuestCount: boolean;
    enableKitchen: boolean;
    allowAddAfterKitchenSend: boolean;
    requireReasonForSentItemChanges: boolean;
    autoAcceptExternalOrders: boolean;
    autoSendExternalOrdersToKitchen: boolean;
  };
}

export interface SuspendedOrder {
  id: string;
  orderNumber: string;
  customer: CustomerSummary | null;
  tableId: number | null;
  tableName: string | null;
  orderType: OrderType;
  openedAt: string;
  total: number;
  itemCount: number;
  cart: CartLine[];
}

export interface POSState {
  mode: POSMode;
  activeSection: POSSection;
  orderType: OrderType;
  orderStatus: OrderStatus;
  cart: CartLine[];
  customer: CustomerSummary | null;
  selectedTableId: number | null;
  guestCount: number;
  currentShift: ShiftSummary | null;
  settings: POSSettings;
}
