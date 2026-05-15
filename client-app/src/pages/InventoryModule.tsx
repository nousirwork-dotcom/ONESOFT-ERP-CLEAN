import { useState } from "react";
import { useLocation } from "wouter";
import { useTabManager } from "@/contexts/TabManagerContext";
import {
  ChevronDown, ChevronRight, FolderTree, Ruler, Layers, Tag, TrendingUp,
  ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, ClipboardList, RefreshCw,
  BarChart3, Settings, Building2, Warehouse, Package, FileText, AlertTriangle, CheckCircle2, TrendingDown, Gift
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
// صفحات المخزون
import CategoryTree from "./inventory/CategoryTree";
import Units from "./inventory/Units";
import ProductGroups from "./inventory/ProductGroups";
import AutoPricing from "./inventory/AutoPricing";
import FreeProducts from "./inventory/FreeProducts";
import StockVouchers from "./inventory/StockVouchers";
import InventoryCount from "./inventory/InventoryCount";
import InventoryReports from "./inventory/InventoryReports";

// استيراد الصفحات الموجودة
import Products from "./Products";

import Transfers from "./Transfers";

type MenuSection = {
  id: string;
  label: string;
  icon: React.ElementType;
  children?: { id: string; label: string; icon: React.ElementType }[];
};

const menuSections: MenuSection[] = [
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
  const [warehouseId, setWarehouseId] = useState("");
  const [result, setResult] = useState<{ processed: number } | null>(null);
  const { data: warehouses = [] } = trpc.warehouses.list.useQuery();
  const mutation = trpc.maintenance.reinstateInvoices.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success(`تمت إعادة تثبيت ${data.processed} سند بنجاح`);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-5 max-w-xl">
      <div className="flex items-center gap-2">
        <RefreshCw className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">إعادة تثبيت الفواتير</h2>
      </div>
      <div className="border border-amber-400/30 bg-amber-500/5 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-700 dark:text-amber-400 space-y-1">
          <p className="font-semibold">تحذير: عملية حساسة</p>
          <p>ستقوم هذه العملية بإعادة حساب مخزون المستودع المختار بالكامل بناءً على جميع سندات التوريد والصرف المؤكدة. يُنصح بعمل نسخة احتياطية أولاً.</p>
        </div>
      </div>
      <div className="border border-border rounded-xl p-5 bg-card space-y-4">
        <div className="space-y-1.5">
          <Label>المستودع</Label>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger>
              <SelectValue placeholder="جميع المستودعات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع المستودعات</SelectItem>
              {(warehouses as any[]).map((w: any) => (
                <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => mutation.mutate({ warehouseId: warehouseId && warehouseId !== "all" ? Number(warehouseId) : undefined })}
          disabled={mutation.isPending}
          className="w-full gap-2 bg-amber-600 hover:bg-amber-700"
        >
          <RefreshCw className={`w-4 h-4 ${mutation.isPending ? "animate-spin" : ""}`} />
          {mutation.isPending ? "جاري إعادة التثبيت..." : "بدء إعادة التثبيت"}
        </Button>
        {result && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <p className="text-sm text-emerald-700 dark:text-emerald-400">تمت العملية بنجاح — تمت معالجة {result.processed} سند</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── إعادة توليد الأسعار ──────────────────────────────────────────────────
function RegeneratePricing() {
  const [result, setResult] = useState<{ updated: number } | null>(null);
  const mutation = trpc.maintenance.regeneratePricing.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success(`تم تحديث متوسط تكلفة ${data.updated} صنف`);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-5 max-w-xl">
      <div className="flex items-center gap-2">
        <TrendingDown className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">إعادة توليد متوسط التكلفة</h2>
      </div>
      <div className="border border-blue-400/30 bg-blue-500/5 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
          <p className="font-semibold">إعادة حساب متوسط التكلفة</p>
          <p>ستقوم هذه العملية بإعادة حساب متوسط تكلفة كل صنف في كل مستودع بناءً على سندات التوريد المؤكدة.</p>
        </div>
      </div>
      <div className="border border-border rounded-xl p-5 bg-card">
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="w-full gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${mutation.isPending ? "animate-spin" : ""}`} />
          {mutation.isPending ? "جاري إعادة الحساب..." : "إعادة حساب متوسط التكلفة"}
        </Button>
        {result && (
          <div className="flex items-center gap-2 p-3 mt-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <p className="text-sm text-emerald-700 dark:text-emerald-400">تم تحديث {result.updated} صنف بنجاح</p>
          </div>
        )}
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
                        onClick={() => { onSelect(child.id); openTab((child as any).path, child.label, child.icon); }}
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
                onClick={() => { onSelect(section.id); openTab((section as any).path, section.label, section.icon); }}
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
  return <div className="h-full overflow-auto p-6" dir="rtl"><InventoryContent activeId={activeId} /></div>;
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
