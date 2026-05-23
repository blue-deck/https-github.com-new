import { Ship } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#020817] p-6 text-white">
      <div className="max-w-lg rounded-[40px] border border-white/10 bg-white/5 p-10 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-cyan-400 text-black">
          <Ship className="h-11 w-11" />
        </div>

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