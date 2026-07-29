import { useState } from "react";
import { X } from "lucide-react";
import type { ToolbarToolItem } from "./toolbar.types";
import { t } from "@/shared/lib/translations";

export type DocumentToolsAction =
  | "reverse"
  | "post"
  | "unpost"
  | "suspend"
  | "related"
  | "activity"
  | "attachments";

export interface DocumentToolsMenuProps {
  documentType: string;
  documentTypeLabel: string;
  documentId?: number | null;
  documentNumber: string;
  documentStatus: string;
  isPosted: boolean;
  isSaved: boolean;
  isAr: boolean;
  onAction?: (action: DocumentToolsAction) => void;
}

type DialogState = DocumentToolsAction | null;

const labels = {
  ar: {
    reverse: "عكس المستند",
    post: "ترحيل المستند",
    unpost: "إلغاء ترحيل المستند",
    suspend: "تعليق ترحيل المستند",
    related: "مستندات مرتبطة",
    activity: "نشاط المستخدمين",
    attachments: "إرفاق المستندات",
    close: "إغلاق",
    cancel: "إلغاء",
    back: "رجوع",
    continue: "متابعة",
    postConfirm: "ترحيل",
    unpostConfirm: "إلغاء الترحيل",
    suspendConfirm: "تعليق الترحيل",
    currentType: "نوع المستند الحالي",
    number: "رقم المستند",
    status: "حالة المستند",
    reverseTarget: "المستند العكسي الذي سيتم إنشاؤه",
    reverseTargetValue: "مردود مبيعات جديد مرتبط بهذا المستند",
    postWarning: "سيؤدي الترحيل إلى منع تعديل المستند حتى يتم إلغاء الترحيل.",
    reason: "السبب",
    requiredReason: "السبب مطلوب",
    relationType: "نوع العلاقة",
    date: "التاريخ",
    debit: "مدين",
    credit: "دائن",
    open: "فتح",
    user: "المستخدم",
    operation: "العملية",
    time: "الوقت",
    notes: "الملاحظات",
    previous: "القيم السابقة",
    next: "القيم الجديدة",
    addFile: "إضافة ملف",
    fileName: "اسم الملف",
    fileType: "نوع الملف",
    size: "الحجم",
    addedAt: "تاريخ الإضافة",
    description: "الوصف",
    download: "تنزيل",
    delete: "حذف",
    noData: "لا توجد بيانات فعلية مرتبطة بهذا المستند.",
    noActivity: "لا توجد سجلات نشاط فعلية لهذا المستند.",
    noAttachments: "لا توجد مرفقات لهذا المستند.",
    previewOnly: "هذه معاينة فقط. لم يتم تنفيذ أي تغيير محاسبي.",
  },
  en: {
    reverse: "Reverse Document",
    post: "Post Document",
    unpost: "Unpost Document",
    suspend: "Suspend Document Posting",
    related: "Related Documents",
    activity: "User Activity",
    attachments: "Document Attachments",
    close: "Close",
    cancel: "Cancel",
    back: "Back",
    continue: "Continue",
    postConfirm: "Post",
    unpostConfirm: "Unpost",
    suspendConfirm: "Suspend Posting",
    currentType: "Current document type",
    number: "Document number",
    status: "Document status",
    reverseTarget: "Reversal document to be created",
    reverseTargetValue: "New sales return linked to this document",
    postWarning: "Posting will prevent edits until the document is unposted.",
    reason: "Reason",
    requiredReason: "A reason is required",
    relationType: "Relation",
    date: "Date",
    debit: "Debit",
    credit: "Credit",
    open: "Open",
    user: "User",
    operation: "Operation",
    time: "Time",
    notes: "Notes",
    previous: "Previous values",
    next: "New values",
    addFile: "Add file",
    fileName: "File name",
    fileType: "File type",
    size: "Size",
    addedAt: "Added at",
    description: "Description",
    download: "Download",
    delete: "Delete",
    noData: "No actual data is linked to this document.",
    noActivity: "No actual activity records exist for this document.",
    noAttachments: "No attachments exist for this document.",
    previewOnly: "Preview only. No accounting change was executed.",
  },
} as const;

function Modal({
  title,
  children,
  onClose,
  isAr,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  isAr: boolean;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[100001] flex items-center justify-center bg-slate-950/50 p-4"
      dir={isAr ? "rtl" : "ltr"}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className={`w-full ${wide ? "max-w-4xl" : "max-w-lg"} overflow-hidden rounded-lg bg-white shadow-2xl`}>
        <header className="flex items-center justify-between bg-[#406B93] px-4 py-3 text-white">
          <h2 className="text-sm font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="close" className="rounded p-1 hover:bg-white/15">
            <X size={17} />
          </button>
        </header>
        <div className="max-h-[75vh] overflow-y-auto p-4">{children}</div>
      </section>
    </div>
  );
}

export function useDocumentToolsMenu({
  documentType,
  documentTypeLabel,
  documentId,
  documentNumber,
  documentStatus,
  isPosted,
  isSaved,
  isAr,
  onAction,
}: DocumentToolsMenuProps) {
  const text = labels[isAr ? "ar" : "en"];
  const lang = isAr ? "ar" : "en";
  const [dialog, setDialog] = useState<DialogState>(null);
  const [reason, setReason] = useState("");

  const close = () => {
    setDialog(null);
    setReason("");
  };
  const open = (action: DocumentToolsAction) => {
    setDialog(action);
    onAction?.(action);
  };

  const disabledReason = (action: DocumentToolsAction) => {
    if (!isSaved) return isAr ? "يجب حفظ المستند أولًا" : "Save the document first";
    if (action === "post" && isPosted) return isAr ? "المستند مرحّل بالفعل" : "Document is already posted";
    if (action === "unpost" && !isPosted) return isAr ? "المستند غير مرحّل" : "Document is not posted";
    if (action === "suspend" && isPosted) return isAr ? "لا يمكن تعليق مستند مرحّل" : "A posted document cannot be suspended";
    return undefined;
  };

  const toolTranslationKeys = {
    reverse: "tbReverse",
    post: "tbPost",
    unpost: "tbUnpost",
    suspend: "tbSuspendPosting",
    related: "tbRelatedDocs",
    activity: "tbUserActivity",
    attachments: "tbAttachments",
  } as const;
  const toolIds: DocumentToolsAction[] = [
    "reverse", "post", "unpost", "suspend", "related", "activity", "attachments",
  ];
  const tools: ToolbarToolItem[] = toolIds.map((id, index) => ({
    id,
    label: t(lang, toolTranslationKeys[id]),
    enabled: !disabledReason(id as DocumentToolsAction),
    disabledReason: disabledReason(id as DocumentToolsAction),
    separatorBefore: index === 4,
    onClick: () => open(id as DocumentToolsAction),
  }));

  const renderDialog = () => {
    if (!dialog) return null;
    if (dialog === "reverse") {
      return (
        <Modal title={text.reverse} onClose={close} isAr={isAr}>
          <div className="grid gap-3 text-sm">
            <InfoRow label={text.currentType} value={documentTypeLabel} />
            <InfoRow label={text.number} value={documentNumber || "—"} />
            <InfoRow label={text.reverseTarget} value={text.reverseTargetValue} />
            <p className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-800">{text.previewOnly}</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={close} className="rounded border px-4 py-2 text-sm">{text.cancel}</button>
              <button type="button" onClick={close} className="rounded bg-[#406B93] px-4 py-2 text-sm text-white">{text.continue}</button>
            </div>
          </div>
        </Modal>
      );
    }
    if (dialog === "post" || dialog === "unpost") {
      const isUnpost = dialog === "unpost";
      return (
        <Modal title={isUnpost ? text.unpost : text.post} onClose={close} isAr={isAr}>
          <div className="grid gap-3 text-sm">
            <InfoRow label={text.number} value={documentNumber || "—"} />
            <InfoRow label={text.status} value={documentStatus || "—"} />
            {!isUnpost && <p className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-800">{text.postWarning}</p>}
            <p className="rounded border border-sky-200 bg-sky-50 p-3 text-sky-800">{text.previewOnly}</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={close} className="rounded border px-4 py-2 text-sm">{text.cancel}</button>
              <button type="button" onClick={close} className="rounded bg-[#406B93] px-4 py-2 text-sm text-white">{isUnpost ? text.unpostConfirm : text.postConfirm}</button>
            </div>
          </div>
        </Modal>
      );
    }
    if (dialog === "suspend") {
      return (
        <Modal title={text.suspend} onClose={close} isAr={isAr}>
          <div className="grid gap-3 text-sm">
            <label className="grid gap-1">
              <span className="font-semibold">{text.reason}</span>
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} className="rounded border p-2" autoFocus />
            </label>
            {!reason.trim() && <p className="text-xs text-red-600">{text.requiredReason}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={close} className="rounded border px-4 py-2 text-sm">{text.cancel}</button>
              <button type="button" disabled={!reason.trim()} onClick={close} className="rounded bg-[#406B93] px-4 py-2 text-sm text-white disabled:opacity-50">{text.suspendConfirm}</button>
            </div>
          </div>
        </Modal>
      );
    }
    if (dialog === "related") {
      return (
        <Modal title={text.related} onClose={close} isAr={isAr} wide>
          <EmptyTable message={text.noData} columns={[text.currentType, text.number, text.date, text.relationType, text.status, text.debit, text.credit, text.open]} />
        </Modal>
      );
    }
    if (dialog === "activity") {
      return (
        <Modal title={text.activity} onClose={close} isAr={isAr} wide>
          <EmptyTable message={text.noActivity} columns={[text.user, text.operation, text.date, text.time, text.notes, text.previous, text.next]} />
        </Modal>
      );
    }
    return (
      <Modal title={text.attachments} onClose={close} isAr={isAr} wide>
        <div className="mb-3 flex justify-end">
          <button type="button" disabled={!documentId} className="rounded bg-[#406B93] px-3 py-2 text-sm text-white disabled:opacity-50">{text.addFile}</button>
        </div>
        <EmptyTable message={text.noAttachments} columns={[text.fileName, text.fileType, text.size, text.addedAt, text.user, text.description, text.open, text.download, text.delete]} />
      </Modal>
    );
  };

  return { tools, dialog: renderDialog() };
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 rounded border bg-slate-50 px-3 py-2"><span className="text-slate-500">{label}</span><strong>{value}</strong></div>;
}

function EmptyTable({ message, columns }: { message: string; columns: string[] }) {
  return (
    <div className="overflow-x-auto rounded border">
      <table className="w-full min-w-[680px] text-xs">
        <thead><tr className="bg-slate-100">{columns.map((column) => <th key={column} className="whitespace-nowrap border-b px-2 py-2 text-right">{column}</th>)}</tr></thead>
        <tbody><tr><td colSpan={columns.length} className="px-3 py-10 text-center text-slate-500">{message}</td></tr></tbody>
      </table>
    </div>
  );
}