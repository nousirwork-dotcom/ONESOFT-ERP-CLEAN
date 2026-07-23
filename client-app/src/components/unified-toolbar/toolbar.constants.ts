import {
  Ban,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  FilePlus2,
  FileText,
  Link2,
  LogOut,
  Paperclip,
  Pencil,
  Printer,
  RotateCcw,
  Save,
  Send,
  Settings2,
  ShieldCheck,
  Trash2,
  Undo2,
  Upload,
  UsersRound,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { ToolbarActionId, ToolbarToolItem } from "./toolbar.types";

export interface ToolbarDefinition {
  id: ToolbarActionId;
  label: string;
  shortcut?: string;
  icon: LucideIcon;
  tone?: "default" | "primary" | "danger";
}

export const TOOLBAR_ITEMS: ToolbarDefinition[] = [
  { id: "save", label: "حفظ", shortcut: "F10", icon: Save, tone: "primary" },
  { id: "draft", label: "مسودة", shortcut: "Ctrl+D", icon: FileText },
  { id: "new", label: "جديد", shortcut: "F3", icon: FilePlus2 },
  { id: "duplicate", label: "نسخة", shortcut: "Ctrl+K", icon: Copy },
  { id: "tools", label: "أدوات", shortcut: "Ctrl+T", icon: Settings2 },
  { id: "edit", label: "تعديل", shortcut: "F4", icon: Pencil },
  { id: "delete", label: "حذف", shortcut: "Ctrl+Delete", icon: Trash2, tone: "danger" },
  { id: "first", label: "الأول", shortcut: "Ctrl+Home", icon: ChevronFirst },
  { id: "previous", label: "السابق", shortcut: "PageUp", icon: ChevronRight },
  { id: "next", label: "التالي", shortcut: "PageDown", icon: ChevronLeft },
  { id: "last", label: "الأخير", shortcut: "Ctrl+End", icon: ChevronLast },
  { id: "approve", label: "اعتماد", shortcut: "Ctrl+F11", icon: ShieldCheck },
  { id: "unapprove", label: "إلغاء", shortcut: "F7", icon: XCircle },
  { id: "preview", label: "معاينة", icon: Eye },
  { id: "send", label: "إرسال", icon: Send },
  { id: "print", label: "طباعة", shortcut: "Ctrl+P", icon: Printer },
  { id: "exit", label: "خروج", shortcut: "F9", icon: LogOut },
];

export const DEFAULT_DOCUMENT_TOOLS: ToolbarToolItem[] = [
  { id: "reverse", label: "عكس المستند" },
  { id: "post", label: "ترحيل المستند" },
  { id: "unpost", label: "إلغاء ترحيل المستند" },
  { id: "suspend", label: "تعليق ترحيل المستند" },
  { id: "related", label: "مستندات مرتبطة", separatorBefore: true },
  { id: "activity", label: "نشاط المستخدمين" },
  { id: "attachments", label: "إرفاق المستندات" },
];

export const DEFAULT_USER_TOOLS: ToolbarToolItem[] = [
  { id: "change-password", label: "تغيير كلمة المرور" },
  { id: "activity", label: "نشاط المستخدم" },
  { id: "related", label: "المستندات المرتبطة", separatorBefore: true },
  { id: "attachments", label: "إرفاق مستندات" },
];

export function getToolIcon(id: string): LucideIcon {
  switch (id) {
    case "reverse":
      return RotateCcw;
    case "post":
      return Upload;
    case "unpost":
      return Undo2;
    case "suspend":
      return Ban;
    case "related":
      return Link2;
    case "activity":
      return UsersRound;
    case "attachments":
      return Paperclip;
    default:
      return Settings2;
  }
}
