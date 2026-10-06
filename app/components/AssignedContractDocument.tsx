"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileText, Loader2, RotateCcw } from "lucide-react";
import ContractPdfPreview from "./ContractPdfPreview";
import { parseAssignedContractPayload } from "../lib/contractPayload";
import { supabase } from "../lib/supabase";
import { assignedContractFileName } from "../lib/assignedContractPdf";

export default function AssignedContractDocument({
  contractId, value, status, signedName, signedAt, onReadyChange,
}: {
  contractId: string;
  value?: unknown;
  status?: string;
  signedName?: string | null;
  signedAt?: string | null;
  onReadyChange?: (ready: boolean) => void;
}) {
  const [document, setDocument] = useState<{ blob: Blob; url: string; legacy: boolean } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [validated, setValidated] = useState(false);
  const handleDocumentReady = useCallback((ready: boolean) => {
    setValidated(ready);
    onReadyChange?.(ready);
  }, [onReadyChange]);

  useEffect(() => {
    let disposed = false;
    let objectUrl = "";
    const controller = new AbortController();
    let requestDeadline: ReturnType<typeof setTimeout> | undefined;
    setDocument(null);
    handleDocumentReady(false);
    setError("");
    void (async () => {
      try {
        let source = value;
        if (source === undefined) {
          requestDeadline = setTimeout(() => controller.abort(), 15_000);
          const { data, error: loadError } = await supabase.from("yacht_contracts")
            .select("contract_text").eq("id", contractId)
            .in("status", ["sent_for_signature", "signed"]).abortSignal(controller.signal).maybeSingle();
          clearTimeout(requestDeadline);
          if (loadError || !data) throw new Error("This contract could not be loaded. Please check your connection and try again.");
          source = data.contract_text;
        }
        if (disposed) return;
        const parsed = parseAssignedContractPayload(source);
        const { createAssignedContractPdf } = await import("../lib/assignedContractPdf");
        const blob = await createAssignedContractPdf(source);
        if (disposed) return;
        objectUrl = URL.createObjectURL(blob);
        setDocument({ blob, url: objectUrl, legacy: parsed.documentVersion !== 2 });
      } catch (cause) {
        if (!disposed) setError(cause instanceof Error ? cause.message : "This contract could not be opened. Please try again.");
      } finally {
        clearTimeout(requestDeadline);
      }
    })();
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(requestDeadline);
      // Safari may still be consuming a download after navigation/unmount.
      if (objectUrl) {
        const retiredUrl = objectUrl;
        window.setTimeout(() => URL.revokeObjectURL(retiredUrl), 45_000);
      }
    };
  }, [value, contractId, attempt, handleDocumentReady]);

  return (
    <section className="min-w-0 space-y-4" data-assigned-contract-document={contractId}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5 text-sm font-bold text-[#071f3c]">
          <FileText className="h-5 w-5 shrink-0 text-cyan-700" aria-hidden />
          Contract document
        </div>
        {document && validated ? (
          <a href={document.url} download={assignedContractFileName(contractId)} target="_blank" rel="noopener noreferrer"
            className="bd-primary-action bd-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-4 py-2 text-sm font-bold text-white hover:bg-cyan-800">
            <Download className="h-4 w-4" aria-hidden />Download PDF
          </a>
        ) : (
          <button type="button" disabled className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-500">
            {!document && !error && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Download PDF
          </button>
        )}
      </div>
      {error ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-white p-5 text-sm text-slate-700">
          <p>{error}</p>
          <button type="button" onClick={() => setAttempt((current) => current + 1)} className="bd-focus mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 font-bold text-cyan-800">
            <RotateCcw className="h-4 w-4" aria-hidden />Try again
          </button>
        </div>
      ) : document ? (
        <>
          {document.legacy && <p className="px-1 text-xs leading-5 text-slate-500">Prepared from the saved contract text.</p>}
          <div data-i18n-ignore><ContractPdfPreview blob={document.blob} onDocumentReadyChange={handleDocumentReady} /></div>
        </>
      ) : (
        <div role="status" className="flex min-h-48 items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />Preparing contract PDF…
        </div>
      )}
      {status === "signed" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-950">
          <p className="font-bold">Electronic acceptance recorded</p>
          <p className="mt-1 break-words" data-i18n-ignore>{signedName || "Crew member"}{signedAt ? ` · ${formatContractDate(signedAt)}` : ""}</p>
        </div>
      )}
    </section>
  );
}

export function formatContractDate(value?: string | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
