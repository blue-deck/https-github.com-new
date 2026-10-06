"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, FileSignature, PenLine } from "lucide-react";
import { loadAccountCapabilities } from "../lib/accountCapabilities";
import { supabase } from "../lib/supabase";
import AssignedContractDocument, { formatContractDate } from "../components/AssignedContractDocument";

function DashboardReturnLink() {
  return (
    <Link
      href="/dashboard"
      className="bd-focus mb-3 inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white/90 px-3 text-xs font-black uppercase tracking-[0.08em] text-[#173f4a] shadow-sm backdrop-blur transition hover:border-cyan-300 hover:text-cyan-800"
      aria-label="Back to dashboard"
      title="Back to dashboard"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden />
      Dashboard
    </Link>
  );
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<ReviewContract[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  async function loadContracts() {
    setLoading(true);
    setLoadError("");
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!user?.email) {
        window.location.replace(
          `/login?next=${encodeURIComponent("/contracts")}`,
        );
        return;
      }

      if (userError) {
        setLoadError("Your contracts could not be loaded. Check your connection and try again.");
        setLoading(false);
        return;
      }

      const capabilities = await loadAccountCapabilities().catch(() => null);
      if (!capabilities) {
        setLoadError("Your contracts could not be loaded. Check your connection and try again.");
        setLoading(false);
        return;
      }
      if (capabilities?.canUseCrewWorkspace !== true) {
        window.location.replace("/dashboard");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("crew_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) {
        setLoadError("Your contracts could not be loaded. Check your connection and try again.");
        setLoading(false);
        return;
      }

      if (!profile) {
        setContracts([]);
        setLoading(false);
        return;
      }

      const { data, error: contractsError } = await supabase
        .from("yacht_contracts")
        .select("id,yacht_id,crew_profile_id,status,sent_at,signed_at,signed_name")
        .eq("crew_profile_id", profile.id)
        .in("status", ["sent_for_signature", "signed"])
        .order("sent_at", { ascending: false });

      if (contractsError) {
        setLoadError("Your contracts could not be loaded. Check your connection and try again.");
        setLoading(false);
        return;
      }

      setContracts(data || []);
      const requestedId = new URLSearchParams(window.location.search).get("contract");
      setSelectedId((current) => (data || []).find((row) => row.id === (requestedId || current))?.id || data?.[0]?.id || "");
      setLoading(false);
    } catch {
      setLoadError("Your contracts could not be loaded. Check your connection and try again.");
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContracts();
  }, []);

  if (loading) {
    return (
      <main className="bd-app-page bd-ocean-shell min-h-screen p-8 text-slate-900" aria-busy="true">
        <div className="bd-ocean-content">
          <DashboardReturnLink />
          <div role="status" aria-live="polite">
            <h1 className="text-3xl font-semibold text-[#071f3c]">Loading contracts...</h1>
          </div>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="bd-app-page bd-ocean-shell min-h-screen px-5 py-10 text-slate-900 sm:px-8 lg:px-10">
        <div className="bd-ocean-content mx-auto max-w-3xl">
          <DashboardReturnLink />
          <section className="rounded-[28px] border border-rose-200 bg-white p-7 shadow-sm" role="alert">
            <p className="bd-kicker">BlueDeck Contracts</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#071f3c]">
              Contracts could not be loaded
            </h1>
            <p className="mt-3 max-w-xl leading-7 text-slate-600">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadContracts()}
              className="bd-primary-action bd-focus mt-6 min-h-12 rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
            >
              Try again
            </button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="bd-app-page bd-ocean-shell bd-page-gutter min-h-screen px-5 py-8 text-slate-900 sm:px-8 lg:px-10">
      <div className="bd-ocean-content bd-page-frame mx-auto max-w-5xl">
        <DashboardReturnLink />
        <header className="bd-page-hero bd-glass-card-strong rounded-[28px] p-5 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-700">Crew workspace</p>
          <h1 className="mt-3 text-3xl font-bold text-[#071f3c] sm:text-4xl">My contracts</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Review, download and sign your yacht contracts.</p>
        </header>
        <div className="mt-6 space-y-5">
          {contracts.length > 1 && <div className="grid gap-2 sm:grid-cols-2" aria-label="Choose a contract">
            {contracts.map((contract) => <button key={contract.id} type="button" aria-pressed={selectedId === contract.id} onClick={() => setSelectedId(contract.id)} className={`bd-focus rounded-2xl border px-4 py-3 text-left ${selectedId === contract.id ? "border-cyan-700 bg-cyan-50" : "border-slate-200 bg-white"}`}>
              <span className="block text-sm font-bold text-[#071f3c]">Yacht contract · {formatContractDate(contract.sent_at)}</span>
              <span className="mt-1 block text-xs text-slate-600">{contract.status === "signed" ? "Signed" : "Awaiting your signature"}</span>
            </button>)}
          </div>}
          {contracts.filter((contract) => contract.id === selectedId).map((contract) => (
            <ContractReview key={contract.id} contract={contract} onSigned={(updated) => setContracts((current) => current.map((row) => row.id === contract.id ? { ...row, ...updated } : row))} />
          ))}
          {contracts.length === 0 && <div className="bd-glass-card rounded-3xl p-8 text-slate-500" role="status">No contracts assigned yet.</div>}
        </div>
      </div>
    </main>
  );
}

type ReviewContract = {
  id: string;
  contract_text?: string;
  status: string;
  sent_at: string | null;
  signed_at: string | null;
  signed_name: string | null;
};

function ContractReview({ contract, onSigned }: { contract: ReviewContract; onSigned: (updated: Partial<ReviewContract>) => void }) {
  const [signatureName, setSignatureName] = useState("");
  const [signatureConsent, setSignatureConsent] = useState(false);
  const [signing, setSigning] = useState(false);
  const [documentReady, setDocumentReady] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);

  async function signContract() {
    if (pending.current || !documentReady || !signatureConsent || !signatureName.trim() || contract.status !== "sent_for_signature") return;
    pending.current = true;
    setSigning(true);
    setError("");
    try {
      const { data, error: updateError } = await supabase.from("yacht_contracts")
        .update({ status: "signed", signed_name: signatureName.trim() })
        .eq("id", contract.id).eq("status", "sent_for_signature")
        .select("id,status,signed_name,signed_at").maybeSingle();
      if (updateError || !data) throw updateError || new Error("The contract may have changed. Refresh the page and check its status before trying again.");
      onSigned(data);
      setSignatureName("");
      setSignatureConsent(false);
    } catch {
      setError("Your acceptance could not be confirmed. Refresh the page to check the contract status before trying again.");
    } finally {
      pending.current = false;
      setSigning(false);
    }
  }

  return (
    <article className="min-w-0 space-y-5" id={`contract-${contract.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[#071f3c]"><FileSignature className="h-5 w-5 text-cyan-700" aria-hidden />Yacht contract</h2>
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${contract.status === "signed" ? "bg-emerald-50 text-emerald-800" : "bg-cyan-50 text-cyan-800"}`}>
          {contract.status === "signed" && <CheckCircle2 className="h-4 w-4" aria-hidden />}{contract.status === "signed" ? "Signed" : "Awaiting your signature"}
        </span>
      </div>
      <AssignedContractDocument contractId={contract.id} value={contract.contract_text} status={contract.status} signedName={contract.signed_name} signedAt={contract.signed_at} onReadyChange={setDocumentReady} />
      {contract.status === "sent_for_signature" && (
        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6" aria-label="Electronic acceptance">
          <h3 className="font-bold text-[#071f3c]">Sign this contract</h3>
          <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
            <input type="checkbox" checked={signatureConsent} disabled={signing} onChange={(event) => setSignatureConsent(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300" />
            <span>I have reviewed this contract and intend my typed name to record my electronic acceptance. BlueDeck records the authenticated account and server timestamp; this workflow is not legal advice or a qualified electronic signature.</span>
          </label>
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <label htmlFor={`signature-name-${contract.id}`} className="sr-only">Full name for electronic acceptance</label>
            <input id={`signature-name-${contract.id}`} value={signatureName} disabled={signing} onChange={(event) => setSignatureName(event.target.value)} placeholder="Type your full name" autoComplete="name" className="min-w-0 rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-950 outline-none focus:border-cyan-700" />
            <button type="button" onClick={() => void signContract()} disabled={signing || !documentReady || !signatureConsent || !signatureName.trim()} className="bd-primary-action bd-focus inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-6 py-3 text-sm font-bold text-white hover:bg-cyan-800 disabled:opacity-50"><PenLine className="h-4 w-4" aria-hidden />{signing ? "Signing…" : "Sign contract"}</button>
          </div>
          {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
        </section>
      )}
    </article>
  );
}
