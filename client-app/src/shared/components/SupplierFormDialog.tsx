import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { trpc } from "@/shared/lib/trpc";
import { UnifiedBottomToolbar } from "@/components/unified-toolbar/UnifiedBottomToolbar";
import type { ToolbarActionMap } from "@/components/unified-toolbar/toolbar.types";
import { useModalAttention } from "@/modules/settings/pages/useModalAttention";
import { useUnsavedChangesGuard } from "@/core/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/shared/components/UnsavedChangesDialog";
import { PartyMainTab } from "@/shared/components/PartyMainTab";

type SupplierRecord = {
  id?: number;
  code?: string | null;
  name?: string | null;
  supplierType?: "individual" | "organization";
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  taxNumber?: string | null;
  registrationNumber?: string | null;
  recordPolicy?: "strict" | "flexible" | "foundation";
  foundationKey?: string | null;
  includeInFoundation?: boolean;
};

interface Props {
  open: boolean;
  editData?: SupplierRecord | null;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY: SupplierRecord = {
  code: "",
  name: "",
  supplierType: "individual",
  phone: "",
  email: "",
  address: "",
  taxNumber: "",
  recordPolicy: "flexible",
  foundationKey: "",
  includeInFoundation: false,
};

export default function SupplierFormDialog({ open, editData, onClose, onSaved }: Props) {
  const [form, setForm] = useState<SupplierRecord>(EMPTY);
  const [isDirty, setIsDirty] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const { contentRef: attentionRef, attractAttention } = useModalAttention();
  const utils = trpc.useUtils();
  const { confirmOpen, requestClose, confirmSave, confirmDiscard, confirmCancel } =
    useUnsavedChangesGuard({ isDirty });

  const create = trpc.suppliers.create.useMutation({
    onSuccess: () => { utils.suppliers.list.invalidate(); toast.success("تم حفظ المورد بنجاح"); onSaved(); },
    onError: e => toast.error(e.message),
  });
  const update = trpc.suppliers.update.useMutation({
    onSuccess: () => { utils.suppliers.list.invalidate(); toast.success("تم حفظ تعديلات المورد"); onSaved(); },
    onError: e => toast.error(e.message),
  });
  const remove = trpc.suppliers.delete.useMutation({
    onSuccess: () => { utils.suppliers.list.invalidate(); toast.success("تم حذف المورد"); onSaved(); },
    onError: e => toast.error(e.message),
  });
  const isPending = create.isPending || update.isPending || remove.isPending;

  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY, ...(editData ?? {}) });
    setIsDirty(false);
  }, [open, editData]);

  const setField = (key: keyof SupplierRecord, value: unknown) => {
    setIsDirty(true);
    setForm(current => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast.error("يجب إدخال اسم المورد");
      throw new Error("validation");
    }
    const commonInput = {
      code: form.code || undefined,
      name: form.name.trim(),
      supplierType: form.supplierType ?? "individual",
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
      taxNumber: form.taxNumber || undefined,
      registrationNumber: form.registrationNumber || undefined,
      recordPolicy: form.recordPolicy,
      foundationKey: form.foundationKey || undefined,
      includeInFoundation: form.includeInFoundation,
    };
    if (editData?.id) {
      await update.mutateAsync({ id: editData.id, ...commonInput });
    } else {
      await create.mutateAsync(commonInput);
    }
  };

  const handleClose = () => { requestClose(onClose); };
  const handleBackdrop = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    setIsShaking(false);
    requestAnimationFrame(() => setIsShaking(true));
    window.setTimeout(() => setIsShaking(false), 350);
    attractAttention();
    modalRef.current?.focus();
  };

  const actions = useMemo<ToolbarActionMap>(() => ({
    save: { supported: true, stateEnabled: !isPending, loading: isPending, onClick: handleSave },
    draft: { supported: false },
    new: {
      supported: true, stateEnabled: !isPending,
      onClick: () => {
        if (isDirty) {
          toast.info("احفظ المورد أو أغلق النافذة أولًا");
          return;
        }
        setForm(EMPTY);
        setIsDirty(false);
      },
    },
    duplicate: { supported: false },
    tools: { supported: true, stateEnabled: !isPending },
    edit: { supported: !!editData?.id, stateEnabled: !isPending, onClick: () => nameRef.current?.focus() },
    delete: {
      supported: !!editData?.id, stateEnabled: !isPending,
      onClick: () => { if (editData?.id && window.confirm(`هل تريد حذف المورد «${form.name ?? ""}»؟`)) remove.mutate({ id: editData.id }); },
    },
    first: { supported: false }, previous: { supported: false },
    next: { supported: false }, last: { supported: false },
    approve: { supported: false }, cancel: { supported: false },
    preview: { supported: false }, send: { supported: false },
    print: { supported: !!editData?.id, onClick: () => window.print() },
    exit: { supported: true, stateEnabled: !isPending, onClick: handleClose },
  }), [editData?.id, form.name, handleClose, handleSave, isDirty, isPending, remove]);

  if (!open) return null;
  const title = editData?.id ? `تعديل المورد — ${form.name ?? ""}` : "إضافة مورد جديد";

  return (
    <div onMouseDown={handleBackdrop} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        ref={node => { modalRef.current = node; attentionRef.current = node; }}
        tabIndex={-1}
        onMouseDown={event => event.stopPropagation()}
        className={`erp-standard-ui customer-form${isShaking ? " customer-modal-window-shake" : ""}`}
        dir="rtl"
        style={{ width: 940, maxWidth: "98vw", height: 620, maxHeight: "calc(100vh - 24px)", minHeight: 620, background: "#f0ede8", border: "2px solid #315f88", boxShadow: "0 8px 28px rgba(20,35,50,.42)", display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 5 }}
      >
        <div style={{ background: "linear-gradient(180deg,#376d9c 0%,#28567f 100%)", minHeight: 31, padding: "4px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ color: "white", fontWeight: 700, fontSize: 12 }}><Users size={15} style={{ verticalAlign: "middle", marginLeft: 6 }} />{title}</span>
          <button type="button" onClick={handleClose} aria-label="إغلاق" style={{ width: 20, height: 18, background: "#c95757", border: "1px solid #8f3030", color: "white", fontSize: 11, fontWeight: 700, cursor: "pointer", borderRadius: 2 }}>×</button>
        </div>
        <div style={{ minHeight: 29, padding: "3px 10px", color: "#68727b", fontSize: 10, background: "#f4f3f0", borderBottom: "1px solid #c7c8c8", display: "flex", justifyContent: "space-between" }}>
          <b>{editData?.id ? "تعديل بيانات المورد" : "إضافة مورد جديد"}</b><span>{editData?.id ? `رقم السجل: ${editData.id}` : "سجل جديد"} • {isDirty ? "تعديلات غير محفوظة" : "جاهز"}</span>
        </div>
        <div style={{ background: "#e5e4e1", borderBottom: "1px solid #9da3a8", display: "flex", flexShrink: 0, paddingRight: 7 }}>
          {["نافذة رئيسية", "عنوان", "التسعير والضوابط", "قنوات الإرسال", "أرصدة", "مشتريات", "مردودات مشتريات"].map(label => <button key={label} type="button" className="customer-tab-button" style={{ padding: "6px 12px 5px", fontSize: 10, fontWeight: 600 }}>{label}</button>)}
        </div>
        <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "10px 12px" }}>
          <PartyMainTab
            entityType="supplier"
            form={{
              code: form.code ?? "",
              name: form.name ?? "",
              partyType: form.supplierType,
              phone: form.phone ?? "",
              email: form.email ?? "",
              taxNumber: form.taxNumber ?? "",
              registrationNumber: form.registrationNumber ?? "",
            }}
            onChange={(key, value) => {
              const mapped = key === "partyType" ? "supplierType" : key;
              setField(mapped as keyof SupplierRecord, value);
            }}
            nameRef={nameRef}
          />
        </div>
        <UnifiedBottomToolbar actions={actions} />
      </div>
      <UnsavedChangesDialog open={confirmOpen} onSave={() => confirmSave(handleSave)} onDiscard={confirmDiscard} onCancel={confirmCancel} isSaving={isPending} />
    </div>
  );
}