import { type ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
  className?: string;
  dir?: "rtl" | "ltr";
}

export function PageShell({ children, className, dir = "rtl" }: PageShellProps) {
  return (
    <div className={`flex flex-col h-full bg-background${className ? " " + className : ""}`} dir={dir}>
      {children}
    </div>
  );
}

export default PageShell;
