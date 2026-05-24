"use client";

import { useEffect, useState } from "react";
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
      <main className="bd-shell min-h-screen p-10 text-[#eef7ff]">
        Loading yachts...
      </main>
    );
  }

  return (
    <main className="bd-shell min-h-screen px-5 py-10 text-[#eef7ff] sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <a href="/dashboard" className="bd-focus rounded-full text-[#22d3ee]">
          Back to dashboard
        </a>

        <div className="bd-panel mt-6 rounded-3xl p-8">
          <p className="bd-kicker">Captain Workspace</p>
          <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">
            Fleet
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-[#aeb8c8]">
            Create and manage the yachts connected to your BlueDeck account.
          </p>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-[390px_1fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-6">
            <h2 className="text-2xl font-semibold text-white">Add Yacht</h2>

            <div className="mt-6 space-y-4">
              <input
                placeholder="Yacht name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bd-focus w-full rounded-2xl border border-white/10 bg-black/20 px-5 py-4 text-white placeholder:text-[#6f7b8e]"
              />

              <input
                placeholder="Model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="bd-focus w-full rounded-2xl border border-white/10 bg-black/20 px-5 py-4 text-white placeholder:text-[#6f7b8e]"
              />

              <input
                placeholder="Flag"
                value={flag}
                onChange={(e) => setFlag(e.target.value)}
                className="bd-focus w-full rounded-2xl border border-white/10 bg-black/20 px-5 py-4 text-white placeholder:text-[#6f7b8e]"
              />

              <button
                onClick={createYacht}
                className="bd-focus w-full rounded-full bg-[#22d3ee] px-5 py-4 font-bold text-[#020817] transition hover:bg-[#eef7ff]"
              >
                Create Yacht
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-6">
            <h2 className="text-2xl font-semibold text-white">Connected Yachts</h2>

            <div className="mt-6 space-y-4">
              {yachts.map((yacht) => (
                <a
                  href={`/yachts/${yacht.id}`}
                  key={yacht.id}
                  className="bd-focus block rounded-2xl border border-white/10 bg-black/20 p-5 transition hover:border-[#22d3ee]/35 hover:bg-white/[0.06]"
                >
                  <h3 className="text-2xl font-semibold text-white">{yacht.name}</h3>
                  <p className="mt-2 text-[#aeb8c8]">{yacht.model}</p>
                  <p className="mt-1 text-[#7e899a]">{yacht.flag}</p>
                </a>
              ))}

              {yachts.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-[#aeb8c8]">
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
