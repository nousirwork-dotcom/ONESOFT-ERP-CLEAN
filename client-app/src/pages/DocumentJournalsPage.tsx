import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { BookOpen, BookMarked, RotateCcw, ClipboardList, ArrowLeftRight, Package, FileText, Tag } from "lucide-react";

type JournalData = {
  nameAr: string; nameEn: string; docType: string; fixedPart: string;
  transferOwnership: boolean; userGroup: string; user: string; warehouse: string;
  systemOnly: boolean; autoSerial: boolean; firstNum: string; digits: string;
  lastNum: string; printTemplate: string; printTemplate2: string;
  printOnSave: boolean; status: string; postingMethod: string;
};
const EMPTY_JOURNAL: JournalData = {
  nameAr: "", nameEn: "", docType: "", fixedPart: "",
  transferOwnership: false, userGroup: "", user: "", warehouse: "",
  systemOnly: false, autoSerial: false, firstNum: "1", digits: "7",
  lastNum: "9999999", printTemplate: "", printTemplate2: "",
  printOnSave: false, status: "ready", postingMethod: "normal",
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

const ITEMS = [
  { id: "sales",          label: "دفتر فاتورة المبيعات",    icon: <BookOpen className="w-3.5 h-3.5" /> },
  { id: "sales-return",   label: "دفتر مردود المبيعات",     icon: <RotateCcw className="w-3.5 h-3.5" /> },
  { id: "purchases",      label: "دفتر فاتورة المشتريات",   icon: <BookMarked className="w-3.5 h-3.5" /> },
  { id: "purch-return",   label: "دفتر مردود المشتريات",    icon: <RotateCcw className="w-3.5 h-3.5" /> },
  { id: "sales-order",    label: "دفتر أمر البيع",          icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { id: "sales-quote",    label: "دفتر عرض أسعار مبيعات",  icon: <Tag className="w-3.5 h-3.5" /> },
  { id: "purch-quote",    label: "دفتر عرض أسعار مشتريات", icon: <Tag className="w-3.5 h-3.5" /> },
  { id: "purchase-order", label: "دفتر أمر شراء",           icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { id: "transfer",       label: "دفتر سند تحويل داخلي",    icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
  { id: "dispatch",       label: "دفتر سند صرف أصناف",      icon: <Package className="w-3.5 h-3.5" /> },
  { id: "supply",         label: "دفتر سند توريد أصناف",    icon: <Package className="w-3.5 h-3.5" /> },
  { id: "inventory",      label: "دفتر تقييم المخزون",       icon: <FileText className="w-3.5 h-3.5" /> },
  { id: "stocktake",      label: "دفتر الجرد والتسويات",     icon: <FileText className="w-3.5 h-3.5" /> },
];

export default function DocumentJournalsPage() {
  const [selectedItem, setSelectedItem] = useState("sales");
  const [journalData, setJournalData] = useState<Record<string, JournalData>>({});

  const { data: warehousesList } = trpc.warehouses.list.useQuery();
  const { data: userGroupsList }  = trpc.userGroups.list.useQuery();
  const { data: users }           = trpc.users.list.useQuery();

  const getJournal = (id: string): JournalData => journalData[id] ?? { ...EMPTY_JOURNAL };
  const setJournal = (id: string, patch: Partial<JournalData>) =>
    setJournalData(p => ({ ...p, [id]: { ...(p[id] ?? EMPTY_JOURNAL), ...patch } }));

  const currentItem = ITEMS.find(i => i.id === selectedItem);
  const jd = getJournal(selectedItem);

  return (
    <div className="flex gap-3 h-full" dir="rtl">
      {/* Sidebar */}
      <div className="shrink-0 flex flex-col overflow-hidden" style={{ width: 210, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
        <div className="px-3 pt-2.5 pb-2 shrink-0" style={{ borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">الدفاتر</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {ITEMS.map(item => {
            const active = selectedItem === item.id;
            return (
              <button key={item.id} onClick={() => setSelectedItem(item.id)}
                className="w-full flex items-center gap-1.5 px-3 py-1.5 text-right transition-colors"
                style={{ background: active ? "#dbeafe" : "transparent", color: active ? "#1d4ed8" : "#64748b", borderRight: active ? "2px solid #3b82f6" : "2px solid transparent" }}
              >
                <span style={{ color: active ? "#3b82f6" : "#94a3b8", flexShrink: 0 }}>{item.icon}</span>
                <span className="text-[12px] truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-y-auto space-y-2 pb-4">
        <div className="flex items-center justify-between py-1">
          <span className="text-[12px] font-bold text-indigo-700">{currentItem?.label}</span>
          <span className="text-[11px] text-slate-400">دفتر:{selectedItem.substring(0,3).toUpperCase()}</span>
        </div>

        <P title="بيانات الدفتر">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <R label="نوع المستند">
              <FS value={jd.docType} onValueChange={v => setJournal(selectedItem, { docType: v })}>
                <SelectItem value="sales">فاتورة مبيعات</SelectItem>
                <SelectItem value="sales-return">مردود مبيعات</SelectItem>
                <SelectItem value="purchase">فاتورة مشتريات</SelectItem>
                <SelectItem value="purch-return">مردود مشتريات</SelectItem>
                <SelectItem value="sales-order">امر بيع</SelectItem>
                <SelectItem value="sales-quote">عرض سعر مبيعات</SelectItem>
                <SelectItem value="purchase-order">امر شراء</SelectItem>
                <SelectItem value="purch-quote">عرض سعر مشتريات</SelectItem>
                <SelectItem value="transfer">سند تحويل مخزنى</SelectItem>
              </FS>
            </R>
            <div className="flex items-center gap-2">
              <R label="الجزء الثابت" lw={72}>
                <FI value={jd.fixedPart} onChange={v => setJournal(selectedItem, { fixedPart: v })} placeholder="S01-" />
              </R>
              <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0">
                <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600"
                  checked={jd.transferOwnership}
                  onChange={e => setJournal(selectedItem, { transferOwnership: e.target.checked })} />
                <span className="text-[11px] text-slate-600">نقل الملكية أوتوماتيكي</span>
              </label>
            </div>
            <R label="إسم عربي">
              <FI value={jd.nameAr} onChange={v => setJournal(selectedItem, { nameAr: v })} placeholder={currentItem?.label} />
            </R>
            <R label="إسم إنجليزي">
              <FI value={jd.nameEn} onChange={v => setJournal(selectedItem, { nameEn: v })} placeholder="Journal Name in English" />
            </R>
          </div>
        </P>

        <P title="حدود الاستخدام">
          <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
            <R label="مجموعة مستخدمين">
              <FS value={jd.userGroup} onValueChange={v => setJournal(selectedItem, { userGroup: v })}>
                <SelectItem value="all">الكل</SelectItem>
                {(userGroupsList ?? []).map(g => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
              </FS>
            </R>
            <R label="مستخدم">
              <FS value={jd.user} onValueChange={v => setJournal(selectedItem, { user: v })}>
                <SelectItem value="all">الكل</SelectItem>
                {(users as any[])?.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
              </FS>
            </R>
            <R label="مخزن">
              <FS value={jd.warehouse} onValueChange={v => setJournal(selectedItem, { warehouse: v })}>
                <SelectItem value="all">الكل</SelectItem>
                {(warehousesList as any[])?.map((w: any) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
              </FS>
            </R>
          </div>
          <div className="mt-1.5">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600"
                checked={jd.systemOnly}
                onChange={e => setJournal(selectedItem, { systemOnly: e.target.checked })} />
              <span className="text-[11px] text-slate-600">للمستندات التي يصدرها النظام فقط</span>
            </label>
          </div>
        </P>

        <P title="الأرقام">
          <div className="grid grid-cols-4 gap-x-3 gap-y-1.5 items-center">
            <div className="col-span-1 flex items-center">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600"
                  checked={jd.autoSerial}
                  onChange={e => setJournal(selectedItem, { autoSerial: e.target.checked })} />
                <span className="text-[11px] text-slate-600">تسلسل أرقام أوتوماتيكي</span>
              </label>
            </div>
            <R label="أول رقم">
              <FI value={jd.firstNum} onChange={v => setJournal(selectedItem, { firstNum: v })} placeholder="1" />
            </R>
            <R label="عدد الخانات">
              <FI value={jd.digits} onChange={v => setJournal(selectedItem, { digits: v })} placeholder="7" />
            </R>
            <R label="آخر رقم">
              <FI value={jd.lastNum} onChange={v => setJournal(selectedItem, { lastNum: v })} placeholder="9999999" />
            </R>
          </div>
        </P>

        <div className="grid grid-cols-2 gap-2">
          <P title="خيارات الطباعة">
            <div className="space-y-1.5">
              <R label="نموذج الطباعة">
                <FI value={jd.printTemplate} onChange={v => setJournal(selectedItem, { printTemplate: v })} placeholder="نموذج A4 رئيسي" />
              </R>
              <R label="نموذج طباعة حراري">
                <FI value={jd.printTemplate2} onChange={v => setJournal(selectedItem, { printTemplate2: v })} placeholder="نموذج حراري 80mm" />
              </R>
              <div className="flex items-center gap-4 mt-1">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600"
                    checked={jd.printOnSave}
                    onChange={e => setJournal(selectedItem, { printOnSave: e.target.checked })} />
                  <span className="text-[11px] text-slate-600">طباعة مع الحفظ</span>
                </label>
                {(["ready","pending"] as const).map((v, i) => (
                  <label key={v} className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input type="radio" className="w-3.5 h-3.5 accent-indigo-600"
                      checked={jd.status === v}
                      onChange={() => setJournal(selectedItem, { status: v })} />
                    <span className="text-[11px] text-slate-600">{["مستعد","معلق"][i]}</span>
                  </label>
                ))}
              </div>
            </div>
          </P>
          <P title="أسلوب الترحيل">
            <div className="space-y-1.5 mt-0.5">
              {(["normal","onSave","immediate","daily"] as const).map((v, idx) => (
                <label key={v} className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="radio" className="w-3.5 h-3.5 accent-indigo-600"
                    checked={jd.postingMethod === v}
                    onChange={() => setJournal(selectedItem, { postingMethod: v })} />
                  <span className="text-[11px] text-slate-600">
                    {["ترحيل طبيعي (يدوي)","ترحيل مع الحفظ","ترحيل فوري","ترحيل يومي دفعة واحدة"][idx]}
                  </span>
                </label>
              ))}
            </div>
          </P>
        </div>
      </div>
    </div>
  );
}
