"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FileSignature, PenLine } from "lucide-react";
import { supabase } from "../lib/supabase";

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
      <main className="min-h-screen bg-[#020817] p-8 text-white">
        Loading contracts...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020817] px-5 py-8 text-white sm:px-8 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-[32px] border border-cyan-500/20 bg-cyan-500/10 p-8">
          <p className="text-cyan-300">My Contracts</p>
          <h1 className="mt-3 text-5xl font-black">Mobile Signature</h1>
          <p className="mt-4 max-w-2xl text-gray-300">
            Review yacht contracts assigned by captains and sign them inside
            your BlueDeck account.
          </p>
        </header>

        <div className="mt-8 space-y-6">
          {contracts.map((contract) => (
            <article key={contract.id} className="rounded-[28px] border border-white/10 bg-white/5 p-6">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <div className="flex items-center gap-3">
                    <FileSignature className="h-6 w-6 text-cyan-300" />
                    <h2 className="text-2xl font-black">Yacht Contract</h2>
                  </div>
                  <p className="mt-2 text-sm text-gray-400">
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

              <pre className="mt-6 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/30 p-5 font-sans leading-7 text-gray-200">
                {contract.contract_text}
              </pre>

              {contract.status !== "signed" ? (
                <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto]">
                  <input
                    value={signatureName}
                    onChange={(e) => setSignatureName(e.target.value)}
                    placeholder="Type your full name"
                    className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4 outline-none focus:border-cyan-300"
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
                <p className="mt-5 text-sm text-gray-400">
                  Signed by {contract.signed_name} on {contract.signed_at}
                </p>
              )}
            </article>
          ))}

          {contracts.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-gray-400">
              No contracts assigned yet.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
