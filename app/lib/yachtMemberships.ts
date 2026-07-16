type SupabaseClientLike = {
  from: (table: string) => any;
};

type YachtMembershipInput = {
  yacht_id: string;
  crew_profile_id?: string | null;
  invited_email?: string | null;
  position?: string | null;
  department?: string | null;
  status?: string | null;
};

function cleanMembershipPayload(input: YachtMembershipInput) {
  return {
    yacht_id: input.yacht_id,
    crew_profile_id: input.crew_profile_id || null,
    invited_email: input.invited_email || null,
    position: input.position || null,
    department: input.department || null,
    status: input.status || "invited",
  };
}

async function findMembershipId(
  supabase: SupabaseClientLike,
  membership: YachtMembershipInput
) {
  if (membership.crew_profile_id) {
    const byProfile = await supabase
      .from("yacht_crew_memberships")
      .select("id")
      .eq("yacht_id", membership.yacht_id)
      .eq("crew_profile_id", membership.crew_profile_id)
      .limit(1);

    if (byProfile.error) return { error: byProfile.error };
    if (byProfile.data?.[0]?.id) return { id: byProfile.data[0].id };
  }

  if (membership.invited_email) {
    const byEmail = await supabase
      .from("yacht_crew_memberships")
      .select("id")
      .eq("yacht_id", membership.yacht_id)
      .eq("invited_email", membership.invited_email)
      .limit(1);

    if (byEmail.error) return { error: byEmail.error };
    if (byEmail.data?.[0]?.id) return { id: byEmail.data[0].id };
  }

  return {};
}

export async function saveYachtMembership(
  supabase: SupabaseClientLike,
  membership: YachtMembershipInput
) {
  const payload = cleanMembershipPayload(membership);
  const existing = await findMembershipId(supabase, payload);

  if (existing.error) return { error: existing.error };

  if (existing.id) {
    return supabase
      .from("yacht_crew_memberships")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .limit(1);
  }

  return supabase.from("yacht_crew_memberships").insert(payload).select().limit(1);
}

function isMissingColumnError(error: any, column: string) {
  const message = `${error?.message || ""} ${error?.details || ""}`;
  return message.includes(column) && message.includes("schema cache");
}

export async function markInvitationAccepted(
  supabase: SupabaseClientLike,
  invitationId: string,
  crewProfileId?: string | null
) {
  const updateWithTimestamp: Record<string, string> = {
    status: "accepted",
    accepted_at: new Date().toISOString(),
  };

  if (crewProfileId) updateWithTimestamp.crew_profile_id = crewProfileId;

  const response = await supabase
    .from("crew_invitations")
    .update(updateWithTimestamp)
    .eq("id", invitationId);

  if (!isMissingColumnError(response.error, "accepted_at")) {
    return response;
  }

  const fallbackUpdate: Record<string, string> = { status: "accepted" };
  if (crewProfileId) fallbackUpdate.crew_profile_id = crewProfileId;

  return supabase
    .from("crew_invitations")
    .update(fallbackUpdate)
    .eq("id", invitationId);
}
