import { useMemo, useRef, useState } from "react";
import { ArrowDownCircle, Search, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/shared/lib/trpc";
import { UnifiedBottomToolbar } from "@/components/unified-toolbar/UnifiedBottomToolbar";
import type { ToolbarActionMap } from "@/components/unified-toolbar/toolbar.types";
import { useModalAttention } from "@/modules/settings/pages/useModalAttention";
import { useUnsavedChangesGuard } from "@/core/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/shared/components/UnsavedChangesDialog";
import "./SupplyReceiptDialog.css";

type Product = { id: number; name: string; code?: string | null; barcode?: string | null; costPrice?: string | null; unit?: string | null };
type Warehouse = { id: number; name: string; branchId?: number | null };
type Branch = { id: number; name: string };
type Supplier = { id: number; name: string };
type Line = {
  productId: number; productCode: string; productName: string; unit: string;
  quantity: string; unitCost: string; batchNumber: string; expiryDate: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  branches: Branch[];
  warehouses: Warehouse[];
  suppliers: Supplier[];
  products: Product[];
  onSaved: () => void;
};

const EMPTY_LINE: Omit<Line, "productId" | "productCode" | "productName" | "unit" | "unitCost"> = {
  quantity: "1", batchNumber: "", expiryDate: "",
};

export default function SupplyReceiptDialog({ open, onClose, branches, warehouses, suppliers, products, onSaved }: Props) {
  const [branchId, setBranchId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [basedOn, setBasedOn] = useState("");
  const [supplierDoc, setSupplierDoc] = useState("");
  const [supplierDocDate, setSupplierDocDate] = useState("");
  const [receiver, setReceiver] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [shaking, setShaking] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const { contentRef: attentionRef, attractAttention } = useModalAttention();
  const { confirmOpen, requestClose, confirmSave, confirmDiscard, confirmCancel } = useUnsavedChangesGuard({ isDirty });
  const utils = trpc.useUtils();
  const create = trpc.stockVouchers.create.useMutation({
    onSuccess: () => { utils.stockVouchers.list.invalidate(); toast.success("تم حفظ سند التوريد المخزني"); onSaved(); },
    onError: e => toast.error(e.message),
  });
  const warehouse = warehouses.find(w => w.branchId === Number(branchId));
  const filtered = products.filter(p => `${p.name} ${p.code ?? ""} ${p.barcode ?? ""}`.toLowerCase().includes(search.toLowerCase())).slice(0, 8);
  const totalQty = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);

  const reset = () => {
    setBranchId(""); setSupplierId(""); setIssueDate(new Date().toISOString().slice(0, 10));
    setBasedOn(""); setSupplierDoc(""); setSupplierDocDate(""); setReceiver(""); setNotes("");
    setSearch(""); setLines([]); setIsDirty(false);
  };
  const close = () => requestClose(onClose);
  const addLine = (product: Product) => {
    if (lines.some(line => line.productId === product.id)) return toast.info("الصنف موجود بالفعل في السند");
    setLines(current => [...current, { productId: product.id, productCode: product.code ?? product.barcode ?? "", productName: product.name, unit: product.unit ?? "وحدة", unitCost: product.costPrice ?? "0", ...EMPTY_LINE }]);
    setSearch(""); setIsDirty(true);
  };
  const updateLine = (index: number, key: keyof Line, value: string) => {
    setLines(current => current.map((line, i) => i === index ? { ...line, [key]: value } : line));
    setIsDirty(true);
  };
  const save = async () => {
    if (!branchId) throw new Error("اختر الفرع أولًا");
    if (!warehouse) throw new Error("لا يوجد مخزن مرتبط بالفرع المحدد");
    if (!lines.length) throw new Error("أضف صنفًا واحدًا على الأقل");
    const invalid = lines.findIndex(line => Number(line.quantity) <= 0);
    if (invalid >= 0) throw new Error(`الكمية في السطر ${invalid + 1} يجب أن تكون أكبر من صفر`);
    await create.mutateAsync({
      type: "receipt", warehouseId: warehouse.id, branchId: Number(branchId),
      supplierId: supplierId ? Number(supplierId) : undefined,
      voucherDate: issueDate, sourceDocType: basedOn || undefined,
      sourceDocNumber: supplierDoc || undefined, notes: notes || undefined,
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
    save: { supported: true, stateEnabled: !create.isPending, loading: create.isPending, onClick: async () => { try { await save(); } catch (e) { toast.error(e instanceof Error ? e.message : "تعذر حفظ السند"); } } },
    draft: { supported: false }, new: { supported: true, stateEnabled: !create.isPending, onClick: () => {
      if (isDirty) {
        toast.info("احفظ السند أو أغلق النافذة أولًا");
        return;
      }
      reset();
    } },
    duplicate: { supported: false }, tools: { supported: true }, edit: { supported: false }, delete: { supported: false },
    first: { supported: false }, previous: { supported: false }, next: { supported: false }, last: { supported: false },
    approve: { supported: false }, cancel: { supported: false }, preview: { supported: false }, send: { supported: false },
    print: { supported: false }, exit: { supported: true, onClick: close },
  }), [close, create.isPending, isDirty, save]);

  if (!open) return null;
  return (
    <div className="supply-receipt-backdrop" onMouseDown={backdrop}>
      <div ref={node => { modalRef.current = node; attentionRef.current = node; }} tabIndex={-1} className={`supply-receipt-window${shaking ? " supply-receipt-shake" : ""}`} dir="rtl" onMouseDown={e => e.stopPropagation()}>
        <div className="supply-receipt-titlebar"><span><ArrowDownCircle size={15} /> سند توريد مخزني</span><button onClick={close} aria-label="إغلاق"><X size={14} /></button></div>
        <div className="supply-receipt-subtitle">سند جديد <span>{isDirty ? "تعديلات غير محفوظة" : "جاهز"}</span></div>
        <div className="supply-receipt-header">
          <div className="supply-receipt-card">
            <Field label="الفرع" required><select value={branchId} onChange={e => { setBranchId(e.target.value); setIsDirty(true); }}><option value="">اختر الفرع</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            <Field label="رقم المستند"><input readOnly value={branchId ? "يُولد عند الحفظ" : "يظهر بعد اختيار الفرع"} /></Field>
            <Field label="المخزن المستلم"><input readOnly value={warehouse?.name ?? ""} placeholder="يحدد تلقائيًا من الفرع" /></Field>
            <Field label="تاريخ التحرير" required><input value={issueDate} onChange={e => { setIssueDate(e.target.value); setIsDirty(true); }} placeholder="YYYY-MM-DD" /></Field>
            <Field label="بناءً على"><select value={basedOn} onChange={e => { setBasedOn(e.target.value); setIsDirty(true); }}><option value="">بدون</option><option value="purchase_order">أمر شراء</option><option value="purchase_invoice">فاتورة مشتريات</option></select></Field>
            <Field label="رقم المستند المبني عليه"><input value={supplierDoc} disabled={!basedOn} onChange={e => setSupplierDoc(e.target.value)} placeholder={basedOn ? "رقم المستند" : "اختر نوع المستند أولًا"} /></Field>
            <Field label="نوع السند"><input readOnly value="سند توريد مخزني" /></Field>
          </div>
          <div className="supply-receipt-card">
            <Field label="المورد"><select value={supplierId} onChange={e => { setSupplierId(e.target.value); setIsDirty(true); }}><option value="">اختر المورد</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="مسؤول الاستلام"><input value={receiver} onChange={e => setReceiver(e.target.value)} placeholder="اسم مسؤول الاستلام" /></Field>
            <Field label="رقم مستند المورد"><input value={supplierDoc} onChange={e => setSupplierDoc(e.target.value)} /></Field>
            <Field label="تاريخ مستند المورد"><input value={supplierDocDate} onChange={e => setSupplierDocDate(e.target.value)} placeholder="YYYY-MM-DD" /></Field>
            <Field label="ملاحظة" alignStart><textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
          </div>
        </div>
        <div className="supply-receipt-product-search"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث برقم الصنف أو اسمه لإضافة صنف..." /><Search size={16} />{search && <div className="supply-receipt-results">{filtered.map(p => <button key={p.id} onClick={() => addLine(p)}>{p.name}<small>{p.code ?? p.barcode ?? ""}</small></button>)}</div>}</div>
        <div className="supply-receipt-grid-wrapper"><table className="supply-receipt-grid"><thead><tr><th>م</th><th>رقم الصنف</th><th>اسم الصنف</th><th>الوحدة</th><th>الكمية</th><th>سعر الوحدة</th><th>رقم التشغيلة</th><th>تاريخ الانتهاء</th><th /></tr></thead><tbody>{lines.map((line, i) => <tr key={line.productId}><td>{i + 1}</td><td>{line.productCode}</td><td className="product-name">{line.productName}</td><td>{line.unit}</td><td><input type="number" min="0.001" step="0.001" value={line.quantity} onChange={e => updateLine(i, "quantity", e.target.value)} /></td><td><input type="number" min="0" step="0.001" value={line.unitCost} onChange={e => updateLine(i, "unitCost", e.target.value)} /></td><td><input value={line.batchNumber} onChange={e => updateLine(i, "batchNumber", e.target.value)} /></td><td><input value={line.expiryDate} placeholder="YYYY-MM-DD" onChange={e => updateLine(i, "expiryDate", e.target.value)} /></td><td><button className="remove-line" onClick={() => { setLines(current => current.filter((_, n) => n !== i)); setIsDirty(true); }}>×</button></td></tr>)}</tbody></table>{!lines.length && <div className="supply-receipt-empty">أضف الأصناف من حقل البحث أعلاه</div>}</div>
        <div className="supply-receipt-totals"><span>إجمالي عدد الأصناف: {lines.length}</span><span>إجمالي الكمية: {totalQty.toFixed(3)}</span></div>
        <UnifiedBottomToolbar actions={actions} activeAction={create.isPending ? "save" : undefined} />
      </div>
      <UnsavedChangesDialog open={confirmOpen} onSave={() => confirmSave(save)} onDiscard={confirmDiscard} onCancel={confirmCancel} isSaving={create.isPending} />
    </div>
  );
}

function Field({ label, required, alignStart, children }: { label: string; required?: boolean; alignStart?: boolean; children: React.ReactNode }) {
  return <label className={`supply-receipt-field${alignStart ? " start" : ""}`}><span>{label}{required ? " *" : ""}</span>{children}</label>;
}