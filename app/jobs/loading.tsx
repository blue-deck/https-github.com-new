export default function JobsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading yacht jobs">
      <section className="bg-[#06172b]">
        <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-8 lg:px-12 lg:py-24">
          <div className="h-8 w-56 animate-pulse rounded-full bg-white/10" />
          <div className="mt-7 h-16 max-w-3xl animate-pulse rounded-2xl bg-white/10" />
          <div className="mt-4 h-6 max-w-2xl animate-pulse rounded-xl bg-white/8" />
        </div>
      </section>
      <section className="mx-auto grid max-w-[1500px] gap-7 px-5 py-12 sm:px-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:px-12">
        <div className="h-[34rem] animate-pulse rounded-3xl border border-[#071f3c]/8 bg-white" />
        <div className="grid gap-5 xl:grid-cols-2">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-80 animate-pulse rounded-3xl border border-[#071f3c]/8 bg-white"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
