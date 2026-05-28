import { LockKeyhole, MailCheck, ShieldCheck, UserCheck } from "lucide-react";
import { PublicPageShell } from "../components/PublicSiteChrome";

const trustItems = [
  {
    icon: UserCheck,
    title: "Real Accounts",
    text: "Users create accounts with their own email, phone number, name, role and yacht position.",
  },
  {
    icon: LockKeyhole,
    title: "Secure Login",
    text: "Authentication, email confirmation and password reset are handled through the configured secure provider.",
  },
  {
    icon: ShieldCheck,
    title: "Role-Based Access",
    text: "Yacht operations are separated between owner, captain, management and crew responsibilities.",
  },
  {
    icon: MailCheck,
    title: "Brand Email Flow",
    text: "Account emails can be sent through the configured BlueDeck sender and authenticated domain.",
  },
];

export default function TrustPage() {
  return (
    <PublicPageShell
      eyebrow="Trust"
      title="Private yacht data deserves a calm, controlled structure."
      intro="BlueDeck is designed around account ownership, yacht membership, document visibility and traceable operational activity."
    >
      <section className="bd-section pt-4">
        <div className="grid gap-5 md:grid-cols-2">
          {trustItems.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="bd-editorial-card">
                <Icon className="h-7 w-7 text-cyan-700" />
                <h2 className="mt-7 text-2xl font-semibold text-[#071f3c]">{item.title}</h2>
                <p className="mt-4 leading-7 text-[#5b7088]">{item.text}</p>
              </article>
            );
          })}
        </div>
      </section>
    </PublicPageShell>
  );
}
