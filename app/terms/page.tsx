import { PublicPageShell } from "../components/PublicSiteChrome";

const sections = [
  {
    title: "Account Use",
    text: "Users are responsible for keeping their login details secure and for entering accurate profile, crew, yacht and document information.",
  },
  {
    title: "Yacht and Crew Data",
    text: "BlueDeck organizes yacht operations, crew profiles, documents, contracts, checklist activity and related records. Active, email-confirmed crew profiles may appear in the public Find Crew directory, where profile and gallery photos plus selected professional and physical details can be visible. Full legal names, contact details, private documents and yacht workspaces remain protected or access-controlled.",
  },
  {
    title: "Operational Responsibility",
    text: "BlueDeck supports organization and record keeping. Captains, owners and crew remain responsible for legal, maritime, safety and operational decisions.",
  },
  {
    title: "Availability",
    text: "The service may be updated, improved or temporarily unavailable during maintenance, hosting changes or provider interruptions.",
  },
  {
    title: "Contact",
    text: "For account, legal or operational requests, contact info@bluedeck.app.",
  },
];

export default function TermsPage() {
  return (
    <PublicPageShell
      eyebrow="Terms"
      title="Clear terms for a private yacht management website."
      intro="These terms describe the basic expectations for using BlueDeck accounts and yacht workspaces."
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
