import { useState, useCallback, useRef, useEffect } from "react";
import { useTabManagerSafe, useTabScopeSafe } from "@/core/contexts/TabManagerContext";

interface Options {
  isDirty: boolean;
}

export function useUnsavedChangesGuard({ isDirty }: Options) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const afterCloseRef = useRef<(() => void) | null>(null);
  const isDirtyRef = useRef(isDirty);
  const tabManager = useTabManagerSafe();
  const tabId = useTabScopeSafe();
  isDirtyRef.current = isDirty;

  const requestClose = useCallback(
    (afterClose?: () => void) => {
      if (!isDirtyRef.current) {
        afterClose?.();
        return;
      }
      afterCloseRef.current = afterClose ?? null;
      setConfirmOpen(true);
    },
    []
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

  // The context value changes when another tab changes, but the registration
  // function itself is stable. Do not use the whole context object here:
  // re-registering on every provider render makes the dirty-id list oscillate
  // during modal mounts.
  const registerTabCloseGuard = tabManager?.registerTabCloseGuard;
  useEffect(() => {
    if (!registerTabCloseGuard || !tabId) return;
    return registerTabCloseGuard(tabId, requestClose, isDirty);
  }, [isDirty, requestClose, registerTabCloseGuard, tabId]);

  return { confirmOpen, requestClose, confirmSave, confirmDiscard, confirmCancel };
}
