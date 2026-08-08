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
          <div className="mt-8 grid gap-5">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="grid min-h-[250px] overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white lg:min-h-[190px] lg:grid-cols-[minmax(17rem,1fr)_minmax(24rem,1.55fr)_minmax(14rem,0.75fr)]"
              >
                <div className="flex items-center gap-4 px-5 py-6 sm:px-7 lg:border-r lg:border-slate-100 lg:py-7 xl:px-8">
                  <div className="h-20 w-20 shrink-0 rounded-2xl bg-slate-100 sm:h-24 sm:w-24 lg:h-20 lg:w-20 xl:h-24 xl:w-24" />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="h-6 w-3/4 rounded bg-slate-100" />
                    <div className="h-4 w-1/2 rounded bg-slate-100" />
                    <div className="h-5 w-2/3 rounded-full bg-slate-100" />
                  </div>
                </div>
                <div className="grid grid-cols-2 content-center gap-x-7 gap-y-5 border-t border-slate-100 px-5 py-6 sm:px-7 lg:border-t-0 lg:px-8 lg:py-7 xl:gap-x-10 xl:px-10">
                  {[0, 1, 2, 3].map((fact) => (
                    <div key={fact} className="space-y-2">
                      <div className="h-3 w-2/3 rounded bg-slate-100" />
                      <div className="h-4 w-5/6 rounded bg-slate-100" />
                    </div>
                  ))}
                </div>
                <div className="flex items-center border-t border-slate-100 px-5 py-6 sm:px-7 lg:border-l lg:border-t-0 lg:px-6 lg:py-7 xl:px-7">
                  <div className="h-14 w-full rounded-xl bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
