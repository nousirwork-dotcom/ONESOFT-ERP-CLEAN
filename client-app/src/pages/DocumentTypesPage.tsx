import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { BookOpen, BookMarked, RotateCcw, ClipboardList, ArrowLeftRight, Tag } from "lucide-react";

type DoctypeData = {
  nameAr: string; nameEn: string; docType: string; codeEn: string; codeAr: string;
  userGroup: string; user: string; warehouse: string; journal: string;
  systemOnly: boolean; entryType: string; entryJournal: string;
  stockDocType: string; stockJournal: string; printTemplate: string; printTemplate2: string;
  trackQty: boolean; noTax: boolean; sellerStats: boolean; itemStats: boolean; customerStats: boolean;
};
const EMPTY_DOCTYPE: DoctypeData = {
  nameAr: "", nameEn: "", docType: "", codeEn: "", codeAr: "",
  userGroup: "", user: "", warehouse: "", journal: "", systemOnly: false,
  entryType: "", entryJournal: "", stockDocType: "", stockJournal: "",
  printTemplate: "", printTemplate2: "", trackQty: false, noTax: false,
  sellerStats: false, itemStats: false, customerStats: false,
};

const FI = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    className="h-7 text-[11px] px-2 border-slate-200 focus:border-indigo-400 focus-visible:ring-0 focus-visible:ring-offset-0 bg-white rounded" />
);
const FS = ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) => (
  <Select value={value} onValueChange={onValueChange}>
    <SelectTrigger className="h-7 text-[11px] px-2 border-slate-200 focus:ring-0 focus:ring-offset-0 bg-white rounded">
      <SelectValue placeholder="— اختر —" />
    </SelectTrigger>
    <SelectContent>{children}</SelectContent>
  </Select>
);
const P = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="overflow-hidden" style={{ border: "1px solid #d1d5db", borderRadius: 4 }}>
    <div className="px-2.5 py-1" style={{ background: "#e8edf5", borderBottom: "1px solid #d1d5db" }}>
      <span className="font-bold text-slate-700 text-[11px]">{title}</span>
    </div>
    <div className="px-3 py-2" style={{ background: "#fff" }}>{children}</div>
  </div>
);
const R = ({ label, lw = 88, children }: { label: string; lw?: number; children: React.ReactNode }) => (
  <div className="flex items-center gap-1 min-w-0">
    <span className="text-[11px] text-slate-600 shrink-0" style={{ width: lw }}>{label}</span>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);

const DTYPE_ITEMS = [
  { id: "sales",            label: "أنواع مستند فاتورة المبيعات",    icon: <BookOpen className="w-3.5 h-3.5" /> },
  { id: "sales-return",     label: "أنواع مستند مردود المبيعات",     icon: <RotateCcw className="w-3.5 h-3.5" /> },
  { id: "purchases",        label: "أنواع مستند فاتورة المشتريات",   icon: <BookMarked className="w-3.5 h-3.5" /> },
  { id: "purchases-return", label: "أنواع مستند مردود المشتريات",    icon: <RotateCcw className="w-3.5 h-3.5" /> },
  { id: "sales-order",      label: "أنواع مستند أمر البيع",          icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { id: "sales-quote",      label: "أنواع مستند عرض أسعار مبيعات",  icon: <Tag className="w-3.5 h-3.5" /> },
  { id: "purch-quote",      label: "أنواع مستند عرض أسعار مشتريات", icon: <Tag className="w-3.5 h-3.5" /> },
  { id: "purchase-order",   label: "أنواع مستند أمر شراء",           icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { id: "transfer",         label: "أنواع مستند سند تحويل داخلي",    icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
];

export default function DocumentTypesPage() {
  const [selectedItem, setSelectedItem] = useState("sales");
  const [doctypeData, setDoctypeData] = useState<Record<string, DoctypeData>>({});

  const { data: warehousesList } = trpc.warehouses.list.useQuery();
  const { data: userGroupsList }  = trpc.userGroups.list.useQuery();
  const { data: users }           = trpc.users.list.useQuery();

  const getDoctype = (id: string): DoctypeData => doctypeData[id] ?? { ...EMPTY_DOCTYPE };
  const setDoctype = (id: string, patch: Partial<DoctypeData>) =>
    setDoctypeData(p => ({ ...p, [id]: { ...(p[id] ?? EMPTY_DOCTYPE), ...patch } }));

  const currentLabel = DTYPE_ITEMS.find(i => i.id === selectedItem)?.label ?? "";
  const dd = getDoctype(selectedItem);

  return (
    <div className="flex gap-3 h-full" dir="rtl">
      {/* Sidebar */}
      <div className="shrink-0 flex flex-col overflow-hidden" style={{ width: 210, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
        <div className="px-3 pt-2.5 pb-2 shrink-0" style={{ borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">الأنواع</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {DTYPE_ITEMS.map(item => {
            const active = selectedItem === item.id;
            return (
              <button key={item.id} onClick={() => setSelectedItem(item.id)}
                className="w-full flex items-center gap-1.5 px-3 py-1.5 text-right transition-colors"
                style={{ background: active ? "#dbeafe" : "transparent", color: active ? "#1d4ed8" : "#64748b", borderRight: active ? "2px solid #3b82f6" : "2px solid transparent" }}
              >
                <span style={{ color: active ? "#3b82f6" : "#94a3b8", flexShrink: 0 }}>{item.icon}</span>
                <span className="text-[12px] truncate flex-1">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-y-auto space-y-2 pb-4">
        <div className="flex items-center justify-between py-0.5">
          <span className="text-[12px] font-bold text-indigo-700">{currentLabel}</span>
        </div>

        <P title="بيانات نوع المستند">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <R label="نوع المستند">
              <FS value={dd.docType} onValueChange={v => setDoctype(selectedItem, { docType: v })}>
                <SelectItem value="sales">فاتورة مبيعات</SelectItem>
                <SelectItem value="purchase">فاتورة مشتريات</SelectItem>
                <SelectItem value="return-s">مردود مبيعات</SelectItem>
                <SelectItem value="return-p">مردود مشتريات</SelectItem>
              </FS>
            </R>
            <div className="grid grid-cols-2 gap-x-2">
              <R label="كود إنجليزي" lw={64}>
                <FI value={dd.codeEn} onChange={v => setDoctype(selectedItem, { codeEn: v })} placeholder="CASH" />
              </R>
              <R label="كود عربي" lw={56}>
                <FI value={dd.codeAr} onChange={v => setDoctype(selectedItem, { codeAr: v })} placeholder="نقدا" />
              </R>
            </div>
            <R label="إسم عربي">
              <FI value={dd.nameAr} onChange={v => setDoctype(selectedItem, { nameAr: v })} placeholder="مبيعات نقدية فرع 1" />
            </R>
            <R label="إسم إنجليزي">
              <FI value={dd.nameEn} onChange={v => setDoctype(selectedItem, { nameEn: v })} placeholder="Cash Invoice Br. 1" />
            </R>
          </div>
        </P>

        <P title="حدود الاستخدام">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <R label="مجموعة مستخدمين">
              <FS value={dd.userGroup} onValueChange={v => setDoctype(selectedItem, { userGroup: v })}>
                <SelectItem value="all">الكل</SelectItem>
                {(userGroupsList ?? []).map(g => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
              </FS>
            </R>
            <R label="مستخدم">
              <FS value={dd.user} onValueChange={v => setDoctype(selectedItem, { user: v })}>
                <SelectItem value="all">الكل</SelectItem>
                {(users as any[])?.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
              </FS>
            </R>
            <R label="دفتر المستندات">
              <FI value={dd.journal} onChange={v => setDoctype(selectedItem, { journal: v })} placeholder="SAA" />
            </R>
            <R label="مخزن">
              <FS value={dd.warehouse} onValueChange={v => setDoctype(selectedItem, { warehouse: v })}>
                <SelectItem value="all">الكل</SelectItem>
                {(warehousesList as any[])?.map((w: any) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
              </FS>
            </R>
          </div>
          <div className="mt-1.5">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600"
                checked={dd.systemOnly}
                onChange={e => setDoctype(selectedItem, { systemOnly: e.target.checked })} />
              <span className="text-[11px] text-slate-600">للمستندات التي يصدرها النظام فقط</span>
            </label>
          </div>
        </P>

        <P title="خصائص السندات المصدرة">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <R label="نوع القيد">
              <FS value={dd.entryType} onValueChange={v => setDoctype(selectedItem, { entryType: v })}>
                <SelectItem value="sales">مبيعات</SelectItem>
                <SelectItem value="purchase">مشتريات</SelectItem>
                <SelectItem value="receipt">قبض</SelectItem>
                <SelectItem value="payment">صرف</SelectItem>
              </FS>
            </R>
            <R label="دفتر القيد">
              <FI value={dd.entryJournal} onChange={v => setDoctype(selectedItem, { entryJournal: v })} placeholder="SJ3" />
            </R>
            <R label="نوع مستند المخزون">
              <FS value={dd.stockDocType} onValueChange={v => setDoctype(selectedItem, { stockDocType: v })}>
                <SelectItem value="sales">مبيعات</SelectItem>
                <SelectItem value="purchase">مشتريات</SelectItem>
                <SelectItem value="transfer">تحويل</SelectItem>
              </FS>
            </R>
            <R label="دفتر مستند المخزون">
              <FI value={dd.stockJournal} onChange={v => setDoctype(selectedItem, { stockJournal: v })} placeholder="SI3" />
            </R>
          </div>
        </P>

        <P title="خيارات المستند">
          <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
            <R label="نموذج الطباعة">
              <FI value={dd.printTemplate} onChange={v => setDoctype(selectedItem, { printTemplate: v })} placeholder="نموذج A4" />
            </R>
            <R label="نموذج طباعة حراري">
              <FI value={dd.printTemplate2} onChange={v => setDoctype(selectedItem, { printTemplate2: v })} placeholder="80mm" />
            </R>
            <div className="flex flex-wrap gap-x-3 gap-y-1 items-center pt-0.5">
              {([
                ["trackQty",      "متابعة الكميات بالفواتير"],
                ["noTax",         "بدون ضريبة"],
                ["sellerStats",   "إحصاءات للبائع"],
                ["itemStats",     "إحصاءات للصنف"],
                ["customerStats", "إحصاءات عميل/مورد"],
              ] as [keyof DoctypeData, string][]).map(([key, lbl]) => (
                <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600"
                    checked={!!dd[key]}
                    onChange={e => setDoctype(selectedItem, { [key]: e.target.checked })} />
                  <span className="text-[11px] text-slate-600">{lbl}</span>
                </label>
              ))}
            </div>
          </div>
        </P>
      </div>
    </div>
  );
}
