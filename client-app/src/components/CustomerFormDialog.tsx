/**
 * CustomerFormDialog.tsx
 * نافذة إضافة / تعديل العميل — متعددة التبويبات بأسلوب ERP الكلاسيكي
 */
import React, { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

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
  // قنوات الإرسال
  whatsappPhone?: string;
  telegramId?: string;
  defaultSendMethod?: string;
  isActive?: boolean;
}

interface Props {
  open: boolean;
  editData?: CustomerData | null;
  onClose: () => void;
  onSaved: () => void;
}

/* ═══════════════════════════ Constants ═══════════════════════════ */
type TabId = "main" | "address" | "pricing" | "channels" | "accounts" | "balances" | "sales" | "purchases";

const TABS: { id: TabId; label: string }[] = [
  { id: "main",      label: "نافذة رئيسية" },
  { id: "address",   label: "عنوان" },
  { id: "pricing",   label: "التسعير والضوابط" },
  { id: "channels",  label: "قنوات الإرسال" },
  { id: "accounts",  label: "حسابات" },
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
  whatsappPhone: "", telegramId: "", defaultSendMethod: "",
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
export default function CustomerFormDialog({ open, editData, onClose, onSaved }: Props) {
  const [tab, setTab]   = useState<TabId>("main");
  const [form, setForm] = useState<CustomerData>(EMPTY);
  const nameRef         = useRef<HTMLInputElement>(null);
  const utils           = trpc.useUtils();

  const create = trpc.customers.create.useMutation({
    onSuccess: () => { utils.customers.list.invalidate(); toast.success("تم إضافة العميل بنجاح"); onSaved(); },
    onError:   (e) => toast.error(e.message),
  });
  const update = trpc.customers.update.useMutation({
    onSuccess: () => { utils.customers.list.invalidate(); toast.success("تم حفظ التعديلات"); onSaved(); },
    onError:   (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (!open) return;
    setTab("main");
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
        whatsappPhone:      editData.whatsappPhone      ?? "",
        telegramId:         editData.telegramId         ?? "",
        defaultSendMethod:  editData.defaultSendMethod  ?? "",
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, editData]);

  useEffect(() => {
    if (open) setTimeout(() => nameRef.current?.focus(), 80);
  }, [open]);

  const set = (k: keyof CustomerData, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.name?.trim()) { toast.error("اسم العميل مطلوب"); setTab("main"); return; }
    if (form.customerType === "organization" && !form.taxNumber?.trim()) {
      toast.error("الرقم الضريبي مطلوب للمؤسسات"); setTab("main"); return;
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
      whatsappPhone:      form.whatsappPhone?.trim()      || undefined,
      telegramId:         form.telegramId?.trim()         || undefined,
      defaultSendMethod:  (form.defaultSendMethod as any) || undefined,
    };
    if (editData?.id) update.mutate({ id: editData.id, ...payload });
    else              create.mutate(payload);
  };

  if (!open) return null;

  const isOrg     = form.customerType === "organization";
  const isPending = create.isPending || update.isPending;
  const title     = editData?.id ? `تعديل العميل — ${editData.name ?? ""}` : "إضافة عميل جديد";

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1200,
               background: "rgba(0,0,0,0.45)", display: "flex",
               alignItems: "center", justifyContent: "center" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div dir="rtl" style={{
        width: 760, maxWidth: "98vw",
        background: "#F0F0F0",
        border: "2px solid #A0A0A0",
        boxShadow: "4px 4px 16px rgba(0,0,0,0.5)",
        display: "flex", flexDirection: "column",
        maxHeight: "92vh", overflow: "hidden",
        borderRadius: 2,
      }}>

        {/* ── Title Bar ── */}
        <div style={{
          background: `linear-gradient(90deg, ${PRIMARY} 0%, #2e5070 100%)`,
          padding: "5px 8px", display: "flex", alignItems: "center",
          justifyContent: "space-between", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 16 }}>👤</span>
            <span style={{ color: "white", fontWeight: 700, fontSize: 13 }}>{title}</span>
          </div>
          <button onClick={onClose} style={{
            width: 18, height: 18, background: "#C75050", border: "1px solid #9a3030",
            color: "white", fontSize: 10, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 2,
          }}>✕</button>
        </div>

        {/* ── Tab Bar ── */}
        <div style={{
          background: "#E0E0E0", borderBottom: "2px solid #A0A0A0",
          display: "flex", flexShrink: 0, overflowX: "auto",
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "5px 12px", fontSize: 12,
              fontWeight: tab === t.id ? 700 : 500,
              background: tab === t.id ? "#F0F0F0" : "transparent",
              color: tab === t.id ? PRIMARY : "#444",
              border: "none", borderLeft: "1px solid #C0C0C0",
              borderBottom: tab === t.id ? "2px solid #F0F0F0" : "none",
              marginBottom: tab === t.id ? -2 : 0,
              cursor: "pointer", whiteSpace: "nowrap",
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div style={{ overflowY: "auto", flexGrow: 1, padding: "12px 14px" }}>

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
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {PRICE_LEVELS.map(pl => {
                    const active = (form.priceLevel ?? 1) === pl.value;
                    return (
                      <button key={pl.value} type="button"
                        onClick={() => setForm(f => ({ ...f, priceLevel: pl.value }))}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "7px 12px", borderRadius: 4, cursor: "pointer",
                          border: `2px solid ${active ? pl.color : "#D0D0D0"}`,
                          background: active ? `${pl.color}12` : "white",
                          textAlign: "right", width: "100%",
                          transition: "all 0.12s",
                        }}>
                        {/* Bullet indicator */}
                        <div style={{
                          width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                          background: active ? pl.color : "#D0D0D0",
                          border: `2px solid ${active ? pl.color : "#C0C0C0"}`,
                          boxShadow: active ? `0 0 0 3px ${pl.color}30` : "none",
                        }} />
                        {/* Level number badge */}
                        <span style={{
                          width: 22, height: 22, borderRadius: 4, display: "flex",
                          alignItems: "center", justifyContent: "center", flexShrink: 0,
                          background: active ? pl.color : "#E8E8E8",
                          color: active ? "white" : "#666",
                          fontSize: 11, fontWeight: 700,
                        }}>{pl.value}</span>
                        {/* Text */}
                        <div style={{ flex: 1, textAlign: "right" }}>
                          <div style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? pl.color : "#333" }}>
                            {pl.label}
                          </div>
                          <div style={{ fontSize: 10, color: "#888", marginTop: 1 }}>{pl.hint}</div>
                        </div>
                        {/* Active checkmark */}
                        {active && (
                          <span style={{ color: pl.color, fontSize: 14, fontWeight: 700, marginLeft: 4 }}>✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
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

          {/* ══ Placeholder tabs ══ */}
          {(tab === "accounts" || (tab === "balances" && !editData?.id) || tab === "sales" || tab === "purchases") && (
            <ESection title={TABS.find(t => t.id === tab)?.label ?? ""}>
              <PlaceholderNote text="سيتم تفعيل هذا القسم في إصدار قادم" />
            </ESection>
          )}

        </div>

        {/* ── Footer ── */}
        <div style={{
          background: "#E0E0E0", borderTop: "1px solid #A0A0A0",
          padding: "8px 14px", display: "flex", alignItems: "center",
          justifyContent: "space-between", flexShrink: 0,
        }}>
          <span style={{
            padding: "2px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700,
            background: isOrg ? "#DBEAFE" : "#DCFCE7",
            color:      isOrg ? "#1D4ED8" : "#15803D",
            border:     `1px solid ${isOrg ? "#93C5FD" : "#86EFAC"}`,
          }}>
            {isOrg ? "📋 مؤسسة" : "🧾 فرد"}
          </span>

          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={onClose} disabled={isPending} style={{
              padding: "5px 14px", fontSize: 12, fontWeight: 600, borderRadius: 3,
              background: "#E0E0E0", color: "#333", border: "1px solid #A0A0A0",
              cursor: "pointer",
            }}>إلغاء</button>
            <button onClick={handleSave} disabled={isPending} style={{
              padding: "5px 18px", fontSize: 12, fontWeight: 700, borderRadius: 3,
              background: isPending ? "#A0A0A0" : PRIMARY, color: "white",
              border: `1px solid ${isPending ? "#888" : "#2e5070"}`,
              cursor: isPending ? "not-allowed" : "pointer",
            }}>
              {isPending ? "جاري الحفظ..." : editData?.id ? "💾 حفظ التعديلات" : "➕ إضافة العميل"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ═══════════════════════════ Sub-components ═══════════════════════════ */

function ESection({ title, children, headerColor, note }: {
  title: string; children: React.ReactNode;
  headerColor?: string; note?: string;
}) {
  return (
    <div style={{ border: "1px solid #C0C0C0", borderRadius: 3, overflow: "hidden" }}>
      <div style={{
        background: headerColor ? `${headerColor}18` : "#E8EEF4",
        borderBottom: "1px solid #C0C0C0", padding: "4px 10px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: headerColor ?? "#2B4A6A" }}>{title}</span>
        {note && <span style={{ fontSize: 10, color: "#888" }}>{note}</span>}
      </div>
      <div style={{ padding: "10px" }}>{children}</div>
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
        height: 26, fontSize: 13, padding: "0 7px",
        border: "1px solid #A0A0A0", background: "white",
        fontFamily: mono ? "monospace" : "inherit",
        outline: "none", width: "100%", borderRadius: 2,
        boxSizing: "border-box",
        ...style,
      }}
    />
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

