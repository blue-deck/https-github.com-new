import { NextResponse } from "next/server";
import type { EmployerVerificationStatus } from "../../../../../lib/jobs/types";
import {
  requirePlatformRole,
  requireRequestUser,
  RequestAuthError,
} from "../../../../../lib/server/auth";
import { getSupabaseAdmin } from "../../../../../lib/server/supabaseAdmin";

const EMPLOYER_REVIEW_ROLES = ["admin", "moderator"] as const;
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization",
};

type DecisionBody = {
  decision?: unknown;
  internal_response?: unknown;
};

type EmployerRow = {
  id: string;
  display_name: string;
  company_name: string | null;
  employer_type: string;
  country_code: string | null;
  description: string | null;
  verification_status: EmployerVerificationStatus;
  verified_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireRequestUser(request);
    requirePlatformRole(user, EMPLOYER_REVIEW_ROLES);
    const { id } = await params;

    if (!isUuid(id)) {
      return NextResponse.json(
        { error: "A valid employer review identifier is required." },
        { status: 400, headers: PRIVATE_HEADERS },
      );
    }

    const body = (await request.json()) as DecisionBody;
    const decision = cleanText(body.decision, 20).toLowerCase();
    if (!["approve", "reject"].includes(decision)) {
      return NextResponse.json(
        { error: "Choose approve or reject for this verification review." },
        { status: 400, headers: PRIVATE_HEADERS },
      );
    }

    const internalResponse = cleanMultiline(body.internal_response, 500);
    const nextStatus: EmployerVerificationStatus =
      decision === "approve" ? "verified" : "rejected";
    const decidedAt = new Date().toISOString();
    const admin = getSupabaseAdmin();

    const updateResult = await admin
      .from("employer_profiles")
      .update({
        verification_status: nextStatus,
        verified_at: nextStatus === "verified" ? decidedAt : null,
      })
      .eq("id", id)
      .eq("verification_status", "pending")
      .select(
        "id,display_name,company_name,employer_type,country_code,description,verification_status,verified_at,created_at,updated_at",
      )
      .maybeSingle();

    if (isSchemaUnavailable(updateResult.error)) {
      return NextResponse.json(
        {
          available: false,
          error: "The protected employer review queue is not ready yet.",
        },
        { status: 503, headers: PRIVATE_HEADERS },
      );
    }

    if (updateResult.error) {
      return NextResponse.json(
        { error: "The employer verification decision could not be saved." },
        { status: 500, headers: PRIVATE_HEADERS },
      );
    }

    if (!updateResult.data) {
      return NextResponse.json(
        {
          error:
            "This employer is no longer pending review. Refresh the queue before deciding.",
        },
        { status: 409, headers: PRIVATE_HEADERS },
      );
    }

    const employer = updateResult.data as EmployerRow;
    return NextResponse.json(
      {
        ok: true,
        message:
          nextStatus === "verified"
            ? "Employer verification approved."
            : "Employer verification declined.",
        employer: {
          id: employer.id,
          displayName: employer.display_name,
          companyName: employer.company_name,
          employerType: employer.employer_type,
          countryCode: employer.country_code,
          description: employer.description || "",
          verificationStatus: employer.verification_status,
          verifiedAt: employer.verified_at,
          createdAt: employer.created_at,
          updatedAt: employer.updated_at,
        },
        decision: {
          status: nextStatus,
          decidedAt,
          internalResponse: internalResponse || null,
        },
      },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: PRIVATE_HEADERS },
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid employer verification request." },
        { status: 400, headers: PRIVATE_HEADERS },
      );
    }

    return NextResponse.json(
      { error: "The employer verification decision could not be saved." },
      { status: 500, headers: PRIVATE_HEADERS },
    );
  }
}

function cleanText(value: unknown, maximumLength: number) {
  return typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maximumLength)
    : "";
}

function cleanMultiline(value: unknown, maximumLength: number) {
  return typeof value === "string"
    ? value
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
        .replace(/\r\n?/g, "\n")
        .trim()
        .slice(0, maximumLength)
    : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isSchemaUnavailable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; message?: string };
  return (
    ["42P01", "PGRST204", "PGRST205"].includes(value.code || "") ||
    /schema cache|does not exist|could not find the table/i.test(value.message || "")
  );
}
