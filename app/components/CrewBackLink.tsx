import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function CrewBackLink({
  href,
  children = "Back",
  className = "",
}: {
  href: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`bd-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-[#173f4a] transition hover:bg-slate-50 print:hidden ${className}`}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
      {children}
    </Link>
  );
}
