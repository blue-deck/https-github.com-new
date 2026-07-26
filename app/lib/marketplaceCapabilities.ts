export const marketplaceAccountRoles = [
  "crew",
  "captain",
  "owner",
  "management",
] as const;

export const marketplacePostingRoles = [
  "captain",
  "owner",
  "management",
] as const;

export const marketplaceApplicantRoles = ["crew", "captain"] as const;

export type MarketplaceAccountRole =
  (typeof marketplaceAccountRoles)[number];

export type MarketplaceCapabilities = {
  role: MarketplaceAccountRole;
  canPostJobs: boolean;
  canApplyJobs: boolean;
  requiresAdminApproval: false;
};

export function isMarketplaceAccountRole(
  value: unknown,
): value is MarketplaceAccountRole {
  return marketplaceAccountRoles.includes(value as MarketplaceAccountRole);
}

export function normalizeMarketplaceAccountRole(
  value: unknown,
): MarketplaceAccountRole {
  if (typeof value !== "string") return "crew";
  const normalized = value.trim().toLowerCase();
  return isMarketplaceAccountRole(normalized) ? normalized : "crew";
}

export function marketplaceCapabilitiesForRole(
  role: MarketplaceAccountRole,
): MarketplaceCapabilities {
  return {
    role,
    canPostJobs: marketplacePostingRoles.includes(
      role as (typeof marketplacePostingRoles)[number],
    ),
    canApplyJobs: marketplaceApplicantRoles.includes(
      role as (typeof marketplaceApplicantRoles)[number],
    ),
    requiresAdminApproval: false,
  };
}

export function marketplaceRoleLabel(
  role: MarketplaceAccountRole,
  language: "en" | "tr",
) {
  const labels = {
    en: {
      crew: "Crew",
      captain: "Captain",
      owner: "Owner / Employer",
      management: "Management",
    },
    tr: {
      crew: "Crew",
      captain: "Captain",
      owner: "Sahip / İşveren",
      management: "Yönetim",
    },
  } as const;

  return labels[language][role];
}
