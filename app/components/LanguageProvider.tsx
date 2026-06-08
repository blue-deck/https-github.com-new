"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  defaultLanguage,
  isLanguage,
  languageStorageKey,
  translatePhrase,
  translations,
  type Language,
  type TranslationKey,
} from "../lib/i18n";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
const originalTextNodes = new WeakMap<Text, string>();
const supportedLanguages: Language[] = ["en", "tr"];
const translatableAttributes = ["aria-label", "placeholder", "title", "alt"] as const;
const originalAttributes = new WeakMap<Element, Partial<Record<(typeof translatableAttributes)[number], string>>>();

function normalizePhrase(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function translateMaybeWithPrefix(text: string, language: Language) {
  const direct = translatePhrase(text, language);
  if (direct !== text) return direct;

  const normalized = normalizePhrase(text);
  if (normalized !== text) {
    const normalizedTranslation = translatePhrase(normalized, language);
    if (normalizedTranslation !== normalized) return normalizedTranslation;
  }

  const prefixMatch = normalized.match(/^([^:]+:)(\s*)(.*)$/);
  if (!prefixMatch) return text;

  const [, prefix, space, rest] = prefixMatch;
  const translatedPrefix = translatePhrase(prefix, language);
  const translatedPrefixWithoutColon = translatePhrase(prefix.slice(0, -1), language);

  if (translatedPrefix !== prefix) return `${translatedPrefix}${space}${rest}`;
  if (translatedPrefixWithoutColon !== prefix.slice(0, -1)) {
    return `${translatedPrefixWithoutColon}:${space}${rest}`;
  }

  return text;
}

function isStoredOriginalCurrent(current: string, storedOriginal: string) {
  const normalizedCurrent = normalizePhrase(current);
  const normalizedOriginal = normalizePhrase(storedOriginal);
  const translatedOriginals = supportedLanguages.map((supportedLanguage) =>
    normalizePhrase(translateMaybeWithPrefix(normalizedOriginal, supportedLanguage)),
  );

  return (
    normalizedCurrent === normalizedOriginal ||
    translatedOriginals.includes(normalizedCurrent)
  );
}

function translateElementAttributes(language: Language) {
  const elements = document.body.querySelectorAll<HTMLElement>(
    translatableAttributes.map((attribute) => `[${attribute}]`).join(","),
  );

  elements.forEach((element) => {
    if (element.closest("script, style, code, pre, [data-i18n-ignore]")) return;

    const stored = originalAttributes.get(element) || {};

    translatableAttributes.forEach((attribute) => {
      const current = element.getAttribute(attribute);
      if (!current) return;

      const storedOriginal = stored[attribute];
      const original =
        storedOriginal && isStoredOriginalCurrent(current, storedOriginal)
          ? storedOriginal
          : current;
      stored[attribute] = original;

      const trimmedOriginal = normalizePhrase(original);
      const translated = translateMaybeWithPrefix(trimmedOriginal, language);
      const nextValue = translated === trimmedOriginal ? original : translated;
      if (current !== nextValue) {
        element.setAttribute(attribute, nextValue);
      }
    });

    originalAttributes.set(element, stored);
  });
}

function translateVisibleText(language: Language) {
  const root = document.body;
  if (!root) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      const text = node.textContent?.trim();

      if (!parent || !text) return NodeFilter.FILTER_REJECT;
      if (
        parent.closest(
          "script, style, textarea, input, code, pre, [data-i18n-ignore]",
        )
      ) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes: Text[] = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }

  for (const node of nodes) {
    const current = node.textContent || "";
    const storedOriginal = originalTextNodes.get(node);
    const original =
      storedOriginal && isStoredOriginalCurrent(current, storedOriginal)
        ? storedOriginal
        : current;
    const trimmedOriginal = normalizePhrase(original);
    const translated = translateMaybeWithPrefix(trimmedOriginal, language);

    originalTextNodes.set(node, original);

    if (translated === trimmedOriginal) {
      if (current !== original) {
        node.textContent = original;
      }
      continue;
    }

    const leading = original.match(/^\s*/)?.[0] || "";
    const trailing = original.match(/\s*$/)?.[0] || "";
    const nextText = `${leading}${translated}${trailing}`;
    if (current !== nextText) {
      node.textContent = nextText;
    }
  }

  translateElementAttributes(language);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [language, setLanguageState] = useState<Language>(defaultLanguage);

  useEffect(() => {
    let detectedLanguage: Language | null = null;
    const savedLanguage = window.localStorage.getItem(languageStorageKey);
    if (isLanguage(savedLanguage)) {
      detectedLanguage = savedLanguage;
    } else {
      const browserLanguage = window.navigator.language.toLowerCase();
      if (browserLanguage.startsWith("tr")) detectedLanguage = "tr";
    }

    if (!detectedLanguage) return;

    const frame = window.requestAnimationFrame(() => {
      setLanguageState(detectedLanguage);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(languageStorageKey, language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    translateVisibleText(language);
    const initialFrame = window.requestAnimationFrame(() => {
      translateVisibleText(language);
    });

    let frame = 0;
    const observer = new MutationObserver(() => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        translateVisibleText(language);
      });
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: [...translatableAttributes],
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => {
      window.cancelAnimationFrame(initialFrame);
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [language, pathname]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage: setLanguageState,
      t: (key) => translations[language][key] || translations.en[key],
    }),
    [language],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }

  return context;
}
