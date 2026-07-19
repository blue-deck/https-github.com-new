"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FileSignature, PenLine } from "lucide-react";
import { supabase } from "../lib/supabase";
import { parseAssignedContractPayload } from "../lib/contractPayload";

export default function ContractsPage() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [signatureName, setSignatureName] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadContracts() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      window.location.href = "/login";
      return;
    }

    const { data: profile } = await supabase
      .from("crew_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      setContracts([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("yacht_contracts")
      .select("*")
      .eq("crew_profile_id", profile.id)
      .order("sent_at", { ascending: false });

    setContracts(data || []);
    setLoading(false);
  }

  async function signContract(contractId: string) {
    if (!signatureName.trim()) {
      alert("Type your full name as mobile signature.");
      return;
    }

    const { error } = await supabase
      .from("yacht_contracts")
      .update({
        status: "signed",
        signed_name: signatureName,
        signed_at: new Date().toISOString(),
      })
      .eq("id", contractId);

    if (error) {
      alert(error.message);
      return;
    }

    setSignatureName("");
    loadContracts();
  }

  useEffect(() => {
    loadContracts();
  }, []);

  if (loading) {
    return (
      <main className="bd-app-page bd-ocean-shell min-h-screen p-8 text-slate-900">
        <div className="bd-ocean-content">Loading contracts...</div>
      </main>
    );
  }

  return (
    <main className="bd-app-page bd-ocean-shell min-h-screen px-5 py-8 text-slate-900 sm:px-8 lg:px-10">
      <div className="bd-ocean-content mx-auto max-w-5xl">
        <header className="bd-glass-card-strong rounded-[34px] p-8">
          <p className="text-cyan-300">My Contracts</p>
          <h1 className="bd-serif mt-3 text-5xl font-normal text-[#071f3c]">Mobile Signature</h1>
          <p className="mt-4 max-w-2xl text-slate-600">
            Review yacht contracts assigned by captains and sign them inside
            your BlueDeck account.
          </p>
        </header>

        <div className="mt-8 space-y-6">
          {contracts.map((contract) => (
            <article key={contract.id} className="bd-glass-card rounded-[28px] p-6">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <div className="flex items-center gap-3">
                    <FileSignature className="h-6 w-6 text-cyan-300" />
                    <h2 className="text-2xl font-black text-slate-950">Yacht Contract</h2>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    Status: {contract.status}
                  </p>
                </div>
                {contract.status === "signed" && (
                  <span className="flex items-center gap-2 rounded-full bg-green-400/10 px-4 py-2 text-green-200">
                    <CheckCircle2 className="h-4 w-4" />
                    Signed
                  </span>
                )}
              </div>

              <ContractDocument value={contract.contract_text} />

              {contract.status !== "signed" ? (
                <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto]">
                  <input
                    value={signatureName}
                    onChange={(e) => setSignatureName(e.target.value)}
                    placeholder="Type your full name"
                    className="rounded-2xl border border-slate-200 bg-white/80 px-5 py-4 text-slate-950 outline-none focus:border-cyan-300"
                  />
                  <button
                    onClick={() => signContract(contract.id)}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-6 py-4 font-black text-black"
                  >
                    <PenLine className="h-5 w-5" />
                    Sign
                  </button>
                </div>
              ) : (
                <p className="mt-5 text-sm text-slate-500">
                  Signed by {contract.signed_name} on {contract.signed_at}
                </p>
              )}
            </article>
          ))}

          {contracts.length === 0 && (
            <div className="bd-glass-card rounded-3xl p-8 text-slate-500">
              No contracts assigned yet.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function ContractDocument({ value }: { value: unknown }) {
  const contract = parseAssignedContractPayload(value);

  return (
    <>
      <pre className="mt-6 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white/70 p-5 font-sans leading-7 text-slate-700">
        {contract.contractText}
      </pre>
      {contract.employerSignatureDataUrl ? (
        <section className="mt-4 overflow-hidden rounded-2xl border border-[#bfd8ea] bg-white sm:w-1/2">
          <div className="border-b border-[#d9e8f3] bg-[#f4f8fc] px-4 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0b3c77]">
              Employer / Authorised Signatory
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Electronic signature recorded in Annex D
            </p>
          </div>
          <div className="flex h-28 items-center justify-center p-3">
            <img
              src={contract.employerSignatureDataUrl}
              alt="Employer electronic signature"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </section>
      ) : null}
    </>
  );
}
