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

const INVITATION_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function acceptYachtInvitation(
  token: string,
  accessToken: string,
) {
  if (!INVITATION_TOKEN_PATTERN.test(token) || !accessToken) {
    return {
      error: new Error("This invitation needs a valid secure link before it can be accepted."),
    };
  }

  try {
    const response = await fetch(`/api/invitations/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string };

    if (!response.ok || !payload.ok) {
      return {
        error: new Error(payload.error || "Invitation could not be accepted."),
      };
    }

    return { data: payload, error: null };
  } catch {
    return {
      error: new Error("Invitation could not be accepted. Check your connection and try again."),
    };
  }
}
