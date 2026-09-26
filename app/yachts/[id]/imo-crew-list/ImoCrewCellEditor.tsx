"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { DateTextField } from "../../../components/DateTextField";
import { capitalizeImoField, IMO_CREW_LIST_MAX_FIELD_LENGTH } from "../../../lib/imoCrewList";
import styles from "./ImoCrewCellEditor.module.css";

type CrewCellField = {
  id: string;
  label: string;
  context: string;
  value: string;
  date: boolean;
};

type ImoCrewCellEditorProps = {
  field: CrewCellField;
  language: string;
  hasPrevious: boolean;
  hasNext: boolean;
  onCommit: (value: string, direction: -1 | 0 | 1) => void;
  onClose: () => void;
};

export default function ImoCrewCellEditor({ field, language, hasPrevious, hasNext, onCommit, onClose }: ImoCrewCellEditorProps) {
  const tr = language === "tr";
  const [value, setValue] = useState(() => field.date ? field.value : capitalizeImoField(field.value));
  const [showError, setShowError] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const focusedRef = useRef(false);
  const titleId = useId();
  const contextId = useId();
  const inputId = useId();
  const errorId = useId();
  const invalidDate = tr ? "GG/AA/YYYY biçiminde geçerli bir tarih girin." : "Enter a valid date in DD/MM/YYYY format.";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    if (!focusedRef.current) {
      formRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
      focusedRef.current = true;
    }

    const viewport = window.visualViewport;
    const fitViewport = () => {
      const height = viewport?.height ?? window.innerHeight;
      const bottom = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      dialog.style.setProperty("--cell-editor-bottom", `${bottom}px`);
      dialog.style.setProperty("--cell-editor-height", `${Math.max(120, height - 16)}px`);
    };
    fitViewport();
    viewport?.addEventListener("resize", fitViewport);
    viewport?.addEventListener("scroll", fitViewport);
    window.addEventListener("resize", fitViewport);
    return () => {
      viewport?.removeEventListener("resize", fitViewport);
      viewport?.removeEventListener("scroll", fitViewport);
      window.removeEventListener("resize", fitViewport);
    };
  }, []);

  function commit(direction: -1 | 0 | 1) {
    if (!formRef.current?.reportValidity()) {
      setShowError(true);
      return;
    }
    onCommit(value, direction);
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.sheet}
      aria-labelledby={titleId}
      aria-describedby={contextId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
    >
      <form
        ref={formRef}
        onSubmit={(event) => { event.preventDefault(); commit(0); }}
        onInputCapture={() => setShowError(false)}
        onInvalidCapture={() => setShowError(true)}
      >
        <header className={styles.header}>
          <div>
            <p id={contextId} className={styles.context}>{field.context}</p>
            <h2 id={titleId}>{field.label}</h2>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label={tr ? "Değişiklikleri iptal et ve kapat" : "Discard changes and close"}><X size={21} /></button>
        </header>
        <div className={styles.body}>
          {field.date ? <DateTextField
            label={field.label}
            value={value}
            onChange={setValue}
            placeholder="DD/MM/YYYY"
            invalidText={invalidDate}
            autoComplete="off"
            className={styles.field}
            labelClassName={styles.srOnly}
            inputClassName={styles.input}
          /> : <div className={styles.field}>
            <label htmlFor={inputId} className={styles.srOnly}>{field.label}</label>
            <input
              id={inputId}
              className={styles.input}
              type="text"
              value={value}
              onChange={(event) => setValue(capitalizeImoField(event.target.value.replace(/[\r\n]+/g, " ")))}
              maxLength={IMO_CREW_LIST_MAX_FIELD_LENGTH}
              autoComplete="off"
              autoCapitalize="sentences"
              spellCheck={false}
              enterKeyHint="done"
              aria-describedby={showError ? errorId : undefined}
            />
          </div>}
          {showError && <p id={errorId} className={styles.error} role="alert">{field.date ? invalidDate : (tr ? "Devam etmeden önce bu alanı kontrol edin." : "Check this field before continuing.")}</p>}
        </div>
        <footer className={styles.footer}>
          <div className={styles.navigation}>
            <button type="button" disabled={!hasPrevious} onClick={() => commit(-1)} aria-label={tr ? "Kaydet ve önceki alana geç" : "Save and move to previous field"}><ChevronLeft size={18} /><span>{tr ? "Önceki" : "Previous"}</span></button>
            <button type="button" disabled={!hasNext} onClick={() => commit(1)} aria-label={tr ? "Kaydet ve sonraki alana geç" : "Save and move to next field"}><span>{tr ? "Sonraki" : "Next"}</span><ChevronRight size={18} /></button>
          </div>
          <button type="submit" className={styles.done}><Check size={18} />{tr ? "Tamam" : "Done"}</button>
        </footer>
      </form>
    </dialog>
  );
}
