/**
 * ReUnitsPage.tsx — الوحدات السكنية (مرحلة 1 من المطور العقاري)
 * جدول + إضافة + تعديل + حذف + بحث + تصفية بالمشروع والحالة
 */
import { useState } from "react";
import { trpc } from "@/shared/lib/trpc";
import { toast } from "sonner";
import {
  Home, ArrowRight, ArrowLeft, Search, Plus, Pencil, Trash2,
  Building2, X, Save, Ban, ChevronLeft,
} from "lucide-react";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/core/ui/dialog";
import { useLang } from "@/core/contexts/LanguageContext";
import { useAuth } from "@/core/hooks/useAuth";
import { useTabManager } from "@/core/contexts/TabManagerContext";
import { canViewHsScreen, isAdminRole } from "@/shared/lib/hsPermissions";

const C = { primary: "#406B93", border: "#D0D0D0", bgAlt: "#FAFAFA", header: "#E8EEF4", danger: "#C0392B", success: "#16A34A", muted: "#9CA3AF" };

const UNIT_TYPES = [
  { value: "apartment", labelAr: "شقة", labelEn: "Apartment" },
  { value: "villa", labelAr: "فللا", labelEn: "Villa" },
  { value: "duplex", labelAr: "دوبليكس", labelEn: "Duplex" },
  { value: "penthouse", labelAr: "بينتهاوس", labelEn: "Penthouse" },
  { value: "studio", labelAr: "ستوديو", labelEn: "Studio" },
  { value: "office", labelAr: "مكتب", labelEn: "Office" },
  { value: "shop", labelAr: "محل", labelEn: "Shop" },
  { value: "warehouse", labelAr: "مستودع", labelEn: "Warehouse" },
  { value: "land", labelAr: "أرض", labelEn: "Land" },
  { value: "other", labelAr: "أخرى", labelEn: "Other" },
];

const STATUS_TYPES = [
  { value: "available", labelAr: "متاح", labelEn: "Available", color: "#16A34A" },
  { value: "reserved", labelAr: "محجوز", labelEn: "Reserved", color: "#F59E0B" },
  { value: "sold", labelAr: "مباع", labelEn: "Sold", color: "#2563EB" },
  { value: "rented", labelAr: "مؤجر", labelEn: "Rented", color: "#7C3AED" },
  { value: "under_construction", labelAr: "قيد البناء", labelEn: "Under Construction", color: "#DC2626" },
  { value: "maintenance", labelAr: "صيانة", labelEn: "Maintenance", color: "#6B7280" },
];

function fmtN(n: number | null | undefined | string): string {
  if (n === null || n === undefined || n === "") return "—";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return "—";
  return num.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtArea(n: number | null | undefined | string): string {
  if (n === null || n === undefined || n === "") return "—";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return "—";
  return num.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " م²";
}

export default function ReUnitsPage() {
  const { lang, dir } = useLang();
  const { user } = useAuth();
  const { openTab } = useTabManager();
  const ar = lang === "ar";
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;
  const isAdmin = isAdminRole(user?.role);

  const [q, setQ] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    unitNo: "", unitType: "apartment", status: "available",
    area: "", price: "", floor: "", block: "", building: "",
    projectId: "", notes: "",
  });
  const [showDelete, setShowDelete] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: listData, isLoading } = trpc.reUnits.list.useQuery({
    q: q || undefined,
    projectId: projectFilter !== "all" ? Number(projectFilter) : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    unitType: typeFilter !== "all" ? typeFilter : undefined,
    limit: LIMIT, offset,
  });
  const { data: projects } = trpc.reUnits.projects.useQuery();

  const create = trpc.reUnits.create.useMutation({
    onSuccess: () => { toast.success(ar ? "تم الإضافة بنجاح" : "Added successfully"); closeForm(); utils.reUnits.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.reUnits.update.useMutation({
    onSuccess: () => { toast.success(ar ? "تم التعديل بنجاح" : "Updated successfully"); closeForm(); utils.reUnits.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.reUnits.delete.useMutation({
    onSuccess: () => { toast.success(ar ? "تم الحذف بنجاح" : "Deleted successfully"); setShowDelete(false); utils.reUnits.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const units = listData?.items ?? [];
  const total = listData?.total ?? 0;

  const canAdd = isAdmin || user?.extraPermissions?.['hs_re_units_add'] === true;
  const canEdit = isAdmin || user?.extraPermissions?.['hs_re_units_edit'] === true;
  const canDelete = isAdmin || user?.extraPermissions?.['hs_re_units_delete'] === true;

  const goBack = () => openTab("/hs/real-estate", ar ? "المطور العقاري" : "Real Estate Developer", Building2);

  if (!canViewHsScreen(user, "hs_re_units")) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground" dir={dir}>
        <Home className="w-10 h-10 opacity-30" />
        <p className="text-sm font-medium">{ar ? "لا تملك صلاحية الوصول" : "Access denied"}</p>
        <Button variant="outline" size="sm" onClick={goBack} className="gap-1.5"><BackIcon className="w-3.5 h-3.5" />{ar ? "رجوع" : "Back"}</Button>
      </div>
    );
  }

  function openAdd() {
    setEditId(null);
    setForm({ unitNo: "", unitType: "apartment", status: "available", area: "", price: "", floor: "", block: "", building: "", projectId: projectFilter !== "all" ? projectFilter : "", notes: "" });
    setShowForm(true);
  }
  function openEdit(item: any) {
    setEditId(item.id);
    setForm({
      unitNo: item.unitNo ?? "",
      unitType: item.unitType ?? "apartment",
      status: item.status ?? "available",
      area: item.area ? String(item.area) : "",
      price: item.price ? String(item.price) : "",
      floor: item.floor ?? "",
      block: item.block ?? "",
      building: item.building ?? "",
      projectId: item.projectId ? String(item.projectId) : "",
      notes: item.notes ?? "",
    });
    setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditId(null); }

  function handleSave() {
    if (!form.unitNo.trim()) { toast.error(ar ? "رقم الوحدة مطلوب" : "Unit number is required"); return; }
    const payload = {
      unitNo: form.unitNo.trim(),
      unitType: form.unitType,
      status: form.status,
      area: form.area ? parseFloat(form.area) : null,
      price: form.price ? parseFloat(form.price) : null,
      floor: form.floor.trim() || null,
      block: form.block.trim() || null,
      building: form.building.trim() || null,
      projectId: form.projectId ? Number(form.projectId) : null,
      notes: form.notes.trim() || null,
    };
    if (editId) {
      update.mutate({ id: editId, ...payload });
    } else {
      create.mutate(payload);
    }
  }

  function confirmDelete(id: number) { setDeleteId(id); setShowDelete(true); }
  function handleDelete() { if (deleteId) del.mutate(deleteId); }

  const statusLabel = (s: string) => STATUS_TYPES.find(x => x.value === s)?.labelAr ?? s;
  const statusColor = (s: string) => STATUS_TYPES.find(x => x.value === s)?.color ?? C.muted;
  const typeLabel = (t: string) => UNIT_TYPES.find(x => x.value === t)?.labelAr ?? t;

  return (
    <div className="h-full overflow-y-auto bg-background" dir={dir}>
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-5">
          <Button variant="ghost" size="sm" onClick={goBack} className="gap-1.5 text-muted-foreground hover:text-foreground">
            <BackIcon className="w-4 h-4" />{ar ? "المطور العقاري" : "Real Estate"}
          </Button>
        </div>

        <div className="flex items-start gap-4 mb-6">
          <div className="w-14 h-14 shrink-0 rounded-2xl bg-teal-500/10 flex items-center justify-center">
            <Home className="w-7 h-7 text-teal-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">{ar ? "الوحدات السكنية" : "Housing Units"}</h1>
            <p className="text-sm text-muted-foreground mt-1">{ar ? "إدارة وتسجيل الوحدات السكنية في المشروع العقاري" : "Manage and register housing units in the real estate project"}</p>
          </div>
          {canAdd && (
            <Button size="sm" onClick={openAdd} className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white">
              <Plus className="w-4 h-4" />{ar ? "إضافة وحدة" : "Add Unit"}
            </Button>
          )}
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={ar ? "بحث برقم الوحدة، البلوك، المبني..." : "Search by unit no, block, building..."}
              value={q}
              onChange={e => { setQ(e.target.value); setOffset(0); }}
              className="pr-9 text-sm"
            />
          </div>
          <Select value={projectFilter} onValueChange={v => { setProjectFilter(v); setOffset(0); }}>
            <SelectTrigger className="w-44 text-sm"><SelectValue placeholder={ar ? "المشروع" : "Project"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? "كل المشاريع" : "All Projects"}</SelectItem>
              {(projects ?? []).map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setOffset(0); }}>
            <SelectTrigger className="w-40 text-sm"><SelectValue placeholder={ar ? "الحالة" : "Status"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? "كل الحالات" : "All Statuses"}</SelectItem>
              {STATUS_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.labelAr}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setOffset(0); }}>
            <SelectTrigger className="w-40 text-sm"><SelectValue placeholder={ar ? "النوع" : "Type"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? "كل الأنواع" : "All Types"}</SelectItem>
              {UNIT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.labelAr}</SelectItem>)}
            </SelectContent>
          </Select>
          {(q || projectFilter !== "all" || statusFilter !== "all" || typeFilter !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setQ(""); setProjectFilter("all"); setStatusFilter("all"); setTypeFilter("all"); setOffset(0); }} className="gap-1">
              <X className="w-3.5 h-3.5" />{ar ? "إعادة التصفية" : "Reset"}
            </Button>
          )}
        </div>

        {/* ── Table ── */}
        <div className="border rounded-lg overflow-hidden" style={{ borderColor: C.border }}>
          <div className="overflow-x-auto">
            <table className="w-full text-right" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: C.header }}>
                  <th className="px-3 py-2 text-[11px] font-semibold text-slate-600 whitespace-nowrap">#</th>
                  <th className="px-3 py-2 text-[11px] font-semibold text-slate-600 whitespace-nowrap">{ar ? "رقم الوحدة" : "Unit No"}</th>
                  <th className="px-3 py-2 text-[11px] font-semibold text-slate-600 whitespace-nowrap">{ar ? "النوع" : "Type"}</th>
                  <th className="px-3 py-2 text-[11px] font-semibold text-slate-600 whitespace-nowrap">{ar ? "الحالة" : "Status"}</th>
                  <th className="px-3 py-2 text-[11px] font-semibold text-slate-600 whitespace-nowrap">{ar ? "المساحة" : "Area"}</th>
                  <th className="px-3 py-2 text-[11px] font-semibold text-slate-600 whitespace-nowrap">{ar ? "السعر" : "Price"}</th>
                  <th className="px-3 py-2 text-[11px] font-semibold text-slate-600 whitespace-nowrap">{ar ? "الدور" : "Floor"}</th>
                  <th className="px-3 py-2 text-[11px] font-semibold text-slate-600 whitespace-nowrap">{ar ? "البلوك" : "Block"}</th>
                  <th className="px-3 py-2 text-[11px] font-semibold text-slate-600 whitespace-nowrap">{ar ? "المبني" : "Building"}</th>
                  <th className="px-3 py-2 text-[11px] font-semibold text-slate-600 whitespace-nowrap">{ar ? "المشروع" : "Project"}</th>
                  <th className="px-3 py-2 text-[11px] font-semibold text-slate-600 whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={11} className="text-center py-8 text-sm text-muted-foreground">{ar ? "جاري التحميل..." : "Loading..."}</td></tr>
                ) : units.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-8 text-sm text-muted-foreground">{ar ? "لا توجد وحدات" : "No units found"}</td></tr>
                ) : units.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50" style={{ borderBottom: "1px solid #eee" }}>
                    <td className="px-3 py-2 text-[11px] text-slate-400">{offset + idx + 1}</td>
                    <td className="px-3 py-2 text-[12px] font-semibold text-slate-700">{item.unitNo}</td>
                    <td className="px-3 py-2 text-[11px] text-slate-600">{typeLabel(item.unitType)}</td>
                    <td className="px-3 py-2 text-[11px]">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white" style={{ backgroundColor: statusColor(item.status) }}>
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-slate-600 font-mono">{fmtArea(item.area)}</td>
                    <td className="px-3 py-2 text-[11px] text-slate-600 font-mono">{fmtN(item.price)}</td>
                    <td className="px-3 py-2 text-[11px] text-slate-600">{item.floor ?? "—"}</td>
                    <td className="px-3 py-2 text-[11px] text-slate-600">{item.block ?? "—"}</td>
                    <td className="px-3 py-2 text-[11px] text-slate-600">{item.building ?? "—"}</td>
                    <td className="px-3 py-2 text-[11px] text-slate-600">
                      {projects?.find(p => p.id === item.projectId)?.name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-[11px]">
                      <div className="flex items-center gap-1">
                        {canEdit && (
                          <button onClick={() => openEdit(item)} className="p-1 rounded hover:bg-slate-100 text-slate-500" title={ar ? "تعديل" : "Edit"}>
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => confirmDelete(item.id)} className="p-1 rounded hover:bg-red-50 text-red-500" title={ar ? "حذف" : "Delete"}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-3 py-2 border-t" style={{ borderColor: C.border, background: C.bgAlt }}>
            <span className="text-[11px] text-muted-foreground">
              {ar ? `إجمالي ${total} وحدات` : `Total ${total} units`} — {ar ? `صفحة ${Math.floor(offset / LIMIT) + 1} من ${Math.ceil(total / LIMIT) || 1}` : `Page ${Math.floor(offset / LIMIT) + 1} of ${Math.ceil(total / LIMIT) || 1}`}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setOffset(Math.max(0, offset - LIMIT))} disabled={offset === 0} className="h-7 px-2 text-[11px]">
                <ChevronLeft className="w-3.5 h-3.5" />{ar ? "السابق" : "Prev"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setOffset(offset + LIMIT)} disabled={offset + LIMIT >= total} className="h-7 px-2 text-[11px]">
                {ar ? "التالي" : "Next"}<ChevronLeft className="w-3.5 h-3.5 rotate-180" />
              </Button>
            </div>
          </div>
        </div>

        {/* ── Add/Edit Dialog ── */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-lg" dir={dir}>
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Home className="w-5 h-5 text-teal-600" />
                {editId ? (ar ? "تعديل وحدة" : "Edit Unit") : (ar ? "إضافة وحدة سكنية" : "Add Housing Unit")}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 py-2">
              <div className="col-span-2">
                <Label className="text-[11px] text-muted-foreground mb-1 block">{ar ? "رقم الوحدة *" : "Unit No *"}</Label>
                <Input value={form.unitNo} onChange={e => setForm(p => ({ ...p, unitNo: e.target.value }))} className="text-sm" placeholder={ar ? "مثل: A-101" : "e.g. A-101"} />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">{ar ? "النوع" : "Type"}</Label>
                <Select value={form.unitType} onValueChange={v => setForm(p => ({ ...p, unitType: v }))}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.labelAr}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">{ar ? "الحالة" : "Status"}</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.labelAr}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">{ar ? "المساحة (م²)" : "Area (m²)"}</Label>
                <Input type="text" inputMode="decimal" dir="ltr" value={form.area} onChange={e => setForm(p => ({ ...p, area: e.target.value.replace(/[^0-9.]/g, '') }))} className="text-sm" placeholder="0.00" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">{ar ? "السعر" : "Price"}</Label>
                <Input type="text" inputMode="decimal" dir="ltr" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value.replace(/[^0-9.]/g, '') }))} className="text-sm" placeholder="0.00" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">{ar ? "الدور" : "Floor"}</Label>
                <Input value={form.floor} onChange={e => setForm(p => ({ ...p, floor: e.target.value }))} className="text-sm" placeholder={ar ? "مثل: 1" : "e.g. 1"} />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">{ar ? "البلوك" : "Block"}</Label>
                <Input value={form.block} onChange={e => setForm(p => ({ ...p, block: e.target.value }))} className="text-sm" placeholder={ar ? "مثل: A" : "e.g. A"} />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">{ar ? "المبني" : "Building"}</Label>
                <Input value={form.building} onChange={e => setForm(p => ({ ...p, building: e.target.value }))} className="text-sm" placeholder={ar ? "مثل: B1" : "e.g. B1"} />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground mb-1 block">{ar ? "المشروع" : "Project"}</Label>
                <Select value={form.projectId} onValueChange={v => setForm(p => ({ ...p, projectId: v }))}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder={ar ? "اختر مشروع" : "Select project"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{ar ? "بدون مشروع" : "No project"}</SelectItem>
                    {(projects ?? []).map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-[11px] text-muted-foreground mb-1 block">{ar ? "ملاحظات" : "Notes"}</Label>
                <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="text-sm" placeholder={ar ? "ملاحظات إضافية..." : "Additional notes..."} />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={closeForm} className="gap-1"><Ban className="w-3.5 h-3.5" />{ar ? "إلغاء" : "Cancel"}</Button>
              <Button size="sm" onClick={handleSave} disabled={create.isPending || update.isPending} className="gap-1 bg-teal-600 hover:bg-teal-700 text-white">
                <Save className="w-3.5 h-3.5" />{editId ? (ar ? "حفظ التعديل" : "Save Changes") : (ar ? "إضافة" : "Add")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Delete Dialog ── */}
        <Dialog open={showDelete} onOpenChange={setShowDelete}>
          <DialogContent className="max-w-sm" dir={dir}>
            <DialogHeader><DialogTitle className="text-base">{ar ? "تأكيد الحذف" : "Confirm Delete"}</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground py-2">{ar ? "هل أنت متأكد من حذف هذه الوحدة؟" : "Are you sure you want to delete this unit?"}</p>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowDelete(false)}>{ar ? "إلغاء" : "Cancel"}</Button>
              <Button size="sm" variant="destructive" onClick={handleDelete} disabled={del.isPending}>{ar ? "حذف" : "Delete"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
