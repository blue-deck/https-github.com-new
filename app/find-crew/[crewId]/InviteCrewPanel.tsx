"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  CheckCircle2,
  LoaderCircle,
  LogIn,
  Send,
  ShieldCheck,
  Ship,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { yachtPositionTitles } from "../../lib/yachtOperations";

type YachtOption = {
  id: string;
  name: string;
};

type HiringYacht = YachtOption & {
  access?: {
    status?: string;
  } | null;
};

export function InviteCrewPanel({
  crewId,
  fullName,
  defaultPosition,
}: {
  crewId: string;
  fullName: string;
  defaultPosition: string;
}) {
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [hasOwnedYachts, setHasOwnedYachts] = useState(false);
  const [yachts, setYachts] = useState<YachtOption[]>([]);
  const [selectedYacht, setSelectedYacht] = useState("");
  const [position, setPosition] = useState(
    yachtPositionTitles.includes(defaultPosition) ? defaultPosition : yachtPositionTitles[0],
  );
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [shortlisted, setShortlisted] = useState(false);
  const [shortlistSaving, setShortlistSaving] = useState(false);

  const returnPath = useMemo(
    () => `/find-crew/${encodeURIComponent(crewId)}`,
    [crewId],
  );

  useEffect(() => {
    async function loadHiringContext() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setLoading(false);
        return;
      }

      setSessionToken(session.access_token);
      setShortlisted(readShortlist(session.user.user_metadata).includes(crewId));

      try {
        const response = await fetch("/api/employer-access", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const payload: unknown = await response.json().catch(() => null);
        const result =
          payload && typeof payload === "object"
            ? (payload as Record<string, unknown>)
            : {};
        const ownedYachts = Array.isArray(result.yachts)
          ? (result.yachts as HiringYacht[])
          : [];
        const nextYachts = ownedYachts
          .filter((yacht) => yacht.access?.status === "verified")
          .map((yacht) => ({ id: yacht.id, name: yacht.name }))
          .filter((yacht) => yacht.id && yacht.name);

        setHasOwnedYachts(ownedYachts.length > 0);
        setAuthorized(response.ok && nextYachts.length > 0);
        setYachts(nextYachts);
        setSelectedYacht(nextYachts[0]?.id || "");
      } catch {
        setHasOwnedYachts(false);
        setAuthorized(false);
        setYachts([]);
        setSelectedYacht("");
      } finally {
        setLoading(false);
      }
    }

    void loadHiringContext();
  }, [crewId]);

  async function toggleShortlist() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = `/login?next=${encodeURIComponent(returnPath)}`;
      return;
    }

    const current = readShortlist(user.user_metadata);
    const next = current.includes(crewId)
      ? current.filter((item) => item !== crewId)
      : [...current, crewId];

    setShortlistSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: { crew_shortlist: next },
    });
    setShortlistSaving(false);

    if (!error) setShortlisted(next.includes(crewId));
  }

  async function sendInvitation() {
    if (!sessionToken || !selectedYacht || !position) return;

    setSending(true);
    setNotice("");

    try {
      const response = await fetch(
        `/api/yachts/${encodeURIComponent(selectedYacht)}/crew-invitations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            crewId,
            position,
          }),
        },
      );
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!response.ok || !result?.ok) {
        setNotice(result?.error || "The yacht invitation could not be sent.");
        return;
      }

      setNotice(`Invitation sent to ${fullName}. It is now waiting inside their BlueDeck portal.`);
    } catch {
      setNotice("The yacht invitation could not be sent. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <aside className="lg:sticky lg:top-[calc(var(--public-header-height)+2rem)]">
      <div className="overflow-hidden rounded-[28px] border border-[#071f3c]/10 bg-white shadow-2xl shadow-[#071f3c]/7">
        <div className="h-1.5 bg-[linear-gradient(90deg,#083344,#22d3ee,#8ed8e6)]" />
        <div className="p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#071f3c] text-cyan-200">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
            Secure hiring actions
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Contact details remain private. Send a yacht invitation through BlueDeck, or save this profile to your shortlist.
          </p>

          {loading ? (
            <div className="mt-6 flex min-h-24 items-center justify-center text-cyan-800">
              <LoaderCircle className="h-6 w-6 animate-spin" />
            </div>
          ) : !sessionToken ? (
            <Link
              href={`/login?next=${encodeURIComponent(returnPath)}`}
              className="bd-focus mt-6 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-4 text-sm font-black text-white transition hover:bg-cyan-800"
            >
              <LogIn className="h-4 w-4" />
              Log in to continue
            </Link>
          ) : !hasOwnedYachts ? (
            <div className="mt-6">
              <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm leading-6 text-cyan-950">
                Add a yacht to your workspace before sending an invitation.
              </div>
              <Link
                href="/yachts"
                className="bd-focus mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-4 text-sm font-black text-white"
              >
                <Ship className="h-4 w-4" />
                Open yacht workspace
              </Link>
            </div>
          ) : !authorized ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              BlueDeck must verify hiring access for this yacht before you can
              contact crew.
              <Link
                href="/hiring"
                className="mt-3 flex min-h-11 items-center justify-center rounded-xl bg-amber-950 px-4 font-black text-white"
              >
                Request hiring access
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                  Yacht
                </span>
                <select
                  value={selectedYacht}
                  onChange={(event) => setSelectedYacht(event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                >
                  {yachts.map((yacht) => (
                    <option key={yacht.id} value={yacht.id}>
                      {yacht.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                  Offered position
                </span>
                <select
                  value={position}
                  onChange={(event) => setPosition(event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                >
                  {yachtPositionTitles.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void sendInvitation()}
                disabled={sending}
                className="bd-focus flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-4 text-sm font-black text-white transition hover:bg-cyan-800 disabled:cursor-wait disabled:opacity-60"
              >
                {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? "Sending..." : "Send yacht invitation"}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => void toggleShortlist()}
            disabled={shortlistSaving}
            className={`bd-focus mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black transition ${
              shortlisted
                ? "border-cyan-300 bg-cyan-50 text-cyan-900"
                : "border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:text-cyan-900"
            }`}
          >
            {shortlistSaving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : shortlisted ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
            {shortlisted ? "Saved to shortlist" : "Save to shortlist"}
          </button>

          {notice ? (
            <p
              className={`mt-4 rounded-2xl border p-4 text-sm leading-6 ${
                notice.startsWith("Invitation sent")
                  ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                  : "border-rose-200 bg-rose-50 text-rose-950"
              }`}
              role="status"
            >
              {notice}
            </p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function readShortlist(metadata?: Record<string, unknown>) {
  const value = metadata?.crew_shortlist;
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").slice(0, 100);
}
