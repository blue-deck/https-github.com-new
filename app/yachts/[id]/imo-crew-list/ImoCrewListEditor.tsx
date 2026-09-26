"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowDown, ArrowLeft, ArrowUp, Download, Eye, Plus, Trash2, Undo2, X } from "lucide-react";
import { DateTextField } from "../../../components/DateTextField";
import {
  capitalizeImoField, createEmptyImoCrewRow, getImoCrewListFilename,
  IMO_CREW_LIST_MAX_FIELD_LENGTH, IMO_CREW_LIST_MAX_ROWS,
  type ImoCrewListDraft, type ImoCrewRow,
} from "../../../lib/imoCrewList";
import { IMO_CREW_LIST_COLUMNS, IMO_CREW_LIST_CONTENT_WIDTH, IMO_CREW_LIST_DOCUMENT_COLUMN_INDEX, IMO_CREW_LIST_DOCUMENT_GROUP_LABEL, IMO_CREW_LIST_SIGNATURE_LABEL } from "../../../lib/imoCrewListLayout";
import ImoCrewCellEditor from "./ImoCrewCellEditor";
import styles from "./imoCrewList.module.css";

const ImoCrewListPreview = dynamic(() => import("./ImoCrewListPreview"), {
  ssr: false,
  loading: () => <div className={styles.previewLoading} role="status">Loading PDF…</div>,
});

const crewFieldLabels: Partial<Record<keyof ImoCrewRow, string>> = {
  documentType: "Document type",
  documentNumber: "Document number",
  documentExpiry: "Expiry date",
};

type VoyageKey = Exclude<keyof ImoCrewListDraft["voyage"], "movement">;
const voyageBands: { key: VoyageKey; label: string; date?: boolean; fraction: number }[][] = [
  [
    { key: "shipName", label: "1.1 Name of ship", fraction: 40 },
    { key: "imoNumber", label: "1.2 IMO number", fraction: 20 },
    { key: "callSign", label: "1.3 Call sign", fraction: 20 },
    { key: "voyageNumber", label: "1.4 Voyage number", fraction: 20 },
  ],
  [
    { key: "portOfArrivalDeparture", label: "2. Port of arrival / departure", fraction: 65 },
    { key: "arrivalDepartureDate", label: "3. Date of arrival / departure", date: true, fraction: 35 },
  ],
  [
    { key: "flagState", label: "4. Flag State of ship", fraction: 50 },
    { key: "lastPort", label: "5. Last port of call", fraction: 50 },
  ],
];

function prepareInitialDraft(source: ImoCrewListDraft): ImoCrewListDraft {
  return {
    ...source,
    voyage: Object.fromEntries(Object.entries(source.voyage).map(([key, value]) => [key,
      key === "movement" || key.endsWith("Date") ? value : capitalizeImoField(value),
    ])) as ImoCrewListDraft["voyage"],
    crew: source.crew.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key,
      ["id", "dateOfBirth", "documentExpiry"].includes(key) ? value : capitalizeImoField(value),
    ])) as ImoCrewRow),
  };
}

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
  const [draft, setDraft] = useState(() => prepareInitialDraft(initialDraft));
  const [downloadedSnapshot, setDownloadedSnapshot] = useState(() => JSON.stringify(prepareInitialDraft(initialDraft)));
  const [inputRevision, setInputRevision] = useState(0);
  const [downloadedInputRevision, setDownloadedInputRevision] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"preview" | "download" | null>(null);
  const [preview, setPreview] = useState<{ blob: Blob; url: string; filename: string; snapshot: string; inputRevision: number } | null>(null);
  const [removed, setRemoved] = useState<{ row: ImoCrewRow; index: number } | null>(null);
  const [activeRow, setActiveRow] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);
  const [documentScale, setDocumentScale] = useState(1);
  const [activeCellId, setActiveCellId] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const rowDialogRef = useRef<HTMLDialogElement>(null);
  const suppressCellFocus = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const snapshot = JSON.stringify(draft);
  const dirty = snapshot !== downloadedSnapshot || inputRevision !== downloadedInputRevision;
  const editableFields = useMemo(() => {
    const voyage = [...voyageBands.flat(),
      { key: "masterName" as const, label: "Name of signatory", date: false },
      { key: "declarationDate" as const, label: "Date", date: true },
    ].map((field) => ({ id: `voyage-${field.key}`, label: field.label, context: "Vessel & voyage", value: draft.voyage[field.key], date: Boolean(field.date), key: field.key, rowId: undefined as string | undefined }));
    const crew = draft.crew.flatMap((row, index) => IMO_CREW_LIST_COLUMNS.slice(1).map((column) => ({
      id: `crew-${row.id}-${column.key}`, label: crewFieldLabels[column.key as keyof ImoCrewRow] || column.label.replace(/^\d+\.\s*/, ""),
      context: `${tr ? "Personel" : "Crew member"} ${index + 1}`, value: row[column.key as keyof ImoCrewRow],
      date: column.key === "dateOfBirth" || column.key === "documentExpiry", key: column.key, rowId: row.id,
    })));
    return [...voyage.slice(0, 8), ...crew, ...voyage.slice(8)];
  }, [draft, tr]);
  const activeCellIndex = editableFields.findIndex((field) => field.id === activeCellId);
  const activeCell = editableFields[activeCellIndex];
  const activeRowIndex = draft.crew.findIndex((row) => row.id === activeRow);
  const dateError = copy("Enter a valid date in DD/MM/YYYY format.", "GG/AA/YYYY biçiminde geçerli bir tarih girin.");

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

  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const query = window.matchMedia("(max-width: 1100px)");
    const measure = () => {
      setCompact(query.matches);
      setDocumentScale(query.matches ? Math.min(1, element.clientWidth / 1120) : 1);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    query.addEventListener("change", measure);
    measure();
    return () => { observer.disconnect(); query.removeEventListener("change", measure); };
  }, []);

  useEffect(() => {
    if (compact && activeRow && rowDialogRef.current && !rowDialogRef.current.open) rowDialogRef.current.showModal();
  }, [compact, activeRow]);

  function closeCell() {
    suppressCellFocus.current = true;
    setActiveCellId(null);
    window.setTimeout(() => { suppressCellFocus.current = false; }, 0);
  }

  function commitCell(value: string, direction: -1 | 0 | 1) {
    if (!activeCell) return;
    const { key, rowId } = activeCell;
    if (value !== activeCell.value) changeDraft((current) => rowId
      ? { ...current, crew: current.crew.map((row) => row.id === rowId ? { ...row, [key]: value } : row) }
      : { ...current, voyage: { ...current.voyage, [key]: value } });
    if (direction === 0) closeCell();
    else {
      suppressCellFocus.current = true;
      setActiveCellId(editableFields[activeCellIndex + direction]?.id || null);
      window.setTimeout(() => { suppressCellFocus.current = false; }, 0);
    }
  }

  function changeDraft(update: (current: ImoCrewListDraft) => ImoCrewListDraft) {
    setDraft(update);
    setError("");
  }

  function changeVoyage(key: VoyageKey, value: string) {
    changeDraft((current) => ({ ...current, voyage: { ...current.voyage, [key]: value } }));
  }

  function addCrew() {
    if (draft.crew.length >= IMO_CREW_LIST_MAX_ROWS) return;
    const row = createEmptyImoCrewRow();
    changeDraft((current) => ({ ...current, crew: [...current.crew, row] }));
    if (compact) setActiveCellId(`crew-${row.id}-fullName`);
    else requestAnimationFrame(() => document.getElementById(`crew-${row.id}-fullName`)?.focus());
  }

  function moveCrew(index: number, direction: number) {
    changeDraft((current) => {
      const crew = [...current.crew];
      const target = index + direction;
      if (target < 0 || target >= crew.length) return current;
      [crew[index], crew[target]] = [crew[target], crew[index]];
      return { ...current, crew };
    });
    setActiveRow(null);
  }

  async function exportPdf(mode: "preview" | "download") {
    if (busyRef.current || !formRef.current?.reportValidity()) return;
    busyRef.current = true;
    setBusy(mode);
    setError("");
    try {
      const { createImoCrewListPdf } = await import("../../../lib/imoCrewListPdf");
      const blob = await createImoCrewListPdf(draft);
      if (!mountedRef.current) return;
      const filename = getImoCrewListFilename(draft, "pdf");
      if (mode === "preview") setPreview({ blob, url: URL.createObjectURL(blob), filename, snapshot, inputRevision });
      else {
        downloadBlob(blob, filename);
        setDownloadedSnapshot(snapshot);
        setDownloadedInputRevision(inputRevision);
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

  return (
    <main className={`bd-app-page ${styles.page}`} data-i18n-ignore>
      <div className={styles.container}>
        <Link className={styles.back} href={`/yachts/${draft.yachtId}`} onClick={(event) => {
          if (dirty && !window.confirm(copy("Leave this page? Your latest changes have not been downloaded.", "Bu sayfadan çıkılsın mı? Son değişiklikleriniz henüz indirilmedi."))) event.preventDefault();
        }}><ArrowLeft size={15} />{copy("Yacht workspace", "Yat çalışma alanı")}</Link>
        <header className={styles.hero}>
          <h1>IMO Crew List</h1>
          <div className={styles.heroActions}>
            <button type="button" className={styles.secondary} onClick={addCrew} disabled={draft.crew.length >= IMO_CREW_LIST_MAX_ROWS}><Plus size={16} />{copy("Add crew", "Personel ekle")}</button>
            <button type="button" className={styles.secondary} disabled={!!busy} onClick={() => void exportPdf("preview")}><Eye size={16} />{busy === "preview" ? copy("Preparing…", "Hazırlanıyor…") : copy("Preview", "Önizleme")}</button>
            <button type="button" className={styles.primary} disabled={!!busy} onClick={() => void exportPdf("download")}><Download size={16} />{busy === "download" ? copy("Preparing…", "Hazırlanıyor…") : copy("Download PDF", "PDF indir")}</button>
          </div>
        </header>
        {error && <div className={styles.error} role="alert">{error}</div>}
        <div ref={viewportRef} className={styles.documentViewport} style={{ "--document-scale": documentScale } as CSSProperties} role="region" aria-label={copy("Editable crew list document", "Doldurulabilir mürettebat listesi belgesi")} tabIndex={0}>
          <form ref={formRef} className={styles.paper} lang="en" onSubmit={(event) => event.preventDefault()} onInputCapture={() => setInputRevision((current) => current + 1)} onClickCapture={(event) => {
            if (!compact || event.button !== 0) return;
            const cell = (event.target as HTMLElement).closest<HTMLElement>("[data-cell-id]");
            if (!cell) return;
            event.preventDefault();
            setActiveCellId(cell.dataset.cellId || null);
          }} onFocusCapture={(event) => {
            if (!compact || suppressCellFocus.current || !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) return;
            const cell = event.target.closest<HTMLElement>("[data-cell-id]");
            if (cell) setActiveCellId(cell.dataset.cellId || null);
          }} aria-label="IMO Crew List">
            <div className={styles.paperHeading}><h2>CREW LIST</h2><span>IMO FAL Form 5</span></div>
            <fieldset className={styles.movement}>
              <legend className={styles.srOnly}>Arrival or departure</legend>
              {(["arrival", "departure"] as const).map((movement) => <label key={movement}><input type="radio" name="movement" value={movement} checked={draft.voyage.movement === movement} onChange={() => changeDraft((current) => ({ ...current, voyage: { ...current.voyage, movement } }))} /><span>{movement === "arrival" ? "Arrival" : "Departure"}</span></label>)}
            </fieldset>
            <div className={styles.voyageGrid}>
              {voyageBands.map((band, index) => <div className={styles.voyageBand} key={index} data-band={index} style={{ gridTemplateColumns: band.map((field) => `${field.fraction}fr`).join(" ") }}>
                {band.map((field) => <DocumentField key={field.key} id={`voyage-${field.key}`} label={field.label} value={draft.voyage[field.key]} date={field.date} dateError={dateError} onChange={(value) => changeVoyage(field.key, value)} />)}
              </div>)}
            </div>
            <table className={styles.crewTable}>
              <caption className={styles.srOnly}>Crew details</caption>
              <colgroup>{IMO_CREW_LIST_COLUMNS.map((column) => <col key={column.key} style={{ width: `${column.width / IMO_CREW_LIST_CONTENT_WIDTH * 100}%` }} />)}</colgroup>
              <thead>
                <tr>{IMO_CREW_LIST_COLUMNS.slice(0, IMO_CREW_LIST_DOCUMENT_COLUMN_INDEX).map((column) => <th key={column.key} scope="col" rowSpan={2}>{column.label}</th>)}<th scope="colgroup" colSpan={3}>{IMO_CREW_LIST_DOCUMENT_GROUP_LABEL}</th></tr>
                <tr>{IMO_CREW_LIST_COLUMNS.slice(IMO_CREW_LIST_DOCUMENT_COLUMN_INDEX).map((column) => <th key={column.key} scope="col">{column.label}</th>)}</tr>
              </thead>
              <tbody>
                {draft.crew.map((row, index) => <tr key={row.id} aria-label={copy(`Crew member ${index + 1}`, `Personel ${index + 1}`)}>
                  <td className={styles.sequence}>
                    <div className={styles.rowTools} onBlur={(event) => { if (!compact && !event.currentTarget.contains(event.relatedTarget)) setActiveRow(null); }} onKeyDown={(event) => { if (event.key === "Escape") { setActiveRow(null); event.currentTarget.querySelector("button")?.focus(); } }}>
                      <button type="button" className={styles.rowTrigger} aria-label={copy(`Crew member ${index + 1} actions`, `Personel ${index + 1} işlemleri`)} aria-expanded={activeRow === row.id} aria-controls={`actions-${row.id}`} title={copy("Row actions", "Satır işlemleri")} onClick={() => setActiveRow(activeRow === row.id ? null : row.id)}><span className={styles.rowIndex}>{index + 1}</span><span aria-hidden="true">···</span></button>
                      {activeRow === row.id && !compact && <div id={`actions-${row.id}`} className={styles.rowActions}>
                        <button type="button" disabled={index === 0} onClick={() => moveCrew(index, -1)}><ArrowUp size={14} />{copy("Move up", "Yukarı taşı")}</button>
                        <button type="button" disabled={index === draft.crew.length - 1} onClick={() => moveCrew(index, 1)}><ArrowDown size={14} />{copy("Move down", "Aşağı taşı")}</button>
                        <button type="button" className={styles.remove} onClick={() => { setRemoved({ row, index }); setActiveRow(null); changeDraft((current) => ({ ...current, crew: current.crew.filter((member) => member.id !== row.id) })); }}><Trash2 size={14} />{copy("Remove", "Sil")}</button>
                      </div>}
                    </div>
                  </td>
                  {IMO_CREW_LIST_COLUMNS.slice(1).map((column) => <td key={column.key} data-field={column.key}><DocumentField id={`crew-${row.id}-${column.key}`} label={crewFieldLabels[column.key as keyof ImoCrewRow] || column.label.replace(/^\d+\.\s*/, "")} hiddenLabel value={row[column.key as keyof ImoCrewRow]} date={column.key === "dateOfBirth" || column.key === "documentExpiry"} dateError={dateError} onChange={(value) => changeDraft((current) => ({ ...current, crew: current.crew.map((member) => member.id === row.id ? { ...member, [column.key]: value } : member) }))} /></td>)}
                </tr>)}
                {Array.from({ length: Math.max(0, 6 - draft.crew.length) }, (_, index) => <tr className={styles.blankRow} key={`blank-${index}`} aria-hidden="true">{IMO_CREW_LIST_COLUMNS.map((column) => <td key={column.key}>&nbsp;</td>)}</tr>)}
              </tbody>
            </table>
            <div className={styles.declaration}>
              <p>{IMO_CREW_LIST_SIGNATURE_LABEL}</p>
              <div className={styles.signatureFields}>
                <DocumentField id="voyage-masterName" label="Name of signatory" value={draft.voyage.masterName} onChange={(value) => changeVoyage("masterName", value)} />
                <DocumentField id="voyage-declarationDate" label="Date" value={draft.voyage.declarationDate} date dateError={dateError} onChange={(value) => changeVoyage("declarationDate", value)} />
                <div className={styles.signature}><span>Signature</span><div /></div>
              </div>
            </div>
          </form>
        </div>
        {removed && <div className={styles.undoBar}><button type="button" disabled={draft.crew.length >= IMO_CREW_LIST_MAX_ROWS} onClick={() => { changeDraft((current) => { const crew = [...current.crew]; crew.splice(Math.min(removed.index, crew.length), 0, removed.row); return { ...current, crew }; }); setRemoved(null); }}><Undo2 size={15} />{copy("Undo last removal", "Son silmeyi geri al")}</button></div>}
      </div>
      {activeCell && <ImoCrewCellEditor key={activeCell.id} field={activeCell} language={language} hasPrevious={activeCellIndex > 0} hasNext={activeCellIndex < editableFields.length - 1} onCommit={commitCell} onClose={closeCell} />}
      {compact && activeRowIndex >= 0 && <dialog ref={rowDialogRef} className={styles.rowDialog} aria-labelledby="crew-actions-title" onCancel={() => setActiveRow(null)} onClose={() => setActiveRow(null)}>
        <header><h2 id="crew-actions-title">{copy(`Crew member ${activeRowIndex + 1}`, `Personel ${activeRowIndex + 1}`)}</h2><button type="button" aria-label={copy("Close", "Kapat")} onClick={() => setActiveRow(null)}><X size={20} /></button></header>
        <button type="button" disabled={activeRowIndex === 0} onClick={() => moveCrew(activeRowIndex, -1)}><ArrowUp size={17} />{copy("Move up", "Yukarı taşı")}</button>
        <button type="button" disabled={activeRowIndex === draft.crew.length - 1} onClick={() => moveCrew(activeRowIndex, 1)}><ArrowDown size={17} />{copy("Move down", "Aşağı taşı")}</button>
        <button type="button" className={styles.remove} onClick={() => { const row = draft.crew[activeRowIndex]; setRemoved({ row, index: activeRowIndex }); changeDraft((current) => ({ ...current, crew: current.crew.filter((member) => member.id !== row.id) })); setActiveRow(null); }}><Trash2 size={17} />{copy("Remove", "Sil")}</button>
      </dialog>}
      {preview && <dialog ref={dialogRef} className={styles.previewDialog} onCancel={() => setPreview(null)} onClose={() => setPreview(null)}>
        <div className={styles.previewHeader}><h2>{copy("Document preview", "Belge önizlemesi")}</h2><a className={styles.primary} href={preview.url} download={preview.filename} onClick={() => { setDownloadedSnapshot(preview.snapshot); setDownloadedInputRevision(preview.inputRevision); }}><Download size={16} />{copy("Download PDF", "PDF indir")}</a><button type="button" className={styles.close} aria-label={copy("Close preview", "Önizlemeyi kapat")} onClick={() => setPreview(null)}><X size={20} /></button></div>
        <ImoCrewListPreview blob={preview.blob} language={language} />
      </dialog>}
    </main>
  );
}

function DocumentField({ id, label, value, onChange, date = false, hiddenLabel = false, dateError }: {
  id: string; label: string; value: string; onChange: (value: string) => void; date?: boolean; hiddenLabel?: boolean; dateError?: string;
}) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const input = textRef.current;
    if (!input) return;
    const resize = () => {
      input.style.height = "auto";
      input.style.height = `${input.scrollHeight + 2}px`;
    };
    resize();
    let width = input.clientWidth;
    const observer = new ResizeObserver(() => {
      if (width === input.clientWidth) return;
      width = input.clientWidth;
      resize();
    });
    observer.observe(input);
    return () => observer.disconnect();
  }, [value]);
  const labelClass = hiddenLabel ? styles.srOnly : styles.fieldLabel;
  if (date) return <div className={styles.field} data-cell-id={id}><DateTextField label={label} value={value} onChange={onChange} placeholder="DD/MM/YYYY" invalidText={dateError} autoComplete="off" className={styles.field} labelClassName={labelClass} inputClassName={styles.dateInput} /></div>;
  return <div className={styles.field} data-cell-id={id}>
    <label htmlFor={id} className={labelClass}>{label}</label>
    <textarea ref={textRef} id={id} value={value} rows={1} onChange={(event) => {
      const input = event.currentTarget;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const next = capitalizeImoField(input.value.replace(/[\r\n]+/g, " "));
      onChange(next);
      if (next !== input.value) requestAnimationFrame(() => input.setSelectionRange(start, end));
    }} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} maxLength={IMO_CREW_LIST_MAX_FIELD_LENGTH} autoCapitalize="sentences" autoComplete="off" spellCheck={false} className={styles.textInput} />
  </div>;
}
