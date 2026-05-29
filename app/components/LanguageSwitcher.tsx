"use client";

import { Globe2 } from "lucide-react";
import { languages, type Language } from "../lib/i18n";
import { useLanguage } from "./LanguageProvider";

type LanguageSwitcherProps = {
  variant?: "dark" | "light";
  size?: "normal" | "compact";
  className?: string;
};

export function LanguageSwitcher({
  variant = "dark",
  size = "normal",
  className = "",
}: LanguageSwitcherProps) {
  const { language, setLanguage, t } = useLanguage();
  const isDark = variant === "dark";
  const isCompact = size === "compact";

  return (
    <label
      className={`bd-focus inline-flex items-center gap-2 rounded-full border text-xs font-black uppercase tracking-[0.12em] transition ${
        isCompact ? "h-10 px-2.5" : "h-11 px-3"
      } ${
        isDark
          ? "border-white/14 bg-white/7 text-white/84 hover:border-cyan-200"
          : "border-[#071f3c]/12 bg-white/82 text-[#071f3c] shadow-sm hover:border-cyan-300"
      } ${className}`}
    >
      <Globe2 className={`h-4 w-4 ${isDark ? "text-cyan-200" : "text-cyan-700"}`} />
      <span className="sr-only">{t("language.select")}</span>
      <select
        aria-label={t("language.select")}
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
        className={`cursor-pointer appearance-none bg-transparent pr-1 outline-none ${
          isDark ? "text-white" : "text-[#071f3c]"
        }`}
      >
        {languages.map((item) => (
          <option key={item.code} value={item.code} className="text-[#071f3c]">
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
