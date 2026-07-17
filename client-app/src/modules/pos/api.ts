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
