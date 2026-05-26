"use client";

import { useEffect, useState } from "react";
import { BlueDeckLogoLink } from "../components/BlueDeckLogo";
import { supabase } from "../lib/supabase";

type Yacht = {
  id: string;
  name: string;
  model: string;
  flag: string;
};

export default function YachtsPage() {
  const [yachts, setYachts] = useState<Yacht[]>([]);
  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [flag, setFlag] = useState("");
  const [loading, setLoading] = useState(true);

  async function fetchYachts() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("yachts")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setYachts(data || []);
    setLoading(false);
  }

  async function createYacht() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    if (!name) {
      alert("Yacht name is required");
      return;
    }

    const { error } = await supabase.from("yachts").insert([
      {
        name,
        model,
        flag,
        owner_id: user.id,
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    setName("");
    setModel("");
    setFlag("");

    fetchYachts();
  }

  useEffect(() => {
    fetchYachts();
  }, []);

  if (loading) {
    return (
      <main className="bd-ocean-shell min-h-screen p-10 text-slate-900">
        <div className="bd-ocean-content">Loading yachts...</div>
      </main>
    );
  }

  return (
    <main className="bd-ocean-shell min-h-screen px-5 py-10 text-slate-900 sm:px-8 lg:px-10">
      <div className="bd-ocean-content mx-auto max-w-7xl">
        <a href="/dashboard" className="bd-focus rounded-full text-cyan-700">
          Back to dashboard
        </a>

        <div className="bd-glass-card-strong mt-6 overflow-hidden rounded-[34px]">
          <div className="h-1.5 bg-[linear-gradient(90deg,#08111f,#22d3ee,#d8b45f,#ef776f)]" />
          <div className="p-8">
            <BlueDeckLogoLink
              href="/dashboard"
              className="mb-6 h-12 w-40 rounded-none border-0 bg-transparent shadow-none sm:w-52"
              imageClassName="object-contain p-0"
            />
            <p className="bd-kicker">Captain Workspace</p>
            <h1 className="bd-serif mt-4 text-5xl font-normal text-[#071f3c] sm:text-6xl">
              Fleet
            </h1>
            <p className="mt-4 max-w-2xl leading-7 text-slate-600">
              Create and manage the yachts connected to your BlueDeck account.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-[390px_1fr]">
          <div className="bd-glass-card rounded-[28px] p-6">
            <h2 className="text-2xl font-semibold text-slate-950">Add Yacht</h2>

            <div className="mt-6 space-y-4">
              <input
                placeholder="Yacht name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bd-focus w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-950 placeholder:text-slate-400"
              />

              <input
                placeholder="Model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="bd-focus w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-950 placeholder:text-slate-400"
              />

              <input
                placeholder="Flag"
                value={flag}
                onChange={(e) => setFlag(e.target.value)}
                className="bd-focus w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-950 placeholder:text-slate-400"
              />

              <button
                onClick={createYacht}
                className="bd-focus w-full rounded-full bg-cyan-600 px-5 py-4 font-bold text-white transition hover:bg-cyan-700"
              >
                Create Yacht
              </button>
            </div>
          </div>

          <div className="bd-glass-card rounded-[28px] p-6">
            <h2 className="text-2xl font-semibold text-slate-950">Connected Yachts</h2>

            <div className="mt-6 space-y-4">
              {yachts.map((yacht) => (
                <a
                  href={`/yachts/${yacht.id}`}
                  key={yacht.id}
                  className="bd-focus block rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-cyan-300 hover:bg-cyan-50"
                >
                  <h3 className="text-2xl font-semibold text-slate-950">{yacht.name}</h3>
                  <p className="mt-2 text-slate-600">{yacht.model}</p>
                  <p className="mt-1 text-slate-400">{yacht.flag}</p>
                </a>
              ))}

              {yachts.length === 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-500">
                  Your fleet is empty. Add the first yacht to open the captain workspace.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
