"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabase";
import AssignedContractDocument, { formatContractDate } from "./AssignedContractDocument";

type ContractRecord = {
  id: string;
  crew_profile_id: string;
  membership_id: string | null;
  status: string;
  sent_at: string | null;
  signed_at: string | null;
  signed_name: string | null;
  contract_text?: string;
};

export default function CaptainContractArchive({ yachtId, refreshKey = 0, recipientLabels = {} }: { yachtId: string; refreshKey?: number; recipientLabels?: Record<string, string> }) {
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selected, setSelected] = useState<ContractRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [documentError, setDocumentError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [documentAttempt, setDocumentAttempt] = useState(0);

  useEffect(() => {
    let disposed = false;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const { data, error: queryError } = await supabase.from("yacht_contracts")
          .select("id,crew_profile_id,membership_id,status,sent_at,signed_at,signed_name")
          .eq("yacht_id", yachtId).in("status", ["sent_for_signature", "signed"])
          .order("sent_at", { ascending: false }).order("id", { ascending: false });
        if (queryError) throw queryError;
        if (disposed) return;
        const rows = (data || []) as ContractRecord[];
        setContracts(rows);
        setSelectedId((current) => rows.some((row) => row.id === current) ? current : rows[0]?.id || "");
      } catch {
        if (!disposed) setError("Sent contracts could not be loaded. Please try again.");
      } finally {
        if (!disposed) setLoading(false);
      }
    })();
    return () => { disposed = true; };
  }, [yachtId, refreshKey, attempt]);

  useEffect(() => {
    let disposed = false;
    setSelected(null);
    setDocumentError("");
    if (!selectedId) return;
    void (async () => {
      try {
        const { data, error: queryError } = await supabase.from("yacht_contracts")
          .select("id,crew_profile_id,membership_id,status,sent_at,signed_at,signed_name,contract_text")
          .eq("id", selectedId).eq("yacht_id", yachtId)
          .in("status", ["sent_for_signature", "signed"]).maybeSingle();
        if (queryError || !data) throw queryError || new Error("Missing contract");
        if (!disposed) setSelected(data);
      } catch {
        if (!disposed) setDocumentError("This contract could not be loaded. Please try again.");
      }
    })();
    return () => { disposed = true; };
  }, [selectedId, yachtId, refreshKey, attempt, documentAttempt]);

  return (
    <section className="min-w-0 space-y-5" aria-label="Sent contracts">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-xl font-bold text-[#071f3c]">Sent contracts</h2><p className="mt-1 text-sm leading-6 text-slate-600">Your yacht’s sent contracts and crew acceptance records.</p></div>
        <button type="button" disabled={loading} onClick={() => setAttempt((current) => current + 1)} className="bd-focus inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-cyan-800 disabled:opacity-50"><RefreshCw className="h-4 w-4" aria-hidden />Refresh</button>
      </div>
      {loading ? <p role="status" className="flex items-center gap-2 py-8 text-sm text-slate-600"><Loader2 className="h-5 w-5 animate-spin" aria-hidden />Loading sent contracts…</p>
        : error ? <p role="alert" className="rounded-xl border border-rose-200 bg-white p-4 text-sm text-rose-800">{error}</p>
          : contracts.length === 0 ? <div role="status" className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center"><FileText className="mx-auto h-7 w-7 text-cyan-700" aria-hidden /><p className="mt-3 font-bold text-[#071f3c]">No sent contracts yet</p><p className="mt-2 text-sm text-slate-600">A copy will appear here when you send a contract to a crew member.</p></div>
            : <>
              <div className="grid gap-2 sm:grid-cols-2" aria-label="Choose a sent contract">
                {contracts.map((contract) => {
                  const recipient = contract.membership_id ? recipientLabels[contract.membership_id] : "";
                  return <button key={contract.id} type="button" aria-pressed={selectedId === contract.id} onClick={() => setSelectedId(contract.id)} className={`bd-focus min-w-0 rounded-2xl border px-4 py-3 text-left transition ${selectedId === contract.id ? "border-cyan-700 bg-cyan-50" : "border-slate-200 bg-white hover:border-cyan-400"}`}>
                    <span className="block truncate text-sm font-bold text-[#071f3c]" data-i18n-ignore>{recipient || contract.signed_name || `Crew contract · ${contract.id.slice(0, 8)}`}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-600">{formatContractDate(contract.sent_at)} · {contract.status === "signed" ? "Signed" : "Awaiting signature"}</span>
                  </button>;
                })}
              </div>
              {documentError ? <div role="alert" className="rounded-xl border border-rose-200 bg-white p-4 text-sm text-rose-800"><p>{documentError}</p><button type="button" onClick={() => setDocumentAttempt((current) => current + 1)} className="bd-focus mt-2 min-h-11 font-bold underline">Try again</button></div>
                : selected && selected.id === selectedId ? <AssignedContractDocument key={selected.id} contractId={selected.id} value={selected.contract_text} status={selected.status} signedName={selected.signed_name} signedAt={selected.signed_at} />
                  : <p role="status" className="py-8 text-sm text-slate-600">Loading contract…</p>}
            </>}
    </section>
  );
}
