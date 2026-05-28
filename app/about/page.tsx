import { PublicPageShell } from "../components/PublicSiteChrome";

export default function AboutPage() {
  return (
    <PublicPageShell
      eyebrow="About BlueDeck"
      title="A private yacht platform shaped around elegance, hierarchy and trust."
      intro="BlueDeck exists to make yacht operations feel less scattered. It brings crew profiles, yacht records, documents, contracts, checklist systems and owner-facing readiness into one polished website."
    >
      <section id="vision" className="bd-section pt-4">
        <div className="grid gap-6 lg:grid-cols-3">
          <article className="bd-editorial-card lg:col-span-2">
            <p className="bd-kicker">Vision</p>
            <h2 className="bd-serif mt-4 text-4xl leading-tight text-[#071f3c]">
              To make every private yacht feel organized before anyone has to ask.
            </h2>
            <p className="mt-5 leading-8 text-[#5b7088]">
              A yacht runs on timing, people, documents and quiet confidence.
              BlueDeck’s vision is to keep those parts connected through a premium
              interface that does not feel noisy or amateur.
            </p>
          </article>
          <article className="bd-editorial-card">
            <p className="bd-kicker">Mission</p>
            <p className="mt-4 text-2xl leading-9 text-[#071f3c]">
              Give owners, captains and crew a secure place to manage the work
              behind a luxury yacht without losing the luxury feeling.
            </p>
          </article>
        </div>
      </section>
    </PublicPageShell>
  );
}
