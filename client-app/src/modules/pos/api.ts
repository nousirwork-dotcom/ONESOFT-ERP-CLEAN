import type {
  CatalogPayload,
  CheckoutRequest,
  CheckoutResult,
  CustomerSummary,
  OpenOrderSummary,
  PosDraft,
  RestaurantArea,
  RestaurantTable,
  SaveDraftResult,
} from './types';

export interface PosApi {
  loadCatalog(): Promise<CatalogPayload>;
  searchCustomers(query: string): Promise<CustomerSummary[]>;
  loadTables(): Promise<{ areas: RestaurantArea[]; tables: RestaurantTable[] }>;
  listOpenOrders(): Promise<OpenOrderSummary[]>;
  saveDraft(draft: PosDraft): Promise<SaveDraftResult>;
  sendToKitchen(draft: PosDraft): Promise<SaveDraftResult>;
  checkout(request: CheckoutRequest): Promise<CheckoutResult>;
}

export class PosApiError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, code = 'POS_API_ERROR', retryable = false) {
    super(message);
    this.name = 'PosApiError';
    this.code = code;
    this.retryable = retryable;
  }
}

/**
 * Phase 1 live POS API adapter.
 * - loadCatalog / searchCustomers / loadTables / listOpenOrders return empty shells
 *   because LivePOSPage supplies data directly via tRPC hooks.
 * - save / kitchen / checkout throw a Phase-1 notice so no accident occurs.
 */
export function createPhase1PosApi(): PosApi {
  const phase1Notice = 'سيكون متاحاً في المرحلة القادمة من نقطة البيع';
  return {
    loadCatalog: async () => ({ categories: [], products: [] }),
    searchCustomers: async () => [],
    loadTables: async () => ({ areas: [], tables: [] }),
    listOpenOrders: async () => [],
    saveDraft: async () => { throw new PosApiError(phase1Notice, 'PHASE1_STUB'); },
    sendToKitchen: async () => { throw new PosApiError(phase1Notice, 'PHASE1_STUB'); },
    checkout: async () => { throw new PosApiError(phase1Notice, 'PHASE1_STUB'); },
  };
}
