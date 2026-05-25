import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  BookOpen, BookMarked, RotateCcw, ClipboardList, ArrowLeftRight, Tag,
  Plus, Save, Trash2, ChevronFirst, ChevronLast,
  ChevronLeft as CLeft, ChevronRight as CRight, ArrowLeft, FileText,
} from "lucide-react";
import { toast } from "sonner";

/* ──────────────── types ──────────────── */
type JournalForm = {
  nameAr: string; nameEn: string; fixedPart: string;
  transferOwnership: boolean; userGroup: string; user: string; warehouse: string;
  systemOnly: boolean; autoSerial: boolean; firstNum: string; digits: string;
  lastNum: string; printTemplate: string; printTemplate2: string;
  printOnSave: boolean; status: string; postingMethod: string;
};
type Journal = { id: string; typeId: string } & JournalForm;

const EMPTY: JournalForm = {
  nameAr: "", nameEn: "", fixedPart: "",
  transferOwnership: false, userGroup: "", user: "", warehouse: "",
  systemOnly: false, autoSerial: false, firstNum: "1", digits: "7",
  lastNum: "9999999", printTemplate: "", printTemplate2: "",
  printOnSave: false, status: "ready", postingMethod: "normal",
};

/* ──────────────── document types ──────────────── */
const DOC_TYPES = [
  { id: "sales",          label: "فاتورة مبيعات",    icon: <BookOpen className="w-3.5 h-3.5" /> },
  { id: "sales-return",   label: "مردود مبيعات",     icon: <RotateCcw className="w-3.5 h-3.5" /> },
  { id: "purchases",      label: "فاتورة مشتريات",   icon: <BookMarked className="w-3.5 h-3.5" /> },
  { id: "purch-return",   label: "مردود مشتريات",    icon: <RotateCcw className="w-3.5 h-3.5" /> },
  { id: "sales-order",    label: "امر بيع",           icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { id: "sales-quote",    label: "عرض سعر مبيعات",   icon: <Tag className="w-3.5 h-3.5" /> },
  { id: "purchase-order", label: "امر شراء",          icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { id: "purch-quote",    label: "عرض سعر مشتريات",  icon: <Tag className="w-3.5 h-3.5" /> },
  { id: "transfer",       label: "سند تحويل مخزنى",  icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
];

/* ──────────────── small atoms ──────────────── */
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
  <div className="overflow-hidden" style={{ border: "1px solid #e8edf3", borderRadius: 6, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
    <div className="px-3 py-1.5" style={{ background: "linear-gradient(to left, #f8faff, #f3f6fb)", borderBottom: "1px solid #edf2f7" }}>
      <span className="font-semibold text-indigo-800 text-[12px]">{title}</span>
    </div>
    <div className="px-3 py-2.5" style={{ background: "#fff" }}>{children}</div>
  </div>
);
const R = ({ label, lw = 100, children }: { label: string; lw?: number; children: React.ReactNode }) => (
  <div className="flex items-center gap-2 min-w-0">
    <span className="text-[11px] text-slate-500 font-medium shrink-0" style={{ width: lw }}>{label}</span>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);
const CB = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex items-center gap-1.5 cursor-pointer select-none">
    <input type="checkbox" className="w-3.5 h-3.5 accent-indigo-600" checked={checked} onChange={e => onChange(e.target.checked)} />
    <span className="text-[11px] text-slate-600">{label}</span>
  </label>
);

let _nextId = 1;
const newId = () => String(_nextId++);

/* ──────────────── main component ──────────────── */
export default function DocumentJournalsPage() {
  const [selectedType, setSelectedType] = useState("sales");
  const [journals, setJournals] = useState<Journal[]>([]);
  const [view, setView] = useState<"list" | "form">("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<JournalForm>({ ...EMPTY });
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsaved, setShowUnsaved] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  const { data: warehousesList } = trpc.warehouses.list.useQuery();
  const { data: userGroupsList }  = trpc.userGroups.list.useQuery();
  const { data: users }           = trpc.users.list.useQuery();

  const set = <K extends keyof JournalForm>(k: K, v: JournalForm[K]) => {
    setForm(p => ({ ...p, [k]: v }));
    setIsDirty(true);
  };

  const typeJournals = journals.filter(j => j.typeId === selectedType);
  const currentIndex = editId ? typeJournals.findIndex(j => j.id === editId) : -1;
  const currentType  = DOC_TYPES.find(t => t.id === selectedType);

  const safeNavigate = (action: () => void) => {
    if (isDirty) { setPendingAction(() => action); setShowUnsaved(true); }
    else action();
  };

  const openCreate = useCallback(() => {
    setEditId(null);
    setForm({ ...EMPTY });
    setIsDirty(false);
    setView("form");
  }, []);

  const openEdit = useCallback((j: Journal) => {
    setEditId(j.id);
    setForm({
      nameAr: j.nameAr, nameEn: j.nameEn, fixedPart: j.fixedPart,
      transferOwnership: j.transferOwnership, userGroup: j.userGroup,
      user: j.user, warehouse: j.warehouse, systemOnly: j.systemOnly,
      autoSerial: j.autoSerial, firstNum: j.firstNum, digits: j.digits,
      lastNum: j.lastNum, printTemplate: j.printTemplate, printTemplate2: j.printTemplate2,
      printOnSave: j.printOnSave, status: j.status, postingMethod: j.postingMethod,
    });
    setIsDirty(false);
    setView("form");
  }, []);

  const handleSave = () => {
    if (!form.nameAr.trim()) { toast.error("إسم الدفتر بالعربي مطلوب"); return; }
    if (editId) {
      setJournals(prev => prev.map(j => j.id === editId ? { ...j, ...form } : j));
    } else {
      const id = newId();
      setJournals(prev => [...prev, { id, typeId: selectedType, ...form }]);
      setEditId(id);
    }
    setIsDirty(false);
    toast.success("تم الحفظ بنجاح ✓");
  };

  const handleDelete = () => {
    setJournals(prev => prev.filter(j => j.id !== editId));
    setIsDirty(false);
    setView("list");
    setEditId(null);
    setShowDelete(false);
    toast.success("تم حذف الدفتر");
  };

  /* ── Toolbar buttons ── */
  const toolbar = [
    { label: "حفظ",    icon: <Save className="w-3.5 h-3.5" />,          action: handleSave, primary: true },
    { label: "جديد",   icon: <Plus className="w-3.5 h-3.5" />,          action: () => safeNavigate(openCreate) },
    { label: "الأخير", icon: <ChevronLast className="w-3.5 h-3.5" />,   action: () => typeJournals.at(-1) && safeNavigate(() => openEdit(typeJournals.at(-1)!)) },
    { label: "التالي", icon: <CLeft className="w-3.5 h-3.5" />,         action: () => currentIndex < typeJournals.length - 1 && safeNavigate(() => openEdit(typeJournals[currentIndex + 1])) },
    { label: "السابق", icon: <CRight className="w-3.5 h-3.5" />,        action: () => currentIndex > 0 && safeNavigate(() => openEdit(typeJournals[currentIndex - 1])) },
    { label: "الأول",  icon: <ChevronFirst className="w-3.5 h-3.5" />,  action: () => typeJournals[0] && safeNavigate(() => openEdit(typeJournals[0])) },
    { label: "حذف",    icon: <Trash2 className="w-3.5 h-3.5" />,        action: () => editId && setShowDelete(true), danger: true },
    { label: "خروج",   icon: <ArrowLeft className="w-3.5 h-3.5" />,     action: () => safeNavigate(() => { setView("list"); setEditId(null); }) },
  ];

  /* ───────────────────── RENDER ───────────────────── */
  return (
    <div className="flex h-full gap-0 overflow-hidden" dir="rtl">

      {/* ══ Type Sidebar ══ */}
      <div
        className="shrink-0 flex flex-col overflow-hidden"
        style={{ width: 180, background: "#fff", borderLeft: "1px solid #e8edf3", borderRadius: "6px 0 0 6px" }}
      >
        <div className="px-3 py-2 shrink-0" style={{ borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">نوع المستند</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {DOC_TYPES.map(dt => {
            const active = selectedType === dt.id;
            const count  = journals.filter(j => j.typeId === dt.id).length;
            return (
              <button
                key={dt.id}
                onClick={() => { safeNavigate(() => { setSelectedType(dt.id); setView("list"); setEditId(null); }); }}
                className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-right transition-colors"
                style={{
                  background: active ? "#dbeafe" : "transparent",
                  color: active ? "#1d4ed8" : "#475569",
                  borderRight: active ? "2px solid #3b82f6" : "2px solid transparent",
                }}
              >
                <span style={{ color: active ? "#3b82f6" : "#94a3b8", flexShrink: 0 }}>{dt.icon}</span>
                <span className="text-[11px] truncate flex-1">{dt.label}</span>
                {count > 0 && (
                  <span
                    className="text-[9px] font-bold px-1 rounded-full shrink-0"
                    style={{ background: active ? "#bfdbfe" : "#f1f5f9", color: active ? "#1e40af" : "#64748b" }}
                  >{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══ Main Area ══ */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden" style={{ background: "#f6f8fc" }}>

        {view === "list" ? (
          /* ─────────────── List View ─────────────── */
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-[14px] font-bold text-slate-700">
                    دفاتر — {currentType?.label}
                  </h2>
                  <p className="text-[10px] text-slate-400">{typeJournals.length} دفتر</p>
                </div>
              </div>
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 px-3 h-8 rounded-md bg-indigo-600 text-white text-[11px] font-medium hover:bg-indigo-700 shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                دفتر جديد
              </button>
            </div>

            {/* Journals grid */}
            {typeJournals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6 text-indigo-300" />
                </div>
                <p className="text-[13px] font-medium text-slate-400">لا توجد دفاتر لـ {currentType?.label}</p>
                <p className="text-[11px] text-slate-300 mt-1">اضغط "دفتر جديد" لإضافة أول دفتر</p>
                <button
                  onClick={openCreate}
                  className="mt-4 flex items-center gap-1.5 px-4 h-8 rounded-md bg-indigo-600 text-white text-[11px] font-medium hover:bg-indigo-700 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> دفتر جديد
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {typeJournals.map((j, idx) => (
                  <button
                    key={j.id}
                    onClick={() => openEdit(j)}
                    className="group flex flex-col items-start gap-1 p-3 rounded-lg bg-white text-right transition-all hover:shadow-md hover:border-indigo-200"
                    style={{ border: "1px solid #e8edf3", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-[9px] font-bold text-slate-300">#{String(idx + 1).padStart(2, "0")}</span>
                      <span className="flex-1 text-[12px] font-semibold text-slate-700 truncate group-hover:text-indigo-700">
                        {j.nameAr || `دفتر ${currentType?.label} ${idx + 1}`}
                      </span>
                      {j.fixedPart && (
                        <span className="text-[9px] font-mono text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">
                          {j.fixedPart}
                        </span>
                      )}
                    </div>
                    {j.nameEn && (
                      <span className="text-[10px] text-slate-400 truncate w-full" dir="ltr">{j.nameEn}</span>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full"
                        style={{
                          background: j.status === "ready" ? "#dcfce7" : "#fef9c3",
                          color: j.status === "ready" ? "#166534" : "#854d0e",
                        }}
                      >
                        {j.status === "ready" ? "مستعد" : "معلق"}
                      </span>
                      {j.autoSerial && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">
                          تسلسل تلقائي
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

        ) : (
          /* ─────────────── Form View ─────────────── */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Form header */}
            <div className="flex items-center gap-2 px-4 py-2 shrink-0" style={{ borderBottom: "1px solid #e8edf3", background: "#fff" }}>
              <button
                onClick={() => safeNavigate(() => { setView("list"); setEditId(null); })}
                className="w-5 h-5 flex items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
              >
                <ArrowLeft className="w-2.5 h-2.5" />
              </button>
              <span className="text-[12px] font-bold text-slate-600">
                {editId
                  ? (form.nameAr || `دفتر ${currentType?.label}`)
                  : `دفتر جديد — ${currentType?.label}`}
              </span>
              {editId && (
                <span className="text-[10px] text-slate-400">
                  ({currentIndex + 1} / {typeJournals.length})
                </span>
              )}
              {isDirty && (
                <span className="text-[10px] text-amber-600 mr-auto">● تعديلات غير محفوظة</span>
              )}
            </div>

            {/* Form content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">

              <P title="بيانات الدفتر">
                <div className="grid grid-cols-2 gap-x-5 gap-y-2">
                  <R label="إسم عربي *">
                    <FI value={form.nameAr} onChange={v => set("nameAr", v)} placeholder={`دفتر ${currentType?.label}`} />
                  </R>
                  <R label="إسم إنجليزي">
                    <FI value={form.nameEn} onChange={v => set("nameEn", v)} placeholder="Journal Name in English" />
                  </R>
                  <R label="الجزء الثابت">
                    <FI value={form.fixedPart} onChange={v => set("fixedPart", v)} placeholder="S01-" />
                  </R>
                  <div className="flex items-center">
                    <CB label="نقل الملكية أوتوماتيكي" checked={form.transferOwnership} onChange={v => set("transferOwnership", v)} />
                  </div>
                </div>
              </P>

              <P title="حدود الاستخدام">
                <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                  <R label="مجموعة مستخدمين" lw={120}>
                    <FS value={form.userGroup} onValueChange={v => set("userGroup", v)}>
                      <SelectItem value="all">الكل</SelectItem>
                      {(userGroupsList ?? []).map(g => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
                    </FS>
                  </R>
                  <R label="مستخدم">
                    <FS value={form.user} onValueChange={v => set("user", v)}>
                      <SelectItem value="all">الكل</SelectItem>
                      {(users as any[])?.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                    </FS>
                  </R>
                  <R label="مخزن">
                    <FS value={form.warehouse} onValueChange={v => set("warehouse", v)}>
                      <SelectItem value="all">الكل</SelectItem>
                      {(warehousesList as any[])?.map((w: any) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                    </FS>
                  </R>
                </div>
                <div className="mt-2">
                  <CB label="للمستندات التي يصدرها النظام فقط" checked={form.systemOnly} onChange={v => set("systemOnly", v)} />
                </div>
              </P>

              <P title="الأرقام">
                <div className="grid grid-cols-4 gap-x-4 gap-y-2 items-center">
                  <div>
                    <CB label="تسلسل أرقام أوتوماتيكي" checked={form.autoSerial} onChange={v => set("autoSerial", v)} />
                  </div>
                  <R label="أول رقم">
                    <FI value={form.firstNum} onChange={v => set("firstNum", v)} placeholder="1" />
                  </R>
                  <R label="عدد الخانات">
                    <FI value={form.digits} onChange={v => set("digits", v)} placeholder="7" />
                  </R>
                  <R label="آخر رقم">
                    <FI value={form.lastNum} onChange={v => set("lastNum", v)} placeholder="9999999" />
                  </R>
                </div>
              </P>

              <div className="grid grid-cols-2 gap-3">
                <P title="خيارات الطباعة">
                  <div className="space-y-2">
                    <R label="نموذج الطباعة">
                      <FI value={form.printTemplate} onChange={v => set("printTemplate", v)} placeholder="نموذج A4 رئيسي" />
                    </R>
                    <R label="طباعة حرارية">
                      <FI value={form.printTemplate2} onChange={v => set("printTemplate2", v)} placeholder="نموذج 80mm" />
                    </R>
                    <div className="flex items-center gap-4 mt-1">
                      <CB label="طباعة مع الحفظ" checked={form.printOnSave} onChange={v => set("printOnSave", v)} />
                      {(["ready", "pending"] as const).map((v, i) => (
                        <label key={v} className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input type="radio" className="w-3.5 h-3.5 accent-indigo-600"
                            checked={form.status === v} onChange={() => set("status", v)} />
                          <span className="text-[11px] text-slate-600">{["مستعد", "معلق"][i]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </P>

                <P title="أسلوب الترحيل">
                  <div className="space-y-2 mt-0.5">
                    {(["normal", "onSave", "immediate", "daily"] as const).map((v, idx) => (
                      <label key={v} className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input type="radio" className="w-3.5 h-3.5 accent-indigo-600"
                          checked={form.postingMethod === v} onChange={() => set("postingMethod", v)} />
                        <span className="text-[11px] text-slate-600">
                          {["ترحيل طبيعي (يدوي)", "ترحيل مع الحفظ", "ترحيل فوري", "ترحيل يومي دفعة واحدة"][idx]}
                        </span>
                      </label>
                    ))}
                  </div>
                </P>
              </div>
            </div>

            {/* ══ Sticky Toolbar ══ */}
            <div
              className="shrink-0 flex items-center gap-1 px-3"
              style={{
                borderTop: "1px solid #e2e8f0",
                background: "#ffffff",
                boxShadow: "0 -2px 8px rgba(0,0,0,0.06)",
                height: 44,
              }}
            >
              {toolbar.map(({ label, icon, action, primary, danger }: any) => (
                <button
                  key={label}
                  onClick={action}
                  disabled={label === "حذف" && !editId}
                  className={[
                    "flex items-center gap-1 px-3 h-8 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed",
                    primary ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                      : danger ? "text-red-500 hover:bg-red-50 border border-red-200"
                        : "text-slate-600 hover:bg-slate-100 border border-slate-200",
                  ].join(" ")}
                >
                  <span className="w-3.5 h-3.5 flex">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
              {isDirty && (
                <span className="text-[10px] text-amber-600 mr-auto flex items-center gap-1">
                  ● تعديلات غير محفوظة
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ══ Unsaved dialog ══ */}
      <Dialog open={showUnsaved} onOpenChange={setShowUnsaved}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-base">تعديلات غير محفوظة</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 text-right">يوجد تعديلات غير محفوظة، هل تريد الحفظ قبل المتابعة؟</p>
          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              onClick={() => { setShowUnsaved(false); handleSave(); if (pendingAction) { pendingAction(); setPendingAction(null); } }}>
              حفظ
            </Button>
            <Button variant="outline" className="flex-1"
              onClick={() => { setIsDirty(false); setShowUnsaved(false); if (pendingAction) { pendingAction(); setPendingAction(null); } }}>
              تجاهل
            </Button>
            <Button variant="outline" className="flex-1"
              onClick={() => { setShowUnsaved(false); setPendingAction(null); }}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ Delete dialog ══ */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-base">حذف الدفتر</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 text-right">
            هل تريد حذف دفتر <strong>{form.nameAr}</strong>؟ لا يمكن التراجع.
          </p>
          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <Button variant="destructive" className="flex-1" onClick={handleDelete}>حذف</Button>
            <Button variant="outline" className="flex-1" onClick={() => setShowDelete(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
