import Link from "next/link";
import { ArrowLeft, ChevronRight, Mic, Music } from "lucide-react";
import { VOICE_PROFILES } from "./_components/voiceProfiles";

// /dashboard/audio — the Audio Studio gateway. Two bold doors, mirroring the
// dashboard portal: the Optiq Voice Engine (narration) and Optiq Music (score).
export const metadata = {
  title: "Audio Studio — Optiq Studio",
};

// A few faces fanned across the Voice Engine card.
const FACE_STACK = ["awa-wolof", "marcus-american", "eleanor-british", "wei-chinese", "chioma-igbo"];

export default function AudioStudioPortal() {
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background text-foreground">
      <div className="px-4 pt-20 sm:px-6 sm:pt-24 md:px-12">
        <Link
          href="/dashboard"
          className="group flex w-fit items-center gap-1.5 tabular-nums text-[11px] font-bold uppercase tracking-wider text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft size={12} className="transition-transform group-hover:-translate-x-0.5" />
          Dashboard
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-8 pt-6 sm:p-6 md:p-12">
        <div className="grid w-full max-w-4xl grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 md:gap-8">
          {/* OPTIQ VOICE ENGINE */}
          <Link
            href="/dashboard/audio/voice"
            className="group relative flex min-h-[260px] flex-col justify-between rounded-3xl border-2 border-dashed border-accent bg-background p-6 elevate-lg transition-all duration-300 hover:border-accent active:scale-[0.99] sm:min-h-[340px] sm:p-10 md:min-h-[380px]"
          >
            <span className="absolute -top-2.5 left-6 z-20 -rotate-6 select-none rounded-lg border border-accent-line bg-accent px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white shadow-lg shadow-accent/20">
              16 Voices
            </span>

            <div className="relative z-10">
              <span className="flex h-16 w-16 items-center justify-center rounded-3xl border border-line bg-surface-2 text-ink-2 transition-transform group-hover:scale-110">
                <Mic size={26} />
              </span>
              <h2 className="mt-8 text-2xl font-bold tracking-tight text-foreground">Optiq Voice Engine</h2>
              <span className="mt-2.5 inline-flex rounded-full border border-line bg-surface-2 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-2">
                Studio Narration
              </span>
              <p className="mt-4 max-w-xs text-xs leading-relaxed text-ink-3">
                Pick a speaker, paste your script, and generate a broadcast-clean voiceover. African, diaspora and
                international accents — each with a real voice you can preview.
              </p>
            </div>

            <div className="relative z-10 mt-8 flex items-center justify-between">
              <div className="flex -space-x-2.5">
                {FACE_STACK.map((id) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={id}
                    src={`/media/voice-faces/${id}.jpg`}
                    alt=""
                    className="h-9 w-9 rounded-full border-2 border-line-2 object-cover"
                  />
                ))}
                <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-line-2 bg-surface-2 text-[10px] font-bold text-ink-2">
                  +{VOICE_PROFILES.length - FACE_STACK.length}
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-2xl border border-accent-line bg-accent px-4 py-2 text-xs font-bold text-white shadow-lg shadow-accent/15 transition-all group-hover:scale-[1.03]">
                Open <ChevronRight size={13} />
              </span>
            </div>
          </Link>

          {/* OPTIQ MUSIC */}
          <Link
            href="/dashboard/audio/music"
            className="group relative flex min-h-[260px] flex-col justify-between overflow-hidden rounded-3xl border-2 border-dashed border-success bg-background p-6 elevate-lg transition-all duration-300 hover:border-success active:scale-[0.99] sm:min-h-[340px] sm:p-10 md:min-h-[380px]"
          >
            <div className="relative z-10">
              <span className="flex h-16 w-16 items-center justify-center rounded-3xl border border-line bg-success-soft text-success transition-transform group-hover:scale-110">
                <Music size={26} />
              </span>
              <h2 className="mt-8 text-2xl font-bold tracking-tight text-foreground">Optiq Music</h2>
              <span className="mt-2.5 inline-flex rounded-full border border-line bg-success-soft px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-success">
                Original Score
              </span>
              <p className="mt-4 max-w-xs text-xs leading-relaxed text-ink-3">
                Describe a mood, genre or scene and generate an original, royalty-free instrumental — a soundtrack made
                to sit under your ad.
              </p>
            </div>

            <div className="relative z-10 mt-8 flex items-center justify-between">
              <div className="flex h-10 items-end gap-[3px]">
                {[10, 20, 14, 28, 18, 34, 16, 24, 12].map((h, i) => (
                  <span
                    key={i}
                    className="w-[4px] rounded-full bg-success"
                    style={{ height: `${h}px`, animation: `optiqEq 900ms ease-in-out ${i * 90}ms infinite` }}
                  />
                ))}
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-2xl border border-success bg-success px-4 py-2 text-xs font-bold text-white shadow-lg shadow-success/15 transition-all group-hover:scale-[1.03]">
                Open <ChevronRight size={13} />
              </span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
