import { NextResponse } from "next/server";
import type {
  PlatformEmployerReview,
  PlatformEmployerReviewYacht,
} from "../../../../lib/jobs/types";
import {
  requirePlatformRole,
  requireRequestUser,
  RequestAuthError,
} from "../../../../lib/server/auth";
import { getSupabaseAdmin } from "../../../../lib/server/supabaseAdmin";

const EMPLOYER_REVIEW_ROLES = ["admin", "moderator"] as const;
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization",
};

type EmployerRow = {
  id: string;
  user_id: string;
  display_name: string;
  company_name: string | null;
  employer_type: string;
  country_code: string | null;
  description: string | null;
  verification_status: string;
  created_at: string | null;
  updated_at: string | null;
};

type YachtRow = PlatformEmployerReviewYacht & {
  owner_id: string;
};

type JobRow = {
  employer_id: string;
};

export async function GET(request: Request) {
  try {
    const { user } = await requireRequestUser(request);
    requirePlatformRole(user, EMPLOYER_REVIEW_ROLES);
    const admin = getSupabaseAdmin();

    const employersResult = await admin
      .from("employer_profiles")
      .select(
        "id,user_id,display_name,company_name,employer_type,country_code,description,verification_status,created_at,updated_at",
        { count: "exact" },
      )
      .eq("verification_status", "pending")
      .order("updated_at", { ascending: true })
      .limit(50);

    if (isSchemaUnavailable(employersResult.error)) {
      return NextResponse.json(
        {
          available: false,
          reviews: [],
          total: 0,
          error: "The protected employer review queue is not ready yet.",
        },
        { status: 503, headers: PRIVATE_HEADERS },
      );
    }

    if (employersResult.error) {
      return NextResponse.json(
        { error: "The employer review queue could not be loaded." },
        { status: 500, headers: PRIVATE_HEADERS },
      );
    }

    const employers = (employersResult.data || []) as EmployerRow[];
    if (!employers.length) {
      return NextResponse.json(
        {
          available: true,
          reviews: [],
          total: employersResult.count || 0,
        },
        { headers: PRIVATE_HEADERS },
      );
    }

    const employerUserIds = employers.map((employer) => employer.user_id);
    const employerIds = employers.map((employer) => employer.id);
    const [yachtsResult, jobsResult] = await Promise.all([
      admin
        .from("yachts")
        .select("id,owner_id,name,model,flag")
        .in("owner_id", employerUserIds)
        .order("name", { ascending: true }),
      admin
        .from("job_posts")
        .select("employer_id")
        .in("employer_id", employerIds),
    ]);

    if (yachtsResult.error || (jobsResult.error && !isSchemaUnavailable(jobsResult.error))) {
      return NextResponse.json(
        { error: "Employer verification evidence could not be loaded." },
        { status: 500, headers: PRIVATE_HEADERS },
      );
    }

    const yachtsByOwner = new Map<string, PlatformEmployerReviewYacht[]>();
    for (const yacht of (yachtsResult.data || []) as YachtRow[]) {
      const current = yachtsByOwner.get(yacht.owner_id) || [];
      current.push({
        id: yacht.id,
        name: yacht.name,
        model: yacht.model,
        flag: yacht.flag,
      });
      yachtsByOwner.set(yacht.owner_id, current);
    }

    const jobCountByEmployer = new Map<string, number>();
    for (const job of (jobsResult.data || []) as JobRow[]) {
      jobCountByEmployer.set(
        job.employer_id,
        (jobCountByEmployer.get(job.employer_id) || 0) + 1,
      );
    }

    const reviews: PlatformEmployerReview[] = employers.map((employer) => {
      const yachts = yachtsByOwner.get(employer.user_id) || [];
      return {
        id: employer.id,
        displayName: employer.display_name,
        companyName: employer.company_name,
        employerType: employer.employer_type,
        countryCode: employer.country_code,
        description: employer.description || "",
        verificationStatus: "pending",
        createdAt: employer.created_at,
        updatedAt: employer.updated_at,
        yachtCount: yachts.length,
        yachts,
        jobCount: jobCountByEmployer.get(employer.id) || 0,
      };
    });

    return NextResponse.json(
      {
        available: true,
        reviews,
        total: employersResult.count || reviews.length,
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

    return NextResponse.json(
      { error: "The employer review queue could not be loaded." },
      { status: 500, headers: PRIVATE_HEADERS },
    );
  }
}

function isSchemaUnavailable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; message?: string };
  return (
    ["42P01", "PGRST204", "PGRST205"].includes(value.code || "") ||
    /schema cache|does not exist|could not find the table/i.test(value.message || "")
  );
}
