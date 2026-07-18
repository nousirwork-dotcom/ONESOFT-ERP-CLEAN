import { createContext, useContext } from 'react';
import type { Product, ProductGroup, CustomerSummary, JournalSummary, WarehouseSummary } from './types';

export interface POSCatalogValue {
  products: Product[];
  productGroups: ProductGroup[];
  customers: CustomerSummary[];
  journals: JournalSummary[];
  warehouses: WarehouseSummary[];
  isLoading: boolean;
  selectedJournalId: number | null;
  selectedWarehouseId: number | null;
  previewNumber: string | null;
  previewLoading: boolean;
  onJournalChange: (id: number) => void;
  onWarehouseChange: (id: number) => void;
  onAddCustomer: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  cashierName: string;
}

const defaults: POSCatalogValue = {
  products: [],
  productGroups: [],
  customers: [],
  journals: [],
  warehouses: [],
  isLoading: true,
  selectedJournalId: null,
  selectedWarehouseId: null,
  previewNumber: null,
  previewLoading: false,
  onJournalChange: () => {},
  onWarehouseChange: () => {},
  onAddCustomer: () => {},
  isFullscreen: false,
  onToggleFullscreen: () => {},
  cashierName: 'المستخدم',
};

const POSCatalogContext = createContext<POSCatalogValue>(defaults);

export const POSCatalogProvider = POSCatalogContext.Provider;

export function usePOSCatalog(): POSCatalogValue {
  return useContext(POSCatalogContext);
}
