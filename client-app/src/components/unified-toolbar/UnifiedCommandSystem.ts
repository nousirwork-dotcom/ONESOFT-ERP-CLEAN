/**
 * UnifiedCommandSystem — نظام أوامر الشاشات المركزي
 *
 * الشاشة تسجّل:
 *   handlers    - الوظائف فقط (save, new, delete, ...)
 *   screenState - وضع السجل الحالي (mode / isDirty / hasRecord / ...)
 *
 * النظام يحسب حالة كل زر تلقائياً ويُنتج ToolbarActionMap جاهزاً للشريط.
 * منطق العمل الداخلي يبقى داخل handlers ولا يتسرب إلى هذا الملف.
 */

import type { ToolbarActionMap } from "./toolbar.types";

export type CommandId =
  | "save" | "draft" | "new" | "duplicate" | "tools"
  | "edit" | "delete"
  | "first" | "previous" | "next" | "last"
  | "approve" | "cancel"
  | "preview" | "send" | "print" | "exit";

/** Map من معرّف الأمر إلى الوظيفة المقابلة في الشاشة */
export type CommandHandlers = Partial<Record<CommandId, () => void | Promise<void>>>;

/** حالة السجل الحالية — تُمرَّر من الشاشة مُغلَّفةً في useMemo */
export interface ScreenState {
  mode: "new" | "edit" | "view";
  isDirty: boolean;
  /**
   * قابلية الحفظ مفصولة عن الوضع —
   * بعض الشاشات تشترط isDirty && !mobileError
   */
  isSaveable: boolean;
  hasRecord: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  isApproved: boolean;
  isBusy: boolean;
  permissions?: {
    canCreate?:  boolean;
    canEdit?:    boolean;
    canDelete?:  boolean;
    canApprove?: boolean;
    canPrint?:   boolean;
    canPreview?: boolean;
    canSend?:    boolean;
  };
}

/**
 * دالة خالصة تحسب حالة كل زر بناءً على handlers وstate.
 * أي CommandId غير موجود في handlers يُعيد { supported: false }.
 */
export function computeButtonStates(
  handlers: CommandHandlers,
  state: ScreenState,
): ToolbarActionMap {
  const perm       = state.permissions ?? {};
  const canCreate  = perm.canCreate  !== false;
  const canEdit    = perm.canEdit    !== false;
  const canDelete  = perm.canDelete  !== false;
  const canApprove = perm.canApprove !== false;
  const canPrint   = perm.canPrint   !== false;
  const canPreview = perm.canPreview !== false;
  const canSend    = perm.canSend    !== false;

  const { mode, isDirty, isSaveable, hasRecord, hasPrevious, hasNext, isApproved, isBusy } = state;
  const has = (id: CommandId) => typeof handlers[id] === "function";

  return {
    save: has("save") ? {
      supported: true,
      allowed: mode === "new" ? canCreate : canEdit,
      stateEnabled: isSaveable && !isBusy,
      loading: isBusy,
      onClick: handlers.save,
    } : { supported: false },

    draft: has("draft") ? {
      supported: true,
      stateEnabled: isDirty && !isBusy,
      onClick: handlers.draft,
    } : { supported: false },

    new: has("new") ? {
      supported: true,
      allowed: canCreate,
      stateEnabled: true,
      onClick: handlers.new,
    } : { supported: false },

    duplicate: has("duplicate") ? {
      supported: true,
      allowed: canCreate,
      stateEnabled: hasRecord && !isBusy,
      disabledReason: !hasRecord ? "احفظ السجل اولا لنسخه" : undefined,
      onClick: handlers.duplicate,
    } : { supported: false },

    // tools يُعالَج في useRegisterCommands حسب وجود قائمة أدوات
    tools: { supported: false },

    edit: has("edit") ? {
      supported: true,
      allowed: canEdit,
      stateEnabled: hasRecord && mode === "view",
      disabledReason: mode !== "view"
        ? "السجل في وضع التعديل"
        : !hasRecord ? "لا يوجد سجل" : undefined,
      onClick: handlers.edit,
    } : { supported: false },

    delete: has("delete") ? {
      supported: true,
      allowed: canDelete,
      stateEnabled: hasRecord && !isBusy,
      disabledReason: !hasRecord ? "لا يوجد سجل للحذف" : undefined,
      onClick: handlers.delete,
    } : { supported: false },

    first: has("first") ? {
      supported: true,
      stateEnabled: hasRecord,
      disabledReason: !hasRecord ? "لا توجد سجلات" : undefined,
      onClick: handlers.first,
    } : { supported: false },

    previous: has("previous") ? {
      supported: true,
      stateEnabled: hasPrevious,
      disabledReason: "لا يوجد سجل سابق",
      onClick: handlers.previous,
    } : { supported: false },

    next: has("next") ? {
      supported: true,
      stateEnabled: hasNext,
      disabledReason: "لا يوجد سجل تال",
      onClick: handlers.next,
    } : { supported: false },

    last: has("last") ? {
      supported: true,
      stateEnabled: hasRecord,
      disabledReason: !hasRecord ? "لا توجد سجلات" : undefined,
      onClick: handlers.last,
    } : { supported: false },

    approve: has("approve") ? {
      supported: true,
      allowed: canApprove,
      stateEnabled: hasRecord && !isApproved && !isBusy,
      disabledReason: !hasRecord
        ? "احفظ السجل اولا"
        : isApproved ? "السجل معتمد بالفعل" : undefined,
      onClick: handlers.approve,
    } : { supported: false },

  cancel: has("cancel") ? {
      supported: true,
      allowed: canApprove,
      stateEnabled: hasRecord && isApproved && !isBusy,
      disabledReason: !hasRecord
        ? "احفظ السجل اولا"
        : !isApproved ? "السجل غير معتمد" : undefined,
      onClick: handlers.cancel,
    } : { supported: false },

    preview: has("preview") ? {
      supported: true,
      allowed: canPreview,
      // The centralized focused-entity registry decides whether a linked
      // record exists. This also allows previewing a linked record from a
      // new/unsaved document without saving or closing the current screen.
      stateEnabled: true,
      onClick: handlers.preview,
    } : { supported: false },

    send: has("send") ? {
      supported: true,
      allowed: canSend,
      stateEnabled: hasRecord,
      disabledReason: !hasRecord ? "احفظ السجل اولا" : undefined,
      onClick: handlers.send,
    } : { supported: false },

    print: has("print") ? {
      supported: true,
      allowed: canPrint,
      stateEnabled: hasRecord,
      disabledReason: !hasRecord ? "احفظ السجل اولا" : undefined,
      onClick: handlers.print,
    } : { supported: false },

    exit: has("exit") ? {
      supported: true,
      stateEnabled: true,
      onClick: handlers.exit,
    } : { supported: false },
  };
}
