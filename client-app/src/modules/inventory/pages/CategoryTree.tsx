import { useState } from "react";
import { trpc } from "@/shared/lib/trpc";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Label } from "@/core/ui/label";
import { Badge } from "@/core/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/core/ui/dialog";
import { toast } from "sonner";
import {
  Plus, Edit, RefreshCw, Tag, Layers, Trash2, Search,
} from "lucide-react";

type Category = {
  id: number;
  uuid: string;
  name: string;
  parentId?: number | null;
  description?: string | null;
  color?: string | null;
  isActive: boolean;
};

const FOLDER_COLORS = ["#f59e0b", "#6366f1", "#10b981", "#f43f5e", "#0ea5e9", "#8b5cf6", "#ec4899", "#64748b"];

export default function CategoryTree() {
  const utils = trpc.useUtils();

  const { data: allCategories = [], isLoading: loadingCats } = trpc.categories.tree.useQuery();

  const [showDialog, setShowDialog] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: "", description: "", color: "#f59e0b", parentId: "" });
  const [search, setSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const createCat = trpc.categories.create.useMutation({
    onSuccess: () => {
      utils.categories.tree.invalidate();
      utils.categories.list.invalidate();
      toast.success("تم إنشاء الفئة");
      setShowDialog(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateCat = trpc.categories.update.useMutation({
    onSuccess: () => {
      utils.categories.tree.invalidate();
      utils.categories.list.invalidate();
      toast.success("تم تحديث الفئة");
      setShowDialog(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteCat = trpc.categories.delete.useMutation({
    onSuccess: () => {
      utils.categories.tree.invalidate();
      utils.categories.list.invalidate();
      toast.success("تم حذف الفئة");
      setConfirmDeleteId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditCat(null);
    setForm({ name: "", description: "", color: "#f59e0b", parentId: "" });
    setShowDialog(true);
  };

  const openEdit = (cat: Category) => {
    setEditCat(cat);
    setForm({
      name: cat.name,
      description: cat.description ?? "",
      color: cat.color ?? "#f59e0b",
      parentId: cat.parentId ? String(cat.parentId) : "",
    });
    setShowDialog(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return toast.error("اسم الفئة مطلوب");
    if (editCat) {
      updateCat.mutate({
        id: editCat.id,
        name: form.name,
        description: form.description,
        color: form.color,
      });
    } else {
      createCat.mutate({
        name: form.name,
        parentId: form.parentId ? Number(form.parentId) : undefined,
        description: form.description,
        color: form.color,
      });
    }
  };

  const cats = allCategories as Category[];
  const filtered = search.trim()
    ? cats.filter((c) => c.name.includes(search) || (c.description ?? "").includes(search))
    : cats;

  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* ── رأس الصفحة ── */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b shrink-0"
        style={{ background: "#EDE8DC", borderColor: "#D4CDC1" }}
      >
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-[#406B93]" />
          <h2 className="text-sm font-bold text-slate-700">فئات الأصناف</h2>
          <span className="text-xs bg-white/70 text-slate-500 rounded-full px-2 py-0.5 border border-[#D4CDC1]">
            {cats.length} فئة
          </span>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5 h-8 text-xs bg-[#406B93] hover:bg-[#365a7d]">
          <Plus className="w-3.5 h-3.5" />
          إضافة فئة
        </Button>
      </div>

      {/* ── شريط البحث ── */}
      <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: "#D4CDC1", background: "#F7F4F0" }}>
        <div className="relative max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الوصف..."
            className="pr-9 h-8 text-sm"
          />
        </div>
      </div>

      {/* ── المحتوى ── */}
      <div className="flex-1 overflow-auto">
        {loadingCats ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <div className="text-center">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#406B93]" />
              <p className="text-sm">جاري تحميل الفئات...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
            <Layers className="w-12 h-12 opacity-20" />
            <p className="text-sm font-medium">
              {search ? "لا توجد نتائج" : "لا توجد فئات بعد"}
            </p>
            {!search && (
              <Button size="sm" variant="outline" onClick={openCreate} className="gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" />
                أضف أول فئة
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead style={{ background: "#EDE8DC", position: "sticky", top: 0, zIndex: 1 }}>
              <tr>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-600 border-b" style={{ borderColor: "#D4CDC1" }}>
                  #
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-600 border-b" style={{ borderColor: "#D4CDC1" }}>
                  اللون
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-600 border-b" style={{ borderColor: "#D4CDC1" }}>
                  اسم الفئة
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-600 border-b" style={{ borderColor: "#D4CDC1" }}>
                  الفئة الأم
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-600 border-b" style={{ borderColor: "#D4CDC1" }}>
                  الوصف
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-600 border-b" style={{ borderColor: "#D4CDC1" }}>
                  الفئات الفرعية
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-600 border-b" style={{ borderColor: "#D4CDC1" }}>
                  الحالة
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-600 border-b" style={{ borderColor: "#D4CDC1" }}>
                  إجراءات
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cat, idx) => {
                const parent = cats.find((c) => c.id === cat.parentId);
                const subCount = cats.filter((c) => c.parentId === cat.id).length;
                return (
                  <tr
                    key={cat.id}
                    className="border-b hover:bg-amber-50/40 transition-colors"
                    style={{ borderColor: "#EDE8DC" }}
                  >
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      <div
                        className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: cat.color || "#6366f1" }}
                      />
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">{cat.name}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {parent ? (
                        <span className="flex items-center gap-1">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: parent.color || "#6366f1" }} />
                          {parent.name}
                        </span>
                      ) : (
                        <span className="text-slate-400">رئيسية</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate">
                      {cat.description || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-center">
                      {subCount > 0 ? (
                        <span className="bg-blue-50 text-blue-600 rounded-full px-2 py-0.5 font-medium">
                          {subCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant={cat.isActive ? "default" : "secondary"}
                        className="text-[10px] h-5"
                      >
                        {cat.isActive ? "نشطة" : "موقوفة"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 text-slate-500 hover:text-[#406B93]"
                          onClick={() => openEdit(cat)}
                          title="تعديل"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 text-slate-500 hover:text-red-600"
                          onClick={() => setConfirmDeleteId(cat.id)}
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── نافذة تأكيد الحذف ── */}
      <Dialog open={confirmDeleteId !== null} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-4 h-4" />
              تأكيد الحذف
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            {confirmDeleteId && (() => {
              const cat = cats.find(c => c.id === confirmDeleteId);
              const subCount = cats.filter(c => c.parentId === confirmDeleteId).length;
              return (
                <div className="space-y-3">
                  <p className="text-sm text-slate-700">
                    هل تريد حذف الفئة{" "}
                    <span className="font-bold">"{cat?.name}"</span>؟
                  </p>
                  {subCount > 0 && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                      <span>⚠️</span>
                      <span>هذه الفئة تحتوي على {subCount} فئة فرعية. سيتم فصلها عن هذه الفئة عند الحذف.</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">لا يمكن التراجع عن هذا الإجراء.</p>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              disabled={deleteCat.isPending}
              onClick={() => confirmDeleteId && deleteCat.mutate({ id: confirmDeleteId })}
              className="gap-1.5"
            >
              {deleteCat.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              حذف الفئة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── نافذة إضافة / تعديل فئة ── */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#406B93]" />
              {editCat ? "تعديل الفئة" : "إضافة فئة جديدة"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* اسم الفئة */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                اسم الفئة <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="مثال: إلكترونيات"
                autoFocus
              />
            </div>

            {/* الفئة الأم — فقط عند الإضافة */}
            {!editCat && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">الفئة الأم (اختياري)</Label>
                <select
                  value={form.parentId}
                  onChange={(e) => setForm((p) => ({ ...p, parentId: e.target.value }))}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                >
                  <option value="">بدون فئة أم (رئيسية)</option>
                  {cats.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* الوصف */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">الوصف (اختياري)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="وصف مختصر للفئة"
              />
            </div>

            {/* اللون */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">لون الفئة</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5"
                />
                <div className="flex gap-1.5 flex-wrap">
                  {FOLDER_COLORS.map((col) => (
                    <button
                      key={col}
                      onClick={() => setForm((p) => ({ ...p, color: col }))}
                      className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 shadow-sm"
                      style={{
                        backgroundColor: col,
                        borderColor: form.color === col ? "#1e344f" : "transparent",
                        outline: form.color === col ? "2px solid #406B93" : "none",
                        outlineOffset: 1,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* معاينة */}
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg border"
              style={{ borderColor: "#D4CDC1", background: "#F7F4F0" }}
            >
              <div className="w-5 h-5 rounded-full border-2 border-white shadow" style={{ backgroundColor: form.color }} />
              <span className="text-sm font-medium text-slate-700">
                {form.name || "اسم الفئة"}
              </span>
              {form.parentId && (
                <span className="text-xs text-muted-foreground mr-auto">
                  ← {cats.find((c) => c.id === Number(form.parentId))?.name}
                </span>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createCat.isPending || updateCat.isPending}
              className="bg-[#406B93] hover:bg-[#365a7d] gap-1.5"
            >
              {createCat.isPending || updateCat.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              {editCat ? "حفظ التعديلات" : "إضافة الفئة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
