"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { PublicHeader } from "../components/PublicSiteChrome";
import { TurnstileWidget } from "../components/TurnstileWidget";
import { CONTACT_EMAIL, CONTACT_LIMITS, CONTACT_TOPICS, CONTACT_TOPIC_LABELS, validateContactForm } from "./contactForm";
import styles from "./contact.module.css";

const copy = {
  tr: {
    title: "İletişim", email: "E-posta", account: "Hesap desteği",
    recruitment: "İş ilanları ve mürettebat", yacht: "Yacht-OS",
    formTitle: "Mesaj gönderin", name: "Ad soyad", topic: "Konu",
    chooseTopic: "Konu seçin", message: "Mesajınız", send: "Mesaj gönder", sending: "Gönderiliyor…",
    privacy: "Gizlilik Politikası", terms: "Şartlar", footerPrivacy: "Gizlilik",
    legal: "Yasal bağlantılar", resources: "İlgili sayfalar",
    success: "Mesajınız alındı.", successDetail: "Mesajınız BlueDeck yönetimine iletildi.",
    another: "Yeni mesaj", invalid: "Lütfen bu alanı kontrol edin.",
    error: "Mesajınız gönderilemedi. Yeniden deneyin veya info@bluedeck.app adresine yazın.",
    captcha: "Lütfen güvenlik doğrulamasını tamamlayın.",
    captchaError: "Güvenlik doğrulaması yüklenemedi. Sayfayı yenileyebilir veya bize e-posta gönderebilirsiniz.",
    rateLimited: "Çok fazla deneme yaptınız. Lütfen daha sonra tekrar deneyin.",
  },
  en: {
    title: "Contact", email: "Email", account: "Account support",
    recruitment: "Jobs and crew", yacht: "Yacht-OS",
    formTitle: "Send a message", name: "Full name", topic: "Subject",
    chooseTopic: "Select a subject", message: "Your message", send: "Send message", sending: "Sending…",
    privacy: "Privacy Policy", terms: "Terms", footerPrivacy: "Privacy",
    legal: "Legal links", resources: "Related pages",
    success: "Message received.", successDetail: "Your message has been sent to the BlueDeck team.",
    another: "New message", invalid: "Please check this field.",
    error: "Your message could not be sent. Please try again or email info@bluedeck.app.",
    captcha: "Please complete the security check.",
    captchaError: "The security check could not load. Refresh the page or contact us by email.",
    rateLimited: "Too many attempts. Please try again later.",
  },
};

type SubmissionState = "idle" | "sending" | "sent";
type FormError = "" | "error" | "captcha" | "captchaError" | "rateLimited";

export default function ContactPageClient({ siteKey }: { siteKey: string }) {
  const { language } = useLanguage();
  const locale = language === "tr" ? "tr" : "en";
  const text = copy[locale];
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const sendingRef = useRef(false);
  const [state, setState] = useState<SubmissionState>("idle");
  const [errorField, setErrorField] = useState("");
  const [error, setError] = useState<FormError>("");
  const [interacted, setInteracted] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);
  const [compactCaptcha, setCompactCaptcha] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 385px)");
    const update = () => setCompactCaptcha(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (state === "sent") successRef.current?.focus();
  }, [state]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sendingRef.current) return;
    setError("");
    setErrorField("");
    const data = new FormData(event.currentTarget);
    const result = validateContactForm({
      name: String(data.get("name") || ""), email: String(data.get("email") || ""),
      topic: String(data.get("topic") || ""), message: String(data.get("message") || ""), language: locale,
    });
    if (!result.ok) {
      setErrorField(result.field);
      const field = event.currentTarget.elements.namedItem(result.field);
      if (field instanceof HTMLElement) field.focus();
      return;
    }
    setInteracted(true);
    if (!siteKey || !captchaToken) {
      setError(siteKey ? "captcha" : "captchaError");
      return;
    }
    sendingRef.current = true;
    setState("sending");
    try {
      const response = await fetch("/api/contact", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...result.value, captchaToken }), signal: AbortSignal.timeout(25000),
      });
      const payload = await response.json();
      if (!response.ok || payload.ok !== true) {
        setError(response.status === 429 ? "rateLimited" : payload.code === "captcha_failed" ? "captcha" : "error");
        setState("idle");
        return;
      }
      formRef.current?.reset();
      setState("sent");
    } catch {
      setError("error");
      setState("idle");
    } finally {
      sendingRef.current = false;
      setCaptchaToken("");
      setCaptchaKey((value) => value + 1);
    }
  }

  const invalidProps = (field: string) => ({
    "aria-invalid": errorField === field || undefined,
    "aria-describedby": errorField === field ? `${field}-error` : undefined,
  });
  const fieldError = (field: string) => errorField === field ? (
    <span id={`${field}-error`} className={styles.fieldError}>{text.invalid}</span>
  ) : null;

  return (
    <div className={styles.page}>
      <PublicHeader />
      <main id="main-content" className={styles.main} data-i18n-ignore>
        <div className={styles.grid}>
          <section className={styles.details} aria-labelledby="contact-title">
            <h1 id="contact-title">{text.title}</h1>
            <span className={styles.accent} aria-hidden="true" />
            <div className={styles.emailBlock}>
              <p>{text.email}</p>
              <a className={styles.emailLink} href={`mailto:${CONTACT_EMAIL}`}>
                <span>{CONTACT_EMAIL}</span><ArrowUpRight aria-hidden="true" />
              </a>
            </div>
            <nav className={styles.resources} aria-label={text.resources}>
              <Link href="/login"><span>{text.account}</span><ArrowRight aria-hidden="true" /></Link>
              <Link href="/jobs"><span>{text.recruitment}</span><ArrowRight aria-hidden="true" /></Link>
              <Link href="/yacht-os"><span>{text.yacht}</span><ArrowRight aria-hidden="true" /></Link>
            </nav>
          </section>
          <section className={styles.formPanel} aria-labelledby="contact-form-title">
            <h2 id="contact-form-title">{text.formTitle}</h2>
            {state === "sent" ? (
              <div className={styles.success}>
                <span className={styles.successIcon}><Check aria-hidden="true" /></span>
                <div role="status"><h3 ref={successRef} tabIndex={-1}>{text.success}</h3><p>{text.successDetail}</p></div>
                <button type="button" className={styles.newMessage} onClick={() => {
                  setState("idle"); setInteracted(false);
                  window.requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>("input")?.focus());
                }}>{text.another}<ArrowRight aria-hidden="true" /></button>
              </div>
            ) : (
              <form ref={formRef} onSubmit={(event) => void sendMessage(event)} onFocus={() => setInteracted(true)} onChange={() => setErrorField("")}>
                <fieldset disabled={state === "sending"} className={styles.fields}>
                  <div className={styles.nameRow}>
                    <div className={styles.field}>
                      <label htmlFor="contact-name">{text.name}</label>
                      <input id="contact-name" name="name" autoComplete="name" required maxLength={CONTACT_LIMITS.name} {...invalidProps("name")} />
                      {fieldError("name")}
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="contact-email">{text.email}</label>
                      <input id="contact-email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={CONTACT_LIMITS.email} {...invalidProps("email")} />
                      {fieldError("email")}
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="contact-topic">{text.topic}</label>
                    <select id="contact-topic" name="topic" required defaultValue="" {...invalidProps("topic")}>
                      <option value="" disabled>{text.chooseTopic}</option>
                      {CONTACT_TOPICS.map((topic) => <option key={topic} value={topic}>{CONTACT_TOPIC_LABELS[locale][topic]}</option>)}
                    </select>
                    {fieldError("topic")}
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="contact-message">{text.message}</label>
                    <textarea id="contact-message" name="message" rows={5} required maxLength={CONTACT_LIMITS.message} {...invalidProps("message")} />
                    {fieldError("message")}
                  </div>
                  {interacted && siteKey ? <div className={styles.captcha}><TurnstileWidget key={captchaKey} siteKey={siteKey} action="contact" size={compactCaptcha ? "compact" : "flexible"} onVerify={(token) => {
                    setCaptchaToken(token);
                    setError((current) => current === "captcha" || current === "captchaError" ? "" : current);
                  }} onExpire={() => setCaptchaToken("")} onError={() => {
                    setCaptchaToken("");
                    setError((current) => current === "error" || current === "rateLimited" ? current : "captchaError");
                  }} /></div> : null}
                  <div className={styles.actions}>
                    <button type="submit" className={styles.sendButton} disabled={state === "sending"}>
                      {state === "sending" ? text.sending : text.send}
                      {state === "sending" ? <LoaderCircle className={styles.spinner} aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
                    </button>
                    <Link href="/privacy" className={styles.privacy}>{text.privacy}</Link>
                  </div>
                </fieldset>
                {error ? <p role="alert" className={styles.formError}>{text[error]}</p> : null}
              </form>
            )}
          </section>
        </div>
      </main>
      <footer className={styles.footer} data-i18n-ignore>
        <div><p>© {new Date().getFullYear()} BlueDeck</p><nav aria-label={text.legal}><Link href="/privacy">{text.footerPrivacy}</Link><Link href="/terms">{text.terms}</Link></nav></div>
      </footer>
    </div>
  );
}
