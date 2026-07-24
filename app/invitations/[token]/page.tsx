"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Mail, UserPlus } from "lucide-react";
import { BlueDeckLogoLink, BlueDeckMark } from "../../components/BlueDeckLogo";
import { supabase } from "../../lib/supabase";

type InvitationSummary = {
  position: string;
  department: string;
  recipientLabel: string;
  status: "pending" | "accepted";
  actionRequired?: boolean;
};

export default function InvitationPage() {
  const params = useParams();
  const token = String(params?.token || "");
  const [invite, setInvite] = useState<InvitationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadInvite() {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        `/api/crew-invitations/${encodeURIComponent(token)}`,
        { cache: "no-store" },
      );
      const payload: unknown = await response.json();
      const record =
        payload && typeof payload === "object"
          ? (payload as Record<string, unknown>)
          : {};
      const invitation =
        record.invitation && typeof record.invitation === "object"
          ? (record.invitation as InvitationSummary)
          : null;

      if (!response.ok || !invitation) {
        setInvite(null);
        setErrorMessage(
          typeof record.error === "string"
            ? record.error
            : "Invitation could not be loaded.",
        );
        return;
      }

      setInvite(invitation);
      setAccepted(
        invitation.status === "accepted" && invitation.actionRequired !== true,
      );
    } catch {
      setInvite(null);
      setErrorMessage("Invitation could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function acceptInvite() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      const invitationPath = `/invitations/${encodeURIComponent(token)}`;
      window.location.href = `/login?next=${encodeURIComponent(invitationPath)}`;
      return;
    }

    setErrorMessage("");
    setAccepting(true);
    try {
      const response = await fetch(
        `/api/crew-invitations/${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );
      const payload: unknown = await response.json();
      const record =
        payload && typeof payload === "object"
          ? (payload as Record<string, unknown>)
          : {};

      if (!response.ok) {
        setErrorMessage(
          typeof record.error === "string"
            ? record.error
            : "Invitation could not be accepted.",
        );
        return;
      }

      setAccepted(true);
    } catch {
      setErrorMessage("Invitation could not be accepted.");
    } finally {
      setAccepting(false);
    }
  }

  useEffect(() => {
    void loadInvite();
  }, [token]);

  if (loading) {
    return (
      <main className="bd-app-page bd-ocean-shell min-h-screen p-8 text-slate-900">
        <div className="bd-ocean-content">Loading invitation...</div>
      </main>
    );
  }

  if (!invite) {
    return (
      <main className="bd-app-page bd-ocean-shell flex min-h-screen items-center justify-center p-8 text-slate-900">
        <div className="bd-glass-card-strong max-w-lg rounded-[32px] p-8 text-center">
          <Mail className="mx-auto h-12 w-12 text-cyan-700" />
          <h1 className="bd-serif mt-4 text-4xl font-normal text-[#071f3c]">Invitation not found</h1>
          <p className="mt-3 text-slate-500">
            {errorMessage || "The invitation link may be expired or incorrect."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="bd-app-page bd-ocean-shell flex min-h-screen items-center justify-center p-5 text-slate-900">
      <div className="bd-glass-card-strong w-full max-w-xl rounded-[36px] p-8">
        <BlueDeckLogoLink href="/" className="mb-8 h-12 w-40 rounded-none border-0 bg-transparent shadow-none sm:w-52" imageClassName="object-contain p-0" />
        {accepted ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
            <h1 className="bd-serif mt-5 text-5xl font-normal text-[#071f3c]">Invitation accepted</h1>
            <p className="mt-4 text-slate-600">
              You are now connected to this yacht portal. Your assigned
              checklists and contracts will appear in your BlueDeck account.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <BlueDeckMark className="h-14 w-20 shrink-0 rounded-none border-0 bg-transparent shadow-none" imageClassName="object-contain p-0" />
              <div>
                <p className="text-cyan-700">Yacht Crew Invitation</p>
                <h1 className="text-3xl font-black text-slate-950">{invite.position}</h1>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-white/65 p-5">
              <p className="text-slate-500">Department</p>
              <p className="mt-1 text-2xl font-bold">{invite.department}</p>
              <p className="mt-5 text-slate-500">Crew ID / email</p>
              <p className="mt-1 text-xl">{invite.recipientLabel}</p>
            </div>

            {errorMessage ? (
              <p className="mt-5 text-sm font-semibold text-rose-700" role="alert">
                {errorMessage}
              </p>
            ) : null}

            <button
              onClick={acceptInvite}
              disabled={accepting}
              aria-busy={accepting}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 py-4 text-xl font-black text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UserPlus className="h-5 w-5" />
              {accepting ? "Accepting invitation..." : "Accept Invitation"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
