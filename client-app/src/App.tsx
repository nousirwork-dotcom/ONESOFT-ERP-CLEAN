import { Toaster } from "@/components/ui/sonner";
import { useSmartCopy } from "@/hooks/useSmartCopy";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import { TabManagerProvider, useTabManager } from "./contexts/TabManagerContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Invoices from "./pages/Invoices";
import PurchasesModule, {
  PurchaseSuppliersPage, PurchaseSupplierGroupsPage, PurchaseOrdersPage,
  PurchaseInvoicesPage, PurchaseReturnsPage, PurchaseRptSupplierPage, PurchaseRptItemPage,
} from "./pages/PurchasesModule";
import SalesModule, {
  SalesTransactionsTab,
  SalesInvoiceTab, SalesReturnTab, SalesCreditNoteTab, SalesQuotationTab,
  SalesOrderTab, SalesDeliveryTab, SalesPosTab, SalesShiftsTab,
  SalesPaymentMethodsTab, SalesPosSettingsTab, SalesPosReportsTab,
  SalesCustomersTab, SalesCustomerGroupsTab, SalesCustomerBalancesTab,
  SalesCustomerStatementTab, SalesCustomerReportsTab,
  SalesTotalsReportsTab, SalesInvoicesReportTab, SalesItemsReportsTab,
} from "./pages/SalesModule";
import Users from "./pages/Users";
import ManufacturingModule, {
  MfgNewOrderTab, MfgOrdersTab, MfgTrackingTab, MfgNewBomTab, MfgBomTab,
  MfgCostTab, MfgCostReportsTab, MfgStagesTab, MfgWorkcentersTab,
  MfgProductionReportTab, MfgEfficiencyTab, MfgWasteTab,
} from "./pages/ManufacturingModule";
import AccountingModule, {
  AccJournalTab, AccReceiptTab, AccPaymentTab, AccNewJournalTab, AccOpeningTab,
  AccAccountsTab, AccLedgerTab, AccCostCentersTab, AccCostAllocationTab,
  AccTrialBalanceTab, AccIncomeTab, AccBalanceSheetTab, AccCashFlowTab,
} from "./pages/AccountingModule";
import HRModule, {
  HREmployeesTab, HRAddEmployeeTab, HRDepartmentsTab, HRPositionsTab,
  HRPayrollTab, HRPayrollListTab, HRAdvancesTab, HRAttendanceTab,
  HRAttendanceReportTab, HRScheduleTab, HRLeaveRequestTab, HRLeavesTab,
  HRLeaveBalanceTab, HRHeadcountTab, HRPayrollReportTab, HRAttendanceSummaryTab,
} from "./pages/HRModule";
import AssetsModule, {
  AssetsListTab, AssetsAddTab, AssetsCategoriesTab, AssetsDepreciationTab,
  AssetsDeprScheduleTab, AssetsTransferTab, AssetsTransferListTab,
  AssetsDisposalTab, AssetsDisposalListTab, AssetsSummaryTab,
  AssetsDeprReportTab, AssetsMovementTab,
} from "./pages/AssetsModule";
import InventoryModule, {
  InvProductsTab, InvUnitsTab, InvGroupsTab, InvCategoriesTab,
  InvPricingTab, InvFreeProductsTab, InvTransferTab, InvReceiptTab, InvIssueTab,
  InvCountTab, InvStockReportsTab, InvVoucherReportsTab, InvReinstateTab, InvRegenerateTab,
} from "./pages/InventoryModule";
import SettingsModule, {
  CfgCompanyTab, CfgCurrenciesTab, CfgTaxesTab, CfgFiscalTab,
  CfgUserCategoriesTab, CfgUsersTab, CfgUserGroupsTab, CfgPermissionsTab,
  CfgApproveInvoiceTab, CfgApprovePurchaseTab, CfgApproveDiscountTab,
  CfgApproveInventoryTab, CfgApproveJournalTab, CfgApprovalsLogTab, CfgApprovalPathsTab,
  CfgNotifStockTab, CfgNotifCreditTab, CfgNotifOverdueTab, CfgNotifExpiryTab,
  CfgNotifMaintenanceTab, CfgNotifPendingTab, CfgWarehousesTab,
  CfgDocTypesTab, CfgDocBooksTab, CfgDocumentJournalsTab, CfgDocumentTemplatesTab,
  CfgFieldDesignTab, CfgBackupTab, CfgAuditLogTab, CfgQrSettingsTab,
  CfgMissingDocsTab, CfgPayrollPeriodsTab, CfgOrgChartTab, CfgWageCalendarTab,
  CfgShiftsTab, CfgReportDesignerTab, CfgTestSetupTab, CfgTestEditTab, CfgFieldSpecsTab,
  CfgLoyaltyPointsTab, CfgLoyaltyTiersTab, CfgLoyaltyPromosTab, CfgLoyaltyMessagesTab,
  CfgMessagingWhatsAppTab, CfgMessagingTelegramTab, CfgMessagingEmailTab,
  CfgMessagingTemplatesTab, CfgMessagingLogTab,
  CfgPrintSettingsTab, CfgLogoStampTab, CfgSignaturesTab, CfgEmailPdfTab,
  CfgFieldDictionaryTab, CfgPaymentMethodsTab,
} from "./pages/SettingsModule";
import PostingSettingsPage from "./pages/PostingSettingsPage";
import PostingOperationsPage from "./pages/PostingOperationsPage";
import LoginPage from "./pages/LoginPage";
import SuperAdminPage from "./pages/SuperAdminPage";
import { createElement, useEffect } from "react";
import { trpc } from "./lib/trpc";
import { Settings } from "lucide-react";
import AppWindow from "./components/AppWindow";

// ─── خريطة المسارات إلى المكونات ──────────────────────────────────────────
export const PAGE_MAP: Record<string, React.ComponentType<any>> = {
  "/":                     Dashboard,
  "/pos":                  POS,
  "/invoices":             Invoices,
  "/inventory-module":     InventoryModule,
  "/purchases-module":     PurchasesModule,
  "/sales-module":         SalesModule,
  "/users":                Users,
  "/settings":             SettingsModule,
  "/manufacturing-module": ManufacturingModule,
  "/accounting-module":    AccountingModule,
  "/hr-module":            HRModule,
  "/assets-module":        AssetsModule,
  "/purchases/suppliers":         PurchaseSuppliersPage,
  "/purchases/supplier-groups":  PurchaseSupplierGroupsPage,
  "/purchases/orders":           PurchaseOrdersPage,
  "/purchases/invoices":     PurchaseInvoicesPage,
  "/purchases/returns":      PurchaseReturnsPage,
  "/purchases/rpt-supplier": PurchaseRptSupplierPage,
  "/purchases/rpt-item":     PurchaseRptItemPage,
  "/sales/transactions":      SalesTransactionsTab,
  "/sales/invoice":           SalesInvoiceTab,
  "/sales/return":            SalesReturnTab,
  "/sales/credit-note":       SalesCreditNoteTab,
  "/sales/quotation":         SalesQuotationTab,
  "/sales/order":             SalesOrderTab,
  "/sales/delivery":          SalesDeliveryTab,
  "/sales/pos":               SalesPosTab,
  "/sales/shifts":            SalesShiftsTab,
  "/sales/payment-methods":   SalesPaymentMethodsTab,
  "/sales/pos-settings":      SalesPosSettingsTab,
  "/sales/pos-reports":       SalesPosReportsTab,
  "/sales/customers":         SalesCustomersTab,
  "/sales/customer-groups":   SalesCustomerGroupsTab,
  "/sales/customer-balances": SalesCustomerBalancesTab,
  "/sales/customer-statement":SalesCustomerStatementTab,
  "/sales/customer-reports":  SalesCustomerReportsTab,
  "/sales/totals-reports":    SalesTotalsReportsTab,
  "/sales/invoices-report":   SalesInvoicesReportTab,
  "/sales/items-reports":     SalesItemsReportsTab,
  // Manufacturing
  "/mfg/new-order":           MfgNewOrderTab,
  "/mfg/orders":              MfgOrdersTab,
  "/mfg/tracking":            MfgTrackingTab,
  "/mfg/new-bom":             MfgNewBomTab,
  "/mfg/bom":                 MfgBomTab,
  "/mfg/cost":                MfgCostTab,
  "/mfg/cost-reports":        MfgCostReportsTab,
  "/mfg/stages":              MfgStagesTab,
  "/mfg/workcenters":         MfgWorkcentersTab,
  "/mfg/production-report":   MfgProductionReportTab,
  "/mfg/efficiency":          MfgEfficiencyTab,
  "/mfg/waste":               MfgWasteTab,
  // Accounting
  "/accounting/journal":          AccJournalTab,
  "/accounting/receipt":          AccReceiptTab,
  "/accounting/payment":          AccPaymentTab,
  "/accounting/new-journal":      AccNewJournalTab,
  "/accounting/opening":          AccOpeningTab,
  "/accounting/accounts":         AccAccountsTab,
  "/accounting/ledger":           AccLedgerTab,
  "/accounting/cost-centers":     AccCostCentersTab,
  "/accounting/cost-allocation":  AccCostAllocationTab,
  "/accounting/trial-balance":    AccTrialBalanceTab,
  "/accounting/income-statement": AccIncomeTab,
  "/accounting/balance-sheet":    AccBalanceSheetTab,
  "/accounting/cash-flow":        AccCashFlowTab,
  // HR
  "/hr/employees":          HREmployeesTab,
  "/hr/add-employee":       HRAddEmployeeTab,
  "/hr/departments":        HRDepartmentsTab,
  "/hr/positions":          HRPositionsTab,
  "/hr/payroll":            HRPayrollTab,
  "/hr/payroll-list":       HRPayrollListTab,
  "/hr/advances":           HRAdvancesTab,
  "/hr/attendance":         HRAttendanceTab,
  "/hr/attendance-report":  HRAttendanceReportTab,
  "/hr/schedule":           HRScheduleTab,
  "/hr/leave-request":      HRLeaveRequestTab,
  "/hr/leaves":             HRLeavesTab,
  "/hr/leave-balance":      HRLeaveBalanceTab,
  "/hr/headcount":          HRHeadcountTab,
  "/hr/payroll-report":     HRPayrollReportTab,
  "/hr/attendance-summary": HRAttendanceSummaryTab,
  // Assets
  "/assets/list":                 AssetsListTab,
  "/assets/add":                  AssetsAddTab,
  "/assets/categories":           AssetsCategoriesTab,
  "/assets/depreciation":         AssetsDepreciationTab,
  "/assets/depreciation-schedule":AssetsDeprScheduleTab,
  "/assets/transfer":             AssetsTransferTab,
  "/assets/transfer-list":        AssetsTransferListTab,
  "/assets/disposal":             AssetsDisposalTab,
  "/assets/disposal-list":        AssetsDisposalListTab,
  "/assets/summary":              AssetsSummaryTab,
  "/assets/depreciation-report":  AssetsDeprReportTab,
  "/assets/movement":             AssetsMovementTab,
  // Inventory
  "/inv/products":        InvProductsTab,
  "/inv/units":           InvUnitsTab,
  "/inv/groups":          InvGroupsTab,
  "/inv/categories":      InvCategoriesTab,
  "/inv/pricing":         InvPricingTab,
  "/inv/free-products":   InvFreeProductsTab,
  "/inv/transfer":        InvTransferTab,
  "/inv/receipt":         InvReceiptTab,
  "/inv/issue":           InvIssueTab,
  "/inv/count":           InvCountTab,
  "/inv/stock-reports":   InvStockReportsTab,
  "/inv/voucher-reports": InvVoucherReportsTab,
  "/inv/reinstate":       InvReinstateTab,
  "/inv/regenerate":      InvRegenerateTab,
  // Settings/Config
  "/cfg/company":           CfgCompanyTab,
  "/cfg/currencies":        CfgCurrenciesTab,
  "/cfg/taxes":             CfgTaxesTab,
  "/cfg/fiscal":            CfgFiscalTab,
  "/cfg/field-dictionary":  CfgFieldDictionaryTab,
  "/cfg/payment-methods":   CfgPaymentMethodsTab,
  "/cfg/user-categories":   CfgUserCategoriesTab,
  "/cfg/users":             CfgUsersTab,
  "/cfg/user-groups":       CfgUserGroupsTab,
  "/cfg/permissions":       CfgPermissionsTab,
  "/cfg/approve-invoice":   CfgApproveInvoiceTab,
  "/cfg/approve-purchase":  CfgApprovePurchaseTab,
  "/cfg/approve-discount":  CfgApproveDiscountTab,
  "/cfg/approve-inventory": CfgApproveInventoryTab,
  "/cfg/approve-journal":   CfgApproveJournalTab,
  "/cfg/approvals-log":     CfgApprovalsLogTab,
  "/cfg/approval-paths":    CfgApprovalPathsTab,
  "/cfg/notif-stock":       CfgNotifStockTab,
  "/cfg/notif-credit":      CfgNotifCreditTab,
  "/cfg/notif-overdue":     CfgNotifOverdueTab,
  "/cfg/notif-expiry":      CfgNotifExpiryTab,
  "/cfg/notif-maintenance": CfgNotifMaintenanceTab,
  "/cfg/notif-pending":     CfgNotifPendingTab,
  "/cfg/warehouses":          CfgWarehousesTab,
  "/cfg/doc-types":           CfgDocTypesTab,
  "/cfg/doc-books":           CfgDocBooksTab,
  "/cfg/document-journals":   CfgDocumentJournalsTab,
  "/cfg/posting-settings":    PostingSettingsPage,
  "/accounting/posting-ops":  PostingOperationsPage,

  "/cfg/document-templates":  CfgDocumentTemplatesTab,
  "/cfg/qr-settings":       CfgQrSettingsTab,
  "/cfg/field-design":      CfgFieldDesignTab,
  "/cfg/backup":            CfgBackupTab,
  "/cfg/audit-log":         CfgAuditLogTab,
  "/cfg/missing-docs":      CfgMissingDocsTab,
  "/cfg/payroll-periods":   CfgPayrollPeriodsTab,
  "/cfg/org-chart":         CfgOrgChartTab,
  "/cfg/wage-calendar":     CfgWageCalendarTab,
  "/cfg/shifts":            CfgShiftsTab,
  "/cfg/report-designer":   CfgReportDesignerTab,
  "/cfg/test-setup":        CfgTestSetupTab,
  "/cfg/test-edit":         CfgTestEditTab,
  "/cfg/field-specs":       CfgFieldSpecsTab,
  "/cfg/loyalty-points":   CfgLoyaltyPointsTab,
  "/cfg/loyalty-tiers":    CfgLoyaltyTiersTab,
  "/cfg/loyalty-promos":   CfgLoyaltyPromosTab,
  "/cfg/loyalty-messages":       CfgLoyaltyMessagesTab,
  "/cfg/messaging-whatsapp":     CfgMessagingWhatsAppTab,
  "/cfg/messaging-telegram":     CfgMessagingTelegramTab,
  "/cfg/messaging-email":        CfgMessagingEmailTab,
  "/cfg/messaging-templates":    CfgMessagingTemplatesTab,
  "/cfg/messaging-log":          CfgMessagingLogTab,
  "/cfg/print-settings":         CfgPrintSettingsTab,
  "/cfg/logo-stamp":             CfgLogoStampTab,
  "/cfg/signatures":             CfgSignaturesTab,
  "/cfg/email-pdf":              CfgEmailPdfTab,
};

// ─── Auth Guard ───────────────────────────────────────────────────────────
function AuthGuard({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false });

  useEffect(() => {
    if (meQuery.isLoading) return;
    if (!meQuery.data) {
      if (location !== "/login") navigate("/login");
    } else {
      if (location === "/login") {
        navigate(meQuery.data.role === "superadmin" ? "/superadmin" : "/");
      }
    }
  }, [meQuery.data, meQuery.isLoading, location]);

  if (meQuery.isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">جاري التحقق من الجلسة...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ─── نوافذ عائمة Windows-style ───────────────────────────────────────────
function TabContent() {
  const { tabs, dashboardVisible } = useTabManager();
  const showDashboard = dashboardVisible || tabs.length === 0;

  return (
    <>
      {/* لوحة التحكم في الخلفية */}
      {showDashboard && (
        <div className="absolute inset-0 overflow-auto" dir="rtl">
          <Dashboard />
        </div>
      )}

      {/* النوافذ العائمة */}
      {tabs.map(tab => {
        const Component = PAGE_MAP[tab.path];
        return (
          <AppWindow key={tab.id} tab={tab}>
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }} dir="rtl">
              {Component ? <Component /> : <NotFound />}
            </div>
          </AppWindow>
        );
      })}
    </>
  );
}

// ─── مسارات التطبيق ───────────────────────────────────────────────────────
function AppRoutes() {
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false });
  const user = meQuery.data;

  if (user?.role === "superadmin") {
    return (
      <Switch>
        <Route path="/superadmin" component={SuperAdminPage} />
        <Route component={SuperAdminPage} />
      </Switch>
    );
  }

  return (
    <TabManagerProvider>
      <DashboardLayout>
        <TabContent />
      </DashboardLayout>
    </TabManagerProvider>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────
function App() {
  useSmartCopy();
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Toaster position="top-center" richColors />
            <Switch>
              <Route path="/login" component={LoginPage} />
              <Route>
                <AuthGuard>
                  <AppRoutes />
                </AuthGuard>
              </Route>
            </Switch>
          </TooltipProvider>
        </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
