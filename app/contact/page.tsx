import { getTurnstileConfiguration } from "../lib/turnstileServer";
import ContactPageClient from "./ContactPageClient";

export default function ContactPage() {
  const { siteKey, enabled } = getTurnstileConfiguration();
  return <ContactPageClient siteKey={enabled ? siteKey : ""} />;
}
