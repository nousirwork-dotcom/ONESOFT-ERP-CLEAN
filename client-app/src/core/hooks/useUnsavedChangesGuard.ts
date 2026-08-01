import { useState, useCallback, useRef, useEffect } from "react";
import { useTabManagerSafe, useTabScopeSafe } from "@/core/contexts/TabManagerContext";

interface Options {
  isDirty: boolean;
}

export function useUnsavedChangesGuard({ isDirty }: Options) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const afterCloseRef = useRef<(() => void) | null>(null);
  const tabManager = useTabManagerSafe();
  const tabId = useTabScopeSafe();

  const requestClose = useCallback(
    (afterClose?: () => void) => {
      if (!isDirty) {
        afterClose?.();
        return;
      }
      afterCloseRef.current = afterClose ?? null;
      setConfirmOpen(true);
    },
    [isDirty]
  );

  const confirmSave = useCallback(async (onSave: () => Promise<void> | void) => {
    try {
      await onSave();
      const fn = afterCloseRef.current;
      afterCloseRef.current = null;
      setConfirmOpen(false);
      fn?.(); // execute deferred exit action after successful save
    } catch {
      // save failed — keep guard dialog open so user can retry or discard
    }
  }, []);

  const confirmDiscard = useCallback(() => {
    const fn = afterCloseRef.current;
    afterCloseRef.current = null;
    setConfirmOpen(false);
    fn?.();
  }, []);

  const confirmCancel = useCallback(() => {
    afterCloseRef.current = null;
    setConfirmOpen(false);
  }, []);

  useEffect(() => {
    if (!tabManager || !tabId) return;
    return tabManager.registerTabCloseGuard(tabId, requestClose, isDirty);
  }, [isDirty, requestClose, tabId, tabManager]);

  return { confirmOpen, requestClose, confirmSave, confirmDiscard, confirmCancel };
}
