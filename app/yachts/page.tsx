"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Yacht = {
  id: string;
  name: string;
  model: string;
  flag: string;
  mmsi?: string | null;
};

export default function YachtsPage() {
  const [yachts, setYachts] = useState<Yacht[]>([]);
  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [flag, setFlag] = useState("");
  const [mmsi, setMmsi] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  async function fetchYachts() {
    setLoading(true);
    setLoadError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.replace(
          `/login?next=${encodeURIComponent("/yachts")}`,
        );
        return;
      }

      if (userError) throw userError;

      const { data, error } = await supabase
        .from("yachts")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setYachts(data || []);
    } catch {
      setLoadError(
        "Your fleet could not be loaded. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function createYacht() {
    if (creating) return;
    setCreateError("");

    const cleanName = name.trim();
    if (!cleanName) {
      setCreateError("Yacht name is required.");
      return;
    }

    if (mmsi && !/^\d{9}$/.test(mmsi)) {
      setCreateError("MMSI must contain exactly 9 digits.");
      return;
    }

    setCreating(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) {
        window.location.replace(
          `/login?next=${encodeURIComponent("/yachts")}`,
        );
        return;
      }

      const yachtPayload = {
        name: cleanName,
        model: model.trim(),
        flag: flag.trim(),
        mmsi: mmsi || null,
        owner_id: user.id,
      };

      let { error } = await supabase.from("yachts").insert([yachtPayload]);

      if (error && /mmsi|schema cache|column/i.test(error.message)) {
        const fallbackPayload = {
          name: cleanName,
          model: model.trim(),
          flag: flag.trim(),
          owner_id: user.id,
        };
        const fallback = await supabase.from("yachts").insert([fallbackPayload]);
        error = fallback.error;
      }

      if (error) throw error;

      setName("");
      setModel("");
      setFlag("");
      setMmsi("");
      await fetchYachts();
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : "The yacht could not be created. Try again.",
      );
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    void fetchYachts();
  }, []);

  if (loading) {
    return (
      <main className="bd-app-page bd-ocean-shell min-h-screen px-5 py-10 text-slate-900 sm:px-8 lg:px-10">
        <div
          className="bd-ocean-content mx-auto max-w-7xl"
          role="status"
          aria-live="polite"
        >
          Loading yachts...
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="bd-app-page bd-ocean-shell min-h-screen px-5 py-10 text-slate-900 sm:px-8 lg:px-10">
        <section
          className="bd-ocean-content bd-glass-card-strong mx-auto max-w-3xl rounded-[28px] p-8"
          role="alert"
          aria-labelledby="fleet-load-error-title"
        >
          <p className="bd-kicker">Captain Workspace</p>
          <h1
            id="fleet-load-error-title"
            className="bd-serif mt-4 text-4xl font-normal text-[#071f3c] sm:text-5xl"
          >
            Fleet could not be loaded
          </h1>
          <p className="mt-4 max-w-xl leading-7 text-slate-600">{loadError}</p>
          <button
            type="button"
            onClick={() => void fetchYachts()}
            className="bd-focus mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-cyan-600 px-6 font-bold text-white transition hover:bg-cyan-700"
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="bd-app-page bd-ocean-shell min-h-screen px-5 py-10 text-slate-900 sm:px-8 lg:px-10">
      <div className="bd-ocean-content mx-auto max-w-7xl">
        <div className="bd-glass-card-strong overflow-hidden rounded-[34px]">
          <div className="bd-brand-rule h-1.5" />
          <div className="p-8">
            <p className="bd-kicker">Captain Workspace</p>
            <h1 className="bd-serif mt-4 text-5xl font-normal text-[#071f3c] sm:text-6xl">
              Fleet
            </h1>
            <p className="mt-4 max-w-2xl leading-7 text-slate-600">
              Create and manage the yachts connected to your BlueDeck account.
            </p>
          </div>
        </div>

        <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,390px)_minmax(0,1fr)]">
          <section className="bd-glass-card rounded-[28px] p-6" aria-labelledby="add-yacht-title">
            <h2 id="add-yacht-title" className="text-2xl font-semibold text-slate-950">Add Yacht</h2>

            <form
              className="mt-6 space-y-4"
              aria-busy={creating}
              onSubmit={(event) => {
                event.preventDefault();
                void createYacht();
              }}
            >
              <YachtTextField
                id="yacht-name"
                label="Yacht name"
                value={name}
                onChange={setName}
                maxLength={120}
                disabled={creating}
                required
              />
              <YachtTextField
                id="yacht-model"
                label="Model"
                value={model}
                onChange={setModel}
                maxLength={120}
                disabled={creating}
              />
              <YachtTextField
                id="yacht-flag"
                label="Flag"
                value={flag}
                onChange={setFlag}
                maxLength={80}
                disabled={creating}
              />

              <div>
                <label htmlFor="yacht-mmsi" className="mb-1.5 block text-sm font-bold text-slate-700">
                  MMSI number <span className="font-medium text-slate-500">(optional)</span>
                </label>
                <input
                  id="yacht-mmsi"
                  placeholder="9 digits"
                  value={mmsi}
                  inputMode="numeric"
                  pattern="[0-9]{9}"
                  maxLength={9}
                  disabled={creating}
                  onChange={(event) => setMmsi(event.target.value.replace(/\D/g, "").slice(0, 9))}
                  className="bd-focus min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-950 placeholder:text-slate-400 disabled:cursor-wait disabled:opacity-60"
                />
              </div>

              {createError ? (
                <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold leading-6 text-rose-800">
                  {createError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={creating}
                className="bd-focus min-h-12 w-full rounded-xl bg-[#071f3c] px-5 py-3 font-bold text-white transition hover:bg-cyan-800 disabled:cursor-wait disabled:opacity-60"
              >
                {creating ? "Creating yacht..." : "Create Yacht"}
              </button>
            </form>
          </section>

          <div className="bd-glass-card rounded-[28px] p-6">
            <h2 className="text-2xl font-semibold text-slate-950">Connected Yachts</h2>

            <div className="mt-6 space-y-4">
              {yachts.map((yacht) => (
                <Link
                  href={`/yachts/${yacht.id}`}
                  key={yacht.id}
                  className="bd-focus block rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-cyan-300 hover:bg-cyan-50"
                >
                  <h3 className="text-2xl font-semibold text-slate-950">{yacht.name}</h3>
                  <p className="mt-2 text-slate-600">{yacht.model}</p>
                  <p className="mt-1 text-slate-400">{yacht.flag}</p>
                  {yacht.mmsi && (
                    <p className="mt-2 text-sm font-semibold text-cyan-700">MMSI {yacht.mmsi}</p>
                  )}
                </Link>
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

function YachtTextField({
  id,
  label,
  value,
  onChange,
  maxLength,
  disabled,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  disabled: boolean;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-bold text-slate-700">
        {label}
        {required ? <span aria-hidden="true" className="ml-1 text-rose-600">*</span> : null}
      </label>
      <input
        id={id}
        value={value}
        required={required}
        maxLength={maxLength}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="bd-focus min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-950 disabled:cursor-wait disabled:opacity-60"
      />
    </div>
  );
}
