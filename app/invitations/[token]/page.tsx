"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Ship,
  UserPlus,
} from "lucide-react";
import { BlueDeckLogoLink, BlueDeckMark } from "../../components/BlueDeckLogo";
import { supabase } from "../../lib/supabase";

type Invitation = {
  id: string;
  yacht_name: string;
  position: string;
  department: string;
  crew_reference: string;
  status: string;
  created_at?: string | null;
};

export default function InvitationPage() {
  const params = useParams();
  const token = String(params?.token || "");
  const [invite, setInvite] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function loadInvite() {
      try {
        const response = await fetch(`/api/invitations/${encodeURIComponent(token)}`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          invitation?: Invitation;
          error?: string;
        };

        if (!active) return;
        if (!response.ok || !payload.invitation) {
          setNotice(payload.error || "Invitation not found.");
          return;
        }
        setInvite(payload.invitation);
        setAccepted(payload.invitation.status === "accepted");
      } catch {
        if (active) setNotice("Invitation could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadInvite();
    return () => {
      active = false;
    };
  }, [token]);

  async function acceptInvite() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      const returnPath = `/invitations/${encodeURIComponent(token)}`;
      window.location.href = `/login?next=${encodeURIComponent(returnPath)}`;
      return;
    }

    setAccepting(true);
    setNotice("");
    try {
      const response = await fetch(`/api/invitations/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setNotice(payload.error || "Invitation could not be accepted.");
        return;
      }
      setAccepted(true);
    } catch {
      setNotice("Invitation could not be accepted. Please try again.");
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <main className="bd-app-page bd-ocean-shell flex min-h-screen items-center justify-center p-8 text-slate-900">
        <div className="bd-ocean-content flex items-center gap-3 text-sm font-bold text-[#526b83]">
          <LoaderCircle className="h-5 w-5 animate-spin text-cyan-700" />
          Loading secure invitation...
        </div>
      </main>
    );
  }

  if (!invite) {
    return (
      <main className="bd-app-page bd-ocean-shell flex min-h-screen items-center justify-center p-8 text-slate-900">
        <div className="bd-glass-card-strong max-w-lg rounded-[32px] p-8 text-center">
          <Mail className="mx-auto h-12 w-12 text-cyan-700" />
          <h1 className="bd-serif mt-4 text-4xl font-normal text-[#071f3c]">
            Invitation not found
          </h1>
          <p className="mt-3 text-slate-500">
            {notice || "The invitation link may be expired or incorrect."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="bd-app-page bd-ocean-shell flex min-h-screen items-center justify-center p-5 text-slate-900">
      <div className="bd-glass-card-strong w-full max-w-xl overflow-hidden rounded-[36px]">
        <div className="border-b border-[#071f3c]/8 px-8 py-6">
          <BlueDeckLogoLink
            href="/"
            className="h-12 w-44 rounded-none border-0 bg-transparent shadow-none sm:w-52"
            imageClassName="object-contain p-0"
          />
        </div>

        <div className="p-8">
          {accepted ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
              <h1 className="bd-serif mt-5 text-5xl font-normal text-[#071f3c]">
                Invitation accepted
              </h1>
              <p className="mt-4 leading-7 text-slate-600">
                You are now connected to <span data-i18n-ignore className="font-bold">{invite.yacht_name}</span>.
                Your checklists, contracts and onboard work will appear in your BlueDeck account.
              </p>
              <a href="/dashboard" className="bd-primary-cta mt-7">
                Open dashboard
              </a>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <BlueDeckMark
                  className="h-14 w-20 shrink-0 rounded-none border-0 bg-transparent shadow-none"
                  imageClassName="object-contain p-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">
                    Secure yacht crew invitation
                  </p>
                  <h1 data-i18n-ignore className="mt-1 truncate text-3xl font-black text-slate-950">
                    {invite.position}
                  </h1>
                </div>
              </div>

              <div className="mt-8 grid gap-4 rounded-2xl border border-slate-200 bg-white/72 p-5 sm:grid-cols-2">
                <InviteFact icon={<Ship className="h-4 w-4" />} label="Yacht" value={invite.yacht_name} />
                <InviteFact icon={<UserPlus className="h-4 w-4" />} label="Department" value={invite.department} />
                <div className="sm:col-span-2">
                  <InviteFact
                    icon={<LockKeyhole className="h-4 w-4" />}
                    label="Invited account"
                    value={invite.crew_reference}
                  />
                </div>
              </div>

              {notice ? (
                <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
                  {notice}
                </p>
              ) : null}

              <button
                type="button"
                onClick={acceptInvite}
                disabled={accepting}
                className="mt-8 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#071631] px-5 text-lg font-black text-white shadow-lg shadow-slate-950/14 transition hover:bg-cyan-800 disabled:cursor-wait disabled:opacity-65"
              >
                {accepting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
                {accepting ? "Accepting invitation..." : "Accept secure invitation"}
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function InviteFact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
        {icon}
        {label}
      </p>
      <p data-i18n-ignore className="mt-2 truncate text-lg font-bold text-[#071f3c]">
        {value}
      </p>
    </div>
  );
}
