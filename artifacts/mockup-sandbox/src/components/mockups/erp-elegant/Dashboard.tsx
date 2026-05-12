import {
  LayoutDashboard, Package, FileText, Users, Settings,
  TrendingUp, ShoppingCart, DollarSign, BarChart2,
  Bell, Search, ChevronDown, LogOut, Menu,
  ArrowUpRight, ArrowDownRight, MoreHorizontal,
  Boxes, Receipt, Wallet, ClipboardList
} from "lucide-react";

const colors = {
  bg: "#F4F1E8",
  card: "#FFFFFF",
  sidebar: "#223548",
  sidebarActive: "#2F4B66",
  sidebarHover: "#2A4159",
  gold: "#B89B5E",
  goldHover: "#E7D7AB",
  textPrimary: "#2B2B2B",
  textSecondary: "#6B7280",
  border: "#E2DCCB",
  headerBg: "#F0EDE4",
};

const sidebarItems = [
  { icon: LayoutDashboard, label: "لوحة التحكم", active: true },
  { icon: Package, label: "المخزون", active: false },
  { icon: Receipt, label: "الفواتير", active: false },
  { icon: ShoppingCart, label: "المبيعات", active: false },
  { icon: Wallet, label: "المحاسبة", active: false },
  { icon: Users, label: "العملاء", active: false },
  { icon: ClipboardList, label: "التقارير", active: false },
  { icon: Settings, label: "الإعدادات", active: false },
];

const stats = [
  { label: "إجمالي الإيرادات", value: "١٢٤,٥٠٠", unit: "ر.س", icon: DollarSign, change: "+8.2%", up: true },
  { label: "المبيعات اليوم", value: "٣,٨٤٠", unit: "ر.س", icon: ShoppingCart, change: "+3.5%", up: true },
  { label: "المصروفات", value: "٤٢,١٠٠", unit: "ر.س", icon: TrendingUp, change: "-2.1%", up: false },
  { label: "صافي الربح", value: "٨٢,٤٠٠", unit: "ر.س", icon: BarChart2, change: "+12.4%", up: true },
];

const recentOrders = [
  { id: "#١٠٠٢١", client: "شركة النور التجارية", date: "١٢ مايو ٢٠٢٦", amount: "٨,٤٥٠", status: "مكتمل" },
  { id: "#١٠٠٢٠", client: "مؤسسة الخليج", date: "١١ مايو ٢٠٢٦", amount: "١٢,٢٠٠", status: "معلق" },
  { id: "#١٠٠١٩", client: "شركة الأفق للتقنية", date: "١٠ مايو ٢٠٢٦", amount: "٥,٧٠٠", status: "مكتمل" },
  { id: "#١٠٠١٨", client: "مجموعة الريادة", date: "٩ مايو ٢٠٢٦", amount: "٢٣,١٠٠", status: "قيد التنفيذ" },
  { id: "#١٠٠١٧", client: "شركة البناء المتقدم", date: "٨ مايو ٢٠٢٦", amount: "٩,٨٠٠", status: "مكتمل" },
];

const statusStyle: Record<string, { bg: string; color: string }> = {
  "مكتمل":       { bg: "#F0FDF4", color: "#16A34A" },
  "معلق":         { bg: "#FFFBEB", color: "#B45309" },
  "قيد التنفيذ":  { bg: "#EFF6FF", color: "#1D4ED8" },
};

const inventory = [
  { name: "طابعة HP LaserJet", stock: 24, min: 10, unit: "قطعة" },
  { name: "حبر طابعة أسود", stock: 7, min: 15, unit: "علبة" },
  { name: "ورق A4 80 جرام", stock: 142, min: 50, unit: "ريمة" },
  { name: "قلم حبر أزرق", stock: 3, min: 20, unit: "علبة" },
];

export function Dashboard() {
  return (
    <div
      dir="rtl"
      style={{
        fontFamily: "'Cairo', 'IBM Plex Sans Arabic', 'Tahoma', sans-serif",
        background: colors.bg,
        minHeight: "100vh",
        display: "flex",
        fontSize: "13px",
        color: colors.textPrimary,
      }}
    >
      {/* ── Sidebar ── */}
      <aside style={{
        width: 220,
        background: colors.sidebar,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        borderLeft: `1px solid rgba(255,255,255,0.06)`,
      }}>
        {/* Logo */}
        <div style={{
          padding: "20px 16px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: colors.gold,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: 15, color: "#fff",
            }}>O</div>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>OneSoft</div>
              <div style={{ color: colors.gold, fontWeight: 500, fontSize: 11, letterSpacing: "0.03em" }}>ERP System</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
          {sidebarItems.map((item) => (
            <div key={item.label} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "0 10px",
              height: 38,
              borderRadius: 4,
              cursor: "pointer",
              background: item.active ? colors.sidebarActive : "transparent",
              color: item.active ? "#fff" : "rgba(255,255,255,0.72)",
              fontWeight: item.active ? 600 : 500,
              fontSize: 14,
              transition: "background 0.15s",
              borderRight: item.active ? `3px solid ${colors.gold}` : "3px solid transparent",
            }}>
              <item.icon size={16} style={{ opacity: item.active ? 1 : 0.7, flexShrink: 0 }} />
              <span>{item.label}</span>
            </div>
          ))}
        </nav>

        {/* User */}
        <div style={{
          padding: "12px 12px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: colors.gold,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 700, fontSize: 13,
          }}>م</div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{ color: "#fff", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>محمد العمري</div>
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>مدير النظام</div>
          </div>
          <LogOut size={14} style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0 }} />
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <header style={{
          height: 48,
          background: colors.headerBg,
          borderBottom: `1px solid ${colors.border}`,
          display: "flex", alignItems: "center",
          padding: "0 20px", gap: 12,
          flexShrink: 0,
        }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#fff",
              border: `1px solid ${colors.border}`,
              borderRadius: 4,
              padding: "0 10px",
              height: 30,
              width: 240,
            }}>
              <Search size={13} style={{ color: colors.textSecondary }} />
              <span style={{ color: colors.textSecondary, fontSize: 12 }}>بحث في النظام…</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative" }}>
              <Bell size={17} style={{ color: colors.textSecondary }} />
              <span style={{
                position: "absolute", top: -4, left: -4,
                width: 14, height: 14, borderRadius: "50%",
                background: colors.gold,
                color: "#fff", fontSize: 9, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>٣</span>
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              borderRight: `1px solid ${colors.border}`,
              paddingRight: 12,
            }}>
              <span style={{ fontSize: 12, color: colors.textPrimary, fontWeight: 600 }}>شركة النور</span>
              <ChevronDown size={13} style={{ color: colors.textSecondary }} />
            </div>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>

          {/* Page title */}
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: colors.textPrimary, margin: 0, lineHeight: 1.3 }}>
              لوحة التحكم
            </h1>
            <p style={{ color: colors.textSecondary, fontSize: 12, margin: "2px 0 0" }}>
              الثلاثاء، ١٢ مايو ٢٠٢٦ — مرحباً محمد
            </p>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
            {stats.map((s) => (
              <div key={s.label} style={{
                background: colors.card,
                border: `1px solid ${colors.border}`,
                borderRadius: 6,
                padding: "14px 16px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 500 }}>{s.label}</span>
                  <div style={{
                    width: 30, height: 30, borderRadius: 6,
                    background: "#F9F6EE",
                    border: `1px solid ${colors.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <s.icon size={15} style={{ color: colors.gold }} />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                  <span style={{ fontSize: 28, fontWeight: 700, color: colors.textPrimary, lineHeight: 1 }}>{s.value}</span>
                  <span style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 2 }}>{s.unit}</span>
                </div>
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                  {s.up
                    ? <ArrowUpRight size={13} style={{ color: "#16A34A" }} />
                    : <ArrowDownRight size={13} style={{ color: "#DC2626" }} />
                  }
                  <span style={{ fontSize: 11, fontWeight: 600, color: s.up ? "#16A34A" : "#DC2626" }}>{s.change}</span>
                  <span style={{ fontSize: 11, color: colors.textSecondary }}>عن الشهر الماضي</span>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14 }}>

            {/* Recent orders table */}
            <div style={{
              background: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: 6,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}>
              <div style={{
                padding: "12px 16px",
                borderBottom: `1px solid ${colors.border}`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: colors.textPrimary }}>آخر الطلبات</span>
                <span style={{ fontSize: 12, color: colors.gold, fontWeight: 600, cursor: "pointer" }}>عرض الكل</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#F9F6EE" }}>
                    {["رقم الطلب", "العميل", "التاريخ", "المبلغ", "الحالة"].map((h) => (
                      <th key={h} style={{
                        padding: "8px 12px",
                        textAlign: "right",
                        fontSize: 11,
                        fontWeight: 600,
                        color: colors.textSecondary,
                        borderBottom: `1px solid ${colors.border}`,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o, i) => (
                    <tr key={o.id} style={{ background: i % 2 === 0 ? colors.card : "#FAFAF7" }}>
                      <td style={{ padding: "8px 12px", fontSize: 13, color: colors.gold, fontWeight: 600 }}>{o.id}</td>
                      <td style={{ padding: "8px 12px", fontSize: 13, color: colors.textPrimary }}>{o.client}</td>
                      <td style={{ padding: "8px 12px", fontSize: 12, color: colors.textSecondary }}>{o.date}</td>
                      <td style={{ padding: "8px 12px", fontSize: 13, color: colors.textPrimary, fontWeight: 600 }}>{o.amount} ر.س</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center",
                          padding: "2px 8px",
                          borderRadius: 3,
                          fontSize: 11, fontWeight: 600,
                          background: statusStyle[o.status]?.bg,
                          color: statusStyle[o.status]?.color,
                        }}>{o.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Inventory alert */}
            <div style={{
              background: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: 6,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}>
              <div style={{
                padding: "12px 16px",
                borderBottom: `1px solid ${colors.border}`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: colors.textPrimary }}>تنبيهات المخزون</span>
                <Boxes size={16} style={{ color: colors.gold }} />
              </div>
              <div style={{ padding: "8px 0" }}>
                {inventory.map((item) => {
                  const pct = Math.min(100, (item.stock / item.min) * 100);
                  const low = item.stock < item.min;
                  return (
                    <div key={item.name} style={{
                      padding: "10px 16px",
                      borderBottom: `1px solid ${colors.border}`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: colors.textPrimary, fontWeight: 500 }}>{item.name}</span>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: low ? "#DC2626" : "#16A34A",
                        }}>{item.stock} {item.unit}</span>
                      </div>
                      <div style={{
                        height: 4, borderRadius: 2, background: "#F0EDE4", overflow: "hidden",
                      }}>
                        <div style={{
                          height: "100%",
                          width: `${Math.min(pct, 100)}%`,
                          borderRadius: 2,
                          background: low ? "#DC2626" : colors.gold,
                          transition: "width 0.3s",
                        }} />
                      </div>
                      {low && (
                        <p style={{ fontSize: 10, color: "#DC2626", margin: "4px 0 0", fontWeight: 500 }}>
                          أقل من الحد الأدنى ({item.min} {item.unit})
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
