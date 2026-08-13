import { PublicHeader } from "../components/PublicSiteChrome";

export default function FindCrewLoading() {
  return (
    <div className="bd-site-shell min-h-screen text-[#071f3c]">
      <PublicHeader />

      <main id="main-content" aria-busy="true">
        <section
          className="mx-auto w-full max-w-7xl px-5 pb-12 pt-7 sm:px-8 sm:pt-8 lg:px-10 lg:pb-14 lg:pt-10"
        >
          <h1 id="crew-filter-heading" className="sr-only">
            Search and filters
          </h1>
          <p className="sr-only" role="status" aria-live="polite">
            Crew profiles are loading.
          </p>
          <div
            aria-hidden="true"
            className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,45,72,0.07)] sm:p-6"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="h-5 w-36 rounded bg-slate-100" />
                <div className="h-4 w-72 max-w-full rounded bg-slate-100" />
              </div>
              <div className="h-11 w-32 rounded-xl border border-slate-200 bg-slate-50" />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.35fr)_repeat(3,minmax(0,0.9fr))_auto]">
              {[0, 1, 2, 3].map((item) => (
                <div key={item}>
                  <div className="mb-1.5 h-3 w-20 rounded bg-slate-100" />
                  <div className="h-12 rounded-xl border border-slate-200 bg-slate-50" />
                </div>
              ))}
              <div className="h-12 rounded-xl bg-[#071f3c] md:col-span-2 xl:col-span-1 xl:w-32" />
            </div>
          </div>
          <div aria-hidden="true" className="mt-8">
            <div className="h-3 w-28 rounded bg-slate-100" />
            <div className="mt-2 h-8 w-52 rounded bg-slate-100" />
          </div>
          <div className="mt-8 grid gap-5">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                aria-hidden="true"
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
