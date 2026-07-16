import { NextResponse } from "next/server";
import { requireRequestUser, RequestAuthError } from "../../../lib/server/auth";
import { getSupabaseAdmin } from "../../../lib/server/supabaseAdmin";

const employerTypes = new Set([
  "yacht",
  "captain",
  "owner",
  "management_company",
  "recruitment_agency",
  "other",
]);

type EmployerBody = {
  display_name?: unknown;
  company_name?: unknown;
  employer_type?: unknown;
  country_code?: unknown;
  description?: unknown;
};

export async function POST(request: Request) {
  try {
    const { user } = await requireRequestUser(request);
    const body = (await request.json()) as EmployerBody;
    const displayName = cleanText(body.display_name, 120);
    const companyName = cleanText(body.company_name, 160);
    const employerType = cleanText(body.employer_type, 40).toLowerCase() || "yacht";
    const countryCode = cleanText(body.country_code, 2).toUpperCase();
    const description = cleanText(body.description, 1600);

    if (displayName.length < 2) {
      return NextResponse.json(
        { error: "Employer display name must contain at least 2 characters." },
        { status: 400 },
      );
    }
    if (!employerTypes.has(employerType)) {
      return NextResponse.json({ error: "Select a valid employer type." }, { status: 400 });
    }
    if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
      return NextResponse.json({ error: "Country code must contain 2 letters." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const [{ data: existing, error: existingError }, { count: ownedYachtCount, error: yachtError }] =
      await Promise.all([
        admin
          .from("employer_profiles")
          .select(
            "id,display_name,company_name,employer_type,country_code,description,verification_status,verified_at",
          )
          .eq("user_id", user.id)
          .maybeSingle(),
        admin
          .from("yachts")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id),
      ]);

    if (isSchemaUnavailable(existingError)) {
      return NextResponse.json(
        { error: "The protected hiring database is not ready yet.", available: false },
        { status: 503 },
      );
    }
    if (existingError || yachtError) {
      return NextResponse.json(
        { error: "Employer workspace could not be verified." },
        { status: 500 },
      );
    }

    const canRequestReview = Boolean(ownedYachtCount);
    const existingStatus =
      typeof existing?.verification_status === "string"
        ? existing.verification_status
        : "unverified";
    const materialIdentityChanged = Boolean(existing?.id) && (
      normalizeText(existing?.display_name) !== normalizeText(displayName) ||
      normalizeText(existing?.company_name) !== normalizeText(companyName) ||
      normalizeText(existing?.employer_type) !== normalizeText(employerType) ||
      normalizeText(existing?.country_code) !== normalizeText(countryCode) ||
      normalizeText(existing?.description) !== normalizeText(description)
    );
    const verificationStatus =
      existingStatus === "verified" && materialIdentityChanged
        ? "pending"
        : ["unverified", "rejected"].includes(existingStatus) &&
            canRequestReview
          ? "pending"
          : existingStatus;
    const verifiedAt =
      verificationStatus === "verified"
        ? existing?.verified_at || null
        : null;

    const payload = {
      user_id: user.id,
      display_name: displayName,
      company_name: companyName || null,
      employer_type: employerType,
      country_code: countryCode || null,
      description,
      verification_status: verificationStatus,
      verified_at: verifiedAt,
    };

    const result = existing?.id
      ? await admin
          .from("employer_profiles")
          .update(payload)
          .eq("id", existing.id)
          .eq("user_id", user.id)
          .select(
            "id,display_name,company_name,employer_type,country_code,description,verification_status,verified_at,created_at,updated_at",
          )
          .single()
      : await admin
          .from("employer_profiles")
          .insert(payload)
          .select(
            "id,display_name,company_name,employer_type,country_code,description,verification_status,verified_at,created_at,updated_at",
          )
          .single();

    if (result.error) {
      return NextResponse.json(
        { error: "Employer profile could not be saved." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, employer: result.data });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid employer request." }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Employer profile could not be saved." },
      { status: 500 },
    );
  }
}

function cleanText(value: unknown, maximumLength: number) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximumLength)
    : "";
}

function normalizeText(value: unknown) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().toLocaleLowerCase("en-US")
    : "";
}

function isSchemaUnavailable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; message?: string };
  return (
    ["42P01", "PGRST204", "PGRST205"].includes(value.code || "") ||
    /schema cache|does not exist|could not find the table/i.test(value.message || "")
  );
}
