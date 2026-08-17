import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useToolbarActions } from "@/components/unified-toolbar/ToolbarActionsContext";
import { DesktopWorkWindow } from "@/components/work-window";
import { Input } from "@/core/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/core/ui/dialog";
import { Button } from "@/core/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/core/ui/tooltip";
import { trpc } from "@/shared/lib/trpc";
import { useTabManager } from "@/core/contexts/TabManagerContext";
import {
  BookOpen, BookMarked, RotateCcw, ClipboardList, ArrowLeftRight, Tag,
  Plus, Save, Trash2, ChevronFirst, ChevronLast, RefreshCw,
  ChevronLeft as CLeft, ChevronRight as CRight, ArrowLeft, FileText, Eye,
  BookText, PackageMinus, PackagePlus, Users, Truck, Copy,
  ListFilter, Search, Printer, ArrowDownCircle, ArrowUpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/core/hooks/useAuth";
import { FoundationPolicyPanel } from "@/shared/components/FoundationPolicyPanel";
import styles from "@/components/responsive-layout/ResponsiveLayout.module.css";

/* ──────────────── types ──────────────── */
type JournalForm = {
  nameAr: string; nameEn: string; fixedPart: string; docType: string;
  transferOwnership: boolean; userGroup: string; user: string; warehouse: string;
  systemOnly: boolean; autoSerial: boolean; firstNum: string; digits: string;
  lastNum: string; printTemplate: string; printTemplate2: string;
  printOnSave: boolean; status: string; postingMethod: string;
  resetFrequency: string;
  // ── ترقيم المسودات ──
  draftAutoSerial: boolean; draftFixedPart: string; draftFirstNum: string;
  draftDigits: string; draftLastNum: string;
  draftResetFrequency: string;
  customersJournal: string; suppliersJournal: string;
  salesAccountId: string; cashAccountId: string; creditAccountId: string;
  taxAccountId: string; discountAccountId: string;
  issuanceJournalType: string; issuanceJournalBookId: string;
  issuanceInventoryDocType: string; issuanceInventoryDocBookId: string;
  allowUnpost: boolean; allowEditAfterPost: boolean;
  printPageSize: string; thermalPrint: boolean; thermalWidth: string;
  trackQuantity: boolean; noTax: boolean; salesmanStats: boolean;
  itemStats: boolean; customerSupplierStats: boolean;
  preventNegativeInventory: boolean; requireNote: boolean;
  preventEditIfLinked: boolean; requireCustomerCode: boolean; requireEmployeeCode: boolean;
  showWarehouseCol: boolean; showUnitCol: boolean; autoCalcPrices: boolean;
  editItemNames: boolean; editServiceNames: boolean;
  suggestLastBuyPrice: boolean; suggestLastPurchaseOrder: boolean;
  allowForeignCurrency: boolean; usePriceUnitsOnly: boolean; allowOverdraft: boolean;
  maxUnitsCount: string; suggestedSalesUnit: string; returnPeriodDays: string;
  availableQtyDisplay: string; currentQtyDisplay: string;
  colWidthItemCode: string; colWidthItemName: string; colWidthUnit: string; colWidthAccount: string;
  recordPolicy: string; includeInFoundation: boolean; foundationKey: string;
};

type DBJournal = {
  id: number; orgId: number; docType: string; code: string;
  name: string; name2?: string | null; description?: string | null;
  numberPrefix: string; firstNumber: number; lastNumber: number;
  increment: number; numDigits: number; includeYear: boolean; currentSeq: number;
  warehouseId?: number | null; allowedUserGroup?: string | null; allowedUserId?: number | null;
  printTemplate?: string | null; printTemplate2?: string | null;
  resetFrequency?: string | null;
  autoSerial: boolean; printOnSave: boolean;
  isActive: boolean; sortOrder: number;
  recordPolicy?: string | null; foundationKey?: string | null; includeInFoundation?: boolean | null;
  // ── ترقيم المسودات ──
  draftAutoSerial?: boolean | null;
  draftNumberPrefix?: string | null;
  draftFirstNumber?: number | null;
  draftLastNumber?: number | null;
  draftNumDigits?: number | null;
  draftCurrentSeq?: number | null;
  draftResetFrequency?: string | null;
};

type DocComponent = {
  sortOrder: number;
  fieldCode: string;
  nameAr: string;
  nameEn: string;
  showInDocument: boolean;
  showInPrint: boolean;
  showInTemplates: boolean;
  showInReports: boolean;
};

const EMPTY: JournalForm = {
  nameAr: "", nameEn: "", fixedPart: "", docType: "",
  transferOwnership: false, userGroup: "", user: "", warehouse: "",
  systemOnly: false, autoSerial: false, firstNum: "1", digits: "6",
  lastNum: "999999", printTemplate: "", printTemplate2: "",
  printOnSave: false, status: "ready", postingMethod: "normal",
  resetFrequency: "none",
  draftAutoSerial: false, draftFixedPart: "DRAFT", draftFirstNum: "1",
  draftDigits: "6", draftLastNum: "999999", draftResetFrequency: "none",
  customersJournal: "", suppliersJournal: "",
  salesAccountId: "", cashAccountId: "", creditAccountId: "",
  taxAccountId: "", discountAccountId: "",
  issuanceJournalType: "", issuanceJournalBookId: "",
  issuanceInventoryDocType: "", issuanceInventoryDocBookId: "",
  allowUnpost: true, allowEditAfterPost: false,
  printPageSize: "A4", thermalPrint: false, thermalWidth: "80mm",
  trackQuantity: false, noTax: false, salesmanStats: false,
  itemStats: false, customerSupplierStats: false,
  preventNegativeInventory: false, requireNote: false,
  preventEditIfLinked: false, requireCustomerCode: false, requireEmployeeCode: false,
  showWarehouseCol: true, showUnitCol: true, autoCalcPrices: false,
  editItemNames: false, editServiceNames: false,
  suggestLastBuyPrice: false, suggestLastPurchaseOrder: false,
  allowForeignCurrency: false, usePriceUnitsOnly: false, allowOverdraft: false,
  maxUnitsCount: "3", suggestedSalesUnit: "", returnPeriodDays: "0",
  availableQtyDisplay: "show", currentQtyDisplay: "show",
  colWidthItemCode: "0", colWidthItemName: "32", colWidthUnit: "12", colWidthAccount: "25",
  recordPolicy: "flexible", includeInFoundation: false, foundationKey: "",
};

/* ── أنواع السندات (sales journal only) ── */
type PaymentTypeRow = { id: string; nameAr: string; nameEn: string; codeAr: string; codeEn: string; };
type AccountLinkRow = { id: string; description: string; postingName: string; accountId: number | null; postingSide: string; };
type VoucherTypeMaster = {
  id: number;
  orgId: number;
  nameAr: string;
  nameEn: string;
  codeAr: string;
  codeEn: string;
  isActive: boolean;
};
type PTC = {
  types: PaymentTypeRow[];
  /** Legacy fallback retained for existing journals and older posting code. */
  accountLinks: AccountLinkRow[];
  /** Independent accounting links for every payment/document type. */
  accountLinksByType: Record<string, AccountLinkRow[]>;
};
const DEFAULT_LINK_DESCRIPTIONS = [
  "الصندوق / النقد",
  "صافي المبيعات",
  "الضريبة (VAT)",
  "السلعة / التكلفة",
  "ذمم العملاء (آجل)",
  "الخصم الممنوح",
  "مردود المبيعات",
  "مصاريف أخرى",
  "بند إضافي (1)",
  "بند إضافي (2)",
];
const DEFAULT_ACCOUNT_LINKS: AccountLinkRow[] = [{
  id: "default-1",
  description: "",
  postingName: "",
  accountId: null,
  postingSide: "",
}];
const DEFAULT_PAYMENT_TYPES: PaymentTypeRow[] = [
  { id: "1", nameAr: "نقدا",  nameEn: "نقدا",  codeAr: "نقدا",  codeEn: "cash"  },
  { id: "2", nameAr: "آجل",   nameEn: "آجل",   codeAr: "آجل",   codeEn: "cridt" },
];

const cloneLinksForType = (links: AccountLinkRow[], typeId: string): AccountLinkRow[] =>
  links.map((link, index) => ({ ...link, id: `${typeId}-${link.id || index + 1}` }));

const DEFAULT_PTC: PTC = {
  types: DEFAULT_PAYMENT_TYPES,
  accountLinks: DEFAULT_ACCOUNT_LINKS,
  accountLinksByType: Object.fromEntries(
    DEFAULT_PAYMENT_TYPES.map(type => [type.id, cloneLinksForType(DEFAULT_ACCOUNT_LINKS, type.id)]),
  ),
};

function normalizeAccountLinks(rawLinks: unknown): AccountLinkRow[] {
  const savedLinks: AccountLinkRow[] = Array.isArray(rawLinks) ? rawLinks : [];
  const isLegacyUnconfiguredDefaults =
    savedLinks.length > 1 &&
    savedLinks.every((link, index) =>
      link.description === DEFAULT_LINK_DESCRIPTIONS[index] &&
      !link.postingName &&
      link.accountId == null &&
      !link.postingSide,
    );
  if (isLegacyUnconfiguredDefaults) {
    return [{ ...DEFAULT_ACCOUNT_LINKS[0], id: savedLinks[0]?.id || "default-1" }];
  }
  const merged: AccountLinkRow[] = DEFAULT_ACCOUNT_LINKS.map((def, i) => {
    const saved = savedLinks[i];
    return saved ?? { ...def, id: `default-${i + 1}` };
  });
  return [...merged, ...savedLinks.slice(DEFAULT_ACCOUNT_LINKS.length)];
}

function normalizePtConfig(raw: any): PTC {
  if (!raw) return DEFAULT_PTC;
  const rawTypes: PaymentTypeRow[] = Array.isArray(raw.types) ? raw.types : DEFAULT_PAYMENT_TYPES;
  const legacyLinks = normalizeAccountLinks(raw.accountLinks);
  const rawByType = raw.accountLinksByType && typeof raw.accountLinksByType === "object"
    ? raw.accountLinksByType as Record<string, unknown>
    : {};
  const types = rawTypes;
  const accountLinksByType = Object.fromEntries(
    types.map((type, index) => {
      const rawType = rawTypes[index];
      const savedLinks = rawByType[rawType.id] ?? rawByType[type.id];
      const source = Array.isArray(savedLinks) ? savedLinks : legacyLinks;
      return [type.id, normalizeAccountLinks(source)];
    }),
  );
  return { types, accountLinks: legacyLinks, accountLinksByType };
}

function resolveVoucherTypeMasters(types: PaymentTypeRow[], masters: VoucherTypeMaster[]): PTC["types"] {
  return types.map(type => {
    const byId = masters.find(master => String(master.id) === type.id);
    const byCode = !byId && (type.codeEn.trim() || type.codeAr.trim())
      ? masters.find(master =>
          (type.codeEn.trim() && master.codeEn.trim().toLowerCase() === type.codeEn.trim().toLowerCase()) ||
          (type.codeAr.trim() && master.codeAr.trim() === type.codeAr.trim()),
        )
      : undefined;
    const master = byId ?? byCode;
    return master
      ? {
          id: String(master.id),
          nameAr: master.nameAr,
          nameEn: master.nameEn,
          codeAr: master.codeAr,
          codeEn: master.codeEn,
        }
      : type;
  });
}

function normalizePtConfigWithMasters(raw: any, masters: VoucherTypeMaster[]): PTC {
  const base = normalizePtConfig(raw);
  const resolvedTypes = resolveVoucherTypeMasters(base.types, masters);
  const rawTypes: PaymentTypeRow[] = Array.isArray(raw?.types) ? raw.types : base.types;
  const rawByType = raw?.accountLinksByType && typeof raw.accountLinksByType === "object"
    ? raw.accountLinksByType as Record<string, unknown>
    : {};
  const accountLinksByType = Object.fromEntries(
    resolvedTypes.map((type, index) => {
      const oldId = rawTypes[index]?.id ?? type.id;
      const savedLinks = rawByType[oldId] ?? rawByType[type.id];
      const source = Array.isArray(savedLinks) ? savedLinks : base.accountLinks;
      return [type.id, normalizeAccountLinks(source)];
    }),
  );
  return {
    ...base,
    types: resolvedTypes,
    accountLinksByType,
  };
}

function createInitialPtConfig(masters: VoucherTypeMaster[]): PTC {
  const types = resolveVoucherTypeMasters(DEFAULT_PAYMENT_TYPES, masters);
  return {
    types,
    accountLinks: DEFAULT_ACCOUNT_LINKS,
    accountLinksByType: Object.fromEntries(
      types.map(type => [type.id, cloneLinksForType(DEFAULT_ACCOUNT_LINKS, type.id)]),
    ),
  };
}

function getDuplicatePaymentTypeCodeMessage(types: PaymentTypeRow[]): string | null {
  const arabicCodes = new Set<string>();
  const englishCodes = new Set<string>();

  for (const type of types) {
    const codeAr = type.codeAr.trim();
    const codeEn = type.codeEn.trim().toLowerCase();

    if (codeAr) {
      if (arabicCodes.has(codeAr)) return "الكود العربي مستخدم بالفعل في نوع سند آخر.";
      arabicCodes.add(codeAr);
    }
    if (codeEn) {
      if (englishCodes.has(codeEn)) return "الكود الإنجليزي مستخدم بالفعل في نوع سند آخر.";
      englishCodes.add(codeEn);
    }
  }
  return null;
}

function getGlobalVoucherTypeCodeMessage(
  types: PaymentTypeRow[],
  masters: VoucherTypeMaster[],
): string | null {
  const byArabicCode = new Map(
    masters.filter(master => master.codeAr.trim()).map(master => [master.codeAr.trim(), master.id]),
  );
  const byEnglishCode = new Map(
    masters.filter(master => master.codeEn.trim()).map(master => [master.codeEn.trim().toLowerCase(), master.id]),
  );

  for (const type of types) {
    const id = Number(type.id);
    const codeAr = type.codeAr.trim();
    const codeEn = type.codeEn.trim().toLowerCase();
    if (codeAr && byArabicCode.has(codeAr) && byArabicCode.get(codeAr) !== id) {
      return "الكود العربي مستخدم بالفعل في نوع سند آخر.";
    }
    if (codeEn && byEnglishCode.has(codeEn) && byEnglishCode.get(codeEn) !== id) {
      return "الكود الإنجليزي مستخدم بالفعل في نوع سند آخر.";
    }
  }
  return null;
}

/* ── مكوّن بحث الحساب (مثل المخازن) ── */
const normalizeArDJ = (s: string) =>
  (s ?? "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");

function AccCodeSearch({
  allAccounts,
  selectedId,
  onChange,
}: {
  allAccounts: any[];
  selectedId: number | null;
  onChange: (id: number | null) => void;
}) {
  const selected = useMemo(() => allAccounts.find((a: any) => a.id === selectedId) ?? null, [allAccounts, selectedId]);
  const [q, setQ]     = useState(selected?.code ?? "");
  const [open, setOpen] = useState(false);
  const [hi, setHi]   = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const postableAccounts = useMemo(() => allAccounts.filter((a: any) => a.allowPosting === true), [allAccounts]);

  useEffect(() => { setQ(selected?.code ?? ""); }, [selected?.code]);

  const filtered = useMemo(() => {
    const sq = normalizeArDJ(q.trim());
    if (!sq) return postableAccounts.slice(0, 30);
    const codeFirst = postableAccounts.filter((a: any) => normalizeArDJ(a.code ?? "").startsWith(sq));
    const rest      = postableAccounts.filter((a: any) =>
      !normalizeArDJ(a.code ?? "").startsWith(sq) &&
      (normalizeArDJ(a.code ?? "").includes(sq) || normalizeArDJ(a.name ?? "").includes(sq))
    );
    return [...codeFirst, ...rest].slice(0, 30);
  }, [q, postableAccounts]);

  useEffect(() => { setHi(0); }, [filtered]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = (a: any) => { onChange(a.id); setQ(a.code ?? ""); setOpen(false); };
  const clear = () => { onChange(null); setQ(""); setOpen(false); };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); setOpen(true); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === "Escape") { setOpen(false); setQ(selected?.code ?? ""); }
    else if ((e.key === "Enter" || e.key === "Tab") && open && filtered[hi]) { e.preventDefault(); pick(filtered[hi]); }
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <input
        value={open || !selected ? q : (selected?.code ?? "")}
        dir="ltr"
        data-no-desktop-field
        onChange={e => { setQ(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => { setOpen(true); if (selected) setQ(""); }}
        onBlur={() => setTimeout(() => { if (!wrapRef.current?.contains(document.activeElement)) { setOpen(false); setQ(selected?.code ?? ""); } }, 120)}
        onKeyDown={onKey}
        placeholder="كود..."
        className="h-5 w-full text-[10px] px-1.5 border-0 bg-transparent outline-none focus:bg-indigo-50 font-mono text-slate-700 placeholder:text-slate-300"
      />
      {open && (
        <div className="absolute top-full right-0 z-[9990] mt-0.5 w-72 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden" dir="rtl">
          <div className="overflow-y-auto max-h-48">
            <button
              onMouseDown={clear}
              className="w-full flex items-center gap-2 px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-50 transition-colors"
            >
              — بدون حساب —
            </button>
            {filtered.length === 0 && <div className="text-[11px] text-center text-slate-400 py-3">لا نتائج</div>}
            {filtered.map((a: any, idx: number) => (
              <button key={a.id} onMouseDown={() => pick(a)}
                className={`w-full flex items-center gap-2 px-2 py-1 text-[11px] transition-colors ${idx === hi ? "bg-indigo-50" : "hover:bg-slate-50"}`}
              >
                <span className="font-mono text-[10px] text-slate-400 w-16 text-left shrink-0">{a.code}</span>
                <span className="flex-1 text-right truncate text-slate-700">{a.name}</span>
              </button>
            ))}
          </div>
          <div className="px-2 py-1 border-t border-slate-100 bg-slate-50 text-[9px] text-slate-400">↑↓ تنقل · Enter اختيار</div>
        </div>
      )}
    </div>
  );
}

/* ──────────────── FieldCodeSearch ──────────────── */
function FieldCodeSearch({
  allFields,
  selectedCode,
  onChange,
  filterType,
}: {
  allFields: any[];
  selectedCode: string;
  onChange: (code: string) => void;
  filterType?: string;
}) {
  allFields = filterType
    ? allFields.filter((f: any) => f.fieldType === filterType)
    : allFields;
  const selected = useMemo(() => allFields.find((f: any) => f.code === selectedCode) ?? null, [allFields, selectedCode]);
  const [q, setQ]     = useState(selectedCode);
  const [open, setOpen] = useState(false);
  const [hi, setHi]   = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!open) setQ(selectedCode); }, [selectedCode, open]);

  const filtered = useMemo(() => {
    const sq = normalizeArDJ(q.trim());
    if (!sq) return allFields.slice(0, 40);
    const codeFirst = allFields.filter((f: any) => normalizeArDJ(f.code ?? "").startsWith(sq));
    const rest      = allFields.filter((f: any) =>
      !normalizeArDJ(f.code ?? "").startsWith(sq) &&
      (normalizeArDJ(f.code ?? "").includes(sq) ||
       normalizeArDJ(f.nameAr ?? "").includes(sq) ||
       normalizeArDJ(f.nameEn ?? "").includes(sq))
    );
    return [...codeFirst, ...rest].slice(0, 40);
  }, [q, allFields]);

  useEffect(() => { setHi(0); }, [filtered]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = (f: any) => { onChange(f.code); setQ(f.code); setOpen(false); };
  const clear = () => { onChange(""); setQ(""); setOpen(false); };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); setOpen(true); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === "Escape") { setOpen(false); setQ(selectedCode); }
    else if ((e.key === "Enter" || e.key === "Tab") && open && filtered[hi]) { e.preventDefault(); pick(filtered[hi]); }
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      {!open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setQ(""); setTimeout(() => (wrapRef.current?.querySelector("input") as HTMLInputElement)?.focus(), 10); }}
          className="w-full text-right px-2 py-1 hover:bg-indigo-50/60 transition-colors min-h-[32px] flex flex-col justify-center"
        >
          {selected ? (
            <>
              <span className="font-mono text-[10px] text-slate-700 leading-tight">{selected.code}</span>
              <span className="text-[9px] text-indigo-600 leading-tight truncate">{selected.nameAr}</span>
            </>
          ) : (
            <span className="text-[10px] text-slate-300 italic">— اختر حقلاً —</span>
          )}
        </button>
      ) : (
        <div className="px-1.5 py-0.5">
          <input
            autoFocus
            value={q}
            dir="ltr"
            onChange={e => { setQ(e.target.value); setHi(0); }}
            onBlur={() => setTimeout(() => { if (!wrapRef.current?.contains(document.activeElement)) { setOpen(false); setQ(selectedCode); } }, 120)}
            onKeyDown={onKey}
            placeholder="بحث بالكود أو الاسم..."
            className="h-5 w-full text-[10px] px-1 border border-indigo-300 bg-indigo-50 outline-none font-mono text-slate-700 placeholder:text-slate-300 rounded"
          />
        </div>
      )}
      {open && (
        <div className="absolute top-full right-0 z-[9990] mt-0.5 w-80 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden" dir="rtl">
          <div className="overflow-y-auto max-h-52">
            <button onMouseDown={clear}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-[11px] text-slate-400 hover:bg-slate-50 border-b border-slate-100">
              — بدون حقل —
            </button>
            {filtered.length === 0 && <div className="text-[11px] text-center text-slate-400 py-3">لا نتائج</div>}
            {filtered.map((f: any, idx: number) => (
              <button key={f.id} onMouseDown={() => pick(f)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-[11px] transition-colors ${idx === hi ? "bg-indigo-50" : "hover:bg-slate-50"}`}
              >
                <span className="font-mono text-[10px] text-slate-500 w-24 text-left shrink-0">{f.code}</span>
                <span className="flex-1 text-right truncate text-slate-700">{f.nameAr}</span>
                <span className="text-[9px] text-slate-400 shrink-0">{f.fieldType}</span>
              </button>
            ))}
          </div>
          <div className="px-2 py-1 border-t border-slate-100 bg-slate-50 text-[9px] text-slate-400">↑↓ تنقل · Enter اختيار · بحث بالكود أو الاسم</div>
        </div>
      )}
    </div>
  );
}

/* ──────────────── document types ──────────────── */
const DOC_TYPES = [
  { id: "sales_invoice",       label: "فاتورة المبيعات",     icon: <BookOpen className="w-3.5 h-3.5" /> },
  { id: "sales_return",        label: "مردود مبيعات",        icon: <RotateCcw className="w-3.5 h-3.5" /> },
  { id: "credit_note",         label: "إشعار دائن مبيعات",   icon: <FileText className="w-3.5 h-3.5" /> },
  { id: "purchase_invoice",    label: "فاتورة مشتريات",      icon: <BookMarked className="w-3.5 h-3.5" /> },
  { id: "purchase_return",     label: "مردود مشتريات",       icon: <RotateCcw className="w-3.5 h-3.5" /> },
  { id: "debit_note",          label: "إشعار مدين مبيعات",   icon: <FileText className="w-3.5 h-3.5" /> },
  { id: "sales_order",         label: "أمر بيع",             icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { id: "sales_quote",         label: "عرض سعر مبيعات",     icon: <Tag className="w-3.5 h-3.5" /> },
  { id: "purchase_order",      label: "أمر شراء",            icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { id: "purchase_quote",      label: "عرض سعر مشتريات",    icon: <Tag className="w-3.5 h-3.5" /> },
  { id: "stock_transfer",      label: "سند تحويل مخزني",    icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
  { id: "journal_entry",       label: "سند قيد",             icon: <BookText className="w-3.5 h-3.5" /> },
  { id: "receipt_voucher",     label: "سند قبض",             icon: <ArrowDownCircle className="w-3.5 h-3.5" /> },
  { id: "payment_voucher",     label: "سند صرف",             icon: <ArrowUpCircle className="w-3.5 h-3.5" /> },
  { id: "stock_issue_items",   label: "سند صرف أصناف",       icon: <PackageMinus className="w-3.5 h-3.5" /> },
  { id: "stock_receipt_items", label: "سند توريد أصناف",     icon: <PackagePlus className="w-3.5 h-3.5" /> },
  { id: "customers_journal",   label: "دفتر العملاء",         icon: <Users className="w-3.5 h-3.5" /> },
  { id: "suppliers_journal",   label: "دفتر الموردين",        icon: <Truck className="w-3.5 h-3.5" /> },
];

/* ──────────────── small atoms ──────────────── */
import sharedForm from "../../../styles/shared-form.module.css";

const FI = ({ value, onChange, placeholder, disabled, mono }: {
  value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; mono?: boolean;
}) => (
  <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
    className={`${sharedForm.textInput} ${mono ? sharedForm.textInputMono : ""}`} />
);
/* ── Active-Field context ── */
type ActiveFieldState = {
  id: string | null;
  value: string | null;
  previewPage: string | null;
  previewLabel: string | null;
};
const ActiveFieldCtx = React.createContext<{
  state: ActiveFieldState;
  set: (s: ActiveFieldState) => void;
} | null>(null);

function useActiveField() {
  const ctx = React.useContext(ActiveFieldCtx);
  if (!ctx) throw new Error("useActiveField must be inside ActiveFieldCtx.Provider");
  return ctx;
}

const FS = ({ id, value, onValueChange, children, placeholder, previewPage, previewLabel }: {
  id: string;
  value: string;
  onValueChange: (v: string) => void;
  children: React.ReactNode;
  placeholder?: string;
  previewPage?: string;
  previewLabel?: string;
}) => {
  const [open, setOpen] = useState(false);
  const { state, set } = useActiveField();
  const isActive = state.id === id;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`relative flex items-center rounded cursor-text select-none transition-all ${
            sharedForm.selectTrigger
          } ${isActive ? "ring-2 ring-[rgba(138,107,78,0.3)]" : ""}`}
          style={{ border: isActive ? "1px solid #8A6B4E" : undefined }}
          onPointerDown={e => {
            if (e.button === 0) {
              e.preventDefault();
              e.stopPropagation();
              set({ id, value, previewPage: previewPage ?? null, previewLabel: previewLabel ?? "" });
              (e.currentTarget as HTMLDivElement).focus();
            }
          }}
          onContextMenu={e => {
            e.preventDefault();
            e.stopPropagation();
            set({ id, value, previewPage: previewPage ?? null, previewLabel: previewLabel ?? "" });
            setOpen(true);
          }}
          tabIndex={0}
        >
          <Select
            value={value || ""}
            onValueChange={v => { onValueChange(v); setOpen(false); }}
            open={open}
            onOpenChange={isOpen => { if (!isOpen) setOpen(false); }}
          >
            <SelectTrigger
              hideArrow
              dir="rtl"
              className="h-full w-full border-0 bg-transparent p-0 shadow-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 cursor-text text-right"
            >
              <SelectValue placeholder={placeholder ?? ""} />
            </SelectTrigger>
            <SelectContent onPointerDownOutside={() => setOpen(false)}>{children}</SelectContent>
          </Select>
          <span className="absolute left-1 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
            <ListFilter className="w-3 h-3 text-slate-400" />
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="center">كليك يمين لعرض الاختيارات</TooltipContent>
    </Tooltip>
  );
};
const P = ({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) => (
  <div className={sharedForm.section}>
    <div className={sharedForm.sectionHeader}>
      <span className={sharedForm.sectionTitle}>{title}</span>
      {action && <span className={sharedForm.sectionAction}>{action}</span>}
    </div>
    <div className={sharedForm.sectionBody}>{children}</div>
  </div>
);
const R = ({ label, lw = 100, className, children }: { label: string; lw?: number; className?: string; children: React.ReactNode }) => (
  <div className={`${sharedForm.fieldRow} ${className || ""}`}>
    <span className={sharedForm.fieldLabel} style={{ width: lw }}>{label}</span>
    <div className={sharedForm.fieldContent}>{children}</div>
  </div>
);
const CB = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className={sharedForm.checkbox}>
    <input type="checkbox" className={sharedForm.checkboxInput} checked={checked} onChange={e => onChange(e.target.checked)} />
    <span className={sharedForm.checkboxLabel}>{label}</span>
  </label>
);

/* ──────────────── helpers ──────────────── */
function dbToForm(j: DBJournal): JournalForm {
  const ic = (j as any).issuanceConfig ?? {};
  const oc = (j as any).optionsConfig  ?? {};
  return {
    nameAr:            j.name ?? "",
    nameEn:            j.name2 ?? "",
    fixedPart:         j.numberPrefix ?? "",
    docType:           j.docType ?? "",
    transferOwnership: false,
    userGroup:         j.allowedUserGroup ?? "",
    user:              j.allowedUserId != null ? String(j.allowedUserId) : "",
    warehouse:         j.warehouseId != null ? String(j.warehouseId) : "",
    systemOnly:        false,
    autoSerial:        j.autoSerial ?? false,
    firstNum:          String(j.firstNumber ?? 1),
    digits:            String(j.numDigits ?? 6),
    lastNum:           String(j.lastNumber ?? 999999),
    printTemplate:     j.printTemplate ?? "",
    printTemplate2:    j.printTemplate2 ?? "",
    printOnSave:       j.printOnSave ?? false,
    status:            "ready",
    postingMethod:     "normal",
    resetFrequency:    j.resetFrequency ?? "none",
    draftAutoSerial:   (j as any).draftAutoSerial ?? false,
    draftFixedPart:    (j as any).draftNumberPrefix ?? "DRAFT",
    draftFirstNum:     String((j as any).draftFirstNumber ?? 1),
    draftDigits:       String((j as any).draftNumDigits ?? 6),
    draftLastNum:      String((j as any).draftLastNumber ?? 999999),
    draftResetFrequency: (j as any).draftResetFrequency ?? "none",
    customersJournal:  (j as any).customersJournal ?? "",
    suppliersJournal:  (j as any).suppliersJournal ?? "",
    salesAccountId:    (j as any).salesAccountId != null ? String((j as any).salesAccountId) : "",
    cashAccountId:     (j as any).cashAccountId  != null ? String((j as any).cashAccountId)  : "",
    creditAccountId:   (j as any).creditAccountId != null ? String((j as any).creditAccountId) : "",
    taxAccountId:      (j as any).taxAccountId   != null ? String((j as any).taxAccountId)   : "",
    discountAccountId: (j as any).discountAccountId != null ? String((j as any).discountAccountId) : "",
    issuanceJournalType:       ic.journalEntryType      ?? "",
    issuanceJournalBookId:     ic.journalBookId          ?? "",
    issuanceInventoryDocType:  ic.inventoryDocType       ?? "",
    issuanceInventoryDocBookId:ic.inventoryDocBookId     ?? "",
    allowUnpost:         (j as any).allowUnpost         ?? true,
    allowEditAfterPost:  (j as any).allowEditAfterPost  ?? false,
    printPageSize:       oc.printPageSize       ?? "A4",
    thermalPrint:        oc.thermalPrint        ?? false,
    thermalWidth:        oc.thermalWidth        ?? "80mm",
    trackQuantity:       oc.trackQuantity       ?? false,
    noTax:               oc.noTax               ?? false,
    salesmanStats:       oc.salesmanStats       ?? false,
    itemStats:           oc.itemStats           ?? false,
    customerSupplierStats: oc.customerSupplierStats ?? false,
    preventNegativeInventory: oc.preventNegativeInventory ?? false,
    requireNote:         oc.requireNote         ?? false,
    preventEditIfLinked: oc.preventEditIfLinked ?? false,
    requireCustomerCode: oc.requireCustomerCode ?? false,
    requireEmployeeCode: oc.requireEmployeeCode ?? false,
    showWarehouseCol:         oc.showWarehouseCol         ?? true,
    showUnitCol:              oc.showUnitCol              ?? true,
    autoCalcPrices:           oc.autoCalcPrices           ?? false,
    editItemNames:            oc.editItemNames            ?? false,
    editServiceNames:         oc.editServiceNames         ?? false,
    suggestLastBuyPrice:      oc.suggestLastBuyPrice      ?? false,
    suggestLastPurchaseOrder: oc.suggestLastPurchaseOrder ?? false,
    allowForeignCurrency:     oc.allowForeignCurrency     ?? false,
    usePriceUnitsOnly:        oc.usePriceUnitsOnly        ?? false,
    allowOverdraft:           oc.allowOverdraft           ?? false,
    maxUnitsCount:            oc.maxUnitsCount            ?? "3",
    suggestedSalesUnit:       oc.suggestedSalesUnit       ?? "",
    returnPeriodDays:         oc.returnPeriodDays         ?? "0",
    availableQtyDisplay:      oc.availableQtyDisplay      ?? "show",
    currentQtyDisplay:        oc.currentQtyDisplay        ?? "show",
    colWidthItemCode:         oc.colWidthItemCode         ?? "0",
    colWidthItemName:         oc.colWidthItemName         ?? "32",
    colWidthUnit:             oc.colWidthUnit             ?? "12",
    colWidthAccount:          oc.colWidthAccount          ?? "25",
    recordPolicy:             (j as any).recordPolicy          ?? "flexible",
    includeInFoundation:      (j as any).includeInFoundation   ?? false,
    foundationKey:            (j as any).foundationKey         ?? "",
  };
}

function buildPreview(fixedPart: string, firstNum: string, digits: string): string {
  const n = parseInt(firstNum) || 1;
  const d = parseInt(digits) || 6;
  return `${fixedPart}${String(n).padStart(d, "0")}`;
}

/* ──────────────── main component ──────────────── */
export default function DocumentJournalsPage() {
  const [selectedType, setSelectedType] = useState("sales_invoice");
  const [view, setView]       = useState<"list" | "form">("list");
  const [editId, setEditId]   = useState<number | null>(null);
  const [form, setForm]       = useState<JournalForm>({ ...EMPTY });
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsaved, setShowUnsaved]   = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [showDelete, setShowDelete]     = useState(false);
  const [showReset, setShowReset]       = useState(false);
  const [resetMode, setResetMode]       = useState<"official" | "draft">("official");
  const [ptConfig, setPtConfig]         = useState<PTC>(DEFAULT_PTC);
  const [activeTab, setActiveTab]       = useState<"basic" | "payment-types" | "accounting-links" | "issuance" | "options" | "doc-components">("basic");
  const [docComponents, setDocComponents] = useState<DocComponent[]>([]);
  const [activeField, setActiveField]     = useState<ActiveFieldState>({ id: null, value: null, previewPage: null, previewLabel: null });
  const tabManager = useTabManager();
  const { user } = useAuth();
  const isSuperadmin = user?.role === 'superadmin';

  /* ── queries ── */
  const listQuery = trpc.documentJournals.list.useQuery();
  const allJournals: DBJournal[] = (listQuery.data ?? []) as DBJournal[];
  const typeJournals = useMemo(() => allJournals.filter(j => j.docType === selectedType), [allJournals, selectedType]);
  const { data: voucherTypesData = [] } = trpc.documentJournals.listVoucherTypes.useQuery();
  const globalVoucherTypes = voucherTypesData as VoucherTypeMaster[];

  const currentIndex = editId != null ? typeJournals.findIndex(j => j.id === editId) : -1;
  const currentDBJournal = editId != null ? allJournals.find(j => j.id === editId) : null;

  const { data: warehousesList } = trpc.warehouses.list.useQuery();
  const { data: userGroupsList }  = trpc.userGroups.list.useQuery();
  const { data: users }           = trpc.users.listBasic.useQuery();
  const { data: templates }       = trpc.documentTemplates.list.useQuery({ docType: selectedType });
  const { data: custJournalsList }  = trpc.documentJournals.list.useQuery({ docType: "customers_journal" });
  const { data: suppJournalsList }  = trpc.documentJournals.list.useQuery({ docType: "suppliers_journal" });
  const { data: chartAccounts = [] }   = trpc.accounts.list.useQuery();
  const { data: fieldDictList = [] }   = trpc.fieldDictionary.list.useQuery();
  const syncFieldsMut = trpc.fieldDictionary.syncSystemFields.useMutation();

  // ── navigate intent (مطالعة من صفحة أخرى) ──────────────────────────────
  const djpIntentRef = useRef<{ docType?: string; editId?: number } | null>(null);

  // Case 1: الصفحة لم تكن مفتوحة → sessionStorage
  useEffect(() => {
    const raw = sessionStorage.getItem("djp_intent");
    if (raw) {
      sessionStorage.removeItem("djp_intent");
      try {
        const intent = JSON.parse(raw) as { docType?: string; editId?: number };
        djpIntentRef.current = intent;
        if (intent.docType) setSelectedType(intent.docType);
      } catch { /* ignore */ }
    }
  }, []);

  // Case 1 cont: لما تحمل البيانات نفذ التنقل
  useEffect(() => {
    if (!djpIntentRef.current?.editId || allJournals.length === 0) return;
    const j = allJournals.find(jj => jj.id === djpIntentRef.current!.editId);
    if (j) { openEdit(j); setView("form"); }
    djpIntentRef.current = null;
  }, [allJournals]);

  // Case 2: الصفحة مفتوحة بالفعل → CustomEvent
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ docType?: string; editId?: number }>).detail;
      if (detail.docType) setSelectedType(detail.docType);
      if (detail.editId) {
        const j = allJournals.find(jj => jj.id === detail.editId);
        if (j) { openEdit(j); setView("form"); }
        else { djpIntentRef.current = detail; }
      }
    };
    window.addEventListener("djp_navigate", handler);
    return () => window.removeEventListener("djp_navigate", handler);
  }, [allJournals]);

  // ── مزامنة الحقول النظامية عند تحميل الصفحة ───────────────────────────
  const syncedRef = useRef(false);
  useEffect(() => {
    if (fieldDictList.length > 0 && !syncedRef.current) {
      syncedRef.current = true;
      syncFieldsMut.mutate(undefined, {
        onSuccess: (r) => { if (r.added > 0) toast.info(`تمت إضافة ${r.added} حقل نظامي جديد للقاموس`); },
      });
    }
  }, [fieldDictList.length]);

  /* ── mutations ── */
  const createMut = trpc.documentJournals.create.useMutation({
    onSuccess: (row) => {
      toast.success("تم حفظ الدفتر ✓");
      listQuery.refetch();
      setEditId(row.id);
      setIsDirty(false);
    },
    onError: e => toast.error(e.message),
  });
  const updateMut = trpc.documentJournals.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الدفتر ✓");
      listQuery.refetch();
      setIsDirty(false);
    },
    onError: e => toast.error(e.message),
  });
  const deleteMut = trpc.documentJournals.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الدفتر");
      listQuery.refetch();
      setView("list");
      setEditId(null);
      setIsDirty(false);
    },
    onError: e => toast.error(e.message),
  });
  const resetMut = trpc.documentJournals.resetNumbering.useMutation({
    onSuccess: () => {
      toast.success("تم إعادة ضبط الترقيم ✓");
      listQuery.refetch();
      setShowReset(false);
    },
    onError: e => toast.error(e.message),
  });
  const resetDraftMut = trpc.documentJournals.resetDraftNumbering.useMutation({
    onSuccess: () => {
      toast.success("تم إعادة ضبط ترقيم المسودات ✓");
      listQuery.refetch();
      setShowReset(false);
    },
    onError: e => toast.error(e.message),
  });

  const set = <K extends keyof JournalForm>(k: K, v: JournalForm[K]) => {
    setForm(p => ({ ...p, [k]: v }));
    setIsDirty(true);
  };

  const currentType = DOC_TYPES.find(t => t.id === selectedType);

  const safeNavigate = useCallback((action: () => void) => {
    if (isDirty) { setPendingAction(() => action); setShowUnsaved(true); }
    else action();
  }, [isDirty]);

  const openCreate = useCallback(() => {
    setEditId(null);
    setForm({ ...EMPTY, docType: selectedType });
    setIsDirty(false);
    setPtConfig(createInitialPtConfig(globalVoucherTypes));
    setDocComponents([]);
    setActiveTab("basic");
    setView("form");
  }, [globalVoucherTypes, selectedType]);

  const openEdit = useCallback((j: DBJournal) => {
    setEditId(j.id);
    setForm(dbToForm(j));
    setPtConfig(normalizePtConfigWithMasters((j as any).paymentTypesConfig, globalVoucherTypes));
    const oc2 = (j as any).optionsConfig ?? {};
    setDocComponents((oc2.documentComponents as DocComponent[]) ?? []);
    setIsDirty(false);
    setActiveTab("basic");
    setView("form");
  }, [globalVoucherTypes]);

  const handleSave = () => {
    if (!form.nameAr.trim()) { toast.error("إسم الدفتر بالعربي مطلوب"); return; }
    const duplicateCodeMessage = getDuplicatePaymentTypeCodeMessage(ptConfig.types);
    if (duplicateCodeMessage) { toast.error(duplicateCodeMessage); return; }
    const globalCodeMessage = getGlobalVoucherTypeCodeMessage(ptConfig.types, globalVoucherTypes);
    if (globalCodeMessage) { toast.error(globalCodeMessage); return; }
    const primaryTypeId = ptConfig.types[0]?.id;
    const primaryTypeLinks = primaryTypeId
      ? (ptConfig.accountLinksByType[primaryTypeId] ?? ptConfig.accountLinks)
      : ptConfig.accountLinks;
    const payload = {
      docType:        form.docType || selectedType,
      code:           form.fixedPart.trim() || form.nameAr.slice(0, 20) || "JRN",
      name:           form.nameAr.trim(),
      name2:          form.nameEn.trim() || undefined,
      numberPrefix:   form.fixedPart.trim() || "INV",
      firstNumber:    parseInt(form.firstNum) || 1,
      lastNumber:     parseInt(form.lastNum) || 999999,
      increment:      1,
      numDigits:      parseInt(form.digits) || 6,
      includeYear:    false,
      warehouseId:    form.warehouse ? parseInt(form.warehouse) : null,
      allowedUserGroup: form.userGroup || null,
      allowedUserId:  form.user ? parseInt(form.user) : null,
      printTemplate:  form.printTemplate || null,
      printTemplate2: form.printTemplate2 || null,
      resetFrequency:   form.resetFrequency,
      autoSerial:       form.autoSerial,
      printOnSave:      form.printOnSave,
      draftAutoSerial:   form.draftAutoSerial,
      draftNumberPrefix: form.draftFixedPart.trim() || "DRAFT",
      draftFirstNumber:  parseInt(form.draftFirstNum) || 1,
      draftLastNumber:   parseInt(form.draftLastNum) || 999999,
      draftNumDigits:    parseInt(form.draftDigits) || 6,
      draftResetFrequency: form.draftResetFrequency,
      customersJournal: (form.customersJournal && form.customersJournal !== "none") ? form.customersJournal : null,
      suppliersJournal: (form.suppliersJournal && form.suppliersJournal !== "none") ? form.suppliersJournal : null,
      // Keep the legacy flat list for older posting paths; new posting uses
      // accountLinksByType to select the links for the matching type.
      paymentTypesConfig: { ...ptConfig, accountLinks: primaryTypeLinks },
      salesAccountId:    form.salesAccountId    ? parseInt(form.salesAccountId)    : null,
      cashAccountId:     form.cashAccountId     ? parseInt(form.cashAccountId)     : null,
      creditAccountId:   form.creditAccountId   ? parseInt(form.creditAccountId)   : null,
      taxAccountId:      form.taxAccountId      ? parseInt(form.taxAccountId)      : null,
      discountAccountId: form.discountAccountId ? parseInt(form.discountAccountId) : null,
      allowUnpost:       form.allowUnpost,
      allowEditAfterPost:form.allowEditAfterPost,
      issuanceConfig:    (form.issuanceJournalType || form.issuanceJournalBookId || form.issuanceInventoryDocType || form.issuanceInventoryDocBookId) ? {
        journalEntryType: form.issuanceJournalType      || null,
        journalBookId:    form.issuanceJournalBookId    || null,
        inventoryDocType: form.issuanceInventoryDocType || null,
        inventoryDocBookId: form.issuanceInventoryDocBookId || null,
      } : null,
      optionsConfig: {
        printPageSize:            form.printPageSize,
        thermalPrint:             form.thermalPrint,
        thermalWidth:             form.thermalWidth,
        trackQuantity:            form.trackQuantity,
        noTax:                    form.noTax,
        salesmanStats:            form.salesmanStats,
        itemStats:                form.itemStats,
        customerSupplierStats:    form.customerSupplierStats,
        preventNegativeInventory: form.preventNegativeInventory,
        requireNote:              form.requireNote,
        preventEditIfLinked:      form.preventEditIfLinked,
        requireCustomerCode:      form.requireCustomerCode,
        requireEmployeeCode:      form.requireEmployeeCode,
        showWarehouseCol:         form.showWarehouseCol,
        showUnitCol:              form.showUnitCol,
        autoCalcPrices:           form.autoCalcPrices,
        editItemNames:            form.editItemNames,
        editServiceNames:         form.editServiceNames,
        suggestLastBuyPrice:      form.suggestLastBuyPrice,
        suggestLastPurchaseOrder: form.suggestLastPurchaseOrder,
        allowForeignCurrency:     form.allowForeignCurrency,
        usePriceUnitsOnly:        form.usePriceUnitsOnly,
        allowOverdraft:           form.allowOverdraft,
        maxUnitsCount:            form.maxUnitsCount,
        suggestedSalesUnit:       form.suggestedSalesUnit,
        returnPeriodDays:         form.returnPeriodDays,
        availableQtyDisplay:      form.availableQtyDisplay,
        currentQtyDisplay:        form.currentQtyDisplay,
        colWidthItemCode:         form.colWidthItemCode,
        colWidthItemName:         form.colWidthItemName,
        colWidthUnit:             form.colWidthUnit,
        colWidthAccount:          form.colWidthAccount,
        documentComponents:       docComponents,
      },
      sortOrder:        0,
      ...(isSuperadmin ? {
        recordPolicy:        form.recordPolicy as 'protected' | 'editable' | 'flexible',
        includeInFoundation: form.includeInFoundation,
      } : {}),
    };
    if (editId != null) {
      updateMut.mutate({ id: editId, ...payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const handleDelete = () => deleteMut.mutate({ id: editId! });
  const handleResetNumbering = () => { if (editId != null) resetMut.mutate({ journalId: editId }); };
  const handleResetDraftNumbering = () => { if (editId != null) resetDraftMut.mutate({ journalId: editId }); };

  const handleDuplicate = useCallback(() => {
    if (!editId) { toast.warning("اختر دفتراً أولاً ثم اضغط نسخة مماثلة"); return; }
    setForm(prev => ({
      ...prev,
      nameAr:    `نسخة من: ${prev.nameAr}`,
      nameEn:    prev.nameEn ? `Copy of ${prev.nameEn}` : "",
      fixedPart: prev.fixedPart ? `${prev.fixedPart}2` : "",
    }));
    setEditId(null);
    setIsDirty(true);
    setView("form");
    toast.success("تم نسخ الدفتر — راجع البيانات ثم احفظ");
  }, [editId]);

  /* ── مطالعة: map field id → page path + label ── */
  const FIELD_PAGE_MAP: Record<string, { path: string; label: string; icon: React.ElementType }> = {
    userGroup:                 { path: "/cfg/user-groups",        label: "مجموعات المستخدمين", icon: Users },
    user:                      { path: "/cfg/users",              label: "المستخدمين",          icon: Users },
    warehouse:                 { path: "/cfg/warehouses",         label: "المخازن",             icon: Truck },
    customersJournal:          { path: "/cfg/document-journals",  label: "دفاتر المستندات",     icon: BookOpen },
    suppliersJournal:          { path: "/cfg/document-journals",  label: "دفاتر المستندات",     icon: BookOpen },
    issuanceJournalBookId:     { path: "/cfg/document-journals",  label: "دفاتر المستندات",     icon: BookOpen },
    issuanceInventoryDocBookId:{ path: "/cfg/document-journals",  label: "دفاتر المستندات",     icon: BookOpen },
    printTemplate:             { path: "/cfg/print-settings",     label: "نماذج الطباعة",       icon: Printer },
    printTemplate2:            { path: "/cfg/print-settings",     label: "نماذج الطباعة",       icon: Printer },
  };

  const handleMutalaah = useCallback(() => {
    const fieldId = activeField.id;
    const fieldValue = activeField.value;
    if (!fieldId) {
      toast.info("لم يتم تحديد أي حقل — اضغط على حقل أولاً");
      return;
    }
    const mapped = FIELD_PAGE_MAP[fieldId];
    if (!mapped) {
      toast.info("لا يوجد سجل مرتبط بالحقل المحدد.");
      return;
    }
    // للحقول المرتبطة بدفاتر المستندات — افتح السجل المحدد مباشرةً
    const djpFields = ["customersJournal", "suppliersJournal", "issuanceJournalBookId", "issuanceInventoryDocBookId"];
    if (djpFields.includes(fieldId) && fieldValue) {
      const journalId = parseInt(fieldValue);
      if (journalId) {
        const linked = allJournals.find(j => j.id === journalId);
        const intent = { docType: linked?.docType, editId: journalId };
        sessionStorage.setItem("djp_intent", JSON.stringify(intent));
        window.dispatchEvent(new CustomEvent("djp_navigate", { detail: intent }));
      }
    }
    tabManager.openTab(mapped.path, mapped.label, mapped.icon);
  }, [activeField.id, activeField.value, allJournals, tabManager]);

  const handlePrint = useCallback(() => {
    if (isDirty) {
      toast.warning("يرجى حفظ البيانات أولاً قبل الطباعة");
      return;
    }
    if (!editId) {
      toast.info("لا يوجد سجل محفوظ للطباعة");
      return;
    }
    window.print();
  }, [isDirty, editId]);

  /* ── Toolbar ── */
  const isBusy = createMut.isPending || updateMut.isPending || deleteMut.isPending;

  // ── Unified Toolbar ──────────────────────────────────────────────────────────
  const _djpRef = useRef<any>({});
  _djpRef.current = { view, editId, typeJournals, currentIndex, isBusy, isDirty, handleSave, openCreate, handleDuplicate, setShowDelete, handleMutalaah, handlePrint, currentType, safeNavigate, openEdit, setView, setEditId };
  const toolbarActions = useMemo(() => {
    const hasEdit = editId !== null;
    const inForm = view === "form";
    return {
      save: { supported: true as const, allowed: true, stateEnabled: inForm && !isBusy, disabledReason: !inForm ? "اختر دفترًا للتعديل" : undefined, loading: isBusy, onClick: () => _djpRef.current.handleSave() },
      new: { supported: true as const, allowed: true, stateEnabled: true, onClick: () => _djpRef.current.safeNavigate(_djpRef.current.openCreate) },
      duplicate: { supported: true as const, allowed: true, stateEnabled: hasEdit, disabledReason: "افتح دفترًا أولًا لنسخه", onClick: () => _djpRef.current.editId && _djpRef.current.handleDuplicate() },
      edit: { supported: false as const, disabledReason: "الدفاتر دائمًا في وضع التعديل" },
      delete: { supported: true as const, allowed: true, stateEnabled: hasEdit, disabledReason: "افتح دفترًا أولًا للحذف", onClick: () => _djpRef.current.editId && _djpRef.current.setShowDelete(true) },
      draft: { supported: false as const, disabledReason: "المسودة غير مستخدمة" },
      first: { supported: true as const, allowed: true, stateEnabled: inForm && typeJournals.length > 0, disabledReason: "لا توجد دفاتر", onClick: () => { const s = _djpRef.current; const f = s.typeJournals[0]; if (f) s.safeNavigate(() => s.openEdit(f)); } },
      previous: { supported: true as const, allowed: true, stateEnabled: inForm && currentIndex > 0, disabledReason: "لا يوجد سجل سابق", onClick: () => { const s = _djpRef.current; if (s.currentIndex > 0) s.safeNavigate(() => s.openEdit(s.typeJournals[s.currentIndex - 1])); } },
      next: { supported: true as const, allowed: true, stateEnabled: inForm && currentIndex < typeJournals.length - 1, disabledReason: "لا يوجد سجل تالٍ", onClick: () => { const s = _djpRef.current; if (s.currentIndex < s.typeJournals.length - 1) s.safeNavigate(() => s.openEdit(s.typeJournals[s.currentIndex + 1])); } },
      last: { supported: true as const, allowed: true, stateEnabled: inForm && typeJournals.length > 0, disabledReason: "لا توجد دفاتر", onClick: () => { const s = _djpRef.current; const l = s.typeJournals.at(-1); if (l) s.safeNavigate(() => s.openEdit(l)); } },
      approve: { supported: false as const, disabledReason: "الاعتماد غير متاح لدفاتر المستندات" },
      cancel: { supported: false as const, disabledReason: "غير متاح" },
      preview: { supported: true as const, allowed: true, stateEnabled: inForm, disabledReason: "اختر دفترًا أولًا", onClick: () => _djpRef.current.handleMutalaah() },
      tools: { supported: false as const, disabledReason: "الأدوات غير متاحة هنا" },
      send: { supported: false as const, disabledReason: "الإرسال غير متاح هنا" },
      print: { supported: true as const, allowed: true, stateEnabled: inForm && hasEdit, disabledReason: "افتح دفترًا أولًا للطباعة", onClick: () => _djpRef.current.handlePrint() },
      exit: { supported: true as const, allowed: true, stateEnabled: inForm, disabledReason: "أنت في قائمة الدفاتر بالفعل", onClick: () => { const s = _djpRef.current; s.safeNavigate(() => { s.setView("list"); s.setEditId(null); }); } },
    };
  }, [view, editId, isBusy, typeJournals, currentIndex]);
  // في وضع القائمة: سجّل الإجراءات في السياق الخارجي
  // في وضع النموذج: فرّغ السياق الخارجي — الإجراءات تُسجَّل داخل نافذة العمل عبر DJPFormToolbarRegistrar
  // نستخدم useMemo لإرجاع كائن ثابت في وضع النموذج — أي كائن حرفي {} جديد سيولّد حلقة لا نهائية
  const [emptyActions] = React.useState<Parameters<typeof useToolbarActions>[0]>({});
  useToolbarActions(view === "list" ? toolbarActions : emptyActions);

  /* ──────────────── RENDER ──────────────── */
  return (
    <div className={`${styles.screenContainer} flex h-full gap-0 overflow-hidden`} dir="rtl">

      {/* ══ Type Sidebar ══ */}
      <div className="shrink-0 flex flex-col overflow-hidden"
        style={{ width: 180, background: "#EBE7DE", borderLeft: "1px solid #ddd8ce" }}>
        <div className="px-3 py-2 shrink-0"
          style={{ borderBottom: "1px solid #d8d3c8", background: "#E4E0D6" }}>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">نوع الدفتر</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {DOC_TYPES.map(dt => {
            const active = selectedType === dt.id;
            const count  = allJournals.filter(j => j.docType === dt.id).length;
            return (
              <button key={dt.id}
                onClick={() => safeNavigate(() => { setSelectedType(dt.id); setView("list"); setEditId(null); })}
                className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-right transition-colors"
                style={{
                  background: active ? "#dbeafe" : "transparent",
                  color: active ? "#1d4ed8" : "#475569",
                  borderRight: active ? "2px solid #3b82f6" : "2px solid transparent",
                }}>
                <span style={{ color: active ? "#3b82f6" : "#94a3b8", flexShrink: 0 }}>{dt.icon}</span>
                <span className="text-[11px] truncate flex-1">{dt.label}</span>
                {count > 0 && (
                  <span className="text-[9px] font-bold px-1 rounded-full shrink-0"
                    style={{ background: active ? "#bfdbfe" : "#f1f5f9", color: active ? "#1e40af" : "#64748b" }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══ Main Area ══ */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-background">

        {/* ─────────────── List View (دائمًا مرئية) ─────────────── */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-[14px] font-bold text-slate-700">دفاتر — {currentType?.label}</h2>
                  <p className="text-[10px] text-slate-400">{typeJournals.length} دفتر</p>
                </div>
              </div>
              <button onClick={openCreate}
                className="flex items-center gap-1.5 px-3 h-8 rounded-md bg-indigo-600 text-white text-[11px] font-medium hover:bg-indigo-700 shadow-sm transition-colors">
                <Plus className="w-3.5 h-3.5" /> دفتر جديد
              </button>
            </div>

            {listQuery.isLoading ? (
              <div className="text-center text-slate-400 text-[11px] py-12">جاري التحميل…</div>
            ) : typeJournals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6 text-indigo-300" />
                </div>
                <p className="text-[13px] font-medium text-slate-400">لا توجد دفاتر لـ {currentType?.label}</p>
                <p className="text-[11px] text-slate-300 mt-1">اضغط "دفتر جديد" لإضافة أول دفتر</p>
                <button onClick={openCreate}
                  className="mt-4 flex items-center gap-1.5 px-4 h-8 rounded-md bg-indigo-600 text-white text-[11px] font-medium hover:bg-indigo-700 shadow-sm">
                  <Plus className="w-3.5 h-3.5" /> دفتر جديد
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {typeJournals.map((j, idx) => (
                  <button key={j.id} onClick={() => openEdit(j)}
                    className="group flex flex-col items-start gap-1 p-3 rounded-lg text-right transition-all hover:shadow-md hover:border-indigo-200"
                    style={{ background: "#FCFAF5", border: "1px solid #d8d3c8", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-[9px] font-bold text-slate-300">#{String(idx + 1).padStart(2, "0")}</span>
                      <span className="flex-1 text-[12px] font-semibold text-slate-700 truncate group-hover:text-indigo-700">
                        {j.name || `دفتر ${currentType?.label} ${idx + 1}`}
                      </span>
                      {j.numberPrefix && (
                        <span className="text-[9px] font-mono text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">
                          {j.numberPrefix}
                        </span>
                      )}
                    </div>
                    {j.name2 && <span className="text-[10px] text-slate-400 truncate w-full" dir="ltr">{j.name2}</span>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">مستعد</span>
                      {j.autoSerial && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">تسلسل تلقائي</span>
                      )}
                      {j.currentSeq > 0 && (
                        <span className="text-[9px] text-slate-400">آخر رقم: {j.currentSeq}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ─────────────── Form View in Work Window ─────────────── */}
          {view === "form" && (
            <DesktopWorkWindow
              title={editId ? (form.nameAr || `دفتر ${currentType?.label}`) : `دفتر جديد — ${currentType?.label}`}
              preset="standard"
              defaultSize={{ width: 1080, height: 650 }}
              autoMaximize={false}
              fitMode="clamp"
              minWidth={900}
              minHeight={500}
              widthPad={40}
              heightPad={32}
              onClose={() => safeNavigate(() => { setView("list"); setEditId(null); })}
            >
              {/* يُسجّل إجراءات النموذج في ToolbarActionsProvider الداخلي لنافذة العمل */}
              <DJPFormToolbarRegistrar actions={toolbarActions} />
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Form header */}
            <div className="flex items-center gap-2 px-4 py-2 shrink-0"
              style={{ borderBottom: "1px solid #d8d3c8", background: "#F2F0EC" }}>
              <button onClick={() => safeNavigate(() => { setView("list"); setEditId(null); })}
                className="w-5 h-5 flex items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
                <ArrowLeft className="w-2.5 h-2.5" />
              </button>
              <span className="text-[12px] font-bold text-slate-600">
                {editId ? (form.nameAr || `دفتر ${currentType?.label}`) : `دفتر جديد — ${currentType?.label}`}
              </span>
              {editId && (
                <span className="text-[10px] text-slate-400">({currentIndex + 1} / {typeJournals.length})</span>
              )}
              {isDirty && <span className="text-[10px] text-amber-600 mr-auto">● تعديلات غير محفوظة</span>}
            </div>

            {/* ── Tabs Bar ── */}
            <div className="flex items-center gap-0 shrink-0" style={{ borderBottom: "1px solid #D8DCE2", background: "#F2F0EC" }} dir="rtl">
              {[
                { id: "basic",             label: "البيانات الأساسية" },
                { id: "payment-types",     label: "أنواع السندات" },
                { id: "accounting-links",  label: "الروابط المحاسبية" },
                { id: "issuance",          label: "خصائص السندات المصدرة" },
                { id: "options",           label: "خيارات" },
                { id: "doc-components",    label: "مكونات المستند" },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`${sharedForm.tabButton} ${activeTab === tab.id ? sharedForm.tabButtonActive : ""}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Tab Content ── */}
            <ActiveFieldCtx.Provider value={{ state: activeField, set: setActiveField }}>
            <div className="flex-1 overflow-hidden">

            {/* ── TAB: البيانات الأساسية ── */}
            {activeTab === "basic" && (
            <div className="h-full overflow-y-auto p-4 space-y-3">

              {/* ── بيانات الدفتر ── */}
              <P title="البيانات الأساسية">
                <div className="grid grid-cols-2 gap-x-5 gap-y-2">
                  <R label="نوع المستند">
                    <FS id="docType" value={form.docType} onValueChange={v => set("docType", v)}>
                      {DOC_TYPES.map(dt => <SelectItem key={dt.id} value={dt.id}>{dt.label}</SelectItem>)}
                    </FS>
                  </R>
                  <R label="إسم عربي *">
                    <FI value={form.nameAr} onChange={v => set("nameAr", v)} placeholder={`دفتر ${currentType?.label}`} />
                  </R>
                  <R label="إسم إنجليزي">
                    <FI value={form.nameEn} onChange={v => set("nameEn", v)} placeholder="Journal Name in English" />
                  </R>
                  <div className="flex items-center col-span-2">
                    <CB label="نقل الملكية أوتوماتيكي" checked={form.transferOwnership} onChange={v => set("transferOwnership", v)} />
                  </div>
                </div>
              </P>

              {/* ── حدود الاستخدام + ربط العملاء والموردين (جنباً إلى جنب) ── */}
              <div className="grid grid-cols-2 gap-3">
                <P title="حدود الاستخدام">
                  <div className="grid grid-cols-1 gap-y-2">
                    <R label="مجموعة مستخدمين" lw={130}>
                      <FS id="userGroup" value={form.userGroup} onValueChange={v => set("userGroup", v)}>
                        {(userGroupsList ?? []).map(g => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
                      </FS>
                    </R>
                    <R label="مستخدم" lw={130}>
                      <FS id="user" value={form.user} onValueChange={v => set("user", v)}>
                        {(users as any[])?.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                      </FS>
                    </R>
                    <R label="مخزن" lw={130}>
                      <FS id="warehouse" value={form.warehouse} onValueChange={v => set("warehouse", v)} previewPage="/cfg/warehouses" previewLabel="المخازن">
                        {(warehousesList as any[])?.map((w: any) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                      </FS>
                    </R>
                  </div>
                  <div className="mt-2">
                    <CB label="للمستندات التي يصدرها النظام فقط" checked={form.systemOnly} onChange={v => set("systemOnly", v)} />
                  </div>
                </P>

                <P title="ربط العملاء والموردين بالدفتر">
                  <div className="grid grid-cols-1 gap-y-2">
                    <R label="تكويد العملاء" lw={120}>
                      <FS id="customersJournal" value={form.customersJournal} onValueChange={v => set("customersJournal", v)}>
                        <SelectItem value="none">— بدون ربط —</SelectItem>
                        {(custJournalsList as any[] ?? []).map((j: any) => (
                          <SelectItem key={j.id} value={String(j.id)}>
                            {j.numberPrefix ? `${j.numberPrefix} — ${j.name}` : j.name}
                          </SelectItem>
                        ))}
                      </FS>
                    </R>
                    <R label="تكويد الموردين" lw={120}>
                      <FS id="suppliersJournal" value={form.suppliersJournal} onValueChange={v => set("suppliersJournal", v)}>
                        <SelectItem value="none">— بدون ربط —</SelectItem>
                        {(suppJournalsList as any[] ?? []).map((j: any) => (
                          <SelectItem key={j.id} value={String(j.id)}>
                            {j.numberPrefix ? `${j.numberPrefix} — ${j.name}` : j.name}
                          </SelectItem>
                        ))}
                      </FS>
                    </R>
                  </div>
                  <div className="mt-2 pt-2" style={{ borderTop: "1px solid #f1f5f9" }}>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      يتم ربط الدفتر بدفاتر العملاء والموردين لتحديد نظام تكويد الأرقام عند إنشاء أو تعديل كارتات العملاء والموردين من خلال هذا الدفتر.
                    </p>
                  </div>
                </P>
              </div>

              {/* ── الأرقام والترقيم ── */}
              <P title="الأرقام والترقيم">
                {/* 1) ترقيم المستند الرسمي */}
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-700">ترقيم المستند الرسمي</h4>
                    {editId != null && (
                      <button onClick={() => { setResetMode("official"); setShowReset(true); }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-orange-600 border border-orange-200 hover:bg-orange-50 transition-colors">
                        <RefreshCw className="w-3 h-3" /> إعادة ضبط المسلسل الرسمي
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-x-4 gap-y-2 items-center mb-3">
                    <div className="col-span-4">
                      <CB label="تسلسل أرقام أوتوماتيكي" checked={form.autoSerial} onChange={v => set("autoSerial", v)} />
                    </div>
                    <R label="الجزء الثابت" className="col-span-4">
                      <FI value={form.fixedPart} onChange={v => set("fixedPart", v)} placeholder="S01-" mono />
                    </R>
                    <R label="أول رقم">
                      <FI value={form.firstNum} onChange={v => set("firstNum", v)} placeholder="1" mono />
                    </R>
                    <R label="عدد الخانات">
                      <FI value={form.digits} onChange={v => set("digits", v)} placeholder="6" mono />
                    </R>
                    <R label="آخر رقم">
                      <FI value={form.lastNum} onChange={v => set("lastNum", v)} placeholder="999999" mono />
                    </R>
                    <R label="آخر رقم مستخدم">
                      <FI value={currentDBJournal ? String(currentDBJournal.currentSeq) : "0"} onChange={() => {}} disabled mono />
                    </R>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 items-center pt-2" style={{ borderTop: "1px solid #e2e8f0" }}>
                    <R label="إعادة الترقيم" lw={110}>
                      <FS id="resetFrequency" value={form.resetFrequency} onValueChange={v => set("resetFrequency", v)}>
                        <SelectItem value="none">بدون إعادة</SelectItem>
                        <SelectItem value="daily">يومي</SelectItem>
                        <SelectItem value="monthly">شهري</SelectItem>
                        <SelectItem value="annual">سنوي</SelectItem>
                      </FS>
                    </R>
                    {/* معاينة الرقم */}
                    <div className="flex items-center gap-2">
                      <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-[10px] text-slate-400 shrink-0">معاينة:</span>
                      <span className="font-mono text-[13px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {buildPreview(form.fixedPart, form.firstNum, form.digits)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* فاصل أفقي واضح */}
                <hr className="border-slate-300 my-4" />

                {/* 2) ترقيم المسودات */}
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-700">ترقيم المسودات</h4>
                    {editId != null && (
                      <button onClick={() => { setResetMode("draft"); setShowReset(true); }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-orange-600 border border-orange-200 hover:bg-orange-50 transition-colors">
                        <RefreshCw className="w-3 h-3" /> إعادة ضبط مسلسل المسودات
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-x-4 gap-y-2 items-center mb-3">
                    <div className="col-span-4">
                      <CB label="تفعيل الترقيم التلقائي للمسودات" checked={form.draftAutoSerial} onChange={v => set("draftAutoSerial", v)} />
                    </div>
                    <R label="الجزء الثابت للمسودة" className="col-span-4">
                      <FI value={form.draftFixedPart} onChange={v => set("draftFixedPart", v)} placeholder="DRAFT-" mono />
                    </R>
                    <R label="أول رقم مسودة">
                      <FI value={form.draftFirstNum} onChange={v => set("draftFirstNum", v)} placeholder="1" mono />
                    </R>
                    <R label="عدد الخانات">
                      <FI value={form.draftDigits} onChange={v => set("draftDigits", v)} placeholder="6" mono />
                    </R>
                    <R label="آخر رقم مسودة">
                      <FI value={form.draftLastNum} onChange={v => set("draftLastNum", v)} placeholder="999999" mono />
                    </R>
                    <R label="آخر رقم مسودة مستخدم">
                      <FI value={currentDBJournal ? String((currentDBJournal as any).draftCurrentSeq ?? 0) : "0"} onChange={() => {}} disabled mono />
                    </R>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 items-center pt-2" style={{ borderTop: "1px solid #e2e8f0" }}>
                    <R label="إعادة ترقيم المسودات" lw={110}>
                      <FS id="draftResetFrequency" value={form.draftResetFrequency} onValueChange={v => set("draftResetFrequency", v)}>
                        <SelectItem value="none">بدون إعادة</SelectItem>
                        <SelectItem value="daily">يومي</SelectItem>
                        <SelectItem value="monthly">شهري</SelectItem>
                        <SelectItem value="annual">سنوي</SelectItem>
                      </FS>
                    </R>
                    {/* معاينة رقم المسودة */}
                    <div className="flex items-center gap-2">
                      <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-[10px] text-slate-400 shrink-0">معاينة:</span>
                      <span className="font-mono text-[13px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {buildPreview(form.draftFixedPart, form.draftFirstNum, form.draftDigits)}
                      </span>
                    </div>
                  </div>
                </div>
              </P>

              {/* ── خيارات الطباعة ── */}
              <div className="grid grid-cols-2 gap-3">
                <P title="نماذج الطباعة">
                  <div className="space-y-2">
                    <R label="النموذج الأساسي">
                      <FS id="printTemplate" value={form.printTemplate} onValueChange={v => set("printTemplate", v)}>
                        {(templates ?? []).map(t => (
                          <SelectItem key={t.code} value={t.code}>
                            {t.code} — {t.nameAr}
                          </SelectItem>
                        ))}
                      </FS>
                    </R>
                    <R label="النموذج الثانوي">
                      <FS id="printTemplate2" value={form.printTemplate2} onValueChange={v => set("printTemplate2", v)}>
                        {(templates ?? []).map(t => (
                          <SelectItem key={t.code} value={t.code}>
                            {t.code} — {t.nameAr}
                          </SelectItem>
                        ))}
                      </FS>
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
            )}

            {/* ── TAB: أنواع السندات ── */}
            {activeTab === "payment-types" && (() => {
              const thCls = "text-[10px] font-semibold text-slate-500 px-2 py-1.5 text-right bg-slate-50 border-b border-slate-200";
              const tdCls = "px-1.5 py-1 border-b border-slate-100";
              const cellInput = (val: string, onChange: (v: string) => void) => (
                <Input value={val} onChange={e => onChange(e.target.value)}
                  className="w-full h-6 text-[11px] px-1.5 border-slate-200 rounded bg-white focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-indigo-400" />
              );
              const selectMasterType = (idx: number, masterId: string) => {
                const master = globalVoucherTypes.find(item => String(item.id) === masterId);
                setPtConfig(p => {
                  const current = p.types[idx];
                  if (!current) return p;
                  if (!masterId || !master) {
                    const newId = `new-${Date.now()}`;
                    const links = p.accountLinksByType[current.id] ?? p.accountLinks;
                    const nextTypes = [...p.types];
                    nextTypes[idx] = { id: newId, nameAr: "", nameEn: "", codeAr: "", codeEn: "" };
                    return {
                      ...p,
                      types: nextTypes,
                      accountLinksByType: {
                        ...Object.fromEntries(Object.entries(p.accountLinksByType).filter(([id]) => id !== current.id)),
                        [newId]: links,
                      },
                    };
                  }
                  if (p.types.some((type, typeIndex) => typeIndex !== idx && type.id === masterId)) {
                    toast.error("نوع السند المركزي مرتبط بالفعل بهذا الدفتر.");
                    return p;
                  }
                  const links = p.accountLinksByType[current.id] ?? p.accountLinks;
                  const nextTypes = [...p.types];
                  nextTypes[idx] = {
                    id: masterId,
                    nameAr: master.nameAr,
                    nameEn: master.nameEn,
                    codeAr: master.codeAr,
                    codeEn: master.codeEn,
                  };
                  return {
                    ...p,
                    types: nextTypes,
                    accountLinksByType: {
                      ...Object.fromEntries(Object.entries(p.accountLinksByType).filter(([id]) => id !== current.id)),
                      [masterId]: links,
                    },
                  };
                });
                setIsDirty(true);
              };
              const addType = () => {
                const newId = `new-${Date.now()}`;
                setPtConfig(p => {
                  const newType: PaymentTypeRow = { id: newId, nameAr: "", nameEn: "", codeAr: "", codeEn: "" };
                  const sourceLinks = p.accountLinksByType[p.types[0]?.id] ?? p.accountLinks;
                  return {
                    ...p,
                    types: [...p.types, newType],
                    accountLinksByType: {
                      ...p.accountLinksByType,
                      [newId]: cloneLinksForType(sourceLinks, newId),
                    },
                  };
                });
                setIsDirty(true);
              };
              const removeType = (idx: number) => {
                setPtConfig(p => {
                  const removedId = p.types[idx]?.id;
                  return {
                    ...p,
                    types: p.types.filter((_, i) => i !== idx),
                    accountLinksByType: Object.fromEntries(
                      Object.entries(p.accountLinksByType).filter(([typeId]) => typeId !== removedId),
                    ),
                  };
                });
                setIsDirty(true);
              };
              const patchType = (idx: number, patch: Partial<PaymentTypeRow>) => {
                setPtConfig(p => { const t = [...p.types]; t[idx] = { ...t[idx], ...patch }; return { ...p, types: t }; });
                setIsDirty(true);
              };
              const addLink = () => {
                const newId = String(Date.now());
                setPtConfig(p => ({ ...p, accountLinks: [...p.accountLinks, { id: newId, description: "", postingName: "", accountId: null, postingSide: "" }] }));
                setIsDirty(true);
              };
              const removeLink = (idx: number) => {
                setPtConfig(p => ({ ...p, accountLinks: p.accountLinks.filter((_, i) => i !== idx) }));
                setIsDirty(true);
              };
              const patchLink = (idx: number, patch: Partial<AccountLinkRow>) => {
                setPtConfig(p => { const a = [...p.accountLinks]; a[idx] = { ...a[idx], ...patch }; return { ...p, accountLinks: a }; });
                setIsDirty(true);
              };
              return (
                <div className="h-full overflow-y-auto p-4 space-y-4" dir="rtl">

                  {/* ─── جدول 1: النوع ─── */}
                  <P title="النوع">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={thCls}>النوع المركزي</th>
                          <th className={thCls}>الاسم العربي</th>
                          <th className={thCls}>الاسم الإنجليزي</th>
                          <th className={thCls}>كود عربي</th>
                          <th className={thCls}>كود إنجليزي</th>
                          <th className="w-6 bg-slate-50 border-b border-slate-200"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {ptConfig.types.map((row, i) => (
                          <tr key={row.id} className="hover:bg-slate-50/50">
                            <td className={tdCls}>
                              <select
                                value={globalVoucherTypes.some(item => String(item.id) === row.id) ? row.id : "__new__"}
                                onChange={e => selectMasterType(i, e.target.value === "__new__" ? "" : e.target.value)}
                                className="w-full h-6 text-[10px] border border-slate-200 rounded bg-white px-1 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                              >
                                <option value="__new__">نوع جديد</option>
                                {globalVoucherTypes.map(item => (
                                  <option key={item.id} value={String(item.id)}>
                                    {item.nameAr || item.codeEn || `نوع ${item.id}`}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className={tdCls}>{cellInput(row.nameAr, v => patchType(i, { nameAr: v }))}</td>
                            <td className={tdCls}>{cellInput(row.nameEn, v => patchType(i, { nameEn: v }))}</td>
                            <td className={tdCls}>{cellInput(row.codeAr, v => patchType(i, { codeAr: v }))}</td>
                            <td className={tdCls}>{cellInput(row.codeEn, v => patchType(i, { codeEn: v }))}</td>
                            <td className={`${tdCls} text-center`}>
                              <button onClick={() => removeType(i)}
                                className="w-5 h-5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 text-[13px] leading-none flex items-center justify-center">×</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={6} className="px-2 py-1.5">
                            <button onClick={addType}
                              className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                              <span className="text-[14px] leading-none">+</span> إضافة نوع آخر
                            </button>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </P>

                </div>
              );
            })()}

            {/* ── TAB: الروابط المحاسبية ── */}
            {activeTab === "accounting-links" && (() => {
              const thCls = "text-[10px] font-semibold text-slate-500 px-2 py-1.5 text-right bg-slate-50 border-b border-slate-200";
              const tdCls = "px-1.5 py-1 border-b border-slate-100";
              const cellInput = (val: string, onChange: (v: string) => void) => (
                <Input value={val} onChange={e => onChange(e.target.value)}
                  className="w-full h-6 text-[11px] px-1.5 border-slate-200 rounded bg-white focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-indigo-400" />
              );
              const addLink = (typeId: string) => {
                const newId = String(Date.now());
                setPtConfig(p => {
                  const links = p.accountLinksByType[typeId] ?? [];
                  return {
                    ...p,
                    accountLinksByType: {
                      ...p.accountLinksByType,
                      [typeId]: [...links, { id: newId, description: "", postingName: "", accountId: null, postingSide: "" }],
                    },
                  };
                });
                setIsDirty(true);
              };
              const removeLink = (typeId: string, idx: number) => {
                setPtConfig(p => ({
                  ...p,
                  accountLinksByType: {
                    ...p.accountLinksByType,
                    [typeId]: (p.accountLinksByType[typeId] ?? []).filter((_, i) => i !== idx),
                  },
                }));
                setIsDirty(true);
              };
              const patchLink = (typeId: string, idx: number, patch: Partial<AccountLinkRow>) => {
                setPtConfig(p => {
                  const links = [...(p.accountLinksByType[typeId] ?? [])];
                  links[idx] = { ...links[idx], ...patch };
                  return { ...p, accountLinksByType: { ...p.accountLinksByType, [typeId]: links } };
                });
                setIsDirty(true);
              };
              const renderLinksTable = (typeId: string, links: AccountLinkRow[]) => (
                <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
                  <thead>
                    <tr>
                      <th className={thCls} style={{ width: 28 }}>#</th>
                      <th className={thCls} style={{ width: "23%" }}>بيان<br/><span className="font-normal text-[9px] text-slate-400">Description</span></th>
                      <th className={thCls} style={{ width: "18%" }}>مصدر البيانات<br/><span className="font-normal text-[9px] text-slate-400">Source Field</span></th>
                      <th className={thCls} style={{ width: 110, borderRight: "1px solid #e2e8f0" }}>كود الحساب<br/><span className="font-normal text-[9px] text-slate-400">Account Code</span></th>
                      <th className={thCls}>اسم الحساب<br/><span className="font-normal text-[9px] text-slate-400">Account Name</span></th>
                      <th className={thCls} style={{ width: 100 }}>اتجاه القيد<br/><span className="font-normal text-[9px] text-slate-400">Posting Side</span></th>
                      <th className="w-6 bg-slate-50 border-b border-slate-200"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {links.map((row, i) => {
                      const acct = (chartAccounts as any[]).find((a: any) => a.id === row.accountId);
                      const even = i % 2 === 0;
                      return (
                        <tr key={row.id}
                          style={{ background: even ? "#ffffff" : "#f1f3f5", borderBottom: "1px solid #e2e8f0" }}
                          className="hover:bg-slate-50/50"
                        >
                          <td className="px-2 py-1 text-[11px] text-slate-400 text-center">{i + 1}</td>
                          <td className={tdCls}>{cellInput(row.description, v => patchLink(typeId, i, { description: v }))}</td>
                          <td className="py-0" style={{ borderRight: "1px solid #eef2f7", borderLeft: "1px solid #eef2f7" }}>
                            <FieldCodeSearch
                              allFields={fieldDictList as any[]}
                              selectedCode={row.postingName}
                              onChange={v => patchLink(typeId, i, { postingName: v })}
                              filterType="Amount"
                            />
                          </td>
                          <td className="py-0" style={{ borderRight: "1px solid #eef2f7", borderLeft: "1px solid #eef2f7" }}>
                            <AccCodeSearch
                              allAccounts={chartAccounts as any[]}
                              selectedId={row.accountId}
                              onChange={v => patchLink(typeId, i, { accountId: v })}
                            />
                          </td>
                          <td className="px-2 py-1 text-[11px] text-slate-600 truncate" style={{ maxWidth: 160 }}>
                            {acct?.name ?? <span className="text-slate-300">—</span>}
                          </td>
                          <td className="py-0 px-1">
                            <select
                              value={row.postingSide}
                              onChange={e => patchLink(typeId, i, { postingSide: e.target.value })}
                              className="w-full h-7 text-[11px] bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 cursor-pointer"
                              style={{ direction: "rtl" }}
                            >
                              <option value="">— اختر —</option>
                              <option value="debit">مدين (Debit)</option>
                              <option value="credit">دائن (Credit)</option>
                            </select>
                          </td>
                          <td className={`${tdCls} text-center`}>
                            <button onClick={() => removeLink(typeId, i)}
                              className="w-5 h-5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 text-[13px] leading-none flex items-center justify-center">×</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={7} className="px-2 py-1.5">
                        <button onClick={() => addLink(typeId)}
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                          <span className="text-[14px] leading-none">+</span> إضافة حساب
                        </button>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              );
              return (
                <div className="h-full overflow-y-auto p-4 space-y-4" dir="rtl">
                  {ptConfig.types.length > 0 ? ptConfig.types.map(type => {
                    const links = ptConfig.accountLinksByType[type.id] ?? [];
                    return (
                      <div
                        key={type.id}
                        className="rounded-lg border border-[#ddd8ce] bg-[#F2F0EC] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden"
                      >
                        <div className="grid grid-cols-5 gap-x-3 px-3 py-2 border-b border-[#b8aea3] text-center" dir="rtl">
                            <div className="min-w-0 text-center">
                              <div className="text-[12px] font-medium text-[#806c5a] mb-0.5">نوع السند</div>
                              <div className="text-[12px] font-semibold text-[#3A3030] truncate">
                                {type.nameAr || "نوع سند جديد"}
                              </div>
                            </div>
                            <div className="min-w-0 text-center">
                              <div className="text-[12px] font-medium text-[#806c5a] mb-0.5">الاسم العربي</div>
                              <div className="text-[12px] text-slate-700 truncate">
                                {type.nameAr || <span className="text-slate-300">—</span>}
                              </div>
                            </div>
                            <div className="min-w-0 text-center">
                              <div className="text-[12px] font-medium text-[#806c5a] mb-0.5">الاسم الإنجليزي</div>
                              <div className="text-[12px] text-slate-600 truncate text-center" dir="ltr">
                                {type.nameEn || <span className="text-slate-300">—</span>}
                              </div>
                            </div>
                            <div className="min-w-0 text-center">
                              <div className="text-[12px] font-medium text-[#806c5a] mb-0.5">كود عربي</div>
                              <div className="text-[12px] font-mono text-slate-600 truncate">
                                {type.codeAr || <span className="text-slate-300">—</span>}
                              </div>
                            </div>
                            <div className="min-w-0 text-center">
                              <div className="text-[12px] font-medium text-[#806c5a] mb-0.5">كود إنجليزي</div>
                              <div className="text-[12px] font-mono text-slate-600 truncate text-center" dir="ltr">
                                {type.codeEn || <span className="text-slate-300">—</span>}
                              </div>
                            </div>
                        </div>
                        <div>
                          <div className="px-3.5 py-2 border-b border-[#ddd8ce] bg-gradient-to-b from-[#F2F0EC] to-[#EDE9E2]">
                            <span className="text-[13px] font-bold text-[#3A3030]">
                              الروابط المحاسبية{type.nameAr ? ` — ${type.nameAr}` : ""}
                            </span>
                          </div>
                          {renderLinksTable(type.id, links)}
                        </div>
                      </div>
                    );
                  }) : (
                    <P title="الروابط المحاسبية">
                      <div className="py-8 text-center text-[11px] text-slate-400">
                        أضف نوع سند أولاً من تبويب «أنواع السندات» لتكوين روابطه المحاسبية.
                      </div>
                    </P>
                  )}
                </div>
              );
            })()}

            {/* ── TAB: خصائص السندات المصدرة ── */}
            {activeTab === "issuance" && (
            <div className="h-full overflow-y-auto p-4 space-y-3" dir="rtl">

              {/* قسم 2: خصائص السندات المصدرة */}
              <P title="خصائص السندات المصدرة">
                <div className="grid grid-cols-2 gap-x-5 gap-y-2.5">
                  <R label="نوع القيد" lw={145}>
                    <FS id="issuanceJournalType" value={form.issuanceJournalType} onValueChange={v => set("issuanceJournalType", v)}>
                      {DOC_TYPES.map(dt => <SelectItem key={dt.id} value={dt.id}>{dt.label}</SelectItem>)}
                    </FS>
                  </R>
                  <R label="دفتر القيد" lw={145}>
                    <FS id="issuanceJournalBookId" value={form.issuanceJournalBookId} onValueChange={v => set("issuanceJournalBookId", v)}>
                      {allJournals.map(j => (
                          <SelectItem key={j.id} value={String(j.id)}>
                            {j.numberPrefix ? `${j.numberPrefix} — ${j.name}` : j.name}
                          </SelectItem>
                        ))}
                    </FS>
                  </R>
                  <R label="نوع مستند المخزون" lw={145}>
                    <FS id="issuanceInventoryDocType" value={form.issuanceInventoryDocType} onValueChange={v => { set("issuanceInventoryDocType", v); set("issuanceInventoryDocBookId", ""); }}>
                      {DOC_TYPES.filter(dt => ["stock_issue_items","stock_receipt_items","stock_transfer","stock_receipt","stock_issue"].includes(dt.id))
                        .map(dt => <SelectItem key={dt.id} value={dt.id}>{dt.label}</SelectItem>)}
                    </FS>
                  </R>
                  <R label="دفتر مستند المخزون" lw={145}>
                    <FS id="issuanceInventoryDocBookId" value={form.issuanceInventoryDocBookId} onValueChange={v => set("issuanceInventoryDocBookId", v)}>
                      {allJournals
                        .filter(j => !form.issuanceInventoryDocType || j.docType === form.issuanceInventoryDocType)
                        .map(j => (
                          <SelectItem key={j.id} value={String(j.id)}>
                            {j.numberPrefix ? `${j.numberPrefix} — ${j.name}` : j.name}
                          </SelectItem>
                        ))}
                    </FS>
                  </R>
                </div>
              </P>

              {/* قسم 3: خيارات المستند */}
              <P title="خيارات المستند">
                <div className="space-y-2">
                  <CB label="السماح بفك الترحيل"              checked={form.allowUnpost}        onChange={v => set("allowUnpost", v)} />
                  <CB label="السماح بالتعديل بعد الترحيل"     checked={form.allowEditAfterPost}  onChange={v => set("allowEditAfterPost", v)} />
                </div>
              </P>

            </div>
            )}

            {/* ── TAB: خيارات ── */}
            {activeTab === "options" && (
            <div className="h-full overflow-y-auto p-4 space-y-3" dir="rtl">
              <P title="خيارات المستند">

                {/* سطر الطباعة */}
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-[11px] text-slate-500 font-medium shrink-0" style={{ width: 100 }}>نموذج الطباعة</span>
                  <FS id="printPageSize" value={form.printPageSize} onValueChange={v => set("printPageSize", v)} placeholder="نموذج الطباعة">
                    <SelectItem value="A4">A4</SelectItem>
                    <SelectItem value="A5">A5</SelectItem>
                    <SelectItem value="letter">Letter</SelectItem>
                  </FS>
                  <CB label="طباعة حرارية" checked={form.thermalPrint} onChange={v => set("thermalPrint", v)} />
                  <div className="flex items-center gap-1.5">
                    <FI value={form.thermalWidth} onChange={v => set("thermalWidth", v)} placeholder="80mm" mono />
                  </div>
                </div>

                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 10, marginBottom: 4 }}>
                  {/* صف الخيارات الأول */}
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-2.5">
                    <CB label="متابعة الكميات بالفواتير"  checked={form.trackQuantity}           onChange={v => set("trackQuantity", v)} />
                    <CB label="بدون ضريبة"                checked={form.noTax}                   onChange={v => set("noTax", v)} />
                    <CB label="إحصاءات للبائع"            checked={form.salesmanStats}           onChange={v => set("salesmanStats", v)} />
                    <CB label="إحصاءات للصنف"             checked={form.itemStats}               onChange={v => set("itemStats", v)} />
                    <CB label="إحصاءات عميل/مورد"         checked={form.customerSupplierStats}   onChange={v => set("customerSupplierStats", v)} />
                  </div>
                  {/* صف الخيارات الثاني */}
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <CB label="إمنع الصرف بدون رصيد مخزني" checked={form.preventNegativeInventory} onChange={v => set("preventNegativeInventory", v)} />
                    <CB label="يجب إدخال الملاحظة"           checked={form.requireNote}             onChange={v => set("requireNote", v)} />
                    <CB label="منع التعديل إذا كانت مرتبطة"  checked={form.preventEditIfLinked}     onChange={v => set("preventEditIfLinked", v)} />
                    <CB label="يجب إدخال كود العميل أو المورد" checked={form.requireCustomerCode}   onChange={v => set("requireCustomerCode", v)} />
                    <CB label="يجب إدخال كود الموظف"          checked={form.requireEmployeeCode}    onChange={v => set("requireEmployeeCode", v)} />
                  </div>
                </div>

              </P>

              {/* ── خيارات الأصناف ── */}
              <P title="خيارات الأصناف">
                <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
                  <R label="أقصى عدد الوحدات" lw={160}>
                    <FS id="maxUnitsCount" value={form.maxUnitsCount} onValueChange={v => set("maxUnitsCount", v)}>
                      <SelectItem value="1">وحدة واحدة</SelectItem>
                      <SelectItem value="2">وحدتان</SelectItem>
                      <SelectItem value="3">ثلاث وحدات</SelectItem>
                    </FS>
                  </R>
                  <R label="وحدة البيع المقترحة" lw={160}>
                    <FI value={form.suggestedSalesUnit} onChange={v => set("suggestedSalesUnit", v)} placeholder="مثال: قطعة" />
                  </R>
                  <R label="فترة الارتجاع (يوم)" lw={160}>
                    <FI value={form.returnPeriodDays} onChange={v => set("returnPeriodDays", v)} placeholder="0" mono />
                  </R>
                  <div className="flex items-center pt-1">
                    <CB label="استخدام وحدات السعر فقط" checked={form.usePriceUnitsOnly} onChange={v => set("usePriceUnitsOnly", v)} />
                  </div>
                </div>
              </P>

              {/* ── خيارات سندات المبيعات ── */}
              <P title="خيارات سندات المبيعات والمشتريات">
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  <CB label="عرض عمود المخزن"         checked={form.showWarehouseCol}         onChange={v => set("showWarehouseCol", v)} />
                  <CB label="عرض عمود الوحدات"        checked={form.showUnitCol}              onChange={v => set("showUnitCol", v)} />
                  <CB label="حساب أسعار البيع آلياً"   checked={form.autoCalcPrices}           onChange={v => set("autoCalcPrices", v)} />
                  <CB label="تعديل أسماء الأصناف"      checked={form.editItemNames}            onChange={v => set("editItemNames", v)} />
                  <CB label="تعديل أسماء الخدمات"      checked={form.editServiceNames}         onChange={v => set("editServiceNames", v)} />
                  <CB label="اقتراح آخر سعر شراء"      checked={form.suggestLastBuyPrice}      onChange={v => set("suggestLastBuyPrice", v)} />
                  <CB label="اقتراح آخر أمر شراء"      checked={form.suggestLastPurchaseOrder} onChange={v => set("suggestLastPurchaseOrder", v)} />
                  <CB label="البيع بعملات أجنبية"       checked={form.allowForeignCurrency}     onChange={v => set("allowForeignCurrency", v)} />
                </div>
              </P>

              {/* ── خيارات الكميات ── */}
              <P title="خيارات الكميات">
                <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
                  <R label="الكمية المتاحة" lw={140}>
                    <FS id="availableQtyDisplay" value={form.availableQtyDisplay} onValueChange={v => set("availableQtyDisplay", v)}>
                      <SelectItem value="show">إظهار</SelectItem>
                      <SelectItem value="hide">إخفاء</SelectItem>
                    </FS>
                  </R>
                  <R label="الكمية الموجودة" lw={140}>
                    <FS id="currentQtyDisplay" value={form.currentQtyDisplay} onValueChange={v => set("currentQtyDisplay", v)}>
                      <SelectItem value="show">إظهار</SelectItem>
                      <SelectItem value="hide">إخفاء</SelectItem>
                    </FS>
                  </R>
                  <div className="flex items-center col-span-2 pt-1">
                    <CB label="السماح بالسحب على المكشوف (بدون رصيد)" checked={form.allowOverdraft} onChange={v => set("allowOverdraft", v)} />
                  </div>
                </div>
              </P>

              {/* ── اتساع الأعمدة ── */}
              <P title="اتساع أعمدة الأصناف">
                <div className="grid grid-cols-4 gap-x-4 gap-y-2.5">
                  <R label="كود الصنف" lw={80}>
                    <FI value={form.colWidthItemCode} onChange={v => set("colWidthItemCode", v)} placeholder="0" mono />
                  </R>
                  <R label="اسم الصنف" lw={80}>
                    <FI value={form.colWidthItemName} onChange={v => set("colWidthItemName", v)} placeholder="32" mono />
                  </R>
                  <R label="الوحدة" lw={60}>
                    <FI value={form.colWidthUnit} onChange={v => set("colWidthUnit", v)} placeholder="12" mono />
                  </R>
                  <R label="الحساب" lw={60}>
                    <FI value={form.colWidthAccount} onChange={v => set("colWidthAccount", v)} placeholder="25" mono />
                  </R>
                </div>
              </P>

            </div>
            )}

            {/* ── TAB: مكونات المستند ── */}
            {activeTab === "doc-components" && (
            <div className="h-full overflow-y-auto p-4" dir="rtl">

              {/* ── شرح ── */}
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5">
                <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
                </svg>
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  حدد المكونات التي تظهر في هذا الدفتر (الإجماليات، طرق الدفع، …).
                  يُختار كل مكوّن من <strong>قاموس الحقول</strong>، ويمكن التحكم في ظهوره داخل المستند والطباعة والقوالب والتقارير.
                </p>
              </div>

              {/* ── شريط الإضافة ── */}
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[12px] font-bold text-slate-700">
                  المكونات ({docComponents.length})
                </span>
                <button
                  onClick={() => {
                    const next = docComponents.length > 0
                      ? Math.max(...docComponents.map(c => c.sortOrder)) + 10
                      : 10;
                    setDocComponents(prev => [...prev, {
                      sortOrder: next,
                      fieldCode: "",
                      nameAr: "",
                      nameEn: "",
                      showInDocument: true,
                      showInPrint: true,
                      showInTemplates: false,
                      showInReports: false,
                    }]);
                    setIsDirty(true);
                  }}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold text-white transition-colors"
                  style={{ background: "#406B93" }}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  إضافة مكوّن
                </button>
              </div>

              {/* ── الجدول ── */}
              {docComponents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                  <svg className="w-10 h-10 mb-2 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
                  </svg>
                  <p className="text-[12px]">لا توجد مكونات بعد</p>
                  <p className="text-[11px] mt-1">اضغط "إضافة مكوّن" لإضافة حقل من قاموس الحقول</p>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#F1F5F9" }}>
                        <th className="text-right px-2 py-2 text-[10px] font-bold text-slate-600 border-b border-slate-200 w-14">ترتيب</th>
                        <th className="text-right px-2 py-2 text-[10px] font-bold text-slate-600 border-b border-slate-200 w-44">كود الحقل</th>
                        <th className="text-right px-2 py-2 text-[10px] font-bold text-slate-600 border-b border-slate-200">الاسم</th>
                        <th className="text-center px-1 py-2 text-[10px] font-bold text-slate-600 border-b border-slate-200 w-14">مستند</th>
                        <th className="text-center px-1 py-2 text-[10px] font-bold text-slate-600 border-b border-slate-200 w-14">طباعة</th>
                        <th className="text-center px-1 py-2 text-[10px] font-bold text-slate-600 border-b border-slate-200 w-14">قوالب</th>
                        <th className="text-center px-1 py-2 text-[10px] font-bold text-slate-600 border-b border-slate-200 w-14">تقارير</th>
                        <th className="w-8 border-b border-slate-200"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...docComponents]
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((comp, idx) => {
                          const origIdx = docComponents.indexOf(comp);
                          const updateComp = (patch: Partial<DocComponent>) => {
                            setDocComponents(prev => {
                              const copy = [...prev];
                              copy[origIdx] = { ...copy[origIdx], ...patch };
                              return copy;
                            });
                            setIsDirty(true);
                          };
                          return (
                            <tr
                              key={idx}
                              style={{ background: idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}
                              className="hover:bg-blue-50/40 transition-colors"
                            >
                              {/* الترتيب */}
                              <td className="px-2 py-1.5 border-b border-slate-100">
                                <Input
                                  type="number" min="1" step="1"
                                  value={comp.sortOrder}
                                  onChange={e => updateComp({ sortOrder: parseInt(e.target.value) || 0 })}
                                  className="w-12 h-7 text-center text-[11px] font-mono border-slate-200 rounded px-1 focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-[#406B93]"
                                />
                              </td>
                              {/* كود الحقل */}
                              <td className="px-2 py-1.5 border-b border-slate-100">
                                <select
                                  value={comp.fieldCode}
                                  onChange={e => {
                                    const fc = e.target.value;
                                    const fd = fieldDictList.find((f: any) => f.code === fc);
                                    updateComp({
                                      fieldCode: fc,
                                      nameAr: fd?.nameAr ?? comp.nameAr,
                                      nameEn: fd?.nameEn ?? comp.nameEn,
                                    });
                                  }}
                                  className="w-full h-7 text-[11px] font-mono border border-slate-200 rounded px-1 focus:outline-none focus:border-[#406B93] bg-white"
                                >
                                  <option value="">— اختر حقلاً —</option>
                                  {(() => {
                                    const grouped: Record<string, typeof fieldDictList> = {};
                                    (fieldDictList as any[]).forEach((f: any) => {
                                      if (!grouped[f.category]) grouped[f.category] = [];
                                      grouped[f.category].push(f);
                                    });
                                    return Object.entries(grouped).map(([cat, fields]) => (
                                      <optgroup key={cat} label={cat}>
                                        {(fields as any[]).map((f: any) => (
                                          <option key={f.code} value={f.code}>
                                            {f.code} — {f.nameAr}
                                          </option>
                                        ))}
                                      </optgroup>
                                    ));
                                  })()}
                                </select>
                              </td>
                              {/* الاسم */}
                              <td className="px-2 py-1.5 border-b border-slate-100">
                                <Input
                                  type="text"
                                  value={comp.nameAr}
                                  onChange={e => updateComp({ nameAr: e.target.value })}
                                  placeholder="اسم المكوّن"
                                  className="w-full h-7 text-[11px] border-slate-200 rounded px-2 focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-[#406B93]"
                                />
                              </td>
                              {/* مستند */}
                              <td className="px-1 py-1.5 border-b border-slate-100 text-center">
                                <input
                                  type="checkbox" className="w-3.5 h-3.5 accent-[#406B93] cursor-pointer"
                                  checked={comp.showInDocument}
                                  onChange={e => updateComp({ showInDocument: e.target.checked })}
                                />
                              </td>
                              {/* طباعة */}
                              <td className="px-1 py-1.5 border-b border-slate-100 text-center">
                                <input
                                  type="checkbox" className="w-3.5 h-3.5 accent-[#406B93] cursor-pointer"
                                  checked={comp.showInPrint}
                                  onChange={e => updateComp({ showInPrint: e.target.checked })}
                                />
                              </td>
                              {/* قوالب */}
                              <td className="px-1 py-1.5 border-b border-slate-100 text-center">
                                <input
                                  type="checkbox" className="w-3.5 h-3.5 accent-[#406B93] cursor-pointer"
                                  checked={comp.showInTemplates}
                                  onChange={e => updateComp({ showInTemplates: e.target.checked })}
                                />
                              </td>
                              {/* تقارير */}
                              <td className="px-1 py-1.5 border-b border-slate-100 text-center">
                                <input
                                  type="checkbox" className="w-3.5 h-3.5 accent-[#406B93] cursor-pointer"
                                  checked={comp.showInReports}
                                  onChange={e => updateComp({ showInReports: e.target.checked })}
                                />
                              </td>
                              {/* حذف */}
                              <td className="px-1 py-1.5 border-b border-slate-100 text-center">
                                <button
                                  onClick={() => {
                                    setDocComponents(prev => prev.filter((_, i) => i !== origIdx));
                                    setIsDirty(true);
                                  }}
                                  className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                  title="حذف"
                                >
                                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>
                                    <path d="M9 6V4h6v2"/>
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── ملاحظة الحفظ ── */}
              {docComponents.length > 0 && (
                <p className="mt-3 text-[10px] text-slate-400 text-center">
                  يتم حفظ المكونات مع بيانات الدفتر عند الضغط على زر "حفظ"
                </p>
              )}
            </div>
            )}

            </div>

            {/* ══ Foundation Policy Panel (superadmin only) ══ */}
            {isSuperadmin && (
              <div className="px-4 pb-3">
                <FoundationPolicyPanel
                  recordPolicy={(form.recordPolicy as any) || 'flexible'}
                  foundationKey={form.foundationKey || null}
                  includeInFoundation={form.includeInFoundation}
                  onChange={(policy, include) => {
                    setForm(p => ({ ...p, recordPolicy: policy, includeInFoundation: include }));
                    setIsDirty(true);
                  }}
                />
              </div>
            )}
            </ActiveFieldCtx.Provider>
            {/* end Tab Content */}

          </div>
            </DesktopWorkWindow>
          )}
      </div>

      {/* ══ Unsaved dialog ══ */}
      <Dialog open={showUnsaved} onOpenChange={setShowUnsaved}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle className="text-right text-base">تعديلات غير محفوظة</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500 text-right">يوجد تعديلات غير محفوظة، هل تريد الحفظ قبل المتابعة؟</p>
          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              onClick={() => { setShowUnsaved(false); handleSave(); pendingAction?.(); setPendingAction(null); }}>
              حفظ
            </Button>
            <Button variant="outline" className="flex-1"
              onClick={() => { setIsDirty(false); setShowUnsaved(false); pendingAction?.(); setPendingAction(null); }}>
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
          <DialogHeader><DialogTitle className="text-right text-base">حذف الدفتر</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500 text-right">
            هل تريد حذف دفتر <strong>{form.nameAr}</strong>؟ لا يمكن التراجع.
          </p>
          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={deleteMut.isPending}>حذف</Button>
            <Button variant="outline" className="flex-1" onClick={() => setShowDelete(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ Reset Numbering dialog ══ */}
      <Dialog open={showReset} onOpenChange={setShowReset}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle className="text-right text-base flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-orange-500" />
            {resetMode === "draft" ? "إعادة ضبط ترقيم المسودات" : "إعادة ضبط الترقيم"}
          </DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-slate-600 text-right">
              هل تريد إعادة ضبط {resetMode === "draft" ? "ترقيم المسودات" : "ترقيم دفتر"} <strong>{form.nameAr}</strong>؟
            </p>
            <p className="text-[12px] text-slate-500 text-right">
              سيتم إعادة الرقم إلى البداية ({resetMode === "draft" ? (form.draftFirstNum || "1") : (form.firstNum || "1")}) والرقم التالي الجديد سيكون:
            </p>
            <div className="text-center py-2">
              <span className="font-mono text-[18px] font-bold text-indigo-700 bg-indigo-50 px-4 py-1 rounded border border-indigo-200">
                {resetMode === "draft"
                  ? buildPreview(form.draftFixedPart, form.draftFirstNum, form.draftDigits)
                  : buildPreview(form.fixedPart, form.firstNum, form.digits)}
              </span>
            </div>
            <p className="text-[11px] text-orange-600 bg-orange-50 rounded p-2 text-right">
              ⚠ تأكد أن لا توجد {resetMode === "draft" ? "مسودات" : "فواتير"} مستخدمة بهذا الترقيم قبل إعادة الضبط
            </p>
          </div>
          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            <Button variant="destructive" className="flex-1 bg-orange-600 hover:bg-orange-700"
              onClick={resetMode === "draft" ? handleResetDraftNumbering : handleResetNumbering}
              disabled={resetMode === "draft" ? resetDraftMut.isPending : resetMut.isPending}>
              <RefreshCw className="w-3.5 h-3.5 ml-1" /> إعادة الضبط
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setShowReset(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

/**
 * مكوّن خفيف يُسجّل إجراءات نموذج دفاتر المستندات في ToolbarActionsProvider الداخلي
 * لنافذة العمل (DesktopWorkWindow)، فيظهر الشريط في تذييل النافذة بدلاً من الشريط الخارجي.
 */
function DJPFormToolbarRegistrar({ actions }: { actions: Parameters<typeof useToolbarActions>[0] }) {
  useToolbarActions(actions);
  return null;
}
