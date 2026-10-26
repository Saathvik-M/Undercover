import type { ReactNode } from "react";

export function Badge({
  kind,
  children,
}: Readonly<{ kind: string; children: ReactNode }>) {
  return <span className={`badge ${kind}`}>{children}</span>;
}
