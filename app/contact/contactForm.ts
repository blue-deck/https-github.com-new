export const CONTACT_EMAIL = "info@bluedeck.app";

export const CONTACT_TOPICS = [
  "account",
  "recruitment",
  "yacht-os",
  "general",
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number];
export type ContactLanguage = "en" | "tr";
export type ContactField = "name" | "email" | "topic" | "message" | "language";

export const CONTACT_LIMITS = {
  name: 120,
  email: 254,
  message: 2000,
} as const;

export const CONTACT_TOPIC_LABELS: Record<
  ContactLanguage,
  Record<ContactTopic, string>
> = {
  en: {
    account: "Account support",
    recruitment: "Recruitment",
    "yacht-os": "Yacht OS",
    general: "General enquiry",
  },
  tr: {
    account: "Hesap desteği",
    recruitment: "İşe alım",
    "yacht-os": "Yacht OS",
    general: "Genel soru",
  },
};

export type ContactFormValue = {
  name: string;
  email: string;
  topic: ContactTopic;
  message: string;
  language: ContactLanguage;
};

export type ContactFormResult =
  | { ok: true; value: ContactFormValue }
  | { ok: false; field: ContactField };

const invalidSingleLineCharacters = /[\p{Cc}\p{Cs}\p{Zl}\p{Zp}]/u;
const invalidMessageCharacters = /[\p{Cc}\p{Cs}]/u;
const emailPattern =
  /^[a-z\d.!#$%&'*+/=?^_`{|}~-]+@[a-z\d](?:[a-z\d-]*[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]*[a-z\d])?)+$/i;

export function validateContactForm(input: unknown): ContactFormResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, field: "name" };
  }

  const { name, email, topic, message, language } = input as Record<string, unknown>;
  if (typeof name !== "string") {
    return { ok: false, field: "name" };
  }
  const cleanName = name.trim();
  if (
    !cleanName ||
    cleanName.length > CONTACT_LIMITS.name ||
    invalidSingleLineCharacters.test(name)
  ) {
    return { ok: false, field: "name" };
  }

  if (typeof email !== "string") {
    return { ok: false, field: "email" };
  }
  const cleanEmail = email.trim();
  if (
    !cleanEmail ||
    cleanEmail.length > CONTACT_LIMITS.email ||
    invalidSingleLineCharacters.test(email) ||
    !emailPattern.test(cleanEmail)
  ) {
    return { ok: false, field: "email" };
  }

  if (typeof topic !== "string") {
    return { ok: false, field: "topic" };
  }
  const cleanTopic = topic.trim();
  if (!CONTACT_TOPICS.some((allowedTopic) => allowedTopic === cleanTopic)) {
    return { ok: false, field: "topic" };
  }

  if (typeof message !== "string") {
    return { ok: false, field: "message" };
  }
  const cleanMessage = message.trim().replace(/\r\n?/g, "\n");
  if (
    !cleanMessage ||
    cleanMessage.length > CONTACT_LIMITS.message ||
    invalidMessageCharacters.test(message.replace(/[\t\r\n]/g, ""))
  ) {
    return { ok: false, field: "message" };
  }

  if (language !== "en" && language !== "tr") {
    return { ok: false, field: "language" };
  }

  return {
    ok: true,
    value: {
      name: cleanName,
      email: cleanEmail,
      topic: cleanTopic as ContactTopic,
      message: cleanMessage,
      language,
    },
  };
}
