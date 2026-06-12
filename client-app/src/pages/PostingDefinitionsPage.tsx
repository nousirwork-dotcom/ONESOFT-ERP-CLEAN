import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Save, BookOpen, ChevronLeft } from "lucide-react";

// ─── أنواع ────────────────────────────────────────────────────────────────────

type DocTypeMeta = {
  id: string;
  variant: string;
  label: string;
};

type AmountSource = {
  id: string;
  label: string;
};

type PostingLine = {
  _key: number;
  description: string;
  accountId: number | null;
  accountCode: string;
  accountName: string;
  direction: "debit" | "credit";
  amountSource: string;
};

let _keyCounter = 0;
const nextKey = () => ++_keyCounter;

// ─── Account Select ───────────────────────────────────────────────────────────

function AccountSelect({
  value,
  onChange,
  accounts,
}: {
  value: number | null;
  onChange: (id: number | null, code: string, name: string) => void;
  accounts: { id: number; code: string; nameAr: string; level?: number }[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selected = accounts.find((a) => a.id === value);
  const filtered = query.trim()
    ? accounts.filter(
        (a) =>
          a.code.includes(query) ||
          a.nameAr.includes(query)
      )
    : accounts.slice(0, 60);

  return (
    <div className="relative w-full">
      <input
        type="text"
        className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
        placeholder="ابحث بالكود أو الاسم..."
        value={open ? query : (selected ? `${selected.code} - ${selected.nameAr}` : "")}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        onChange={(e) => setQuery(e.target.value)}
        dir="rtl"
      />
      {open && (
        <div className="absolute z-50 top-full mt-0.5 right-0 w-72 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto text-xs">
          <div
            className="px-3 py-1.5 hover:bg-gray-100 cursor-pointer text-gray-400"
            onMouseDown={() => { onChange(null, "", ""); setOpen(false); setQuery(""); }}
          >
            — بدون حساب —
          </div>
          {filtered.map((a) => (
            <div
              key={a.id}
              className="px-3 py-1.5 hover:bg-blue-50 cursor-pointer flex gap-2"
              dir="rtl"
              onMouseDown={() => { onChange(a.id, a.code, a.nameAr); setOpen(false); setQuery(""); }}
            >
              <span className="text-gray-400 font-mono">{a.code}</span>
              <span>{a.nameAr}</span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-gray-400 text-center">لا نتائج</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── الصفحة الرئيسية ──────────────────────────────────────────────────────────

export default function PostingDefinitionsPage() {
  const [selectedDoc, setSelectedDoc] = useState<DocTypeMeta | null>(null);
  const [lines, setLines] = useState<PostingLine[]>([]);
  const [dirty, setDirty] = useState(false);

  const { data: docTypes = [] } = trpc.postingDefinitions.docTypes.useQuery();
  const { data: amountSources = [] } = trpc.postingDefinitions.amountSources.useQuery();
  const { data: accounts = [] } = trpc.accounts.list.useQuery() as { data: { id: number; code: string; nameAr: string; level?: number }[] };

  const utils = trpc.useUtils();

  const { data: defData, isLoading: defLoading } = trpc.postingDefinitions.getByDocType.useQuery(
    { docType: selectedDoc?.id ?? "", variant: selectedDoc?.variant ?? "" },
    { enabled: !!selectedDoc }
  );

  const saveMut = trpc.postingDefinitions.saveLines.useMutation({
    onSuccess: () => {
      toast.success("تم الحفظ بنجاح ✓");
      setDirty(false);
      utils.postingDefinitions.getByDocType.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.postingDefinitions.deleteDefinition.useMutation({
    onSuccess: () => {
      toast.success("تم المسح");
      setLines([]);
      setDirty(false);
      utils.postingDefinitions.getByDocType.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (!defData) return;
    if (defData.lines.length === 0) {
      setLines([]);
    } else {
      setLines(
        defData.lines.map((l: any) => ({
          _key: nextKey(),
          description: l.description ?? "",
          accountId: l.accountId ?? null,
          accountCode: l.accountCode ?? "",
          accountName: l.accountName ?? "",
          direction: (l.direction === "credit" ? "credit" : "debit") as "debit" | "credit",
          amountSource: l.amountSource ?? "total",
        }))
      );
    }
    setDirty(false);
  }, [defData]);

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        _key: nextKey(),
        description: "",
        accountId: null,
        accountCode: "",
        accountName: "",
        direction: "debit",
        amountSource: "total",
      },
    ]);
    setDirty(true);
  }

  function removeLine(key: number) {
    setLines((prev) => prev.filter((l) => l._key !== key));
    setDirty(true);
  }

  function updateLine<K extends keyof PostingLine>(key: number, field: K, val: PostingLine[K]) {
    setLines((prev) =>
      prev.map((l) => (l._key === key ? { ...l, [field]: val } : l))
    );
    setDirty(true);
  }

  function handleSave() {
    if (!selectedDoc) return;
    saveMut.mutate({
      docType: selectedDoc.id,
      variant: selectedDoc.variant,
      lines: lines.map((l, i) => ({
        description: l.description,
        accountId: l.accountId,
        direction: l.direction,
        amountSource: l.amountSource,
        sortOrder: i,
      })),
    });
  }

  function handleDeleteDef() {
    if (!selectedDoc) return;
    if (!window.confirm("هل تريد مسح جميع سطور الترحيل لهذا النوع؟")) return;
    deleteMut.mutate({ docType: selectedDoc.id, variant: selectedDoc.variant });
  }

  const debitTotal = lines.filter((l) => l.direction === "debit").length;
  const creditTotal = lines.filter((l) => l.direction === "credit").length;

  return (
    <div className="flex h-full bg-gray-50" dir="rtl">
      {/* ── القائمة الجانبية ─────────────────────────────────────────────── */}
      <aside className="w-60 bg-white border-l border-gray-200 flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-gray-200 bg-[#406B93] text-white">
          <div className="flex items-center gap-2">
            <BookOpen size={16} />
            <span className="font-semibold text-sm">أنواع السندات</span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-1">
          {(docTypes as DocTypeMeta[]).map((dt) => {
            const active = selectedDoc?.id === dt.id && selectedDoc?.variant === dt.variant;
            return (
              <button
                key={`${dt.id}__${dt.variant}`}
                onClick={() => {
                  if (dirty && !window.confirm("لديك تغييرات غير محفوظة. هل تريد الانتقال؟")) return;
                  setSelectedDoc(dt);
                }}
                className={cn(
                  "w-full text-right px-4 py-2.5 text-sm flex items-center gap-2 transition-colors",
                  active
                    ? "bg-[#406B93]/10 text-[#406B93] font-semibold border-r-2 border-[#406B93]"
                    : "text-gray-700 hover:bg-gray-50"
                )}
              >
                <ChevronLeft size={14} className={cn("shrink-0 text-gray-400", active && "text-[#406B93]")} />
                <span>{dt.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── المنطقة الرئيسية ──────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {!selectedDoc ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
            <BookOpen size={48} className="opacity-30" />
            <p className="text-base">اختر نوع السند من القائمة لعرض تعريفات الترحيل</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-800 text-base">
                  تعريفات الترحيل — {selectedDoc.label}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  حدد الحسابات واتجاهات الترحيل لهذا النوع من السندات
                </p>
              </div>
              <div className="flex gap-2">
                {lines.length > 0 && (
                  <button
                    onClick={handleDeleteDef}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={13} />
                    مسح الكل
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={!dirty || saveMut.isPending}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-1.5 text-xs rounded font-semibold transition-colors",
                    dirty
                      ? "bg-[#406B93] text-white hover:bg-[#355a7d]"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  )}
                >
                  <Save size={13} />
                  {saveMut.isPending ? "جار الحفظ..." : "حفظ"}
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto p-4">
              {defLoading ? (
                <div className="text-center py-10 text-gray-400 text-sm">جار التحميل...</div>
              ) : (
                <>
                  {/* Summary bar */}
                  {lines.length > 0 && (
                    <div className="mb-3 flex gap-4 text-xs text-gray-600">
                      <span className="bg-green-50 border border-green-200 text-green-700 px-3 py-1 rounded-full">
                        مدين: {debitTotal} سطر
                      </span>
                      <span className="bg-red-50 border border-red-200 text-red-700 px-3 py-1 rounded-full">
                        دائن: {creditTotal} سطر
                      </span>
                      {debitTotal !== creditTotal && (
                        <span className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 py-1 rounded-full">
                          ⚠ عدد المدينات والدائنات غير متساوٍ
                        </span>
                      )}
                    </div>
                  )}

                  {/* Table */}
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600 w-8">#</th>
                          <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600 w-48">البيان</th>
                          <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600">الحساب المحاسبي</th>
                          <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600 w-32">اتجاه الترحيل</th>
                          <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600 w-44">مصدر المبلغ</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-gray-400 text-sm">
                              لا توجد سطور — اضغط "إضافة سطر" لبدء التعريف
                            </td>
                          </tr>
                        ) : (
                          lines.map((line, idx) => (
                            <tr
                              key={line._key}
                              className={cn(
                                "border-b border-gray-100 last:border-0 hover:bg-gray-50/50",
                                line.direction === "debit" ? "bg-green-50/20" : "bg-red-50/20"
                              )}
                            >
                              {/* رقم */}
                              <td className="px-3 py-2 text-xs text-gray-400 font-mono">{idx + 1}</td>

                              {/* البيان */}
                              <td className="px-2 py-1.5">
                                <input
                                  type="text"
                                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                                  placeholder="مثال: الصندوق، المبيعات..."
                                  value={line.description}
                                  onChange={(e) => updateLine(line._key, "description", e.target.value)}
                                  dir="rtl"
                                />
                              </td>

                              {/* الحساب */}
                              <td className="px-2 py-1.5">
                                <AccountSelect
                                  value={line.accountId}
                                  accounts={accounts}
                                  onChange={(id, code, name) => {
                                    setLines((prev) =>
                                      prev.map((l) =>
                                        l._key === line._key
                                          ? { ...l, accountId: id, accountCode: code, accountName: name }
                                          : l
                                      )
                                    );
                                    setDirty(true);
                                  }}
                                />
                              </td>

                              {/* الاتجاه */}
                              <td className="px-2 py-1.5">
                                <select
                                  className={cn(
                                    "w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 font-semibold",
                                    line.direction === "debit"
                                      ? "border-green-300 bg-green-50 text-green-700"
                                      : "border-red-300 bg-red-50 text-red-700"
                                  )}
                                  value={line.direction}
                                  onChange={(e) =>
                                    updateLine(line._key, "direction", e.target.value as "debit" | "credit")
                                  }
                                  dir="rtl"
                                >
                                  <option value="debit">مدين</option>
                                  <option value="credit">دائن</option>
                                </select>
                              </td>

                              {/* مصدر المبلغ */}
                              <td className="px-2 py-1.5">
                                <select
                                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                                  value={line.amountSource}
                                  onChange={(e) => updateLine(line._key, "amountSource", e.target.value)}
                                  dir="rtl"
                                >
                                  {(amountSources as AmountSource[]).map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.label}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* حذف */}
                              <td className="px-2 py-1.5 text-center">
                                <button
                                  onClick={() => removeLine(line._key)}
                                  className="text-red-400 hover:text-red-600 transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Footer: add line */}
                    <div className="border-t border-gray-100 px-3 py-2 bg-gray-50/50">
                      <button
                        onClick={addLine}
                        className="flex items-center gap-1.5 text-xs text-[#406B93] hover:text-[#355a7d] font-medium transition-colors"
                      >
                        <Plus size={14} />
                        إضافة سطر
                      </button>
                    </div>
                  </div>

                  {/* مثال توضيحي */}
                  {lines.length > 0 && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800" dir="rtl">
                      <p className="font-semibold mb-2">📋 مثال على القيد الناتج:</p>
                      <div className="space-y-1 font-mono">
                        {lines.map((l, i) => {
                          const src = (amountSources as AmountSource[]).find(s => s.id === l.amountSource);
                          const acc = l.accountName || l.accountCode || "—";
                          return (
                            <div key={i} className="flex gap-4">
                              <span className={cn(
                                "w-12 font-bold",
                                l.direction === "debit" ? "text-green-700" : "text-red-600"
                              )}>
                                {l.direction === "debit" ? "مدين" : "دائن"}
                              </span>
                              <span className="w-40 truncate">{acc}</span>
                              <span className="text-blue-600">{src?.label ?? l.amountSource}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
