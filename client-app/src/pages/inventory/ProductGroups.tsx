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
import { Plus, Edit, Trash2, Search, ListTree } from "lucide-react";

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

// عدد الخانات = إجمالي طول كود الصنف (بما فيه البادئة)
// مثال: بادئة "2" + عدد خانات 5 = كود "20001" (إجمالي 5 أرقام)
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

  const handleSubmit = () => {
    if (!form.name.trim()) return toast.error("اسم المجموعة مطلوب");
    if (!form.groupCode.trim()) return toast.error("رقم / بادئة المجموعة مطلوب");
    if (form.codeDigits <= form.groupCode.length)
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

  const rootGroups = (groups as any[]).filter(g => g.groupType === "root");
  const preview = buildPreview(form.groupCode, form.codeDigits, form.firstNumber, form.increment);

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
          <Plus className="w-4 h-4" /> إضافة مجموعة
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
              <TableHead className="text-right">البادئة</TableHead>
              <TableHead className="text-right">الاسم الأول</TableHead>
              <TableHead className="text-right">الاسم الثاني</TableHead>
              <TableHead className="text-right">النوع</TableHead>
              <TableHead className="text-right text-center">خانات</TableHead>
              <TableHead className="text-right text-center">زيادة</TableHead>
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
                  {search ? "لا توجد نتائج" : "لا توجد مجموعات بعد — اضغط إضافة مجموعة"}
                </TableCell>
              </TableRow>
            ) : (
              filteredGroups.map((g: any, i: number) => {
                const pv = buildPreview(g.groupCode, g.codeDigits ?? 5, g.firstNumber ?? 1, g.increment ?? 1);
                return (
                  <TableRow key={g.id} className="hover:bg-muted/20">
                    <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                    <TableCell>
                      {g.groupCode
                        ? <code className="font-mono bg-primary/10 text-primary px-2 py-0.5 rounded font-bold text-xs">{g.groupCode}</code>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{g.name2 ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={g.groupType === "root" ? "outline" : "default"} className="text-[10px] h-5">
                        {g.groupType === "root" ? "جذري" : "فرعي"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm font-mono">{g.codeDigits ?? 5}</TableCell>
                    <TableCell className="text-center text-sm font-mono">{g.increment ?? 1}</TableCell>
                    <TableCell>
                      {pv && g.autoNumbering
                        ? <code className="font-mono text-xs text-emerald-600 dark:text-emerald-400">{pv.first} ، {pv.second} ...</code>
                        : <span className="text-muted-foreground text-xs">—</span>}
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
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-[480px] p-0 gap-0 overflow-hidden" dir="rtl">
          <DialogHeader className="px-4 py-3 bg-muted/40 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ListTree className="w-4 h-4 text-primary" />
              {editItem ? "تعديل مجموعة أصناف" : "إضافة مجموعة أصناف"}
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[75vh]">
            {/* ─── البيانات الأساسية ─── */}
            <div className="border-b border-border">
              <div className="px-4 py-1.5 bg-primary/5 text-xs font-semibold text-primary border-b border-border">
                البيانات الأساسية
              </div>
              <div className="divide-y divide-border">
                <FieldRow label="رقم المجموعة">
                  <Input
                    value={form.groupCode}
                    onChange={e => set("groupCode", e.target.value)}
                    placeholder="مثال: 2 أو 10 أو A"
                    className="h-7 text-sm font-mono border-0 p-0 focus-visible:ring-0 bg-transparent"
                    dir="ltr"
                  />
                </FieldRow>
                <FieldRow label="الاسم الأول">
                  <Input
                    value={form.name}
                    onChange={e => set("name", e.target.value)}
                    placeholder="اسم المجموعة *"
                    className="h-7 text-sm border-0 p-0 focus-visible:ring-0 bg-transparent"
                  />
                </FieldRow>
                <FieldRow label="الاسم الثاني">
                  <Input
                    value={form.name2}
                    onChange={e => set("name2", e.target.value)}
                    placeholder="اسم بديل (اختياري)"
                    className="h-7 text-sm border-0 p-0 focus-visible:ring-0 bg-transparent"
                  />
                </FieldRow>
                <FieldRow label="النوع">
                  <Select value={form.groupType} onValueChange={v => set("groupType", v)}>
                    <SelectTrigger className="h-7 text-sm border-0 p-0 focus:ring-0 bg-transparent w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="root">جذري</SelectItem>
                      <SelectItem value="sub">فرعي</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {form.groupType === "root"
                      ? "⚠️ جذري — لن يظهر في اختيارات كارت الصنف"
                      : "✅ فرعي — سيظهر عند اختيار المجموعة في كارت الصنف"}
                  </p>
                </FieldRow>
                {form.groupType === "sub" && (
                  <FieldRow label="المجموعة الأم">
                    <Select
                      value={form.parentId ? String(form.parentId) : ""}
                      onValueChange={v => set("parentId", v ? parseInt(v) : undefined)}
                    >
                      <SelectTrigger className="h-7 text-sm border-0 p-0 focus:ring-0 bg-transparent w-52">
                        <SelectValue placeholder="اختر المجموعة الأم" />
                      </SelectTrigger>
                      <SelectContent>
                        {rootGroups.map((g: any) => (
                          <SelectItem key={g.id} value={String(g.id)}>
                            {g.groupCode ? `[${g.groupCode}] ` : ""}{g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldRow>
                )}
                <FieldRow label="المستوى">
                  <Input
                    type="number" min={1} max={9}
                    value={form.level}
                    onChange={e => set("level", parseInt(e.target.value) || 1)}
                    className="h-7 text-sm border-0 p-0 focus-visible:ring-0 bg-transparent w-16 font-mono"
                    dir="ltr"
                  />
                </FieldRow>
              </div>
            </div>

            {/* ─── إعدادات الترقيم ─── */}
            <div>
              <div className="px-4 py-1.5 bg-primary/5 text-xs font-semibold text-primary border-b border-border flex items-center justify-between">
                <span>إعدادات الترقيم التلقائي</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={form.autoNumbering}
                    onCheckedChange={v => set("autoNumbering", !!v)}
                  />
                  <span className="text-xs font-normal">تسلسل أرقام أوتوماتيكي</span>
                </label>
              </div>

              <div className={`divide-y divide-border ${!form.autoNumbering ? "opacity-40 pointer-events-none" : ""}`}>
                <FieldRow label="أول رقم">
                  <Input
                    type="number" min={1}
                    value={form.firstNumber}
                    onChange={e => set("firstNumber", parseInt(e.target.value) || 1)}
                    className="h-7 text-sm border-0 p-0 focus-visible:ring-0 bg-transparent w-28 font-mono"
                    dir="ltr"
                  />
                </FieldRow>
                <FieldRow label="آخر رقم">
                  <Input
                    type="number" min={1}
                    value={form.lastNumber}
                    onChange={e => set("lastNumber", parseInt(e.target.value) || 99999)}
                    className="h-7 text-sm border-0 p-0 focus-visible:ring-0 bg-transparent w-28 font-mono"
                    dir="ltr"
                  />
                </FieldRow>
                <FieldRow
                  label="معدل الزيادة"
                  note="مثال: 1 = يزيد 1 في كل مرة (001، 002...) | 2 = يزيد 2 (001، 003، 005...)"
                >
                  <Input
                    type="number" min={1}
                    value={form.increment}
                    onChange={e => set("increment", parseInt(e.target.value) || 1)}
                    className="h-7 text-sm border-0 p-0 focus-visible:ring-0 bg-transparent w-16 font-mono"
                    dir="ltr"
                  />
                </FieldRow>
                <FieldRow
                  label="عدد الخانات"
                  note="إجمالي طول كود الصنف كاملاً (بما فيه البادئة)"
                >
                  <Input
                    type="number" min={2} max={12}
                    value={form.codeDigits}
                    onChange={e => set("codeDigits", parseInt(e.target.value) || 5)}
                    className="h-7 text-sm border-0 p-0 focus-visible:ring-0 bg-transparent w-16 font-mono"
                    dir="ltr"
                  />
                </FieldRow>

                {/* معاينة */}
                {preview && form.groupCode && (
                  <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-950/30">
                    <p className="text-[11px] text-muted-foreground mb-1">معاينة أكواد الأصناف:</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="font-mono font-bold text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded">
                        {preview.first}
                      </code>
                      <span className="text-muted-foreground text-xs">←</span>
                      <code className="font-mono font-bold text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded">
                        {preview.second}
                      </code>
                      <span className="text-muted-foreground text-xs">← ...</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      بادئة: <b>{form.groupCode}</b> | خانات التسلسل: <b>{preview.seqLen}</b> | إجمالي طول الكود: <b>{form.codeDigits}</b>
                    </p>
                    {form.codeDigits <= form.groupCode.length && (
                      <p className="text-[11px] text-red-500 mt-1">⚠️ عدد الخانات أقل من طول البادئة!</p>
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
