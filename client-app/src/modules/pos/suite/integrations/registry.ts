import type { DeliveryProviderAdapter, IntegrationProviderMeta } from './types';

/**
 * ProviderRegistry — سجل المزودين المركزي.
 *
 * كيفية إضافة مزود جديد:
 *   1. أنشئ adapter يُنفّذ DeliveryProviderAdapter
 *   2. استدعِ providerRegistry.register(new MyAdapter()) في نقطة التهيئة
 *   3. يظهر المزود تلقائياً في مركز التكاملات وشاشة الطلبات
 */
class ProviderRegistry {
  private readonly _adapters = new Map<string, DeliveryProviderAdapter>();

  register(adapter: DeliveryProviderAdapter): void {
    if (this._adapters.has(adapter.meta.id)) {
      console.warn(`[ProviderRegistry] Overwriting adapter for: ${adapter.meta.id}`);
    }
    this._adapters.set(adapter.meta.id, adapter);
  }

  get(providerId: string): DeliveryProviderAdapter | undefined {
    return this._adapters.get(providerId);
  }

  list(): DeliveryProviderAdapter[] {
    return Array.from(this._adapters.values());
  }

  listMeta(): IntegrationProviderMeta[] {
    return this.list().map((a) => a.meta);
  }

  has(providerId: string): boolean {
    return this._adapters.has(providerId);
  }

  unregister(providerId: string): void {
    this._adapters.delete(providerId);
  }
}

export const providerRegistry = new ProviderRegistry();
