import { useState } from "react";

const tabs = [
  { id: "main", label: "النافذة الرئيسية" },
  { id: "extra", label: "وصف إضافي" },
  { id: "prices", label: "الأسعار" },
  { id: "costs", label: "التكاليف" },
  { id: "qty", label: "كميات" },
  { id: "stats", label: "إحصائيات" },
];

export function Underline() {
  const [active, setActive] = useState("costs");
  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo', Tahoma, sans-serif", background: "#f8f8f8", minHeight: "160px", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "0 8px", background: "#fff", borderBottom: "1px solid #BEBEBE", display: "flex", gap: 0, flexWrap: "wrap", position: "relative" }}>
        <div style={{ position: "absolute", top: 8, right: 12, fontSize: 10, color: "#999" }}>خط سفلي (حديث)</div>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            style={{
              padding: "10px 14px",
              fontSize: 12,
              fontWeight: active === tab.id ? 700 : 500,
              border: "none",
              borderBottom: active === tab.id ? "2px solid #406B93" : "2px solid transparent",
              borderRadius: 0,
              cursor: "pointer",
              fontFamily: "'Cairo', Tahoma, sans-serif",
              background: "transparent",
              color: active === tab.id ? "#406B93" : "#777",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
              marginBottom: "-1px",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div style={{ padding: "16px 12px", color: "#888", fontSize: 12 }}>
        محتوى تبويب: <strong style={{ color: "#406B93" }}>{tabs.find(t => t.id === active)?.label}</strong>
      </div>
    </div>
  );
}
