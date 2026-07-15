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

const POLICIES: { value: RecordPolicy; label: string; desc: string; color: string; icon: React.ReactNode }[] = [
  {
    value: "protected",
    label: "محمي",
    desc: "لا يمكن تعديله أو حذفه",
    color: "bg-red-50 border-red-300 text-red-700",
    icon: <Shield className="w-3.5 h-3.5" />,
  },
  {
    value: "editable",
    label: "قابل للتعديل",
    desc: "يمكن تعديله، لا يمكن حذفه",
    color: "bg-amber-50 border-amber-300 text-amber-700",
    icon: <Pencil className="w-3.5 h-3.5" />,
  },
  {
    value: "flexible",
    label: "مرن",
    desc: "يمكن تعديله وحذفه",
    color: "bg-emerald-50 border-emerald-300 text-emerald-700",
    icon: <Unlock className="w-3.5 h-3.5" />,
  },
];

export function FoundationPolicyPanel({
  recordPolicy,
  foundationKey,
  includeInFoundation,
  onChange,
  disabled = false,
}: FoundationPolicyPanelProps) {
  const currentPolicy = POLICIES.find(p => p.value === recordPolicy) ?? POLICIES[2];

  return (
    <div
      dir="rtl"
      className="mt-4 rounded-xl border border-dashed border-violet-300 bg-violet-50/60 p-3 text-[12px]"
    >
      <div className="flex items-center gap-1.5 mb-2.5 text-violet-700 font-semibold">
        <Archive className="w-3.5 h-3.5" />
        <span>إعدادات التأسيس والسياسة</span>
        <span className="mr-auto text-[10px] font-normal text-violet-400 bg-violet-100 border border-violet-200 rounded px-1.5 py-0.5">
          superadmin فقط
        </span>
      </div>

      {/* ── سياسة السجل ── */}
      <div className="mb-2">
        <div className="text-[10px] text-slate-500 mb-1">سياسة السجل</div>
        <div className="flex gap-1.5 flex-wrap">
          {POLICIES.map(p => (
            <button
              key={p.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(p.value, includeInFoundation)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition-all
                ${recordPolicy === p.value
                  ? `${p.color} shadow-sm ring-1 ring-offset-0 ${
                      p.value === "protected" ? "ring-red-400"
                      : p.value === "editable" ? "ring-amber-400"
                      : "ring-emerald-400"
                    }`
                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                }
                ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              {p.icon}
              <span>{p.label}</span>
            </button>
          ))}
        </div>
        <div className="text-[10px] text-slate-400 mt-1">{currentPolicy.desc}</div>
      </div>

      {/* ── إدراج في قالب التأسيس ── */}
      <label className={`flex items-center gap-2 mt-1 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
        <input
          type="checkbox"
          disabled={disabled}
          checked={includeInFoundation}
          onChange={e => onChange(recordPolicy, e.target.checked)}
          className="accent-violet-600 w-3.5 h-3.5"
        />
        <span className="text-[11px] text-slate-700">إدراج ضمن قالب التأسيس</span>
      </label>

      {/* ── مفتاح التأسيس ── */}
      {includeInFoundation && (
        <div className="mt-2 flex items-center gap-1.5 bg-white border border-violet-200 rounded-lg px-2 py-1">
          <Key className="w-3 h-3 text-violet-400 shrink-0" />
          {foundationKey ? (
            <span className="font-mono text-[10px] text-violet-700 select-all">{foundationKey}</span>
          ) : (
            <span className="text-[10px] text-slate-400 italic">يُنشأ تلقائياً عند الحفظ</span>
          )}
        </div>
      )}
    </div>
  );
}

/** Small inline badge showing current policy (for list views) */
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
