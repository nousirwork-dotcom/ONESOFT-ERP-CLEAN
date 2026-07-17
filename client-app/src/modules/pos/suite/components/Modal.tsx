import React, { useEffect } from 'react';

export function Modal({
  open,
  title,
  children,
  onClose,
  width = 620,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="pos-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="pos-modal" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={title}>
        <header className="pos-modal__header">
          <h2>{title}</h2>
          <button type="button" className="pos-icon-button" onClick={onClose} aria-label="إغلاق">×</button>
        </header>
        <div className="pos-modal__body">{children}</div>
      </section>
    </div>
  );
}
