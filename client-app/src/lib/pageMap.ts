import type { ComponentType } from "react";
import Dashboard from "@/pages/Dashboard";
import POS from "@/pages/POS";
import Invoices from "@/pages/Invoices";
import InventoryModule from "@/pages/InventoryModule";
import PurchasesModule, {
  PurchaseSuppliersPage, PurchaseOrdersPage, PurchaseInvoicesPage,
  PurchaseReturnsPage, PurchaseRptSupplierPage, PurchaseRptItemPage,
} from "@/pages/PurchasesModule";
import SalesModule, {
  SalesInvoiceTab, SalesReturnTab, SalesCreditNoteTab, SalesQuotationTab,
  SalesOrderTab, SalesDeliveryTab, SalesPosTab, SalesShiftsTab,
  SalesPaymentMethodsTab, SalesPosSettingsTab, SalesPosReportsTab,
  SalesCustomersTab, SalesCustomerGroupsTab, SalesCustomerBalancesTab,
  SalesCustomerStatementTab, SalesCustomerReportsTab,
  SalesTotalsReportsTab, SalesItemsReportsTab,
} from "@/pages/SalesModule";
import Users from "@/pages/Users";
import ManufacturingModule from "@/pages/ManufacturingModule";
import AccountingModule from "@/pages/AccountingModule";
import HRModule from "@/pages/HRModule";
import AssetsModule from "@/pages/AssetsModule";
import SettingsModule from "@/pages/SettingsModule";

export const PAGE_MAP: Record<string, ComponentType<any>> = {
  "/":                       Dashboard,
  "/pos":                    POS,
  "/invoices":               Invoices,
  "/inventory-module":       InventoryModule,
  "/purchases-module":       PurchasesModule,
  "/sales-module":           SalesModule,
  "/users":                  Users,
  "/settings":               SettingsModule,
  "/manufacturing-module":   ManufacturingModule,
  "/accounting-module":      AccountingModule,
  "/hr-module":              HRModule,
  "/assets-module":          AssetsModule,
  "/purchases/suppliers":    PurchaseSuppliersPage,
  "/purchases/orders":       PurchaseOrdersPage,
  "/purchases/invoices":     PurchaseInvoicesPage,
  "/purchases/returns":      PurchaseReturnsPage,
  "/purchases/rpt-supplier": PurchaseRptSupplierPage,
  "/purchases/rpt-item":     PurchaseRptItemPage,
  "/sales/invoice":            SalesInvoiceTab,
  "/sales/return":             SalesReturnTab,
  "/sales/credit-note":        SalesCreditNoteTab,
  "/sales/quotation":          SalesQuotationTab,
  "/sales/order":              SalesOrderTab,
  "/sales/delivery":           SalesDeliveryTab,
  "/sales/pos":                SalesPosTab,
  "/sales/shifts":             SalesShiftsTab,
  "/sales/payment-methods":    SalesPaymentMethodsTab,
  "/sales/pos-settings":       SalesPosSettingsTab,
  "/sales/pos-reports":        SalesPosReportsTab,
  "/sales/customers":          SalesCustomersTab,
  "/sales/customer-groups":    SalesCustomerGroupsTab,
  "/sales/customer-balances":  SalesCustomerBalancesTab,
  "/sales/customer-statement": SalesCustomerStatementTab,
  "/sales/customer-reports":   SalesCustomerReportsTab,
  "/sales/totals-reports":     SalesTotalsReportsTab,
  "/sales/items-reports":      SalesItemsReportsTab,
};
