import React from "react";

export type PartyEntityType = "customer" | "supplier";
export type PartyType = "individual" | "organization";

export interface PartyMainForm {
  code?: string;
  name?: string;
  partyType?: PartyType;
  phone?: string;
  email?: string;
  taxNumber?: string;
  registrationNumber?: string;
}

interface Props {
  entityType: PartyEntityType;
  form: PartyMainForm;
  onChange: (key: keyof PartyMainForm, value: string) => void;
  nameRef?: React.RefObject<HTMLInputElement | null>;
}

const copy = {
  customer: {
    typeTitle: "نوع العميل",
    code: "كود العميل",
    codePlaceholder: "مثال: CU-001",
    name: "اسم العميل",
    namePlaceholder: "أدخل اسم العميل...",
    organizationName: "اسم المؤسسة",
    phone: "رقم الجوال",
    tax: "الرقم الضريبي",
  },
  supplier: {
    typeTitle: "نوع المورد",
    code: "كود المورد",
    codePlaceholder: "مثال: SU-001",
    name: "اسم المورد",
    namePlaceholder: "أدخل اسم المورد...",
    organizationName: "اسم المؤسسة",
    phone: "رقم جوال المورد",
    tax: "الرقم الضريبي",
  },
} as const;

export function PartyMainTab({ entityType, form, onChange, nameRef }: Props) {
  const labels = copy[entityType];
  const isOrganization = form.partyType === "organization";
  const set = (key: keyof PartyMainForm, value: string) => onChange(key, value);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ESection title={labels.typeTitle}>
        <div style={{ display: "flex", gap: 8 }}>
          <TypeBtn
            active={!isOrganization}
            label="🧾 فرد (فاتورة مبسطة)"
            color="#15803D"
            onClick={() => {
              set("partyType", "individual");
              set("taxNumber", "");
            }}
          />
          <TypeBtn
            active={isOrganization}
            label="📋 مؤسسة (فاتورة ضريبية)"
            color="#1D4ED8"
            onClick={() => set("partyType", "organization")}
          />
        </div>
      </ESection>

      <ESection title="المعلومات الأساسية">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 14px" }}>
          <EField label={labels.code} hint="يُعبأ تلقائياً إن تُرك فارغاً">
            <EInput value={form.code ?? ""} onChange={v => set("code", v)} placeholder={labels.codePlaceholder} mono />
          </EField>
          <EField label={`${isOrganization ? labels.organizationName : labels.name} *`}>
            <EInput
              inputRef={nameRef}
              value={form.name ?? ""}
              onChange={v => set("name", v)}
              placeholder={isOrganization ? "اسم الشركة أو المؤسسة..." : labels.namePlaceholder}
            />
          </EField>
          <EField label={labels.phone}>
            <EInput value={form.phone ?? ""} onChange={v => set("phone", v)} placeholder="05xxxxxxxx" ltr />
          </EField>
          <EField label="البريد الإلكتروني">
            <EInput value={form.email ?? ""} onChange={v => set("email", v)} placeholder="example@domain.com" ltr />
          </EField>
        </div>
      </ESection>

      <ESection
        title="البيانات الضريبية والتجارية"
        headerColor={isOrganization ? "#1D4ED8" : undefined}
        note={!isOrganization ? "تنطبق على المؤسسات فقط" : undefined}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px 14px",
            opacity: isOrganization ? 1 : 0.4,
            pointerEvents: isOrganization ? "auto" : "none",
          }}
        >
          <EField label={`${labels.tax} *`}>
            <EInput
              value={form.taxNumber ?? ""}
              onChange={v => set("taxNumber", v)}
              placeholder="3xxxxxxxxxxxxxxxxx"
              ltr
              style={
                isOrganization
                  ? form.taxNumber?.trim()
                    ? { borderColor: "#86EFAC", background: "#F0FDF4" }
                    : { borderColor: "#FCA5A5", background: "#FFF5F5" }
                  : undefined
              }
            />
          </EField>
          <EField label="رقم السجل التجاري">
            <EInput value={form.registrationNumber ?? ""} onChange={v => set("registrationNumber", v)} placeholder="1010xxxxxx" ltr />
          </EField>
        </div>
      </ESection>
    </div>
  );
}

function ESection({ title, children, headerColor, note }: {
  title: string;
  children: React.ReactNode;
  headerColor?: string;
  note?: string;
}) {
  return (
    <div className="customer-section" style={{ border: "1px solid #c9c4bc", borderRadius: 4, overflow: "hidden", background: "#f0ede8", boxShadow: "0 1px 2px rgba(0,0,0,.06)" }}>
      <div style={{ background: "#f0ede8", borderBottom: "1px solid #c9c4bc", padding: "0 10px", minHeight: 28, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="customer-section-title" style={{ fontSize: 10, lineHeight: "28px", fontWeight: 800, color: headerColor ?? "#3f4448" }}>{title}</span>
        {note && <span className="customer-section-note" style={{ fontSize: 9, color: "#777" }}>{note}</span>}
      </div>
      <div style={{ padding: "8px 10px" }}>{children}</div>
    </div>
  );
}

function EField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span className="customer-field-label" style={{ fontSize: 10, fontWeight: 700, color: "#42474b" }}>
        {label}
        {hint && <small style={{ fontSize: 8, fontWeight: 400, color: "#888", marginRight: 4 }}>({hint})</small>}
      </span>
      {children}
    </label>
  );
}

function EInput({ value, onChange, placeholder, ltr, mono, inputRef, style }: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ltr?: boolean;
  mono?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  style?: React.CSSProperties;
}) {
  return (
    <input
      ref={inputRef}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      dir={ltr ? "ltr" : "rtl"}
      className="customer-field-input"
      style={{ height: 30, fontSize: 13, fontFamily: mono ? "monospace" : "inherit", ...style }}
    />
  );
}

function TypeBtn({ active, label, color, onClick }: { active: boolean; label: string; color: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: "8px 12px",
        borderRadius: 4,
        cursor: "pointer",
        border: `2px solid ${active ? color : "#D0D0D0"}`,
        background: active ? color : "white",
        color: active ? "white" : "#777",
        textAlign: "center",
        fontSize: 12,
        fontWeight: active ? 700 : 500,
      }}
    >
      {label}
    </button>
  );
}