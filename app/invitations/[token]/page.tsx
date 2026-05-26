"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Mail, UserPlus } from "lucide-react";
import { BlueDeckLogoLink, BlueDeckMark } from "../../components/BlueDeckLogo";
import { saveCrewProfileByUserId } from "../../lib/crewProfiles";
import { supabase } from "../../lib/supabase";
import {
  markInvitationAccepted,
  saveYachtMembership,
} from "../../lib/yachtMemberships";

export default function InvitationPage() {
  const params = useParams();
  const token = String(params?.token || "");
  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);

  async function loadInvite() {
    const { data, error } = await supabase
      .from("crew_invitations")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (error) {
      alert(error.message);
    }

    setInvite(data);
    setLoading(false);
  }

  async function acceptInvite() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      window.location.href = `/login?invite=${token}`;
      return;
    }

    let crewProfileId = invite.crew_profile_id;

    if (!crewProfileId) {
      const { data: profile } = await saveCrewProfileByUserId(
        supabase,
        user.id,
        {
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email,
          public_crew_id: user.id.slice(0, 8).toUpperCase(),
        }
      );

      crewProfileId = profile?.id;
    }

    const { error: membershipError } = await saveYachtMembership(supabase, {
      yacht_id: invite.yacht_id,
      crew_profile_id: crewProfileId,
      invited_email: user.email,
      position: invite.position,
      department: invite.department,
      status: "active",
    });

    if (membershipError) {
      alert(membershipError.message);
      return;
    }

    const { error: inviteError } = await markInvitationAccepted(
      supabase,
      invite.id,
      crewProfileId
    );

    if (inviteError) {
      alert(inviteError.message);
      return;
    }

    setAccepted(true);
  }

  useEffect(() => {
    loadInvite();
  }, []);

  if (loading) {
    return (
      <main className="bd-ocean-shell min-h-screen p-8 text-slate-900">
        <div className="bd-ocean-content">Loading invitation...</div>
      </main>
    );
  }

  if (!invite) {
    return (
      <main className="bd-ocean-shell flex min-h-screen items-center justify-center p-8 text-slate-900">
        <div className="bd-glass-card-strong max-w-lg rounded-[32px] p-8 text-center">
          <Mail className="mx-auto h-12 w-12 text-cyan-700" />
          <h1 className="bd-serif mt-4 text-4xl font-normal text-[#071f3c]">Invitation not found</h1>
          <p className="mt-3 text-slate-500">
            The invitation link may be expired or incorrect.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="bd-ocean-shell flex min-h-screen items-center justify-center p-5 text-slate-900">
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
              <p className="mt-1 text-xl">{invite.public_crew_id || invite.invited_email}</p>
            </div>

            <button
              onClick={acceptInvite}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 py-4 text-xl font-black text-black"
            >
              <UserPlus className="h-5 w-5" />
              Accept Invitation
            </button>
          </>
        )}
      </div>
    </main>
  );
}
