import { useState } from "react";
import SalesInvoicePageNew from "./SalesInvoicePage";
import SalesQuotation from "./sales/SalesQuotation";
import { useTabManager } from "@/contexts/TabManagerContext";
import {
  ChevronDown, ChevronRight, TrendingUp, FileText, RotateCcw,
  BarChart3, Settings, Users, ClipboardList, ShoppingCart, Tag,
  DollarSign, Receipt, Clock, Wallet, Star, Plus, Search,
  Printer, CheckCircle, RefreshCw, ArrowRight, Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ─── Menu Structure ───────────────────────────────────────────────────────────

type MenuId = string;

const menuSections = [
  {
    id: "transactions",
    label: "المعاملات",
    icon: FileText,
    children: [
      { id: "sales-invoice",  label: "فاتورة مبيعات",     icon: Receipt,      path: "/sales/invoice" },
      { id: "sales-return",   label: "مردود المبيعات",     icon: RotateCcw,    path: "/sales/return" },
      { id: "credit-note",    label: "إشعار دائن",         icon: FileText,     path: "/sales/credit-note" },
      { id: "quotation",      label: "عرض سعر مبيعات",    icon: Tag,          path: "/sales/quotation" },
      { id: "sales-order",    label: "أمر بيع",            icon: ClipboardList,path: "/sales/order" },
      { id: "delivery-order", label: "أمر تسليم مبيعات",  icon: ArrowRight,   path: "/sales/delivery" },
    ],
  },
  {
    id: "pos",
    label: "نقطة بيع",
    icon: ShoppingCart,
    children: [
      { id: "pos-screen",      label: "شاشة البيع",   icon: ShoppingCart, path: "/sales/pos" },
      { id: "shifts",          label: "الورديات",      icon: Clock,        path: "/sales/shifts" },
      { id: "payment-methods", label: "طرق السداد",    icon: Wallet,       path: "/sales/payment-methods" },
      { id: "pos-settings",    label: "إعدادات POS",   icon: Star,         path: "/sales/pos-settings" },
      { id: "pos-reports",     label: "تقارير POS",    icon: BarChart3,    path: "/sales/pos-reports" },
    ],
  },
  {
    id: "customers",
    label: "العملاء",
    icon: Users,
    children: [
      { id: "add-customer",       label: "دليل العملاء",        icon: Users,       path: "/sales/customers" },
      { id: "customer-groups",    label: "مجموعات العملاء",     icon: Users,       path: "/sales/customer-groups" },
      { id: "customer-balances",  label: "أرصدة العملاء",       icon: DollarSign,  path: "/sales/customer-balances" },
      { id: "customer-statement", label: "كشف حساب عميل",       icon: FileText,    path: "/sales/customer-statement" },
    ],
  },
  {
    id: "reports",
    label: "التقارير",
    icon: BarChart3,
    children: [
      { id: "customer-reports",      label: "تقارير العملاء",              icon: Users,     path: "/sales/customer-reports" },
      { id: "sales-totals-reports",  label: "تقارير إجماليات المبيعات",    icon: TrendingUp,path: "/sales/totals-reports" },
      { id: "sales-items-reports",   label: "تقارير أصناف المبيعات",       icon: BarChart3, path: "/sales/items-reports" },
    ],
  },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function SalesMenu({ activeId, onSelect }: { activeId: MenuId; onSelect: (id: MenuId) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    transactions: true, pos: false, customers: false, reports: false,
  });
  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  return (
    <nav className="w-56 shrink-0 border-l border-border bg-card/50 overflow-y-auto flex flex-col">
      <div className="p-3 border-b border-border">
        <button
          onClick={() => onSelect("overview")}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-bold transition-colors ${activeId === "overview" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent/30"}`}
        >
          <TrendingUp className="w-4 h-4 text-primary" />
          المبيعات
        </button>
      </div>
      <div className="py-2 flex-1">
        {menuSections.map(section => (
          <div key={section.id}>
            <button
              onClick={() => toggle(section.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors uppercase tracking-wide"
            >
              <section.icon className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1 text-right">{section.label}</span>
              {expanded[section.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {expanded[section.id] && (
              <div className="mr-3 border-r border-border/40 mb-1">
                {section.children.map(child => (
                    <button
                      key={child.id}
                      onClick={() => onSelect(child.id)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                        activeId === child.id
                          ? "bg-primary/10 text-primary font-semibold border-r-2 border-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/20"
                      }`}
                    >
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

function SalesOverview({ onSelect }: { onSelect: (id: MenuId) => void }) {
  const stats = [
    { label: "مبيعات اليوم",    value: "12,450", change: "+8%",  color: "text-emerald-500", icon: TrendingUp },
    { label: "عدد الفواتير",    value: "47",      change: "+12%", color: "text-blue-500",    icon: Receipt },
    { label: "العملاء الجدد",   value: "5",       change: "+2",   color: "text-purple-500",  icon: Users },
    { label: "متوسط الفاتورة",  value: "264.9",   change: "-3%",  color: "text-amber-500",   icon: DollarSign },
  ];
  const salesData = [
    { day: "السبت",    sales: 8200 }, { day: "الأحد",   sales: 9400 },
    { day: "الاثنين", sales: 11000 }, { day: "الثلاثاء", sales: 9800 },
    { day: "الأربعاء",sales: 12450 }, { day: "الخميس",  sales: 10600 },
    { day: "الجمعة",  sales: 7300 },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <s.icon className={`w-5 h-5 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.change}</span>
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">مبيعات الأسبوع الحالي</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
              <Bar dataKey="sales" fill="hsl(var(--primary))" name="المبيعات" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {menuSections.map(group => (
          <Card key={group.id} className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer">
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
                  <ArrowRight className="w-2.5 h-2.5 shrink-0" />
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

// ─── Sales Invoice ─────────────────────────────────────────────────────────────

function SalesInvoicePage() {
  const [items, setItems] = useState<{ id: number; name: string; qty: number; price: number; discount: number }[]>([]);
  const [search, setSearch] = useState("");
  const { data: products } = trpc.products.list.useQuery({ search });

  const addItem = (p: any) => {
    setItems(prev => {
      const ex = prev.find(i => i.id === p.id);
      if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: p.id, name: p.name, qty: 1, price: Number(p.salePrice), discount: 0 }];
    });
    setSearch("");
  };

  const subtotal = items.reduce((s, i) => s + i.qty * i.price * (1 - i.discount / 100), 0);
  const tax = subtotal * 0.15;
  const total = subtotal + tax;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" /> فاتورة مبيعات جديدة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">رقم الفاتورة</Label>
                <Input defaultValue="INV-2026-0001" className="h-8 text-sm" readOnly />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">التاريخ</Label>
                <Input type="date" defaultValue={new Date().toISOString().split("T")[0]} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">العميل</Label>
                <Select>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="اختر عميل" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walk-in">عميل نقدي</SelectItem>
                    <SelectItem value="1">أحمد محمد</SelectItem>
                    <SelectItem value="2">شركة النور</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">طريقة الدفع</Label>
                <Select defaultValue="cash">
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">نقدي</SelectItem>
                    <SelectItem value="card">بطاقة</SelectItem>
                    <SelectItem value="transfer">تحويل</SelectItem>
                    <SelectItem value="credit">آجل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute right-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="بحث عن صنف بالاسم أو الباركود..." value={search}
                onChange={e => setSearch(e.target.value)} className="h-8 text-sm pr-8" />
            </div>
            {search && products && products.length > 0 && (
              <div className="border border-border rounded-lg max-h-36 overflow-y-auto bg-card shadow-lg">
                {products.map((p: any) => (
                  <button key={p.id} onClick={() => addItem(p)}
                    className="w-full text-right px-3 py-2 text-sm hover:bg-accent/50 flex justify-between items-center border-b border-border/30 last:border-0">
                    <span className="text-foreground">{p.name}</span>
                    <span className="text-primary font-medium">{Number(p.salePrice).toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">الصنف</TableHead>
                <TableHead className="text-xs text-center w-20">الكمية</TableHead>
                <TableHead className="text-xs text-center w-24">السعر</TableHead>
                <TableHead className="text-xs text-center w-20">خصم%</TableHead>
                <TableHead className="text-xs text-center w-24">الإجمالي</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-8">ابحث وأضف أصناف للفاتورة</TableCell></TableRow>
              )}
              {items.map((item, i) => (
                <TableRow key={item.id}>
                  <TableCell className="text-sm font-medium">{item.name}</TableCell>
                  <TableCell className="text-center">
                    <Input type="number" value={item.qty} min={1}
                      onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, qty: +e.target.value } : it))}
                      className="h-7 w-16 text-center text-sm mx-auto" />
                  </TableCell>
                  <TableCell className="text-center text-sm">{item.price.toFixed(2)}</TableCell>
                  <TableCell className="text-center">
                    <Input type="number" value={item.discount} min={0} max={100}
                      onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, discount: +e.target.value } : it))}
                      className="h-7 w-16 text-center text-sm mx-auto" />
                  </TableCell>
                  <TableCell className="text-center text-primary font-semibold text-sm">
                    {(item.qty * item.price * (1 - item.discount / 100)).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <button onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-destructive hover:text-destructive/70 text-xs">حذف</button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">ملخص الفاتورة</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">المجموع</span><span>{subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">الضريبة (15%)</span><span>{tax.toFixed(2)}</span></div>
            <div className="border-t border-border pt-2 flex justify-between font-bold">
              <span>الإجمالي</span>
              <span className="text-primary text-lg">{total.toFixed(2)}</span>
            </div>
            <Button className="w-full h-9" onClick={() => toast.success("تم حفظ الفاتورة بنجاح")}>
              <CheckCircle className="w-4 h-4 ml-2" /> حفظ الفاتورة
            </Button>
            <Button variant="outline" className="w-full h-9" onClick={() => toast.info("جاري الطباعة...")}>
              <Printer className="w-4 h-4 ml-2" /> طباعة
            </Button>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">ملاحظات</CardTitle></CardHeader>
          <CardContent>
            <Textarea placeholder="ملاحظات الفاتورة..." className="resize-none h-20 text-sm" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Customers Page ────────────────────────────────────────────────────────────

function CustomersPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { data: customers, refetch } = trpc.customers.list.useQuery({ search });
  const createMutation = trpc.customers.create.useMutation({
    onSuccess: () => { toast.success("تم إضافة العميل"); setOpen(false); refetch(); }
  });
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder="بحث عن عميل..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9 h-9" />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-9 text-sm"><Plus className="w-4 h-4 ml-1" /> إضافة عميل</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>إضافة عميل جديد</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {[["name","الاسم"],["phone","الهاتف"],["email","البريد الإلكتروني"],["address","العنوان"]].map(([k,l]) => (
                <div key={k}>
                  <Label className="text-xs text-muted-foreground">{l}</Label>
                  <Input value={(form as any)[k]} onChange={e => setForm(p => ({...p,[k]:e.target.value}))} className="h-8 text-sm" />
                </div>
              ))}
              <Button className="w-full" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>حفظ</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">الاسم</TableHead>
              <TableHead className="text-xs">الهاتف</TableHead>
              <TableHead className="text-xs">البريد</TableHead>
              <TableHead className="text-xs text-center">الرصيد</TableHead>
              <TableHead className="text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers?.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="text-sm font-medium">{c.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.phone || "-"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.email || "-"}</TableCell>
                <TableCell className="text-center">
                  <span className={`text-sm font-semibold ${Number(c.balance) >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                    {Number(c.balance || 0).toFixed(2)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <button className="text-primary hover:text-primary/70 text-xs">تعديل</button>
                    <button className="text-muted-foreground hover:text-foreground text-xs">كشف حساب</button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!customers?.length && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا يوجد عملاء</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── Shifts Page ───────────────────────────────────────────────────────────────

function ShiftsPage() {
  const shifts = [
    { id: 1, name: "الوردية الصباحية", start: "08:00", end: "16:00", cashier: "أحمد محمد", status: "مغلقة", sales: 12500 },
    { id: 2, name: "الوردية المسائية", start: "16:00", end: "00:00", cashier: "محمد علي", status: "مفتوحة", sales: 8300 },
  ];
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">إدارة الورديات</h3>
        <Button className="h-8 text-sm" onClick={() => toast.success("تم فتح وردية جديدة")}>
          <Plus className="w-4 h-4 ml-1" /> فتح وردية
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {shifts.map(s => (
          <Card key={s.id} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold text-sm">{s.name}</p>
                  <p className="text-muted-foreground text-xs">{s.cashier}</p>
                </div>
                <Badge variant={s.status === "مفتوحة" ? "default" : "secondary"}>{s.status}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[["البداية", s.start], ["النهاية", s.end], ["المبيعات", s.sales.toLocaleString()]].map(([l, v]) => (
                  <div key={l} className="bg-muted/30 rounded p-2">
                    <p className="text-muted-foreground text-xs">{l}</p>
                    <p className="font-semibold text-sm">{v}</p>
                  </div>
                ))}
              </div>
              {s.status === "مفتوحة" && (
                <Button variant="destructive" className="w-full mt-3 h-8 text-sm" onClick={() => toast.success("تم إغلاق الوردية")}>
                  إغلاق الوردية
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Payment Methods ───────────────────────────────────────────────────────────

function PaymentMethodsPage() {
  const [methods, setMethods] = useState([
    { name: "نقدي",          icon: "💵", active: true  },
    { name: "بطاقة ائتمان",  icon: "💳", active: true  },
    { name: "تحويل بنكي",    icon: "🏦", active: true  },
    { name: "آجل",           icon: "📋", active: true  },
    { name: "شيك",           icon: "📄", active: false },
  ]);
  const toggle = (name: string) => setMethods(prev => prev.map(m => m.name === name ? { ...m, active: !m.active } : m));
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm">طرق السداد المتاحة</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {methods.map(m => (
          <Card key={m.name} className={`border-border/50 ${!m.active ? "opacity-60" : ""}`}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{m.icon}</span>
                <p className="font-medium text-sm">{m.name}</p>
              </div>
              <button
                onClick={() => toggle(m.name)}
                className={`w-10 h-5 rounded-full transition-colors relative ${m.active ? "bg-primary" : "bg-muted"}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${m.active ? "right-0.5" : "left-0.5"}`} />
              </button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Sales Totals Report ───────────────────────────────────────────────────────

function SalesTotalsReports() {
  const salesData = [
    { month: "يناير", sales: 45000, returns: 2000 },
    { month: "فبراير", sales: 52000, returns: 1500 },
    { month: "مارس",   sales: 48000, returns: 3000 },
    { month: "أبريل",  sales: 61000, returns: 2500 },
    { month: "مايو",   sales: 55000, returns: 1800 },
    { month: "يونيو",  sales: 67000, returns: 2200 },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "إجمالي المبيعات",  value: "328,000", color: "text-emerald-500" },
          { label: "إجمالي المرتجعات", value: "13,000",  color: "text-destructive" },
          { label: "صافي المبيعات",    value: "315,000", color: "text-primary" },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-muted-foreground text-xs mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-border/50">
        <CardHeader><CardTitle className="text-sm">مبيعات ومرتجعات الأشهر الستة الأخيرة</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
              <Bar dataKey="sales"   fill="hsl(var(--primary))"  name="المبيعات"    radius={[4,4,0,0]} />
              <Bar dataKey="returns" fill="hsl(var(--destructive))" name="المرتجعات" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Coming Soon ───────────────────────────────────────────────────────────────

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
      <TrendingUp className="w-14 h-14 opacity-10" />
      <p className="text-lg font-bold text-foreground">{title}</p>
      <p className="text-sm">هذه الشاشة قيد التطوير</p>
      <Badge variant="outline" className="mt-1">قريباً</Badge>
    </div>
  );
}

// ─── Delivery Order ──────────────────────────────────────────────────────────

function DeliveryOrderPage() {
  const [items, setItems] = useState<{ id: number; name: string; orderedQty: number; deliveredQty: number; unit: string }[]>([
    { id: 1, name: "لابتوب Dell XPS 15",     orderedQty: 5,  deliveredQty: 5,  unit: "قطعة" },
    { id: 2, name: "سماعات Sony WH-1000XM5", orderedQty: 10, deliveredQty: 8,  unit: "قطعة" },
    { id: 3, name: "ماوس لاسلكي",            orderedQty: 20, deliveredQty: 20, unit: "قطعة" },
  ]);
  const [status, setStatus] = useState("pending");

  const statusOptions = [
    { value: "pending",   label: "معلق",        color: "bg-amber-100 text-amber-700" },
    { value: "partial",   label: "جزئي",        color: "bg-blue-100 text-blue-700" },
    { value: "delivered", label: "مُسلَّم",      color: "bg-emerald-100 text-emerald-700" },
    { value: "cancelled", label: "ملغي",        color: "bg-red-100 text-red-700" },
  ];
  const currentStatus = statusOptions.find(s => s.value === status)!;

  const deliveryOrders = [
    { id: "DO-2026-001", date: "2026-05-06", customer: "شركة النور للتجارة",   order: "SO-2026-012", status: "delivered", total: 12450 },
    { id: "DO-2026-002", date: "2026-05-07", customer: "مؤسسة الأمل",          order: "SO-2026-015", status: "partial",   total: 8200 },
    { id: "DO-2026-003", date: "2026-05-07", customer: "أحمد محمد علي",        order: "SO-2026-018", status: "pending",   total: 3600 },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">أوامر تسليم المبيعات</h2>
          <p className="text-xs text-muted-foreground mt-0.5">إدارة وتتبع عمليات تسليم البضاعة للعملاء</p>
        </div>
        <Button size="sm" className="gap-1.5 text-xs h-8">
          <Plus className="w-3.5 h-3.5" /> أمر تسليم جديد
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "إجمالي أوامر التسليم", value: "24",  color: "text-blue-500",    bg: "bg-blue-50" },
          { label: "مُسلَّمة اليوم",        value: "8",   color: "text-emerald-500", bg: "bg-emerald-50" },
          { label: "تسليم جزئي",           value: "5",   color: "text-amber-500",   bg: "bg-amber-50" },
          { label: "معلقة",                value: "11",  color: "text-red-500",     bg: "bg-red-50" },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New Delivery Order Form */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-primary" /> إنشاء أمر تسليم جديد
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">رقم أمر التسليم</Label>
              <Input defaultValue="DO-2026-004" className="h-8 text-sm" readOnly />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">التاريخ</Label>
              <Input type="date" defaultValue={new Date().toISOString().split("T")[0]} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">أمر البيع المرتبط</Label>
              <Select defaultValue="SO-2026-020">
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SO-2026-020">SO-2026-020</SelectItem>
                  <SelectItem value="SO-2026-019">SO-2026-019</SelectItem>
                  <SelectItem value="SO-2026-018">SO-2026-018</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">العميل</Label>
              <Select defaultValue="1">
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">شركة النور للتجارة</SelectItem>
                  <SelectItem value="2">مؤسسة الأمل</SelectItem>
                  <SelectItem value="3">أحمد محمد علي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">المخزن</Label>
              <Select defaultValue="main">
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">المخزن الرئيسي</SelectItem>
                  <SelectItem value="branch">مخزن الفرع</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">الحالة</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-2">
              <Label className="text-xs text-muted-foreground">عنوان التسليم</Label>
              <Input placeholder="عنوان التسليم..." className="h-8 text-sm" />
            </div>
          </div>

          {/* Items Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">الصنف</TableHead>
                <TableHead className="text-xs text-center w-24">الكمية المطلوبة</TableHead>
                <TableHead className="text-xs text-center w-24">الكمية المُسلَّمة</TableHead>
                <TableHead className="text-xs text-center w-20">الوحدة</TableHead>
                <TableHead className="text-xs text-center w-24">الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, i) => {
                const pct = Math.round((item.deliveredQty / item.orderedQty) * 100);
                return (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm font-medium">{item.name}</TableCell>
                    <TableCell className="text-center text-sm">{item.orderedQty}</TableCell>
                    <TableCell className="text-center">
                      <Input type="number" value={item.deliveredQty} min={0} max={item.orderedQty}
                        onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, deliveredQty: Math.min(+e.target.value, it.orderedQty) } : it))}
                        className="h-7 w-20 text-center text-sm mx-auto" />
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">{item.unit}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`text-xs ${
                        pct === 100 ? "border-emerald-300 text-emerald-700 bg-emerald-50" :
                        pct > 0    ? "border-amber-300 text-amber-700 bg-amber-50" :
                                     "border-red-300 text-red-700 bg-red-50"
                      }`}>
                        {pct === 100 ? "مكتمل" : pct > 0 ? `${pct}%` : "لم يُسلَّم"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${currentStatus.color}`}>{currentStatus.label}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                <Printer className="w-3.5 h-3.5" /> طباعة
              </Button>
              <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => toast.success("تم حفظ أمر التسليم بنجاح")}>
                <CheckCircle className="w-3.5 h-3.5" /> حفظ أمر التسليم
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">قائمة أوامر التسليم</CardTitle>
            <div className="flex gap-2">
              <Input placeholder="بحث..." className="h-7 text-xs w-36" />
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                <Filter className="w-3 h-3" /> فلتر
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">رقم الأمر</TableHead>
                <TableHead className="text-xs">التاريخ</TableHead>
                <TableHead className="text-xs">العميل</TableHead>
                <TableHead className="text-xs">أمر البيع</TableHead>
                <TableHead className="text-xs text-center">الحالة</TableHead>
                <TableHead className="text-xs text-center">الإجمالي</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveryOrders.map(o => {
                const st = statusOptions.find(s => s.value === o.status)!;
                return (
                  <TableRow key={o.id} className="hover:bg-accent/20">
                    <TableCell className="text-sm font-mono font-medium text-primary">{o.id}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{o.date}</TableCell>
                    <TableCell className="text-sm">{o.customer}</TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">{o.order}</TableCell>
                    <TableCell className="text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                    </TableCell>
                    <TableCell className="text-center text-sm font-semibold text-primary">
                      {o.total.toLocaleString("ar-SA")} ر.س
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" className="h-6 text-xs px-2">عرض</Button>
                        <Button variant="ghost" size="sm" className="h-6 text-xs px-2">
                          <Printer className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Content Router ────────────────────────────────────────────────────────────

function SalesContent({ activeId, onSelect }: { activeId: MenuId; onSelect: (id: MenuId) => void }) {
  switch (activeId) {
    case "overview":              return <SalesOverview onSelect={onSelect} />;
    case "sales-invoice":         return <SalesInvoicePageNew />;
    case "sales-return":          return <ComingSoon title="مردود المبيعات" />;
    case "credit-note":           return <ComingSoon title="إشعار دائن" />;
    case "quotation":             return <SalesQuotation />;
    case "sales-order":           return <ComingSoon title="أمر بيع" />;
    case "delivery-order":        return <DeliveryOrderPage />;
    case "pos-screen":            return <ComingSoon title="شاشة البيع" />;
    case "shifts":                return <ShiftsPage />;
    case "payment-methods":       return <PaymentMethodsPage />;
    case "pos-settings":          return <ComingSoon title="إعدادات POS" />;
    case "pos-reports":           return <ComingSoon title="تقارير POS" />;
    case "add-customer":
    case "customer-groups":
    case "customer-balances":
    case "customer-statement":    return <CustomersPage />;
    case "customer-reports":      return <ComingSoon title="تقارير العملاء" />;
    case "sales-totals-reports":  return <SalesTotalsReports />;
    case "sales-items-reports":   return <ComingSoon title="تقارير أصناف المبيعات" />;
    default:                      return <SalesOverview onSelect={onSelect} />;
  }
}

// ─── Exported Sub-Page Wrappers (for MDI tab system) ──────────────────────────
export function SalesInvoiceTab()       { return <div className="h-full overflow-auto p-5" dir="rtl"><SalesInvoicePageNew /></div>; }
export function SalesReturnTab()        { return <div className="h-full overflow-auto p-5" dir="rtl"><ComingSoon title="مردود المبيعات" /></div>; }
export function SalesCreditNoteTab()    { return <div className="h-full overflow-auto p-5" dir="rtl"><ComingSoon title="إشعار دائن" /></div>; }
export function SalesQuotationTab()     { return <div className="h-full overflow-auto p-5" dir="rtl"><SalesQuotation /></div>; }
export function SalesOrderTab()         { return <div className="h-full overflow-auto p-5" dir="rtl"><ComingSoon title="أمر بيع" /></div>; }
export function SalesDeliveryTab()      { return <div className="h-full overflow-auto p-5" dir="rtl"><DeliveryOrderPage /></div>; }
export function SalesPosTab()           { return <div className="h-full overflow-auto p-5" dir="rtl"><ComingSoon title="شاشة البيع" /></div>; }
export function SalesShiftsTab()        { return <div className="h-full overflow-auto p-5" dir="rtl"><ShiftsPage /></div>; }
export function SalesPaymentMethodsTab(){ return <div className="h-full overflow-auto p-5" dir="rtl"><PaymentMethodsPage /></div>; }
export function SalesPosSettingsTab()   { return <div className="h-full overflow-auto p-5" dir="rtl"><ComingSoon title="إعدادات POS" /></div>; }
export function SalesPosReportsTab()    { return <div className="h-full overflow-auto p-5" dir="rtl"><ComingSoon title="تقارير POS" /></div>; }
export function SalesCustomersTab()     { return <div className="h-full overflow-auto p-5" dir="rtl"><CustomersPage /></div>; }
export function SalesCustomerGroupsTab()    { return <div className="h-full overflow-auto p-5" dir="rtl"><ComingSoon title="مجموعات العملاء" /></div>; }
export function SalesCustomerBalancesTab()  { return <div className="h-full overflow-auto p-5" dir="rtl"><ComingSoon title="أرصدة العملاء" /></div>; }
export function SalesCustomerStatementTab() { return <div className="h-full overflow-auto p-5" dir="rtl"><ComingSoon title="كشف حساب عميل" /></div>; }
export function SalesCustomerReportsTab()   { return <div className="h-full overflow-auto p-5" dir="rtl"><ComingSoon title="تقارير العملاء" /></div>; }
export function SalesTotalsReportsTab() { return <div className="h-full overflow-auto p-5" dir="rtl"><SalesTotalsReports /></div>; }
export function SalesItemsReportsTab()  { return <div className="h-full overflow-auto p-5" dir="rtl"><ComingSoon title="تقارير أصناف المبيعات" /></div>; }

// ─── Root ──────────────────────────────────────────────────────────────────────

export default function SalesModule() {
  const [activeId, setActiveId] = useState<MenuId>("overview");
  return (
    <div className="flex h-full" dir="rtl">
      <SalesMenu activeId={activeId} onSelect={setActiveId} />
      <div className="flex-1 overflow-auto p-5">
        <SalesContent activeId={activeId} onSelect={setActiveId} />
      </div>
    </div>
  );
}
