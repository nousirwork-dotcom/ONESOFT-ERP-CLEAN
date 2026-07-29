import { useState, useMemo } from "react";
import { trpc } from "@/shared/lib/trpc";
import { useAuth } from "@/core/hooks/useAuth";
import { useTabManager } from "@/core/contexts/TabManagerContext";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Badge } from "@/core/ui/badge";
import { Label } from "@/core/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/core/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/core/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/core/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/core/ui/select";
import { Switch } from "@/core/ui/switch";
import { toast } from "sonner";
import {
  Link2, Plus, Search, Edit2, Trash2, Star, Pin, ExternalLink,
  Globe, MoreVertical, FolderOpen, Settings, LayoutGrid, List,
  Copy, CheckCircle, XCircle, ChevronRight, ArrowUpDown,
  Chrome, Monitor, GanttChartSquare, Landmark,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
type Section = {
  id: number; name: string; icon: string | null; color: string | null;
  sort_order: number; link_count: number;
};
type LinkRow = {
  id: number; section_id: number | null; name: string; url: string;
  description: string | null; icon: string | null; card_color: string | null;
  open_mode: string; browser_type: string; browser_path: string | null;
  is_active: boolean; is_favorite: boolean; is_pinned: boolean;
  sort_order: number; created_at: string;
  section_name: string | null; section_color: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const BROWSER_OPTIONS = [
  { value: "default", label: "المتصفح الافتراضي", icon: Globe },
  { value: "chrome",  label: "Google Chrome",      icon: Chrome },
  { value: "edge",    label: "Microsoft Edge",      icon: Monitor },
  { value: "firefox", label: "Mozilla Firefox",     icon: Globe },
  { value: "custom",  label: "متصفح آخر (مسار مخصص)", icon: GanttChartSquare },
];

const OPEN_MODE_OPTIONS = [
  { value: "external", label: "فتح في متصفح خارجي" },
  { value: "internal", label: "فتح داخل برنامج OneSoft" },
];

const SECTION_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

function sectionStyle(color: string | null) {
  if (!color) return {};
  return { borderRightColor: color, borderRightWidth: "3px" };
}

function openUrl(link: LinkRow, openTab: (path: string, label: string, icon: any) => void) {
  if (link.open_mode === "internal") {
    openTab(`/hs/link-viewer?url=${encodeURIComponent(link.url)}`, link.name, Link2);
    return;
  }
  const w = window as any;
  if (w.electronAPI?.openExternal) {
    w.electronAPI.openExternal(link.url, link.browser_type, link.browser_path ?? undefined);
  } else {
    window.open(link.url, "_blank", "noopener,noreferrer");
  }
}

function isAdminUser(user: any): boolean {
  return user?.role === "admin" || user?.role === "superadmin";
}
function hasPerm(user: any, key: string): boolean {
  if (isAdminUser(user)) return true;
  return user?.extraPermissions?.[key] === true;
}

// ─── Section Form Dialog ──────────────────────────────────────────────────────
function SectionDialog({
  open, onClose, section, orgSections,
}: {
  open: boolean; onClose: () => void;
  section?: Section | null; orgSections: Section[];
}) {
  const utils = trpc.useUtils();
  const create = trpc.linksServices.createSection.useMutation({ onSuccess: () => { utils.linksServices.listSections.invalidate(); onClose(); toast.success("تم إنشاء القسم"); } });
  const update = trpc.linksServices.updateSection.useMutation({ onSuccess: () => { utils.linksServices.listSections.invalidate(); onClose(); toast.success("تم حفظ القسم"); } });

  const [name, setName] = useState(section?.name ?? "");
  const [color, setColor] = useState(section?.color ?? SECTION_COLORS[0]);

  const isEdit = !!section;

  const handleSave = () => {
    if (!name.trim()) return toast.error("أدخل اسم القسم");
    const payload = { name: name.trim(), color, sortOrder: section?.sort_order ?? orgSections.length };
    if (isEdit) update.mutate({ id: section!.id, ...payload });
    else create.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل القسم" : "إضافة قسم جديد"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>اسم القسم</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="مثال: الجهات الحكومية" className="mt-1" autoFocus />
          </div>
          <div>
            <Label>لون القسم</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {SECTION_COLORS.map(c => (
                <button
                  key={c}
                  className={cn("w-7 h-7 rounded-full border-2 transition-all", color === c ? "border-foreground scale-110" : "border-transparent")}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="flex gap-2 justify-start">
          <Button onClick={handleSave} disabled={create.isPending || update.isPending}>حفظ</Button>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Link Form Dialog ─────────────────────────────────────────────────────────
type LinkFormState = {
  name: string; url: string; description: string;
  sectionId: string; openMode: string; browserType: string; browserPath: string;
  isActive: boolean; isFavorite: boolean; isPinned: boolean;
};

function LinkDialog({
  open, onClose, link, sections,
}: {
  open: boolean; onClose: () => void;
  link?: LinkRow | null; sections: Section[];
}) {
  const utils = trpc.useUtils();
  const create = trpc.linksServices.createLink.useMutation({ onSuccess: () => { utils.linksServices.listLinks.invalidate(); onClose(); toast.success("تم إضافة الرابط"); } });
  const update = trpc.linksServices.updateLink.useMutation({ onSuccess: () => { utils.linksServices.listLinks.invalidate(); onClose(); toast.success("تم حفظ الرابط"); } });

  const [form, setForm] = useState<LinkFormState>(() => ({
    name:        link?.name ?? "",
    url:         link?.url ?? "",
    description: link?.description ?? "",
    sectionId:   link?.section_id?.toString() ?? "none",
    openMode:    link?.open_mode ?? "external",
    browserType: link?.browser_type ?? "default",
    browserPath: link?.browser_path ?? "",
    isActive:    link?.is_active ?? true,
    isFavorite:  link?.is_favorite ?? false,
    isPinned:    link?.is_pinned ?? false,
  }));

  const set = (k: keyof LinkFormState) => (v: any) => setForm(f => ({ ...f, [k]: v }));

  const [urlError, setUrlError] = useState("");

  const validateUrl = (u: string) => {
    if (!u.trim()) return "أدخل عنوان الرابط";
    try { new URL(u.trim()); return ""; }
    catch { return "عنوان الرابط غير صحيح — تأكد أنه يبدأ بـ https:// أو http://"; }
  };

  const handleSave = () => {
    if (!form.name.trim()) return toast.error("أدخل اسم الرابط");
    const err = validateUrl(form.url);
    if (err) { setUrlError(err); return; }
    const payload = {
      name:        form.name.trim(),
      url:         form.url.trim(),
      description: form.description.trim() || null,
      sectionId:   form.sectionId !== "none" ? parseInt(form.sectionId) : null,
      openMode:    form.openMode as "internal" | "external",
      browserType: form.browserType as any,
      browserPath: form.browserPath.trim() || null,
      isActive:    form.isActive,
      isFavorite:  form.isFavorite,
      isPinned:    form.isPinned,
      sortOrder:   link?.sort_order ?? 0,
    };
    if (link) update.mutate({ id: link.id, ...payload });
    else create.mutate(payload);
  };

  const isEdit = !!link;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل الرابط" : "إضافة رابط جديد"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>اسم الرابط أو الخدمة <span className="text-red-500">*</span></Label>
            <Input value={form.name} onChange={e => set("name")(e.target.value)} placeholder="مثال: بوابة العمل" className="mt-1" autoFocus />
          </div>
          <div>
            <Label>عنوان الرابط (URL) <span className="text-red-500">*</span></Label>
            <Input
              value={form.url}
              onChange={e => { set("url")(e.target.value); setUrlError(""); }}
              placeholder="https://example.com"
              dir="ltr"
              className="mt-1"
            />
            {urlError && <p className="text-xs text-red-500 mt-1">{urlError}</p>}
          </div>
          <div>
            <Label>القسم</Label>
            <Select value={form.sectionId} onValueChange={set("sectionId")}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="بدون قسم" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون قسم</SelectItem>
                {sections.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>وصف مختصر (اختياري)</Label>
            <Input value={form.description} onChange={e => set("description")(e.target.value)} placeholder="وصف مختصر للرابط" className="mt-1" />
          </div>
          <div>
            <Label>طريقة فتح الرابط</Label>
            <Select value={form.openMode} onValueChange={set("openMode")}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {OPEN_MODE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {form.openMode === "external" && (
            <div>
              <Label>فتح الرابط باستخدام</Label>
              <Select value={form.browserType} onValueChange={set("browserType")}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BROWSER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {form.browserType === "custom" && (
                <div className="mt-2">
                  <Label className="text-xs text-muted-foreground">مسار ملف المتصفح (EXE)</Label>
                  <Input
                    value={form.browserPath}
                    onChange={e => set("browserPath")(e.target.value)}
                    placeholder="C:\Program Files\Browser\browser.exe"
                    dir="ltr"
                    className="mt-1 font-mono text-sm"
                  />
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="flex items-center gap-2">
              <Switch id="isActive" checked={form.isActive} onCheckedChange={set("isActive")} />
              <Label htmlFor="isActive">نشط</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="isFav" checked={form.isFavorite} onCheckedChange={set("isFavorite")} />
              <Label htmlFor="isFav">مفضلة</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="isPinned" checked={form.isPinned} onCheckedChange={set("isPinned")} />
              <Label htmlFor="isPinned">مثبت</Label>
            </div>
          </div>
        </div>
        <DialogFooter className="flex gap-2 justify-start">
          <Button onClick={handleSave} disabled={create.isPending || update.isPending}>حفظ</Button>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LinksServicesPage() {
  const { user } = useAuth();
  const { openTab } = useTabManager();

  const [activeSectionId, setActiveSectionId] = useState<number | null | "all">("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "favorite" | "pinned">("all");

  const [sectionDialog, setSectionDialog] = useState<{ open: boolean; section?: Section | null }>({ open: false });
  const [linkDialog, setLinkDialog] = useState<{ open: boolean; link?: LinkRow | null }>({ open: false });
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "link" | "section"; id: number; name: string; hasLinks?: boolean } | null>(null);
  const [forceDelete, setForceDelete] = useState(false);

  const utils = trpc.useUtils();

  const { data: sections = [], isLoading: sectLoading } = trpc.linksServices.listSections.useQuery();
  const { data: links = [], isLoading: linksLoading } = trpc.linksServices.listLinks.useQuery({
    sectionId: activeSectionId === "all" ? undefined : activeSectionId,
    search: search || undefined,
    filter,
  });

  const deleteLink = trpc.linksServices.deleteLink.useMutation({ onSuccess: () => { utils.linksServices.listLinks.invalidate(); utils.linksServices.listSections.invalidate(); toast.success("تم حذف الرابط"); setDeleteConfirm(null); } });
  const deleteSection = trpc.linksServices.deleteSection.useMutation({
    onSuccess: () => { utils.linksServices.listSections.invalidate(); utils.linksServices.listLinks.invalidate(); toast.success("تم حذف القسم"); setDeleteConfirm(null); setForceDelete(false); if (activeSectionId === deleteConfirm?.id) setActiveSectionId("all"); },
    onError: (e) => { if (e.data?.code === "PRECONDITION_FAILED") { setForceDelete(true); } else { toast.error(e.message); } },
  });
  const toggleFav = trpc.linksServices.toggleFavorite.useMutation({ onSuccess: () => utils.linksServices.listLinks.invalidate() });
  const toggleActive = trpc.linksServices.toggleActive.useMutation({ onSuccess: () => utils.linksServices.listLinks.invalidate() });
  const togglePinned = trpc.linksServices.togglePinned.useMutation({ onSuccess: () => utils.linksServices.listLinks.invalidate() });

  const canAdd     = hasPerm(user, "hs_links_add")     || isAdminUser(user);
  const canEdit    = hasPerm(user, "hs_links_edit")    || isAdminUser(user);
  const canDelete  = hasPerm(user, "hs_links_delete")  || isAdminUser(user);
  const canSections= hasPerm(user, "hs_links_manage_sections") || isAdminUser(user);

  const handleConfirmDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === "link") deleteLink.mutate({ id: deleteConfirm.id });
    else deleteSection.mutate({ id: deleteConfirm.id, force: forceDelete });
  };

  const copyUrl = (url: string) => { navigator.clipboard.writeText(url); toast.success("تم نسخ الرابط"); };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center">
            <Link2 className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground">الروابط والخدمات</h1>
            <p className="text-xs text-muted-foreground">وصول سريع للمنصات والخدمات المختلفة</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canAdd && (
            <Button size="sm" onClick={() => setLinkDialog({ open: true })}>
              <Plus className="w-4 h-4 ml-1" />
              إضافة رابط أو خدمة
            </Button>
          )}
        </div>
      </div>

      {/* ── Body: Sidebar + Main ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sections Sidebar */}
        <div className="w-52 shrink-0 border-l border-border/60 flex flex-col overflow-hidden bg-muted/20">
          <div className="px-3 py-2 border-b border-border/40 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">الأقسام</span>
            {canSections && (
              <button
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setSectionDialog({ open: true })}
                title="إضافة قسم"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {/* All */}
            <button
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-right",
                activeSectionId === "all"
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted/60 text-foreground/80"
              )}
              onClick={() => setActiveSectionId("all")}
            >
              <Globe className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate">جميع الروابط</span>
              <Badge variant="secondary" className="text-xs px-1.5 py-0">{links.length}</Badge>
            </button>
            {/* Favorites shortcut */}
            <button
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-right",
                filter === "favorite" && activeSectionId === "all"
                  ? "bg-amber-500/10 text-amber-600 font-medium"
                  : "hover:bg-muted/60 text-foreground/80"
              )}
              onClick={() => { setActiveSectionId("all"); setFilter(f => f === "favorite" ? "all" : "favorite"); }}
            >
              <Star className="w-4 h-4 shrink-0 text-amber-500" />
              <span className="flex-1 truncate">المفضلة</span>
            </button>
            {/* Sections */}
            {sectLoading && <div className="px-3 py-2 text-xs text-muted-foreground">جارٍ التحميل…</div>}
            {sections.map(s => (
              <div key={s.id} className="group relative">
                <button
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-right border-r-0",
                    activeSectionId === s.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted/60 text-foreground/80"
                  )}
                  style={activeSectionId === s.id && s.color ? { borderRightColor: s.color, borderRightWidth: "3px", borderRightStyle: "solid" } : {}}
                  onClick={() => { setActiveSectionId(s.id); setFilter("all"); }}
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color ?? "#94a3b8" }} />
                  <span className="flex-1 truncate text-right">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{s.link_count}</span>
                </button>
                {canSections && (
                  <div className="absolute top-1 left-1 hidden group-hover:flex gap-0.5">
                    <button
                      className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      onClick={() => setSectionDialog({ open: true, section: s })}
                    ><Edit2 className="w-3 h-3" /></button>
                    <button
                      className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-500"
                      onClick={() => setDeleteConfirm({ type: "section", id: s.id, name: s.name, hasLinks: s.link_count > 0 })}
                    ><Trash2 className="w-3 h-3" /></button>
                  </div>
                )}
              </div>
            ))}
            {/* Uncategorized */}
            <button
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-right mt-1 border-t border-border/40",
                activeSectionId === null
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted/60 text-foreground/80"
              )}
              onClick={() => { setActiveSectionId(null); setFilter("all"); }}
            >
              <FolderOpen className="w-4 h-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">غير مصنف</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/40 shrink-0">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="بحث في الروابط…"
                className="pr-8 h-8 text-sm"
              />
            </div>
            <Select value={filter} onValueChange={v => setFilter(v as any)}>
              <SelectTrigger className="h-8 text-sm w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الروابط</SelectItem>
                <SelectItem value="active">النشطة فقط</SelectItem>
                <SelectItem value="inactive">الموقفة</SelectItem>
                <SelectItem value="favorite">المفضلة</SelectItem>
                <SelectItem value="pinned">المثبتة</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex border border-border/60 rounded-md overflow-hidden">
              <button
                className={cn("px-2 py-1.5 text-xs transition-colors", viewMode === "cards" ? "bg-primary/10 text-primary" : "hover:bg-muted")}
                onClick={() => setViewMode("cards")}
                title="عرض بطاقات"
              ><LayoutGrid className="w-3.5 h-3.5" /></button>
              <button
                className={cn("px-2 py-1.5 text-xs border-r border-border/60 transition-colors", viewMode === "table" ? "bg-primary/10 text-primary" : "hover:bg-muted")}
                onClick={() => setViewMode("table")}
                title="عرض جدول"
              ><List className="w-3.5 h-3.5" /></button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {linksLoading ? (
              <div className="text-center text-sm text-muted-foreground py-12">جارٍ التحميل…</div>
            ) : links.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Link2 className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm font-medium">لا توجد روابط</p>
                <p className="text-xs mt-1">
                  {canAdd ? 'اضغط "إضافة رابط أو خدمة" للبدء' : 'لم يُضف أحد روابط بعد'}
                </p>
              </div>
            ) : viewMode === "cards" ? (
              <CardsView
                links={links}
                canEdit={canEdit}
                canDelete={canDelete}
                onOpen={l => openUrl(l, openTab)}
                onEdit={l => setLinkDialog({ open: true, link: l })}
                onDelete={l => setDeleteConfirm({ type: "link", id: l.id, name: l.name })}
                onToggleFav={l => toggleFav.mutate({ id: l.id, isFavorite: !l.is_favorite })}
                onTogglePinned={l => togglePinned.mutate({ id: l.id, isPinned: !l.is_pinned })}
                onToggleActive={l => toggleActive.mutate({ id: l.id, isActive: !l.is_active })}
                onCopy={l => copyUrl(l.url)}
              />
            ) : (
              <TableView
                links={links}
                canEdit={canEdit}
                canDelete={canDelete}
                onOpen={l => openUrl(l, openTab)}
                onEdit={l => setLinkDialog({ open: true, link: l })}
                onDelete={l => setDeleteConfirm({ type: "link", id: l.id, name: l.name })}
                onToggleFav={l => toggleFav.mutate({ id: l.id, isFavorite: !l.is_favorite })}
                onTogglePinned={l => togglePinned.mutate({ id: l.id, isPinned: !l.is_pinned })}
                onToggleActive={l => toggleActive.mutate({ id: l.id, isActive: !l.is_active })}
                onCopy={l => copyUrl(l.url)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Section Dialog */}
      {sectionDialog.open && (
        <SectionDialog
          open={sectionDialog.open}
          onClose={() => setSectionDialog({ open: false })}
          section={sectionDialog.section}
          orgSections={sections}
        />
      )}

      {/* Link Dialog */}
      {linkDialog.open && (
        <LinkDialog
          open={linkDialog.open}
          onClose={() => setLinkDialog({ open: false })}
          link={linkDialog.link}
          sections={sections}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <AlertDialog open onOpenChange={() => { setDeleteConfirm(null); setForceDelete(false); }}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteConfirm.type === "section" && deleteConfirm.hasLinks && !forceDelete
                  ? `هذا القسم يحتوي على روابط. هل تريد حذف القسم ونقل رواباطه إلى "غير مصنف"؟`
                  : `هل تريد حذف "${deleteConfirm.name}"؟ لا يمكن التراجع عن هذا الإجراء.`
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex gap-2">
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleConfirmDelete}
              >
                {deleteConfirm.type === "section" && deleteConfirm.hasLinks && !forceDelete ? "حذف القسم ونقل الروابط" : "حذف"}
              </AlertDialogAction>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

// ─── Cards View ───────────────────────────────────────────────────────────────
type LinkActions = {
  canEdit: boolean; canDelete: boolean;
  onOpen: (l: LinkRow) => void;
  onEdit: (l: LinkRow) => void;
  onDelete: (l: LinkRow) => void;
  onToggleFav: (l: LinkRow) => void;
  onTogglePinned: (l: LinkRow) => void;
  onToggleActive: (l: LinkRow) => void;
  onCopy: (l: LinkRow) => void;
};

function CardsView({ links, ...actions }: { links: LinkRow[] } & LinkActions) {
  const pinned = links.filter(l => l.is_pinned);
  const rest   = links.filter(l => !l.is_pinned);

  const renderCard = (l: LinkRow) => (
    <div
      key={l.id}
      className={cn(
        "group relative flex flex-col gap-2 p-4 rounded-xl border border-border/60 bg-card",
        "hover:border-primary/30 hover:shadow-md transition-all duration-150",
        !l.is_active && "opacity-60"
      )}
      style={l.card_color ? { borderRightColor: l.card_color, borderRightWidth: "3px" } : {}}
    >
      {/* Top row */}
      <div className="flex items-start gap-2.5">
        <div className="w-9 h-9 shrink-0 rounded-lg bg-sky-500/10 flex items-center justify-center">
          <Globe className="w-5 h-5 text-sky-600 dark:text-sky-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-foreground truncate">{l.name}</span>
            {l.is_pinned && <Pin className="w-3 h-3 text-orange-500 shrink-0" />}
            {!l.is_active && <Badge variant="outline" className="text-xs px-1 py-0 text-muted-foreground">موقف</Badge>}
          </div>
          {l.section_name && (
            <span className="text-xs text-muted-foreground">{l.section_name}</span>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" dir={"rtl" as const}>
            <DropdownMenuItem onClick={() => actions.onOpen(l)}>
              <ExternalLink className="w-4 h-4 ml-2" /> فتح الرابط
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.onCopy(l)}>
              <Copy className="w-4 h-4 ml-2" /> نسخ الرابط
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => actions.onToggleFav(l)}>
              <Star className="w-4 h-4 ml-2" /> {l.is_favorite ? "إزالة من المفضلة" : "إضافة للمفضلة"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.onTogglePinned(l)}>
              <Pin className="w-4 h-4 ml-2" /> {l.is_pinned ? "إلغاء التثبيت" : "تثبيت في البداية"}
            </DropdownMenuItem>
            {actions.canEdit && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => actions.onToggleActive(l)}>
                  {l.is_active ? <XCircle className="w-4 h-4 ml-2" /> : <CheckCircle className="w-4 h-4 ml-2" />}
                  {l.is_active ? "إيقاف الرابط" : "تفعيل الرابط"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.onEdit(l)}>
                  <Edit2 className="w-4 h-4 ml-2" /> تعديل
                </DropdownMenuItem>
              </>
            )}
            {actions.canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => actions.onDelete(l)}>
                  <Trash2 className="w-4 h-4 ml-2" /> حذف
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {l.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{l.description}</p>
      )}
      <div className="flex items-center gap-2 mt-auto pt-1">
        <button
          className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-primary/5 hover:bg-primary/10 text-primary rounded-lg py-1.5 transition-colors"
          onClick={() => actions.onOpen(l)}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          فتح
        </button>
        <button
          className={cn("p-1.5 rounded-lg transition-colors", l.is_favorite ? "text-amber-500 bg-amber-500/10" : "text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10")}
          onClick={() => actions.onToggleFav(l)}
          title={l.is_favorite ? "إزالة من المفضلة" : "إضافة للمفضلة"}
        >
          <Star className="w-3.5 h-3.5" fill={l.is_favorite ? "currentColor" : "none"} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {pinned.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
            <Pin className="w-3 h-3" /> المثبتة
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {pinned.map(renderCard)}
          </div>
        </div>
      )}
      {rest.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {rest.map(renderCard)}
        </div>
      )}
    </div>
  );
}

// ─── Table View ───────────────────────────────────────────────────────────────
function TableView({ links, ...actions }: { links: LinkRow[] } & LinkActions) {
  return (
    <div className="rounded-xl border border-border/60 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b border-border/60">
            <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">الاسم</th>
            <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">القسم</th>
            <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground hidden md:table-cell">عنوان الرابط</th>
            <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground hidden lg:table-cell">طريقة الفتح</th>
            <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">الحالة</th>
            <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          {links.map(l => (
            <tr key={l.id} className={cn("border-b border-border/40 hover:bg-muted/30 transition-colors", !l.is_active && "opacity-60")}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {l.is_pinned && <Pin className="w-3 h-3 text-orange-500 shrink-0" />}
                  <span className="font-medium text-foreground">{l.name}</span>
                  {l.is_favorite && <Star className="w-3 h-3 text-amber-500 shrink-0" fill="currentColor" />}
                </div>
                {l.description && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">{l.description}</p>}
              </td>
              <td className="px-4 py-3">
                {l.section_name ? (
                  <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: l.section_color ?? "#94a3b8" }}>
                    {l.section_name}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px] block" dir="ltr">{l.url}</span>
              </td>
              <td className="px-4 py-3 hidden lg:table-cell">
                <span className="text-xs text-muted-foreground">
                  {l.open_mode === "internal" ? "داخلي" : BROWSER_OPTIONS.find(b => b.value === l.browser_type)?.label ?? l.browser_type}
                </span>
              </td>
              <td className="px-4 py-3">
                <Badge variant={l.is_active ? "default" : "secondary"} className="text-xs">
                  {l.is_active ? "نشط" : "موقف"}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  <button className="p-1.5 rounded hover:bg-sky-100 dark:hover:bg-sky-900/30 text-sky-600 transition-colors" onClick={() => actions.onOpen(l)} title="فتح">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors" onClick={() => actions.onCopy(l)} title="نسخ">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className={cn("p-1.5 rounded transition-colors", l.is_favorite ? "text-amber-500" : "text-muted-foreground hover:text-amber-500")}
                    onClick={() => actions.onToggleFav(l)}
                  >
                    <Star className="w-3.5 h-3.5" fill={l.is_favorite ? "currentColor" : "none"} />
                  </button>
                  {actions.canEdit && (
                    <button className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors" onClick={() => actions.onEdit(l)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {actions.canDelete && (
                    <button className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-500 transition-colors" onClick={() => actions.onDelete(l)}>
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
  );
}
