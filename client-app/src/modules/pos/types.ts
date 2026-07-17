export type PosMode = 'quick' | 'restaurant' | 'retail';
export type ProductView = 'grid' | 'grouped' | 'compact' | 'favorites' | 'mixed';
export type ServiceType = 'dineIn' | 'takeaway' | 'delivery' | 'pickup';
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'onAccount';
export type TableStatus = 'available' | 'occupied' | 'kitchen' | 'ready' | 'reserved';
export type OrderStatus = 'draft' | 'sentToKitchen' | 'ready' | 'paid' | 'cancelled';

export interface Category {
  id: string;
  name: string;
  parentId?: string | null;
  imageUrl?: string | null;
  color?: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface ModifierOption {
  id: string;
  name: string;
  priceDeltaMinor: number;
  isDefault?: boolean;
  isActive: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  options: ModifierOption[];
}

export interface Product {
  id: string;
  sku: string;
  barcode?: string | null;
  name: string;
  shortName?: string | null;
  categoryId: string;
  imageUrl?: string | null;
  emoji?: string | null;
  priceMinor: number;
  taxRateBps: number;
  isTaxInclusive?: boolean;
  isActive: boolean;
  isAvailable: boolean;
  isFavorite?: boolean;
  trackStock?: boolean;
  availableQuantity?: number | null;
  modifierGroups?: ModifierGroup[];
  kitchenStationId?: string | null;
}

export interface SelectedModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDeltaMinor: number;
}

export interface CartLine {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPriceMinor: number;
  taxRateBps: number;
  isTaxInclusive: boolean;
  selectedModifiers: SelectedModifier[];
  note: string;
  discountMinor: number;
  sentToKitchenAt?: string | null;
}

export interface CustomerSummary {
  id: string;
  code?: string | null;
  name: string;
  phone?: string | null;
  taxNumber?: string | null;
  balanceMinor?: number | null;
  customerType?: 'individual' | 'company' | null;
}

export interface RestaurantArea {
  id: string;
  name: string;
  sortOrder: number;
}

export interface RestaurantTable {
  id: string;
  areaId: string;
  name: string;
  seats: number;
  status: TableStatus;
  currentOrderId?: string | null;
  currentTotalMinor?: number | null;
  openedAt?: string | null;
}

export interface OpenOrderSummary {
  id: string;
  displayNumber: string;
  status: OrderStatus;
  serviceType: ServiceType;
  tableName?: string | null;
  customerName?: string | null;
  totalMinor: number;
  openedAt: string;
  cashierName: string;
}

export interface PaymentLine {
  id: string;
  method: PaymentMethod;
  amountMinor: number;
  reference?: string;
}

export interface PosDraft {
  clientDraftId: string;
  mode: PosMode;
  serviceType: ServiceType;
  registerId?: string | null;
  branchId?: string | null;
  shiftId?: string | null;
  customer?: CustomerSummary | null;
  table?: RestaurantTable | null;
  guestCount?: number | null;
  lines: CartLine[];
  orderDiscountMinor: number;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderTotals {
  subtotalBeforeDiscountMinor: number;
  discountMinor: number;
  netBeforeTaxMinor: number;
  taxMinor: number;
  grandTotalMinor: number;
}

export interface CatalogPayload {
  categories: Category[];
  products: Product[];
}

export interface CheckoutRequest {
  draft: PosDraft;
  payments: PaymentLine[];
  expectedGrandTotalMinor: number;
}

export interface CheckoutResult {
  orderId: string;
  displayNumber: string;
  receiptUrl?: string | null;
  queuedOffline?: boolean;
}

export interface SaveDraftResult {
  orderId: string;
  displayNumber: string;
}

export interface PosConfig {
  currency: string;
  locale: string;
  defaultMode: PosMode;
  defaultView: ProductView;
  taxInclusive: boolean;
  allowOfflineCheckout: boolean;
  branchId?: string;
  registerId?: string;
  shiftId?: string;
  cashierName?: string;
  branchName?: string;
  registerName?: string;
}
