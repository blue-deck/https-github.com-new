import Link from "next/link";
import type { ReactNode } from "react";
import {
  Anchor,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CircleUserRound,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  Gauge,
  Globe2,
  MapPin,
  Network,
  Radar,
  Search,
  ShieldCheck,
  Ship,
  Sparkles,
  UserRound,
  Users,
  Waves,
  Wrench,
} from "lucide-react";
import { BlueDeckLogoLink } from "../components/BlueDeckLogo";
import type { HomepageConcept } from "./concepts";
import { homepageConcepts } from "./concepts";
import styles from "./homepage-concepts.module.css";

const demoStats = [
  { value: "48", label: "active roles", note: "demo" },
  { value: "1,284", label: "crew members", note: "demo" },
  { value: "936", label: "crew profiles", note: "demo" },
  { value: "32", label: "managed yachts", note: "demo" },
];

const jobCards = [
  {
    role: "Chief Stewardess",
    yacht: "62m Private MY",
    location: "Antibes, FR",
    start: "08 Aug",
    type: "Permanent",
    salary: "€7,000 / mo",
    tone: "cyan",
  },
  {
    role: "Second Engineer",
    yacht: "74m Charter MY",
    location: "Palma, ES",
    start: "Immediate",
    type: "Rotation 2:2",
    salary: "€6,500 / mo",
    tone: "blue",
  },
  {
    role: "Deckhand",
    yacht: "48m Private SY",
    location: "Bodrum, TR",
    start: "15 Aug",
    type: "Seasonal",
    salary: "DOE",
    tone: "mint",
  },
];

const productPaths = [
  {
    id: "jobs",
    icon: BriefcaseBusiness,
    index: "01",
    label: "Jobs & recruitment",
    title: "Find a role. Find your crew.",
    text: "Search live yacht roles, shortlist trusted professionals and publish a new opening from one focused marketplace.",
    action: "Explore active roles",
    href: "#open-roles",
  },
  {
    id: "crew-network",
    icon: CircleUserRound,
    index: "02",
    label: "Professional identity",
    title: "A profile built for life aboard.",
    text: "Bring sea time, certificates, references, availability and your public CV into one professional crew identity.",
    action: "Create a crew profile",
    href: "/signup",
  },
  {
    id: "yacht-os",
    icon: Ship,
    index: "03",
    label: "Private yacht operations",
    title: "Run the yacht behind every role.",
    text: "Coordinate crew, documents, tasks, checklists, contracts and daily readiness through BlueDeck Yacht-OS.",
    action: "Discover Yacht-OS",
    href: "/yacht-os",
  },
];

export function ConceptPrototype({ concept }: { concept: HomepageConcept }) {
  const conceptIndex = homepageConcepts.findIndex((item) => item.id === concept.id);
  const previous = homepageConcepts[(conceptIndex - 1 + homepageConcepts.length) % homepageConcepts.length];
  const next = homepageConcepts[(conceptIndex + 1) % homepageConcepts.length];

  return (
    <main className={styles.prototype} data-concept={concept.id}>
      <div className={styles.reviewBar}>
        <Link href="/homepage-concepts" className={styles.reviewBack}>
          <ArrowLeft aria-hidden="true" />
          <span>18 layout galerisi</span>
        </Link>
        <div className={styles.reviewIdentity}>
          <span>{concept.number} / 18</span>
          <strong>{concept.name}</strong>
          <span className={styles.demoFlag}>Prototype · demo data</span>
        </div>
        <nav className={styles.reviewNav} aria-label="Konseptler arasında gezin">
          <Link href={`/homepage-concepts/${previous.id}`} aria-label={`Önceki konsept: ${previous.name}`}>
            <ChevronLeft aria-hidden="true" />
          </Link>
          <Link href={`/homepage-concepts/${next.id}`} aria-label={`Sonraki konsept: ${next.name}`}>
            <ChevronRight aria-hidden="true" />
          </Link>
        </nav>
      </div>

      <header className={styles.siteHeader}>
        <BlueDeckLogoLink href="/" className={styles.siteBrand} imageClassName={styles.siteBrandImage} />
        <nav className={styles.siteNav} aria-label="Homepage concept navigation">
          <a href="#open-roles">Jobs</a>
          <a href="#crew-network">Crew</a>
          <a href="#yacht-os">Yacht-OS</a>
          <a href="#why-bluedeck">Why BlueDeck</a>
        </nav>
        <div className={styles.siteActions}>
          <Link href="/login" className={styles.loginLink}>Log in</Link>
          <Link href="/signup" className={styles.headerCta}>Join BlueDeck</Link>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroFrame}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              <span className={styles.liveDot} />
              {concept.eyebrow}
            </p>
            <h1>
              <span>{concept.headline}</span>
              <em>{concept.highlightedHeadline}</em>
            </h1>
            <p className={styles.heroIntro}>{concept.intro}</p>

            <div className={styles.intentStrip} aria-label="BlueDeck platform capabilities">
              <a href="#open-roles">
                <BriefcaseBusiness aria-hidden="true" />
                <span><strong>Jobs</strong>Find or post roles</span>
              </a>
              <a href="#crew-network">
                <CircleUserRound aria-hidden="true" />
                <span><strong>Crew profile</strong>Build your maritime CV</span>
              </a>
              <a href="#yacht-os">
                <Ship aria-hidden="true" />
                <span><strong>Yacht-OS</strong>Manage your yacht</span>
              </a>
            </div>

            <div className={styles.heroActions}>
              <a href="#open-roles" className={styles.primaryCta}>
                Browse 48 demo roles
                <ArrowRight aria-hidden="true" />
              </a>
              <Link href="/signup" className={styles.secondaryCta}>
                Create crew profile
              </Link>
            </div>
            <p className={styles.microProof}>
              <BadgeCheck aria-hidden="true" />
              Built for crew, captains, managers and owners.
            </p>
          </div>

          <div className={styles.heroVisual} aria-label={`${concept.name} product preview`}>
            <ConceptVisual conceptId={concept.id} />
          </div>
        </div>
      </section>

      <section className={styles.statsRail} aria-label="Temsili platform istatistikleri">
        <div className={styles.statsIntro}>
          <span>BlueDeck network</span>
          <strong>One community, from profile to port.</strong>
        </div>
        {demoStats.map((stat) => (
          <div key={stat.label} className={styles.statItem}>
            <span className={styles.statValue}>{stat.value}<sup>{stat.note}</sup></span>
            <span className={styles.statLabel}>{stat.label}</span>
          </div>
        ))}
        <p className={styles.demoNote}>Layout placeholders. Production values must come from live platform data.</p>
      </section>

      <ConceptSections conceptId={concept.id} />

      <section className={styles.closingCta}>
        <div>
          <p className={styles.sectionKicker}>Your place on deck</p>
          <h2>Find the people. Find the role. Run the yacht.</h2>
        </div>
        <div>
          <Link href="/signup" className={styles.primaryCta}>Join BlueDeck <ArrowRight aria-hidden="true" /></Link>
          <p>No demo metric will be published without a live data source.</p>
        </div>
      </section>

      <footer className={styles.conceptFooter}>
        <BlueDeckLogoLink href="/" className={styles.footerBrand} imageClassName={styles.siteBrandImage} />
        <p>Yacht jobs, professional crew profiles and private yacht operations.</p>
        <Link href="/homepage-concepts">View all 18 homepage layouts</Link>
      </footer>
    </main>
  );
}

const productFirstConcepts = new Set([
  "three-decks",
  "crew-passport",
  "watch-rotation",
  "voyage-path",
  "crew-mosaic",
  "tidal-bento",
  "dual-helm",
]);

function ConceptSections({ conceptId }: { conceptId: string }) {
  if (productFirstConcepts.has(conceptId)) {
    return <><ProductSection /><JobsSection /><YachtSection /></>;
  }

  if (conceptId === "fleet-ledger") {
    return <><YachtSection /><JobsSection /><ProductSection /></>;
  }

  if (conceptId === "deck-plan" || conceptId === "bridge-console") {
    return <><YachtSection /><ProductSection /><JobsSection /></>;
  }

  return <><JobsSection /><ProductSection /><YachtSection /></>;
}

function JobsSection() {
  return (
    <section id="open-roles" className={styles.jobsSection}>
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.sectionKicker}>Open roles · demo listings</p>
          <h2>Opportunity is already on deck.</h2>
        </div>
        <div className={styles.jobSearch}>
          <Search aria-hidden="true" />
          <span>Role, location or yacht type</span>
          <span className={styles.jobSearchAction}>Search layout · demo</span>
        </div>
      </div>

      <div className={styles.jobGrid}>
        {jobCards.map((job, index) => (
          <article key={job.role} className={styles.jobCard} data-tone={job.tone}>
            <div className={styles.jobCardTop}>
              <span className={styles.jobType}>{job.type}</span>
              <span className={styles.jobNumber}>0{index + 1}</span>
            </div>
            <h3>{job.role}</h3>
            <p className={styles.jobYacht}><Ship aria-hidden="true" />{job.yacht}</p>
            <div className={styles.jobMeta}>
              <span><MapPin aria-hidden="true" />{job.location}</span>
              <span><CalendarDays aria-hidden="true" />{job.start}</span>
              <span><CircleDollarSign aria-hidden="true" />{job.salary}</span>
            </div>
            <a href="#crew-network">View role <ArrowRight aria-hidden="true" /></a>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProductSection() {
  return (
    <section id="why-bluedeck" className={styles.productSection}>
      <div className={styles.productIntro}>
        <p className={styles.sectionKicker}>Not only a job board</p>
        <h2>The complete working life of a yacht, connected.</h2>
        <p>
          A role is only the beginning. BlueDeck keeps the professional identity,
          recruitment decision and the yacht&apos;s daily operation in one continuous system.
        </p>
      </div>
      <div className={styles.productPaths}>
        {productPaths.map((path) => {
          const Icon = path.icon;
          return (
            <article key={path.id} id={path.id} className={styles.pathCard}>
              <div className={styles.pathCardTop}>
                <span className={styles.pathIcon}><Icon aria-hidden="true" /></span>
                <span className={styles.pathIndex}>{path.index}</span>
              </div>
              <p className={styles.pathLabel}>{path.label}</p>
              <h3>{path.title}</h3>
              <p>{path.text}</p>
              <Link href={path.href}>{path.action}<ArrowRight aria-hidden="true" /></Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function YachtSection() {
  return (
    <section className={styles.yachtBand}>
      <div className={styles.yachtBandCopy}>
        <p className={styles.sectionKicker}>BlueDeck Yacht-OS</p>
        <h2>When the crew joins, the platform keeps working.</h2>
        <p>
          Bring people, documents, tasks, checklists, contracts and readiness
          into a private workspace shaped around the yacht.
        </p>
        <Link href="/yacht-os">See Yacht-OS <ArrowRight aria-hidden="true" /></Link>
      </div>
      <YachtReadinessPanel />
    </section>
  );
}

function VisualShell({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.visualShell}>
      <div className={styles.visualTopbar}>
        <span><i /><i /><i /></span>
        <strong>{label}</strong>
        <span aria-hidden="true" />
      </div>
      {children}
    </div>
  );
}

function ConceptVisual({ conceptId }: { conceptId: string }) {
  if (conceptId === "harbor-command") {
    return (
      <VisualShell label="Harbor command">
        <div className={styles.commandGrid}>
          <div className={styles.commandLead}>
            <span className={styles.panelLabel}>Crew market</span>
            <strong>48 <small>open roles</small></strong>
            <div className={styles.sparkBars}><i /><i /><i /><i /><i /><i /><i /></div>
            <p><span className={styles.liveDot} /> 7 new today</p>
          </div>
          <MiniProfile />
          <MiniReadiness />
          <div className={styles.commandAlert}>
            <Bell aria-hidden="true" />
            <span><strong>New match</strong>Chief Stewardess · 94%</span>
            <ArrowRight aria-hidden="true" />
          </div>
        </div>
      </VisualShell>
    );
  }

  if (conceptId === "three-decks") {
    return (
      <div className={styles.threeDeckVisual}>
        <div><span>01 · Jobs</span><BriefcaseBusiness aria-hidden="true" /><strong>48 roles</strong><small>Search · shortlist · post</small></div>
        <div><span>02 · Profile</span><CircleUserRound aria-hidden="true" /><strong>82% ready</strong><small>CV · sea time · certificates</small></div>
        <div><span>03 · Yacht-OS</span><Ship aria-hidden="true" /><strong>94% ready</strong><small>Crew · tasks · documents</small></div>
      </div>
    );
  }

  if (conceptId === "position-radar") {
    return (
      <VisualShell label="Opportunity radar">
        <div className={styles.radarField}>
          <span className={styles.radarSweep} />
          <span className={`${styles.radarPing} ${styles.pingOne}`}><i />Chief Stew</span>
          <span className={`${styles.radarPing} ${styles.pingTwo}`}><i />Engineer</span>
          <span className={`${styles.radarPing} ${styles.pingThree}`}><i />Deckhand</span>
          <span className={styles.radarCenter}><Radar aria-hidden="true" /><strong>48</strong><small>roles live</small></span>
          <div className={styles.radarLegend}>
            <span><i />Jobs</span><span><i />Crew</span><span><i />Yachts</span>
          </div>
        </div>
      </VisualShell>
    );
  }

  if (conceptId === "crew-passport") {
    return (
      <div className={styles.passportStage}>
        <div className={styles.passportGlow} />
        <article className={styles.passportCard}>
          <div className={styles.passportHead}>
            <div className={styles.avatar}>AM</div>
            <span><BadgeCheck aria-hidden="true" /> BlueDeck verified</span>
          </div>
          <h3>Alex Morgan</h3>
          <p>Chief Stewardess · 8 years</p>
          <div className={styles.profileTags}><span>ENG1</span><span>STCW</span><span>Schengen</span></div>
          <div className={styles.profileMeter}><span><i /></span><small>Profile readiness · 92%</small></div>
          <div className={styles.profileFoot}><span><span className={styles.liveDot} /> Available now</span><ArrowRight aria-hidden="true" /></div>
        </article>
        <div className={styles.matchCard}><Sparkles aria-hidden="true" /><span><strong>6 role matches</strong>Updated 4m ago</span></div>
      </div>
    );
  }

  if (conceptId === "fleet-ledger") {
    return (
      <VisualShell label="Fleet ledger">
        <div className={styles.ledgerHead}><span>Workspace</span><strong>MY Asteria · 62m</strong><span className={styles.statusPill}>Operational</span></div>
        <div className={styles.ledgerRows}>
          <LedgerRow icon={<Users />} label="Crew complement" value="14 / 16" action="2 roles open" />
          <LedgerRow icon={<ClipboardCheck />} label="Readiness" value="94%" action="3 actions" />
          <LedgerRow icon={<FileCheck2 />} label="Documents" value="128" action="2 expiring" />
          <LedgerRow icon={<Wrench />} label="Maintenance" value="21" action="5 this week" />
        </div>
      </VisualShell>
    );
  }

  if (conceptId === "dockside-exchange") {
    return (
      <VisualShell label="Dockside exchange">
        <div className={styles.exchangeTicker}>
          <span><i />48 roles open</span><span>936 verified profiles</span><span>7 new today</span>
        </div>
        <div className={styles.exchangeBoard}>
          <div className={styles.exchangeHeader}><span>ROLE</span><span>PORT</span><span>START</span><span>STATUS</span></div>
          <ExchangeRow role="Chief Stew" port="Antibes" start="08 Aug" status="NEW" />
          <ExchangeRow role="2nd Engineer" port="Palma" start="Now" status="HOT" />
          <ExchangeRow role="Deckhand" port="Bodrum" start="15 Aug" status="LIVE" />
        </div>
        <div className={styles.exchangeFoot}><ShieldCheck aria-hidden="true" /> Profile-backed applications, connected to Yacht-OS.</div>
      </VisualShell>
    );
  }

  if (conceptId === "captains-briefing") {
    return (
      <div className={styles.briefingVisual}>
        <div className={styles.briefingMast}>BLUEDECK BRIEFING <span>22 · 07 · 26</span></div>
        <h3>THE PEOPLE<br />BEHIND THE VOYAGE</h3>
        <div className={styles.briefingColumns}>
          <div><strong>48</strong><span>positions on today&apos;s watchlist</span></div>
          <div><strong>936</strong><span>professional crew profiles</span></div>
          <div><strong>32</strong><span>private yacht workspaces</span></div>
        </div>
        <p>Recruitment, identity and operations — reported from one deck.</p>
      </div>
    );
  }

  if (conceptId === "blue-horizon") {
    return (
      <div className={styles.horizonVisual}>
        <div className={styles.horizonSky}>
          <span className={styles.horizonRole}><BriefcaseBusiness aria-hidden="true" /><strong>48 active roles</strong>Across 12 ports</span>
          <span className={styles.horizonProfile}><CircleUserRound aria-hidden="true" /><strong>Your crew profile</strong>Ready to be discovered</span>
        </div>
        <div className={styles.horizonSea}>
          <span><Ship aria-hidden="true" /><strong>Yacht-OS</strong>People and operations in sync</span>
        </div>
      </div>
    );
  }

  if (conceptId === "watch-rotation") {
    return (
      <div className={styles.watchVisual}>
        <div className={styles.watchDial}>
          <span className={styles.watchHand} />
          <span className={styles.watchCenter}><Clock3 aria-hidden="true" /><strong>24 / 7</strong><small>BlueDeck live</small></span>
          <span className={`${styles.watchEvent} ${styles.watchEventOne}`}><BriefcaseBusiness />New role</span>
          <span className={`${styles.watchEvent} ${styles.watchEventTwo}`}><UserRound />Profile match</span>
          <span className={`${styles.watchEvent} ${styles.watchEventThree}`}><Ship />Yacht ready</span>
        </div>
      </div>
    );
  }

  if (conceptId === "the-manifest") {
    return (
      <div className={styles.manifestVisual}>
        <div className={styles.manifestTitle}><span>BD / MANIFEST</span><strong>LIVE 0184</strong></div>
        <ManifestRow number="001" title="OPEN POSITIONS" value="48" />
        <ManifestRow number="002" title="CREW IDENTITIES" value="936" />
        <ManifestRow number="003" title="YACHT WORKSPACES" value="32" />
        <div className={styles.manifestStamp}>ALL SYSTEMS<br />ONE DECK</div>
      </div>
    );
  }

  if (conceptId === "signal-stack") {
    return (
      <div className={styles.signalStage}>
        <div className={`${styles.signalCard} ${styles.signalBack}`}><Ship /><span>03 / OPERATE</span><strong>Yacht-OS readiness</strong><small>94% in command</small></div>
        <div className={`${styles.signalCard} ${styles.signalMiddle}`}><CircleUserRound /><span>02 / PRESENT</span><strong>Professional profile</strong><small>Verified and searchable</small></div>
        <div className={`${styles.signalCard} ${styles.signalFront}`}><BriefcaseBusiness /><span>01 / DISCOVER</span><strong>48 active roles</strong><small>7 added today</small></div>
      </div>
    );
  }

  if (conceptId === "deck-plan") {
    return (
      <div className={styles.deckPlanVisual}>
        <div className={styles.planCoordinates}><span>BD—62M</span><span>TOP DECK / PLATFORM PLAN</span></div>
        <div className={styles.planHull}>
          <div className={styles.planZone}><BriefcaseBusiness /><span>DECK 01</span><strong>Jobs</strong><small>48 open</small></div>
          <div className={styles.planZone}><CircleUserRound /><span>DECK 02</span><strong>Crew profile</strong><small>936 ready</small></div>
          <div className={styles.planZone}><Ship /><span>BRIDGE</span><strong>Yacht-OS</strong><small>32 managed</small></div>
        </div>
        <div className={styles.planScale}>0 — 10 — 20 — 30 — 40 — 50 — 62m</div>
      </div>
    );
  }

  if (conceptId === "voyage-path") {
    return (
      <div className={styles.voyageVisual}>
        <div className={styles.voyageLine} />
        <VoyageStop icon={<CircleUserRound />} step="01" title="Build profile" detail="Identity ready" />
        <VoyageStop icon={<Search />} step="02" title="Find a role" detail="48 live roles" />
        <VoyageStop icon={<BadgeCheck />} step="03" title="Join the crew" detail="Match confirmed" />
        <VoyageStop icon={<Ship />} step="04" title="Run the yacht" detail="Yacht-OS live" />
      </div>
    );
  }

  if (conceptId === "port-atlas") {
    return (
      <VisualShell label="Port atlas">
        <div className={styles.atlasMap}>
          <div className={styles.atlasGrid} />
          <AtlasPin className={styles.pinAntibes} city="ANTIBES" count="14 roles" />
          <AtlasPin className={styles.pinPalma} city="PALMA" count="11 roles" />
          <AtlasPin className={styles.pinBodrum} city="BODRUM" count="7 roles" />
          <AtlasPin className={styles.pinAthens} city="ATHENS" count="5 roles" />
          <span className={styles.atlasRoute} />
          <div className={styles.atlasSummary}><Globe2 /><span><strong>12 ports</strong>48 roles · 936 crew</span></div>
        </div>
      </VisualShell>
    );
  }

  if (conceptId === "bridge-console") {
    return (
      <VisualShell label="Bridge console">
        <div className={styles.consoleGrid}>
          <div className={styles.consoleMetric}><span>OPPORTUNITY</span><strong>48</strong><small>active roles</small><div className={styles.consoleWave} /></div>
          <div className={styles.consoleMetric}><span>NETWORK</span><strong>936</strong><small>crew profiles</small><div className={styles.consoleDots}><i /><i /><i /><i /><i /></div></div>
          <div className={styles.consoleMetric}><span>READINESS</span><strong>94%</strong><small>MY Asteria</small><Gauge /></div>
          <div className={styles.consoleTimeline}><span><i />06:20</span><p>Profile match confirmed</p><span><i />08:45</span><p>Checklist completed</p></div>
        </div>
      </VisualShell>
    );
  }

  if (conceptId === "crew-mosaic") {
    const profiles = [
      ["AM", "Chief Stew", "Available"],
      ["JL", "Captain", "On rotation"],
      ["SK", "Engineer", "Available"],
      ["NR", "Chef", "Open to work"],
      ["EC", "Deckhand", "Available"],
      ["MO", "Purser", "On board"],
    ];
    return (
      <div className={styles.mosaicVisual}>
        {profiles.map(([initials, role, status], index) => (
          <div key={initials} className={styles.mosaicProfile} data-index={index}>
            <span>{initials}</span><strong>{role}</strong><small><i />{status}</small>
          </div>
        ))}
        <div className={styles.mosaicCenter}><Network /><strong>1,284</strong><span>people on deck</span></div>
      </div>
    );
  }

  if (conceptId === "tidal-bento") {
    return (
      <div className={styles.bentoVisual}>
        <div className={`${styles.bentoTile} ${styles.bentoJobs}`}><BriefcaseBusiness /><span>JOBS</span><strong>48 roles</strong><small>Find · post · match</small></div>
        <div className={`${styles.bentoTile} ${styles.bentoProfile}`}><CircleUserRound /><span>PROFILE</span><strong>92%</strong><small>Ready to be seen</small></div>
        <div className={`${styles.bentoTile} ${styles.bentoYacht}`}><Ship /><span>YACHT-OS</span><strong>MY Asteria</strong><small>94% readiness</small></div>
        <div className={`${styles.bentoTile} ${styles.bentoCommunity}`}><Users /><strong>1.2K+</strong><small>people on deck</small></div>
        <div className={`${styles.bentoTile} ${styles.bentoSignal}`}><Waves /><small>One connected tide</small></div>
      </div>
    );
  }

  return (
    <div className={styles.dualHelmVisual}>
      <div className={styles.dualCrew}>
        <span className={styles.dualIndex}>FOR CREW</span>
        <CircleUserRound aria-hidden="true" />
        <h3>Advance your career.</h3>
        <p>48 roles · profile · public CV</p>
        <strong>Find my next role <ArrowRight /></strong>
      </div>
      <div className={styles.dualBridge}><Anchor /><span>ONE<br />BLUEDECK</span></div>
      <div className={styles.dualYacht}>
        <span className={styles.dualIndex}>FOR YACHTS</span>
        <Ship aria-hidden="true" />
        <h3>Advance your yacht.</h3>
        <p>Recruitment · crew · Yacht-OS</p>
        <strong>Manage my yacht <ArrowRight /></strong>
      </div>
    </div>
  );
}

function MiniProfile() {
  return (
    <div className={styles.miniProfile}>
      <span className={styles.panelLabel}>Crew profile</span>
      <div><span className={styles.miniAvatar}>AM</span><p><strong>Alex Morgan</strong><small>Chief Stewardess</small></p><BadgeCheck /></div>
      <span className={styles.miniProgress}><i /></span>
      <small>92% profile ready</small>
    </div>
  );
}

function MiniReadiness() {
  return (
    <div className={styles.miniReadiness}>
      <span className={styles.panelLabel}>Yacht-OS</span>
      <div className={styles.readinessRing}><span><strong>94</strong><small>%</small></span></div>
      <p><strong>MY Asteria</strong><small>Operational readiness</small></p>
    </div>
  );
}

function LedgerRow({ icon, label, value, action }: { icon: ReactNode; label: string; value: string; action: string }) {
  return <div className={styles.ledgerRow}><span>{icon}</span><p><strong>{label}</strong><small>{action}</small></p><b>{value}</b><ArrowRight /></div>;
}

function ExchangeRow({ role, port, start, status }: { role: string; port: string; start: string; status: string }) {
  return <div className={styles.exchangeRow}><strong>{role}</strong><span>{port}</span><span>{start}</span><b>{status}</b></div>;
}

function ManifestRow({ number, title, value }: { number: string; title: string; value: string }) {
  return <div className={styles.manifestRow}><span>{number}</span><strong>{title}</strong><b>{value}</b><ArrowRight /></div>;
}

function VoyageStop({ icon, step, title, detail }: { icon: ReactNode; step: string; title: string; detail: string }) {
  return <div className={styles.voyageStop}><span className={styles.voyageIcon}>{icon}</span><small>{step}</small><strong>{title}</strong><p>{detail}</p></div>;
}

function AtlasPin({ className, city, count }: { className: string; city: string; count: string }) {
  return <span className={`${styles.atlasPin} ${className}`}><i /><strong>{city}</strong><small>{count}</small></span>;
}

function YachtReadinessPanel() {
  const items = [
    ["Crew & certificates", "14 / 16", "88%"],
    ["Tasks & checklists", "42 / 45", "93%"],
    ["Documents", "126 / 128", "98%"],
  ];

  return (
    <div className={styles.readinessPanel}>
      <div className={styles.readinessHead}>
        <span><Ship aria-hidden="true" /></span>
        <p><small>Private workspace</small><strong>MY Asteria · 62m</strong></p>
        <b><i /> Operational</b>
      </div>
      <div className={styles.readinessScore}>
        <div><strong>94</strong><span>% readiness</span></div>
        <p>People and operations aligned for the next departure.</p>
      </div>
      <div className={styles.readinessItems}>
        {items.map(([label, value, width]) => (
          <div key={label}>
            <p><span>{label}</span><strong>{value}</strong></p>
            <span><i style={{ width }} /></span>
          </div>
        ))}
      </div>
      <div className={styles.readinessFoot}>
        <span><Check aria-hidden="true" />7 items completed today</span>
        <span>Open command <ArrowRight aria-hidden="true" /></span>
      </div>
    </div>
  );
}
