import React from "react";
import { Shield, Pencil, Unlock, Archive, Key } from "lucide-react";

export type RecordPolicy = "protected" | "editable" | "flexible";

interface FoundationPolicyPanelProps {
  recordPolicy: RecordPolicy;
  foundationKey: string | null | undefined;
  includeInFoundation: boolean;
  onChange: (policy: RecordPolicy, includeInFoundation: boolean) => void;
  disabled?: boolean;
}

const POLICIES: { value: RecordPolicy; label: string; color: string; icon: React.ReactNode }[] = [
  {
    value: "protected",
    label: "محمي",
    color: "bg-red-50 border-red-300 text-red-700 ring-red-400",
    icon: <Shield className="w-3 h-3" />,
  },
  {
    value: "editable",
    label: "قابل",
    color: "bg-amber-50 border-amber-300 text-amber-700 ring-amber-400",
    icon: <Pencil className="w-3 h-3" />,
  },
  {
    value: "flexible",
    label: "مرن",
    color: "bg-emerald-50 border-emerald-300 text-emerald-700 ring-emerald-400",
    icon: <Unlock className="w-3 h-3" />,
  },
];

export function FoundationPolicyPanel({
  recordPolicy,
  foundationKey,
  includeInFoundation,
  onChange,
  disabled = false,
}: FoundationPolicyPanelProps) {
  return (
    <div
      dir="rtl"
      className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-lg border border-dashed border-violet-200 bg-violet-50/40 text-[11px] flex-wrap"
    >
      {/* عنوان */}
      <div className="flex items-center gap-1 text-violet-600 font-semibold shrink-0">
        <Archive className="w-3.5 h-3.5" />
        <span>التأسيس</span>
      </div>

      {/* فاصل */}
      <div className="h-3.5 w-px bg-violet-200 shrink-0" />

      {/* أزرار السياسة */}
      <div className="flex items-center gap-1 shrink-0">
        {POLICIES.map(p => (
          <button
            key={p.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(p.value, includeInFoundation)}
            title={p.label}
            className={[
              "flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-medium transition-all",
              recordPolicy === p.value
                ? `${p.color} shadow-sm ring-1 ring-offset-0`
                : "bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600",
              disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
            ].join(" ")}
          >
            {p.icon}
            <span>{p.label}</span>
          </button>
        ))}
      </div>

      {/* فاصل */}
      <div className="h-3.5 w-px bg-violet-200 shrink-0" />

      {/* إدراج في التأسيس */}
      <label className={`flex items-center gap-1 shrink-0 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
        <input
          type="checkbox"
          disabled={disabled}
          checked={includeInFoundation}
          onChange={e => onChange(recordPolicy, e.target.checked)}
          className="accent-violet-600 w-3 h-3"
        />
        <span className="text-slate-600">إدراج في التأسيس</span>
      </label>

      {/* مفتاح التأسيس (يظهر فقط عند التفعيل) */}
      {includeInFoundation && (
        <>
          <div className="h-3.5 w-px bg-violet-200 shrink-0" />
          <div className="flex items-center gap-1 bg-white border border-violet-200 rounded px-1.5 py-0.5">
            <Key className="w-3 h-3 text-violet-400 shrink-0" />
            {foundationKey ? (
              <span className="font-mono text-[9px] text-violet-700 select-all">{foundationKey}</span>
            ) : (
              <span className="text-[9px] text-slate-400 italic">يُنشأ عند الحفظ</span>
            )}
          </div>
        </>
      )}

      {/* شارة superadmin */}
      <span className="mr-auto text-[9px] text-violet-400 bg-violet-100 border border-violet-200 rounded px-1.5 py-0.5 shrink-0 font-mono">
        SA
      </span>
    </div>
  );
}

/** شارة صغيرة تُعرض في قوائم الجداول */
export function PolicyBadge({ policy }: { policy: string | null | undefined }) {
  if (!policy || policy === "flexible") return null;
  const isProtected = policy === "protected";
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[9px] font-medium px-1 py-0.5 rounded border ${
        isProtected
          ? "bg-red-50 border-red-200 text-red-600"
          : "bg-amber-50 border-amber-200 text-amber-600"
      }`}
    >
      {isProtected ? <Shield className="w-2.5 h-2.5" /> : <Pencil className="w-2.5 h-2.5" />}
      {isProtected ? "محمي" : "مقيّد"}
    </span>
  );
}
