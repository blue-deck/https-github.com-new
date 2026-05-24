"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Mail, Ship, UserPlus } from "lucide-react";
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
      const { data: profile } = await supabase
        .from("crew_profiles")
        .upsert(
          {
            user_id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.email,
            public_crew_id: user.id.slice(0, 8).toUpperCase(),
          },
          { onConflict: "user_id" }
        )
        .select()
        .single();

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
      <main className="min-h-screen bg-[#020817] p-8 text-white">
        Loading invitation...
      </main>
    );
  }

  if (!invite) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020817] p-8 text-white">
        <div className="max-w-lg rounded-[32px] border border-white/10 bg-white/5 p-8 text-center">
          <Mail className="mx-auto h-12 w-12 text-cyan-300" />
          <h1 className="mt-4 text-3xl font-black">Invitation not found</h1>
          <p className="mt-3 text-gray-400">
            The invitation link may be expired or incorrect.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#020817] p-5 text-white">
      <div className="w-full max-w-xl rounded-[36px] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-900/20 p-8">
        {accepted ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-300" />
            <h1 className="mt-5 text-4xl font-black">Invitation accepted</h1>
            <p className="mt-4 text-gray-300">
              You are now connected to this yacht portal. Your assigned
              checklists and contracts will appear in your BlueDeck account.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400 text-black">
                <Ship className="h-7 w-7" />
              </div>
              <div>
                <p className="text-cyan-300">Yacht Crew Invitation</p>
                <h1 className="text-3xl font-black">{invite.position}</h1>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-black/25 p-5">
              <p className="text-gray-400">Department</p>
              <p className="mt-1 text-2xl font-bold">{invite.department}</p>
              <p className="mt-5 text-gray-400">Crew ID / email</p>
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
