import Link from "next/link";
import ClarivaLogo from "./components/ClarivaLogo";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
        <div className="absolute top-20 right-20 w-72 h-72 bg-pink-600/15 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center space-y-6 px-6">
        <ClarivaLogo size={64} />

        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
            Clariva
          </h1>
          <p className="text-white/30 text-sm max-w-sm mx-auto">
            Intelligent knowledge assistant powered by RAG + AI. Learns from
            your data, answers any question.
          </p>
        </div>

        <div className="flex gap-4 justify-center">
          <Link
            href="/chat"
            className="bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white px-6 py-3 rounded-xl font-medium text-sm transition shadow-lg shadow-violet-500/20"
          >
            Start Chatting
          </Link>
          <Link
            href="/admin"
            className="bg-white/5 hover:bg-white/8 border border-white/10 text-white/60 hover:text-white px-6 py-3 rounded-xl font-medium text-sm transition"
          >
            Admin Panel
          </Link>
        </div>

        <div className="flex items-center justify-center gap-6 pt-4">
          {[
            "RAG Architecture",
            "Vector Search",
            "Auto-Learning",
            "Analytics",
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-violet-400" />
              <span className="text-[11px] text-white/25">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
