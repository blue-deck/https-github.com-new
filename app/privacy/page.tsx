import { PublicPageShell } from "../components/PublicSiteChrome";

const sections = [
  {
    title: "Information We Collect",
    text: "BlueDeck may collect name, email address, phone number, account type, yacht position, profile details, maritime documents, expiry dates, yacht experience, references, portfolio images, invitations, contracts and checklist activity.",
  },
  {
    title: "How We Use Information",
    text: "We use this information to create user accounts, provide secure dashboards, manage crew profiles, build CVs, support captain invitations, organize contracts, show expiry alerts and keep yacht workflows connected.",
  },
  {
    title: "Documents and Photos",
    text: "Documents and images uploaded by users are used for profile, CV, portfolio, yacht record, checklist proof and operational history purposes inside the BlueDeck account experience.",
  },
  {
    title: "Security",
    text: "Authentication, email confirmation, password reset and database access are handled through configured secure providers. Access should be limited by account, role and yacht membership.",
  },
  {
    title: "Account Emails",
    text: "BlueDeck may send account confirmation, password reset, invitation and operational notification emails through the configured email provider and authenticated domain.",
  },
  {
    title: "Contact",
    text: "For privacy, account or deletion requests, contact info@bluedeck.app.",
  },
];

export default function PrivacyPage() {
  return (
    <PublicPageShell
      eyebrow="Privacy Policy"
      title="Privacy for a secure yacht and crew operations platform."
      intro="BlueDeck stores information only to support account access, crew profiles, yacht workspaces, documents, contracts and operational workflows."
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
