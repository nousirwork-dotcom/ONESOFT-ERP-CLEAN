import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, Layers, Edit, Trash2, Search, Hash, ListTree } from "lucide-react";

const emptyForm = {
  groupCode: "",
  name: "",
  name2: "",
  description: "",
  groupType: "root",
  level: 1,
  autoNumbering: true,
  firstNumber: 1,
  lastNumber: 99999,
  increment: 1,
  codeDigits: 5,
  parentId: undefined as number | undefined,
};

function previewCode(groupCode: string, codeDigits: number, firstNumber: number) {
  if (!groupCode) return "—";
  const seqDigits = Math.max(1, codeDigits);
  const seq = String(firstNumber).padStart(seqDigits, "0");
  return groupCode + seq;
}

export default function ProductGroups() {
  const utils = trpc.useUtils();
  const { data: groups = [], isLoading } = trpc.productGroups.list.useQuery();

  const createMutation = trpc.productGroups.create.useMutation({
    onSuccess: () => {
      utils.productGroups.list.invalidate();
      toast.success("تم إنشاء المجموعة بنجاح");
      setShowDialog(false);
      setForm(emptyForm);
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
    onSuccess: () => {
      utils.productGroups.list.invalidate();
      toast.success("تم حذف المجموعة");
    },
    onError: (e) => toast.error(e.message),
  });

  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [search, setSearch] = useState("");

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const openCreate = () => {
    setEditItem(null);
    setForm({ ...emptyForm });
    setShowDialog(true);
  };

  const openEdit = (g: any) => {
    setEditItem(g);
    setForm({
      groupCode: g.groupCode ?? "",
      name: g.name ?? "",
      name2: g.name2 ?? "",
      description: g.description ?? "",
      groupType: g.groupType ?? "root",
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

  const handleSubmit = () => {
    if (!form.name.trim()) return toast.error("اسم المجموعة مطلوب");
    const payload = {
      name: form.name,
      name2: form.name2 || undefined,
      groupCode: form.groupCode || undefined,
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
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filteredGroups = useMemo(() => {
    let result = [...(groups as any[])];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(g =>
        g.name?.toLowerCase().includes(q) ||
        (g.name2 ?? "").toLowerCase().includes(q) ||
        (g.groupCode ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [groups, search]);

  const parentGroups = (groups as any[]).filter(g => g.groupType === "root");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTree className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">مجموعات الأصناف</h2>
          <Badge variant="secondary">{(groups as any[]).length} مجموعة</Badge>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          إنشاء مجموعة
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..." className="pr-9 text-sm" />
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-right w-10">#</TableHead>
              <TableHead className="text-right">رقم المجموعة</TableHead>
              <TableHead className="text-right">الاسم الأول</TableHead>
              <TableHead className="text-right">الاسم الثاني</TableHead>
              <TableHead className="text-right">النوع</TableHead>
              <TableHead className="text-right">عدد الخانات</TableHead>
              <TableHead className="text-right">مثال الكود</TableHead>
              <TableHead className="text-right">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredGroups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  <Layers className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  {search ? "لا توجد نتائج" : "لا توجد مجموعات بعد"}
                </TableCell>
              </TableRow>
            ) : (
              filteredGroups.map((g: any, i: number) => (
                <TableRow key={g.id} className="hover:bg-muted/20">
                  <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                  <TableCell>
                    {g.groupCode ? (
                      <code className="text-xs font-mono bg-primary/10 px-2 py-0.5 rounded text-primary font-bold">
                        {g.groupCode}
                      </code>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{g.name2 ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={g.groupType === "root" ? "default" : "secondary"} className="text-[10px] h-5">
                      {g.groupType === "root" ? "جذري" : "فرعي"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm">{g.codeDigits ?? 5}</TableCell>
                  <TableCell>
                    {g.groupCode && g.autoNumbering ? (
                      <code className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
                        {previewCode(g.groupCode, g.codeDigits ?? 5, g.firstNumber ?? 1)}
                      </code>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(g)}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => { if (confirm("هل تريد حذف هذه المجموعة؟")) deleteMutation.mutate({ id: g.id }); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              {editItem ? "تعديل مجموعة أصناف" : "إنشاء مجموعة أصناف جديدة"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1 max-h-[70vh] overflow-y-auto px-1">
            {/* البيانات الأساسية */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>رقم / بادئة المجموعة</Label>
                <Input
                  value={form.groupCode}
                  onChange={e => set("groupCode", e.target.value)}
                  placeholder="مثال: 2 أو 10"
                  className="font-mono"
                  dir="ltr"
                />
                <p className="text-[10px] text-muted-foreground">الرقم الذي تبدأ به أكواد الأصناف</p>
              </div>
              <div className="space-y-1.5">
                <Label>النوع</Label>
                <Select value={form.groupType} onValueChange={v => set("groupType", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">جذري</SelectItem>
                    <SelectItem value="sub">فرعي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>الاسم الأول *</Label>
                <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="اسم المجموعة" />
              </div>
              <div className="space-y-1.5">
                <Label>الاسم الثاني</Label>
                <Input value={form.name2} onChange={e => set("name2", e.target.value)} placeholder="اسم بديل (اختياري)" />
              </div>
            </div>

            {form.groupType === "sub" && (
              <div className="space-y-1.5">
                <Label>المجموعة الأم</Label>
                <Select
                  value={form.parentId ? String(form.parentId) : ""}
                  onValueChange={v => set("parentId", v ? parseInt(v) : undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المجموعة الأم" />
                  </SelectTrigger>
                  <SelectContent>
                    {parentGroups.map((g: any) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.groupCode ? `[${g.groupCode}] ` : ""}{g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>المستوى</Label>
              <Input
                type="number"
                min={1}
                value={form.level}
                onChange={e => set("level", parseInt(e.target.value) || 1)}
                className="w-24"
                dir="ltr"
              />
            </div>

            <Separator />

            {/* قسم الأرقام */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">تسلسل الأرقام (أوتوماتيكي)</span>
                </div>
                <Switch
                  checked={form.autoNumbering}
                  onCheckedChange={v => set("autoNumbering", v)}
                />
              </div>

              {form.autoNumbering && (
                <div className="bg-muted/30 rounded-lg p-3 space-y-3 border border-border/50">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">أول رقم</Label>
                      <Input
                        type="number"
                        min={1}
                        value={form.firstNumber}
                        onChange={e => set("firstNumber", parseInt(e.target.value) || 1)}
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">آخر رقم</Label>
                      <Input
                        type="number"
                        min={1}
                        value={form.lastNumber}
                        onChange={e => set("lastNumber", parseInt(e.target.value) || 99999)}
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">معدل الزيادة</Label>
                      <Input
                        type="number"
                        min={1}
                        value={form.increment}
                        onChange={e => set("increment", parseInt(e.target.value) || 1)}
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">عدد الخانات</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={form.codeDigits}
                        onChange={e => set("codeDigits", parseInt(e.target.value) || 5)}
                        dir="ltr"
                      />
                    </div>
                  </div>

                  {/* معاينة الكود */}
                  {form.groupCode && (
                    <div className="bg-background rounded-md p-2 border border-border flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">مثال على كود الصنف الأول:</span>
                      <code className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                        {previewCode(form.groupCode, form.codeDigits, form.firstNumber)}
                      </code>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDialog(false)}>إلغاء</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editItem ? "حفظ التعديلات" : "إنشاء"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
