export type ProviderCategory = 'delivery' | 'custom';
export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'pending' | 'paused';

export interface IntegrationProviderMeta {
  id: string;
  name: string;
  nameEn?: string;
  category: ProviderCategory;
  logoInitial: string;
  logoColor: string;
  accentColor: string;
  description: string;
  credentialFields: CredentialField[];
  isBuiltIn: boolean;
  docsUrl?: string;
}

export interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'select';
  placeholder?: string;
  required: boolean;
  adminOnly?: boolean;
  options?: Array<{ value: string; label: string }>;
  helpText?: string;
}

export interface IntegrationConnection {
  id: string;
  providerId: string;
  providerName: string;
  status: ConnectionStatus;
  enabled: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: 'success' | 'error' | 'never';
  lastSyncError?: string;
  credentials: Record<string, string>;
  settings: IntegrationConnectionSettings;
  /** صفوف ربط أصناف المنصة الخارجية بكتالوج OneSoft — محفوظة في نموذج الاتصال */
  productMappings: ProductMapping[];
  unmappedProductCount: number;
  createdAt: string;
}

export interface IntegrationConnectionSettings {
  branchId?: string;
  branchName?: string;
  posName?: string;
  warehouseId?: number | null;
  journalId?: number | null;
  defaultCustomerId?: number | null;
  defaultPaymentMethod?: string;
  autoAccept: boolean;
  autoSendToKitchen: boolean;
  cancelHandling?: 'auto_cancel' | 'notify_only' | 'manual';
  soundAlert?: boolean;
  arrivalNotification?: boolean;
}

export interface ProductMapping {
  /** معرف محلي للتتبع في الواجهة — لا يُرسل للخادم */
  rowId?: string;
  externalProductId: string;
  externalProductCode: string;
  externalProductName: string;
  externalPrice: number;
  available: boolean;
  onesoftProductId: number | null;
  onesoftProductCode?: string;
  onesoftProductName?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  providerInfo?: Record<string, unknown>;
}

export interface IncomingExternalOrder {
  externalOrderId: string;
  externalOrderNumber: string;
  customerName: string;
  customerPhone?: string;
  total: number;
  currency: string;
  paymentMethod: string;
  paymentLabel: string;
  status: string;
  items: IncomingExternalOrderItem[];
  deliveryAddress?: string;
  notes?: string;
  receivedAt: string;
}

export interface IncomingExternalOrderItem {
  externalItemId: string;
  externalProductId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  modifiers?: Array<{ name: string; priceDelta: number }>;
}

export interface ProductSyncItem {
  productId: number;
  code: string;
  name: string;
  price: number;
  available: boolean;
  imageUrl?: string | null;
}

export interface ProductSyncResult {
  synced: number;
  failed: number;
  unmapped: number;
  errors: string[];
}

export interface SettlementRecord {
  id: string;
  period: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'disputed';
  paidAt?: string;
}

/**
 * DeliveryProviderAdapter — عقد موحد يجب أن يُنفذه كل مزود تكامل.
 * لإضافة منصة جديدة: أنشئ adapter يُنفّذ هذه الواجهة وسجّله في providerRegistry.
 */
export interface DeliveryProviderAdapter {
  readonly meta: IntegrationProviderMeta;

  testConnection(credentials: Record<string, string>): Promise<ConnectionTestResult>;

  receiveOrders(connection: IntegrationConnection): Promise<IncomingExternalOrder[]>;

  acceptOrder(connection: IntegrationConnection, orderId: string): Promise<void>;

  rejectOrder(
    connection: IntegrationConnection,
    orderId: string,
    reason?: string,
  ): Promise<void>;

  updateOrderStatus(
    connection: IntegrationConnection,
    orderId: string,
    newStatus: string,
  ): Promise<void>;

  syncProducts(
    connection: IntegrationConnection,
    products: ProductSyncItem[],
  ): Promise<ProductSyncResult>;

  updateProductAvailability(
    connection: IntegrationConnection,
    productId: string,
    available: boolean,
  ): Promise<void>;

  /** اختياري — دعم التسويات إن توفرت في المنصة */
  fetchSettlements?(
    connection: IntegrationConnection,
    from: string,
    to: string,
  ): Promise<SettlementRecord[]>;
}

/**
 * جداول قاعدة البيانات المقترحة للمرحلة القادمة:
 *
 * integration_providers        — المزودون المسجّلون (id, name, category, meta_json)
 * integration_connections      — الاتصالات المفعّلة (id, provider_id, credentials_encrypted, settings_json, status, last_sync_at)
 * external_orders              — الطلبات الواردة من أي منصة (id, connection_id, external_order_id, provider_id, status, total, ...)
 * external_order_items         — بنود الطلبات (order_id, external_item_id, product_mapping_id, qty, price)
 * external_product_mappings    — ربط أصناف المنصة بأصناف النظام (connection_id, external_product_id, internal_product_id)
 * external_order_status_history — سجل تغييرات الحالة (order_id, from_status, to_status, changed_at, changed_by)
 * integration_sync_logs        — سجل المزامنة (connection_id, started_at, ended_at, result, error)
 * external_settlements         — التسويات المالية (connection_id, period, amount, currency, status)
 */
