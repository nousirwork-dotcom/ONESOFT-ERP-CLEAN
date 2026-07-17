import type { PropsWithChildren, ReactNode } from 'react';

interface ModalProps extends PropsWithChildren {
  title: string;
  onClose: () => void;
  widthClassName?: string;
  footer?: ReactNode;
}

export function Modal({ title, onClose, widthClassName = 'max-w-2xl', footer, children }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-[2px]"
      role="presentation"
      onPointerDown={(event) => event.preventDefault()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[92vh] w-full ${widthClassName} flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl`}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="flex min-h-14 items-center justify-between border-b border-slate-200 px-4">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg text-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="إغلاق"
          >
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
        {footer ? <footer className="border-t border-slate-200 bg-slate-50 p-3">{footer}</footer> : null}
      </section>
    </div>
  );
}

interface SidePanelProps extends PropsWithChildren {
  title: string;
  onClose: () => void;
}

export function SidePanel({ title, onClose, children }: SidePanelProps) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/35 backdrop-blur-[1px]"
      role="presentation"
      onPointerDown={(event) => event.preventDefault()}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
          <h2 className="font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-xl hover:bg-slate-100">×</button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
      </aside>
    </div>
  );
}

export function Spinner({ label = 'جارٍ التحميل' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2" aria-live="polite">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-l-transparent" />
      <span>{label}</span>
    </span>
  );
}
