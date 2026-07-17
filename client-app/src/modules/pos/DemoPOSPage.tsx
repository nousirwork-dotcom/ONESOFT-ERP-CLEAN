import { POSPage } from './POSPage';
import type { PosApi } from './api';
import { demoAreas, demoCatalog, demoCustomers, demoOpenOrders, demoTables } from './sampleData';

function wait(ms = 180): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

const demoApi: PosApi = {
  async loadCatalog() {
    await wait();
    return demoCatalog;
  },
  async searchCustomers(query) {
    await wait(120);
    const normalized = query.trim().toLowerCase();
    if (!normalized) return demoCustomers;
    return demoCustomers.filter((customer) =>
      [customer.name, customer.phone, customer.taxNumber]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  },
  async loadTables() {
    await wait();
    return { areas: demoAreas, tables: demoTables };
  },
  async listOpenOrders() {
    await wait();
    return demoOpenOrders;
  },
  async saveDraft(draft) {
    await wait(250);
    return { orderId: `demo-${draft.clientDraftId}`, displayNumber: 'POS-DRAFT' };
  },
  async sendToKitchen(draft) {
    await wait(300);
    return { orderId: `demo-${draft.clientDraftId}`, displayNumber: 'POS-KITCHEN' };
  },
  async checkout(request) {
    await wait(550);
    return {
      orderId: `demo-paid-${request.draft.clientDraftId}`,
      displayNumber: `POS-${Math.floor(1000 + Math.random() * 9000)}`,
    };
  },
};

export function DemoPOSPage() {
  return (
    <POSPage
      api={demoApi}
      config={{
        currency: 'SAR',
        locale: 'ar-SA',
        defaultMode: 'quick',
        defaultView: 'mixed',
        taxInclusive: true,
        allowOfflineCheckout: false,
        branchName: 'الفرع الرئيسي',
        registerName: 'نقطة بيع 01',
        cashierName: 'ADMIN',
      }}
    />
  );
}
