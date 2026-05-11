import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Plus, Edit, Trash2, Search, ListTree, TableIcon,
  ChevronDown, ChevronLeft, FolderOpen, Folder, GitBranch,
  Maximize2, Minimize2
} from "lucide-react";

const emptyForm = {
  groupCode: "",
  name: "",
  name2: "",
  description: "",
  groupType: "sub",
  level: 1,
  autoNumbering: true,
  firstNumber: 1,
  lastNumber: 99999,
  increment: 1,
  codeDigits: 5,
  parentId: undefined as number | undefined,
};

function buildPreview(prefix: string, totalDigits: number, firstNum: number, increment: number) {
  if (!prefix) return null;
  const seqLen = Math.max(1, totalDigits - prefix.length);
  const first = String(firstNum).padStart(seqLen, "0");
  const second = String(firstNum + increment).padStart(seqLen, "0");
  return { first: prefix + first, second: prefix + second, seqLen };
}

function FieldRow({ label, children, note }: { label: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="flex items-start gap-0 border-b border-border last:border-0">
      <div className="w-36 shrink-0 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground border-l border-border flex items-center min-h-[38px]">
        {label}
      </div>
      <div className="flex-1 px-3 py-1.5 flex flex-col justify-center min-h-[38px]">
        {children}
        {note && <p className="text-[10px] text-muted-foreground mt-0.5">{note}</p>}
      </div>
    </div>
  );
}

// ─── Tree Node ──────────────────────────────────────────────────────────────
function TreeNode({
  group, children, level, onEdit, onDelete, onAddChild,
}: {
  group: any;
  children: any[];
  level: number;
  onEdit: (g: any) => void;
  onDelete: (g: any) => void;
  onAddChild: (parentId: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = children.length > 0;
  const isRoot = group.groupType === "root";
  const pv = buildPreview(group.groupCode, group.codeDigits ?? 5, group.firstNumber ?? 1, group.increment ?? 1);

  return (
    <div className={level > 0 ? "border-r-2 border-primary/20 mr-4" : ""}>
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/30 group transition-colors
          ${isRoot ? "bg-muted/20 font-semibold" : "bg-background"}`}
      >
        {/* expand toggle */}
        <button
          onClick={() => hasChildren && setOpen(o => !o)}
          className={`shrink-0 text-muted-foreground transition-transform ${!hasChildren ? "invisible" : ""}`}
        >
          {open
            ? <ChevronDown className="w-4 h-4 text-primary" />
            : <ChevronLeft className="w-4 h-4 text-primary" />}
        </button>

        {/* icon */}
        {isRoot
          ? (open && hasChildren
            ? <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
            : <Folder className="w-4 h-4 text-amber-500 shrink-0" />)
          : <GitBranch className="w-4 h-4 text-primary/60 shrink-0" />
        }

        {/* code badge */}
        {group.groupCode && (
          <code className={`font-mono text-xs px-2 py-0.5 rounded font-bold shrink-0
            ${isRoot ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
              : "bg-primary/10 text-primary"}`}>
            {group.groupCode}
          </code>
        )}

        {/* name */}
        <span className={`text-sm ${isRoot ? "text-foreground font-semibold" : "text-foreground/80"}`}>
          {group.name}
        </span>
        {group.name2 && (
          <span className="text-xs text-muted-foreground">/ {group.name2}</span>
        )}

        {/* type badge */}
        <Badge
          variant={isRoot ? "outline" : "secondary"}
          className="text-[9px] h-4 shrink-0"
        >
          {isRoot ? "جذري" : "فرعي"}
        </Badge>

        {/* code preview */}
        {pv && group.autoNumbering && (
          <code className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 shrink-0 hidden sm:inline">
            {pv.first}...
          </code>
        )}

        {/* children count */}
        {hasChildren && (
          <Badge variant="secondary" className="text-[9px] h-4 shrink-0">{children.length}</Badge>
        )}

        {/* actions — show on hover */}
        <div className="mr-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isRoot && (
            <Button
              variant="ghost" size="icon" className="h-6 w-6 text-primary hover:text-primary"
              title="إضافة مجموعة فرعية"
              onClick={() => onAddChild(group.id)}
            >
              <Plus className="w-3 h-3" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(group)}>
            <Edit className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={() => { if (confirm("حذف هذه المجموعة؟")) onDelete(group); }}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* children */}
      {open && hasChildren && (
        <div className="mr-6 mt-0.5 space-y-0.5">
          {children.map(child => (
            <TreeNode
              key={child.id}
              group={child}
              children={[]}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function ProductGroups() {
  const utils = trpc.useUtils();
  const { data: groups = [], isLoading } = trpc.productGroups.list.useQuery();

  const createMutation = trpc.productGroups.create.useMutation({
    onSuccess: () => {
      utils.productGroups.list.invalidate();
      toast.success("تم إنشاء المجموعة بنجاح");
      setShowDialog(false);
      setForm({ ...emptyForm });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.productGroups.update.useMutation({
    onSuccess: () => {
      utils.productGroups.list.invalidate();
      toast.success("تم تحديث المجموعة");
      setShowDialog(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.productGroups.delete.useMutation({
    onSuccess: () => { utils.productGroups.list.invalidate(); toast.success("تم الحذف"); },
    onError: (e) => toast.error(e.message),
  });

  const [viewMode, setViewMode] = useState<"table" | "tree">("tree");
  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [search, setSearch] = useState("");
  const [isMaximized, setIsMaximized] = useState(false);

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  // حساب المستوى تلقائياً عند تغيير المجموعة الأم
  const handleParentChange = (parentId: number | undefined) => {
    const parent = allGroups.find(g => g.id === parentId);
    const newLevel = parent ? (parent.level ?? 1) + 1 : 2;
    setForm(p => ({ ...p, parentId, level: newLevel }));
  };

  // عند تغيير النوع
  const handleTypeChange = (v: string) => {
    if (v === "root") {
      setForm(p => ({ ...p, groupType: v, parentId: undefined, level: 1 }));
    } else {
      setForm(p => ({ ...p, groupType: v, level: p.parentId ? p.level : 2 }));
    }
  };

  const openCreate = (presetParentId?: number) => {
    setEditItem(null);
    setForm({
      ...emptyForm,
      groupType: presetParentId ? "sub" : "root",
      parentId: presetParentId,
    });
    setShowDialog(true);
  };

  const openEdit = (g: any) => {
    setEditItem(g);
    setForm({
      groupCode: g.groupCode ?? "",
      name: g.name ?? "",
      name2: g.name2 ?? "",
      description: g.description ?? "",
      groupType: g.groupType ?? "sub",
      level: g.level ?? 1,
      autoNumbering: g.autoNumbering ?? true,
      firstNumber: g.firstNumber ?? 1,
      lastNumber: g.lastNumber ?? 99999,
      increment: g.increment ?? 1,
      codeDigits: g.codeDigits ?? 5,
      parentId: g.parentId,
    });
    setShowDialog(true);
  };

  const handleDelete = (g: any) => deleteMutation.mutate({ id: g.id });

  const handleSubmit = () => {
    if (!form.name.trim()) return toast.error("اسم المجموعة مطلوب");
    if (!form.groupCode.trim()) return toast.error("رقم / بادئة المجموعة مطلوب");
    if (form.autoNumbering && form.codeDigits <= form.groupCode.length)
      return toast.error(`عدد الخانات يجب أن يكون أكبر من طول البادئة (${form.groupCode.length})`);
    const payload = {
      name: form.name,
      name2: form.name2 || undefined,
      groupCode: form.groupCode,
      description: form.description || undefined,
      groupType: form.groupType,
      level: form.level,
      autoNumbering: form.autoNumbering,
      firstNumber: form.firstNumber,
      lastNumber: form.lastNumber,
      increment: form.increment,
      codeDigits: form.codeDigits,
      parentId: form.parentId,
    };
    if (editItem) updateMutation.mutate({ id: editItem.id, ...payload });
    else createMutation.mutate(payload);
  };

  const allGroups = groups as any[];
  const rootGroups = allGroups.filter(g => g.groupType === "root");

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return allGroups;
    const q = search.trim().toLowerCase();
    return allGroups.filter(g =>
      g.name?.toLowerCase().includes(q) ||
      (g.name2 ?? "").toLowerCase().includes(q) ||
      (g.groupCode ?? "").toLowerCase().includes(q)
    );
  }, [allGroups, search]);

  // بناء شجرة المجموعات
  const treeData = useMemo(() => {
    const roots = allGroups.filter(g => g.groupType === "root");
    return roots.map(root => ({
      group: root,
      children: allGroups.filter(g => g.parentId === root.id),
    }));
  }, [allGroups]);

  const preview = buildPreview(form.groupCode, form.codeDigits, form.firstNumber, form.increment);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ListTree className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">مجموعات الأصناف</h2>
          <Badge variant="secondary">{allGroups.length} مجموعة</Badge>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("tree")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors
                ${viewMode === "tree" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
            >
              <ListTree className="w-3.5 h-3.5" /> شجرة
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors border-r border-border
                ${viewMode === "table" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
            >
              <TableIcon className="w-3.5 h-3.5" /> جدول
            </button>
          </div>
          <Button onClick={() => openCreate()} size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> إضافة مجموعة
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..." className="pr-9 text-sm" />
      </div>

      {/* ─── Tree View ─── */}
      {viewMode === "tree" && (
        <div className="border border-border rounded-xl bg-card p-3 space-y-1.5">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />
            ))
          ) : treeData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ListTree className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p className="text-sm">لا توجد مجموعات بعد</p>
              <Button size="sm" variant="outline" className="mt-3 gap-1" onClick={() => openCreate()}>
                <Plus className="w-3 h-3" /> إضافة أول مجموعة
              </Button>
            </div>
          ) : (
            treeData.map(({ group, children }) => (
              <TreeNode
                key={group.id}
                group={group}
                children={children}
                level={0}
                onEdit={openEdit}
                onDelete={handleDelete}
                onAddChild={(parentId) => openCreate(parentId)}
              />
            ))
          )}
          {/* المجموعات الفرعية التي ليس لها أم */}
          {allGroups.filter(g => g.groupType === "sub" && !g.parentId).length > 0 && (
            <div className="mt-3 pt-3 border-t border-dashed border-border">
              <p className="text-[11px] text-muted-foreground mb-2 px-2">مجموعات فرعية بدون مجموعة أم:</p>
              {allGroups.filter(g => g.groupType === "sub" && !g.parentId).map(g => (
                <TreeNode
                  key={g.id}
                  group={g}
                  children={[]}
                  level={0}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onAddChild={() => {}}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Table View ─── */}
      {viewMode === "table" && (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-right w-10">#</TableHead>
                <TableHead className="text-right">البادئة</TableHead>
                <TableHead className="text-right">الاسم الأول</TableHead>
                <TableHead className="text-right">الاسم الثاني</TableHead>
                <TableHead className="text-right">النوع</TableHead>
                <TableHead className="text-center">خانات</TableHead>
                <TableHead className="text-center">زيادة</TableHead>
                <TableHead className="text-right">مثال الكود</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    <ListTree className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    {search ? "لا توجد نتائج" : "لا توجد مجموعات بعد"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredGroups.map((g: any, i: number) => {
                  const pv = buildPreview(g.groupCode, g.codeDigits ?? 5, g.firstNumber ?? 1, g.increment ?? 1);
                  const parent = allGroups.find(p => p.id === g.parentId);
                  return (
                    <TableRow key={g.id} className={`hover:bg-muted/20 ${g.groupType === "root" ? "bg-muted/10 font-medium" : ""}`}>
                      <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                      <TableCell>
                        {g.groupCode
                          ? <code className={`font-mono text-xs px-2 py-0.5 rounded font-bold
                              ${g.groupType === "root"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                                : "bg-primary/10 text-primary"}`}>
                            {g.groupCode}
                          </code>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {g.groupType === "sub" && parent && (
                            <span className="text-[10px] text-muted-foreground">↳ {parent.name}</span>
                          )}
                          <span>{g.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{g.name2 ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={g.groupType === "root" ? "outline" : "default"} className="text-[10px] h-5">
                          {g.groupType === "root" ? "جذري" : "فرعي"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">{g.codeDigits ?? 5}</TableCell>
                      <TableCell className="text-center font-mono text-sm">{g.increment ?? 1}</TableCell>
                      <TableCell>
                        {pv && g.autoNumbering
                          ? <code className="font-mono text-xs text-emerald-600 dark:text-emerald-400">{pv.first} ، {pv.second}...</code>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(g)}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => { if (confirm("هل تريد حذف هذه المجموعة؟")) handleDelete(g); }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ─── Dialog ─── */}
      <Dialog open={showDialog} onOpenChange={(v) => { setShowDialog(v); if (!v) setIsMaximized(false); }}>
        <DialogContent
          className={`p-0 gap-0 overflow-hidden transition-all duration-200
            ${isMaximized
              ? "max-w-[95vw] w-[95vw] h-[95vh] max-h-[95vh]"
              : "max-w-[640px]"}`}
          dir="rtl"
        >
          <DialogHeader className="px-4 py-3 bg-muted/40 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ListTree className="w-4 h-4 text-primary" />
              {editItem ? "تعديل مجموعة أصناف" : "إضافة مجموعة أصناف"}
              <button
                onClick={() => setIsMaximized(m => !m)}
                className="mr-auto p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title={isMaximized ? "تصغير" : "تكبير"}
              >
                {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </DialogTitle>
          </DialogHeader>

          <div className={`overflow-y-auto ${isMaximized ? "max-h-[calc(95vh-110px)]" : "max-h-[80vh]"}`}>

            {/* ── البيانات الأساسية ── */}
            <div className="border-b border-border">
              <div className="px-4 py-1.5 bg-primary/5 text-xs font-semibold text-primary border-b border-border">
                البيانات الأساسية
              </div>

              {/* صف 1: رقم المجموعة + النوع */}
              <div className="flex items-stretch border-b border-border">
                <div className="w-36 shrink-0 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground border-l border-border flex items-center">
                  رقم المجموعة
                </div>
                <div className="px-3 py-1.5 flex items-center" style={{ width: "110px", borderLeft: "1px solid var(--border)" }}>
                  <Input
                    value={form.groupCode}
                    onChange={e => set("groupCode", e.target.value)}
                    placeholder="مثال: A أو 10"
                    className="h-7 text-sm font-mono border-0 p-0 focus-visible:ring-0 bg-transparent w-full"
                    dir="ltr"
                  />
                </div>
                <div className="w-24 shrink-0 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground border-l border-border flex items-center">
                  النوع
                </div>
                <div className="flex-1 px-3 py-1.5 flex flex-col justify-center">
                  <Select value={form.groupType} onValueChange={handleTypeChange}>
                    <SelectTrigger className="h-7 text-sm border-0 p-0 focus:ring-0 bg-transparent w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="root">جذري</SelectItem>
                      <SelectItem value="sub">فرعي</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[9px] text-muted-foreground mt-0.5">
                    {form.groupType === "root" ? "⚠️ لن يظهر في كارت الصنف" : "✅ يظهر في كارت الصنف"}
                  </p>
                </div>
              </div>

              {/* صف 2: الاسم الأول + الاسم الثاني */}
              <div className="flex items-stretch border-b border-border">
                <div className="w-36 shrink-0 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground border-l border-border flex items-center">
                  الاسم الأول *
                </div>
                <div className="flex-1 px-3 py-1.5 flex items-center border-l border-border">
                  <Input
                    value={form.name}
                    onChange={e => set("name", e.target.value)}
                    placeholder="اسم المجموعة"
                    className="h-7 text-sm border-0 p-0 focus-visible:ring-0 bg-transparent w-full"
                  />
                </div>
                <div className="w-28 shrink-0 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground border-l border-border flex items-center">
                  الاسم الثاني
                </div>
                <div className="flex-1 px-3 py-1.5 flex items-center">
                  <Input
                    value={form.name2}
                    onChange={e => set("name2", e.target.value)}
                    placeholder="اختياري"
                    className="h-7 text-sm border-0 p-0 focus-visible:ring-0 bg-transparent w-full"
                  />
                </div>
              </div>

              {/* صف 3: يصب في + المستوى (يظهر دائماً للفرعي) */}
              {form.groupType === "sub" && (
                <div className="flex items-stretch border-b border-border">
                  <div className="w-36 shrink-0 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground border-l border-border flex items-center gap-1">
                    <span>يصب في</span>
                    <span className="text-[9px] text-primary">(الأم)</span>
                  </div>
                  <div className="flex-1 px-3 py-1.5 flex items-center border-l border-border">
                    <Select
                      value={form.parentId ? String(form.parentId) : ""}
                      onValueChange={v => handleParentChange(v ? parseInt(v) : undefined)}
                    >
                      <SelectTrigger className="h-7 text-sm border-0 p-0 focus:ring-0 bg-transparent w-full">
                        <SelectValue placeholder="اختر المجموعة الجذرية" />
                      </SelectTrigger>
                      <SelectContent>
                        {rootGroups.map((g: any) => (
                          <SelectItem key={g.id} value={String(g.id)}>
                            {g.groupCode ? `[${g.groupCode}] ` : ""}{g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-28 shrink-0 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground border-l border-border flex items-center">
                    المستوى
                  </div>
                  <div className="flex-1 px-3 py-1.5 flex items-center gap-2">
                    <span className="font-mono font-bold text-primary text-sm w-6 text-center">{form.level}</span>
                    <span className="text-[9px] text-muted-foreground">يُحسب تلقائياً</span>
                  </div>
                </div>
              )}

              {/* مستوى للجذري */}
              {form.groupType === "root" && (
                <div className="flex items-stretch border-b border-border">
                  <div className="w-36 shrink-0 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground border-l border-border flex items-center">
                    المستوى
                  </div>
                  <div className="flex-1 px-3 py-1.5 flex items-center gap-2">
                    <span className="font-mono font-bold text-amber-600 text-sm w-6 text-center">1</span>
                    <span className="text-[9px] text-muted-foreground">جذري دائماً مستوى 1</span>
                  </div>
                </div>
              )}
            </div>

            {/* ── إعدادات الترقيم ── */}
            <div>
              <div className="px-4 py-1.5 bg-primary/5 text-xs font-semibold text-primary border-b border-border flex items-center justify-between">
                <span>إعدادات الترقيم التلقائي</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.autoNumbering} onCheckedChange={v => set("autoNumbering", !!v)} />
                  <span className="text-xs font-normal">تفعيل تسلسل أرقام أوتوماتيكي</span>
                </label>
              </div>

              <div className={`${!form.autoNumbering ? "opacity-40 pointer-events-none" : ""}`}>

                {/* صف: أول رقم + آخر رقم */}
                <div className="flex items-stretch border-b border-border">
                  <div className="w-36 shrink-0 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground border-l border-border flex items-center">
                    أول رقم
                  </div>
                  <div className="flex-1 px-3 py-1.5 flex items-center border-l border-border">
                    <Input type="number" min={1} value={form.firstNumber}
                      onChange={e => set("firstNumber", parseInt(e.target.value) || 1)}
                      className="h-7 text-sm border-0 p-0 focus-visible:ring-0 bg-transparent w-32 font-mono" dir="ltr" />
                  </div>
                  <div className="w-28 shrink-0 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground border-l border-border flex items-center">
                    آخر رقم
                  </div>
                  <div className="flex-1 px-3 py-1.5 flex items-center">
                    <Input type="number" min={1} value={form.lastNumber}
                      onChange={e => set("lastNumber", parseInt(e.target.value) || 99999)}
                      className="h-7 text-sm border-0 p-0 focus-visible:ring-0 bg-transparent w-32 font-mono" dir="ltr" />
                  </div>
                </div>

                {/* صف: معدل الزيادة + عدد الخانات */}
                <div className="flex items-stretch border-b border-border">
                  <div className="w-36 shrink-0 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground border-l border-border flex items-center">
                    معدل الزيادة
                  </div>
                  <div className="flex-1 px-3 py-1.5 flex flex-col justify-center border-l border-border">
                    <Input type="number" min={1} value={form.increment}
                      onChange={e => set("increment", parseInt(e.target.value) || 1)}
                      className="h-7 text-sm border-0 p-0 focus-visible:ring-0 bg-transparent w-20 font-mono" dir="ltr" />
                    <p className="text-[9px] text-muted-foreground mt-0.5">مثال: 1 = يزيد 1 (001، 002...) | 2 = (002، 004...)</p>
                  </div>
                  <div className="w-28 shrink-0 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground border-l border-border flex items-center">
                    عدد الخانات
                  </div>
                  <div className="flex-1 px-3 py-1.5 flex flex-col justify-center">
                    <Input type="number" min={2} max={12} value={form.codeDigits}
                      onChange={e => set("codeDigits", parseInt(e.target.value) || 5)}
                      className="h-7 text-sm border-0 p-0 focus-visible:ring-0 bg-transparent w-20 font-mono" dir="ltr" />
                    <p className="text-[9px] text-muted-foreground mt-0.5">إجمالي طول الكود (بما فيه البادئة)</p>
                  </div>
                </div>

                {/* معاينة */}
                {preview && form.groupCode && (
                  <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-950/30 border-b border-border">
                    <p className="text-[11px] text-muted-foreground mb-1.5 font-medium">معاينة أكواد الأصناف:</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="font-mono font-bold text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded">
                        {preview.first}
                      </code>
                      <span className="text-muted-foreground text-xs">،</span>
                      <code className="font-mono font-bold text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded">
                        {preview.second}
                      </code>
                      <span className="text-muted-foreground text-xs">، ...</span>
                      <span className="text-[10px] text-muted-foreground mr-auto">
                        بادئة: <b>{form.groupCode}</b> | تسلسل: <b>{preview.seqLen}</b> خانة | إجمالي: <b>{form.codeDigits}</b>
                      </span>
                    </div>
                    {form.codeDigits <= form.groupCode.length && (
                      <p className="text-[11px] text-red-500 mt-1.5">⚠️ عدد الخانات أقل من أو يساوي طول البادئة!</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="px-4 py-3 border-t border-border gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowDialog(false)}>إلغاء</Button>
            <Button size="sm" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editItem ? "حفظ التعديلات" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
