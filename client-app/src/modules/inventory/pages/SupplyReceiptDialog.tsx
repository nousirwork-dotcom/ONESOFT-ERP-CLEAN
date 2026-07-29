import { useMemo, useRef, useState } from "react";
import { ArrowDownCircle, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/shared/lib/trpc";
import { UnifiedBottomToolbar } from "@/components/unified-toolbar/UnifiedBottomToolbar";
import type { ToolbarActionMap } from "@/components/unified-toolbar/toolbar.types";
import { useFocusedEntityRegistrySafe } from "@/components/unified-toolbar/FocusedEntityRegistry";
import { useModalAttention } from "@/modules/settings/pages/useModalAttention";
import { useUnsavedChangesGuard } from "@/core/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/shared/components/UnsavedChangesDialog";
import DateSegmentInput from "@/shared/components/DateSegmentInput";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/core/ui/dialog";
import "./SupplyReceiptDialog.css";

type Product = { id: number; name: string; code?: string | null; barcode?: string | null; costPrice?: string | null; unit?: string | null };
type Warehouse = { id: number; name: string; branchId?: number | null };
type Branch = { id: number; name: string };
type Supplier = { id: number; name: string };
type User = { id: number; name: string; username?: string };
type Line = {
  productId: number; productCode: string; productName: string; unit: string;
  quantity: string; unitCost: string; batchNumber: string; expiryDate: string;
};
type Props = {
  open: boolean; onClose: () => void; branches: Branch[]; warehouses: Warehouse[];
  suppliers: Supplier[]; products: Product[]; onSaved: () => void;
};

const today = () => new Date().toISOString().slice(0, 10);

export default function SupplyReceiptDialog({ open, onClose, branches, warehouses, suppliers, products, onSaved }: Props) {
  const [branchId, setBranchId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [receiverUserId, setReceiverUserId] = useState("");
  const [issueDate, setIssueDate] = useState(today());
  const [basedOn, setBasedOn] = useState("");
  const [sourceNumber, setSourceNumber] = useState("");
  const [supplierDoc, setSupplierDoc] = useState("");
  const [supplierDocDate, setSupplierDocDate] = useState("");
  const [notes, setNotes] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [journalId, setJournalId] = useState<number | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [reserving, setReserving] = useState(false);
  const quantityRef = useRef<HTMLInputElement | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const { contentRef: attentionRef, attractAttention } = useModalAttention();
  const { previewFocusedEntity } = useFocusedEntityRegistrySafe();
  const { confirmOpen, requestClose, confirmSave, confirmDiscard, confirmCancel } = useUnsavedChangesGuard({ isDirty });
  const utils = trpc.useUtils();
  const usersQ = trpc.users.listBasic.useQuery(undefined, { enabled: open });
  const reserveNumber = trpc.stockVouchers.reserveNumber.useMutation();
  const create = trpc.stockVouchers.create.useMutation({
    onSuccess: () => { utils.stockVouchers.list.invalidate(); toast.success("تم حفظ سند التوريد المخزني"); onSaved(); },
    onError: e => toast.error(e.message),
  });
  const warehouse = warehouses.find(w => w.branchId === Number(branchId));
  const users = (usersQ.data ?? []) as User[];
  const pickerProducts = products.filter(p => `${p.name} ${p.code ?? ""} ${p.barcode ?? ""}`.toLowerCase().includes(pickerSearch.toLowerCase()));
  const totalQty = lines.reduce((sum, line) => sum + Math.max(0, Number(line.quantity) || 0), 0);
  const totalValue = lines.reduce((sum, line) => sum + Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.unitCost) || 0), 0);

  const reset = () => {
    setBranchId(""); setSupplierId(""); setReceiverUserId(""); setIssueDate(today());
    setBasedOn(""); setSourceNumber(""); setSupplierDoc(""); setSupplierDocDate("");
    setNotes(""); setDocumentNumber(""); setJournalId(null); setLines([]); setIsDirty(false);
  };
  const close = () => requestClose(onClose);
  const chooseBranch = async (value: string) => {
    setBranchId(value); setDocumentNumber(""); setJournalId(null); setIsDirty(true);
    const selected = warehouses.find(w => w.branchId === Number(value));
    if (!selected) { toast.error("لا يوجد مخزن مرتبط بالفرع المحدد"); return; }
    setReserving(true);
    try {
      const reserved = await reserveNumber.mutateAsync({ warehouseId: selected.id, type: "receipt" });
      setDocumentNumber(reserved.voucherNumber); setJournalId(reserved.journalId);
    } catch (e) { toast.error(e instanceof Error ? e.message : "تعذر حجز رقم السند"); }
    finally { setReserving(false); }
  };
  const addLine = (product: Product) => {
    const duplicate = lines.some(line => line.productId === product.id && line.unit === (product.unit ?? "وحدة") && !line.batchNumber && !line.expiryDate);
    if (duplicate) { toast.info("الصنف موجود بنفس الوحدة والتشغيلة والتاريخ"); return; }
    setLines(current => [...current, {
      productId: product.id, productCode: product.code ?? product.barcode ?? "",
      productName: product.name, unit: product.unit ?? "وحدة", quantity: "1",
      unitCost: product.costPrice ?? "0", batchNumber: "", expiryDate: "",
    }]);
    setPickerOpen(false); setPickerSearch(""); setIsDirty(true);
    requestAnimationFrame(() => quantityRef.current?.focus());
  };
  const updateLine = (index: number, key: keyof Line, value: string) => {
    const safe = key === "quantity" || key === "unitCost" ? value.replace(/[^\d.]/g, "") : value;
    setLines(current => current.map((line, i) => i === index ? { ...line, [key]: safe } : line));
    setIsDirty(true);
  };
  const save = async () => {
    if (!branchId || !warehouse) throw new Error("اختر فرعًا مرتبطًا بمخزن");
    if (!documentNumber || !journalId) throw new Error("انتظر توليد رقم السند");
    if (!lines.length) throw new Error("أضف صنفًا واحدًا على الأقل");
    const bad = lines.findIndex(line => Number(line.quantity) <= 0 || Number(line.unitCost) < 0);
    if (bad >= 0) throw new Error(`تحقق من الكمية والسعر في السطر ${bad + 1}`);
    await create.mutateAsync({
      type: "receipt", warehouseId: warehouse.id, branchId: Number(branchId),
      voucherNumber: documentNumber, sourceJournalId: journalId,
      supplierId: supplierId ? Number(supplierId) : undefined,
      receiverUserId: receiverUserId ? Number(receiverUserId) : undefined,
      voucherDate: issueDate, sourceDocType: basedOn || undefined,
      sourceDocNumber: sourceNumber || undefined, notes: notes || undefined,
      items: lines.map(line => ({
        productId: line.productId, productName: line.productName, quantity: line.quantity,
        unitCost: line.unitCost, totalCost: (Number(line.quantity) * Number(line.unitCost)).toFixed(4),
        productCode: line.productCode, unit: line.unit, batchNumber: line.batchNumber || undefined,
        expiryDate: line.expiryDate || undefined,
      })),
    });
  };
  const backdrop = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    setShaking(false); requestAnimationFrame(() => setShaking(true)); window.setTimeout(() => setShaking(false), 350);
    attractAttention(); modalRef.current?.focus();
  };
  const actions = useMemo<ToolbarActionMap>(() => ({
    save: { supported: true, stateEnabled: !create.isPending && !reserving, loading: create.isPending, onClick: async () => { try { await save(); } catch (e) { toast.error(e instanceof Error ? e.message : "تعذر حفظ السند"); } } },
    draft: { supported: false }, new: { supported: true, stateEnabled: !create.isPending, onClick: () => { if (isDirty) { toast.info("احفظ السند أو أغلق النافذة أولًا"); return; } reset(); } },
    duplicate: { supported: false }, tools: { supported: true }, edit: { supported: false }, delete: { supported: false },
    first: { supported: false }, previous: { supported: false }, next: { supported: false }, last: { supported: false },
    approve: { supported: false }, cancel: { supported: false }, preview: { supported: true, onClick: previewFocusedEntity }, send: { supported: false },
    print: { supported: false }, exit: { supported: true, onClick: close },
  }), [close, create.isPending, isDirty, previewFocusedEntity, reserving, save]);

  if (!open) return null;
  return (
    <div className="supply-receipt-backdrop" onMouseDown={backdrop}>
      <div ref={node => { modalRef.current = node; attentionRef.current = node; }} tabIndex={-1} className={`supply-receipt-window${shaking ? " supply-receipt-shake" : ""}`} dir="rtl" onMouseDown={e => e.stopPropagation()}>
        <div className="supply-receipt-titlebar"><span><ArrowDownCircle size={15} /> سند توريد مخزني</span><button onClick={close} aria-label="إغلاق"><X size={14} /></button></div>
        <div className="supply-receipt-subtitle">سند جديد <span>{isDirty ? "تعديلات غير محفوظة" : "جاهز"}</span></div>
        <div className="supply-receipt-scroll">
          <div className="supply-receipt-header">
            <div className="supply-receipt-card">
              <Field label="الفرع" required><select value={branchId} onChange={e => void chooseBranch(e.target.value)}><option value="">اختر الفرع</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
              <Field label="رقم المستند"><input readOnly value={reserving ? "جارٍ حجز الرقم..." : documentNumber || "يظهر بعد اختيار الفرع"} /></Field>
              <Field label="المخزن المستلم"><input readOnly value={warehouse?.name ?? ""} placeholder="يحدد تلقائيًا من الفرع" /></Field>
              <Field label="تاريخ التحرير" required><DateSegmentInput standalone value={issueDate} onChange={v => { setIssueDate(v); setIsDirty(true); }} /></Field>
              <Field label="بناءً على"><select value={basedOn} onChange={e => { setBasedOn(e.target.value); setIsDirty(true); }}><option value="">بدون</option><option value="purchase_order">أمر شراء</option><option value="purchase_invoice">فاتورة مشتريات</option></select></Field>
              <Field label="رقم المستند المبني عليه"><input value={sourceNumber} disabled={!basedOn} onChange={e => setSourceNumber(e.target.value)} placeholder={basedOn ? "رقم المستند" : "اختر النوع أولًا"} /></Field>
              <Field label="نوع السند"><input readOnly value="سند توريد مخزني" /></Field>
            </div>
            <div className="supply-receipt-card">
              <Field label="المورد"><select value={supplierId} onChange={e => { setSupplierId(e.target.value); setIsDirty(true); }}><option value="">اختر المورد</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
              <Field label="مسؤول الاستلام"><select value={receiverUserId} onChange={e => { setReceiverUserId(e.target.value); setIsDirty(true); }}><option value="">اختر المستخدم</option>{users.map(u => <option key={u.id} value={u.id}>{u.name || u.username}</option>)}</select></Field>
              <Field label="رقم مستند المورد"><input value={supplierDoc} onChange={e => { setSupplierDoc(e.target.value); setIsDirty(true); }} /></Field>
              <Field label="تاريخ مستند المورد"><DateSegmentInput standalone value={supplierDocDate} onChange={v => { setSupplierDocDate(v); setIsDirty(true); }} /></Field>
              <Field label="ملاحظة" alignStart><textarea rows={3} value={notes} onChange={e => { setNotes(e.target.value); setIsDirty(true); }} /></Field>
            </div>
          </div>
          <div className="supply-receipt-add-row"><button className="supply-receipt-add" onClick={() => setPickerOpen(true)}><Plus size={15} /> إضافة صنف</button></div>
          <div className="supply-receipt-grid-wrapper"><table className="supply-receipt-grid"><thead><tr><th>م</th><th>رقم الصنف</th><th>اسم الصنف</th><th>الوحدة</th><th>الكمية</th><th>سعر الوحدة</th><th>رقم التشغيلة</th><th>تاريخ الانتهاء</th><th /></tr></thead><tbody>{lines.map((line, i) => <tr key={`${line.productId}-${line.unit}-${line.batchNumber}-${line.expiryDate}`}><td>{i + 1}</td><td><button className="product-preview-link" data-focused-entity-type="product" data-focused-entity-id={line.productId} data-focused-field="productCode" data-focused-source="SupplyReceipt" data-focused-entity-title={line.productName} onClick={previewFocusedEntity}>{line.productCode}</button></td><td className="product-name">{line.productName}</td><td>{line.unit}</td><td><input ref={i === lines.length - 1 ? quantityRef : undefined} className="numeric-input" type="text" inputMode="decimal" value={line.quantity} onChange={e => updateLine(i, "quantity", e.target.value)} /></td><td><input className="numeric-input" type="text" inputMode="decimal" value={line.unitCost} onChange={e => updateLine(i, "unitCost", e.target.value)} /></td><td><input value={line.batchNumber} onChange={e => updateLine(i, "batchNumber", e.target.value)} /></td><td><DateSegmentInput standalone value={line.expiryDate} onChange={v => updateLine(i, "expiryDate", v)} /></td><td><button className="remove-line" onClick={() => { setLines(current => current.filter((_, n) => n !== i)); setIsDirty(true); }}>×</button></td></tr>)}</tbody></table>{!lines.length && <div className="supply-receipt-empty">اضغط «إضافة صنف» لإضافة أصناف السند</div>}</div>
          <div className="supply-receipt-totals"><span>إجمالي عدد الأصناف: {lines.length}</span><span>إجمالي الكمية: <b dir="ltr">{totalQty.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</b></span><span>إجمالي القيمة: <b dir="ltr">{totalValue.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</b> ريال سعودي</span></div>
        </div>
        <UnifiedBottomToolbar actions={actions} activeAction={create.isPending ? "save" : undefined} />
      </div>
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader><DialogTitle>اختيار صنف</DialogTitle></DialogHeader>
          <div className="supply-picker-search"><Search size={16} /><input autoFocus value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} placeholder="ابحث بالكود أو الاسم..." /></div>
          <div className="supply-picker-list">{pickerProducts.map(p => <div className="supply-picker-row" key={p.id}><span><b>{p.code ?? p.barcode ?? "—"}</b> — {p.name}<small>{p.unit ?? "وحدة"}</small></span><button onClick={() => addLine(p)}>اختيار</button></div>)}{!pickerProducts.length && <p className="supply-receipt-empty">لا توجد أصناف مطابقة</p>}</div>
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog open={confirmOpen} onSave={() => confirmSave(save)} onDiscard={confirmDiscard} onCancel={confirmCancel} isSaving={create.isPending} />
    </div>
  );
}

function Field({ label, required, alignStart, children }: { label: string; required?: boolean; alignStart?: boolean; children: React.ReactNode }) {
  return <label className={`supply-receipt-field${alignStart ? " start" : ""}`}><span>{label}{required ? " *" : ""}</span>{children}</label>;
}