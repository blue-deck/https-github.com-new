import Link from "next/link";
import { BlueDeckMark } from "../components/BlueDeckLogo";

export default function PrivacyPage() {
  return (
    <main className="bd-ocean-shell min-h-screen px-5 py-10 text-slate-900">
      <div className="bd-ocean-content bd-glass-card-strong mx-auto max-w-4xl rounded-[34px] p-6 sm:p-10">
        <Link href="/login" className="text-sm font-semibold text-cyan-700">
          Back to login
        </Link>

        <div className="mt-8 flex items-center gap-3">
          <BlueDeckMark className="h-14 w-20 shrink-0 rounded-none border-0 bg-transparent shadow-none" imageClassName="object-contain p-0" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">BlueDeck</p>
            <h1 className="bd-serif text-4xl font-normal text-[#071f3c]">Privacy Policy</h1>
          </div>
        </div>

        <div className="mt-8 space-y-6 text-sm leading-7 text-slate-700">
          <p>
            BlueDeck stores account, profile, document, crew, yacht, checklist,
            portfolio and contract information so users can manage yacht
            operations and professional crew records.
          </p>

          <section>
            <h2 className="text-lg font-semibold text-slate-950">Information We Collect</h2>
            <p className="mt-2">
              We may collect your name, email address, phone number, role,
              nationality, location, profile details, maritime documents,
              expiry dates, yacht experience, portfolio images, references and
              operational checklist activity.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-950">How We Use Information</h2>
            <p className="mt-2">
              We use this information to create user accounts, provide private
              dashboards, build CVs, manage yacht crew invitations, support
              checklist workflows and show document expiry alerts.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-950">Security</h2>
            <p className="mt-2">
              Authentication and database access are handled through Supabase.
              User data is protected by account-based access controls and
              row-level security policies where configured.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-950">Account Emails and SMS</h2>
            <p className="mt-2">
              Account confirmation and password reset emails are sent through
              the configured authentication provider. SMS verification requires
              an enabled SMS provider in the authentication settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-950">Contact</h2>
            <p className="mt-2">
              For privacy or account requests, contact the BlueDeck site owner.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
