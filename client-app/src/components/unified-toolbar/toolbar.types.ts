export type ToolbarActionId =
  | "save"
  | "draft"
  | "new"
  | "duplicate"
  | "tools"
  | "edit"
  | "delete"
  | "first"
  | "previous"
  | "next"
  | "last"
  | "approve"
  | "cancel"
  | "preview"
  | "send"
  | "print"
  | "exit";

export interface ToolbarActionRuntime {
  /**
   * هل الشاشة تدعم هذا الأمر؟
   * الزر لا يختفي عند false، ولكنه يصبح معطلًا.
   */
  supported?: boolean;

  /** صلاحية المستخدم. */
  allowed?: boolean;

  /** هل حالة السجل تسمح بتنفيذ الأمر؟ */
  stateEnabled?: boolean;

  /** سبب تعطيل الزر. */
  disabledReason?: string;

  /** هل الأمر قيد التنفيذ؟ */
  loading?: boolean;

  /** الوظيفة الحقيقية التي ستنفذها الشاشة. */
  onClick?: () => void | Promise<void>;
}

export type ToolbarActionMap = Partial<
  Record<ToolbarActionId, ToolbarActionRuntime>
>;

export interface ToolbarToolItem {
  id: string;
  label: string;
  enabled?: boolean;
  disabledReason?: string;
  separatorBefore?: boolean;
  onClick?: () => void | Promise<void>;
}
