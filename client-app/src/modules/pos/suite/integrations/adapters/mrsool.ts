import type {
  ConnectionTestResult,
  DeliveryProviderAdapter,
  IncomingExternalOrder,
  IntegrationConnection,
  IntegrationProviderMeta,
  ProductSyncItem,
  ProductSyncResult,
} from '../types';

const META: IntegrationProviderMeta = {
  id: 'mrsool',
  name: 'مرسول',
  nameEn: 'Mrsool',
  category: 'delivery',
  logoInitial: 'م',
  logoColor: '#8a5a2b',
  accentColor: '#8a5a2b',
  description: 'استقبال طلبات مرسول ومزامنة قائمة الأصناف.',
  isBuiltIn: true,
  docsUrl: 'https://developers.mrsool.co',
  credentialFields: [
    {
      key: 'apiKey',
      label: 'مفتاح API',
      type: 'password',
      required: true,
      adminOnly: true,
      placeholder: 'mr_live_xxxxxxxxxxxxxxxxxx',
      helpText: 'متاح من بوابة شركاء مرسول.',
    },
    {
      key: 'storeId',
      label: 'معرّف المتجر',
      type: 'text',
      required: true,
      placeholder: 'STORE-9999',
    },
    {
      key: 'branchCode',
      label: 'كود الفرع',
      type: 'text',
      required: true,
      placeholder: 'BR-01',
    },
    {
      key: 'environment',
      label: 'البيئة',
      type: 'select',
      required: true,
      adminOnly: false,
      options: [
        { value: 'production', label: 'الإنتاج (Live)' },
        { value: 'sandbox', label: 'الاختبار (Sandbox)' },
      ],
    },
  ],
};

export class MrsoolAdapter implements DeliveryProviderAdapter {
  readonly meta = META;

  async testConnection(credentials: Record<string, string>): Promise<ConnectionTestResult> {
    await new Promise((r) => setTimeout(r, 750));
    if (!credentials.apiKey || !credentials.storeId) {
      return {
        success: false,
        message: 'مفتاح API ومعرّف المتجر مطلوبان.',
      };
    }
    return {
      success: true,
      message: 'تم الاتصال بخوادم مرسول (نموذج تجريبي)',
      latencyMs: 95,
      providerInfo: { store: credentials.storeId, env: credentials.environment ?? 'production' },
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
}
