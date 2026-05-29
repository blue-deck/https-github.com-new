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

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(defaultLanguage);

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem(languageStorageKey);
    if (isLanguage(savedLanguage)) {
      setLanguageState(savedLanguage);
      return;
    }

    const browserLanguage = window.navigator.language.toLowerCase();
    if (browserLanguage.startsWith("tr")) setLanguageState("tr");
    else if (browserLanguage.startsWith("ru")) setLanguageState("ru");
    else if (browserLanguage.startsWith("it")) setLanguageState("it");
    else if (browserLanguage.startsWith("el") || browserLanguage.startsWith("gr")) {
      setLanguageState("el");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(languageStorageKey, language);
    document.documentElement.lang = language;
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
