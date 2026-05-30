"use client";

import { useEffect, useRef, useState } from "react";
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
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isDark = variant === "dark";
  const isCompact = size === "compact";
  const activeLanguage = languages.find((item) => item.code === language) || languages[0];

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function chooseLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    setOpen(false);
  }

  return (
    <div
      data-i18n-ignore
      ref={menuRef}
      className={`relative inline-flex ${className}`}
    >
      <button
        type="button"
        aria-label={t("language.select")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`bd-focus inline-flex items-center justify-center rounded-full border text-lg font-black transition ${
          isCompact ? "h-10 w-10" : "h-11 w-11"
        } ${
          isDark
            ? "border-white/14 bg-white/7 text-white shadow-lg shadow-slate-950/18 hover:border-cyan-200 hover:bg-white/12"
            : "border-[#071f3c]/12 bg-white/88 text-[#071f3c] shadow-sm hover:border-cyan-300"
        }`}
      >
        <span aria-hidden="true">{activeLanguage.flag}</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t("language.select")}
          className={`absolute right-0 top-[calc(100%+0.55rem)] z-[90] grid min-w-[3.25rem] gap-1 rounded-2xl border p-1.5 shadow-2xl backdrop-blur-xl ${
            isDark
              ? "border-white/12 bg-[#06172b]/96 shadow-slate-950/35"
              : "border-[#071f3c]/12 bg-white/96 shadow-cyan-950/12"
          }`}
        >
          {languages.map((item) => (
            <button
              key={item.code}
              type="button"
              role="menuitemradio"
              aria-checked={item.code === language}
              aria-label={item.name}
              onClick={() => chooseLanguage(item.code)}
              className={`bd-focus flex h-10 w-10 items-center justify-center rounded-xl text-lg transition ${
                item.code === language
                  ? isDark
                    ? "bg-cyan-300/16 ring-1 ring-cyan-200/45"
                    : "bg-cyan-50 ring-1 ring-cyan-300"
                  : isDark
                    ? "hover:bg-white/10"
                    : "hover:bg-slate-100"
              }`}
            >
              <span aria-hidden="true">{item.flag}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
