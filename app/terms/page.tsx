import { PublicPageShell } from "../components/PublicSiteChrome";

const sections = [
  {
    title: "Account Use",
    text: "Users must provide accurate account information, keep login details secure and promptly update material changes to professional, employer, yacht or document information. Accounts may not be transferred, impersonated or used to mislead another person.",
  },
  {
    title: "Job Listings and Applications",
    text: "Where recruitment features are available, BlueDeck provides technology for publishing yacht roles, submitting applications and managing hiring workflows. Job posters are responsible for lawful, accurate and current listings. Applicants are responsible for the accuracy of their profile, qualifications, availability and application answers.",
  },
  {
    title: "No Employment Guarantee",
    text: "BlueDeck is not the employer, shipowner, recruitment agency or party to an employment agreement unless expressly stated in writing. Publishing a role, applying, being shortlisted or receiving a verification badge does not guarantee an interview, offer, employment, payment, visa, safe working conditions or successful placement.",
  },
  {
    title: "Employer Verification",
    text: "BlueDeck may review supplied organization, yacht, domain or representative information before allowing an account or listing to use certain features. Verification is a point-in-time review and is not an endorsement or continuing warranty. Users must still perform their own identity, contract, vessel and employment checks.",
  },
  {
    title: "Recruitment Fees and Scam Safety",
    text: "A job poster must not request payment from a seafarer to secure access to an interview, job offer or placement. Users should never send money, banking credentials, passwords or identity documents in response to an unverified request. Suspicious listings, payment requests, impersonation or off-platform pressure should be reported to BlueDeck immediately.",
  },
  {
    title: "Applicant Data",
    text: "Employers and hiring teams may use applicant information only to evaluate a genuine role, communicate about that application, perform lawful hiring checks and complete authorized onboarding. Applicant data must not be sold, scraped, republished, used for unrelated marketing or retained indefinitely.",
  },
  {
    title: "Yacht and Crew Workflows",
    text: "BlueDeck may organize crew profiles, yacht memberships, documents, invitations, contracts, checklist activity and related records. Access to private yacht and recruitment information must be used only for authorized professional and operational purposes.",
  },
  {
    title: "Operational Responsibility",
    text: "BlueDeck supports organization and record keeping but does not replace professional judgment, flag-state requirements, employment advice, legal advice, medical advice, safety procedures or required maritime systems. Captains, owners, employers, managers and crew remain responsible for legal, employment, maritime, safety and operational decisions.",
  },
  {
    title: "Prohibited Conduct",
    text: "Users must not post fraudulent or discriminatory roles, impersonate a yacht or company, harvest personal data, send spam, introduce malicious code, bypass access controls, misuse documents, threaten users or use BlueDeck for unlawful exploitation, trafficking or unsafe recruitment.",
  },
  {
    title: "Content and Confidentiality",
    text: "Users retain responsibility for content they upload and confirm they have the right to use it. Users must respect third-party privacy, confidentiality, intellectual property and image rights. BlueDeck may remove content or restrict access when reasonably necessary for safety, legal compliance or platform integrity.",
  },
  {
    title: "Records and Retention",
    text: "Application, verification, contract, security and yacht-operation records may be retained for the period reasonably needed to provide the service, resolve disputes, prevent misuse and meet applicable obligations. Users may request deletion, but some records may need to be preserved where lawfully required.",
  },
  {
    title: "Availability",
    text: "The service may be updated, improved or temporarily unavailable during maintenance, hosting changes or provider interruptions.",
  },
  {
    title: "Suspension and Reporting",
    text: "BlueDeck may pause a listing, application workflow or account while reviewing suspected fraud, unsafe recruitment, inaccurate verification details, security issues or a breach of these terms. Reports should be made promptly and include enough information for review.",
  },
  {
    title: "Contact",
    text: "For account, legal, recruitment-safety or operational requests, contact info@bluedeck.app.",
  },
];

export default function TermsPage() {
  return (
    <PublicPageShell
      eyebrow="Terms"
      title="Clear terms for yacht jobs, crew hiring and connected operations."
      intro="These terms set the basic expectations for candidates, employers, yacht teams and other users of BlueDeck."
    >
      <section className="bd-section pt-4">
        <div className="grid gap-5">
          {sections.map((section) => (
            <article key={section.title} className="bd-editorial-card">
              <h2 className="text-2xl font-semibold text-[#071f3c]">{section.title}</h2>
              <p className="mt-3 leading-8 text-[#5b7088]">{section.text}</p>
            </article>
          ))}
        </div>
      </section>
    </PublicPageShell>
  );
}
