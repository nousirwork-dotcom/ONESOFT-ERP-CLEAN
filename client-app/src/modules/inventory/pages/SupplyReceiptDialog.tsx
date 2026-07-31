import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/shared/lib/trpc";
import type { ToolbarActionMap } from "@/components/unified-toolbar/toolbar.types";
import { useToolbarActions } from "@/components/unified-toolbar/ToolbarActionsContext";
import { useFocusedEntityRegistrySafe } from "@/components/unified-toolbar/FocusedEntityRegistry";
import { useUnsavedChangesGuard } from "@/core/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/shared/components/UnsavedChangesDialog";
import DateSegmentInput from "@/shared/components/DateSegmentInput";
import ProductLookupCell, { type ProductLookupOption } from "@/shared/components/ProductLookupCell";
import { ensureSingleTrailingBlank, insertBlankLine, lineHasContent } from "./supplyReceiptLineUtils";
import "./SupplyReceiptDialog.css";

type Product = ProductLookupOption & { itemType?: string | null };
type Warehouse = { id: number; name: string; branchId?: number | null };
type Branch = { id: number; name: string };
type Supplier = { id: number; name: string };
type User = { id: number; name: string; username?: string };
type Line = {
  productId?: number; productCode: string; productName: string; unit: string;
  quantity: string; unitCost: string; batchNumber: string; expiryDate: string;
};
type Props = {
  open: boolean; onClose: () => void; branches: Branch[]; warehouses: Warehouse[];
  suppliers: Supplier[]; products: Product[]; onSaved: () => void;
  registerClose?: (closeRequest: () => void) => void;
};

const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): Line => ({ productCode: "", productName: "", unit: "", quantity: "1", unitCost: "", batchNumber: "", expiryDate: "" });
const editableColumns = ["code", "name", "unit", "quantity", "unitCost", "batchNumber", "expiryDate"] as const;

export default function SupplyReceiptDialog({ open, onClose, branches, warehouses, suppliers, products, onSaved, registerClose }: Props) {
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
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [isDirty, setIsDirty] = useState(false);
  const [reserving, setReserving] = useState(false);
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const { previewFocusedEntity } = useFocusedEntityRegistrySafe();
  const { confirmOpen, requestClose, confirmSave, confirmDiscard, confirmCancel } = useUnsavedChangesGuard({ isDirty });
  const utils = trpc.useUtils();
  const usersQ = trpc.users.listBasic.useQuery(undefined, { enabled: open });
  const reserveNumber = trpc.stockVouchers.reserveNumber.useMutation();
  const create = trpc.stockVouchers.create.useMutation({
    onSuccess: () => {
      setIsDirty(false);
      utils.stockVouchers.list.invalidate();
      toast.success("تم حفظ سند التوريد المخزني");
      onSaved();
    },
    onError: e => toast.error(e.message),
  });
  const warehouse = warehouses.find(w => w.branchId === Number(branchId));
  const users = (usersQ.data ?? []) as User[];
  const completedLines = lines.filter(line =>
    line.productId &&
    line.unit.trim() &&
    Number(line.quantity) > 0
  );
  const totalQty = completedLines.reduce((sum, line) => sum + Math.max(0, Number(line.quantity) || 0), 0);
  const totalValue = completedLines.reduce((sum, line) => sum + Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.unitCost) || 0), 0);

  const reset = () => {
    setBranchId(""); setSupplierId(""); setReceiverUserId(""); setIssueDate(today());
    setBasedOn(""); setSourceNumber(""); setSupplierDoc(""); setSupplierDocDate("");
    setNotes(""); setDocumentNumber(""); setJournalId(null); setLines([emptyLine()]); setIsDirty(false);
  };
  const close = () => requestClose(onClose);
  useEffect(() => {
    registerClose?.(close);
  }, [registerClose, close]);
  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".supply-receipt-window")) return;
      event.preventDefault();
      requestClose(onClose);
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [onClose, open, requestClose]);
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
  const selectProduct = useCallback((index: number, product: Product) => {
    const unit = product.unit ?? "وحدة";
    const duplicate = lines.some((line, i) => i !== index && line.productId === product.id && line.unit === unit && !line.batchNumber && !line.expiryDate);
    if (duplicate) { toast.info("الصنف موجود بنفس الوحدة والتشغيلة والتاريخ"); return; }
    setLines(current => {
      const next = current.map((line, i) => i === index ? {
        ...line, productId: product.id, productCode: product.code ?? product.barcode ?? "",
        productName: product.name, unit, quantity: line.quantity || "1",
        unitCost: product.purchasePrice ?? product.costPrice ?? "0",
      } : line);
      return ensureSingleTrailingBlank(index === current.length - 1 ? [...next, emptyLine()] : next, emptyLine);
    });
    setIsDirty(true);
     requestAnimationFrame(() => cellRefs.current.get(`${index}-2`)?.focus());
  }, [lines]);
  const addBlankAfter = (index: number) => {
    setLines(current => {
      if (index !== current.length - 1 || !lineHasContent(current[index])) return current;
      return ensureSingleTrailingBlank([...current, emptyLine()], emptyLine);
    });
    requestAnimationFrame(() => cellRefs.current.get(`${index + 1}-1`)?.focus());
  };
  const updateLine = (index: number, key: keyof Line, value: string) => {
    const safe = key === "quantity" || key === "unitCost" ? value.replace(/[^\d.]/g, "") : value;
    setLines(current => current.map((line, i) => i === index ? {
      ...line,
      [key]: safe,
      ...(key === "productCode" || key === "productName"
        ? { productId: undefined }
        : {}),
    } : line));
    setIsDirty(true);
  };
  const deleteLine = (index: number) => {
    setLines(current => ensureSingleTrailingBlank(current.filter((_, i) => i !== index), emptyLine));
    setIsDirty(true);
    requestAnimationFrame(() => {
      const target = Math.min(Math.max(0, index), Math.max(0, lines.length - 2));
      cellRefs.current.get(`${target}-0`)?.focus();
    });
  };
  const insertLine = (index: number) => {
    setLines(current => insertBlankLine(current, index, emptyLine));
    setIsDirty(true);
    requestAnimationFrame(() => cellRefs.current.get(`${index}-0`)?.focus());
  };
  const notifyInvalidProduct = useCallback(() => {
    toast.error("كود الصنف غير موجود");
  }, []);
  const handleCellKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, row: number, column: number) => {
    const lastRow = row === lines.length - 1;
    const lastColumn = column === editableColumns.length - 1;
    if ((event.key === "Enter" || event.key === "Tab") && lastRow && !lineHasContent(lines[row])) {
      event.preventDefault();
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      if (event.shiftKey) {
        if (column > 0) cellRefs.current.get(`${row}-${column - 1}`)?.focus();
        else if (row > 0) cellRefs.current.get(`${row - 1}-${editableColumns.length - 1}`)?.focus();
      } else if (!lastColumn) {
        cellRefs.current.get(`${row}-${column + 1}`)?.focus();
      } else if (lastRow) {
        addBlankAfter(row);
      } else {
        cellRefs.current.get(`${row + 1}-0`)?.focus();
      }
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const target = row + (event.key === "ArrowUp" ? -1 : 1);
      if (target >= 0 && target < lines.length) cellRefs.current.get(`${target}-${column}`)?.focus();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const target = column + (event.key === "ArrowLeft" ? 1 : -1);
      if (target >= 0 && target < editableColumns.length) { event.preventDefault(); cellRefs.current.get(`${row}-${target}`)?.focus(); }
    }
  };
  useEffect(() => {
    if (!open) return;
    const onGridShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey || (event.key !== "Delete" && event.key !== "Insert")) return;
      const target = event.target as HTMLElement | null;
      const row = target?.closest<HTMLElement>("[data-supply-row]");
      if (!row || !target?.closest(".supply-receipt-grid")) return;
      const index = Number(row.dataset.supplyRow);
      if (!Number.isInteger(index)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Delete") deleteLine(index);
      else insertLine(index);
    };
    document.addEventListener("keydown", onGridShortcut, true);
    return () => document.removeEventListener("keydown", onGridShortcut, true);
  }, [open, lines.length]);
  const save = async () => {
    if (!branchId || !warehouse) throw new Error("اختر فرعًا مرتبطًا بمخزن");
    if (!documentNumber || !journalId) throw new Error("انتظر توليد رقم السند");
    const partial = lines.findIndex(line => !line.productId && lineHasContent(line));
    if (partial >= 0) throw new Error(`أكمل أو امسح بيانات السطر ${partial + 1}`);
    const savedLines = lines.filter((line): line is Line & { productId: number } => typeof line.productId === "number");
    if (!savedLines.length) throw new Error("أضف صنفًا واحدًا على الأقل");
    const bad = savedLines.findIndex(line =>
      !line.unit.trim() ||
      Number(line.quantity) <= 0 ||
      Number(line.unitCost) < 0
    );
    if (bad >= 0) throw new Error(`تحقق من الكمية والسعر في السطر ${bad + 1}`);
    await create.mutateAsync({
      type: "receipt", warehouseId: warehouse.id, branchId: Number(branchId),
      voucherNumber: documentNumber, sourceJournalId: journalId,
      supplierId: supplierId ? Number(supplierId) : undefined,
      receiverUserId: receiverUserId ? Number(receiverUserId) : undefined,
      voucherDate: issueDate, sourceDocType: basedOn || undefined,
      sourceDocNumber: sourceNumber || undefined, notes: notes || undefined,
        items: savedLines.map(line => ({
        productId: line.productId, productName: line.productName, quantity: line.quantity,
        unitCost: line.unitCost, totalCost: (Number(line.quantity) * Number(line.unitCost)).toFixed(4),
        productCode: line.productCode, unit: line.unit, batchNumber: line.batchNumber || undefined,
        expiryDate: line.expiryDate || undefined,
      })),
    });
  };
  const actions = useMemo<ToolbarActionMap>(() => ({
    save: { supported: true, stateEnabled: !create.isPending && !reserving, loading: create.isPending, onClick: async () => { try { await save(); } catch (e) { toast.error(e instanceof Error ? e.message : "تعذر حفظ السند"); } } },
    draft: { supported: false }, new: { supported: true, stateEnabled: !create.isPending, onClick: () => { if (isDirty) { toast.info("احفظ السند أو أغلق النافذة أولًا"); return; } reset(); } },
    duplicate: { supported: false }, tools: { supported: true }, edit: { supported: false }, delete: { supported: false },
    first: { supported: false }, previous: { supported: false }, next: { supported: false }, last: { supported: false },
    approve: { supported: false }, cancel: { supported: false }, preview: { supported: true, onClick: previewFocusedEntity }, send: { supported: false },
    print: { supported: false }, exit: { supported: true, onClick: close },
  }), [close, create.isPending, isDirty, previewFocusedEntity, reserving, save]);
  useToolbarActions(actions, undefined, create.isPending ? "save" : undefined);

  if (!open) return null;
  return (
    <div className="supply-receipt-window" dir="rtl">
        <div className="supply-receipt-subtitle">سند جديد <span>{isDirty ? "تعديلات غير محفوظة" : "جاهز"}</span></div>
        <div className="supply-receipt-scroll">
          <div className="supply-receipt-main-layout">
            <div className="supply-receipt-materials">
              <div className="supply-receipt-materials-title">
                <span>مواد سند التوريد</span>
              </div>
              <div className="supply-receipt-grid-wrapper">
                <table className="supply-receipt-grid">
                  <thead><tr><th>م</th><th>رقم الصنف</th><th>اسم الصنف</th><th>الوحدة</th><th>الكمية</th><th>سعر الوحدة</th><th>رقم التشغيلة</th><th>تاريخ الانتهاء</th><th /></tr></thead>
                   <tbody>{lines.map((line, i) => <tr data-supply-row={i} key={`${i}-${line.productId ?? "empty"}`}><td>{i + 1}</td>
                      <td className="product-code-cell">
                       <ProductLookupCell
                         value={line.productCode}
                         placeholder="كود الصنف"
                         products={products}
                         inputRef={el => { if (el) cellRefs.current.set(`${i}-0`, el); }}
                         className="supply-product-lookup-input"
                         data-focused-entity-type={line.productId ? "product" : undefined}
                         data-focused-entity-id={line.productId}
                         onChange={value => updateLine(i, "productCode", value)}
                         onSelect={product => selectProduct(i, product)}
                         displayValue={product => product.code ?? product.barcode ?? ""}
                         onInvalid={notifyInvalidProduct}
                         onNavigate={event => handleCellKeyDown(event, i, 0)}
                       />
                    </td>
                     <td className="product-name product-name-cell">
                        <ProductLookupCell
                          value={line.productName}
                          placeholder="ابحث باسم الصنف..."
                          products={products}
                          inputRef={el => { if (el) cellRefs.current.set(`${i}-1`, el); }}
                          className="supply-product-lookup-input"
                          onChange={value => updateLine(i, "productName", value)}
                          onSelect={product => selectProduct(i, product)}
                          displayValue={product => product.name}
                          onInvalid={notifyInvalidProduct}
                          onNavigate={event => handleCellKeyDown(event, i, 1)}
                        />
                     </td>
                     <td><input ref={el => { if (el) cellRefs.current.set(`${i}-2`, el); }} value={line.unit} placeholder="وحدة" onChange={e => updateLine(i, "unit", e.target.value)} onKeyDown={e => handleCellKeyDown(e, i, 2)} /></td>
                     <td><input ref={el => { if (el) cellRefs.current.set(`${i}-3`, el); }} className="numeric-input" type="text" inputMode="decimal" value={line.quantity} onChange={e => updateLine(i, "quantity", e.target.value)} onKeyDown={e => handleCellKeyDown(e, i, 3)} /></td>
                     <td><input ref={el => { if (el) cellRefs.current.set(`${i}-4`, el); }} className="numeric-input" type="text" inputMode="decimal" value={line.unitCost} onChange={e => updateLine(i, "unitCost", e.target.value)} onKeyDown={e => handleCellKeyDown(e, i, 4)} /></td>
                     <td><input ref={el => { if (el) cellRefs.current.set(`${i}-5`, el); }} value={line.batchNumber} onChange={e => updateLine(i, "batchNumber", e.target.value)} onKeyDown={e => handleCellKeyDown(e, i, 5)} /></td>
                     <td><DateSegmentInput className="supply-receipt-line-date" standalone value={line.expiryDate} onChange={v => updateLine(i, "expiryDate", v)} onNavigate={direction => {
                       const target = direction === "previous" ? `${i}-5` : i === lines.length - 1 ? undefined : `${i + 1}-0`;
                      if (target) cellRefs.current.get(target)?.focus();
                      else addBlankAfter(i);
                    }} /></td>
                    <td><button className="remove-line" tabIndex={-1} onClick={() => deleteLine(i)}>×</button></td>
                   </tr>)}<tr className="supply-receipt-grid-spacer" aria-hidden="true"><td colSpan={9} /></tr></tbody>
                </table>
              </div>
              <div className="supply-receipt-totals"><span>إجمالي عدد الأصناف: {completedLines.length}</span><span>إجمالي الكمية: <b dir="ltr">{totalQty.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</b></span><span>إجمالي القيمة: <b dir="ltr">{totalValue.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</b> ريال سعودي</span></div>
            </div>
            <div className="supply-receipt-header-side">
              <div className="supply-receipt-card">
              <Field label="الفرع" required><select value={branchId} onChange={e => void chooseBranch(e.target.value)}><option value="">اختر الفرع</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
              <Field label="رقم المستند"><input readOnly value={reserving ? "جارٍ حجز الرقم..." : documentNumber || "يظهر بعد اختيار الفرع"} /></Field>
              <Field label="المخزن المستلم"><input readOnly value={warehouse?.name ?? ""} placeholder="يحدد تلقائيًا من الفرع" /></Field>
              <Field label="تاريخ التحرير" required><DateSegmentInput className="supply-receipt-date-field" standalone value={issueDate} onChange={v => { setIssueDate(v); setIsDirty(true); }} /></Field>
              <Field label="بناءً على"><select value={basedOn} onChange={e => { setBasedOn(e.target.value); setIsDirty(true); }}><option value="">بدون</option><option value="purchase_order">أمر شراء</option><option value="purchase_invoice">فاتورة مشتريات</option></select></Field>
               <Field label="رقم المستند"><input value={sourceNumber} disabled={!basedOn} onChange={e => { setSourceNumber(e.target.value); setIsDirty(true); }} placeholder={basedOn ? "رقم المستند" : "اختر النوع أولًا"} /></Field>
              <Field label="نوع السند"><input readOnly value="سند توريد مخزني" /></Field>
              </div>
              <div className="supply-receipt-card supply-receipt-supplier-card">
              <Field label="المورد"><select value={supplierId} onChange={e => { setSupplierId(e.target.value); setIsDirty(true); }}><option value="">اختر المورد</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
              <Field label="مسؤول الاستلام"><select value={receiverUserId} onChange={e => { setReceiverUserId(e.target.value); setIsDirty(true); }}><option value="">اختر المستخدم</option>{users.map(u => <option key={u.id} value={u.id}>{u.name || u.username}</option>)}</select></Field>
              <Field label="رقم مستند المورد"><input value={supplierDoc} onChange={e => { setSupplierDoc(e.target.value); setIsDirty(true); }} /></Field>
              <Field label="تاريخ مستند المورد"><DateSegmentInput className="supply-receipt-date-field" standalone value={supplierDocDate} onChange={v => { setSupplierDocDate(v); setIsDirty(true); }} /></Field>
              <Field label="ملاحظة" alignStart><textarea rows={3} value={notes} onChange={e => { setNotes(e.target.value); setIsDirty(true); }} /></Field>
              </div>
            </div>
          </div>
        </div>
      <UnsavedChangesDialog open={confirmOpen} onSave={() => confirmSave(save)} onDiscard={confirmDiscard} onCancel={confirmCancel} isSaving={create.isPending} />
    </div>
  );
}

function Field({ label, required, alignStart, children }: { label: string; required?: boolean; alignStart?: boolean; children: React.ReactNode }) {
  return <label className={`supply-receipt-field${alignStart ? " start" : ""}`}><span>{label}{required ? " *" : ""}</span>{children}</label>;
}
