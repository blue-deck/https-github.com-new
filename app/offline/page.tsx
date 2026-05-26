import { BlueDeckMark } from "../components/BlueDeckLogo";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#020817] p-6 text-white">
      <div className="max-w-lg rounded-[40px] border border-white/10 bg-white/5 p-10 text-center">
        <BlueDeckMark className="mx-auto h-20 w-28 rounded-3xl border-cyan-300/25 shadow-black/25" imageClassName="p-1" />

        <h1 className="mt-8 text-5xl font-black">
          BlueDeck Offline
        </h1>

        <p className="mt-5 text-lg text-gray-400">
          Connection is unavailable. Your yacht system shell is still accessible.
        </p>
      </div>
    </main>
  );
}
