import { useState } from "react";

const tabs = [
  { id: "main", label: "النافذة الرئيسية" },
  { id: "extra", label: "وصف إضافي" },
  { id: "prices", label: "الأسعار" },
  { id: "costs", label: "التكاليف" },
  { id: "qty", label: "كميات" },
  { id: "stats", label: "إحصائيات" },
];

export function Current() {
  const [active, setActive] = useState("costs");
  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo', Tahoma, sans-serif", background: "#f8f8f8", minHeight: "160px", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "4px 8px 0", background: "#fff", borderBottom: "1px solid #BEBEBE", display: "flex", gap: 4, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ position: "absolute", top: 8, right: 12, fontSize: 10, color: "#999" }}>التصميم الحالي</div>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            style={{
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 700,
              border: "1px solid #BEBEBE",
              borderRadius: 4,
              cursor: "pointer",
              fontFamily: "'Cairo', Tahoma, sans-serif",
              background: active === tab.id ? "#fff" : "#F5F0E8",
              color: active === tab.id ? "#1d4ed8" : "#555",
              boxShadow: active === tab.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              transition: "all 0.15s",
              marginBottom: 4,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div style={{ padding: "16px 12px", color: "#888", fontSize: 12 }}>
        محتوى تبويب: <strong style={{ color: "#1d4ed8" }}>{tabs.find(t => t.id === active)?.label}</strong>
      </div>
    </div>
  );
}
