/**
 * CustomerFormDialog.tsx
 * نافذة إضافة / تعديل العميل — متعددة التبويبات بأسلوب ERP الكلاسيكي
 */
import React, { useState, useEffect, useRef } from "react";
import { useUnsavedChangesGuard } from "@/core/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/shared/components/UnsavedChangesDialog";
import { DateSegmentInput } from "@/shared/components/DateSegmentInput";
import { fmtDate } from "@/shared/utils/dateUtils";
import { trpc } from "@/shared/lib/trpc";
import { toast } from "sonner";
import { FoundationPolicyPanel } from "@/shared/components/FoundationPolicyPanel";
import type { RecordPolicy } from "@/shared/components/FoundationPolicyPanel";

/* ═══════════════════════════ Types ═══════════════════════════ */
interface CustomerData {
  id?: number;
  code?: string;
  name?: string;
  customerType?: "individual" | "organization";
  phone?: string;
  email?: string;
  taxNumber?: string;
  registrationNumber?: string;
  city?: string;
  address?: string;
  shortAddress?: string;
  buildingNumber?: string;
  additionalNumber?: string;
  postalCode?: string;
  creditLimit?: string;
  balance?: string;
  // التسعير والضوابط
  priceLevel?: number;
  maxDiscountPct?: string;
  canSellOnCredit?: boolean;
  dealStartDate?: string | null;
  dealEndDate?:   string | null;
  // قنوات الإرسال
  whatsappPhone?: string;
  telegramId?: string;
  defaultSendMethod?: string;
  isActive?: boolean;
  recordPolicy?: RecordPolicy;
  foundationKey?: string;
  includeInFoundation?: boolean;
}

interface Props {
  open: boolean;
  editData?: CustomerData | null;
  onClose: () => void;
  onSaved: () => void;
}

/* ═══════════════════════════ Constants ═══════════════════════════ */
type TabId = "main" | "address" | "pricing" | "channels" | "balances" | "sales" | "purchases";

const TABS: { id: TabId; label: string }[] = [
  { id: "main",      label: "نافذة رئيسية" },
  { id: "address",   label: "عنوان" },
  { id: "pricing",   label: "التسعير والضوابط" },
  { id: "channels",  label: "قنوات الإرسال" },
  { id: "balances",  label: "أرصدة" },
  { id: "sales",     label: "مبيعات" },
  { id: "purchases", label: "مشتريات" },
];

const PRIMARY = "#406B93";

const EMPTY: CustomerData = {
  code: "", name: "", customerType: "individual",
  phone: "", email: "", taxNumber: "", registrationNumber: "",
  city: "", address: "", shortAddress: "", buildingNumber: "",
  additionalNumber: "", postalCode: "", creditLimit: "",
  priceLevel: 1, maxDiscountPct: "0", canSellOnCredit: true,
  dealStartDate: null, dealEndDate: null,
  whatsappPhone: "", telegramId: "", defaultSendMethod: "",
  recordPolicy: "flexible", foundationKey: "", includeInFoundation: false,
};

/* مستويات الأسعار المتاحة — مرتبطة بحقل salePrice في كارت الصنف */
const PRICE_LEVELS = [
  { value: 1, label: "سعر البيع الأساسي", hint: "السعر الافتراضي للصنف",     color: "#406B93" },
  { value: 2, label: "سعر بيع 2",         hint: "سعر الجملة / العملاء الدائمين", color: "#0D9488" },
  { value: 3, label: "سعر بيع 3",         hint: "سعر خاص / صفقات كبرى",        color: "#7C3AED" },
  { value: 4, label: "سعر بيع 4",         hint: "سعر المعرض / التجزئة",         color: "#D97706" },
  { value: 5, label: "سعر بيع 5",         hint: "سعر مخصص يدوي",               color: "#DC2626" },
];

/* ═══════════════════════════ Main Component ═══════════════════════════ */
/* ─── ثوابت التقويم ─── */
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 7 }, (_, i) => CURRENT_YEAR - i);
const MONTHS_AR = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

function lastDayOfMonth(year: number, month: number): string {
  return new Date(year, month, 0).toISOString().split("T")[0];
}

function dateRange(year: number | null, month: number | null): { from?: string; to?: string } {
  if (!year) return {};
  if (month) return {
    from: `${year}-${String(month).padStart(2, "0")}-01`,
    to:   lastDayOfMonth(year, month),
  };
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

/* ═══════════════════════════ Main Component ═══════════════════════════ */
export default function CustomerFormDialog({ open, editData, onClose, onSaved }: Props) {
  const [tab, setTab]   = useState<TabId>("main");
  const [form, setForm] = useState<CustomerData>(EMPTY);
  const [isDirty, setIsDirty] = useState(false);
  const skipFormRef     = useRef(true);
  const nameRef         = useRef<HTMLInputElement>(null);
  const utils           = trpc.useUtils();

  /* فلاتر تبويب المبيعات */
  const [slYear,  setSlYear]  = useState<number | null>(CURRENT_YEAR);
  const [slMonth, setSlMonth] = useState<number | null>(null);
  /* فلاتر تبويب المشتريات (مردودات المبيعات) */
  const [prYear,  setPrYear]  = useState<number | null>(CURRENT_YEAR);
  const [prMonth, setPrMonth] = useState<number | null>(null);
  /* فلتر تبويب الأرصدة */
  const [balYear, setBalYear] = useState<number>(CURRENT_YEAR);

  const create = trpc.customers.create.useMutation({
    onSuccess: () => { utils.customers.list.invalidate(); toast.success("تم إضافة العميل بنجاح"); onSaved(); },
    onError:   (e) => toast.error(e.message),
  });
  const update = trpc.customers.update.useMutation({
    onSuccess: () => { utils.customers.list.invalidate(); toast.success("تم حفظ التعديلات"); onSaved(); },
    onError:   (e) => toast.error(e.message),
  });

  /* ── سجل المبيعات للعميل ── */
  const slRange = dateRange(slYear, slMonth);
  const salesHistoryQuery = trpc.salesInvoices.list.useQuery(
    { customerId: editData?.id, invoiceType: "sale", dateFrom: slRange.from, dateTo: slRange.to, limit: 500 },
    { enabled: open && tab === "sales" && !!editData?.id }
  );

  /* ── سجل المردودات للعميل ── */
  const prRange = dateRange(prYear, prMonth);
  const returnsHistoryQuery = trpc.salesInvoices.list.useQuery(
    { customerId: editData?.id, invoiceType: "return", dateFrom: prRange.from, dateTo: prRange.to, limit: 500 },
    { enabled: open && tab === "purchases" && !!editData?.id }
  );

  /* ── أرصدة العميل (كل الفواتير للسنة المختارة) ── */
  const balancesQuery = trpc.salesInvoices.list.useQuery(
    { customerId: editData?.id, dateFrom: `${balYear}-01-01`, dateTo: `${balYear}-12-31`, limit: 1000 },
    { enabled: open && tab === "balances" && !!editData?.id }
  );

  useEffect(() => {
    if (!open) return;
    setTab("main");
    setIsDirty(false);
    skipFormRef.current = true;
    if (editData) {
      setForm({
        ...EMPTY,
        ...editData,
        code:               editData.code               ?? "",
        name:               editData.name               ?? "",
        customerType:       (editData.customerType as any) ?? "individual",
        phone:              editData.phone              ?? "",
        email:              editData.email              ?? "",
        taxNumber:          editData.taxNumber          ?? "",
        registrationNumber: editData.registrationNumber ?? "",
        city:               editData.city               ?? "",
        address:            editData.address            ?? "",
        shortAddress:       editData.shortAddress       ?? "",
        buildingNumber:     editData.buildingNumber     ?? "",
        additionalNumber:   editData.additionalNumber   ?? "",
        postalCode:         editData.postalCode         ?? "",
        creditLimit:        editData.creditLimit        ?? "",
        priceLevel:         editData.priceLevel         ?? 1,
        maxDiscountPct:     editData.maxDiscountPct     ?? "0",
        canSellOnCredit:    editData.canSellOnCredit    ?? true,
        dealStartDate:      editData.dealStartDate ? String(editData.dealStartDate).slice(0,10) : null,
        dealEndDate:        editData.dealEndDate   ? String(editData.dealEndDate).slice(0,10)   : null,
        whatsappPhone:      editData.whatsappPhone      ?? "",
        telegramId:         editData.telegramId         ?? "",
        defaultSendMethod:  editData.defaultSendMethod  ?? "",
        recordPolicy:       (editData.recordPolicy as RecordPolicy) ?? "flexible",
        foundationKey:      editData.foundationKey      ?? "",
        includeInFoundation: editData.includeInFoundation ?? false,
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, editData]);

  useEffect(() => {
    if (!open) return;
    if (skipFormRef.current) { skipFormRef.current = false; return; }
    setIsDirty(true);
  }, [form, open]);

  useEffect(() => {
    if (open) setTimeout(() => nameRef.current?.focus(), 80);
  }, [open]);

  const set = (k: keyof CustomerData, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async (): Promise<void> => {
    if (!form.name?.trim()) { toast.error("اسم العميل مطلوب"); setTab("main"); throw new Error("validation"); }
    if (form.customerType === "organization" && !form.taxNumber?.trim()) {
      toast.error("الرقم الضريبي مطلوب للمؤسسات"); setTab("main"); throw new Error("validation");
    }
    const payload = {
      code:               form.code?.trim()              || undefined,
      name:               form.name.trim(),
      customerType:       form.customerType,
      phone:              form.phone?.trim()              || undefined,
      email:              form.email?.trim()              || undefined,
      taxNumber:          form.taxNumber?.trim()          || undefined,
      registrationNumber: form.registrationNumber?.trim() || undefined,
      city:               form.city?.trim()               || undefined,
      address:            form.address?.trim()            || undefined,
      shortAddress:       form.shortAddress?.trim()       || undefined,
      buildingNumber:     form.buildingNumber?.trim()     || undefined,
      additionalNumber:   form.additionalNumber?.trim()   || undefined,
      postalCode:         form.postalCode?.trim()         || undefined,
      creditLimit:        form.creditLimit?.trim()        || undefined,
      priceLevel:         form.priceLevel ?? 1,
      maxDiscountPct:     form.maxDiscountPct?.trim()     || "0",
      canSellOnCredit:    form.canSellOnCredit ?? true,
      dealStartDate:      form.dealStartDate || null,
      dealEndDate:        form.dealEndDate   || null,
      whatsappPhone:      form.whatsappPhone?.trim()      || undefined,
      telegramId:         form.telegramId?.trim()         || undefined,
      defaultSendMethod:  (form.defaultSendMethod as any) || undefined,
      recordPolicy:       form.recordPolicy ?? "flexible",
      includeInFoundation: form.includeInFoundation ?? false,
      foundationKey:      form.foundationKey?.trim() || undefined,
    };
    if (editData?.id) await update.mutateAsync({ id: editData.id, ...payload });
    else              await create.mutateAsync(payload);
  };

  const { confirmOpen, requestClose, confirmSave, confirmDiscard, confirmCancel } = useUnsavedChangesGuard({ isDirty });
  const handleClose = () => requestClose(onClose);

  if (!open) return null;

  const isOrg     = form.customerType === "organization";
  const isPending = create.isPending || update.isPending;
  const title     = editData?.id ? `تعديل العميل — ${editData.name ?? ""}` : "إضافة عميل جديد";

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1200,
               background: "rgba(0,0,0,0.45)", display: "flex",
               alignItems: "center", justifyContent: "center" }}
    >
      <div dir="rtl" style={{
        width: 940, maxWidth: "98vw",
        height: 620, maxHeight: "calc(100vh - 24px)",
        minHeight: 620,
        background: "#f0ede8",
        border: "2px solid #315f88",
        boxShadow: "0 8px 28px rgba(20,35,50,0.42)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        borderRadius: 5,
      }}>

        {/* ── Title Bar ── */}
        <div style={{
          background: "linear-gradient(180deg, #376d9c 0%, #28567f 100%)",
          minHeight: 31, padding: "4px 8px", display: "flex", alignItems: "center",
          justifyContent: "space-between", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 15 }}>👤</span>
            <span style={{ color: "white", fontWeight: 700, fontSize: 12 }}>{title}</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button type="button" aria-label="تكبير النافذة" style={{
              width: 20, height: 18, background: "transparent", border: "1px solid rgba(255,255,255,.35)",
              color: "white", fontSize: 11, cursor: "pointer", borderRadius: 2,
            }}>↗</button>
            <button type="button" onClick={handleClose} aria-label="إغلاق" style={{
              width: 20, height: 18, background: "#c95757", border: "1px solid #8f3030",
              color: "white", fontSize: 11, fontWeight: 700, cursor: "pointer", borderRadius: 2,
            }}>×</button>
          </div>
        </div>

        {/* ── Record strip ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          minHeight: 29, padding: "3px 10px", color: "#68727b", fontSize: 10,
          background: "#f4f3f0", borderBottom: "1px solid #c7c8c8",
        }}>
          <span style={{ fontWeight: 700 }}>{editData?.id ? "تعديل بيانات العميل" : "إضافة عميل جديد"}</span>
          <span>{editData?.id ? `رقم السجل: ${editData.id}` : "سجل جديد"} <b style={{ margin: "0 5px" }}>•</b> {isDirty ? "تعديلات غير محفوظة" : "جاهز"}</span>
        </div>

        {/* ── Tab Bar ── */}
        <div style={{
          background: "#e5e4e1", borderBottom: "1px solid #9da3a8",
          display: "flex", flexShrink: 0, overflowX: "auto", paddingRight: 7,
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "7px 13px 6px", fontSize: 11,
              fontWeight: tab === t.id ? 700 : 500,
              background: tab === t.id ? "#f7f6f3" : "transparent",
              color: tab === t.id ? "#315f88" : "#62676c",
              border: "none", borderLeft: "1px solid #c9cacc",
              borderBottom: tab === t.id ? "2px solid #f7f6f3" : "2px solid transparent",
              marginBottom: -1,
              cursor: "pointer", whiteSpace: "nowrap",
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div style={{
          overflowY: "auto", flex: "1 1 auto", minHeight: 0,
          padding: "10px 12px", background: "#f0ede8",
        }}>

          {/* ══ نافذة رئيسية ══ */}
          {tab === "main" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

              <ESection title="نوع العميل">
                <div style={{ display: "flex", gap: 8 }}>
                  <TypeBtn active={!isOrg} label="🧾 فرد (فاتورة مبسطة)" color="#15803D"
                    onClick={() => { set("customerType", "individual"); set("taxNumber", ""); }} />
                  <TypeBtn active={isOrg}  label="📋 مؤسسة (فاتورة ضريبية)" color="#1D4ED8"
                    onClick={() => set("customerType", "organization")} />
                </div>
              </ESection>

              <ESection title="المعلومات الأساسية">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 14px" }}>
                  <EField label="كود العميل" hint="يُعبأ تلقائياً إن تُرك فارغاً">
                    <EInput value={form.code} onChange={v => set("code", v)} placeholder="مثال: CU-001" mono />
                  </EField>
                  <EField label={isOrg ? "اسم المؤسسة *" : "اسم العميل *"}>
                    <EInput inputRef={nameRef} value={form.name} onChange={v => set("name", v)}
                      placeholder={isOrg ? "اسم الشركة أو المؤسسة..." : "أدخل اسم العميل..."} />
                  </EField>
                  <EField label="رقم الجوال">
                    <EInput value={form.phone} onChange={v => set("phone", v)} placeholder="05xxxxxxxx" ltr />
                  </EField>
                  <EField label="البريد الإلكتروني">
                    <EInput value={form.email} onChange={v => set("email", v)} placeholder="example@domain.com" ltr />
                  </EField>
                </div>
              </ESection>

              <ESection title="البيانات الضريبية والتجارية"
                headerColor={isOrg ? "#1D4ED8" : undefined}
                note={!isOrg ? "تنطبق على المؤسسات فقط" : undefined}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 14px",
                              opacity: isOrg ? 1 : 0.4, pointerEvents: isOrg ? "auto" : "none" }}>
                  <EField label="الرقم الضريبي *">
                    <EInput value={form.taxNumber} onChange={v => set("taxNumber", v)}
                      placeholder="3xxxxxxxxxxxxxxxxx" ltr
                      style={isOrg
                        ? (form.taxNumber?.trim()
                            ? { borderColor: "#86EFAC", background: "#F0FDF4" }
                            : { borderColor: "#FCA5A5", background: "#FFF5F5" })
                        : undefined}
                    />
                  </EField>
                  <EField label="رقم السجل التجاري">
                    <EInput value={form.registrationNumber} onChange={v => set("registrationNumber", v)}
                      placeholder="1010xxxxxx" ltr />
                  </EField>
                </div>
              </ESection>

            </div>
          )}

          {/* ══ عنوان ══ */}
          {tab === "address" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ESection title="العنوان التفصيلي">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 14px" }}>
                  <EField label="المدينة">
                    <EInput value={form.city} onChange={v => set("city", v)} placeholder="مثال: الرياض" />
                  </EField>
                  <EField label="العنوان المختصر">
                    <EInput value={form.shortAddress} onChange={v => set("shortAddress", v)} placeholder="ABRV" ltr />
                  </EField>
                  <EField label="رقم المبنى">
                    <EInput value={form.buildingNumber} onChange={v => set("buildingNumber", v)} ltr />
                  </EField>
                  <EField label="الرقم الإضافي">
                    <EInput value={form.additionalNumber} onChange={v => set("additionalNumber", v)} ltr />
                  </EField>
                  <EField label="الرمز البريدي">
                    <EInput value={form.postalCode} onChange={v => set("postalCode", v)} placeholder="12345" ltr />
                  </EField>
                </div>
              </ESection>
              <ESection title="العنوان الكامل">
                <textarea value={form.address} onChange={e => set("address", e.target.value)}
                  rows={3} placeholder="العنوان التفصيلي الكامل..."
                  style={{ width: "100%", fontSize: 13, padding: "5px 8px", border: "1px solid #A0A0A0",
                           background: "white", resize: "vertical", fontFamily: "inherit",
                           borderRadius: 2, outline: "none", boxSizing: "border-box" }} />
              </ESection>
            </div>
          )}

          {/* ══ التسعير والضوابط ══ */}
          {tab === "pricing" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

              {/* ── سعر البيع للعميل ── */}
              <ESection title="سعر البيع المطبّق على العميل"
                headerColor="#406B93"
                note="يُحدد السعر المسحوب تلقائياً من كارت الصنف عند فتح فاتورة لهذا العميل">
                {(() => {
                  const selected = PRICE_LEVELS.find(pl => pl.value === (form.priceLevel ?? 1)) ?? PRICE_LEVELS[0];
                  return (
                    <div style={{ position: "relative", width: "100%" }}>
                      <select
                        value={form.priceLevel ?? 1}
                        onChange={e => setForm(f => ({ ...f, priceLevel: Number(e.target.value) }))}
                        style={{
                          width: "100%", appearance: "none", WebkitAppearance: "none",
                          padding: "8px 36px 8px 36px",
                          borderRadius: 5, cursor: "pointer",
                          border: `2px solid ${selected.color}`,
                          background: `${selected.color}0f`,
                          color: selected.color,
                          fontSize: 13, fontWeight: 700,
                          outline: "none", direction: "rtl",
                        }}>
                        {PRICE_LEVELS.map(pl => (
                          <option key={pl.value} value={pl.value}>
                            {pl.value}. {pl.label} — {pl.hint}
                          </option>
                        ))}
                      </select>
                      {/* badge رقم المستوى */}
                      <span style={{
                        position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                        width: 22, height: 22, borderRadius: 4,
                        background: selected.color, color: "#fff",
                        fontSize: 11, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        pointerEvents: "none",
                      }}>{selected.value}</span>
                      {/* سهم القائمة */}
                      <span style={{
                        position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                        color: selected.color, fontSize: 12, pointerEvents: "none", fontWeight: 700,
                      }}>▼</span>
                    </div>
                  );
                })()}
              </ESection>

              {/* ── حدود الخصم ── */}
              <ESection title="حدود الخصم في الفاتورة" headerColor="#D97706">
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <EField label="الحد الأقصى للخصم المسموح به" hint="نسبة مئوية — صفر = بدون قيود">
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <EInput
                            value={form.maxDiscountPct}
                            onChange={v => {
                              const n = parseFloat(v);
                              if (v === "" || (!isNaN(n) && n >= 0 && n <= 100))
                                setForm(f => ({ ...f, maxDiscountPct: v }));
                            }}
                            placeholder="0.00" ltr mono
                            style={{ maxWidth: 120 }}
                          />
                          <span style={{ fontSize: 16, color: "#888" }}>%</span>
                          {/* Visual bar */}
                          <div style={{ flex: 1, height: 6, background: "#E8E8E8", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{
                              height: "100%", borderRadius: 3,
                              width: `${Math.min(parseFloat(form.maxDiscountPct || "0"), 100)}%`,
                              background: parseFloat(form.maxDiscountPct || "0") === 0
                                ? "#C0C0C0"
                                : parseFloat(form.maxDiscountPct || "0") <= 10
                                ? "#22C55E"
                                : parseFloat(form.maxDiscountPct || "0") <= 25
                                ? "#F59E0B"
                                : "#EF4444",
                              transition: "width 0.3s",
                            }} />
                          </div>
                        </div>
                      </EField>
                    </div>
                  </div>
                  {/* Preset buttons */}
                  <div>
                    <div style={{ fontSize: 10, color: "#888", marginBottom: 5 }}>اختيار سريع:</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {[
                        { v: "0",  label: "بدون حد", desc: "غير محدود" },
                        { v: "5",  label: "5%",       desc: "خصم خفيف" },
                        { v: "10", label: "10%",      desc: "خصم متوسط" },
                        { v: "15", label: "15%",      desc: "خصم جيد" },
                        { v: "20", label: "20%",      desc: "خصم كبير" },
                        { v: "25", label: "25%",      desc: "عميل مميز" },
                      ].map(opt => {
                        const active = form.maxDiscountPct === opt.v;
                        return (
                          <button key={opt.v} type="button"
                            onClick={() => setForm(f => ({ ...f, maxDiscountPct: opt.v }))}
                            title={opt.desc}
                            style={{
                              padding: "3px 10px", fontSize: 11, borderRadius: 4, cursor: "pointer",
                              fontWeight: active ? 700 : 500,
                              background: active ? "#D97706" : "#F3F4F6",
                              color:      active ? "white"   : "#555",
                              border:     `1px solid ${active ? "#B45309" : "#D1D5DB"}`,
                            }}>{opt.label}</button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </ESection>

              {/* ── البيع بالدين ── */}
              <ESection title="صلاحيات البيع الآجل (الدين)"
                headerColor={form.canSellOnCredit ? "#0D9488" : "#DC2626"}>
                <div style={{ display: "flex", gap: 10 }}>
                  {/* ON button */}
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, canSellOnCredit: true }))}
                    style={{
                      flex: 1, padding: "10px 14px", borderRadius: 5, cursor: "pointer",
                      border: `2px solid ${form.canSellOnCredit ? "#0D9488" : "#D0D0D0"}`,
                      background: form.canSellOnCredit ? "#F0FDFA" : "white",
                      textAlign: "center",
                    }}>
                    <div style={{ fontSize: 20, marginBottom: 3 }}>✅</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: form.canSellOnCredit ? "#0D9488" : "#888" }}>
                      يُسمح بالبيع الآجل
                    </div>
                    <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
                      يمكن للعميل الشراء بالدين ضمن حد الائتمان
                    </div>
                    {form.canSellOnCredit && (
                      <div style={{
                        marginTop: 6, padding: "2px 8px", borderRadius: 10, display: "inline-block",
                        background: "#0D9488", color: "white", fontSize: 10, fontWeight: 700,
                      }}>مُفعَّل</div>
                    )}
                  </button>

                  {/* OFF button */}
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, canSellOnCredit: false }))}
                    style={{
                      flex: 1, padding: "10px 14px", borderRadius: 5, cursor: "pointer",
                      border: `2px solid ${!form.canSellOnCredit ? "#DC2626" : "#D0D0D0"}`,
                      background: !form.canSellOnCredit ? "#FFF5F5" : "white",
                      textAlign: "center",
                    }}>
                    <div style={{ fontSize: 20, marginBottom: 3 }}>🚫</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: !form.canSellOnCredit ? "#DC2626" : "#888" }}>
                      نقدي فقط
                    </div>
                    <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
                      لا يُسمح بالبيع الآجل — النقد عند التسليم
                    </div>
                    {!form.canSellOnCredit && (
                      <div style={{
                        marginTop: 6, padding: "2px 8px", borderRadius: 10, display: "inline-block",
                        background: "#DC2626", color: "white", fontSize: 10, fontWeight: 700,
                      }}>مُفعَّل</div>
                    )}
                  </button>
                </div>

                {/* حد الائتمان مع البيع الآجل */}
                {form.canSellOnCredit && (
                  <div style={{
                    marginTop: 10, padding: "8px 12px", borderRadius: 4,
                    background: "#F0FDFA", border: "1px solid #99F6E4",
                    display: "flex", alignItems: "center", gap: 10,
                  }}>
                    <span style={{ fontSize: 12, color: "#0D9488", fontWeight: 700 }}>🏦 حد الائتمان:</span>
                    <EInput
                      value={form.creditLimit}
                      onChange={v => set("creditLimit", v)}
                      placeholder="0.00 (صفر = بدون حد)"
                      ltr mono
                      style={{ maxWidth: 200, height: 24, fontSize: 12 }}
                    />
                    <span style={{ fontSize: 11, color: "#666" }}>ر.س</span>
                  </div>
                )}
              </ESection>

              {/* ── حدود فترة التعامل ── */}
              {(() => {
                const isLimited = !!(form.dealStartDate || form.dealEndDate);
                const DEAL_COLOR = "#7C3AED";
                return (
                  <ESection title="حدود فترة التعامل" headerColor={DEAL_COLOR}
                    note="تحديد إن كان التعامل مع العميل مفتوحاً أو محدوداً بتواريخ بداية ونهاية">
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                      {/* Toggle: مفتوحة / محددة */}
                      <div style={{ display: "flex", gap: 6 }}>
                        {[
                          { key: false, icon: "♾️", label: "مفتوحة",         hint: "بدون تاريخ انتهاء" },
                          { key: true,  icon: "📅", label: "محددة بتاريخ",   hint: "تحديد من — إلى" },
                        ].map(opt => {
                          const sel = isLimited === opt.key;
                          return (
                            <button key={String(opt.key)} type="button"
                              onClick={() => {
                                if (!opt.key) setForm(f => ({ ...f, dealStartDate: null, dealEndDate: null }));
                                else          setForm(f => ({ ...f, dealStartDate: f.dealStartDate || new Date().toISOString().slice(0,10) }));
                              }}
                              style={{
                                flex: 1, padding: "8px 10px", borderRadius: 4, cursor: "pointer",
                                border: `2px solid ${sel ? DEAL_COLOR : "#D0D0D0"}`,
                                background: sel ? `${DEAL_COLOR}10` : "white",
                                textAlign: "center",
                              }}>
                              <div style={{ fontSize: 18, marginBottom: 2 }}>{opt.icon}</div>
                              <div style={{ fontSize: 12, fontWeight: sel ? 700 : 500, color: sel ? DEAL_COLOR : "#555" }}>{opt.label}</div>
                              <div style={{ fontSize: 9, color: "#999", marginTop: 1 }}>{opt.hint}</div>
                              {sel && (
                                <div style={{
                                  marginTop: 4, fontSize: 9, fontWeight: 700,
                                  color: "white", background: DEAL_COLOR,
                                  borderRadius: 8, padding: "1px 7px", display: "inline-block",
                                }}>مُفعَّل</div>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* حقول التاريخ — تظهر فقط عند "محددة" */}
                      {isLimited && (
                        <div style={{
                          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
                          padding: "10px 12px", borderRadius: 4,
                          background: `${DEAL_COLOR}08`, border: `1px solid ${DEAL_COLOR}30`,
                        }}>
                          {/* من تاريخ */}
                          <div>
                            <div style={{ fontSize: 10, color: DEAL_COLOR, fontWeight: 700, marginBottom: 4 }}>
                              📅 من تاريخ
                            </div>
                            <DateSegmentInput
                              value={form.dealStartDate ?? ""}
                              onChange={v => setForm(f => ({ ...f, dealStartDate: v || null }))}
                              standalone
                              style={{ width: "100%", height: 30, fontSize: 12, border: `1px solid ${DEAL_COLOR}50`, borderRadius: 3 }}
                            />
                          </div>
                          {/* إلى تاريخ */}
                          <div>
                            <div style={{ fontSize: 10, color: "#DC2626", fontWeight: 700, marginBottom: 4 }}>
                              🏁 إلى تاريخ
                              <span style={{ fontSize: 9, color: "#999", fontWeight: 400, marginRight: 4 }}>
                                (اتركه فارغاً = مفتوح النهاية)
                              </span>
                            </div>
                            <DateSegmentInput
                              value={form.dealEndDate ?? ""}
                              onChange={v => setForm(f => ({ ...f, dealEndDate: v || null }))}
                              standalone
                              style={{ width: "100%", height: 30, fontSize: 12, border: `1px solid #DC262650`, borderRadius: 3 }}
                            />
                          </div>

                          {/* ملخص الفترة */}
                          {(form.dealStartDate || form.dealEndDate) && (
                            <div style={{
                              gridColumn: "1 / -1", marginTop: 2, padding: "5px 10px",
                              borderRadius: 4, background: `${DEAL_COLOR}15`,
                              fontSize: 11, color: DEAL_COLOR, fontWeight: 600,
                              textAlign: "center",
                            }}>
                              {form.dealStartDate && !form.dealEndDate
                                ? `تبدأ من ${form.dealStartDate} — مفتوحة النهاية`
                                : !form.dealStartDate && form.dealEndDate
                                ? `تنتهي في ${form.dealEndDate}`
                                : `من ${form.dealStartDate} إلى ${form.dealEndDate}`}
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  </ESection>
                );
              })()}

            </div>
          )}

          {/* ══ قنوات الإرسال ══ */}
          {tab === "channels" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ESection title="بيانات التواصل الإلكتروني">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 14px" }}>
                  <EField label="رقم الواتساب" hint="إن اختلف عن رقم الجوال">
                    <EInput value={form.whatsappPhone} onChange={v => set("whatsappPhone", v)} placeholder="05xxxxxxxx" ltr />
                  </EField>
                  <EField label="معرّف تيليجرام">
                    <EInput value={form.telegramId} onChange={v => set("telegramId", v)} placeholder="@username" ltr />
                  </EField>
                </div>
              </ESection>
              <ESection title="طريقة الإرسال الافتراضية">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { v: "",         label: "— بدون تفضيل —" },
                    { v: "whatsapp", label: "📱 واتساب" },
                    { v: "telegram", label: "✈️ تيليجرام" },
                    { v: "email",    label: "📧 بريد إلكتروني" },
                  ].map(opt => (
                    <button key={opt.v} onClick={() => set("defaultSendMethod", opt.v)} style={{
                      padding: "5px 14px", fontSize: 12, borderRadius: 3, cursor: "pointer",
                      fontWeight: 600,
                      background: form.defaultSendMethod === opt.v ? PRIMARY : "#E8E8E8",
                      color:      form.defaultSendMethod === opt.v ? "white"  : "#333",
                      border:     `1px solid ${form.defaultSendMethod === opt.v ? PRIMARY : "#C0C0C0"}`,
                    }}>{opt.label}</button>
                  ))}
                </div>
              </ESection>
            </div>
          )}

          {/* ══ الأرصدة ══ */}
          {tab === "balances" && editData?.id && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ESection title="الرصيد الحالي">
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <BalanceBadge label="رصيد العميل" value={editData.balance ?? "0"} color={PRIMARY} />
                  <BalanceBadge label="حد الائتمان"  value={form.creditLimit || "0"} color="#15803D" />
                </div>
              </ESection>
            </div>
          )}

          {/* ══ الأرصدة ══ */}
          {tab === "balances" && (
            <CustomerBalancesTab
              customerId={editData?.id ?? null}
              year={balYear}
              onYearChange={setBalYear}
              data={balancesQuery.data ?? []}
              isLoading={balancesQuery.isLoading}
            />
          )}

          {/* ══ المبيعات ══ */}
          {tab === "sales" && (
            <CustomerInvoicesTab
              customerId={editData?.id ?? null}
              year={slYear} onYearChange={setSlYear}
              month={slMonth} onMonthChange={setSlMonth}
              data={salesHistoryQuery.data ?? []}
              isLoading={salesHistoryQuery.isLoading}
              accentColor="#406B93"
              title="سجل فواتير المبيعات"
              emptyText="لا توجد فواتير مبيعات في هذه الفترة"
            />
          )}

          {/* ══ المشتريات (مردودات المبيعات) ══ */}
          {tab === "purchases" && (
            <CustomerInvoicesTab
              customerId={editData?.id ?? null}
              year={prYear} onYearChange={setPrYear}
              month={prMonth} onMonthChange={setPrMonth}
              data={returnsHistoryQuery.data ?? []}
              isLoading={returnsHistoryQuery.isLoading}
              accentColor="#DC2626"
              title="سجل مردودات المبيعات"
              emptyText="لا توجد مردودات في هذه الفترة"
            />
          )}

        </div>

        {/* ── سياسة التأسيس ── */}
        <div style={{ padding: "4px 14px 4px", borderTop: "1px solid #d2cec8", background: "#f0ede8" }}>
          <FoundationPolicyPanel
            recordPolicy={form.recordPolicy ?? "flexible"}
            foundationKey={form.foundationKey ?? null}
            includeInFoundation={form.includeInFoundation ?? false}
            onChange={(policy, include) => setForm(f => ({ ...f, recordPolicy: policy, includeInFoundation: include }))}
          />
        </div>

        {/* ── Footer ── */}
        <div style={{
          background: "linear-gradient(180deg, #f8f7f4 0%, #deddd9 100%)",
          borderTop: "1px solid #9da3a8", padding: "5px 8px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0, gap: 8,
        }}>
          <span style={{ fontSize: 10, color: "#68727b", whiteSpace: "nowrap" }}>
            {isOrg ? "📋 مؤسسة" : "🧾 فرد"} {isDirty && "• غير محفوظ"}
          </span>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-start" }}>
            <CommandButton icon="💾" label={isPending ? "جاري الحفظ" : "حفظ"} primary disabled={isPending} onClick={() => handleSave().catch(() => {})} />
            <CommandButton icon="＋" label="جديد" disabled={isPending} onClick={() => {
              if (isDirty) { toast.info("احفظ التعديلات أو أغلق النافذة أولاً"); return; }
              setForm(EMPTY); setTab("main"); setIsDirty(false);
            }} />
            <CommandButton icon="↶" label="تراجع" disabled={!isDirty || isPending} onClick={() => {
              if (editData) setForm({ ...EMPTY, ...editData });
              else setForm(EMPTY);
              setIsDirty(false);
            }} />
            <CommandButton icon="✕" label="إلغاء" disabled={isPending} onClick={handleClose} />
          </div>
        </div>

      </div>

      <UnsavedChangesDialog
        open={confirmOpen}
        onSave={() => confirmSave(handleSave)}
        onDiscard={confirmDiscard}
        onCancel={confirmCancel}
        isSaving={isPending}
      />
    </div>
  );
}

/* ═══════════════════════════ Sub-components ═══════════════════════════ */

function ESection({ title, children, headerColor, note }: {
  title: string; children: React.ReactNode;
  headerColor?: string; note?: string;
}) {
  return (
    <div style={{ border: "1px solid #c9c4bc", borderRadius: 4, overflow: "hidden", background: "#f0ede8", boxShadow: "0 1px 2px rgba(0,0,0,.06)" }}>
      <div style={{
        background: "#f0ede8",
        borderBottom: "1px solid #c9c4bc", padding: "5px 10px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#4e5459" }}>{title}</span>
        {note && <span style={{ fontSize: 9, color: "#7a7d7e" }}>{note}</span>}
      </div>
      <div style={{ padding: "10px", background: "#f0ede8" }}>{children}</div>
    </div>
  );
}

function EField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#333" }}>
        {label}
        {hint && <span style={{ fontWeight: 400, color: "#888", marginRight: 4 }}>({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function EInput({ value, onChange, placeholder, ltr, mono, inputRef, style }: {
  value?: string; onChange: (v: string) => void;
  placeholder?: string; ltr?: boolean; mono?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  style?: React.CSSProperties;
}) {
  return (
    <input
      ref={inputRef}
      value={value ?? ""}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      dir={ltr ? "ltr" : "rtl"}
      style={{
         height: 29, fontSize: 12, padding: "0 8px",
         border: "1px solid #b8b9b9", background: "#fff",
        fontFamily: mono ? "monospace" : "inherit",
        outline: "none", width: "100%", borderRadius: 2,
        boxSizing: "border-box",
        ...style,
      }}
    />
  );
}

function CommandButton({ icon, label, primary, disabled, onClick }: {
  icon: string; label: string; primary?: boolean; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{
      minWidth: 55, height: 34, padding: "2px 7px", display: "inline-flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 1, fontFamily: "inherit", fontSize: 9, fontWeight: 700,
      color: primary ? "#fff" : "#4b5156",
      background: primary ? "linear-gradient(#3d739f, #28567f)" : "#f8f7f4",
      border: `1px solid ${primary ? "#244d70" : "#b5b6b5"}`,
      borderRadius: 3, boxShadow: "0 1px 1px rgba(0,0,0,.12)",
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .5 : 1,
    }}>
      <span style={{ fontSize: 14, lineHeight: 14 }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function TypeBtn({ active, label, color, onClick }: {
  active: boolean; label: string; color: string; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} style={{
      flex: 1, padding: "7px 10px", fontSize: 12, fontWeight: 700,
      borderRadius: 3, cursor: "pointer",
      background: active ? color : "#E8E8E8",
      color:      active ? "white" : "#555",
      border:     `2px solid ${active ? color : "#C0C0C0"}`,
    }}>{label}</button>
  );
}

function BalanceBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: "8px 16px", borderRadius: 4, textAlign: "center", minWidth: 130,
      background: `${color}14`, border: `1px solid ${color}44`,
    }}>
      <div style={{ fontSize: 10, color: "#666", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "monospace" }}>
        {parseFloat(value || "0").toLocaleString("ar-SA", { minimumFractionDigits: 2 })}
      </div>
    </div>
  );
}

function PlaceholderNote({ text }: { text: string }) {
  return (
    <div style={{ padding: "20px", textAlign: "center", color: "#999", fontSize: 12, fontStyle: "italic" }}>
      ⏳ {text}
    </div>
  );
}

/* ════════════════ CustomerInvoicesTab ════════════════
   تبويب موحّد للمبيعات والمردودات — يُمرَّر له البيانات جاهزة
   ════════════════════════════════════════════════════ */
interface InvoiceRow {
  id: number;
  invoiceNumber: string;
  invoiceDate: Date | string;
  paymentMethod?: string | null;
  total?: string | null;
  taxAmount?: string | null;
  status?: string | null;
  isPosted?: boolean | null;
}

function CustomerInvoicesTab({
  customerId, year, onYearChange, month, onMonthChange,
  data, isLoading, accentColor, title, emptyText,
}: {
  customerId: number | null;
  year: number | null; onYearChange: (y: number | null) => void;
  month: number | null; onMonthChange: (m: number | null) => void;
  data: InvoiceRow[];
  isLoading: boolean;
  accentColor: string;
  title: string;
  emptyText: string;
}) {
  /* ملخص المجاميع */
  const totalAmt  = data.reduce((s, r) => s + parseFloat(r.total ?? "0"), 0);
  const totalTax  = data.reduce((s, r) => s + parseFloat(r.taxAmount ?? "0"), 0);
  const fmtNum = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* الحالة بالعربية */
  const statusAr = (row: InvoiceRow) => {
    if (row.isPosted) return { label: "مرحَّل", color: "#15803D", bg: "#DCFCE7" };
    const s = row.status ?? "";
    if (s === "cancelled") return { label: "ملغي",   color: "#DC2626", bg: "#FEE2E2" };
    if (s === "paid")      return { label: "مدفوع",  color: "#0D9488", bg: "#F0FDFA" };
    return                        { label: "مسودة",  color: "#92400E", bg: "#FEF9C3" };
  };

  /* نوع الدفع */
  const payAr = (m?: string | null) => m === "credit" ? "آجل" : "نقدي";

  if (!customerId) {
    return (
      <ESection title={title} headerColor={accentColor}>
        <PlaceholderNote text="احفظ العميل أولاً لعرض سجل المعاملات" />
      </ESection>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

      {/* ── شريط الفلاتر ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        padding: "7px 10px", background: `${accentColor}0C`,
        border: `1px solid ${accentColor}30`, borderRadius: 4,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: accentColor }}>📅 الفترة:</span>

        {/* السنة */}
        <select
          value={year ?? ""}
          onChange={e => onYearChange(e.target.value ? Number(e.target.value) : null)}
          style={{
            height: 26, fontSize: 12, padding: "0 6px", borderRadius: 3,
            border: `1px solid ${accentColor}60`, background: "white", cursor: "pointer",
            color: "#333", fontWeight: year ? 700 : 400,
          }}>
          <option value="">كل السنوات</option>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        {/* الشهر */}
        <select
          value={month ?? ""}
          onChange={e => onMonthChange(e.target.value ? Number(e.target.value) : null)}
          style={{
            height: 26, fontSize: 12, padding: "0 6px", borderRadius: 3,
            border: `1px solid ${accentColor}60`, background: "white", cursor: "pointer",
            color: "#333",
          }}>
          <option value="">كل الشهور</option>
          {MONTHS_AR.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>

        {/* زر إعادة الضبط */}
        {(year !== CURRENT_YEAR || month !== null) && (
          <button type="button"
            onClick={() => { onYearChange(CURRENT_YEAR); onMonthChange(null); }}
            style={{
              height: 24, padding: "0 8px", fontSize: 11, borderRadius: 3,
              border: `1px solid #C0C0C0`, background: "#F3F4F6", cursor: "pointer", color: "#555",
            }}>↺ السنة الحالية</button>
        )}

        <div style={{ flex: 1 }} />

        {/* عداد النتائج */}
        <span style={{
          fontSize: 11, fontWeight: 700, color: "white",
          background: accentColor, borderRadius: 10, padding: "2px 10px",
        }}>{data.length} فاتورة</span>
      </div>

      {/* ── الجدول ── */}
      <div style={{ border: "1px solid #C8C8C8", borderRadius: 3, overflow: "hidden" }}>
        {/* رأس الجدول */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 80px 55px 90px 72px 62px",
          background: accentColor, color: "white",
          fontSize: 10, fontWeight: 700,
        }}>
          {["رقم الفاتورة","التاريخ","الدفع","الإجمالي","الضريبة","الحالة"].map((h, i) => (
            <div key={i} style={{ padding: "5px 8px", textAlign: i === 0 ? "right" : "center",
              borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.2)" : "none" }}>{h}</div>
          ))}
        </div>

        {/* صفوف البيانات */}
        <div style={{ maxHeight: 240, overflowY: "auto" }}>
          {isLoading ? (
            <div style={{ padding: 20, textAlign: "center", color: "#888", fontSize: 12 }}>
              ⏳ جاري التحميل...
            </div>
          ) : data.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#999", fontSize: 12, fontStyle: "italic" }}>
              📭 {emptyText}
            </div>
          ) : (
            data.map((row, idx) => {
              const st = statusAr(row);
              return (
                <div key={row.id} style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 80px 55px 90px 72px 62px",
                  borderTop: "1px solid #E8E8E8",
                  background: idx % 2 === 0 ? "white" : "#F9FAFB",
                  fontSize: 11,
                }}>
                  {/* رقم الفاتورة */}
                  <div style={{ padding: "5px 8px", fontWeight: 700, color: accentColor, fontFamily: "monospace" }}>
                    {row.invoiceNumber}
                  </div>
                  {/* التاريخ */}
                  <div style={{ padding: "5px 8px", textAlign: "center", color: "#555" }}>
                    {fmtDate(row.invoiceDate)}
                  </div>
                  {/* نوع الدفع */}
                  <div style={{ padding: "5px 8px", textAlign: "center", color: "#555" }}>
                    {payAr(row.paymentMethod)}
                  </div>
                  {/* الإجمالي */}
                  <div style={{ padding: "5px 8px", textAlign: "center", fontFamily: "monospace", fontWeight: 600 }}>
                    {fmtNum(parseFloat(row.total ?? "0"))}
                  </div>
                  {/* الضريبة */}
                  <div style={{ padding: "5px 8px", textAlign: "center", fontFamily: "monospace", color: "#666" }}>
                    {fmtNum(parseFloat(row.taxAmount ?? "0"))}
                  </div>
                  {/* الحالة */}
                  <div style={{ padding: "4px 6px", textAlign: "center" }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 8,
                      background: st.bg, color: st.color,
                    }}>{st.label}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── مجموع الفترة ── */}
      {data.length > 0 && (
        <div style={{
          display: "flex", gap: 10, flexWrap: "wrap",
          padding: "8px 12px", borderRadius: 4,
          background: `${accentColor}0A`, border: `1px solid ${accentColor}25`,
        }}>
          <SummaryBadge label="عدد الفواتير"    value={String(data.length)}    color={accentColor} unit="فاتورة" />
          <SummaryBadge label="إجمالي المبيعات" value={fmtNum(totalAmt)}       color="#15803D"     unit="ر.س"   />
          <SummaryBadge label="إجمالي الضريبة"  value={fmtNum(totalTax)}       color="#D97706"     unit="ر.س"   />
          <SummaryBadge label="صافي (بدون ضريبة)" value={fmtNum(totalAmt - totalTax)} color="#6B7280" unit="ر.س" />
        </div>
      )}

    </div>
  );
}

function SummaryBadge({ label, value, color, unit }: { label: string; value: string; color: string; unit: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "4px 14px", borderRadius: 4, background: "white",
      border: `1px solid ${color}30`, minWidth: 110,
    }}>
      <span style={{ fontSize: 9, color: "#888", marginBottom: 1 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color, fontFamily: "monospace" }}>
        {value} <span style={{ fontSize: 10, fontWeight: 400, color: "#888" }}>{unit}</span>
      </span>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   CustomerBalancesTab
   جدول أرصدة شهري مطابق لصورة النظام المرجعية:
   الفترة | الحركة (مدين / دائن) | الرصيد (مدين / دائن)
   ════════════════════════════════════════════════════ */
interface BalInvoiceRow {
  id: number;
  invoiceDate: Date | string;
  invoiceType?: string | null;
  total?: string | null;
  paidAmount?: string | null;
  remainingAmount?: string | null;
}

interface MonthRow {
  monthNum: number;   /* 1-12 */
  label: string;      /* يناير ... */
  debitMove: number;  /* حركة مدين (فواتير مبيعات) */
  creditMove: number; /* حركة دائن (مردودات + مدفوع) */
  balDebit: number;   /* رصيد مدين (تراكمي) */
  balCredit: number;  /* رصيد دائن (تراكمي) */
}

function buildMonthlyRows(data: BalInvoiceRow[]): MonthRow[] {
  /* تجميع حسب الشهر */
  const byMonth: Record<number, { debit: number; credit: number }> = {};
  for (let m = 1; m <= 12; m++) byMonth[m] = { debit: 0, credit: 0 };

  for (const row of data) {
    const d = new Date(row.invoiceDate);
    const m = d.getMonth() + 1;
    const total  = parseFloat(row.total ?? "0");
    const paid   = parseFloat(row.paidAmount ?? "0");

    if (row.invoiceType === "return") {
      byMonth[m].credit += total;
    } else {
      /* sale / quote */
      byMonth[m].debit  += total;
      /* الجزء المدفوع يُسجَّل دائناً */
      if (paid > 0) byMonth[m].credit += paid;
    }
  }

  /* بناء الصفوف مع الرصيد التراكمي */
  let running = 0;
  return MONTHS_AR.map((label, idx) => {
    const m = idx + 1;
    const dm = byMonth[m].debit;
    const cm = byMonth[m].credit;
    running += dm - cm;
    const bd = running > 0 ? running : 0;
    const bc = running < 0 ? Math.abs(running) : 0;
    return { monthNum: m, label, debitMove: dm, creditMove: cm, balDebit: bd, balCredit: bc };
  });
}

function CustomerBalancesTab({
  customerId, year, onYearChange, data, isLoading,
}: {
  customerId: number | null;
  year: number; onYearChange: (y: number) => void;
  data: BalInvoiceRow[];
  isLoading: boolean;
}) {
  const ACCENT = "#406B93";
  const fmtN = (n: number) =>
    n === 0 ? "" : n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (!customerId) {
    return (
      <ESection title="أرصدة" headerColor={ACCENT}>
        <PlaceholderNote text="احفظ العميل أولاً لعرض الأرصدة" />
      </ESection>
    );
  }

  const rows   = buildMonthlyRows(data);
  /* الصف الإجمالي */
  const totDM  = rows.reduce((s, r) => s + r.debitMove,  0);
  const totCM  = rows.reduce((s, r) => s + r.creditMove, 0);
  const netBal = totDM - totCM;
  const totBD  = netBal > 0 ? netBal : 0;
  const totBC  = netBal < 0 ? Math.abs(netBal) : 0;

  /* ─── ألوان ─── */
  const COL_HEADER = ACCENT;
  const COL_TOTAL_BG = "#EBF1F7";
  const COL_DEBIT  = "#B91C1C";
  const COL_CREDIT = "#15803D";
  const COL_BAL_D  = "#1D4ED8";
  const COL_BAL_C  = "#15803D";

  /* ─── نمط خلية ─── */
  const cell = (
    txt: string,
    color = "#333",
    bg = "transparent",
    bold = false,
    align: "right"|"center" = "center"
  ): React.CSSProperties => ({
    padding: "4px 8px", color, background: bg,
    fontWeight: bold ? 700 : 400,
    textAlign: align,
    fontFamily: txt && /[\d,.]/.test(txt) ? "monospace" : "inherit",
    borderLeft: "1px solid #D8D8D8",
    fontSize: 11,
  });

  const COL_GRID = "110px 1fr 1fr 1fr 1fr";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

      {/* ── شريط أدوات ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        padding: "7px 12px", background: "#EBF1F7",
        border: "1px solid #B8CCDF", borderRadius: 4,
      }}>
        {/* عنوان */}
        <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>📊 كشف الحساب السنوي</span>
        <div style={{ flex: 1 }} />

        {/* فلتر السنة */}
        <span style={{ fontSize: 11, color: "#555" }}>السنة:</span>
        <select
          value={year}
          onChange={e => onYearChange(Number(e.target.value))}
          style={{
            height: 26, fontSize: 12, padding: "0 8px", borderRadius: 3,
            border: "1px solid #B8CCDF", background: "white", cursor: "pointer",
            fontWeight: 700, color: ACCENT,
          }}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        {/* رمز العملة */}
        <span style={{
          fontSize: 11, fontWeight: 700, color: "white",
          background: ACCENT, borderRadius: 3, padding: "2px 8px",
        }}>ر.س</span>
      </div>

      {/* ── الجدول ── */}
      <div style={{ border: "1px solid #C4C4C4", borderRadius: 3, overflow: "hidden" }}>

        {/* ─ رأس المجموعات (مزدوج) ─ */}
        <div style={{
          display: "grid", gridTemplateColumns: COL_GRID,
          background: COL_HEADER, color: "white",
          fontSize: 10, fontWeight: 700, textAlign: "center",
        }}>
          <div style={{ padding: "4px 8px", textAlign: "right",  borderLeft: "1px solid rgba(255,255,255,0.25)", gridRow: "1 / 3" }}>الفترة</div>
          <div style={{ padding: "3px 0", gridColumn: "2 / 4", borderLeft: "1px solid rgba(255,255,255,0.25)", borderBottom: "1px solid rgba(255,255,255,0.35)" }}>الحركة</div>
          <div style={{ padding: "3px 0", gridColumn: "4 / 6", borderLeft: "1px solid rgba(255,255,255,0.25)", borderBottom: "1px solid rgba(255,255,255,0.35)" }}>الرصيد</div>
        </div>
        <div style={{
          display: "grid", gridTemplateColumns: COL_GRID,
          background: "#2E5278", color: "white",
          fontSize: 10, fontWeight: 700, textAlign: "center",
        }}>
          <div style={{ padding: "3px 8px", borderLeft: "1px solid rgba(255,255,255,0.25)" }}>مدين</div>
          <div style={{ padding: "3px 8px", borderLeft: "1px solid rgba(255,255,255,0.25)" }}>دائن</div>
          <div style={{ padding: "3px 8px", borderLeft: "1px solid rgba(255,255,255,0.25)" }}>مدين</div>
          <div style={{ padding: "3px 8px", borderLeft: "1px solid rgba(255,255,255,0.25)" }}>دائن</div>
        </div>

        {/* ─ صف الإجمالي ─ */}
        <div style={{
          display: "grid", gridTemplateColumns: COL_GRID,
          background: COL_TOTAL_BG,
          borderBottom: "2px solid #B0BFCC",
        }}>
          <div style={{ ...cell("إجمالي", ACCENT, COL_TOTAL_BG, true, "right"), borderLeft: "none" }}>إجمالي</div>
          <div style={cell(fmtN(totDM),  COL_DEBIT,  COL_TOTAL_BG, true)}>{fmtN(totDM)}</div>
          <div style={cell(fmtN(totCM),  COL_CREDIT, COL_TOTAL_BG, true)}>{fmtN(totCM)}</div>
          <div style={cell(fmtN(totBD),  COL_BAL_D,  COL_TOTAL_BG, true)}>{fmtN(totBD)}</div>
          <div style={cell(fmtN(totBC),  COL_BAL_C,  COL_TOTAL_BG, true)}>{fmtN(totBC)}</div>
        </div>

        {/* ─ صفوف الشهور ─ */}
        <div style={{ maxHeight: 260, overflowY: "auto" }}>
          {isLoading ? (
            <div style={{ padding: 20, textAlign: "center", color: "#888", fontSize: 12 }}>⏳ جاري تحميل البيانات...</div>
          ) : (
            rows.map((row, idx) => {
              const active = row.debitMove > 0 || row.creditMove > 0;
              const bg = active
                ? (idx % 2 === 0 ? "white" : "#F8FAFB")
                : (idx % 2 === 0 ? "#FAFAFA" : "#F4F4F4");
              return (
                <div key={row.monthNum} style={{
                  display: "grid", gridTemplateColumns: COL_GRID,
                  borderTop: "1px solid #E4E4E4",
                  background: bg,
                  opacity: active ? 1 : 0.55,
                }}>
                  {/* اسم الشهر + رقمه */}
                  <div style={{
                    padding: "4px 10px", fontSize: 11, fontWeight: active ? 700 : 400,
                    color: active ? ACCENT : "#999",
                    display: "flex", alignItems: "center", gap: 6,
                    borderLeft: "none",
                  }}>
                    <span style={{
                      display: "inline-block", width: 16, textAlign: "center",
                      fontSize: 9, color: "white", background: active ? ACCENT : "#BBBBC0",
                      borderRadius: 2, padding: "0 2px", flexShrink: 0,
                    }}>{row.monthNum}</span>
                    {row.label}
                  </div>
                  <div style={cell(fmtN(row.debitMove),  active ? COL_DEBIT  : "#CCC", bg)}>{fmtN(row.debitMove)}</div>
                  <div style={cell(fmtN(row.creditMove), active ? COL_CREDIT : "#CCC", bg)}>{fmtN(row.creditMove)}</div>
                  <div style={cell(fmtN(row.balDebit),   active ? COL_BAL_D  : "#CCC", bg)}>{fmtN(row.balDebit)}</div>
                  <div style={cell(fmtN(row.balCredit),  active ? COL_BAL_C  : "#CCC", bg)}>{fmtN(row.balCredit)}</div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── مربعات الملخص ── */}
      {!isLoading && (
        <div style={{
          display: "flex", gap: 10, flexWrap: "wrap",
          padding: "8px 12px", borderRadius: 4,
          background: "#EBF1F7", border: "1px solid #B8CCDF",
        }}>
          <SummaryBadge label="إجمالي المديونية" value={fmtN(totDM) || "0.00"} color={COL_DEBIT}  unit="ر.س" />
          <SummaryBadge label="إجمالي الدائنية"  value={fmtN(totCM) || "0.00"} color={COL_CREDIT} unit="ر.س" />
          <SummaryBadge label="صافي الرصيد"
            value={(netBal !== 0 ? fmtN(Math.abs(netBal)) : "0.00")}
            color={netBal >= 0 ? COL_BAL_D : COL_BAL_C}
            unit={netBal >= 0 ? "ر.س مدين" : "ر.س دائن"} />
        </div>
      )}

    </div>
  );
}

