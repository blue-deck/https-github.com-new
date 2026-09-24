import type { JobListingViewer } from "../jobs/JobListingAction";

const crewProfileDestination = "/profile#cv-studio";
const hiringDestination = "/hiring";

/**
 * Keep the audience cards pointed at the intended workspace across sign-in.
 * Destination pages enforce account capabilities; a homepage link never grants
 * crew-profile or hiring access to an account that does not already have it.
 */
export function getHomeAudienceNavigation(viewer: JobListingViewer) {
  if (viewer.kind === "signed-in") {
    return {
      crewProfileHref: crewProfileDestination,
      hiringHref: hiringDestination,
    };
  }

  // These also work while the session is being restored: the login page checks
  // for an existing session and immediately continues to the requested path.
  return {
    crewProfileHref: `/login?next=${encodeURIComponent(crewProfileDestination)}`,
    hiringHref: `/login?mode=signup&next=${encodeURIComponent(hiringDestination)}`,
  };
}
