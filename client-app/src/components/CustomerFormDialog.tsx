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

/* ═══════════════════════════ Tab list ═══════════════════════════ */
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

/* ═══════════════════════════ Helpers ═══════════════════════════ */
const PRIMARY = "#406B93";
const EMPTY: CustomerData = {
  code: "", name: "", customerType: "individual",
  phone: "", email: "", taxNumber: "", registrationNumber: "",
  city: "", address: "", shortAddress: "", buildingNumber: "",
  additionalNumber: "", postalCode: "", creditLimit: "",
  whatsappPhone: "", telegramId: "", defaultSendMethod: "",
};

/* ═══════════════════════════ Component ═══════════════════════════ */
export default function CustomerFormDialog({ open, editData, onClose, onSaved }: Props) {
  const [tab, setTab]       = useState<TabId>("main");
  const [form, setForm]     = useState<CustomerData>(EMPTY);
  const nameRef             = useRef<HTMLInputElement>(null);
  const utils               = trpc.useUtils();

  const create = trpc.customers.create.useMutation({
    onSuccess: () => { utils.customers.list.invalidate(); toast.success("تم إضافة العميل بنجاح"); onSaved(); },
    onError:   (e) => toast.error(e.message),
  });
  const update = trpc.customers.update.useMutation({
    onSuccess: () => { utils.customers.list.invalidate(); toast.success("تم حفظ التعديلات"); onSaved(); },
    onError:   (e) => toast.error(e.message),
  });

  /* ─── Sync form with editData ─── */
  useEffect(() => {
    if (!open) return;
    setTab("main");
    if (editData) {
      setForm({
        ...EMPTY,
        ...editData,
        code:           editData.code           ?? "",
        name:           editData.name           ?? "",
        customerType:   (editData.customerType as any) ?? "individual",
        phone:          editData.phone          ?? "",
        email:          editData.email          ?? "",
        taxNumber:      editData.taxNumber      ?? "",
        registrationNumber: editData.registrationNumber ?? "",
        city:           editData.city           ?? "",
        address:        editData.address        ?? "",
        shortAddress:   editData.shortAddress   ?? "",
        buildingNumber: editData.buildingNumber ?? "",
        additionalNumber: editData.additionalNumber ?? "",
        postalCode:     editData.postalCode     ?? "",
        creditLimit:    editData.creditLimit    ?? "",
        whatsappPhone:  editData.whatsappPhone  ?? "",
        telegramId:     editData.telegramId     ?? "",
        defaultSendMethod: editData.defaultSendMethod ?? "",
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, editData]);

  /* ─── Auto-focus name field ─── */
  useEffect(() => {
    if (open) setTimeout(() => nameRef.current?.focus(), 80);
  }, [open]);

  const set = (k: keyof CustomerData, v: string) => setForm(f => ({ ...f, [k]: v }));

  /* ─── Validate & Submit ─── */
  const handleSave = () => {
    if (!form.name?.trim()) { toast.error("اسم العميل مطلوب"); setTab("main"); return; }
    if (form.customerType === "organization" && !form.taxNumber?.trim()) {
      toast.error("الرقم الضريبي مطلوب للمؤسسات"); setTab("main"); return;
    }
    const payload = {
      code:               form.code?.trim()             || undefined,
      name:               form.name.trim(),
      customerType:       form.customerType,
      phone:              form.phone?.trim()             || undefined,
      email:              form.email?.trim()             || undefined,
      taxNumber:          form.taxNumber?.trim()         || undefined,
      registrationNumber: form.registrationNumber?.trim()|| undefined,
      city:               form.city?.trim()              || undefined,
      address:            form.address?.trim()           || undefined,
      shortAddress:       form.shortAddress?.trim()      || undefined,
      buildingNumber:     form.buildingNumber?.trim()    || undefined,
      additionalNumber:   form.additionalNumber?.trim()  || undefined,
      postalCode:         form.postalCode?.trim()        || undefined,
      creditLimit:        form.creditLimit?.trim()       || undefined,
      whatsappPhone:      form.whatsappPhone?.trim()     || undefined,
      telegramId:         form.telegramId?.trim()        || undefined,
      defaultSendMethod:  (form.defaultSendMethod as any)|| undefined,
    };
    if (editData?.id) update.mutate({ id: editData.id, ...payload });
    else              create.mutate(payload);
  };

  if (!open) return null;

  const isOrg    = form.customerType === "organization";
  const isPending = create.isPending || update.isPending;
  const title     = editData?.id ? `تعديل العميل — ${editData.name ?? ""}` : "إضافة عميل جديد";

  /* ═══════════════════════════ Render ═══════════════════════════ */
  return (
    /* Backdrop */
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1200,
               background: "rgba(0,0,0,0.45)", display: "flex",
               alignItems: "center", justifyContent: "center" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Window */}
      <div
        dir="rtl"
        style={{
          width: 760, maxWidth: "98vw",
          background: "#F0F0F0",
          border: "2px solid #A0A0A0",
          boxShadow: "4px 4px 16px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column",
          maxHeight: "92vh", overflow: "hidden",
          borderRadius: 2,
        }}
      >
        {/* ── Title Bar ── */}
        <div style={{
          background: `linear-gradient(90deg, ${PRIMARY} 0%, #2e5070 100%)`,
          padding: "5px 8px", display: "flex", alignItems: "center",
          justifyContent: "space-between", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 16 }}>👤</span>
            <span style={{ color: "white", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
              {title}
            </span>
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            <button onClick={onClose} style={{
              width: 18, height: 18, background: "#C75050", border: "1px solid #9a3030",
              color: "white", fontSize: 11, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 2,
            }}>✕</button>
          </div>
        </div>

        {/* ── Tab Bar ── */}
        <div style={{
          background: "#E0E0E0", borderBottom: "2px solid #A0A0A0",
          display: "flex", flexShrink: 0, overflowX: "auto",
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "5px 12px", fontSize: 12, fontWeight: tab === t.id ? 700 : 500,
              background: tab === t.id ? "#F0F0F0" : "transparent",
              color: tab === t.id ? PRIMARY : "#444",
              border: "none", borderLeft: "1px solid #C0C0C0",
              borderBottom: tab === t.id ? "2px solid #F0F0F0" : "none",
              marginBottom: tab === t.id ? -2 : 0,
              cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Body (scrollable) ── */}
        <div style={{ overflowY: "auto", flexGrow: 1, padding: "12px 14px" }}>

          {/* ══════════ TAB: نافذة رئيسية ══════════ */}
          {tab === "main" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

              {/* نوع العميل */}
              <Section title="نوع العميل">
                <div style={{ display: "flex", gap: 8 }}>
                  <TypeBtn
                    active={!isOrg}
                    label="🧾 فرد (فاتورة مبسطة)"
                    color="#15803D"
                    onClick={() => { set("customerType", "individual"); set("taxNumber", ""); }}
                  />
                  <TypeBtn
                    active={isOrg}
                    label="📋 مؤسسة (فاتورة ضريبية)"
                    color="#1D4ED8"
                    onClick={() => set("customerType", "organization")}
                  />
                </div>
              </Section>

              {/* معلومات أساسية */}
              <Section title="المعلومات الأساسية">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 14px" }}>
                  <Field label="كود العميل" hint="يُعبأ تلقائياً إن تُرك فارغاً">
                    <ClassicInput value={form.code} onChange={v => set("code", v)}
                      placeholder="مثال: CU-001" mono />
                  </Field>
                  <Field label={isOrg ? "اسم المؤسسة *" : "اسم العميل *"}>
                    <ClassicInput ref={nameRef} value={form.name} onChange={v => set("name", v)}
                      placeholder={isOrg ? "اسم الشركة أو المؤسسة..." : "أدخل اسم العميل..."}
                      required />
                  </Field>
                  <Field label="رقم الجوال">
                    <ClassicInput value={form.phone} onChange={v => set("phone", v)}
                      placeholder="05xxxxxxxx" ltr />
                  </Field>
                  <Field label="البريد الإلكتروني">
                    <ClassicInput value={form.email} onChange={v => set("email", v)}
                      placeholder="example@domain.com" ltr />
                  </Field>
                </div>
              </Section>

              {/* بيانات الضريبة — للمؤسسات */}
              <Section title="البيانات الضريبية والتجارية"
                headerColor={isOrg ? "#1D4ED8" : undefined}
                note={!isOrg ? "تنطبق على العملاء من نوع مؤسسة فقط" : undefined}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 14px",
                              opacity: isOrg ? 1 : 0.45, pointerEvents: isOrg ? "auto" : "none" }}>
                  <Field label="الرقم الضريبي *" hint={isOrg ? "مطلوب للمؤسسات" : ""}>
                    <ClassicInput value={form.taxNumber} onChange={v => set("taxNumber", v)}
                      placeholder="3xxxxxxxxxxxxxxxxx" ltr
                      style={isOrg && !form.taxNumber?.trim()
                        ? { borderColor: "#FCA5A5", background: "#FFF5F5" }
                        : isOrg ? { borderColor: "#86EFAC", background: "#F0FDF4" } : undefined}
                    />
                  </Field>
                  <Field label="رقم السجل التجاري">
                    <ClassicInput value={form.registrationNumber} onChange={v => set("registrationNumber", v)}
                      placeholder="1010xxxxxx" ltr />
                  </Field>
                </div>
              </Section>

            </div>
          )}

          {/* ══════════ TAB: عنوان ══════════ */}
          {tab === "address" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Section title="العنوان التفصيلي">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 14px" }}>
                  <Field label="المدينة">
                    <ClassicInput value={form.city} onChange={v => set("city", v)} placeholder="مثال: الرياض" />
                  </Field>
                  <Field label="العنوان المختصر (ABRV)">
                    <ClassicInput value={form.shortAddress} onChange={v => set("shortAddress", v)}
                      placeholder="الرمز المختصر للعنوان" ltr />
                  </Field>
                  <Field label="رقم المبنى">
                    <ClassicInput value={form.buildingNumber} onChange={v => set("buildingNumber", v)}
                      placeholder="رقم المبنى" ltr />
                  </Field>
                  <Field label="الرقم الإضافي">
                    <ClassicInput value={form.additionalNumber} onChange={v => set("additionalNumber", v)}
                      placeholder="الرقم الإضافي" ltr />
                  </Field>
                  <Field label="الرمز البريدي">
                    <ClassicInput value={form.postalCode} onChange={v => set("postalCode", v)}
                      placeholder="12345" ltr />
                  </Field>
                </div>
              </Section>
              <Section title="العنوان الكامل">
                <textarea
                  value={form.address}
                  onChange={e => set("address", e.target.value)}
                  rows={3}
                  placeholder="العنوان التفصيلي الكامل..."
                  style={{
                    width: "100%", fontSize: 13, padding: "5px 8px",
                    border: "1px solid #A0A0A0", background: "white",
                    resize: "vertical", fontFamily: "inherit",
                    borderRadius: 2, outline: "none",
                  }}
                />
              </Section>
            </div>
          )}

          {/* ══════════ TAB: التسعير والضوابط ══════════ */}
          {tab === "pricing" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Section title="حدود الائتمان">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 14px" }}>
                  <Field label="حد الائتمان (الحد الأقصى للمديونية)"
                    hint="صفر يعني لا يوجد حد">
                    <ClassicInput value={form.creditLimit} onChange={v => set("creditLimit", v)}
                      placeholder="0.00" ltr mono />
                  </Field>
                </div>
              </Section>
              <Section title="التسعير">
                <PlaceholderNote text="سيتم ربط مستويات الأسعار في إصدار قادم" />
              </Section>
              <Section title="الخصومات">
                <PlaceholderNote text="سيتم ربط إعدادات الخصم في إصدار قادم" />
              </Section>
            </div>
          )}

          {/* ══════════ TAB: قنوات الإرسال ══════════ */}
          {tab === "channels" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Section title="بيانات الاتصال الإلكتروني">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 14px" }}>
                  <Field label="رقم الواتساب" hint="إن اختلف عن رقم الجوال">
                    <ClassicInput value={form.whatsappPhone} onChange={v => set("whatsappPhone", v)}
                      placeholder="05xxxxxxxx" ltr />
                  </Field>
                  <Field label="معرّف تيليجرام">
                    <ClassicInput value={form.telegramId} onChange={v => set("telegramId", v)}
                      placeholder="@username أو Chat ID" ltr />
                  </Field>
                </div>
              </Section>
              <Section title="طريقة الإرسال الافتراضية">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { v: "",         label: "— بدون تفضيل —" },
                    { v: "whatsapp", label: "📱 واتساب" },
                    { v: "telegram", label: "✈️ تيليجرام" },
                    { v: "email",    label: "📧 بريد إلكتروني" },
                  ].map(opt => (
                    <button key={opt.v} onClick={() => set("defaultSendMethod", opt.v)} style={{
                      padding: "5px 14px", fontSize: 12, borderRadius: 3, cursor: "pointer",
                      fontFamily: "inherit", fontWeight: 600,
                      background: form.defaultSendMethod === opt.v ? PRIMARY : "#E8E8E8",
                      color:      form.defaultSendMethod === opt.v ? "white"  : "#333",
                      border:     `1px solid ${form.defaultSendMethod === opt.v ? PRIMARY : "#C0C0C0"}`,
                    }}>{opt.label}</button>
                  ))}
                </div>
              </Section>
            </div>
          )}

          {/* ══════════ Placeholder Tabs ══════════ */}
          {(tab === "accounts" || tab === "balances" || tab === "sales" || tab === "purchases") && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {tab === "balances" && editData?.id && (
                <Section title="الرصيد الحالي">
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <BalanceBadge label="الرصيد" value={editData.balance ?? "0"} color={PRIMARY} />
                    <BalanceBadge label="حد الائتمان" value={form.creditLimit || "0"} color="#15803D" />
                  </div>
                </Section>
              )}
              <Section title={TABS.find(t => t.id === tab)?.label ?? ""}>
                <PlaceholderNote text="سيتم تفعيل هذا القسم في إصدار قادم" />
              </Section>
            </div>
          )}

        </div>

        {/* ── Footer / Action Bar ── */}
        <div style={{
          background: "#E0E0E0", borderTop: "1px solid #A0A0A0",
          padding: "8px 14px", display: "flex", alignItems: "center",
          justifyContent: "space-between", flexShrink: 0, gap: 8,
        }}>
          {/* Status badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              padding: "2px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700,
              background: isOrg ? "#DBEAFE" : "#DCFCE7",
              color:      isOrg ? "#1D4ED8" : "#15803D",
              border:     `1px solid ${isOrg ? "#93C5FD" : "#86EFAC"}`,
            }}>
              {isOrg ? "📋 مؤسسة" : "🧾 فرد"}
            </span>
            {editData?.id && (
              <span style={{ fontSize: 11, color: "#666" }}>
                كود: <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{editData.code || "—"}</span>
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={onClose} disabled={isPending} style={btnStyle("outline")}>إلغاء</button>
            <button onClick={handleSave} disabled={isPending} style={btnStyle("primary", isPending)}>
              {isPending ? "جاري الحفظ..." : editData?.id ? "💾 حفظ التعديلات" : "➕ إضافة العميل"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════ Sub-components ═══════════════════════════ */

function Section({ title, children, headerColor, note }: {
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
        <span style={{ fontSize: 12, fontWeight: 700, color: headerColor ?? "#2B4A6A" }}>
          {title}
        </span>
        {note && <span style={{ fontSize: 10, color: "#888" }}>{note}</span>}
      </div>
      <div style={{ padding: "10px 10px" }}>{children}</div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
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

const ClassicInput = React.forwardRef<HTMLInputElement, {
  value?: string; onChange: (v: string) => void;
  placeholder?: string; ltr?: boolean; mono?: boolean;
  required?: boolean; style?: React.CSSProperties;
}>(({ value, onChange, placeholder, ltr, mono, required, style }, ref) => (
  <input
    ref={ref}
    value={value ?? ""}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    dir={ltr ? "ltr" : "rtl"}
    style={{
      height: 26, fontSize: 13, padding: "0 7px",
      border: "1px solid #A0A0A0", background: "white",
      fontFamily: mono ? "monospace" : "inherit",
      outline: "none", width: "100%", borderRadius: 2,
      ...(required ? { borderColor: "#86EFAC" } : {}),
      ...style,
    }}
  />
));

function TypeBtn({ active, label, color, onClick }: {
  active: boolean; label: string; color: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, padding: "7px 10px", fontSize: 12, fontWeight: 700,
        borderRadius: 3, cursor: "pointer", fontFamily: "inherit",
        background: active ? color : "#E8E8E8",
        color:      active ? "white" : "#555",
        border:     `2px solid ${active ? color : "#C0C0C0"}`,
        transition: "all 0.15s",
      }}
    >{label}</button>
  );
}

function BalanceBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: "8px 16px", borderRadius: 4,
      background: `${color}14`, border: `1px solid ${color}44`,
      textAlign: "center", minWidth: 130,
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
    <div style={{
      padding: "20px", textAlign: "center", color: "#999",
      fontSize: 12, fontStyle: "italic",
    }}>
      ⏳ {text}
    </div>
  );
}

function btnStyle(variant: "primary" | "outline", disabled?: boolean): React.CSSProperties {
  if (variant === "primary") return {
    padding: "5px 18px", fontSize: 12, fontWeight: 700, borderRadius: 3,
    background: disabled ? "#A0A0A0" : PRIMARY, color: "white",
    border: `1px solid ${disabled ? "#888" : "#2e5070"}`,
    cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit",
  };
  return {
    padding: "5px 14px", fontSize: 12, fontWeight: 600, borderRadius: 3,
    background: "#E0E0E0", color: "#333",
    border: "1px solid #A0A0A0", cursor: "pointer", fontFamily: "inherit",
  };
}
