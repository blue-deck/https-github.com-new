import { BlueDeckMark } from "../components/BlueDeckLogo";

export default function OfflinePage() {
  return (
    <main className="bd-ocean-shell flex min-h-screen items-center justify-center p-6 text-slate-900">
      <div className="bd-ocean-content bd-glass-card-strong max-w-lg rounded-[40px] p-10 text-center">
        <BlueDeckMark className="mx-auto h-20 w-28 rounded-none border-0 bg-transparent shadow-none" imageClassName="object-contain p-0" />

        <h1 className="bd-serif mt-8 text-5xl font-normal text-[#071f3c]">
          BlueDeck Offline
        </h1>

        <p className="mt-5 text-lg text-slate-600">
          Connection is unavailable. Your yacht system shell is still accessible.
        </p>
      </div>
    </main>
  );
}
