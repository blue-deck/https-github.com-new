import { PublicHeader } from "../components/PublicSiteChrome";

export default function FindCrewLoading() {
  return (
    <div className="bd-site-shell min-h-screen text-[#071f3c]">
      <PublicHeader />

      <main id="main-content" aria-busy="true">
        <section className="border-b border-[#071f3c]/8 bg-white">
          <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
            <p className="bd-kicker">Professional crew network</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-[-0.035em] text-[#07182d] sm:text-6xl">
              Finding the right crew.
            </h1>
            <p
              className="mt-5 max-w-2xl text-base leading-7 text-[#52677f]"
              role="status"
              aria-live="polite"
            >
              Crew profiles are loading.
            </p>
          </div>
        </section>

        <section
          className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-12"
          aria-hidden="true"
        >
          <div className="h-14 max-w-3xl rounded-xl border border-slate-200 bg-white" />
          <div className="mt-8 grid gap-3 xl:grid-cols-2 xl:gap-4">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="min-h-64 rounded-2xl border border-slate-200 bg-white p-6"
              >
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-xl bg-slate-100" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 w-3/4 rounded-full bg-slate-100" />
                    <div className="h-3 w-1/2 rounded-full bg-slate-100" />
                  </div>
                </div>
                <div className="mt-7 space-y-3">
                  <div className="h-3 rounded-full bg-slate-100" />
                  <div className="h-3 w-5/6 rounded-full bg-slate-100" />
                  <div className="h-11 w-2/5 rounded-lg bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
