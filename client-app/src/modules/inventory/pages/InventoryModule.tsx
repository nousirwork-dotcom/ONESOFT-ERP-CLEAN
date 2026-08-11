import { useState } from "react";
import { useLocation } from "wouter";
import { useTabManager } from "@/core/contexts/TabManagerContext";
import {
  ChevronDown, ChevronRight, FolderTree, Ruler, Layers, Tag, TrendingUp,
  ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, ClipboardList, RefreshCw,
  BarChart3, Settings, Building2, Warehouse, Package, FileText, AlertTriangle, CheckCircle2, TrendingDown, Gift
} from "lucide-react";
import { Button } from "@/core/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/ui/select";
import { Label } from "@/core/ui/label";
import { trpc } from "@/shared/lib/trpc";
import { toast } from "sonner";
// صفحات المخزون
import CategoryTree from "./CategoryTree";
import Units from "./Units";
import ProductGroups from "./ProductGroups";
import AutoPricing from "./AutoPricing";
import FreeProducts from "./FreeProducts";
import StockVouchers from "./StockVouchers";
import InventoryCount from "./InventoryCount";
import InventoryReports from "./InventoryReports";

// استيراد الصفحات الموجودة
import Products from "./Products";

import Transfers from "./Transfers";

type MenuChild = {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
};
type MenuSection = {
  id: string;
  label: string;
  icon: React.ElementType;
  path?: string;
  children?: MenuChild[];
};

export const menuSections: MenuSection[] = [
  {
    id: "products-section",
    label: "الأصناف",
    icon: Package,
    children: [
      { id: "products-list",    label: "دليل الأصناف",          icon: Package,   path: "/inv/products" },
      { id: "units",            label: "وحدات الأصناف",          icon: Ruler,     path: "/inv/units" },
      { id: "product-groups",   label: "مجموعات الأصناف",        icon: Layers,    path: "/inv/groups" },
      { id: "categories",       label: "فئات الأصناف",            icon: Tag,       path: "/inv/categories" },
      { id: "auto-pricing",     label: "تسعير الأصناف آلياً",     icon: TrendingUp,path: "/inv/pricing" },
      { id: "free-products",    label: "الأصناف المجانية",         icon: Gift,      path: "/inv/free-products" },
    ],
  },
  {
    id: "vouchers-section",
    label: "السندات",
    icon: FileText,
    children: [
      { id: "transfer-voucher", label: "سند تحويل بين الفروع", icon: ArrowLeftRight, path: "/inv/transfer" },
      { id: "receipt-voucher",  label: "سند توريد",              icon: ArrowDownCircle,path: "/inv/receipt" },
      { id: "issue-voucher",    label: "سند صرف",                icon: ArrowUpCircle,  path: "/inv/issue" },
    ],
  },
  {
    id: "inventory-count",
    label: "شاشة جرد المخزون",
    icon: ClipboardList,
    path: "/inv/count",
  },
  {
    id: "invoice-ops",
    label: "عمليات الفواتير",
    icon: RefreshCw,
    children: [
      { id: "reinstate-invoices",  label: "إعادة تثبيت الفواتير",  icon: RefreshCw, path: "/inv/reinstate" },
      { id: "regenerate-invoices", label: "إعادة توليد الفواتير",   icon: RefreshCw, path: "/inv/regenerate" },
    ],
  },
  {
    id: "reports-section",
    label: "التقارير",
    icon: BarChart3,
    children: [
      { id: "stock-reports",   label: "تقارير المخزون والأصناف", icon: BarChart3, path: "/inv/stock-reports" },
      { id: "voucher-reports", label: "تقارير سندات المخزن",     icon: FileText,  path: "/inv/voucher-reports" },
    ],
  },
];

// ─── إعادة تثبيت الفواتير ──────────────────────────────────────────────────
function ReinstateInvoices() {
  return (
    <div className="space-y-5 max-w-xl">
      <div className="flex items-center gap-2">
        <RefreshCw className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">إعادة تثبيت الفواتير</h2>
      </div>
      <div className="border border-amber-400/30 bg-amber-500/5 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-700 dark:text-amber-400 space-y-1">
          <p className="font-semibold">العملية غير متاحة حاليًا</p>
          <p>لا توجد عملية خادم معتمدة لإعادة تثبيت الفواتير في هذا الإصدار. لم يتم ربط الشاشة بسلوك غير منفّذ.</p>
        </div>
      </div>
    </div>
  );
}

// ─── إعادة توليد الأسعار ──────────────────────────────────────────────────
function RegeneratePricing() {
  return (
    <div className="space-y-5 max-w-xl">
      <div className="flex items-center gap-2">
        <TrendingDown className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">إعادة توليد متوسط التكلفة</h2>
      </div>
      <div className="border border-blue-400/30 bg-blue-500/5 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
          <p className="font-semibold">العملية غير متاحة حاليًا</p>
          <p>لا توجد عملية خادم معتمدة لإعادة توليد متوسط التكلفة في هذا الإصدار. لم يتم ربط الشاشة بسلوك غير منفّذ.</p>
        </div>
      </div>
    </div>
  );
}

function InventoryMenu({ activeId, onSelect }: { activeId: string; onSelect: (id: string) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "products-section": true,
    "vouchers-section": true,
    "reports-section": false,
    "config-section": false,
    "invoice-ops": false,
  });

  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));
  const { openTab } = useTabManager();

  return (
    <nav className="w-56 shrink-0 border-l border-border bg-card/50 overflow-y-auto">
      <div className="p-3 border-b border-border">
        <h2 className="font-bold text-sm flex items-center gap-2">
          <Warehouse className="w-4 h-4 text-primary" />
          المخزون
        </h2>
      </div>
      <div className="py-2">
        {menuSections.map(section => (
          <div key={section.id}>
            {section.children ? (
              <>
                <button
                  onClick={() => toggle(section.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
                >
                  <section.icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-right">{section.label}</span>
                  {expanded[section.id]
                    ? <ChevronDown className="w-3.5 h-3.5" />
                    : <ChevronRight className="w-3.5 h-3.5" />
                  }
                </button>
                {expanded[section.id] && (
                  <div className="mr-4 border-r border-border/50">
                    {section.children.map(child => (
                      <button
                        key={child.id}
                        onClick={() => { onSelect(child.id); openTab(child.path, child.label, child.icon); }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                          activeId === child.id
                            ? "bg-primary/10 text-primary font-medium border-r-2 border-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                        }`}
                      >
                        <child.icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-right leading-tight">{child.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <button
                onClick={() => { onSelect(section.id); openTab(section.path ?? "", section.label, section.icon); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold transition-colors ${
                  activeId === section.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                }`}
              >
                <section.icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-right">{section.label}</span>
              </button>
            )}
          </div>
        ))}
      </div>
    </nav>
  );
}

function InventoryContent({ activeId }: { activeId: string }) {
  switch (activeId) {

    case "products-list": return <Products />;
    case "units": return <Units />;
    case "product-groups": return <ProductGroups />;
    case "categories": return <CategoryTree />;
    case "auto-pricing": return <AutoPricing />;
    case "free-products": return <FreeProducts />;
    case "transfer-voucher": return <Transfers />;
    case "receipt-voucher": return <StockVouchers initialTab="receipt" />;
    case "issue-voucher": return <StockVouchers initialTab="issue" />;
    case "inventory-count": return <InventoryCount />;
    case "stock-reports":
    case "voucher-reports": return <InventoryReports />;
    case "reinstate-invoices": return <ReinstateInvoices />;
    case "regenerate-invoices": return <RegeneratePricing />;
    default:
      return (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
          <Package className="w-12 h-12 opacity-20" />
          <p>اختر قسماً من القائمة</p>
        </div>
      );
  }
}

export default function InventoryModule() {
  const [activeId, setActiveId] = useState("products-list");

  return (
    <div className="flex h-full" dir="rtl">
      <InventoryMenu activeId={activeId} onSelect={setActiveId} />
      <div className="flex-1 overflow-auto p-6">
        <InventoryContent activeId={activeId} />
      </div>
    </div>
  );
}

// ─── Tab Sub-Pages ─────────────────────────────────────────────────────────────
function InvSubPage({ activeId }: { activeId: string }) {
  return (
    <div className="flex flex-col overflow-hidden" style={{ height: "100%" }} dir="rtl">
      <div className="flex-1 overflow-auto p-6">
        <InventoryContent activeId={activeId} />
      </div>
    </div>
  );
}
export function InvProductsTab()       { return <InvSubPage activeId="products-list" />; }
export function InvUnitsTab()          { return <InvSubPage activeId="units" />; }
export function InvGroupsTab()         { return <InvSubPage activeId="product-groups" />; }
export function InvCategoriesTab()     { return <InvSubPage activeId="categories" />; }
export function InvPricingTab()        { return <InvSubPage activeId="auto-pricing" />; }
export function InvFreeProductsTab()   { return <InvSubPage activeId="free-products" />; }
export function InvTransferTab()       { return <InvSubPage activeId="transfer-voucher" />; }
export function InvReceiptTab()        { return <InvSubPage activeId="receipt-voucher" />; }
export function InvIssueTab()          { return <InvSubPage activeId="issue-voucher" />; }
export function InvCountTab()          { return <InvSubPage activeId="inventory-count" />; }
export function InvStockReportsTab()   { return <InvSubPage activeId="stock-reports" />; }
export function InvVoucherReportsTab() { return <InvSubPage activeId="voucher-reports" />; }
export function InvReinstateTab()      { return <InvSubPage activeId="reinstate-invoices" />; }
export function InvRegenerateTab()     { return <InvSubPage activeId="regenerate-invoices" />; }
