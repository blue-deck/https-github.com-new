import { PublicPageShell } from "../components/PublicSiteChrome";
import { termsOfUseVersion } from "../lib/legalPolicies";

const sections = [
  {
    title: "Agreement and eligibility",
    paragraphs: [
      "These terms apply when you create an account or use BlueDeck. You must be at least 18, have legal capacity to accept these terms, and use the service only for lawful professional yacht, crew or recruitment purposes.",
    ],
  },
  {
    title: "Accounts and security",
    paragraphs: [
      "Provide accurate information, keep your email and password secure, and use only your own account. Tell info@bluedeck.app promptly if you suspect unauthorized access. BlueDeck may require email confirmation, current-password verification, CAPTCHA or additional authentication before sensitive actions.",
    ],
  },
  {
    title: "Roles and authority",
    paragraphs: [
      "Owners, captains, managers, employers and crew receive different permissions. You may create a yacht workspace, invite a person, publish a job, review an application or issue a contract only when you have genuine authority to do so. Access must not be shared or used to view a yacht, person or document outside your responsibility.",
    ],
  },
  {
    title: "Profiles and public visibility",
    paragraphs: [
      "By creating or using an active Crew or Captain account, you authorize BlueDeck to list its masked, privacy-protected professional profile automatically in the public Find Crew directory after email confirmation. The public profile may include selected professional and physical fields, availability and approved images, and may link to a Crew ID CV or gallery containing CV-selected materials. Full legal names, direct contact details, private files and reference contact details remain protected as described in the Privacy Policy. You remain responsible for having the right to upload and publish every image and statement you submit.",
    ],
  },
  {
    title: "Jobs, applications and recruitment",
    paragraphs: [
      "BlueDeck provides tools for job publishing, discovery and applications but is not an employer, placement agent or party to hiring decisions unless expressly stated in a separate written agreement. Employers must publish accurate, lawful roles; applicants must provide truthful qualifications. Each party must perform its own identity, reference, certification, visa, medical and suitability checks.",
    ],
  },
  {
    title: "Yacht operations and safety",
    paragraphs: [
      "Checklists, alerts, document expiry tools, crew records and other Yacht-OS features support organization; they do not replace a captain's judgment, flag-state requirements, class rules, ISM procedures, medical advice, legal advice or mandatory safety systems. Authorized yacht personnel remain responsible for navigation, seaworthiness, safety, employment and regulatory compliance.",
    ],
  },
  {
    title: "Contracts and records",
    paragraphs: [
      "Contract Studio and document tools help parties prepare and retain records. BlueDeck does not guarantee that a template is complete, enforceable or suitable for a particular flag, jurisdiction or employment relationship. Each party must review the final document, confirm authority and obtain professional advice where needed.",
    ],
  },
  {
    title: "Acceptable use",
    paragraphs: [
      "Do not use BlueDeck to misrepresent identity or qualifications; discriminate unlawfully; harass or exploit another person; upload malware or unlawful content; scrape private or public profiles; bypass access controls or rate limits; test security without written permission; send spam; or interfere with the service, its providers or other users.",
    ],
  },
  {
    title: "Your content",
    paragraphs: [
      "You keep ownership of content you submit. You grant BlueDeck a limited, worldwide right to host, copy, transform and display that content only as needed to provide, secure and improve the service and to follow your account role and CV display selections. You confirm that your content is accurate, lawful and does not violate another person's privacy, confidentiality or intellectual-property rights.",
    ],
  },
  {
    title: "BlueDeck materials",
    paragraphs: [
      "The BlueDeck name, interface, software, visual system and service materials are protected. Except for ordinary use of the service, no right is granted to copy, reverse engineer, resell or create a confusingly similar service from them.",
    ],
  },
  {
    title: "Privacy and third-party services",
    paragraphs: [
      "The Privacy Policy explains BlueDeck's handling of personal information. The service relies on independent infrastructure, email, bot-protection and map providers; their availability and lawful terms also apply to their services. BlueDeck does not sell personal information or provide advertising profiles in the current service.",
    ],
  },
  {
    title: "Availability, changes and suspension",
    paragraphs: [
      "BlueDeck may maintain, secure, improve or discontinue a feature. We aim to give reasonable notice of material changes when practicable, but urgent security or legal changes may take effect immediately. Access may be limited or suspended to protect users, investigate abuse, comply with law or prevent unauthorized yacht access.",
    ],
  },
  {
    title: "No guarantee and responsibility limits",
    paragraphs: [
      "BlueDeck is provided with reasonable care, but listings, user content, availability and operational records cannot be guaranteed error-free. To the maximum extent permitted by applicable law, BlueDeck is not responsible for hiring decisions, vessel operations, user conduct, indirect loss or events outside its reasonable control. Nothing in these terms excludes responsibility that the law does not allow to be excluded.",
    ],
  },
  {
    title: "Ending use and contact",
    paragraphs: [
      "You may stop using BlueDeck and request account deletion. Authorized operational records may need to remain with a yacht workspace or be retained for security, disputes or legal obligations as described in the Privacy Policy.",
      "Questions, complaints and legal notices can be sent to info@bluedeck.app. Material revisions receive a new terms version and may require renewed acceptance.",
    ],
  },
];

export default function TermsPage() {
  return (
    <PublicPageShell
      eyebrow="Terms of Use"
      title="Practical terms for professional yacht work."
      intro="These terms set clear expectations for accounts, crew visibility, recruitment and private yacht operations in BlueDeck."
    >
      <section className="bd-section pt-4">
        <div className="mb-6 rounded-2xl border border-[#071f3c]/10 bg-white/75 px-5 py-4 text-sm font-semibold text-[#5b7088]">
          Effective version: {termsOfUseVersion}
        </div>
        <div className="grid gap-5">
          {sections.map((section) => (
            <article key={section.title} className="bd-editorial-card">
              <h2 className="text-2xl font-semibold text-[#071f3c]">{section.title}</h2>
              <div className="mt-3 space-y-3 leading-8 text-[#5b7088]">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </PublicPageShell>
  );
}
