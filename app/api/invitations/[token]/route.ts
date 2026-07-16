import { NextResponse } from "next/server";
import { authenticateRequest } from "../../../lib/server/auth";
import { getSupabaseAdmin } from "../../../lib/server/supabaseAdmin";

type RouteContext = {
  params: Promise<{ token: string }>;
};

const TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  if (!TOKEN_PATTERN.test(token)) {
    return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
  }

  try {
    const admin = getSupabaseAdmin();
    const invitationResult = await admin
      .from("crew_invitations")
      .select(
        "id,yacht_id,crew_profile_id,public_crew_id,invited_email,position,department,status,accepted_at,created_at",
      )
      .eq("token", token)
      .maybeSingle();

    if (invitationResult.error || !invitationResult.data) {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    const yachtResult = await admin
      .from("yachts")
      .select("id,name")
      .eq("id", invitationResult.data.yacht_id)
      .maybeSingle();

    return NextResponse.json(
      {
        invitation: {
          id: invitationResult.data.id,
          yacht_name: yachtResult.data?.name || "BlueDeck yacht",
          position: invitationResult.data.position || "Yacht crew",
          department: invitationResult.data.department || "Crew",
          crew_reference:
            invitationResult.data.public_crew_id ||
            maskEmail(invitationResult.data.invited_email),
          status: invitationResult.data.status || "pending",
          created_at: invitationResult.data.created_at,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Invitation could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;
  if (!TOKEN_PATTERN.test(token)) {
    return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
  }

  try {
    const authenticated = await authenticateRequest(request);
    if (!authenticated?.user?.email) {
      return NextResponse.json({ error: "Login is required to accept this invitation." }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const invitationResult = await admin
      .from("crew_invitations")
      .select(
        "id,yacht_id,crew_profile_id,public_crew_id,invited_email,position,department,status,accepted_at",
      )
      .eq("token", token)
      .maybeSingle();

    if (invitationResult.error || !invitationResult.data) {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    const invitation = invitationResult.data;
    if (invitation.status === "accepted") {
      return NextResponse.json({ ok: true, alreadyAccepted: true });
    }
    if (invitation.status !== "pending") {
      return NextResponse.json({ error: "This invitation is no longer active." }, { status: 409 });
    }

    const userEmail = normalizeEmail(authenticated.user.email);
    const invitedEmail = normalizeEmail(invitation.invited_email);
    let invitedProfile:
      | {
          id: string;
          user_id?: string | null;
          email?: string | null;
          full_name?: string | null;
          public_crew_id?: string | null;
        }
      | null = null;

    if (invitation.crew_profile_id) {
      const profileResult = await admin
        .from("crew_profiles")
        .select("id,user_id,email,full_name,public_crew_id")
        .eq("id", invitation.crew_profile_id)
        .maybeSingle();
      if (profileResult.error) {
        return NextResponse.json({ error: "Invited crew profile could not be verified." }, { status: 500 });
      }
      invitedProfile = profileResult.data;
    }

    const invitedProfileIsClaimed = Boolean(invitedProfile?.user_id);
    const profileBelongsToUser =
      invitedProfile?.user_id === authenticated.user.id;
    const unclaimedProfileEmailMatches =
      !invitedProfileIsClaimed &&
      Boolean(normalizeEmail(invitedProfile?.email)) &&
      normalizeEmail(invitedProfile?.email) === userEmail;
    const invitationEmailMatches =
      Boolean(invitedEmail) && invitedEmail === userEmail;

    if (
      (invitation.crew_profile_id &&
        invitedProfileIsClaimed &&
        !profileBelongsToUser) ||
      (invitation.crew_profile_id &&
        !invitedProfileIsClaimed &&
        !unclaimedProfileEmailMatches) ||
      (!invitation.crew_profile_id && !invitationEmailMatches)
    ) {
      return NextResponse.json(
        { error: "Sign in with the email address that received this invitation." },
        { status: 403 },
      );
    }

    const ownProfileResult = await admin
      .from("crew_profiles")
      .select("id,user_id,email,full_name,public_crew_id")
      .eq("user_id", authenticated.user.id)
      .maybeSingle();
    if (ownProfileResult.error) {
      return NextResponse.json({ error: "Your crew profile could not be verified." }, { status: 500 });
    }

    let crewProfile =
      profileBelongsToUser && invitedProfile
        ? invitedProfile
        : ownProfileResult.data || invitedProfile;
    if (!crewProfile) {
      const created = await admin
        .from("crew_profiles")
        .insert({
          user_id: authenticated.user.id,
          email: userEmail,
          full_name:
            cleanName(authenticated.user.user_metadata?.full_name) ||
            userEmail.split("@")[0],
          public_crew_id: authenticated.user.id.slice(0, 8).toUpperCase(),
          current_position: invitation.position || null,
        })
        .select("id,user_id,email,full_name,public_crew_id")
        .single();
      if (created.error || !created.data) {
        return NextResponse.json({ error: "Your crew profile could not be created." }, { status: 500 });
      }
      crewProfile = created.data;
    } else if (crewProfile.user_id !== authenticated.user.id) {
      const linked = await admin
        .from("crew_profiles")
        .update({
          user_id: authenticated.user.id,
          email: userEmail,
          full_name:
            crewProfile.full_name ||
            cleanName(authenticated.user.user_metadata?.full_name) ||
            userEmail.split("@")[0],
        })
        .eq("id", crewProfile.id)
        .is("user_id", null)
        .select("id,user_id,email,full_name,public_crew_id")
        .single();
      if (linked.error || !linked.data) {
        return NextResponse.json(
          { error: "This invitation is already linked to another account." },
          { status: 409 },
        );
      }
      crewProfile = linked.data;
    }

    const claimResult = await admin
      .from("crew_invitations")
      .update({ status: "processing" })
      .eq("id", invitation.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (claimResult.error) {
      return NextResponse.json({ error: "Invitation could not be secured for acceptance." }, { status: 500 });
    }

    if (!claimResult.data) {
      const currentInvitation = await admin
        .from("crew_invitations")
        .select("status")
        .eq("id", invitation.id)
        .maybeSingle();

      if (currentInvitation.data?.status === "accepted") {
        return NextResponse.json({ ok: true, alreadyAccepted: true });
      }

      return NextResponse.json(
        { error: "This invitation is already being processed. Please try again shortly." },
        { status: 409 },
      );
    }

    let invitationFinalized = false;

    try {
      const membershipProfileIds = [
        ...new Set(
          [crewProfile.id, invitation.crew_profile_id]
            .map((value) => String(value || ""))
            .filter(Boolean),
        ),
      ];
      const membershipResult = await admin
        .from("yacht_crew_memberships")
        .select("id,crew_profile_id,invited_email,position,department,status")
        .eq("yacht_id", invitation.yacht_id)
        .in("crew_profile_id", membershipProfileIds)
        .order("created_at", { ascending: true });
      if (membershipResult.error) {
        return NextResponse.json({ error: "Yacht membership could not be checked." }, { status: 500 });
      }
      const membershipRows = membershipResult.data || [];
      const ownMembership =
        membershipRows.find(
          (membership) => membership.crew_profile_id === crewProfile.id,
        ) || null;
      const invitedMembership =
        invitation.crew_profile_id &&
        invitation.crew_profile_id !== crewProfile.id
          ? membershipRows.find(
              (membership) =>
                membership.crew_profile_id === invitation.crew_profile_id,
            ) || null
          : null;
      const existingMembership = ownMembership || invitedMembership;

      const acceptedAt = new Date().toISOString();
      const membershipPayload = {
        yacht_id: invitation.yacht_id,
        crew_profile_id: crewProfile.id,
        invited_email: userEmail,
        position: invitation.position,
        department: invitation.department,
        status: "active",
      };
      let createdMembershipId = "";
      const membershipWrite = existingMembership
        ? await admin
            .from("yacht_crew_memberships")
            .update(membershipPayload)
            .eq("id", existingMembership.id)
            .select("id")
            .maybeSingle()
        : await admin
            .from("yacht_crew_memberships")
            .insert(membershipPayload)
            .select("id")
            .single();
      if (
        membershipWrite.error ||
        (existingMembership && !membershipWrite.data)
      ) {
        return NextResponse.json({ error: "Yacht membership could not be activated." }, { status: 500 });
      }
      createdMembershipId = existingMembership
        ? ""
        : String(membershipWrite.data?.id || "");

      const inviteUpdate = await admin
        .from("crew_invitations")
        .update({
          crew_profile_id: crewProfile.id,
          public_crew_id: crewProfile.public_crew_id || invitation.public_crew_id || null,
          invited_email: userEmail,
          status: "accepted",
          accepted_at: acceptedAt,
        })
        .eq("id", invitation.id)
        .eq("status", "processing")
        .select("id")
        .maybeSingle();
      if (inviteUpdate.error || !inviteUpdate.data) {
        const rollbackResult = existingMembership
          ? await admin
              .from("yacht_crew_memberships")
              .update({
                crew_profile_id: existingMembership.crew_profile_id,
                invited_email: existingMembership.invited_email,
                position: existingMembership.position,
                department: existingMembership.department,
                status: existingMembership.status,
              })
              .eq("id", existingMembership.id)
          : createdMembershipId
            ? await admin
                .from("yacht_crew_memberships")
                .delete()
                .eq("id", createdMembershipId)
            : { error: null };

        if (rollbackResult.error) {
          console.error("Invitation membership rollback failed.", {
            invitationId: invitation.id,
            membershipId: existingMembership?.id || createdMembershipId,
            error: rollbackResult.error,
          });
        }
        return NextResponse.json({ error: "Invitation could not be completed." }, { status: 500 });
      }

      if (
        ownMembership &&
        invitedMembership &&
        ["invited", "pending"].includes(
          String(invitedMembership.status || "").trim().toLowerCase(),
        )
      ) {
        const staleMembershipCleanup = await admin
          .from("yacht_crew_memberships")
          .delete()
          .eq("id", invitedMembership.id)
          .in("status", ["invited", "pending"]);
        if (staleMembershipCleanup.error) {
          console.error("Stale invitation membership cleanup failed.", {
            invitationId: invitation.id,
            membershipId: invitedMembership.id,
            error: staleMembershipCleanup.error,
          });
        }
      }

      invitationFinalized = true;
      return NextResponse.json({ ok: true, acceptedAt });
    } finally {
      if (!invitationFinalized) {
        await admin
          .from("crew_invitations")
          .update({ status: "pending" })
          .eq("id", invitation.id)
          .eq("status", "processing");
      }
    }
  } catch {
    return NextResponse.json({ error: "Invitation could not be accepted." }, { status: 500 });
  }
}

function normalizeEmail(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 120) : "";
}

function maskEmail(value?: string | null) {
  const email = normalizeEmail(value);
  const [name, domain] = email.split("@");
  if (!name || !domain) return "Invited crew";
  return `${name.slice(0, 2)}${"*".repeat(Math.min(Math.max(name.length - 2, 2), 8))}@${domain}`;
}
