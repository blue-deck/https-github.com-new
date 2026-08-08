"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();
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
      if (event.key === "Escape" && open) {
        setOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      const selectedIndex = Math.max(
        0,
        languages.findIndex((item) => item.code === language),
      );
      optionRefs.current[selectedIndex]?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [language, open]);

  function chooseLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }

    const currentIndex = optionRefs.current.findIndex(
      (option) => option === document.activeElement,
    );
    let nextIndex: number | null = null;

    if (event.key === "ArrowDown") {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % languages.length;
    } else if (event.key === "ArrowUp") {
      nextIndex =
        currentIndex < 0
          ? languages.length - 1
          : (currentIndex - 1 + languages.length) % languages.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = languages.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    optionRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      data-i18n-ignore
      ref={menuRef}
      className={`relative inline-flex ${className}`}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("language.select")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
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
          id={menuId}
          role="menu"
          aria-label={t("language.select")}
          onKeyDown={handleMenuKeyDown}
          className={`absolute right-0 top-[calc(100%+0.55rem)] z-[90] grid min-w-[3.25rem] gap-1 rounded-2xl border p-1.5 shadow-2xl backdrop-blur-xl ${
            isDark
              ? "border-white/12 bg-[#06172b]/96 shadow-slate-950/35"
              : "border-[#071f3c]/12 bg-white/96 shadow-cyan-950/12"
          }`}
        >
          {languages.map((item, index) => (
            <button
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              key={item.code}
              type="button"
              role="menuitemradio"
              aria-checked={item.code === language}
              aria-label={item.name}
              tabIndex={item.code === language ? 0 : -1}
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
