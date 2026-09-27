"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Archive, ArrowLeft, ArrowUpRight, Check, Inbox, LoaderCircle, Mail, RefreshCw } from "lucide-react";
import { useLanguage } from "../../components/LanguageProvider";
import { supabase } from "../../lib/supabase";
import { CONTACT_TOPIC_LABELS } from "../../contact/contactForm";
import type { ContactInboxCounts, ContactInboxFilter, ContactInboxMessage, ContactInboxStatus } from "../../lib/contactInbox";
import styles from "./inbox.module.css";

const copy = {
  tr: {
    title: "İletişim mesajları", back: "Hesabım", subtitle: "İletişim formundan gelen mesajlar.",
    all: "Tümü", unread: "Okunmamış", read: "Okunmuş", archived: "Arşiv", refresh: "Yenile",
    loading: "Mesajlar yükleniyor…", loadError: "Mesajlar yüklenemedi. Lütfen tekrar deneyin.",
    denied: "Bu mesaj kutusuna erişim yetkiniz yok.", empty: "Burada henüz mesaj yok.",
    emptyHint: "Bu kategorideki mesajlar burada görünecek.", more: "Daha fazla yükle",
    select: "Okumak için bir mesaj seçin.", markRead: "Okundu işaretle", markUnread: "Okunmadı işaretle",
    archive: "Arşivle", restore: "Gelen kutusuna taşı", reply: "E-postayla yanıtla",
    updated: "Mesaj durumu güncellendi.", saveError: "Değişiklik kaydedilemedi. Lütfen tekrar deneyin.",
    conflict: "Mesaj başka bir işlemde güncellendi. Listeyi yenileyin.", filters: "Mesaj filtreleri", list: "Gelen mesajlar",
  },
  en: {
    title: "Contact messages", back: "My account", subtitle: "Messages from the contact form.",
    all: "All", unread: "Unread", read: "Read", archived: "Archived", refresh: "Refresh",
    loading: "Loading messages…", loadError: "Messages could not be loaded. Please try again.",
    denied: "You do not have access to this inbox.", empty: "No messages here yet.",
    emptyHint: "Messages in this category will appear here.", more: "Load more",
    select: "Select a message to read it.", markRead: "Mark as read", markUnread: "Mark as unread",
    archive: "Archive", restore: "Move to inbox", reply: "Reply by email",
    updated: "Message status updated.", saveError: "The change could not be saved. Please try again.",
    conflict: "This message was updated elsewhere. Refresh the list.", filters: "Message filters", list: "Incoming messages",
  },
};
const emptyCounts: ContactInboxCounts = { all: 0, unread: 0, read: 0, archived: 0 };
const loginUrl = "/login?next=%2Fadmin%2Fcontact-messages";
const filters: ContactInboxFilter[] = ["unread", "read", "archived", "all"];

type InboxResponse = {
  ok?: boolean; messages?: ContactInboxMessage[]; counts?: ContactInboxCounts;
  nextCursor?: string; hasMore?: boolean;
};

export default function ContactMessagesPage() {
  const { language } = useLanguage();
  const locale = language === "tr" ? "tr" : "en";
  const text = copy[locale];
  const [filter, setFilter] = useState<ContactInboxFilter>("unread");
  const [messages, setMessages] = useState<ContactInboxMessage[]>([]);
  const [counts, setCounts] = useState(emptyCounts);
  const [selectedId, setSelectedId] = useState("");
  const [cursor, setCursor] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<"" | "loadError" | "saveError" | "conflict">("");
  const [notice, setNotice] = useState(false);
  const generation = useRef(0);
  const accountId = useRef("");
  const savingRef = useRef(false);
  const restoreFocus = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const messageHeadingRef = useRef<HTMLHeadingElement>(null);
  const selected = messages.find((message) => message.id === selectedId) || null;
  const dateFormat = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

  const loadMessages = useCallback(async (nextCursor = "") => {
    const requestGeneration = ++generation.current;
    if (nextCursor) setLoadingMore(true);
    else { setLoading(true); setMessages([]); setCursor(""); }
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (requestGeneration !== generation.current) return;
      if (!session) { setMessages([]); window.location.replace(loginUrl); return; }
      accountId.current = session.user.id;
      const parameters = new URLSearchParams({ status: filter });
      if (nextCursor) parameters.set("cursor", nextCursor);
      const response = await fetch(`/api/admin/contact-messages?${parameters}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store", signal: AbortSignal.timeout(20000),
      });
      if (requestGeneration !== generation.current) return;
      if (response.status === 401 || response.status === 403) {
        setMessages([]); setCounts(emptyCounts); setSelectedId(""); setCursor("");
        if (response.status === 401) window.location.replace(loginUrl);
        else setDenied(true);
        return;
      }
      const result = await response.json() as InboxResponse;
      if (requestGeneration !== generation.current) return;
      if (!response.ok || !result.ok || !Array.isArray(result.messages) || !result.counts) throw new Error("load failed");
      setDenied(false);
      const nextMessages = result.messages;
      setMessages((current) => nextCursor
        ? [...current, ...nextMessages.filter((item) => !current.some((saved) => saved.id === item.id))]
        : nextMessages);
      setCounts(result.counts);
      setCursor(result.hasMore && result.nextCursor ? result.nextCursor : "");
      if (!nextCursor) setSelectedId((current) => nextMessages.some((item) => item.id === current) ? current : nextMessages[0]?.id || "");
    } catch {
      if (requestGeneration === generation.current) setError("loadError");
    } finally {
      if (requestGeneration === generation.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [filter]);

  useEffect(() => {
    void loadMessages();
    return () => { generation.current += 1; };
  }, [loadMessages]);

  useEffect(() => {
    if (!loading && restoreFocus.current) {
      restoreFocus.current = false;
      (messageHeadingRef.current || headingRef.current)?.focus();
    }
  }, [loading, selectedId]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !session) ||
          (session && accountId.current && session.user.id !== accountId.current)) {
        generation.current += 1;
        setMessages([]); setCounts(emptyCounts); setSelectedId("");
        window.location.replace(loginUrl);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function updateStatus(status: ContactInboxStatus) {
    if (!selected || savingRef.current) return;
    const mutationGeneration = ++generation.current;
    savingRef.current = true;
    setLoadingMore(false);
    setSaving(true); setError(""); setNotice(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (mutationGeneration !== generation.current) return;
      if (!session) { setMessages([]); window.location.replace(loginUrl); return; }
      const response = await fetch("/api/admin/contact-messages", {
        method: "PATCH", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, status, updatedAt: selected.updatedAt }), signal: AbortSignal.timeout(20000),
      });
      if (mutationGeneration !== generation.current) return;
      if (response.status === 401 || response.status === 403) {
        generation.current += 1;
        setLoading(false); setLoadingMore(false);
        setMessages([]); setCounts(emptyCounts); setSelectedId(""); setCursor("");
        if (response.status === 401) window.location.replace(loginUrl); else setDenied(true);
        return;
      }
      if (response.status === 409) { setError("conflict"); return; }
      const result = await response.json();
      if (mutationGeneration !== generation.current) return;
      if (!response.ok || result.ok !== true) throw new Error("save failed");
      setNotice(true);
      restoreFocus.current = true;
      await loadMessages();
    } catch { if (mutationGeneration === generation.current) setError("saveError"); }
    finally { savingRef.current = false; setSaving(false); }
  }

  const replyHref = selected ? `mailto:${encodeURIComponent(selected.email)}?subject=${encodeURIComponent(`Re: BlueDeck | ${CONTACT_TOPIC_LABELS[selected.language][selected.topic]}`)}` : "";

  return (
    <main className={styles.page} data-i18n-ignore>
      <div className={styles.container}>
        <Link href="/dashboard" className={styles.back}><ArrowLeft aria-hidden="true" />{text.back}</Link>
        <header className={styles.header}>
          <div><p className={styles.eyebrow}>BLUEDECK ADMIN</p><h1 ref={headingRef} tabIndex={-1}>{text.title}</h1><p className={styles.subtitle}>{text.subtitle}</p></div>
          <button className={styles.refresh} disabled={loading || saving || loadingMore || denied} onClick={() => { setNotice(false); void loadMessages(); }}><RefreshCw aria-hidden="true" />{text.refresh}</button>
        </header>
        {denied ? <p role="alert" className={styles.error}>{text.denied}</p> : <>
          <nav className={styles.filters} aria-label={text.filters}>
            {filters.map((item) => <button key={item} aria-pressed={filter === item} disabled={saving} onClick={() => { setFilter(item); setNotice(false); }}><span>{text[item]}</span><span className={styles.count}>{counts[item]}</span></button>)}
          </nav>
          {error ? <p role="alert" className={styles.error}>{text[error]}</p> : null}
          {notice ? <p role="status" className={styles.notice}><Check aria-hidden="true" />{text.updated}</p> : null}
          {loading ? <div role="status" className={styles.loading}><LoaderCircle aria-hidden="true" className={styles.spinner} />{text.loading}</div> : messages.length === 0 ? (
            <div className={styles.empty}><Inbox aria-hidden="true" /><h2>{text.empty}</h2><p>{text.emptyHint}</p></div>
          ) : <div className={styles.workspace}>
            <section className={styles.list} aria-label={text.list}>
              <ul>{messages.map((message) => <li key={message.id}><button className={styles.messageButton} aria-pressed={message.id === selectedId} onClick={() => setSelectedId(message.id)} disabled={saving}>
                <span className={styles.listTop}><strong>{message.name}</strong>{message.status === "unread" ? <span className={styles.unreadDot} aria-label={text.unread} /> : null}</span>
                <span className={styles.topic}>{CONTACT_TOPIC_LABELS[locale][message.topic]}</span>
                <span className={styles.preview}>{message.message}</span>
                <time dateTime={message.createdAt}>{dateFormat.format(new Date(message.createdAt))}</time>
              </button></li>)}</ul>
              {cursor ? <button className={styles.more} disabled={loadingMore || saving} onClick={() => void loadMessages(cursor)}>{loadingMore ? text.loading : text.more}</button> : null}
            </section>
            {selected ? <article className={styles.detail} aria-labelledby="message-heading">
              <div className={styles.detailTop}><span className={styles.status} data-status={selected.status}>{text[selected.status]}</span><time dateTime={selected.createdAt}>{dateFormat.format(new Date(selected.createdAt))}</time></div>
              <h2 id="message-heading" ref={messageHeadingRef} tabIndex={-1}>{CONTACT_TOPIC_LABELS[locale][selected.topic]}</h2>
              <p className={styles.sender}><strong>{selected.name}</strong><a href={`mailto:${encodeURIComponent(selected.email)}`}>{selected.email}</a></p>
              <p className={styles.messageBody}>{selected.message}</p>
              <div className={styles.messageActions}>
                <button disabled={saving} onClick={() => void updateStatus(selected.status === "unread" ? "read" : "unread")}><Check aria-hidden="true" />{selected.status === "unread" ? text.markRead : text.markUnread}</button>
                <button disabled={saving} onClick={() => void updateStatus(selected.status === "archived" ? "read" : "archived")}><Archive aria-hidden="true" />{selected.status === "archived" ? text.restore : text.archive}</button>
                <a href={replyHref}><Mail aria-hidden="true" />{text.reply}<ArrowUpRight aria-hidden="true" /></a>
              </div>
            </article> : <div className={styles.empty}>{text.select}</div>}
          </div>}
        </>}
      </div>
    </main>
  );
}
