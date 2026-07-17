import { useState, useCallback, useRef } from "react";

interface Options {
  isDirty: boolean;
}

export function useUnsavedChangesGuard({ isDirty }: Options) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const afterCloseRef = useRef<(() => void) | null>(null);

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

  const confirmSave = useCallback((onSave: () => void) => {
    setConfirmOpen(false);
    afterCloseRef.current = null;
    onSave();
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

  return { confirmOpen, requestClose, confirmSave, confirmDiscard, confirmCancel };
}
