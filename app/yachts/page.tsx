"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ArrowRight, Check, ImagePlus, LoaderCircle, Pencil, Plus, Ship, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CountryFlagField } from "../components/CountryFlagField";
import { useLanguage } from "../components/LanguageProvider";
import { countryNameForLanguage, countryOptionFromCode, countryOptionFromNationalityValue } from "../lib/countries";
import { formatJobYachtType, jobYachtTypes, type JobYachtType } from "../lib/jobPosts";
import { supabase } from "../lib/supabase";
import { maximumYachtPhotoBytes, yachtPhotoMimeTypes, type YachtWorkspaceCard } from "../lib/yachtWorkspace";
import styles from "./yachts.module.css";

type Yacht = YachtWorkspaceCard;

type Language = "en" | "tr";
const copy = {
  en: {
    title: "Captain Workspace", dashboard: "Dashboard", back: "Back to dashboard",
    add: "Add yacht", edit: "Edit yacht", open: "Open yacht workspace",
    type: "Yacht type", model: "Model", crew: "Crew", flag: "Flag", name: "Yacht name",
    crewSize: "Crew size", members: "members", member: "member", missing: "Not added", noPhoto: "No photo yet",
    loading: "Loading your yachts…", loadError: "Your yachts could not be loaded.",
    loadHelp: "Check your connection and try again.", retry: "Try again",
    emptyTitle: "Your yacht workspace starts here",
    emptyHelp: "Add your yacht, then open its workspace to manage your crew, documents and daily operations.",
    formHelp: "Add the details that help you and your crew identify your yacht.",
    editHelp: "Keep your yacht details and photo up to date.",
    selectType: "Select yacht type", selectFlag: "Search country or flag", clearFlag: "Clear flag", noCountries: "No countries found",
    namePlaceholder: "e.g. M/Y Aurora", modelPlaceholder: "e.g. Sirena 88", crewPlaceholder: "e.g. 8",
    photo: "Yacht photo", photoHelp: "JPG, PNG, WebP or AVIF · up to 4 MB", optional: "Optional",
    upload: "Upload photo", replace: "Change photo", remove: "Remove photo", photoAlt: "Yacht photo preview",
    cancel: "Cancel", close: "Close yacht form", save: "Save changes", creating: "Adding yacht…", saving: "Saving changes…",
    formError: "Your yacht could not be saved. Please try again.", invalidFlag: "Select a flag from the country list.",
    invalidPhotoData: "This photo could not be read. Choose another JPG, PNG, WebP or AVIF image.",
    yachtLimit: "Your workspace already has 25 yachts. Edit an existing yacht instead.",
    yachtChanged: "This yacht was updated in another window. Close this form and refresh before editing again.",
    rateLimited: "Please wait a few minutes before trying again.",
    invalidPhoto: "Choose a JPG, PNG, WebP or AVIF image up to 4 MB.",
    invalidDetails: "Enter a yacht name, type, model and a crew size from 0 to 999.",
    created: "Yacht added. Your workspace is ready.", updated: "Yacht details updated.",
    currentFlag: "Current flag", legacyFlagHelp: "Select a country to update it.",
  },
  tr: {
    title: "Kaptan Çalışma Alanı", dashboard: "Panel", back: "Panele dön",
    add: "Yat ekle", edit: "Yatı düzenle", open: "Yat çalışma alanını aç",
    type: "Yat türü", model: "Model", crew: "Mürettebat", flag: "Bayrak", name: "Yat adı",
    crewSize: "Mürettebat sayısı", members: "kişi", member: "kişi", missing: "Eklenmedi", noPhoto: "Henüz fotoğraf yok",
    loading: "Yatlarınız yükleniyor…", loadError: "Yatlarınız yüklenemedi.",
    loadHelp: "Bağlantınızı kontrol edip tekrar deneyin.", retry: "Tekrar dene",
    emptyTitle: "Yatınızın çalışma alanı burada başlıyor",
    emptyHelp: "Yatınızı ekleyin; mürettebatı, belgeleri ve günlük işleri yönetmek için çalışma alanını açın.",
    formHelp: "Yatınızı tanımlamak için temel bilgileri ekleyin.",
    editHelp: "Yatınızın bilgilerini ve fotoğrafını güncelleyin.",
    selectType: "Yat türü seçin", selectFlag: "Ülke veya bayrak ara", clearFlag: "Bayrağı temizle", noCountries: "Ülke bulunamadı",
    namePlaceholder: "Örn. M/Y Aurora", modelPlaceholder: "Örn. Sirena 88", crewPlaceholder: "Örn. 8",
    photo: "Yat fotoğrafı", photoHelp: "JPG, PNG, WebP veya AVIF · en fazla 4 MB", optional: "İsteğe bağlı",
    upload: "Fotoğraf yükle", replace: "Fotoğrafı değiştir", remove: "Fotoğrafı kaldır", photoAlt: "Yat fotoğrafı önizlemesi",
    cancel: "Vazgeç", close: "Yat formunu kapat", save: "Değişiklikleri kaydet", creating: "Yat ekleniyor…", saving: "Kaydediliyor…",
    formError: "Yat kaydedilemedi. Lütfen tekrar deneyin.", invalidFlag: "Ülke listesinden bir bayrak seçin.",
    invalidPhotoData: "Bu fotoğraf okunamadı. Başka bir JPG, PNG, WebP veya AVIF fotoğraf seçin.",
    yachtLimit: "Çalışma alanınızda zaten 25 yat var. Mevcut bir yatı düzenleyebilirsiniz.",
    yachtChanged: "Yat başka bir pencerede güncellendi. Formu kapatıp sayfayı yeniledikten sonra tekrar düzenleyin.",
    rateLimited: "Tekrar denemeden önce birkaç dakika bekleyin.",
    invalidPhoto: "En fazla 4 MB büyüklüğünde JPG, PNG, WebP veya AVIF fotoğraf seçin.",
    invalidDetails: "Yat adı, türü, modeli ve 0 ile 999 arasında mürettebat sayısı girin.",
    created: "Yat eklendi. Çalışma alanınız hazır.", updated: "Yat bilgileri güncellendi.",
    currentFlag: "Mevcut bayrak", legacyFlagHelp: "Değiştirmek için bir ülke seçin.",
  },
} satisfies Record<Language, Record<string, string>>;

class YachtRequestError extends Error {
  constructor(message: string, public code: string) { super(message); }
}

async function yachtRequest(path: string, init?: RequestInit) {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session?.access_token) {
    window.location.replace(`/login?next=${encodeURIComponent("/yachts")}`);
    throw new Error("Authentication required");
  }
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: { ...init?.headers, Authorization: `Bearer ${session.access_token}` },
  });
  if (response.status === 401) {
    window.location.replace(`/login?next=${encodeURIComponent("/yachts")}`);
    throw new Error("Authentication required");
  }
  const result = await response.json();
  if (!response.ok) throw new YachtRequestError(result.error || "Request failed", result.code || "");
  return result;
}

export default function YachtsPage() {
  const { language } = useLanguage();
  const c = copy[language];
  const [yachts, setYachts] = useState<Yacht[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editor, setEditor] = useState<Yacht | "new" | null>(null);
  const [notice, setNotice] = useState<"created" | "updated" | null>(null);
  const editorOpenerRef = useRef<HTMLElement | null>(null);
  const savedYachtIdRef = useRef<string | null>(null);

  const fetchYachts = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const result = await yachtRequest("/api/yachts");
      setYachts(result.yachts);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchYachts(); }, [fetchYachts]);

  useEffect(() => {
    if (editor !== null) return;
    const frame = requestAnimationFrame(() => {
      const savedLink = savedYachtIdRef.current
        ? document.getElementById(`open-yacht-${savedYachtIdRef.current}`)
        : null;
      (savedLink || editorOpenerRef.current)?.focus();
      savedYachtIdRef.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [editor]);

  function openEditor(yacht: Yacht | "new", opener: HTMLElement) {
    editorOpenerRef.current = opener;
    setNotice(null);
    setEditor(yacht);
  }

  return (
    <main className={`bd-app-page bd-ocean-shell bd-page-gutter ${styles.page}`} data-i18n-ignore>
      <div className={`bd-ocean-content ${styles.content}`}>
        <Link href="/dashboard" className={styles.back} aria-label={c.back} title={c.back}>
          <ChevronLeft className="h-4 w-4" aria-hidden />{c.dashboard}
        </Link>
        <header className={styles.header}>
          <h1>{c.title}</h1>
          <button type="button" className={styles.addButton} disabled={loading} onClick={(event) => openEditor("new", event.currentTarget)}>
            <Plus size={18} aria-hidden />{c.add}
          </button>
        </header>

        {notice ? <p className={styles.notice} role="status"><Check size={17} aria-hidden />{c[notice]}</p> : null}

        {loading ? (
          <div className={styles.loading} role="status"><LoaderCircle className={styles.spinner} size={22} aria-hidden />{c.loading}</div>
        ) : loadError ? (
          <section className={styles.empty} role="alert">
            <h2>{c.loadError}</h2><p>{c.loadHelp}</p>
            <button type="button" className={styles.primaryButton} onClick={() => void fetchYachts()}>{c.retry}</button>
          </section>
        ) : yachts.length ? (
          <div className={styles.yachtList}>
            {yachts.map((yacht) => <YachtCard key={yacht.id} yacht={yacht} language={language} onEdit={(opener) => openEditor(yacht, opener)} />)}
          </div>
        ) : (
          <section className={styles.empty}>
            <span className={styles.emptyIcon}><Ship size={34} strokeWidth={1.4} aria-hidden /></span>
            <h2>{c.emptyTitle}</h2><p>{c.emptyHelp}</p>
            <button type="button" className={styles.primaryButton} onClick={(event) => openEditor("new", event.currentTarget)}><Plus size={18} aria-hidden />{c.add}</button>
          </section>
        )}

        {editor ? (
          <YachtForm
            key={editor === "new" ? "new" : editor.id}
            yacht={editor === "new" ? null : editor}
            language={language}
            onClose={() => setEditor(null)}
            onSaved={(yacht) => {
              savedYachtIdRef.current = yacht.id;
              setYachts((current) => editor === "new" ? [yacht, ...current] : current.map((item) => item.id === yacht.id ? yacht : item));
              setNotice(editor === "new" ? "created" : "updated");
              setEditor(null);
              if (loadError) void fetchYachts();
            }}
          />
        ) : null}
      </div>
    </main>
  );
}

function YachtCard({ yacht, language, onEdit }: { yacht: Yacht; language: Language; onEdit: (opener: HTMLElement) => void }) {
  const c = copy[language];
  const country = countryOptionFromCode(yacht.flag);
  return (
    <article className={styles.card} aria-labelledby={`yacht-${yacht.id}`}>
      <YachtPhoto key={yacht.photoUrl} src={yacht.photoUrl} alt={yacht.name} emptyLabel={c.noPhoto} />
      <div className={styles.cardBody}>
        <div className={styles.cardHeading}>
          <h2 id={`yacht-${yacht.id}`}>{yacht.name}</h2>
          <button type="button" className={styles.editButton} onClick={(event) => onEdit(event.currentTarget)} aria-label={`${c.edit}: ${yacht.name}`} title={c.edit}><Pencil size={16} aria-hidden /><span>{c.edit}</span></button>
        </div>
        <dl className={styles.details}>
          <div><dt>{c.type}</dt><dd>{yacht.yachtType ? formatJobYachtType(yacht.yachtType, language) : <span className={styles.missing}>{c.missing}</span>}</dd></div>
          <div><dt>{c.model}</dt><dd>{yacht.model || <span className={styles.missing}>{c.missing}</span>}</dd></div>
          <div><dt>{c.crew}</dt><dd>{yacht.crewSize !== null ? `${yacht.crewSize} ${yacht.crewSize === 1 ? c.member : c.members}` : <span className={styles.missing}>{c.missing}</span>}</dd></div>
          <div><dt>{c.flag}</dt><dd className={styles.flag}>{country ? <><span className={styles.flagEmoji} aria-hidden>{country.flag}</span><span>{countryNameForLanguage(country, language)}</span></> : yacht.flag || <span className={styles.missing}>{c.missing}</span>}</dd></div>
        </dl>
        <Link id={`open-yacht-${yacht.id}`} href={`/yachts/${yacht.id}`} className={styles.workspaceButton} aria-label={`${c.open}: ${yacht.name}`}>{c.open}<ArrowRight size={20} aria-hidden /></Link>
      </div>
    </article>
  );
}

function YachtPhoto({ src, alt, emptyLabel }: { src: string | null; alt: string; emptyLabel: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`${styles.photo} ${!src || failed ? styles.photoEmpty : ""}`}>
      {src && !failed ? <Image src={src} alt={alt} fill unoptimized sizes="(max-width: 767px) 100vw, 520px" className={styles.photoImage} onError={() => setFailed(true)} /> : <><Ship size={60} strokeWidth={1.1} aria-hidden /><span>{emptyLabel}</span></>}
    </div>
  );
}

function YachtForm({ yacht, language, onClose, onSaved }: { yacht: Yacht | null; language: Language; onClose: () => void; onSaved: (yacht: Yacht) => void }) {
  const c = copy[language];
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const flagRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [name, setName] = useState(yacht?.name || "");
  const [yachtType, setYachtType] = useState(yacht?.yachtType || "");
  const [model, setModel] = useState(yacht?.model || "");
  const [crewSize, setCrewSize] = useState(yacht?.crewSize == null ? "" : String(yacht.crewSize));
  const initialFlag = countryOptionFromNationalityValue(yacht?.flag);
  const [flag, setFlag] = useState(initialFlag?.code || yacht?.flag || "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<"formError" | "invalidFlag" | "invalidPhoto" | "invalidDetails" | "invalidPhotoData" | "yachtLimit" | "yachtChanged" | "rateLimited" | null>(null);
  const currentPhoto = preview || (!removePhoto ? yacht?.photoUrl : null);
  const legacyFlag = Boolean(flag && !countryOptionFromCode(flag) && flag === yacht?.flag);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    nameRef.current?.focus();
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (!photo) { setPreview(null); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  useEffect(() => {
    if (error === "invalidFlag") flagRef.current?.querySelector("input")?.focus();
    else if (error) errorRef.current?.focus();
  }, [error]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError(null);
    const crew = Number(crewSize);
    if (!name.trim() || name.trim().length > 120 || !model.trim() || model.trim().length > 120 || !jobYachtTypes.includes(yachtType as JobYachtType) || !crewSize.trim() || !Number.isInteger(crew) || crew < 0 || crew > 999) {
      setError("invalidDetails");
      return;
    }
    if (!countryOptionFromCode(flag) && !legacyFlag) {
      setError("invalidFlag");
      flagRef.current?.querySelector("input")?.focus();
      return;
    }
    const payload = new FormData();
    payload.set("name", name.trim()); payload.set("yachtType", yachtType);
    payload.set("model", model.trim()); payload.set("crewSize", String(crew)); payload.set("flag", flag);
    if (photo) payload.set("photo", photo);
    if (removePhoto) payload.set("removePhoto", "true");
    setSaving(true);
    try {
      const result = await yachtRequest(yacht ? `/api/yachts/${yacht.id}` : "/api/yachts", { method: yacht ? "PATCH" : "POST", body: payload });
      onSaved(result.yacht);
    } catch (failure) {
      const code = failure instanceof YachtRequestError ? failure.code : "";
      setError(code === "photo_too_large" ? "invalidPhoto"
        : ["invalid_photo", "invalid_photo_data", "invalid_photo_type"].includes(code) ? "invalidPhotoData"
        : code === "invalid_flag" ? "invalidFlag"
        : code === "yacht_limit" ? "yachtLimit"
        : code === "yacht_changed" ? "yachtChanged"
        : code === "rate_limited" ? "rateLimited" : "formError");
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="yacht-form-title"
      aria-describedby="yacht-form-help"
      onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget || saving) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}
    >
      <div className={styles.dialogHeader}>
        <div><h2 id="yacht-form-title">{yacht ? c.edit : c.add}</h2><p id="yacht-form-help">{yacht ? c.editHelp : c.formHelp}</p></div>
        <button type="button" className={styles.closeButton} onClick={onClose} disabled={saving} aria-label={c.close}><X size={21} aria-hidden /></button>
      </div>
      <form className={styles.form} onSubmit={(event) => void submit(event)} aria-busy={saving}>
        <div className={styles.formBody}>
          <div className={styles.field}>
            <label htmlFor="yacht-name">{c.name}</label>
            <input ref={nameRef} id="yacht-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} disabled={saving} placeholder={c.namePlaceholder} autoComplete="off" />
          </div>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <label htmlFor="yacht-type">{c.type}</label>
              <select id="yacht-type" value={yachtType} onChange={(event) => setYachtType(event.target.value)} required disabled={saving}>
                <option value="" disabled>{c.selectType}</option>
                {jobYachtTypes.map((type) => <option key={type} value={type}>{formatJobYachtType(type, language)}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="yacht-model">{c.model}</label>
              <input id="yacht-model" value={model} onChange={(event) => setModel(event.target.value)} required maxLength={120} disabled={saving} placeholder={c.modelPlaceholder} autoComplete="off" />
            </div>
            <div className={styles.field}>
              <label htmlFor="yacht-crew-size">{c.crewSize}</label>
              <input id="yacht-crew-size" type="number" value={crewSize} onChange={(event) => setCrewSize(event.target.value)} required min={0} max={999} step={1} inputMode="numeric" disabled={saving} placeholder={c.crewPlaceholder} />
            </div>
            <div ref={flagRef} className={styles.flagField}>
              <CountryFlagField label={c.flag} value={flag} placeholder={c.selectFlag} clearLabel={c.clearFlag} noResults={c.noCountries} disabled={saving} onChange={setFlag} />
              {legacyFlag ? <p className={styles.legacyFlag}>{c.currentFlag}: {flag}. {c.legacyFlagHelp}</p> : null}
            </div>
          </div>
          <div className={styles.photoField}>
            <div className={styles.photoLabel}><span>{c.photo}</span><span>{c.optional}</span></div>
            <div className={styles.uploadArea}>
              <div className={styles.uploadPreview}>
                {currentPhoto ? <Image src={currentPhoto} alt={c.photoAlt} fill unoptimized className={styles.photoImage} sizes="112px" /> : <ImagePlus size={31} strokeWidth={1.4} aria-hidden />}
              </div>
              <div className={styles.uploadDetails}>
                <input ref={fileRef} id="yacht-photo" type="file" accept="image/jpeg,image/png,image/webp,image/avif" className={styles.hiddenInput} disabled={saving} aria-label={c.upload} onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  if (!(yachtPhotoMimeTypes as readonly string[]).includes(file.type) || file.size > maximumYachtPhotoBytes || file.size === 0) { setError("invalidPhoto"); return; }
                  setError(null); setPhoto(file); setRemovePhoto(false);
                }} />
                <button type="button" className={styles.uploadButton} onClick={() => fileRef.current?.click()} disabled={saving}><Upload size={16} aria-hidden />{currentPhoto ? c.replace : c.upload}</button>
                <p>{c.photoHelp}</p>
                {currentPhoto ? <button type="button" className={styles.removeButton} disabled={saving} onClick={() => { setPhoto(null); setRemovePhoto(true); }}>{c.remove}</button> : null}
              </div>
            </div>
          </div>
          {error ? <p ref={errorRef} tabIndex={-1} role="alert" className={styles.formError}>{c[error]}</p> : null}
        </div>
        <div className={styles.formFooter}>
          <button type="button" className={styles.cancelButton} onClick={onClose} disabled={saving}>{c.cancel}</button>
          <button type="submit" className={styles.primaryButton} disabled={saving}>{saving ? <LoaderCircle size={18} className={styles.spinner} aria-hidden /> : null}{saving ? yacht ? c.saving : c.creating : yacht ? c.save : c.add}</button>
        </div>
      </form>
    </dialog>
  );
}
