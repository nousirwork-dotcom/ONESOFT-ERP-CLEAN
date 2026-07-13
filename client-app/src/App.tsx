import { Toaster } from "@/core/ui/sonner";
import { useSmartCopy } from "@/shared/hooks/useSmartCopy";
import { TooltipProvider } from "@/core/ui/tooltip";
import NotFound from "@/shared/components/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "@/shared/components/ErrorBoundary";
import DashboardLayout from "@/shared/components/DashboardLayout";
import { ThemeProvider } from "@/core/contexts/ThemeContext";
import { TabManagerProvider, useTabManager } from "@/core/contexts/TabManagerContext";
import { UiPrefsProvider, useUiPrefs } from "@/core/contexts/UiPrefsContext";
import AppsHome from "@/shared/components/AppsHome";
import TrialBanner from "@/shared/components/TrialBanner";
import { LanguageProvider } from "@/core/contexts/LanguageContext";
import Dashboard from "@/modules/dashboard/pages/Dashboard";
import POS from "@/modules/sales/pages/POS";
import Invoices from "@/modules/sales/pages/Invoices";
import PurchasesModule, {
  PurchaseSuppliersPage, PurchaseSupplierGroupsPage, PurchaseOrdersPage,
  PurchaseInvoicesPage, PurchaseReturnsPage, PurchaseRptSupplierPage, PurchaseRptItemPage,
} from "@/modules/purchases/pages/PurchasesModule";
import SalesModule, {
  SalesTransactionsTab,
  SalesInvoiceTab, SalesReturnTab, SalesCreditNoteTab, SalesQuotationTab,
  SalesOrderTab, SalesDeliveryTab, SalesPosTab, SalesShiftsTab,
  SalesPaymentMethodsTab, SalesPosSettingsTab, SalesPosReportsTab,
  SalesCustomersTab, SalesCustomerGroupsTab, SalesCustomerBalancesTab,
  SalesCustomerStatementTab, SalesCustomerReportsTab,
  SalesTotalsReportsTab, SalesInvoicesReportTab, SalesItemsReportsTab,
} from "@/modules/sales/pages/SalesModule";
import Users from "@/modules/settings/pages/Users";
import ManufacturingModule, {
  MfgNewOrderTab, MfgOrdersTab, MfgTrackingTab, MfgNewBomTab, MfgBomTab,
  MfgCostTab, MfgCostReportsTab, MfgStagesTab, MfgWorkcentersTab,
  MfgProductionReportTab, MfgEfficiencyTab, MfgWasteTab,
} from "@/modules/manufacturing/pages/ManufacturingModule";
import AccountingModule, {
  AccJournalTab, AccReceiptTab, AccPaymentTab, AccNewJournalTab, AccOpeningTab,
  AccAccountsTab, AccLedgerTab, AccCostCentersTab, AccCostAllocationTab,
  AccTrialBalanceTab, AccIncomeTab, AccBalanceSheetTab, AccCashFlowTab,
} from "@/modules/accounting/pages/AccountingModule";
import HRModule, {
  HREmployeesTab, HRAddEmployeeTab, HRDepartmentsTab, HRPositionsTab,
  HRPayrollTab, HRPayrollListTab, HRAdvancesTab, HRAttendanceTab,
  HRAttendanceReportTab, HRScheduleTab, HRLeaveRequestTab, HRLeavesTab,
  HRLeaveBalanceTab, HRHeadcountTab, HRPayrollReportTab, HRAttendanceSummaryTab,
} from "@/modules/hr/pages/HRModule";
import HelpServicesModule from "@/modules/helpservices/pages/HelpServicesModule";
import AssetsModule, {
  AssetsListTab, AssetsAddTab, AssetsCategoriesTab, AssetsDepreciationTab,
  AssetsDeprScheduleTab, AssetsTransferTab, AssetsTransferListTab,
  AssetsDisposalTab, AssetsDisposalListTab, AssetsSummaryTab,
  AssetsDeprReportTab, AssetsMovementTab,
} from "@/modules/assets/pages/AssetsModule";
import InventoryModule, {
  InvProductsTab, InvUnitsTab, InvGroupsTab, InvCategoriesTab,
  InvPricingTab, InvFreeProductsTab, InvTransferTab, InvReceiptTab, InvIssueTab,
  InvCountTab, InvStockReportsTab, InvVoucherReportsTab, InvReinstateTab, InvRegenerateTab,
} from "@/modules/inventory/pages/InventoryModule";
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
  CfgMessagingTemplatesTab, CfgMessagingLogTab, CfgAiAssistantTab,
  CfgPrintSettingsTab, CfgLogoStampTab, CfgSignaturesTab, CfgEmailPdfTab,
  CfgFieldDictionaryTab, CfgPaymentMethodsTab,
  CfgZatcaTab, CfgZatcaMonitorTab, CfgZatcaInvoicesTab, CfgZatcaLogsTab,
  CfgGosiTab, CfgGaztTab,
  CfgZatcaCenterTab,
  CfgSystemInfoTab,
  CfgServiceManagementTab,
  CfgUpdatesTab,
} from "@/modules/settings/pages/SettingsModule";
import PostingSettingsPage from "@/modules/accounting/pages/PostingSettingsPage";
import PostingOperationsPage from "@/modules/accounting/pages/PostingOperationsPage";
import LoginPage from "@/core/auth/LoginPage";
import BrandingSettingsPage from "@/modules/settings/pages/BrandingSettingsPage";
import {
  HsRentalsPage, HsCustodyPage, HsCustomersPage, HsTasksPage,
  HsGovLinksPage, HsNotesPage, HsInternalCommPage,
} from "@/modules/helpservices/pages/HsPages";
import AIAssistantPage from "@/modules/helpservices/pages/AIAssistantPage";
import LicenseActivationPage from "@/modules/license/pages/LicenseActivationPage";
import SuperAdminPage from "@/core/admin/SuperAdminPage";
import SourceCodeViewerPage from "@/core/dev/SourceCodeViewerPage";
import FirstRunWizard from "@/core/auth/FirstRunWizard";
import { BrandingProvider, BrandingErrorBoundary } from "@/core/contexts/BrandingContext";
import { createElement, lazy, Suspense, useEffect, useState } from "react";

import { trpc } from "@/shared/lib/trpc";
import { Settings } from "lucide-react";
import AppWindow from "@/shared/components/AppWindow";
import UpdateDialog from "@/shared/components/UpdateDialog";
import { useIsMandatoryBlocked } from "@/shared/lib/update-store";

// ─── Dev-only previews ────────────────────────────────────────────────────────
const _DevLicensePreview = import.meta.env.DEV
  ? lazy(() => import("@/modules/license/pages/LicensePreviewPage"))
  : null;
const _DevUpdatePreview = import.meta.env.DEV
  ? lazy(() => import("@/modules/update/pages/UpdatePreviewPage"))
  : null;

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
  "/help-services-module": HelpServicesModule,
  // المساعدة والخدمات
  "/hs/rentals":       HsRentalsPage,
  "/hs/custody":       HsCustodyPage,
  "/hs/customers":     HsCustomersPage,
  "/hs/tasks":         HsTasksPage,
  "/hs/gov-links":     HsGovLinksPage,
  "/hs/notes":         HsNotesPage,
  "/hs/internal-comm": HsInternalCommPage,
  "/hs/ai-assistant":  AIAssistantPage,
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
  "/cfg/ai-assistant":           CfgAiAssistantTab,
  "/cfg/messaging-log":          CfgMessagingLogTab,
  "/cfg/print-settings":         CfgPrintSettingsTab,
  "/cfg/logo-stamp":             CfgLogoStampTab,
  "/cfg/signatures":             CfgSignaturesTab,
  "/cfg/email-pdf":              CfgEmailPdfTab,
  "/cfg/zatca-center":           CfgZatcaCenterTab,
  "/cfg/zatca":                  CfgZatcaTab,
  "/cfg/zatca-mon":              CfgZatcaMonitorTab,
  "/cfg/zatca-inv":              CfgZatcaInvoicesTab,
  "/cfg/zatca-log":              CfgZatcaLogsTab,
  "/cfg/gosi":                   CfgGosiTab,
  "/cfg/gazt":                   CfgGaztTab,
  "/cfg/system-info":            CfgSystemInfoTab,
  "/cfg/service-management":     CfgServiceManagementTab,
  "/cfg/updates":                CfgUpdatesTab,
  "/dev/source-code":            SourceCodeViewerPage,
  "/cfg/branding":               BrandingSettingsPage,
  "/cfg/license":                LicenseActivationPage,
};

// ─── Auth Guard ───────────────────────────────────────────────────────────
// license_not_found ليس ضمن القائمة — جهاز بلا ملف ترخيص لكنه في فترة تجربة
// صالحة يجب ألا يُجبَر على شاشة التفعيل. التفعيل يظهر فقط عند انتهاء فعلي.
const LICENSE_BLOCKING_ERRORS = new Set([
  "expired",
  "trial_expired",           // فترة التجربة انتهت — يُوجَّه إلى /cfg/license
  "invalid_signature",
  "unknown_algorithm",
  "unknown_kid",
  "date_manipulation_suspected",
  "invalid_json",
  "read_error",
]);
// ملاحظة: trial_active و license_not_found ليسا في القائمة — يُسمح بالوصول الكامل

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const meQuery    = trpc.auth.me.useQuery(undefined, { retry: false });
  const firstRunQ  = trpc.setup.isFirstRun.useQuery(undefined, { retry: false, enabled: !!meQuery.data });
  const licenseQ   = trpc.license.getStatus.useQuery(undefined, {
    retry:              false,
    enabled:            !!meQuery.data,
    staleTime:          60_000,
    refetchOnWindowFocus: false,
  });
  const [wizardDone, setWizardDone] = useState(false);

  useEffect(() => {
    if (meQuery.isLoading) return;
    if (!meQuery.data) {
      if (location !== "/login") navigate("/login");
    } else {
      if (location === "/login") {
        navigate("/");
      }
    }
  }, [meQuery.data, meQuery.isLoading, location]);

  // توجيه تلقائي عند انتهاء صلاحية الترخيص أو تلفه
  // لا يُوجَّه في حالة license_not_found (وضع التطوير — لا قيود)
  useEffect(() => {
    if (!meQuery.data) return;
    if (licenseQ.isLoading || licenseQ.data === undefined) return;
    const err = licenseQ.data?.error as string | null | undefined;
    if (err && LICENSE_BLOCKING_ERRORS.has(err) && location !== "/cfg/license") {
      navigate("/cfg/license");
    }
  }, [licenseQ.data, licenseQ.isLoading, meQuery.data, location]);

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

  const showFirstRun = !!meQuery.data && firstRunQ.data?.firstRun === true && !wizardDone;

  return (
    <>
      {showFirstRun && (
        <FirstRunWizard onComplete={() => { setWizardDone(true); firstRunQ.refetch(); }} />
      )}
      {children}
    </>
  );
}

// ─── نوافذ عائمة Windows-style ───────────────────────────────────────────
function TabContent() {
  const { tabs, dashboardVisible } = useTabManager();
  const { layoutMode } = useUiPrefs();
  const showDashboard = dashboardVisible || tabs.length === 0;

  return (
    <>
      {showDashboard && (
        <div className="absolute inset-0 overflow-auto" dir="rtl">
          {/* تنبيه النسخة التجريبية — يظهر مرة واحدة أعلى الشاشة الرئيسية فقط،
              ويختفي تلقائياً عند فتح أي شاشة أخرى لأن هذه الطبقة تُخفى */}
          <TrialBanner />
          {layoutMode === "apps" ? <AppsHome /> : <Dashboard />}
        </div>
      )}
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

  return (
    <Switch>
      {user?.role === 'superadmin' && (
        <Route path="/superadmin" component={SuperAdminPage} />
      )}
      <Route>
        <TabManagerProvider>
          <UiPrefsProvider>
            <DashboardLayout>
              <TabContent />
            </DashboardLayout>
          </UiPrefsProvider>
        </TabManagerProvider>
      </Route>
    </Switch>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────
function App() {
  useSmartCopy();
  const mandatoryUpdateActive = useIsMandatoryBlocked();

  return (
    <ErrorBoundary>
      <LanguageProvider>
        <BrandingErrorBoundary>
        <BrandingProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Toaster position="top-center" richColors />

            {/*
              نافذة التحديث التلقائي — دائماً مُركَّبة لاستقبال أحداث IPC.
              في حالة التحديث الإجباري تحجب الشاشة بالكامل وتمنع أي تفاعل.
            */}
            <UpdateDialog />

            {/*
              حجب جميع المسارات عند وجود تحديث إجباري:
              لا login — لا dashboard — لا أي صفحة أخرى.
              يُرفع الحجب تلقائياً بعد إعادة التشغيل مع الإصدار الجديد.
            */}
            {!mandatoryUpdateActive && (
              <Switch>
                <Route path="/login" component={LoginPage} />
                {/* صفحة التفعيل عامة — لا تحتاج تسجيل دخول (جهاز جديد بدون ترخيص) */}
                <Route path="/cfg/license" component={LicenseActivationPage} />
                {import.meta.env.DEV && _DevLicensePreview && (
                  <Route path="/dev/license-preview">
                    {() => (
                      <Suspense fallback={null}>
                        {_DevLicensePreview && createElement(_DevLicensePreview)}
                      </Suspense>
                    )}
                  </Route>
                )}
                {import.meta.env.DEV && _DevUpdatePreview && (
                  <Route path="/dev/update-preview">
                    {() => (
                      <Suspense fallback={null}>
                        {_DevUpdatePreview && createElement(_DevUpdatePreview)}
                      </Suspense>
                    )}
                  </Route>
                )}
                <Route>
                  <AuthGuard>
                    <AppRoutes />
                  </AuthGuard>
                </Route>
              </Switch>
            )}
          </TooltipProvider>
        </ThemeProvider>
        </BrandingProvider>
        </BrandingErrorBoundary>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
