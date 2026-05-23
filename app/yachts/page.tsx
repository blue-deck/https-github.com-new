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
      window.location.href = "/auth";
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
      window.location.href = "/auth";
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
      <main className="min-h-screen bg-[#081120] p-10 text-white">
        Loading yachts...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#081120] p-10 text-white">
      <div className="mx-auto max-w-7xl">
        <a href="/dashboard" className="text-blue-300">
          ← Back to dashboard
        </a>

        <div className="mt-6 rounded-3xl bg-white/5 p-8">
          <p className="text-gray-400">Captain Workspace</p>
          <h1 className="mt-3 text-5xl font-bold">My Yachts</h1>
          <p className="mt-4 text-gray-400">
            Create and manage the yachts connected to your BlueDeck account.
          </p>
        </div>

        <div className="mt-8 grid gap-8 md:grid-cols-[420px_1fr]">
          <div className="rounded-3xl bg-white/5 p-8">
            <h2 className="text-3xl font-bold">Add Yacht</h2>

            <div className="mt-8 space-y-4">
              <input
                placeholder="Yacht name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-4 outline-none"
              />

              <input
                placeholder="Model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-4 outline-none"
              />

              <input
                placeholder="Flag"
                value={flag}
                onChange={(e) => setFlag(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-4 outline-none"
              />

              <button
                onClick={createYacht}
                className="w-full rounded-2xl bg-blue-400 px-5 py-4 font-semibold text-black"
              >
                Create Yacht
              </button>
            </div>
          </div>

          <div className="rounded-3xl bg-white/5 p-8">
            <h2 className="text-3xl font-bold">Fleet</h2>

            <div className="mt-6 space-y-4">
              {yachts.map((yacht) => (
                <a
                  href={`/yachts/${yacht.id}`}
                  key={yacht.id}
                  className="block rounded-2xl border border-white/10 bg-black/20 p-5 transition hover:border-blue-400/40 hover:bg-white/5"
                >
                  <h3 className="text-2xl font-semibold">{yacht.name}</h3>
                  <p className="mt-2 text-gray-400">{yacht.model}</p>
                  <p className="mt-1 text-gray-500">{yacht.flag}</p>
                </a>
              ))}

              {yachts.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-gray-400">
                  No yachts connected to your account yet. Create your first yacht.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}