/**
 * useDocumentNavigation — تنقل مركزي بين سجلات المستندات (الأول/السابق/التالي/الأخير).
 *
 * - يعمل حتى من حالة فاتورة جديدة فارغة.
 * - عند وجود تعديلات غير محفوظة يعرض حوارًا بخيارات:
 *   حفظ كمسودة / تجاهل التعديلات / إلغاء التنقل.
 * - يحسب حالة الأزرار بناءً على قائمة السجلات والموقع الحالي.
 */
import { useState, useCallback, useMemo } from "react";
import type { CommandHandlers } from "./UnifiedCommandSystem";

interface UseDocumentNavigationOptions<T extends { id: number }> {
  records: T[] | undefined;
  currentId: number | null;
  setCurrentId: (id: number | null) => void;
  isDirty: boolean;
  /** يحدد ما إذا كان النموذج الحالي فارغًا (لا توجد تعديلات يجب حمايتها) */
  isEmpty: () => boolean;
  /** يُستدعى عند اختيار "حفظ كمسودة" من حوار التنقل */
  saveAsDraft?: () => void | Promise<void>;
  /** يُستدعى قبل الانتقال الفعلي (مثل تعيين وضع العرض) */
  onBeforeNavigate?: () => void;
}

export interface DocumentNavigationResult {
  handlers: Pick<CommandHandlers, "first" | "previous" | "next" | "last">;
  /** هل يوجد سجل واحد على الأقل؟ */
  hasRecord: boolean;
  /** هل يوجد سجل سابق؟ (يُعطّل فقط عند الوصول للأول) */
  hasPrevious: boolean;
  /** هل يوجد سجل تالي؟ (يُعطّل فقط عند الوصول للأخير) */
  hasNext: boolean;
  /** حالة فتح حوار التعديلات غير المحفوظة */
  showUnsavedDialog: boolean;
  /** مكونات واجهة الحوار (زر حفظ كمسودة / تجاهل / إلغاء) */
  unsavedDialogActions: {
    onSaveAsDraft: () => void;
    onDiscard: () => void;
    onCancel: () => void;
  };
  /** مؤشر جاري الحفظ كمسودة */
  isSavingDraft: boolean;
}

export function useDocumentNavigation<T extends { id: number }>(
  options: UseDocumentNavigationOptions<T>,
): DocumentNavigationResult {
  const { records, currentId, setCurrentId, isDirty, isEmpty, saveAsDraft, onBeforeNavigate } = options;

  const sortedIds = useMemo(() => {
    if (!records) return [];
    return [...records].sort((a, b) => a.id - b.id).map((r) => r.id);
  }, [records]);

  const hasRecord = sortedIds.length > 0;
  const currentIndex = currentId ? sortedIds.indexOf(currentId) : -1;

  // حالة جديدة فارغة: يمكن التنقل في كلا الاتجاهين (Previous → الأخير، Next → الأول)
  const hasPrevious = hasRecord && (currentId === null || currentIndex > 0);
  const hasNext = hasRecord && (currentId === null || currentIndex < sortedIds.length - 1);

  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [pendingTargetId, setPendingTargetId] = useState<number | null>(null);

  const doNavigate = useCallback((targetId: number | null) => {
    onBeforeNavigate?.();
    setCurrentId(targetId);
    setPendingTargetId(null);
    setShowUnsavedDialog(false);
  }, [onBeforeNavigate, setCurrentId]);

  const requestNavigate = useCallback((targetId: number | null) => {
    // إذا كانت الفاتورة الجديدة فارغة: انتقل مباشرة دون سؤال
    if (!isDirty || isEmpty()) {
      doNavigate(targetId);
      return;
    }
    // إذا كانت هناك تعديلات: اعرض الحوار
    setPendingTargetId(targetId);
    setShowUnsavedDialog(true);
  }, [isDirty, isEmpty, doNavigate]);

  const handleSaveAsDraft = useCallback(async () => {
    if (!saveAsDraft) {
      // لا يوجد معالج مسودة: تعامل كتجاهل
      doNavigate(pendingTargetId);
      return;
    }
    setIsSavingDraft(true);
    try {
      await saveAsDraft();
      doNavigate(pendingTargetId);
    } finally {
      setIsSavingDraft(false);
    }
  }, [saveAsDraft, pendingTargetId, doNavigate]);

  const handleDiscard = useCallback(() => {
    doNavigate(pendingTargetId);
  }, [pendingTargetId, doNavigate]);

  const handleCancel = useCallback(() => {
    setPendingTargetId(null);
    setShowUnsavedDialog(false);
  }, []);

  const handlers = useMemo<Pick<CommandHandlers, "first" | "previous" | "next" | "last">>(() => ({
    first: () => {
      if (!hasRecord) return;
      requestNavigate(sortedIds[0] ?? null);
    },
    previous: () => {
      if (!hasPrevious) return;
      if (currentId === null) {
        // من فاتورة جديدة: الانتقال للأخير
        requestNavigate(sortedIds[sortedIds.length - 1] ?? null);
      } else {
        const idx = sortedIds.indexOf(currentId);
        requestNavigate(idx > 0 ? sortedIds[idx - 1] : null);
      }
    },
    next: () => {
      if (!hasNext) return;
      if (currentId === null) {
        // من فاتورة جديدة: الانتقال للأول
        requestNavigate(sortedIds[0] ?? null);
      } else {
        const idx = sortedIds.indexOf(currentId);
        requestNavigate(idx >= 0 && idx < sortedIds.length - 1 ? sortedIds[idx + 1] : null);
      }
    },
    last: () => {
      if (!hasRecord) return;
      requestNavigate(sortedIds[sortedIds.length - 1] ?? null);
    },
  }), [hasRecord, hasPrevious, hasNext, sortedIds, currentId, requestNavigate]);

  return {
    handlers,
    hasRecord,
    hasPrevious,
    hasNext,
    showUnsavedDialog,
    unsavedDialogActions: {
      onSaveAsDraft: handleSaveAsDraft,
      onDiscard: handleDiscard,
      onCancel: handleCancel,
    },
    isSavingDraft,
  };
}
