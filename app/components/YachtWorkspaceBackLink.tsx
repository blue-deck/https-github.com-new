"use client";

import type { MouseEventHandler } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "./LanguageProvider";
import styles from "./YachtWorkspaceBackLink.module.css";

export function YachtWorkspaceBackLink({
  yachtId,
  onClick,
}: {
  yachtId: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  const { language } = useLanguage();

  return (
    <Link
      href={`/yachts/${yachtId}`}
      className={styles.back}
      onClick={onClick}
      data-i18n-ignore
    >
      <ArrowLeft size={15} aria-hidden />
      <span>{language === "tr" ? "Yat çalışma alanı" : "Yacht workspace"}</span>
    </Link>
  );
}
