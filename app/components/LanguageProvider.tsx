"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
          "script, style, textarea, input, select, option, code, pre, [data-i18n-ignore]",
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
    const original = originalTextNodes.get(node) || current;
    const trimmedOriginal = original.trim();
    const translated = translatePhrase(trimmedOriginal, language);

    if (!originalTextNodes.has(node)) {
      originalTextNodes.set(node, original);
    }

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
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(defaultLanguage);

  useEffect(() => {
    let detectedLanguage: Language | null = null;
    const savedLanguage = window.localStorage.getItem(languageStorageKey);
    if (isLanguage(savedLanguage)) {
      detectedLanguage = savedLanguage;
    } else {
      const browserLanguage = window.navigator.language.toLowerCase();
      if (browserLanguage.startsWith("tr")) detectedLanguage = "tr";
      else if (browserLanguage.startsWith("ru")) detectedLanguage = "ru";
      else if (browserLanguage.startsWith("it")) detectedLanguage = "it";
      else if (browserLanguage.startsWith("el") || browserLanguage.startsWith("gr")) {
        detectedLanguage = "el";
      }
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

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(() => translateVisibleText(language));
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [language]);

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
