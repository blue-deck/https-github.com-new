"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Check, ChevronRight, ClipboardCheck, Download, Eye, FileDown, FileText, FolderOpen, Plus, Ship, Trash2, Undo2, Users, X } from "lucide-react";
import {
  createEmptyImoCrewRow, getImoCrewListFilename, getImoCrewListIssues,
  IMO_CREW_LIST_MAX_FIELD_LENGTH, IMO_CREW_LIST_MAX_FILE_BYTES, IMO_CREW_LIST_MAX_ROWS,
  parseImoCrewListDraft, serializeImoCrewListDraft,
  type ImoCrewListDraft, type ImoCrewRow,
} from "../../../lib/imoCrewList";
import styles from "./imoCrewList.module.css";

type FieldDefinition = { key: string; en: string; tr: string; type?: "date"; hint?: [string, string] };
const vesselFields: FieldDefinition[] = [
  { key: "shipName", en: "Name of ship", tr: "Gemi adı" },
  { key: "flagState", en: "Flag State", tr: "Bayrak devleti" },
  { key: "imoNumber", en: "IMO number", tr: "IMO numarası", hint: ["If assigned", "Varsa"] },
  { key: "callSign", en: "Call sign", tr: "Çağrı işareti" },
  { key: "voyageNumber", en: "Voyage number", tr: "Sefer numarası" },
  { key: "portOfArrivalDeparture", en: "Port of arrival / departure", tr: "Geliş / gidiş limanı" },
  { key: "arrivalDepartureDate", en: "Date of arrival / departure", tr: "Geliş / gidiş tarihi", type: "date" },
  { key: "lastPort", en: "Last port of call", tr: "Son uğranan liman" },
];
const crewFieldGroups: FieldDefinition[][] = [
  [{ key: "familyName", en: "Family name", tr: "Soyadı" }, { key: "givenNames", en: "Given names", tr: "Adı" }],
  [{ key: "rank", en: "Rank or rating", tr: "Görevi / rütbesi" }, { key: "nationality", en: "Nationality", tr: "Uyruğu" }],
  [{ key: "dateOfBirth", en: "Date of birth", tr: "Doğum tarihi", type: "date" }, { key: "placeOfBirth", en: "Place of birth", tr: "Doğum yeri" }],
  [{ key: "gender", en: "Gender", tr: "Cinsiyet" }, { key: "documentType", en: "Document type", tr: "Belge türü" }],
  [{ key: "documentNumber", en: "Document number", tr: "Belge numarası" }, { key: "issuingState", en: "Issuing State", tr: "Belgeyi veren devlet" }],
  [{ key: "documentExpiry", en: "Document expiry", tr: "Belge geçerlilik tarihi", type: "date" }],
];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export default function ImoCrewListEditor({ initialDraft, language }: { initialDraft: ImoCrewListDraft; language: string }) {
  const tr = language === "tr";
  const copy = (en: string, turkish: string) => tr ? turkish : en;
  const [draft, setDraft] = useState(initialDraft);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initialDraft));
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState<"preview" | "download" | null>(null);
  const [preview, setPreview] = useState<{ url: string; filename: string } | null>(null);
  const [removed, setRemoved] = useState<{ row: ImoCrewRow; index: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const snapshot = useMemo(() => JSON.stringify(draft), [draft]);
  const dirty = snapshot !== savedSnapshot;
  const issues = useMemo(() => getImoCrewListIssues(draft), [draft]);
  const missingCount = issues.filter((issue) => issue.kind === "missing").length;
  const checkCount = issues.length - missingCount;
  const issueMap = useMemo(() => new Map(issues.map((issue) => [`${issue.rowId || "voyage"}:${issue.field}`, issue.kind])), [issues]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!preview) return;
    dialogRef.current?.showModal();
    return () => URL.revokeObjectURL(preview.url);
  }, [preview]);

  function changeDraft(update: (current: ImoCrewListDraft) => ImoCrewListDraft) {
    setDraft(update);
    setNotice("");
    setError("");
  }

  function addCrew() {
    if (draft.crew.length >= IMO_CREW_LIST_MAX_ROWS) return;
    const row = createEmptyImoCrewRow();
    changeDraft((current) => ({ ...current, crew: [...current.crew, row] }));
    requestAnimationFrame(() => document.getElementById(`crew-${row.id}-familyName`)?.focus());
  }

  function moveCrew(index: number, direction: number) {
    changeDraft((current) => {
      const crew = [...current.crew];
      const target = index + direction;
      if (target < 0 || target >= crew.length) return current;
      [crew[index], crew[target]] = [crew[target], crew[index]];
      return { ...current, crew };
    });
  }

  function saveDraft() {
    try {
      downloadBlob(new Blob([serializeImoCrewListDraft(draft)], { type: "application/json" }), getImoCrewListFilename(draft, "json"));
      setSavedSnapshot(snapshot);
      setError("");
      setNotice(copy("Draft downloaded. Use Open draft to continue later.", "Taslak indirildi. Daha sonra devam etmek için Taslak aç’ı kullanın."));
    } catch {
      setError(copy("The draft could not be downloaded. Check dates and remove special formatting from pasted values, then try again.", "Taslak indirilemedi. Tarihleri kontrol edin ve yapıştırılan değerlerdeki özel biçimlendirmeyi kaldırıp yeniden deneyin."));
    }
  }

  async function importDraft(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > IMO_CREW_LIST_MAX_FILE_BYTES) throw new Error("size");
      const imported = parseImoCrewListDraft(await file.text(), draft.yachtId);
      if (!mountedRef.current) return;
      if (dirty && !window.confirm(copy("Replace the current edits with this draft? Download your draft first to keep them.", "Mevcut değişiklikler bu taslakla değiştirilsin mi? Korumak için önce taslağınızı indirin."))) return;
      setDraft(imported);
      setSavedSnapshot(JSON.stringify(imported));
      setRemoved(null);
      setReview(false);
      setError("");
      setNotice(copy("Draft opened. Review the voyage date and crew details before exporting.", "Taslak açıldı. İndirmeden önce sefer tarihini ve personel bilgilerini kontrol edin."));
    } catch {
      setError(copy("This file could not be opened. Choose a valid BlueDeck crew list draft for this yacht (up to 1 MB).", "Dosya açılamadı. Bu yata ait geçerli bir BlueDeck mürettebat listesi taslağı seçin (en fazla 1 MB)."));
    }
  }

  async function exportPdf(mode: "preview" | "download") {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(mode);
    setError("");
    try {
      const { createImoCrewListPdf } = await import("../../../lib/imoCrewListPdf");
      const blob = await createImoCrewListPdf(draft);
      if (!mountedRef.current) return;
      const filename = getImoCrewListFilename(draft, "pdf");
      if (mode === "preview") setPreview({ url: URL.createObjectURL(blob), filename });
      else {
        downloadBlob(blob, filename);
        setNotice(copy("PDF downloaded. Keep a draft file if you want to edit this list later.", "PDF indirildi. Bu listeyi daha sonra düzenlemek için taslak dosyasını da saklayın."));
      }
    } catch (exportError) {
      if (mountedRef.current) {
        const message = exportError instanceof Error ? exportError.message : "";
        setError(message.includes("Latin spelling")
          ? copy("Some characters cannot be printed. Use the Latin spelling shown in the travel document.", "Bazı karakterler yazdırılamıyor. Seyahat belgesinde yer alan Latin harfli yazımı kullanın.")
          : message.includes("too long")
            ? copy("Some voyage details are too long to fit. Shorten them and try again.", "Bazı sefer bilgileri sayfaya sığmıyor. Kısaltıp yeniden deneyin.")
            : copy("The PDF could not be prepared. Please check your connection and try again.", "PDF hazırlanamadı. Bağlantınızı kontrol edip yeniden deneyin."));
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(null);
    }
  }

  function fieldIssue(field: string, rowId?: string) {
    if (!review) return undefined;
    const kind = issueMap.get(`${rowId || "voyage"}:${field}`);
    return kind === "missing" ? copy("Complete this field", "Bu alanı doldurun")
      : kind === "expired" ? copy("Expires before the voyage date", "Sefer tarihinden önce geçerliliği bitiyor")
      : kind === "invalid" ? copy("Check this value", "Bu değeri kontrol edin") : undefined;
  }

  return (
    <main className={`bd-app-page ${styles.page}`} data-i18n-ignore>
      <div className={styles.container}>
        <div className={styles.breadcrumb}>
          <Link className={styles.back} href={`/yachts/${draft.yachtId}`} onClick={(event) => {
            if (dirty && !window.confirm(copy("Leave without downloading your latest draft?", "Son taslağınızı indirmeden çıkmak istiyor musunuz?"))) event.preventDefault();
          }}><ArrowLeft size={15} />{copy("Yacht workspace", "Yat çalışma alanı")}</Link>
          <ChevronRight size={13} /><span>{initialDraft.voyage.shipName || copy("Yacht", "Yat")}</span>
        </div>

        <header className={styles.hero}>
          <div>
            <p className={styles.kicker}>{copy("CAPTAIN’S DOCUMENTS", "KAPTAN BELGELERİ")} <span /> IMO FAL 5</p>
            <h1>IMO Crew List<span>.</span></h1>
            <p className={styles.description}>{copy("A clear record of everyone on board. Prepare your crew list, review the details and take it with you.", "Gemideki herkes için eksiksiz bir kayıt. Mürettebat listenizi hazırlayın, bilgileri kontrol edin ve indirin.")}</p>
          </div>
          <div className={styles.heroActions}>
            <button className={styles.secondary} disabled={!!busy} onClick={() => void exportPdf("preview")}><Eye size={17} />{busy === "preview" ? copy("Preparing…", "Hazırlanıyor…") : copy("Preview", "Önizleme")}</button>
            <button className={styles.primary} disabled={!!busy} onClick={() => void exportPdf("download")}><Download size={17} />{busy === "download" ? copy("Preparing…", "Hazırlanıyor…") : copy("Download PDF", "PDF indir")}</button>
          </div>
        </header>

        <div className={styles.workspaceBar}>
          <div><span className={styles.statusDot} /><strong>{copy("Editable document", "Düzenlenebilir belge")}</strong><span className={styles.barHint}>{copy("A4 landscape · English PDF", "A4 yatay · İngilizce PDF")}</span></div>
          <div className={styles.draftActions}>
            <button onClick={() => fileInput.current?.click()}><FolderOpen size={16} />{copy("Open draft", "Taslak aç")}</button>
            <button onClick={saveDraft}><FileDown size={16} />{copy("Download draft", "Taslak indir")}{dirty && <span className={styles.unsavedDot} aria-label={copy("Unsaved edits", "Kaydedilmemiş değişiklikler")} />}</button>
            <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={(event) => void importDraft(event)} aria-label={copy("Open crew list draft", "Mürettebat listesi taslağını aç")} />
          </div>
        </div>

        {error && <div className={styles.error} role="alert">{error}</div>}
        {notice && <div className={styles.notice} role="status"><Check size={17} />{notice}</div>}

        <div className={styles.topGrid}>
          <section className={styles.card} aria-labelledby="voyage-title">
            <div className={styles.sectionHeader}><div className={styles.sectionIcon}><Ship size={20} /></div><div><p className={styles.step}>{copy("01 / VESSEL & VOYAGE", "01 / GEMİ VE SEFER")}</p><h2 id="voyage-title">{copy("Set the voyage details", "Sefer bilgilerini hazırlayın")}</h2></div></div>
            <fieldset className={styles.movement}><legend>{copy("Declaration for", "Beyan türü")}</legend>{(["arrival", "departure"] as const).map((movement) => <label key={movement} className={draft.voyage.movement === movement ? styles.movementActive : ""}><input type="radio" name="movement" value={movement} checked={draft.voyage.movement === movement} onChange={() => changeDraft((current) => ({ ...current, voyage: { ...current.voyage, movement } }))} />{movement === "arrival" ? copy("Arrival", "Geliş") : copy("Departure", "Gidiş")}</label>)}</fieldset>
            <div className={styles.voyageFields}>
              {vesselFields.map((field) => <InputField key={field.key} id={`voyage-${field.key}`} label={tr ? field.tr : field.en} value={draft.voyage[field.key as keyof typeof draft.voyage]} type={field.type} hint={field.hint?.[tr ? 1 : 0]} issue={fieldIssue(field.key)} onChange={(value) => changeDraft((current) => ({ ...current, voyage: { ...current.voyage, [field.key]: value } }))} />)}
            </div>
          </section>

          <aside className={styles.sideCard} aria-labelledby="document-title">
            <div className={styles.documentIcon}><FileText size={28} strokeWidth={1.4} /></div>
            <p className={styles.step}>IMO FAL FORM 5</p>
            <h2 id="document-title">{copy("Ready for your next port", "Bir sonraki limana hazır")}</h2>
            <p>{copy("Your vessel and active crew details are prefilled. Complete the voyage and check each person’s identity document.", "Gemi ve aktif mürettebat bilgileri hazır gelir. Sefer bilgilerini tamamlayın ve her personelin kimlik belgesini kontrol edin.")}</p>
            <div className={styles.metrics}><div><strong>{String(draft.crew.length).padStart(2, "0")}</strong><span>{copy("Crew on list", "Listedeki personel")}</span></div><div><strong>{String(missingCount).padStart(2, "0")}</strong><span>{copy("Empty fields", "Boş alan")}</span></div></div>
            <button className={styles.reviewButton} onClick={() => { setReview((value) => !value); }}><ClipboardCheck size={17} />{review ? copy("Hide field checks", "Alan kontrollerini gizle") : copy("Review fields", "Alanları kontrol et")}<ChevronRight size={16} /></button>
            {review && <p role="status" className={styles.reviewSummary}>{issues.length === 0 ? copy("All checked fields are complete.", "Kontrol edilen tüm alanlar tamam.") : copy(`${missingCount} empty fields · ${checkCount} values to check. You can still download an incomplete form.`, `${missingCount} boş alan · kontrol edilecek ${checkCount} değer. Eksik formu da indirebilirsiniz.`)}</p>}
            <p className={styles.smallNote}>{copy("Edits stay on this page. Download a draft to keep them and reopen it later.", "Düzenlemeler bu sayfada tutulur. Saklamak ve daha sonra açmak için taslağı indirin.")}</p>
          </aside>
        </div>

        <section className={styles.card} aria-labelledby="crew-title">
          <div className={`${styles.sectionHeader} ${styles.crewHeader}`}><div className={styles.sectionIcon}><Users size={20} /></div><div><p className={styles.step}>{copy("02 / CREW DETAILS", "02 / MÜRETTEBAT BİLGİLERİ")}</p><h2 id="crew-title">{copy("The people on board", "Gemideki personel")} <span className={styles.count}>{draft.crew.length}</span></h2></div><button className={styles.secondary} onClick={addCrew} disabled={draft.crew.length >= IMO_CREW_LIST_MAX_ROWS}><Plus size={17} />{copy("Add crew", "Personel ekle")}</button></div>
          <p className={styles.crewHint}>{copy("Check family and given names against the identity document. Changes here apply only to this document.", "Soyadı ve adı kimlik belgesine göre kontrol edin. Buradaki değişiklikler yalnızca bu belgeye uygulanır.")}</p>
          {draft.crew.length === 0 ? <div className={styles.empty}><Users size={32} strokeWidth={1.3} /><h3>{copy("Start your crew list", "Mürettebat listenizi oluşturun")}</h3><p>{copy("No active crew to import. Add a person manually or open a saved draft.", "Aktarılacak aktif mürettebat yok. Manuel personel ekleyin veya kayıtlı bir taslak açın.")}</p><button className={styles.primary} onClick={addCrew}><Plus size={17} />{copy("Add first crew member", "İlk personeli ekle")}</button></div> : <div className={styles.crewTable}>
            <div className={styles.tableHead} aria-hidden="true"><span>#</span>{(tr ? ["Ad ve soyad", "Görev ve uyruk", "Doğum bilgileri", "Kimlik bilgileri", "Belge bilgileri", "Geçerlilik"] : ["Name", "Role & nationality", "Birth details", "Identity", "Document details", "Validity"]).map((heading) => <span key={heading}>{heading}</span>)}</div>
            {draft.crew.map((row, index) => <div className={styles.crewRow} key={row.id} role="group" aria-label={copy(`Crew member ${index + 1}`, `Personel ${index + 1}`)}>
              <div className={styles.rowNumber}><span>{String(index + 1).padStart(2, "0")}</span><div className={styles.rowActions}><button aria-label={copy(`Move crew member ${index + 1} up`, `Personel ${index + 1} yukarı`)} disabled={index === 0} onClick={() => moveCrew(index, -1)}><ArrowUp size={14} /></button><button aria-label={copy(`Move crew member ${index + 1} down`, `Personel ${index + 1} aşağı`)} disabled={index === draft.crew.length - 1} onClick={() => moveCrew(index, 1)}><ArrowDown size={14} /></button></div></div>
              {crewFieldGroups.map((group, groupIndex) => <div className={styles.fieldStack} key={groupIndex}>{group.map((field) => <InputField key={field.key} id={`crew-${row.id}-${field.key}`} label={tr ? field.tr : field.en} value={row[field.key as keyof ImoCrewRow]} type={field.type} issue={fieldIssue(field.key, row.id)} onChange={(value) => changeDraft((current) => ({ ...current, crew: current.crew.map((member) => member.id === row.id ? { ...member, [field.key]: value } : member) }))} />)}{groupIndex === crewFieldGroups.length - 1 && <button className={styles.remove} aria-label={copy(`Remove crew member ${index + 1}`, `Personel ${index + 1} sil`)} onClick={() => { setRemoved({ row, index }); changeDraft((current) => ({ ...current, crew: current.crew.filter((member) => member.id !== row.id) })); }}><Trash2 size={14} />{copy("Remove", "Sil")}</button>}</div>)}
            </div>)}
          </div>}
          <div className={styles.tableFooter}><span>{copy(`${draft.crew.length} / ${IMO_CREW_LIST_MAX_ROWS} crew members`, `${draft.crew.length} / ${IMO_CREW_LIST_MAX_ROWS} personel`)}</span>{removed && <button disabled={draft.crew.length >= IMO_CREW_LIST_MAX_ROWS} onClick={() => { changeDraft((current) => { const crew = [...current.crew]; crew.splice(Math.min(removed.index, crew.length), 0, removed.row); return { ...current, crew }; }); setRemoved(null); }}><Undo2 size={15} />{copy("Undo last removal", "Son silmeyi geri al")}</button>}</div>
        </section>

        <section className={`${styles.card} ${styles.declaration}`} aria-labelledby="declaration-title"><div><p className={styles.step}>{copy("03 / DECLARATION", "03 / BEYAN")}</p><h2 id="declaration-title">{copy("Prepared for signature", "İmza için hazır")}</h2><p>{copy("A signature area is included in the PDF for the master, authorized agent or officer.", "PDF’de kaptan, yetkili acente veya zabit için imza alanı bulunur.")}</p></div><InputField id="voyage-masterName" label={copy("Master / authorized signatory", "Kaptan / yetkili imzalayan")} value={draft.voyage.masterName} issue={fieldIssue("masterName")} onChange={(value) => changeDraft((current) => ({ ...current, voyage: { ...current.voyage, masterName: value } }))} /><InputField id="voyage-declarationDate" label={copy("Declaration date", "Beyan tarihi")} type="date" value={draft.voyage.declarationDate} issue={fieldIssue("declarationDate")} onChange={(value) => changeDraft((current) => ({ ...current, voyage: { ...current.voyage, declarationDate: value } }))} /></section>
        <footer className={styles.footer}><p>{copy("Prepared using the IMO FAL 5 fields. Follow the destination port’s submission requirements.", "IMO FAL 5 alanlarına göre hazırlanır. Varış limanının belge sunum gerekliliklerini takip edin.")}</p><a href="https://www.imo.org/en/ourwork/facilitation/pages/declarationscertificates-default.aspx" target="_blank" rel="noreferrer">{copy("IMO form guidance", "IMO form rehberi")} ↗</a></footer>
      </div>
      {preview && <dialog ref={dialogRef} className={styles.previewDialog} onCancel={() => setPreview(null)} onClose={() => setPreview(null)}><div className={styles.previewHeader}><div><p className={styles.step}>IMO FAL 5</p><h2>{copy("Document preview", "Belge önizlemesi")}</h2></div><a className={styles.primary} href={preview.url} download={preview.filename}><Download size={16} />{copy("Download PDF", "PDF indir")}</a><button className={styles.close} aria-label={copy("Close preview", "Önizlemeyi kapat")} onClick={() => setPreview(null)}><X size={20} /></button></div><iframe title={copy("IMO crew list PDF preview", "IMO mürettebat listesi PDF önizlemesi")} src={preview.url} /><p className={styles.previewHint}>{copy("If the preview is unavailable on your device, download the PDF to open it.", "Cihazınızda önizleme görüntülenmiyorsa PDF’yi indirerek açabilirsiniz.")}</p></dialog>}
    </main>
  );
}

function InputField({ id, label, value, onChange, type = "text", hint, issue }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: "text" | "date"; hint?: string; issue?: string }) {
  return <div className={`${styles.field} ${issue ? styles.fieldIssue : ""}`}><label htmlFor={id}>{label}{hint && <span>{hint}</span>}</label><input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} max={type === "date" ? "9999-12-31" : undefined} maxLength={IMO_CREW_LIST_MAX_FIELD_LENGTH} autoComplete="off" spellCheck={false} aria-invalid={issue ? true : undefined} aria-describedby={issue ? `${id}-issue` : undefined} />{issue && <span id={`${id}-issue`} className={styles.issueText}>{issue}</span>}</div>;
}
