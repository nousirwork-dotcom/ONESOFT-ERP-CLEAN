import type {
  ConnectionTestResult,
  DeliveryProviderAdapter,
  IncomingExternalOrder,
  IntegrationConnection,
  IntegrationProviderMeta,
  ProductSyncItem,
  ProductSyncResult,
  SettlementRecord,
} from '../types';

const META: IntegrationProviderMeta = {
  id: 'hungerstation',
  name: 'هنقرستيشن',
  nameEn: 'HungerStation',
  category: 'delivery',
  logoInitial: 'H',
  logoColor: '#e64d36',
  accentColor: '#e64d36',
  description: 'استقبال طلبات هنقرستيشن، مزامنة الأصناف وأسعارها، والتسويات الأسبوعية.',
  isBuiltIn: true,
  docsUrl: 'https://developer.hungerstation.com',
  credentialFields: [
    {
      key: 'apiKey',
      label: 'مفتاح API',
      type: 'password',
      required: true,
      adminOnly: true,
      placeholder: 'hs_live_xxxxxxxxxxxxxxxxxx',
      helpText: 'متاح من لوحة تحكم شريك هنقرستيشن → الإعدادات → API.',
    },
    {
      key: 'restaurantId',
      label: 'معرّف المطعم',
      type: 'text',
      required: true,
      placeholder: 'REST-12345',
    },
    {
      key: 'branchId',
      label: 'معرّف الفرع',
      type: 'text',
      required: true,
      placeholder: 'BR-001',
    },
    {
      key: 'webhookSecret',
      label: 'مفتاح Webhook',
      type: 'password',
      required: false,
      adminOnly: true,
      placeholder: 'whsec_...',
      helpText: 'اختياري — لاستقبال إشعارات فورية.',
    },
  ],
};

export class HungerStationAdapter implements DeliveryProviderAdapter {
  readonly meta = META;

  async testConnection(credentials: Record<string, string>): Promise<ConnectionTestResult> {
    await new Promise((r) => setTimeout(r, 900));
    if (!credentials.apiKey || !credentials.restaurantId) {
      return {
        success: false,
        message: 'مفتاح API ومعرّف المطعم مطلوبان للاتصال.',
      };
    }
    return {
      success: true,
      message: 'تم الاتصال بخوادم هنقرستيشن (نموذج تجريبي)',
      latencyMs: 138,
      providerInfo: { partner: 'OneSoft ERP', plan: 'Business' },
    };
  }

  async receiveOrders(_connection: IntegrationConnection): Promise<IncomingExternalOrder[]> {
    return [];
  }

  async acceptOrder(_connection: IntegrationConnection, _orderId: string): Promise<void> {}

  async rejectOrder(
    _connection: IntegrationConnection,
    _orderId: string,
    _reason?: string,
  ): Promise<void> {}

  async updateOrderStatus(
    _connection: IntegrationConnection,
    _orderId: string,
    _newStatus: string,
  ): Promise<void> {}

  async syncProducts(
    _connection: IntegrationConnection,
    products: ProductSyncItem[],
  ): Promise<ProductSyncResult> {
    return { synced: products.length, failed: 0, unmapped: 0, errors: [] };
  }

  async updateProductAvailability(
    _connection: IntegrationConnection,
    _productId: string,
    _available: boolean,
  ): Promise<void> {}

  async fetchSettlements(
    _connection: IntegrationConnection,
    _from: string,
    _to: string,
  ): Promise<SettlementRecord[]> {
    return [];
  }
}
