import { useState, useMemo, useCallback } from "react";
import { useUnsavedChangesGuard } from "@/core/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/shared/components/UnsavedChangesDialog";
import ProductLookupCell, { type ProductLookupOption } from "@/shared/components/ProductLookupCell";
import { FoundationPolicyPanel } from "@/shared/components/FoundationPolicyPanel";
import type { RecordPolicy } from "@/shared/components/FoundationPolicyPanel";
import { DateSegmentInput } from "@/shared/components/DateSegmentInput";
import { fmtDate } from "@/shared/utils/dateUtils";
import PurchaseInvoicePage from "./PurchaseInvoicePage";
import PurchaseReturnPage from "./PurchaseReturnPage";
import PurchaseOrderPage from "./PurchaseOrderPage";
import {
  ChevronDown, ChevronRight, ShoppingCart, FileText, Users,
  Plus, Search, Printer, X, Check, Trash2, Edit2, ArrowLeft,
  Package, RotateCcw, ClipboardList, TrendingDown, DollarSign,
} from "lucide-react";
import { useTabManager } from "@/core/contexts/TabManagerContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/ui/card";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Badge } from "@/core/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/core/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/core/ui/dialog";
import { DesktopWorkWindow } from "@/components/work-window";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/ui/tabs";
import { Textarea } from "@/core/ui/textarea";
import { toast } from "sonner";
import { trpc } from "@/shared/lib/trpc";
import SupplierFormDialog from "@/shared/components/SupplierFormDialog";

type MenuId = string;

// ─── Menu Structure ────────────────────────────────────────────────────────────
export const menuSections = [
  {
    id: "transactions-group",
    label: "المعاملات",
    icon: FileText,
    children: [
      { id: "purchase-invoices", label: "فاتورة مشتريات",  icon: FileText,       path: "/purchases/invoices" },
      { id: "purchase-returns",  label: "مردود المشتريات", icon: RotateCcw,      path: "/purchases/returns" },
      { id: "purchase-orders",   label: "امر شراء",        icon: ClipboardList,  path: "/purchases/orders" },
    ],
  },
  {
    id: "suppliers-group",
    label: "الموردين",
    icon: Users,
    children: [
      { id: "suppliers-list",      label: "إضافة مورد",           icon: Plus,        path: "/purchases/suppliers" },
      { id: "supplier-groups",     label: "مجموعات الموردين",     icon: Users,       path: "/purchases/supplier-groups" },
      { id: "supplier-balances",   label: "أرصدة الموردين",       icon: DollarSign,  path: "/purchases/supplier-balances" },
      { id: "supplier-statement",  label: "كشف حساب المورد",      icon: FileText,    path: "/purchases/supplier-statement" },
    ],
  },
  {
    id: "purchase-reports",
    label: "التقارير",
    icon: TrendingDown,
    children: [
      { id: "rpt-by-supplier",    label: "تقارير الموردين",              icon: TrendingDown, path: "/purchases/rpt-supplier" },
      { id: "rpt-totals",         label: "تقارير إجماليات المشتريات",    icon: ShoppingCart, path: "/purchases/rpt-totals" },
      { id: "rpt-by-item",        label: "تقارير أصناف المشتريات",       icon: Package,      path: "/purchases/rpt-item" },
    ],
  },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function PurchasesMenu({ activeId, onSelect }: { activeId: MenuId; onSelect: (id: MenuId) => void }) {
  const { openTab } = useTabManager();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "transactions-group": true, "suppliers-group": true, "purchase-reports": false,
  });
  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  return (
    <nav className="w-56 shrink-0 border-l border-border bg-card/50 overflow-y-auto flex flex-col">
      <div className="p-3 border-b border-border">
        <button onClick={() => onSelect("overview")}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-bold transition-colors ${
            activeId === "overview" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent/30"
          }`}>
          <ShoppingCart className="w-4 h-4 text-primary" />
          المشتريات
        </button>
      </div>
      <div className="py-2 flex-1">
        {menuSections.map(section => (
          <div key={section.id}>
            <button onClick={() => toggle(section.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors">
              <section.icon className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1 text-right">{section.label}</span>
              {expanded[section.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {expanded[section.id] && (
              <div className="mr-3 border-r border-border/40 mb-1">
                {section.children.map(child => (
                    <button
                      key={child.id}
                      onClick={() => {
                        onSelect(child.id);
                        openTab(child.path, child.label, child.icon);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                        activeId === child.id
                          ? "bg-primary/10 text-primary font-semibold border-r-2 border-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/20"
                      }`}>
                      <child.icon className="w-3 h-3 shrink-0" />
                      <span className="text-right leading-tight">{child.label}</span>
                    </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </nav>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────
function PurchasesOverview({ onSelect }: { onSelect: (id: MenuId) => void }) {
  const listQuery = trpc.purchases.list.useQuery();
  const suppliersQuery = trpc.suppliers.list.useQuery();

  const totalPurchases = listQuery.data?.reduce((s, i) => s + parseFloat(i.total ?? "0"), 0) ?? 0;
  const pendingCount = listQuery.data?.filter(i => i.status === "draft").length ?? 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "إجمالي المشتريات", value: totalPurchases.toLocaleString(), color: "text-primary",     icon: ShoppingCart },
          { label: "عدد الموردين",      value: (suppliersQuery.data?.length ?? 0).toString(), color: "text-emerald-500", icon: Users },
          { label: "فواتير معلقة",      value: pendingCount.toString(),         color: "text-amber-500",   icon: FileText },
          { label: "أوامر شراء مفتوحة", value: "0",                             color: "text-blue-500",    icon: ClipboardList },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4">
              <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {menuSections.map(group => (
          <Card key={group.id} className="border-border/50 hover:border-primary/30 transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
                <group.icon className="w-3.5 h-3.5 text-primary" />
                {group.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pt-0">
              {group.children.map(item => (
                <button key={item.id} onClick={() => onSelect(item.id)}
                  className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors">
                  <ArrowLeft className="w-2.5 h-2.5 shrink-0" />
                  {item.label}
                </button>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Suppliers List (دليل الموردين) ───────────────────────────────────────────
function SupplierDirectoryPage() {
  const listQuery = trpc.suppliers.list.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [search, setSearch] = useState("");
  const filtered = listQuery.data?.filter(s =>
    !search || s.name?.includes(search) || s.phone?.includes(search) || s.code?.includes(search)
  ) ?? [];

  return (
    <div className="erp-standard-ui space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> دليل الموردين</h3>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute right-2 top-1.5 w-3 h-3 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} className="h-7 text-xs pr-7 w-48" placeholder="بحث الموردين..." />
          </div>
          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => { setEditData(null); setShowForm(true); }}>
            <Plus className="w-3 h-3" /> إضافة مورد
          </Button>
        </div>
      </div>
      <Card className="border-border/60">
        <Table>
          <TableHeader><TableRow className="bg-muted/30">
            <TableHead className="text-xs">كود المورد</TableHead>
            <TableHead className="text-xs">اسم المورد</TableHead>
            <TableHead className="text-xs">الهاتف</TableHead>
            <TableHead className="text-xs">البريد الإلكتروني</TableHead>
            <TableHead className="text-xs">إجراءات</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">لا يوجد موردون</TableCell></TableRow>}
            {filtered.map(s => <TableRow key={s.id}>
              <TableCell className="text-xs">{s.code ?? "-"}</TableCell>
              <TableCell className="text-xs font-semibold">{s.name}</TableCell>
              <TableCell className="text-xs">{s.phone ?? "-"}</TableCell>
              <TableCell className="text-xs">{s.email ?? "-"}</TableCell>
              <TableCell><Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setEditData(s); setShowForm(true); }}><Edit2 className="w-3 h-3" /></Button></TableCell>
            </TableRow>)}
          </TableBody>
        </Table>
      </Card>
      <SupplierFormDialog
        open={showForm}
        editData={editData}
        onClose={() => { setShowForm(false); setEditData(null); }}
        onSaved={() => { setShowForm(false); setEditData(null); listQuery.refetch(); }}
      />
    </div>
  );
}

function SuppliersListPage() {
  const listQuery = trpc.suppliers.list.useQuery();

  const [showForm, setShowForm] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const { confirmOpen, requestClose, confirmSave, confirmDiscard, confirmCancel } =
    useUnsavedChangesGuard({ isDirty });

  const closeForm = useCallback(() => { setShowForm(false); setIsDirty(false); }, []);

  const createMutation = trpc.suppliers.create.useMutation({
    onSuccess: () => { toast.success("تم إضافة المورد"); listQuery.refetch(); closeForm(); },
    onError: (e) => toast.error(e.message),
  });

  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "", name2: "", phone: "", phone2: "", email: "",
    address: "", city: "", fax: "", poBox: "",
    responsible: "", agent: "", weeklyWorkHours: "",
    supplierType: "supplier_only" as "supplier_only" | "supplier_customer",
    groupCode: "", accountCode: "", costCenterId: "",
    creditLimit: "", paymentTerms: "", defaultDiscount: "",
    notes: "",
    recordPolicy: "flexible" as RecordPolicy,
    foundationKey: "",
    includeInFoundation: false,
  });
  const setF = (k: string, v: string) => { setIsDirty(true); setForm(p => ({ ...p, [k]: v })); };

  const filtered = listQuery.data?.filter(s =>
    !search || s.name?.includes(search) || s.phone?.includes(search)
  ) ?? [];

  const handleSave = useCallback(async (): Promise<void> => {
    if (!form.name) { toast.error("أدخل اسم المورد"); throw new Error("validation"); }
    await createMutation.mutateAsync({
      name: form.name,
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
       recordPolicy: form.recordPolicy === "editable" || form.recordPolicy === "protected"
         ? "flexible"
         : form.recordPolicy,
      includeInFoundation: form.includeInFoundation,
      foundationKey: form.foundationKey || undefined,
    });
  }, [form, createMutation]);

  return (
    <div className="erp-standard-ui space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" /> دليل الموردين
        </h3>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute right-2 top-1.5 w-3 h-3 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} className="h-7 text-xs pr-7 w-48" placeholder="بحث..." />
          </div>
          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => { setIsDirty(false); setShowForm(true); }}>
            <Plus className="w-3 h-3" /> إضافة مورد
          </Button>
        </div>
      </div>

      <Card className="border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs">اسم المورد</TableHead>
              <TableHead className="text-xs">هاتف</TableHead>
              <TableHead className="text-xs">البريد الإلكتروني</TableHead>
              <TableHead className="text-xs">العنوان</TableHead>
              <TableHead className="text-xs">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">
                لا يوجد موردون - أضف مورداً جديداً
              </TableCell></TableRow>
            )}
            {filtered.map(s => (
              <TableRow key={s.id} className="hover:bg-muted/10">
                <TableCell className="text-xs font-semibold">{s.name}</TableCell>
                <TableCell className="text-xs">{s.phone ?? "-"}</TableCell>
                <TableCell className="text-xs">{s.email ?? "-"}</TableCell>
                <TableCell className="text-xs">{s.address ?? "-"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setIsDirty(false); setShowForm(true); }}>
                    <Edit2 className="w-3 h-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* نموذج إضافة مورد - مطابق للصورة المرجعية */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) requestClose(closeForm); else setShowForm(true); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              إضافة مورد
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="main">
            <TabsList className="w-full grid grid-cols-6">
              <TabsTrigger value="main"      className="text-xs">نافذة رئيسية</TabsTrigger>
              <TabsTrigger value="extra"     className="text-xs">وصف إضافي</TabsTrigger>
              <TabsTrigger value="accounts"  className="text-xs">حسابات</TabsTrigger>
              <TabsTrigger value="pricing"   className="text-xs">التسعير والضوابط</TabsTrigger>
              <TabsTrigger value="sales"     className="text-xs">مبيعات</TabsTrigger>
              <TabsTrigger value="purchases" className="text-xs">مشتريات</TabsTrigger>
            </TabsList>

            {/* نافذة رئيسية */}
            <TabsContent value="main" className="space-y-3 pt-3">
              {/* نوع المورد - مطابق للصورة */}
              <div className="flex gap-6 mb-3 p-2 border border-border/40 rounded">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="radio" name="supplierType" value="supplier_only"
                    checked={form.supplierType === "supplier_only"}
                    onChange={() => setF("supplierType", "supplier_only")} />
                  مورد فقط
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="radio" name="supplierType" value="supplier_customer"
                    checked={form.supplierType === "supplier_customer"}
                    onChange={() => setF("supplierType", "supplier_customer")} />
                  عميل ومورد
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">رقم *</Label>
                  <Input className="h-8 text-xs bg-primary/5" placeholder="كود المورد تلقائي..." readOnly />
                </div>
                <div>
                  <Label className="text-xs">رقم المجموعة</Label>
                  <Input value={form.groupCode} onChange={e => setF("groupCode", e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">حساب أستاذ</Label>
                  <Input value={form.accountCode} onChange={e => setF("accountCode", e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">مركز تكلفة</Label>
                  <Input value={form.costCenterId} onChange={e => setF("costCenterId", e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
              <div>
                <Label className="text-xs">إسم 1 *</Label>
                <Input value={form.name} onChange={e => setF("name", e.target.value)} className="h-8 text-xs" placeholder="الاسم الأول..." />
              </div>
              <div>
                <Label className="text-xs">إسم 2</Label>
                <Input value={form.name2} onChange={e => setF("name2", e.target.value)} className="h-8 text-xs" placeholder="الاسم الثاني (إنجليزي)..." />
              </div>
              <div>
                <Label className="text-xs">عنوان</Label>
                <Input value={form.address} onChange={e => setF("address", e.target.value)} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">المسؤول</Label>
                <Input value={form.responsible} onChange={e => setF("responsible", e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">هاتف 1</Label>
                  <Input value={form.phone} onChange={e => setF("phone", e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">صندوق بريد</Label>
                  <Input value={form.poBox} onChange={e => setF("poBox", e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">هاتف 2</Label>
                  <Input value={form.phone2} onChange={e => setF("phone2", e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">مدينة</Label>
                  <Input value={form.city} onChange={e => setF("city", e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">فاكس</Label>
                  <Input value={form.fax} onChange={e => setF("fax", e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">رمز بريدي</Label>
                  <Input className="h-8 text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">البريد الإلكتروني</Label>
                  <Input type="email" value={form.email} onChange={e => setF("email", e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">دولة</Label>
                  <Input className="h-8 text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">بائع مسئول</Label>
                  <Input value={form.agent} onChange={e => setF("agent", e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">منطقة</Label>
                  <Input className="h-8 text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">ساعات العمل الأسبوعية</Label>
                  <Input value={form.weeklyWorkHours} onChange={e => setF("weeklyWorkHours", e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">عملة أسبوعية</Label>
                  <Select defaultValue="SAR">
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SAR">SAR - ريال سعودي</SelectItem>
                      <SelectItem value="USD">USD - دولار</SelectItem>
                      <SelectItem value="EUR">EUR - يورو</SelectItem>
                      <SelectItem value="AED">AED - درهم</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="border border-border/40 rounded p-2">
                <Label className="text-xs text-muted-foreground mb-2 block">فئات</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Input className="h-7 text-xs" placeholder="فئة 1" />
                  <Input className="h-7 text-xs" placeholder="فئة 2" />
                  <Input className="h-7 text-xs" placeholder="فئة 3" />
                </div>
              </div>
            </TabsContent>

            {/* وصف إضافي */}
            <TabsContent value="extra" className="space-y-3 pt-3">
              <div>
                <Label className="text-xs">ملاحظات</Label>
                <Textarea value={form.notes} onChange={e => setF("notes", e.target.value)}
                  className="w-full h-32 text-xs border border-border rounded p-2 bg-background resize-none" />
              </div>
            </TabsContent>

            {/* حسابات */}
            <TabsContent value="accounts" className="space-y-3 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">حد الائتمان</Label>
                  <Input type="number" value={form.creditLimit} onChange={e => setF("creditLimit", e.target.value)} className="h-8 text-xs" placeholder="0.000" />
                </div>
                <div>
                  <Label className="text-xs">شروط الدفع (أيام)</Label>
                  <Input type="number" value={form.paymentTerms} onChange={e => setF("paymentTerms", e.target.value)} className="h-8 text-xs" placeholder="30" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">الأرصدة تُحسب تلقائياً من القيود والفواتير</p>
            </TabsContent>

            {/* التسعير والضوابط */}
            <TabsContent value="pricing" className="space-y-3 pt-3">
              <div>
                <Label className="text-xs">خصم افتراضي %</Label>
                <Input type="number" value={form.defaultDiscount} onChange={e => setF("defaultDiscount", e.target.value)} className="h-8 text-xs" placeholder="0.00" />
              </div>
            </TabsContent>

            {/* مبيعات */}
            <TabsContent value="sales" className="pt-3">
              <p className="text-xs text-muted-foreground text-center py-8">إحصائيات المبيعات للمورد ستظهر هنا</p>
            </TabsContent>

            {/* مشتريات */}
            <TabsContent value="purchases" className="pt-3">
              <p className="text-xs text-muted-foreground text-center py-8">إحصائيات المشتريات للمورد ستظهر هنا</p>
            </TabsContent>
          </Tabs>

          <FoundationPolicyPanel
            recordPolicy={form.recordPolicy}
            foundationKey={form.foundationKey || null}
            includeInFoundation={form.includeInFoundation}
            onChange={(policy, include) => setForm(p => ({ ...p, recordPolicy: policy, includeInFoundation: include }))}
          />
          <div className="flex justify-end gap-2 mt-3 border-t border-border pt-3">
            <Button variant="outline" size="sm" onClick={() => requestClose(closeForm)}>إلغاء</Button>
            <Button size="sm" disabled={!form.name || createMutation.isPending} onClick={() => handleSave().catch(() => {})}>
              <Check className="w-3 h-3 ml-1" /> حفظ
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <UnsavedChangesDialog
        open={confirmOpen}
        onSave={() => confirmSave(handleSave)}
        onDiscard={confirmDiscard}
        onCancel={confirmCancel}
        isSaving={createMutation.isPending}
      />
    </div>
  );
}

// ─── Purchase Invoice / Return / Order ────────────────────────────────────────
type InvoiceType = "invoice" | "return" | "order";

function PurchaseDocPage({ invoiceType }: { invoiceType: InvoiceType }) {
  const suppliersQuery = trpc.suppliers.list.useQuery();
  const productsQuery = trpc.products.list.useQuery();
  const listQuery = trpc.purchases.list.useQuery({ invoiceType });
  const createMutation = trpc.purchases.create.useMutation({
    onSuccess: () => {
      const labels: Record<InvoiceType, string> = { invoice: "فاتورة المشتريات", return: "مردود المشتريات", order: "أمر الشراء" };
      toast.success(`تم حفظ ${labels[invoiceType]}`);
      listQuery.refetch();
      setShowForm(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    invoiceDate: new Date().toISOString().split("T")[0],
    supplierId: "",
    currency: "SAR", exchangeRate: "1.000000",
    analyticCode: "", notes: "", basedOn: "",
    paidCash: "0.00", discountPercent: "0.0",
  });
  const [lines, setLines] = useState([
    { productId: "", productName: "", unit: "", qty: "", unitPrice: "", discountPct: "", discountAmt: "", total: "" },
  ]);

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const updateLine = (i: number, field: string, value: string) => {
    setLines(prev => prev.map((l, idx) => {
      if (idx !== i) return l;
      const updated = { ...l, [field]: value };
      const qty = parseFloat(updated.qty) || 0;
      const price = parseFloat(updated.unitPrice) || 0;
      const discPct = parseFloat(updated.discountPct) || 0;
      const discAmt = parseFloat(updated.discountAmt) || 0;
      const subtotal = qty * price;
      const discount = discAmt > 0 ? discAmt : (subtotal * discPct / 100);
      updated.total = (subtotal - discount).toFixed(3);
      return updated;
    }));
  };

  const totalAmount = lines.reduce((s, l) => s + (parseFloat(l.total) || 0), 0);
  const totalDiscount = lines.reduce((s, l) => {
    const qty = parseFloat(l.qty) || 0;
    const price = parseFloat(l.unitPrice) || 0;
    const discPct = parseFloat(l.discountPct) || 0;
    const discAmt = parseFloat(l.discountAmt) || 0;
    return s + (discAmt > 0 ? discAmt : qty * price * discPct / 100);
  }, 0);

  const handleSave = () => {
    if (!form.supplierId) return toast.error("اختر المورد");
    const validLines = lines.filter(l => l.productName && parseFloat(l.qty) > 0);
    if (validLines.length === 0) return toast.error("أضف صنفاً واحداً على الأقل");

    const typeLabels: Record<InvoiceType, string> = { invoice: "PUR", return: "RET", order: "ORD" };
    createMutation.mutate({
        invoiceNumber: `${typeLabels[invoiceType]}-${Date.now()}`,
        invoiceDate: form.invoiceDate,
        supplierId: parseInt(form.supplierId),
        invoiceType,
        currency: form.currency,
        basedOnNumber: form.basedOn || undefined,
        notes: form.notes || undefined,
        subtotal: totalAmount.toFixed(3),
        discountPercent: form.discountPercent,
        discountAmount: totalDiscount.toFixed(3),
        taxAmount: "0",
        total: totalAmount.toFixed(3),
        paidAmount: form.paidCash,
        remainingAmount: (totalAmount - parseFloat(form.paidCash)).toFixed(3),
        items: validLines.map((l, i) => ({
        sortOrder: i + 1,
        productId: l.productId ? parseInt(l.productId) : undefined,
        productName: l.productName,
        unit: l.unit || "قطعة",
        quantity: l.qty,
        unitPrice: l.unitPrice,
        discountPercent: l.discountPct || "0",
        discountAmount: l.discountAmt || "0",
        total: l.total,
      })),
    });
  };

  const typeLabels: Record<InvoiceType, string> = {
    invoice: "فواتير المشتريات",
    return: "مردود المشتريات",
    order: "أوامر الشراء",
  };
  const typeColors: Record<InvoiceType, string> = {
    invoice: "text-primary", return: "text-amber-500", order: "text-blue-500",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className={`font-bold text-sm flex items-center gap-2 ${typeColors[invoiceType]}`}>
          <FileText className="w-4 h-4" />
          {typeLabels[invoiceType]}
        </h3>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setShowForm(true)}>
          <Plus className="w-3 h-3" /> جديد
        </Button>
      </div>

      {/* قائمة المستندات */}
      <Card className="border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs">رقم المستند</TableHead>
              <TableHead className="text-xs">التاريخ</TableHead>
              <TableHead className="text-xs">المورد</TableHead>
              <TableHead className="text-xs text-center">الإجمالي</TableHead>
              <TableHead className="text-xs text-center">الخصم</TableHead>
              <TableHead className="text-xs text-center">الصافي</TableHead>
              <TableHead className="text-xs text-center">الحالة</TableHead>
              <TableHead className="text-xs">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!listQuery.data || listQuery.data.length === 0) && (
              <TableRow><TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-8">
                لا توجد {typeLabels[invoiceType]}
              </TableCell></TableRow>
            )}
            {listQuery.data?.map(inv => (
              <TableRow key={inv.id} className="hover:bg-muted/10">
                <TableCell className="text-xs font-mono text-primary">{inv.invoiceNumber}</TableCell>
                <TableCell className="text-xs">{fmtDate(inv.invoiceDate)}</TableCell>
                <TableCell className="text-xs">{(inv as any).supplierName ?? "-"}</TableCell>
                <TableCell className="text-center text-xs font-semibold">{parseFloat(inv.subtotal ?? "0").toLocaleString()}</TableCell>
                <TableCell className="text-center text-xs text-amber-600">{parseFloat(inv.discountAmount ?? "0").toLocaleString()}</TableCell>
                <TableCell className="text-center text-xs font-bold text-primary">{parseFloat(inv.total ?? "0").toLocaleString()}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={inv.status === "confirmed" ? "default" : inv.status === "cancelled" ? "destructive" : "secondary"} className="text-xs">
                    {inv.status === "confirmed" ? "مؤكد" : inv.status === "cancelled" ? "ملغي" : "مسودة"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-6 text-xs"><Printer className="w-3 h-3" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* نافذة العمل: إضافة مستند */}
      {showForm && (
        <DesktopWorkWindow
          title={`إضافة ${typeLabels[invoiceType]}`}
          preset="wide"
          onClose={() => setShowForm(false)}
        >
          <div className="flex flex-col h-full overflow-hidden" dir="rtl">
          <Tabs defaultValue="main" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full grid grid-cols-2 shrink-0">
              <TabsTrigger value="main"    className="text-xs">نافذة رئيسية</TabsTrigger>
              <TabsTrigger value="receipt" className="text-xs">سندات استلام</TabsTrigger>
            </TabsList>

            <TabsContent value="main" className="flex-1 overflow-y-auto space-y-3 pt-3">
              {/* Header Fields - مطابق للصورة */}
              <Card className="border-border/60">
                <CardContent className="p-3">
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    <div>
                      <Label className="text-xs">فاتورة #</Label>
                      <Input value="AUTO" readOnly className="h-7 text-xs bg-muted/30" />
                    </div>
                    <div>
                      <Label className="text-xs">بناء على</Label>
                      <Input value={form.basedOn} onChange={e => setF("basedOn", e.target.value)} className="h-7 text-xs" placeholder="رقم أمر الشراء..." />
                    </div>
                    <div>
                      <Label className="text-xs">نوع السند</Label>
                      <Input value={typeLabels[invoiceType]} readOnly className="h-7 text-xs bg-muted/30" />
                    </div>
                    <div>
                      <Label className="text-xs">تاريخ التحرير</Label>
                      <DateSegmentInput value={form.invoiceDate} onChange={v => setF("invoiceDate", v)} standalone className="h-7 text-xs" />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    <div>
                      <Label className="text-xs">مورد</Label>
                      <Select value={form.supplierId} onValueChange={v => setF("supplierId", v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="اختر مورد..." /></SelectTrigger>
                        <SelectContent>
                          {suppliersQuery.data?.map(s => (
                            <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">عملة</Label>
                      <div className="flex gap-1">
                        <Input value={form.exchangeRate} onChange={e => setF("exchangeRate", e.target.value)} className="h-7 text-xs w-20" />
                        <Select value={form.currency} onValueChange={v => setF("currency", v)}>
                          <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SAR">SAR</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">تاريخ الدفع</Label>
                      <Input className="h-7 text-xs" placeholder="--" />
                    </div>
                    <div>
                      <Label className="text-xs">الكود التحليلي</Label>
                      <Input value={form.analyticCode} onChange={e => setF("analyticCode", e.target.value)} className="h-7 text-xs" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">ملحوظة</Label>
                    <Input value={form.notes} onChange={e => setF("notes", e.target.value)} className="h-7 text-xs" />
                  </div>
                </CardContent>
              </Card>

              {/* Lines Table - مطابق للصورة */}
              <div className="overflow-x-auto border border-border/60 rounded">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs w-8 text-center">#</TableHead>
                      <TableHead className="text-xs w-28">رقم الصنف</TableHead>
                      <TableHead className="text-xs">إسم الصنف</TableHead>
                      <TableHead className="text-xs w-20">وحدة</TableHead>
                      <TableHead className="text-xs w-20 text-center">كمية</TableHead>
                      <TableHead className="text-xs w-28 text-center">سعر الوحدة</TableHead>
                      <TableHead className="text-xs w-12 text-center">%</TableHead>
                      <TableHead className="text-xs w-24 text-center">تخفيض $</TableHead>
                      <TableHead className="text-xs w-28 text-center">القيمة</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, i) => (
                      <TableRow key={i} className="hover:bg-muted/5">
                        <TableCell className="text-center text-xs text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <ProductLookupCell
                            value={line.productName}
                            placeholder="كود أو اسم أو باركود..."
                            products={(productsQuery.data ?? []).map(p => ({
                              id: p.id,
                              name: p.name,
                              code: (p as any).sku ?? (p as any).code,
                              barcode: (p as any).barcode,
                              unit: (p as any).unit,
                              purchasePrice: (p as any).purchasePrice ?? (p as any).costPrice,
                            })) as ProductLookupOption[]}
                            onChange={value => setLines(prev => prev.map((l, idx) => idx === i
                              ? { ...l, productId: "", productName: value }
                              : l))}
                            onSelect={product => setLines(prev => prev.map((l, idx) => idx === i ? {
                              ...l,
                              productId: String(product.id),
                              productName: product.name,
                              unit: product.unit ?? l.unit,
                              unitPrice: product.purchasePrice ?? product.costPrice ?? l.unitPrice,
                            } : l))}
                            displayValue={product => product.name}
                            onInvalid={() => toast.error("الصنف غير موجود")}
                            onNavigate={() => {}}
                            className="h-7 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input value={line.productName} onChange={e => updateLine(i, "productName", e.target.value)} className="h-7 text-xs" />
                        </TableCell>
                        <TableCell>
                          <Input value={line.unit} onChange={e => updateLine(i, "unit", e.target.value)} className="h-7 text-xs" placeholder="قطعة" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={line.qty} onChange={e => updateLine(i, "qty", e.target.value)} className="h-7 text-xs text-center" min={0} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={line.unitPrice} onChange={e => updateLine(i, "unitPrice", e.target.value)} className="h-7 text-xs text-center" min={0} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={line.discountPct} onChange={e => updateLine(i, "discountPct", e.target.value)} className="h-7 text-xs text-center" min={0} max={100} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={line.discountAmt} onChange={e => updateLine(i, "discountAmt", e.target.value)} className="h-7 text-xs text-center" min={0} />
                        </TableCell>
                        <TableCell>
                          <Input value={line.total} readOnly className="h-7 text-xs text-center bg-muted/20 font-semibold" />
                        </TableCell>
                        <TableCell>
                          {lines.length > 1 && (
                            <button onClick={() => setLines(p => p.filter((_, idx) => idx !== i))} className="text-destructive">
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totals Footer - مطابق للصورة */}
              <div className="flex items-start justify-between gap-4">
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                  onClick={() => setLines(p => [...p, { productId: "", productName: "", unit: "", qty: "", unitPrice: "", discountPct: "", discountAmt: "", total: "" }])}>
                  <Plus className="w-3 h-3" /> إضافة صنف
                </Button>

                <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs border border-border/40 rounded p-3 bg-muted/10">
                  <div className="text-muted-foreground font-semibold">إجماليات</div>
                  <div className="text-muted-foreground font-semibold">إجماليات</div>

                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">إجمالي:</span>
                    <span className="font-bold">{totalAmount.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">مدفوع نقداً:</span>
                    <Input type="number" value={form.paidCash} onChange={e => setF("paidCash", e.target.value)} className="h-6 text-xs w-24 text-center" />
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">تخفيض {form.discountPercent}%:</span>
                    <span className="font-bold text-amber-600">{totalDiscount.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">دائن:</span>
                    <span className="font-bold">0.00</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">صافي:</span>
                    <span className="font-bold text-primary">{totalAmount.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">المجموع الإجمالي:</span>
                    <span className="font-bold text-primary">{totalAmount.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">الضريبة:</span>
                    <span className="font-bold">0.00</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="receipt" className="pt-3">
              <p className="text-xs text-muted-foreground text-center py-8">سندات الاستلام المرتبطة بهذا المستند</p>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 border-t border-border pt-3 px-3 pb-3 shrink-0">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1"><Printer className="w-3 h-3" /> طباعة</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowForm(false)}>إلغاء</Button>
            <Button size="sm" className="h-7 text-xs gap-1" disabled={createMutation.isPending} onClick={handleSave}>
              <Check className="w-3 h-3" /> حفظ
            </Button>
          </div>
          </div>
        </DesktopWorkWindow>
      )}
    </div>
  );
}

// ─── Reports ──────────────────────────────────────────────────────────────────
function ReportBySupplier() {
  const listQuery = trpc.purchases.list.useQuery();
  const suppliersQuery = trpc.suppliers.list.useQuery();

  const bySupplier = useMemo(() => {
    const map: Record<string, { name: string; count: number; total: number }> = {};
    listQuery.data?.forEach(inv => {
      const sid = inv.supplierId?.toString() ?? "0";
      const sup = suppliersQuery.data?.find(s => s.id === inv.supplierId);
      if (!map[sid]) map[sid] = { name: sup?.name ?? "غير محدد", count: 0, total: 0 };
      map[sid].count++;
      map[sid].total += parseFloat(inv.total ?? "0");
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [listQuery.data, suppliersQuery.data]);

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-sm flex items-center gap-2">
        <TrendingDown className="w-4 h-4 text-primary" /> مشتريات حسب المورد
      </h3>
      <Card className="border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs">المورد</TableHead>
              <TableHead className="text-xs text-center">عدد الفواتير</TableHead>
              <TableHead className="text-xs text-center">إجمالي المشتريات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bySupplier.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-8">لا توجد بيانات</TableCell></TableRow>
            )}
            {bySupplier.map(s => (
              <TableRow key={s.name} className="hover:bg-muted/10">
                <TableCell className="text-xs font-semibold">{s.name}</TableCell>
                <TableCell className="text-center text-xs">{s.count}</TableCell>
                <TableCell className="text-center text-sm font-bold text-primary">{s.total.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── Supplier Groups (مجموعات الموردين = دفاتر الموردين) ──────────────────────
function SupplierGroupsPage() {
  const listQuery = trpc.documentJournals.list.useQuery({ docType: "suppliers_journal" });
  const [search, setSearch] = useState("");

  const rows = (listQuery.data ?? []).filter(r =>
    !search ||
    r.name?.includes(search) ||
    r.code?.includes(search) ||
    (r.name2 ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" /> مجموعات الموردين
        </h3>
        <div className="relative">
          <Search className="absolute right-2 top-1.5 w-3 h-3 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-7 text-xs pr-7 w-52"
            placeholder="بحث..."
          />
        </div>
      </div>

      <Card className="border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs">كود الدفتر</TableHead>
              <TableHead className="text-xs">اسم المجموعة</TableHead>
              <TableHead className="text-xs">الاسم الإنجليزي</TableHead>
              <TableHead className="text-xs text-center">بادئة الترقيم</TableHead>
              <TableHead className="text-xs text-center">الرقم الحالي</TableHead>
              <TableHead className="text-xs text-center">الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                  جاري التحميل...
                </TableCell>
              </TableRow>
            )}
            {!listQuery.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                  لا توجد مجموعات موردين — أضف دفتراً جديداً من الإعدادات ← دفاتر المستندات
                </TableCell>
              </TableRow>
            )}
            {rows.map(r => (
              <TableRow key={r.id} className="hover:bg-muted/10">
                <TableCell className="text-xs font-mono font-semibold text-primary">{r.code}</TableCell>
                <TableCell className="text-xs font-semibold">{r.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.name2 ?? "—"}</TableCell>
                <TableCell className="text-center text-xs font-mono">{r.numberPrefix ?? "—"}</TableCell>
                <TableCell className="text-center text-xs">
                  {r.currentSeq > 0 ? r.currentSeq : "—"}
                </TableCell>
                <TableCell className="text-center">
                  <Badge
                    variant={r.isActive ? "default" : "secondary"}
                    className="text-[10px] h-4 px-1.5"
                  >
                    {r.isActive ? "نشط" : "موقف"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {rows.length > 0 && (
        <p className="text-[10px] text-muted-foreground text-left">
          لتعديل الدفاتر أو إضافة جديد: الإعدادات ← دفاتر المستندات ← دفتر الموردين
        </p>
      )}
    </div>
  );
}

// ─── Content Router ────────────────────────────────────────────────────────────
function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-center gap-2">
      <FileText className="w-10 h-10 text-muted-foreground/30" />
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className="text-xs text-muted-foreground/60">قريباً</p>
    </div>
  );
}

function PurchasesContent({ activeId, onSelect }: { activeId: MenuId; onSelect: (id: MenuId) => void }) {
  switch (activeId) {
    case "overview":           return <PurchasesOverview onSelect={onSelect} />;
    case "purchase-invoices":  return <PurchaseInvoicePage />;
    case "purchase-returns":   return <PurchaseReturnPage />;
    case "purchase-orders":    return <PurchaseOrderPage />;
    case "suppliers-list":     return <SupplierDirectoryPage />;
    case "supplier-groups":    return <SupplierGroupsPage />;
    case "supplier-balances":  return <ComingSoon label="أرصدة الموردين" />;
    case "supplier-statement": return <ComingSoon label="كشف حساب المورد" />;
    case "rpt-by-supplier":    return <ReportBySupplier />;
    case "rpt-totals":         return <ComingSoon label="تقارير إجماليات المشتريات" />;
    case "rpt-by-item":        return <ComingSoon label="تقارير أصناف المشتريات" />;
    default:                   return <PurchasesOverview onSelect={onSelect} />;
  }
}

// ─── Exported Sub-Page Wrappers (for MDI tab system) ──────────────────────────
export function PurchaseSuppliersPage() {
  return <div className="h-full overflow-auto p-5" dir="rtl"><SupplierDirectoryPage /></div>;
}
export function PurchaseSupplierGroupsPage() {
  return <div className="h-full overflow-auto p-5" dir="rtl"><SupplierGroupsPage /></div>;
}
export function PurchaseOrdersPage() {
  return <div className="h-full flex flex-col" dir="rtl" style={{ height: "100%" }}><PurchaseOrderPage /></div>;
}
export function PurchaseInvoicesPage() {
  return <div className="h-full flex flex-col" dir="rtl" style={{ height: "100%" }}><PurchaseInvoicePage /></div>;
}
export function PurchaseReturnsPage() {
  return <div className="h-full flex flex-col" dir="rtl" style={{ height: "100%" }}><PurchaseReturnPage /></div>;
}
export function PurchaseRptSupplierPage() {
  return <div className="h-full overflow-auto p-5" dir="rtl"><ReportBySupplier /></div>;
}
export function PurchaseRptItemPage() {
  return <div className="h-full overflow-auto p-5 text-xs text-muted-foreground" dir="rtl">تقرير المشتريات حسب الصنف — قريباً</div>;
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function PurchasesModule() {
  const [activeId, setActiveId] = useState<MenuId>("overview");
  return (
    <div className="flex h-full" dir="rtl">
      <PurchasesMenu activeId={activeId} onSelect={setActiveId} />
      <div className="flex-1 overflow-auto p-5">
        <PurchasesContent activeId={activeId} onSelect={setActiveId} />
      </div>
    </div>
  );
}
