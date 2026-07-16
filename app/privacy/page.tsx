import { PublicPageShell } from "../components/PublicSiteChrome";

const sections = [
  {
    title: "Information We Collect",
    text: "BlueDeck may collect account identity, contact details, account type, yacht position, professional profile and CV information, availability and job preferences, maritime qualifications, documents and expiry dates, experience, references, portfolio images, job applications and screening answers, employer or organization details, invitations, contracts and yacht workflow activity.",
  },
  {
    title: "How We Use Information",
    text: "We use information to provide accounts and dashboards, build professional crew profiles, support job discovery and applications, help authorized employers review applicants, review employer or organization details, manage yacht invitations and onboarding, organize contracts and expiry alerts, prevent misuse and keep yacht workflows connected.",
  },
  {
    title: "Applications and Employer Access",
    text: "When a crew member applies for a role or deliberately shares a profile, BlueDeck may make the application and the professional information needed to assess it available to the relevant employer, yacht or authorized hiring team. Employers must use applicant data only for legitimate recruitment, hiring, onboarding, compliance and related record-keeping purposes.",
  },
  {
    title: "Public Profile Safety",
    text: "Shareable crew pages are designed to show a limited professional summary rather than private contact, identity or medical details. Users control the information they add to profiles and portfolio areas and should not publish passport numbers, private addresses, financial information or other unnecessary sensitive data.",
  },
  {
    title: "Documents, Photos and References",
    text: "Uploaded documents and images may support profile, CV, application, verification, yacht record, checklist proof and operational history workflows. Reference information should be added only with an appropriate basis to share it. Document files and private contact details are not intended for unrestricted public display.",
  },
  {
    title: "Employer Verification and Safety Review",
    text: "BlueDeck may request business, organization, yacht, domain or representative information to review an employer account or job listing. A review or badge reflects checks completed at that time; it does not guarantee identity, conduct, payment, working conditions or the outcome of any employment relationship.",
  },
  {
    title: "Retention and Deletion",
    text: "Personal information is retained only for as long as reasonably necessary for the purpose for which it was collected, to operate the account, preserve application or yacht records, prevent fraud, resolve disputes and meet applicable legal obligations. Retention may vary by record type. Users may request account or data deletion, subject to records that must lawfully be kept and limited backup retention.",
  },
  {
    title: "Service Providers and Security",
    text: "BlueDeck uses configured hosting, authentication, database, storage and email providers to operate the service. We apply access controls and reasonable technical and organizational safeguards, but no online service can promise absolute security. Users are responsible for protecting login credentials and reporting suspected account misuse.",
  },
  {
    title: "Communications",
    text: "BlueDeck may send account confirmation, password reset, application, employer verification, invitation, contract, security and operational notifications. Marketing communications, where offered, should include a way to unsubscribe.",
  },
  {
    title: "Your Choices",
    text: "Depending on applicable law, users may request access, correction, deletion, restriction, objection or portability of personal information. Users can also update profile data, withdraw an application where available and report a job, employer or message that appears unsafe.",
  },
  {
    title: "Contact",
    text: "For privacy, access, correction, account deletion or recruitment-data questions, contact info@bluedeck.app. Requests may require identity verification before private account information is disclosed or changed.",
  },
];

export default function PrivacyPage() {
  return (
    <PublicPageShell
      eyebrow="Privacy Policy"
      title="Privacy across yacht jobs, crew hiring and onboard operations."
      intro="BlueDeck limits the use of personal information to clearly defined account, recruitment, hiring, onboarding and yacht-operation purposes."
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
