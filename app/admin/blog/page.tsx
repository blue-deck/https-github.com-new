"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Archive, ArrowDown, ArrowLeft, ArrowUp, ArrowUpRight, BookOpen, Check, CheckCircle2, ChevronRight, Copy, Eye, FileText, Globe2, ImagePlus, LoaderCircle, Plus, RefreshCw, Save, Search, Send, Trash2, Upload, X } from "lucide-react";
import { useLanguage } from "../../components/LanguageProvider";
import { supabase } from "../../lib/supabase";
import { BLOG_IMAGE_MAX_BYTES, blogDocumentToGuide, blogSlug, createEmptyBlogDocument, createEmptyBlogTranslation, validateBlogDocument, type BlogDocument, type BlogLanguage, type BlogPost, type BlogTranslation } from "../../lib/blog";
import { GuideArticle } from "../../blog/_components/GuideArticle";
import { blogAdminCopy } from "./blog-copy";
import styles from "./studio.module.css";

const loginUrl = "/login?next=%2Fadmin%2Fblog";
type Action = "save" | "publish" | "unpublish" | "archive" | "restore";
type Filter = "all" | BlogPost["status"];
type ApiResult = { ok?: boolean; posts?: BlogPost[]; post?: BlogPost; url?: string; error?: string };

class BlogRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function blogRequest(path: string, init: RequestInit = {}): Promise<ApiResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new BlogRequestError(401, "");
  const response = await fetch(`/api/admin/blog${path}`, {
    ...init, cache: "no-store", signal: AbortSignal.timeout(30_000),
    headers: { Authorization: `Bearer ${session.access_token}`, ...init.headers },
  });
  const result = await response.json().catch(() => ({})) as ApiResult;
  if (!response.ok || !result.ok) throw new BlogRequestError(response.status, result.error || "");
  return result;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className={styles.field}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function LinesInput({ value, onChange, paragraphs = false, label, hint, rows = 4 }: {
  value: string[]; onChange: (value: string[]) => void; paragraphs?: boolean; label: string; hint: string; rows?: number;
}) {
  // Preserve the writer's trailing newlines while editing, including a new blank paragraph.
  const [raw, setRaw] = useState(value.join(paragraphs ? "\n\n" : "\n"));
  return <Field label={label} hint={hint}><textarea rows={rows} value={raw} onChange={(event) => {
    const next = event.target.value;
    setRaw(next);
    onChange(next.split(paragraphs ? /\n\s*\n/ : /\n/).map((item) => item.trim()).filter(Boolean));
  }} /></Field>;
}

function titleOf(post: BlogPost, language: BlogLanguage) {
  return post.draft.content[language]?.title || post.draft.content.tr?.title || post.draft.content.en?.title;
}

function translationOf(document: BlogDocument, language: BlogLanguage) {
  return document.content[language] || document.content.tr || document.content.en;
}

function newTranslation(): BlogTranslation {
  return { ...createEmptyBlogTranslation(), sections: [{ id: `section-${crypto.randomUUID().slice(0, 8)}`, title: "", paragraphs: [], bullets: [] }] };
}

function localizeApiError(message: string, language: BlogLanguage): string {
  if (language !== "tr") return message;
  const translations: Record<string, string> = {
    "Enter a URL slug using lowercase letters, numbers and hyphens.": "Yazı bağlantısında küçük harf, rakam ve kısa çizgi kullanın.",
    "Choose a valid category.": "Geçerli bir kategori seçin.",
    "Upload a valid cover image.": "Geçerli bir kapak görseli yükleyin.",
    "Add a cover image before publishing.": "Yayınlamadan önce kapak görseli ekleyin.",
    "Enter an author name (up to 100 characters).": "En fazla 100 karakter uzunluğunda bir yazar adı girin.",
    "The call-to-action link must be a safe page on this site, starting with /.": "Buton bağlantısı / ile başlayan, bu sitedeki bir sayfa olmalıdır. Örneğin: /jobs.",
    "Use up to 40 article sections.": "Bir yazıda en fazla 40 bölüm kullanabilirsiniz.",
    "Each section needs a unique ID and valid text.": "Bölüm içeriği çok uzun veya geçersiz. Metinleri kısaltarak tekrar deneyin.",
    "Use up to 40 checklist items (500 characters each).": "Her biri en fazla 500 karakter olan 40 kontrol maddesi kullanabilirsiniz.",
    "Add content in at least one language.": "En az bir dilde içerik ekleyin.",
    "Too many blog requests. Please try again shortly.": "Kısa sürede çok fazla işlem yapıldı. Lütfen biraz sonra tekrar deneyin.",
    "This URL slug is already in use. Choose another.": "Bu yazı bağlantısı zaten kullanılıyor. Yayın ayarlarındaki bağlantıyı değiştirin.",
    "The URL of a previously published article cannot be changed.": "Daha önce yayınlanan yazının bağlantısı değiştirilemez.",
    "This article no longer exists.": "Bu yazı artık mevcut değil. Listeyi yenileyin.",
    "Upload a JPG, PNG or WebP image.": "JPG, PNG veya WebP biçiminde bir görsel yükleyin.",
    "The image must be no larger than 4 MB.": "Görsel boyutu en fazla 4 MB olmalıdır.",
    "Choose an image to upload.": "Yüklemek için bir görsel seçin.",
    "This file is not a valid image.": "Bu dosya geçerli bir görsel değil.",
    "Use a still image at least 320 × 200 pixels.": "En az 320 × 200 piksel boyutunda, hareketsiz bir görsel kullanın.",
    "The image could not be read. Try another JPG, PNG or WebP file.": "Görsel okunamadı. Başka bir JPG, PNG veya WebP dosyası deneyin.",
    "The image could not be uploaded.": "Görsel yüklenemedi. Lütfen tekrar deneyin.",
    "Image uploads are temporarily unavailable.": "Görsel yükleme geçici olarak kullanılamıyor. Lütfen tekrar deneyin.",
    "Blog management is temporarily unavailable.": "Blog yönetimi geçici olarak kullanılamıyor. Değişiklikleriniz burada korunuyor; lütfen tekrar deneyin.",
    "The article could not be saved.": "Yazı kaydedilemedi. Değişiklikleriniz burada korunuyor; lütfen tekrar deneyin.",
    "The draft could not be created.": "Taslak oluşturulamadı. Değişiklikleriniz burada korunuyor; lütfen tekrar deneyin.",
    "The article could not be deleted.": "Yazı silinemedi. Lütfen tekrar deneyin.",
  };
  if (translations[message]) return translations[message];
  const languageMatch = /^(EN|TR): (.*)$/.exec(message);
  if (languageMatch) {
    const name = languageMatch[1] === "TR" ? "Türkçe" : "İngilizce";
    const reason = languageMatch[2];
    if (reason === "each section needs a heading and text.") return `${name}: Her bölüme başlık ve metin ekleyin; boş bölümleri kaldırın.`;
    if (reason === "add a title, summary, image description and at least one section.") return `${name}: Başlık, kısa açıklama, görsel açıklaması ve en az bir bölüm ekleyin. Hazır olmayan çeviriyi kaldırarak tek dilde yayınlayabilirsiniz.`;
    if (reason === "complete all four call-to-action fields or leave them empty.") return `${name}: Yazı sonu yönlendirmesindeki dört alanı da doldurun veya tamamını boş bırakın.`;
    const limit = /^(\w+) is invalid or too long \(maximum (\d+)\)\.$/.exec(reason);
    if (limit) {
      const fields: Record<string, string> = { title: "Başlık", description: "Kısa açıklama", imageAlt: "Görsel açıklaması", takeaway: "Yazının özeti", ctaTitle: "Yönlendirme başlığı", ctaDescription: "Yönlendirme açıklaması", ctaLabel: "Buton metni", ctaHref: "Buton bağlantısı", seoTitle: "SEO başlığı", seoDescription: "SEO açıklaması" };
      return `${name}: ${fields[limit[1]] || limit[1]} en fazla ${limit[2]} karakter olmalıdır.`;
    }
  }
  return message;
}

export default function BlogStudioPage() {
  const { language } = useLanguage();
  const locale: BlogLanguage = language === "tr" ? "tr" : "en";
  const text = blogAdminCopy[locale];
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<BlogPost | null>(null);
  const [document, setDocument] = useState<BlogDocument | null>(null);
  const [baseline, setBaseline] = useState("");
  const [contentLanguage, setContentLanguage] = useState<BlogLanguage>(locale);
  const [view, setView] = useState<"content" | "preview">("content");
  const [busy, setBusy] = useState("");
  const [editorRevision, setEditorRevision] = useState(0);
  const mutationLock = useRef(false);
  const requestGeneration = useRef(0);
  const userId = useRef("");
  const dirtyRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = !!document && JSON.stringify(document) !== baseline;
  const archived = selected?.status === "archived";
  const activeContent = document?.content[contentLanguage];
  const previewContent = document ? translationOf(document, contentLanguage) : undefined;
  const previewTranslations = document ? { en: blogDocumentToGuide(document, "en", selected?.publishedAt ?? null), tr: blogDocumentToGuide(document, "tr", selected?.publishedAt ?? null) } : null;
  const liveChanges = !!selected?.published && JSON.stringify(document) !== JSON.stringify(selected.published);
  const dateFormat = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
  const searchText = search.trim().toLocaleLowerCase(locale);
  const filtered = posts.filter((post) => (filter === "all" || post.status === filter) && `${post.draft.content.tr?.title || ""} ${post.draft.content.en?.title || ""} ${post.draft.slug}`.toLocaleLowerCase(locale).includes(searchText));
  const words = previewContent ? [previewContent.title, previewContent.description, previewContent.takeaway, ...previewContent.sections.flatMap((section) => [section.title, ...section.paragraphs, ...(section.bullets || [])]), ...previewContent.checklist].join(" ").trim().split(/\s+/).filter(Boolean).length : 0;

  const handleError = useCallback((cause: unknown, fallback: string) => {
    if (cause instanceof BlogRequestError) {
      if (cause.status === 401) { window.location.replace(loginUrl); return; }
      if (cause.status === 403) { setDenied(true); setPosts([]); setSelected(null); setDocument(null); return; }
      setError(cause.status === 409 && cause.message.includes("changed in another session") ? text.conflict : localizeApiError(cause.message, locale) || fallback);
    } else setError(fallback);
  }, [text.conflict, locale]);

  const feedbackRef = useRef({ handleError, loadError: text.loadError });
  useEffect(() => { feedbackRef.current = { handleError, loadError: text.loadError }; }, [handleError, text.loadError]);

  const loadPosts = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setLoading(true); setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.replace(loginUrl); return; }
      userId.current = session.user.id;
      const result = await blogRequest("");
      if (generation !== requestGeneration.current) return;
      if (!Array.isArray(result.posts)) throw new Error("Invalid response");
      setPosts(result.posts); setDenied(false);
    } catch (cause) { if (generation === requestGeneration.current) feedbackRef.current.handleError(cause, feedbackRef.current.loadError); }
    finally { if (generation === requestGeneration.current) setLoading(false); }
  }, []);

  useEffect(() => { void loadPosts(); return () => { requestGeneration.current += 1; }; }, [loadPosts]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (session && userId.current && session.user.id !== userId.current)) {
        requestGeneration.current += 1;
        setPosts([]); setSelected(null); setDocument(null); dirtyRef.current = false;
        window.location.replace(loginUrl);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      event.preventDefault(); event.returnValue = "";
    }
    function guardLink(event: MouseEvent) {
      if (!dirtyRef.current || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download") || link.getAttribute("href")?.startsWith("#")) return;
      if (!window.confirm(text.confirmLeave)) { event.preventDefault(); event.stopPropagation(); }
    }
    window.addEventListener("beforeunload", beforeUnload);
    window.document.addEventListener("click", guardLink, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); window.document.removeEventListener("click", guardLink, true); };
  }, [text.confirmLeave]);

  function canLeave() { return !dirty || window.confirm(text.confirmLeave); }

  function openPost(post?: BlogPost) {
    if (mutationLock.current || !canLeave()) return;
    const next = post ? structuredClone(post.draft) : { ...createEmptyBlogDocument(), content: { [locale]: newTranslation() } };
    setDocument(next); setSelectedId(post?.id || null); setSelected(post ? structuredClone(post) : null); setBaseline(JSON.stringify(next));
    setContentLanguage(next.content[locale] ? locale : next.content.tr ? "tr" : "en");
    setEditorRevision((value) => value + 1); setView("content"); setError(""); setNotice("");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function closeEditor() {
    if (mutationLock.current || !canLeave()) return;
    setDocument(null); setSelectedId(null); setSelected(null); setError(""); setNotice("");
    void loadPosts();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function changeDocument(patch: Partial<BlogDocument>) {
    setDocument((current) => current ? { ...current, ...patch } : current);
    setNotice("");
  }

  function changeContent(patch: Partial<BlogTranslation>) {
    setDocument((current) => {
      if (!current) return current;
      const previous = current.content[contentLanguage] || createEmptyBlogTranslation();
      const nextSlug = typeof patch.title === "string" && !selected?.publishedAt && (!current.slug || current.slug === blogSlug(previous.title)) ? blogSlug(patch.title) : current.slug;
      return { ...current, slug: nextSlug, content: { ...current.content, [contentLanguage]: { ...previous, ...patch } } };
    });
    setNotice("");
  }

  function acceptPost(post: BlogPost) {
    setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)]);
    setSelectedId(post.id); setSelected(structuredClone(post)); setDocument(structuredClone(post.draft)); setBaseline(JSON.stringify(post.draft));
    setEditorRevision((value) => value + 1);
  }

  async function mutate(action: Action) {
    if (!document || mutationLock.current) return;
    if (action === "unpublish" && !window.confirm(text.confirmUnpublish)) return;
    if (action === "archive" && !window.confirm(text.confirmArchive)) return;
    if ((action === "archive" || action === "unpublish") && dirty && !canLeave()) return;
    let candidate = document;
    if (action === "save" || action === "publish") {
      candidate = { ...document, slug: document.slug || blogSlug(translationOf(document, contentLanguage)?.title || "") };
      if (!candidate.slug) { setError(text.slugRequired); return; }
      const validation = validateBlogDocument(candidate, action === "publish");
      if (!validation.ok) { setError(localizeApiError(validation.error, locale)); return; }
      candidate = validation.document;
    }
    mutationLock.current = true; setBusy(action); setError(""); setNotice("");
    const generation = requestGeneration.current;
    try {
      let current = selected;
      if (!current) {
        const created = await blogRequest("", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ document: candidate }) });
        if (generation !== requestGeneration.current || !created.post) return;
        current = created.post; acceptPost(current);
        if (action === "save") { setNotice(text.saved); return; }
      }
      const result = await blogRequest(`/${current.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: current.version, action, ...((action === "save" || action === "publish") ? { document: candidate } : {}) }),
      });
      if (generation !== requestGeneration.current || !result.post) return;
      acceptPost(result.post);
      setNotice(({ save: text.saved, publish: text.publishedNotice, unpublish: text.unpublishedNotice, archive: text.archivedNotice, restore: text.restoredNotice })[action]);
    } catch (cause) { if (generation === requestGeneration.current) handleError(cause, text.saveError); }
    finally { mutationLock.current = false; setBusy(""); }
  }

  async function deletePost() {
    if (!selected || mutationLock.current || !window.confirm(text.confirmDelete)) return;
    mutationLock.current = true; setBusy("delete"); setError(""); setNotice("");
    const generation = requestGeneration.current;
    try {
      await blogRequest(`/${selected.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: selected.version }) });
      if (generation !== requestGeneration.current) return;
      setPosts((current) => current.filter((post) => post.id !== selected.id));
      setDocument(null); setSelectedId(null); setSelected(null); setNotice(text.deletedNotice);
    } catch (cause) { if (generation === requestGeneration.current) handleError(cause, text.saveError); }
    finally { mutationLock.current = false; setBusy(""); }
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || mutationLock.current) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > BLOG_IMAGE_MAX_BYTES) { setError(text.imageError); return; }
    mutationLock.current = true; setBusy("upload"); setError(""); setNotice("");
    const generation = requestGeneration.current;
    try {
      const result = await blogRequest("/media", { method: "POST", headers: { "Content-Type": file.type }, body: file });
      if (generation === requestGeneration.current && result.url) changeDocument({ coverImage: result.url });
    } catch (cause) { if (generation === requestGeneration.current) handleError(cause, text.saveError); }
    finally { mutationLock.current = false; setBusy(""); }
  }

  function duplicatePost() {
    if (!document || mutationLock.current) return;
    const copy = structuredClone(document);
    copy.slug = `${copy.slug.slice(0, 70)}-${Date.now().toString(36)}`;
    setDocument(copy); setSelectedId(null); setSelected(null); setBaseline(""); setEditorRevision((value) => value + 1); setNotice(""); setError("");
  }

  function removeTranslation() {
    if (!document || !window.confirm(text.confirmTranslation)) return;
    const next = { ...document.content }; delete next[contentLanguage];
    changeDocument({ content: next });
  }

  function moveSection(index: number, direction: number) {
    if (!activeContent) return;
    const sections = [...activeContent.sections];
    [sections[index], sections[index + direction]] = [sections[index + direction], sections[index]];
    changeContent({ sections });
  }

  const categoryName = (id: BlogDocument["categoryId"]) => ({ career: text.career, "cv-profile": text.cv, "onboard-life": text.onboard })[id];

  return (
    <main className={styles.page} data-i18n-ignore lang={locale}>
      <div className={styles.container}>
        {document ? <button className={styles.back} type="button" onClick={closeEditor} disabled={!!busy}><ArrowLeft aria-hidden />{text.backToPosts}</button> : <Link className={styles.back} href="/dashboard"><ArrowLeft aria-hidden />{text.back}</Link>}
        <header className={styles.header}>
          <div><p className={styles.eyebrow}>BLUEDECK / BLOG STUDIO</p><h1>{document ? selected ? titleOf(selected, locale) || text.untitled : text.newDraft : text.title}</h1><p className={styles.subtitle}>{document ? text.liveSafe : text.subtitle}</p></div>
          <div className={styles.headerActions}>
            {!document && <><a className={styles.button} href="/blog" target="_blank" rel="noopener noreferrer"><ArrowUpRight aria-hidden />{text.publicBlog}</a><button className={styles.primary} type="button" onClick={() => openPost()} disabled={loading || denied}><Plus aria-hidden />{text.newPost}</button></>}
            {document && <><button className={styles.button} type="button" onClick={() => void mutate("save")} disabled={!!busy || archived || (!dirty && !!selected)}>{busy === "save" ? <LoaderCircle className={styles.spinner} aria-hidden /> : <Save aria-hidden />}{text.save}</button>{!archived && <button className={styles.primary} type="button" onClick={() => void mutate("publish")} disabled={!!busy || (selected?.status === "published" && !liveChanges)}>{busy === "publish" ? <LoaderCircle className={styles.spinner} aria-hidden /> : <Send aria-hidden />}{selected?.status === "published" ? text.updateLive : text.publish}</button>}</>}
          </div>
        </header>

        {denied ? <div role="alert" className={styles.error}>{text.denied}</div> : <>
          {error && <div role="alert" className={styles.error}><span>{error}</span><button type="button" onClick={() => setError("")} aria-label={text.remove}><X aria-hidden /></button></div>}
          {notice && <div role="status" className={styles.notice}><CheckCircle2 aria-hidden /><span>{notice}</span></div>}

          {!document ? <>
            <div className={styles.stats}>
              {(["published", "draft", "archived"] as const).map((status) => <button type="button" className={styles.stat} data-status={status} aria-pressed={filter === status} onClick={() => setFilter(filter === status ? "all" : status)} key={status}><span className={styles.statIcon}>{status === "published" ? <Globe2 aria-hidden /> : status === "draft" ? <FileText aria-hidden /> : <Archive aria-hidden />}</span><span><strong>{posts.filter((post) => post.status === status).length}</strong><span>{text[status]}</span></span><ChevronRight aria-hidden /></button>)}
            </div>
            <div className={styles.libraryToolbar}>
              <div className={styles.filters} role="group" aria-label={text.publication}>{(["all", "published", "draft", "archived"] as const).map((status) => <button type="button" key={status} aria-pressed={filter === status} onClick={() => setFilter(status)}>{text[status]}{status === "all" && <span>{posts.length}</span>}</button>)}</div>
              <div className={styles.search}><Search aria-hidden /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text.search} aria-label={text.search} /></div>
              <button className={styles.iconButton} type="button" onClick={() => void loadPosts()} disabled={loading} title={text.refresh} aria-label={text.refresh}><RefreshCw className={loading ? styles.spinner : ""} aria-hidden /></button>
            </div>
            {loading ? <div className={styles.empty} role="status"><LoaderCircle className={styles.spinner} aria-hidden /><p>{text.loading}</p></div> : !filtered.length ? <div className={styles.empty}><BookOpen aria-hidden /><h2>{posts.length ? text.noResults : text.empty}</h2><p>{text.emptyHint}</p><button className={styles.primary} type="button" onClick={() => openPost()}><Plus aria-hidden />{text.newPost}</button></div> : <div className={styles.articleGrid}>
              {filtered.map((post) => <article key={post.id} className={styles.articleCard}>
                <div className={styles.cardCover}>{post.draft.coverImage ? <Image src={post.draft.coverImage} alt="" fill sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 400px" unoptimized /> : <ImagePlus aria-hidden />}<span className={styles.badge} data-status={post.status}>{text[post.status]}</span></div>
                <div className={styles.cardBody}><p className={styles.eyebrow}>{categoryName(post.draft.categoryId)}</p><h2>{titleOf(post, locale) || text.untitled}</h2><p className={styles.cardExcerpt}>{translationOf(post.draft, locale)?.description}</p><p className={styles.cardDate}>{text.updated} <time dateTime={post.updatedAt}>{dateFormat.format(new Date(post.updatedAt))}</time></p><div className={styles.cardActions}><button type="button" onClick={() => openPost(post)}>{text.edit}<ArrowUpRight aria-hidden /></button>{post.status === "published" && post.published && <a href={`/blog/${post.published.slug}`} target="_blank" rel="noopener noreferrer" aria-label={`${text.live}: ${titleOf(post, locale)}`}><Eye aria-hidden />{text.live}</a>}</div></div>
              </article>)}
            </div>}
          </> : <>
            <div className={styles.editorToolbar}>
              <div className={styles.viewTabs} role="group" aria-label={text.edit}><button type="button" aria-pressed={view === "content"} onClick={() => setView("content")}><FileText aria-hidden />{text.content}</button><button type="button" aria-pressed={view === "preview"} onClick={() => setView("preview")}><Eye aria-hidden />{text.preview}</button></div>
              <span className={styles.saveStatus} data-dirty={dirty}>{busy ? <LoaderCircle className={styles.spinner} aria-hidden /> : dirty ? <span className={styles.dirtyDot} /> : <Check aria-hidden />}{busy === "upload" ? text.uploading : busy ? text.saving : dirty ? text.unsaved : text.upToDate}</span>
              <span className={styles.wordCount}>{words} {text.wordCount} · {Math.max(1, Math.ceil(words / 200))} {text.minutes}</span>
            </div>
            {archived && <div className={styles.archiveBanner}><Archive aria-hidden /><p>{text.archiveHint}</p><button className={styles.button} type="button" onClick={() => void mutate("restore")} disabled={!!busy}>{text.restore}</button></div>}
            <div className={styles.languageBar}><div><span>{text.language}</span><div role="group" aria-label={text.language}>{(["tr", "en"] as const).map((value) => <button type="button" key={value} aria-pressed={contentLanguage === value} onClick={() => setContentLanguage(value)}>{value === "tr" ? "Türkçe" : "English"}{document.content[value] && <span className={styles.languageDot} />}</button>)}</div></div><p>{text.languageHint}</p></div>

            {view === "preview" ? <div className={styles.previewShell}>
              <p className={styles.previewNote}><Eye aria-hidden />{text.previewHint}</p>
              {previewTranslations && previewContent ? <GuideArticle translations={previewTranslations} updatedAt={selected?.publishedUpdatedAt} preview previewLanguage={contentLanguage} /> : <div className={styles.empty}><FileText aria-hidden /><p>{text.previewEmpty}</p></div>}
            </div> : <fieldset className={styles.editorFieldset} disabled={!!busy || archived} key={`${selectedId || "new"}-${editorRevision}`}>
              <div className={styles.editorGrid}>
                <div className={styles.editorMain}>
                  {!activeContent ? <div className={styles.panel}><h2>{text.missingTranslation}</h2><p className={styles.hint}>{text.languageHint}</p><button type="button" className={styles.button} onClick={() => changeContent(newTranslation())}><Plus aria-hidden />{text.addTranslation}</button></div> : <div key={contentLanguage} className={styles.translationEditor}>
                    <div className={styles.panel}>
                      <div className={styles.panelHeading}><h2>{text.content}</h2>{Object.keys(document.content).length > 1 && <button className={styles.textButton} type="button" onClick={removeTranslation}><X aria-hidden />{text.removeTranslation}</button>}</div>
                      <Field label={text.heading}><input className={styles.titleInput} value={activeContent.title} maxLength={180} placeholder={text.headingPlaceholder} onChange={(event) => changeContent({ title: event.target.value })} /></Field>
                      <Field label={text.excerpt} hint={text.excerptHint}><textarea rows={3} value={activeContent.description} maxLength={500} onChange={(event) => changeContent({ description: event.target.value })} /><span className={styles.charCount}>{activeContent.description.length}/500</span></Field>
                      <Field label={text.takeaway} hint={text.takeawayHint}><textarea rows={3} value={activeContent.takeaway} maxLength={1500} onChange={(event) => changeContent({ takeaway: event.target.value })} /></Field>
                    </div>
                    <div className={styles.panel}>
                      <div className={styles.panelHeading}><h2>{text.sections}</h2><span className={styles.sectionCount}>{activeContent.sections.length}</span></div><p className={styles.hint}>{text.sectionsHint}</p>
                      <div className={styles.sections}>{activeContent.sections.map((section, index) => <div className={styles.sectionEditor} key={section.id}>
                        <div className={styles.sectionToolbar}><strong>{text.section} {String(index + 1).padStart(2, "0")}</strong><div><button type="button" className={styles.iconButton} disabled={index === 0 || !!busy || archived} onClick={() => moveSection(index, -1)} title={text.moveUp} aria-label={`${text.moveUp}: ${section.title || index + 1}`}><ArrowUp aria-hidden /></button><button type="button" className={styles.iconButton} disabled={index === activeContent.sections.length - 1 || !!busy || archived} onClick={() => moveSection(index, 1)} title={text.moveDown} aria-label={`${text.moveDown}: ${section.title || index + 1}`}><ArrowDown aria-hidden /></button><button type="button" className={styles.iconButton} onClick={() => { if ((!section.title && !section.paragraphs.length && !section.bullets?.length) || window.confirm(text.confirmSection)) changeContent({ sections: activeContent.sections.filter((_, i) => i !== index) }); }} title={text.remove} aria-label={`${text.remove}: ${section.title || index + 1}`}><Trash2 aria-hidden /></button></div></div>
                        <Field label={text.sectionTitle}><input value={section.title} maxLength={180} onChange={(event) => changeContent({ sections: activeContent.sections.map((item, i) => i === index ? { ...item, title: event.target.value } : item) })} /></Field>
                        <LinesInput label={text.paragraphs} hint={text.paragraphsHint} value={section.paragraphs} paragraphs rows={7} onChange={(paragraphs) => changeContent({ sections: activeContent.sections.map((item, i) => i === index ? { ...item, paragraphs } : item) })} />
                        <LinesInput label={text.bullets} hint={text.bulletsHint} value={section.bullets || []} rows={3} onChange={(bullets) => changeContent({ sections: activeContent.sections.map((item, i) => i === index ? { ...item, bullets } : item) })} />
                      </div>)}</div>
                      <button type="button" className={styles.addSection} disabled={activeContent.sections.length >= 40 || !!busy || archived} onClick={() => changeContent({ sections: [...activeContent.sections, { id: `section-${crypto.randomUUID().slice(0, 8)}`, title: "", paragraphs: [], bullets: [] }] })}><Plus aria-hidden />{text.addSection}</button>
                    </div>
                    <details className={styles.panel}><summary><span>{text.checklist}</span><span className={styles.optional}>{text.optional}</span></summary><div className={styles.detailsContent}><LinesInput label={text.checklist} hint={text.checklistHint} value={activeContent.checklist} onChange={(checklist) => changeContent({ checklist })} /></div></details>
                    <details className={styles.panel}><summary><span>{text.cta}</span><span className={styles.optional}>{text.optional}</span></summary><div className={styles.detailsContent}><p className={styles.hint}>{text.ctaHint}</p><Field label={text.ctaHeading}><input value={activeContent.ctaTitle} maxLength={180} onChange={(event) => changeContent({ ctaTitle: event.target.value })} /></Field><Field label={text.ctaDescription}><textarea rows={3} value={activeContent.ctaDescription} maxLength={700} onChange={(event) => changeContent({ ctaDescription: event.target.value })} /></Field><div className={styles.fieldPair}><Field label={text.ctaLabel}><input value={activeContent.ctaLabel} maxLength={80} onChange={(event) => changeContent({ ctaLabel: event.target.value })} /></Field><Field label={text.ctaHref}><input value={activeContent.ctaHref} placeholder="/jobs" maxLength={500} onChange={(event) => changeContent({ ctaHref: event.target.value })} /></Field></div></div></details>
                    <details className={styles.panel}><summary><span>{text.seo}</span><span className={styles.optional}>{text.optional}</span></summary><div className={styles.detailsContent}><p className={styles.hint}>{text.seoHint}</p><Field label={text.seoTitle}><input value={activeContent.seoTitle} maxLength={100} placeholder={activeContent.title} onChange={(event) => changeContent({ seoTitle: event.target.value })} /></Field><Field label={text.seoDescription}><textarea rows={3} value={activeContent.seoDescription} maxLength={300} placeholder={activeContent.description} onChange={(event) => changeContent({ seoDescription: event.target.value })} /></Field><div className={styles.searchPreview}><span>bluedeck.app › blog › {document.slug || "…"}</span><strong>{activeContent.seoTitle || activeContent.title || text.untitled}</strong><p>{activeContent.seoDescription || activeContent.description}</p></div></div></details>
                  </div>}
                </div>
                <aside className={styles.editorAside}>
                  <div className={styles.panel}><div className={styles.panelHeading}><h2>{text.publication}</h2><span className={styles.badge} data-status={selected?.status || "draft"}>{text[selected?.status || "draft"]}</span></div><p className={styles.hint}>{liveChanges ? text.draftChanges : selected?.publishedAt ? `${text.published}: ${dateFormat.format(new Date(selected.publishedAt))}` : text.unsavedHelp}</p>{selected?.status === "published" && selected.published && <a className={styles.fullButton} href={`/blog/${selected.published.slug}`} target="_blank" rel="noopener noreferrer">{text.live}<ArrowUpRight aria-hidden /></a>}</div>
                  <div className={styles.panel}><h2>{text.cover}</h2><div className={styles.coverPreview}>{document.coverImage ? <Image src={document.coverImage} alt={activeContent?.imageAlt || ""} fill sizes="350px" unoptimized /> : <ImagePlus aria-hidden />}</div><input className={styles.hiddenInput} ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadImage(event)} aria-label={text.upload} /><button type="button" className={styles.fullButton} onClick={() => fileRef.current?.click()}>{busy === "upload" ? <LoaderCircle className={styles.spinner} aria-hidden /> : <Upload aria-hidden />}{document.coverImage ? text.replace : text.upload}</button><p className={styles.fileHint}>{text.imageFormat}</p>{document.coverImage && <button type="button" className={styles.textButton} onClick={() => changeDocument({ coverImage: "" })}><X aria-hidden />{text.removeCover}</button>}<p className={styles.hint}>{text.coverHint}</p>{activeContent && <Field label={text.imageAlt} hint={text.imageAltHint}><textarea rows={3} value={activeContent.imageAlt} maxLength={300} onChange={(event) => changeContent({ imageAlt: event.target.value })} /></Field>}</div>
                  <div className={styles.panel}><h2>{text.settings}</h2><Field label={text.category}><select value={document.categoryId} onChange={(event) => changeDocument({ categoryId: event.target.value as BlogDocument["categoryId"] })}><option value="career">{text.career}</option><option value="cv-profile">{text.cv}</option><option value="onboard-life">{text.onboard}</option></select></Field><Field label={text.author}><input value={document.author} maxLength={100} onChange={(event) => changeDocument({ author: event.target.value })} /></Field><Field label={text.slug} hint={selected?.publishedAt ? text.slugLocked : text.slugHint}><span className={styles.slugPrefix}>bluedeck.app/blog/</span><input value={document.slug} readOnly={!!selected?.publishedAt} maxLength={100} autoCapitalize="none" spellCheck={false} onChange={(event) => changeDocument({ slug: event.target.value })} /></Field></div>
                </aside>
              </div>
            </fieldset>}
            <footer className={styles.editorFooter}>
              <div>{selected && <><button className={styles.textButton} type="button" onClick={duplicatePost} disabled={!!busy}><Copy aria-hidden />{text.duplicate}</button>{selected.status === "published" && <button className={styles.textButton} type="button" onClick={() => void mutate("unpublish")} disabled={!!busy}>{text.unpublish}</button>}{selected.status !== "archived" && <button className={styles.textButton} type="button" onClick={() => void mutate("archive")} disabled={!!busy}><Archive aria-hidden />{text.archive}</button>}{selected.status !== "published" && <button className={`${styles.textButton} ${styles.danger}`} type="button" onClick={() => void deletePost()} disabled={!!busy}><Trash2 aria-hidden />{text.delete}</button>}</>}</div>
              {!archived && <button className={styles.button} type="button" onClick={() => void mutate("save")} disabled={!!busy || (!dirty && !!selected)}><Save aria-hidden />{text.save}</button>}
            </footer>
          </>}
        </>}
      </div>
    </main>
  );
}
