import type { Language } from "./i18n";

const initialLetterPattern = /^\p{L}$/u;

export function capitalizeInitialInput(value: string, language: Language) {
  const firstCharacterIndex = value.search(/\S/u);
  if (firstCharacterIndex < 0) return value;

  const firstCharacter = Array.from(value.slice(firstCharacterIndex))[0];
  if (!firstCharacter || !initialLetterPattern.test(firstCharacter)) return value;

  const locale = language === "tr" ? "tr-TR" : "en-US";
  return `${value.slice(0, firstCharacterIndex)}${firstCharacter.toLocaleUpperCase(locale)}${value.slice(firstCharacterIndex + firstCharacter.length)}`;
}
