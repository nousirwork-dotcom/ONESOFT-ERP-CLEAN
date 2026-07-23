/**
 * Customers.tsx — صفحة إدارة العملاء مع نافذة الإضافة/التعديل الشاملة
 */
import { useState, useMemo } from "react";
import { trpc } from "@/shared/lib/trpc";
import { toast } from "sonner";
import { Search, Users } from "lucide-react";
import { useToolbarActions } from "@/components/unified-toolbar/ToolbarActionsContext";
import CustomerFormDialog from "@/shared/components/CustomerFormDialog";

export default function Customers() {
  const [search,    setSearch]    = useState("");
  const [dialogOpen, setDialog]   = useState(false);
  const [editData,   setEditData] = useState<any>(null);

  const { data: customers, isLoading, refetch } = trpc.customers.list.useQuery({});

  const openCreate = () => { setEditData(null); setDialog(true); };
  const openEdit   = (c: any) => { setEditData(c); setDialog(true); };
  const handleSaved = () => { setDialog(false); refetch(); };

  const q        = search.trim().toLowerCase();
  const filtered = q
    ? (customers ?? []).filter((c: any) =>
        c.name.toLowerCase().includes(q) ||
        (c.code ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q) ||
        (c.taxNumber ?? "").includes(q)
      )
    : (customers ?? []);

  const toolbarActions = useMemo(() => ({
    save:      { supported: false as const, disabledReason: "القائمة للعرض فقط — افتح سجل عميل للحفظ" },
    draft:     { supported: false as const, disabledReason: "غير مستخدم في قائمة العملاء" },
    new:       { supported: true as const, allowed: true, stateEnabled: true, onClick: openCreate },
    duplicate: { supported: false as const, disabledReason: "افتح سجل عميل أولًا لنسخه" },
    tools:     { supported: false as const, disabledReason: "لا توجد أدوات متاحة في قائمة العملاء" },
    edit:      { supported: false as const, disabledReason: "اضغط مرتين على عميل لتعديله" },
    delete:    { supported: false as const, disabledReason: "اضغط مرتين على عميل ثم احذفه من النافذة" },
    first:     { supported: false as const, disabledReason: "التنقل يتم داخل نافذة العميل" },
    previous:  { supported: false as const, disabledReason: "التنقل يتم داخل نافذة العميل" },
    next:      { supported: false as const, disabledReason: "التنقل يتم داخل نافذة العميل" },
    last:      { supported: false as const, disabledReason: "التنقل يتم داخل نافذة العميل" },
    approve:   { supported: false as const, disabledReason: "غير مستخدم في قائمة العملاء" },
    unapprove: { supported: false as const, disabledReason: "غير مستخدم في قائمة العملاء" },
    preview:   { supported: false as const, disabledReason: "اضغط مرتين على عميل لمطالعة بياناته" },
    send:      { supported: false as const, disabledReason: "افتح سجل عميل أولًا للإرسال" },
    print:     { supported: true as const, allowed: true, stateEnabled: true, onClick: () => { toast.info("جاري طباعة قائمة العملاء..."); } },
    exit:      { supported: false as const, disabledReason: "أغلق التبويب من شريط التبويبات العلوي" },
  }), []);   // openCreate is defined in component scope — stable identity per render is fine here

  useToolbarActions(toolbarActions, []);

  return (
    <div className="space-y-4" dir="rtl">

      {/* ── Search ── */}
      <div style={{ position: "relative", maxWidth: 340 }}>
        <Search style={{
          position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
          width: 15, height: 15, color: "#888",
        }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو الكود أو الهاتف..."
          style={{
            width: "100%", height: 30, paddingRight: 32, paddingLeft: 8,
            fontSize: 13, border: "1px solid #C0C0C0", borderRadius: 3,
            background: "white", outline: "none", fontFamily: "inherit",
          }}
        />
      </div>

      {/* ── Table ── */}
      <div style={{ border: "1px solid #D0D0D0", borderRadius: 4, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#E8EEF4", borderBottom: "2px solid #C0C0C0" }}>
              {["الكود", "النوع", "الاسم", "الهاتف", "المدينة", "الرقم الضريبي", "الرصيد", ""].map((h, i) => (
                <th key={i} style={{
                  textAlign: "right", padding: "6px 10px",
                  fontWeight: 700, color: "#2B4A6A", fontSize: 12,
                  whiteSpace: "nowrap",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F0F0F0" }}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} style={{ padding: "8px 10px" }}>
                      <div style={{ height: 12, background: "#E8E8E8", borderRadius: 4, animation: "pulse 1.5s infinite" }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "40px 0", color: "#999" }}>
                  <Users style={{ width: 32, height: 32, margin: "0 auto 8px", opacity: 0.3 }} />
                  <div style={{ fontSize: 13 }}>
                    {search ? "لا توجد نتائج مطابقة للبحث" : "لا يوجد عملاء — اضغط «جديد» لإضافة أول عميل"}
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((c: any, idx: number) => (
                <tr
                  key={c.id}
                  style={{
                    borderBottom: "1px solid #F0F0F0",
                    background: idx % 2 === 0 ? "white" : "#FAFAFA",
                    cursor: "pointer",
                  }}
                  onDoubleClick={() => openEdit(c)}
                  onMouseEnter={e => (e.currentTarget.style.background = "#EEF4FB")}
                  onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? "white" : "#FAFAFA")}
                >
                  {/* الكود */}
                  <td style={{ padding: "6px 10px" }}>
                    {c.code
                      ? <span style={{
                          fontFamily: "monospace", fontSize: 11, fontWeight: 700,
                          padding: "2px 6px", borderRadius: 4,
                          background: "#E0EAF4", color: "#406B93",
                        }}>{c.code}</span>
                      : <span style={{ color: "#CCC" }}>—</span>
                    }
                  </td>
                  {/* النوع */}
                  <td style={{ padding: "6px 10px" }}>
                    {c.customerType === "organization"
                      ? <span style={{
                          fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 10,
                          background: "#DBEAFE", color: "#1D4ED8", border: "1px solid #93C5FD",
                        }}>📋 مؤسسة</span>
                      : <span style={{
                          fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 10,
                          background: "#DCFCE7", color: "#15803D", border: "1px solid #86EFAC",
                        }}>🧾 فرد</span>
                    }
                  </td>
                  {/* الاسم */}
                  <td style={{ padding: "6px 10px", fontWeight: 600, maxWidth: 200 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.name}
                    </div>
                  </td>
                  {/* الهاتف */}
                  <td style={{ padding: "6px 10px", color: "#555", fontFamily: "monospace", fontSize: 12 }}>
                    {c.phone ?? "—"}
                  </td>
                  {/* المدينة */}
                  <td style={{ padding: "6px 10px", color: "#555" }}>{c.city ?? "—"}</td>
                  {/* الرقم الضريبي */}
                  <td style={{ padding: "6px 10px", color: "#555", fontFamily: "monospace", fontSize: 11 }}>
                    {c.taxNumber
                      ? <span style={{ background: "#FEF3C7", color: "#92400E", padding: "1px 5px", borderRadius: 3 }}>{c.taxNumber}</span>
                      : "—"
                    }
                  </td>
                  {/* الرصيد */}
                  <td style={{ padding: "6px 10px", textAlign: "left", fontFamily: "monospace", fontSize: 12 }}>
                    {parseFloat(c.balance ?? "0") !== 0
                      ? <span style={{ color: parseFloat(c.balance) > 0 ? "#DC2626" : "#15803D", fontWeight: 700 }}>
                          {parseFloat(c.balance).toLocaleString("ar-SA", { minimumFractionDigits: 2 })}
                        </span>
                      : <span style={{ color: "#CCC" }}>0.00</span>
                    }
                  </td>
                  {/* زر التعديل */}
                  <td style={{ padding: "4px 8px" }}>
                    <button
                      onClick={e => { e.stopPropagation(); openEdit(c); }}
                      style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 3,
                        background: "#E8EEF4", color: "#406B93",
                        border: "1px solid #B8CFE0", cursor: "pointer",
                        fontFamily: "inherit", fontWeight: 600,
                      }}
                    >تعديل</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Summary bar ── */}
      {!isLoading && (customers ?? []).length > 0 && (
        <div style={{ fontSize: 11, color: "#888", display: "flex", gap: 16 }}>
          <span>إجمالي العملاء: <strong>{(customers ?? []).length}</strong></span>
          <span>مؤسسات: <strong style={{ color: "#1D4ED8" }}>
            {(customers ?? []).filter((c: any) => c.customerType === "organization").length}
          </strong></span>
          <span>أفراد: <strong style={{ color: "#15803D" }}>
            {(customers ?? []).filter((c: any) => c.customerType !== "organization").length}
          </strong></span>
          {search && <span>نتائج البحث: <strong>{filtered.length}</strong></span>}
        </div>
      )}

      {/* ── Dialog ── */}
      <CustomerFormDialog
        open={dialogOpen}
        editData={editData}
        onClose={() => setDialog(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
