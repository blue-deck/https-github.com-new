export const CONTACT_INBOX_STATUSES = ["unread", "read", "archived"] as const;

export type ContactInboxStatus = (typeof CONTACT_INBOX_STATUSES)[number];
export type ContactInboxFilter = ContactInboxStatus | "all";
export type ContactInboxCounts = Record<ContactInboxFilter, number>;

export type ContactInboxMessage = {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  email: string;
  topic: "account" | "recruitment" | "yacht-os" | "general";
  message: string;
  language: "en" | "tr";
  status: ContactInboxStatus;
};

export function isContactInboxStatus(value: unknown): value is ContactInboxStatus {
  return value === "unread" || value === "read" || value === "archived";
}
