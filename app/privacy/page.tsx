import { PublicPageShell } from "../components/PublicSiteChrome";
import { privacyPolicyVersion } from "../lib/legalPolicies";

const sections = [
  {
    title: "Who is responsible",
    paragraphs: [
      "BlueDeck is responsible for the personal information processed to operate this service. Privacy, access, correction, export and deletion requests can be sent to info@bluedeck.app.",
      "Where a yacht owner, captain or management company uploads or manages information about other people, that organization may also be responsible for deciding why and how that information is used.",
    ],
  },
  {
    title: "Information we process",
    paragraphs: [
      "BlueDeck processes information you provide, information created through your use of the service, and limited technical information needed to keep the service secure and reliable.",
    ],
    bullets: [
      "Account and identity details, including name, email, phone number, account type and yacht position.",
      "Crew profile, experience, availability, language, reference, CV, profile photo and gallery information.",
      "Yacht workspaces, memberships, invitations, job posts, applications, contracts, checklists, alerts and audit records.",
      "Maritime and operational documents, expiry dates and files you choose to upload.",
      "Security and technical records such as session identifiers, request timing, IP-derived abuse controls and provider logs.",
    ],
  },
  {
    title: "Why we use information",
    paragraphs: [
      "We use information to create and secure accounts, provide crew and yacht workspaces, publish authorized job posts, process applications, generate CVs, manage invitations and contracts, maintain operational records, prevent abuse, provide support and comply with legal obligations.",
      "Depending on the context, processing is necessary to provide the service described when you select an account role, to protect BlueDeck and its users, to comply with law, or because you made a specific CV or content-display selection.",
    ],
  },
  {
    title: "Public crew directory",
    paragraphs: [
      "Active, email-confirmed accounts registered as Crew or Captain are automatically included in the public Find Crew directory while they remain eligible. Find Crew can be viewed without creating or signing in to a BlueDeck account.",
      "Public results use a masked display name and may show selected professional and physical profile details, availability, work preferences, profile and gallery images, and counts of completed profile records. A linked Crew ID CV or gallery may also show CV-selected certificate metadata, work-experience details and reference role, vessel or company information.",
      "Full legal names, email addresses, phone numbers, reference contact details, private document files, storage paths and yacht workspaces are not included in the public directory.",
    ],
  },
  {
    title: "Who receives information",
    paragraphs: [
      "Information is shared only as needed for the service: with authorized yacht members, employers or applicants involved in a workflow; with a person you invite or contract with; when required by law; or with infrastructure providers acting for BlueDeck.",
    ],
    bullets: [
      "Supabase provides authentication, database and private file storage services.",
      "Vercel and Cloudflare-based infrastructure provide hosting, delivery and network protection.",
      "Cloudflare Turnstile provides bot and abuse protection when enabled.",
      "Email delivery providers send account confirmation, recovery, invitation and security messages.",
      "OpenStreetMap tile services and Open-Meteo geocoding may receive the technical request and location query when map features are used.",
    ],
  },
  {
    title: "International processing",
    paragraphs: [
      "BlueDeck and its infrastructure providers may process information in more than one country. Where required, transfers are handled under the provider's contractual and legal safeguards. You may contact us for more information about safeguards relevant to your account.",
    ],
  },
  {
    title: "Retention and deletion",
    paragraphs: [
      "We keep account and operational information only while it is needed to provide the service, preserve authorized yacht records, resolve disputes, protect security or meet legal obligations.",
    ],
    bullets: [
      "Completed checklists and their unshared task photos are removed after six months.",
      "Expired pending invitations are removed after a 30-day grace period; completed or revoked invitation records are removed after one year.",
      "Unlinked legacy task photos are eligible for removal after 30 days, and short-lived password-recovery transactions are purged after completion or expiry.",
      "Account deletion requests are assessed promptly; information that must be retained for security, legal claims or authorized operational records is isolated and kept only as long as necessary.",
    ],
  },
  {
    title: "Security",
    paragraphs: [
      "BlueDeck uses email confirmation, role and yacht-level authorization, row-level database controls, private storage, bounded uploads, session validation, rate limits, security headers, single-use recovery transactions and audit records. No internet service can promise absolute security, so users must also protect their devices, passwords and email accounts.",
    ],
  },
  {
    title: "Your choices and rights",
    paragraphs: [
      "You can update most profile information in BlueDeck. Public directory inclusion follows the active Crew or Captain role associated with your account. Depending on applicable law, you may request access, correction, deletion, restriction, objection or a portable copy of your personal information, and may complain to the relevant data-protection authority.",
      "We may need to verify your identity and authority over a yacht or account before acting on a request. Send requests to info@bluedeck.app.",
    ],
  },
  {
    title: "Cookies and local storage",
    paragraphs: [
      "BlueDeck uses authentication storage, strictly necessary recovery cookies, language preferences and an offline application cache. These support login, security and core functionality. BlueDeck does not use third-party advertising cookies in the current service.",
    ],
  },
  {
    title: "Age and policy changes",
    paragraphs: [
      "BlueDeck is intended for adults with legal capacity to work in, recruit for or manage professional yacht operations. It is not directed to children.",
      "Material policy changes will receive a new version date and, where required, renewed acceptance. Continued use never removes rights that cannot lawfully be waived.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <PublicPageShell
      eyebrow="Privacy Policy"
      title="Clear privacy for crew, hiring and yacht operations."
      intro="This policy explains what BlueDeck processes, who can see it, how long it is kept and the choices available to you."
    >
      <section className="bd-section pt-4">
        <div className="mb-6 rounded-2xl border border-[#071f3c]/10 bg-white/75 px-5 py-4 text-sm font-semibold text-[#5b7088]">
          Effective version: {privacyPolicyVersion}
        </div>
        <div className="grid gap-5">
          {sections.map((section) => (
            <article key={section.title} className="bd-editorial-card">
              <h2 className="text-2xl font-semibold text-[#071f3c]">{section.title}</h2>
              <div className="mt-3 space-y-3 leading-8 text-[#5b7088]">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.bullets && (
                  <ul className="list-disc space-y-2 pl-6">
                    {section.bullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </PublicPageShell>
  );
}
