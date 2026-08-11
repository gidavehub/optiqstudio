"use client";

// BlueprintStage — THE gate of the experimental original story.
//
// This is the screen the whole film type exists around. Every other kind of film
// on this platform runs from brief to finished cut without stopping; this one
// writes its script, its cast, its voices and its locations as TEXT ONLY, and
// then waits here until the director says go.
//
// Which makes this the last free moment — and now the ONLY one. There used to be
// a second gate after it, where the director approved a board of photographs
// before the clips were bought; nothing is photographed any more, so the clips
// are the whole spend and this screen is what stands in front of them. Its job is
// to make a five-minute film READABLE before it is bought: the shape of the story
// at a glance, every scene's full script when you want it, the cast with their
// locked voices, and the location bible every scene is written from.
//
// The agent lives on the same screen rather than behind a link, because a
// director who has just read scene 19 and does not like it should be able to say
// so without navigating away and losing their place.

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  MapPin,
  MessageSquare,
  Users,
} from "lucide-react";
import { useEditorFlow } from "../../_flow/EditorFlowProvider";
import { LocationBlock, Scene } from "../../_flow/types";

function words(text?: string): number {
  const t = String(text || "").trim();
  return t ? t.split(/\s+/).length : 0;
}

/**
 * The eight sections of a location block, in the fixed order the server composes
 * them in — see BLOCK_SECTIONS in functions/optiqStoryX/locations.js. Same order
 * here so the director reads the block the way the video model receives it.
 */
const LOCATION_SECTIONS: [keyof LocationBlock & string, string][] = [
  ["shell", "The shell"],
  ["surfaces", "Surfaces"],
  ["light", "Light"],
  ["fixtures", "Fixed furniture"],
  ["dressing", "Dressing"],
  ["geography", "Where people sit and stand"],
  ["backgroundLife", "Background life"],
  ["sound", "Sound of the place"],
];

/** The obligation a scene serves, as a short chip. */
const ACT_LABELS: Record<string, string> = {
  open: "Open",
  want: "Want",
  turn: "Turn",
  escalate: "Escalate",
  climax: "Climax",
  land: "Land",
};

export default function BlueprintStage() {
  const router = useRouter();
  const {
    storyboard,
    projects,
    activeProjectId,
    projectLink,
    aspectRatio,
    length,
    locations,
    approveBlueprint,
    copyToClipboard,
    copiedIndex,
  } = useEditorFlow();

  const project = projects.find((p) => p.id === activeProjectId) ?? null;
  // Memoised so the `??` does not mint a fresh empty array on every render, which
  // would re-run every derivation below it for nothing.
  const scenes: Scene[] = useMemo(() => storyboard?.scenes ?? [], [storyboard]);

  const [openScene, setOpenScene] = useState<number | null>(null);
  const [openLocation, setOpenLocation] = useState<string | null>(null);
  const [showWorld, setShowWorld] = useState(false);
  const [starting, setStarting] = useState(false);

  // The registry's cast. Every lock on them is worth reading here, because this
  // is the last moment they are free to change: nothing is attached to a render
  // on this film type, so these words ARE the people, and a voice that reads like
  // another character's voice is two characters who will sound the same in
  // thirty separately-generated clips.
  const registryCast = (project?.blueprint?.registry?.characters ?? []) as {
    name?: string;
    role?: string;
    voice?: string;
    tell?: string;
    wardrobe?: string;
    scenes?: number[];
  }[];

  const totalWords = useMemo(
    () => scenes.reduce((sum, s) => sum + words(s.fullPrompt), 0),
    [scenes]
  );

  // Approving moves the pipeline stage to "ready", which is what lets the
  // workspace past this screen — see approveBlueprint in EditorFlowProvider. No
  // navigation needed: the same route re-renders as the script/timeline once the
  // stage lands.
  const onContinue = async () => {
    setStarting(true);
    try {
      await approveBlueprint();
    } finally {
      setStarting(false);
    }
  };

  /** What a scene render costs × how many, so "Continue" is an honest promise. */
  const renderEstimate = (sceneCount: number) =>
    `${sceneCount} clip${sceneCount === 1 ? "" : "s"} of ${10}s`;

  return (
    <div className="h-dvh overflow-y-auto bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-4 pb-32 pt-20 sm:px-6">
        {/* ── THE FILM ── */}
        <header className="space-y-3">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
            The blueprint · nothing has been bought yet
          </span>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
            {storyboard?.title || project?.title || "Untitled film"}
          </h1>
          <p className="text-sm leading-relaxed text-ink-2">{storyboard?.concept || project?.concept}</p>

          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[11px] tabular-nums text-muted">
            <span>{length} · {scenes.length} scenes</span>
            <span>{aspectRatio}</span>
            <span>{totalWords.toLocaleString()} words of script</span>
            {registryCast.length > 0 && <span>{registryCast.length} cast</span>}
          </div>
        </header>

        {/* ── THE SPINE ── */}
        {(project?.whatIsAtStake || project?.theEnding) && (
          <section className="mt-7 space-y-3 rounded-[28px] border border-line bg-surface p-4">
            {project?.whatIsAtStake && (
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wide text-muted">What is at stake</span>
                <p className="mt-1 text-xs leading-relaxed text-ink-2">{project.whatIsAtStake}</p>
              </div>
            )}
            {project?.theEnding && (
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wide text-muted">How it ends</span>
                <p className="mt-1 text-xs leading-relaxed text-ink-2">{project.theEnding}</p>
              </div>
            )}
          </section>
        )}

        {/* ── THE CAST, AND THEIR VOICES ──
            Nothing is attached to a render on this film type, so every one of
            these locks — the face, the clothes, the voice — survives thirty
            separate clips only because the identical words are pasted into all
            thirty. If two of these read alike, that is two characters who will
            come out alike, and HERE is where it is free to fix. */}
        {registryCast.length > 0 && (
          <section className="mt-4 rounded-[28px] border border-line bg-surface p-4">
            <div className="flex items-center gap-1.5">
              <Users size={12} className="text-muted" />
              <span className="text-[9px] font-bold uppercase tracking-wide text-muted">
                Cast &amp; locked voices
              </span>
            </div>
            <div className="mt-3 space-y-3">
              {registryCast.map((c) => (
                <div key={c.name} className="border-t border-line pt-3 first:border-0 first:pt-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-xs font-bold">{c.name}</span>
                    {c.role && <span className="text-[11px] text-muted">{c.role}</span>}
                    {(c.scenes?.length ?? 0) > 0 && (
                      <span className="text-[10px] tabular-nums text-faint">
                        {c.scenes!.length} scene{c.scenes!.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  {c.voice && <p className="mt-1 text-[11px] leading-relaxed text-ink-2">{c.voice}</p>}
                  {c.tell && <p className="mt-1 text-[11px] leading-relaxed text-muted">Tell: {c.tell}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── THE LOCATION BIBLE ──
            Every place in the film, written once and pasted verbatim into every
            scene set there — the thing that stops a room drifting between clips
            now that nothing is photographed. Collapsed by default because it is
            hundreds of words per place, and expandable because when a room DOES
            come out wrong, this paragraph is the reason and this is where it is
            read. Two rooms of the same kind reading alike is the failure worth
            catching here. */}
        {locations.length > 0 && (
          <section className="mt-4 rounded-[28px] border border-line bg-surface">
            <button
              onClick={() => setShowWorld((v) => !v)}
              className="flex w-full items-center justify-between gap-2 p-4 text-left"
            >
              <span className="flex items-center gap-1.5">
                <MapPin size={12} className="text-muted" />
                <span className="text-[9px] font-bold uppercase tracking-wide text-muted">
                  The location bible
                </span>
              </span>
              <span className="flex items-center gap-2 text-[11px] tabular-nums text-muted">
                {locations.length} place{locations.length === 1 ? "" : "s"}
                {showWorld ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </span>
            </button>
            {showWorld && (
              <div className="border-t border-line">
                {locations.map((loc) => {
                  const open = openLocation === loc.id;
                  return (
                    <div key={loc.id} className="border-b border-line last:border-0">
                      <button
                        onClick={() => setOpenLocation(open ? null : loc.id)}
                        className="flex w-full items-start justify-between gap-3 p-4 text-left"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline gap-x-2">
                            <span className="text-xs font-bold">{loc.name}</span>
                            {loc.timeOfDay && <span className="text-[11px] text-muted">{loc.timeOfDay}</span>}
                            {loc.complexity === "complex" && (
                              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink-2">
                                Complex
                              </span>
                            )}
                          </span>
                          {(loc.scenes?.length ?? 0) > 0 && (
                            <span className="mt-1 block text-[10px] tabular-nums text-faint">
                              sc. {loc.scenes!.join(", ")}
                            </span>
                          )}
                        </span>
                        {open ? <ChevronDown size={12} className="mt-0.5 shrink-0 text-muted" /> : <ChevronRight size={12} className="mt-0.5 shrink-0 text-muted" />}
                      </button>
                      {open && (
                        <div className="space-y-3 px-4 pb-4">
                          {LOCATION_SECTIONS.map(([field, label]) =>
                            loc[field] ? (
                              <div key={field}>
                                <span className="text-[9px] font-bold uppercase tracking-wide text-muted">
                                  {label}
                                </span>
                                <p className="mt-1 text-[11px] leading-relaxed text-ink-2">{loc[field]}</p>
                              </div>
                            ) : null
                          )}
                          {loc.distinctFrom && (
                            <div>
                              <span className="text-[9px] font-bold uppercase tracking-wide text-muted">
                                Which place this is not
                              </span>
                              <p className="mt-1 text-[11px] leading-relaxed text-muted">{loc.distinctFrom}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ── EVERY SCENE ──
            One row each, expanding to the full script. Collapsed by default
            because thirty scenes at 2,000 words is 60,000 words, and a wall of
            that is not something anybody reads — but every word of it is here
            for the scenes they care about. */}
        <section className="mt-7">
          <span className="text-[9px] font-bold uppercase tracking-wide text-muted">The film, scene by scene</span>
          <div className="mt-3 space-y-2">
            {scenes.map((scene, idx) => {
              const beat = (project?.blueprint?.storyline?.sceneBeats ?? []).find(
                (b: { sceneNumber?: number }) => Number(b?.sceneNumber) === Number(scene.sceneNumber)
              ) as { act?: string; purpose?: string } | undefined;
              const open = openScene === idx;
              return (
                <div key={idx} className="overflow-hidden rounded-[28px] border border-line bg-surface">
                  <button
                    onClick={() => setOpenScene(open ? null : idx)}
                    className="flex w-full items-start gap-3 p-4 text-left"
                  >
                    <span className="mt-0.5 w-6 shrink-0 text-[11px] font-bold tabular-nums text-muted">
                      {scene.sceneNumber}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        {beat?.act && (
                          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink-2">
                            {ACT_LABELS[beat.act] ?? beat.act}
                          </span>
                        )}
                        <span className="truncate text-xs font-bold">{scene.setting}</span>
                      </span>
                      <span className="mt-1 block text-[11px] leading-relaxed text-muted line-clamp-2">
                        {scene.action}
                      </span>
                    </span>
                    <span className="mt-0.5 shrink-0 text-[10px] tabular-nums text-faint">
                      {words(scene.fullPrompt).toLocaleString()}w
                    </span>
                  </button>

                  {open && (
                    <div className="space-y-3 border-t border-line p-4">
                      {scene.dialogue && (
                        <div>
                          <span className="text-[9px] font-bold uppercase tracking-wide text-muted">Dialogue</span>
                          <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-ink-2">
                            {scene.dialogue}
                          </p>
                        </div>
                      )}
                      {scene.sound && (
                        <div>
                          <span className="text-[9px] font-bold uppercase tracking-wide text-muted">Sound</span>
                          <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-ink-2">
                            {scene.sound}
                          </p>
                        </div>
                      )}
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-bold uppercase tracking-wide text-muted">
                            The full script for this scene
                          </span>
                          <button
                            onClick={() => copyToClipboard(scene.fullPrompt, idx)}
                            className="text-[11px] text-muted transition-colors hover:text-accent-ink"
                          >
                            {copiedIndex === idx ? "Copied" : "Copy"}
                          </button>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-ink-2">
                          {scene.fullPrompt}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ── THE GATE ──
          Fixed to the bottom, because on a thirty-scene film it is otherwise
          sixty thousand words below the fold. It says what it will spend before
          it spends it: this is the first irreversible step in the film. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <button
            onClick={() => router.push(projectLink("agent"))}
            className="flex items-center gap-1.5 rounded-2xl border border-line px-4 py-2.5 text-xs font-bold transition-colors hover:border-line-2"
          >
            <MessageSquare size={12} /> Change something
          </button>

          <div className="min-w-0 flex-1 text-[11px] leading-snug text-muted">
            Next: render the film — {renderEstimate(scenes.length)}. This is the
            step that spends.
          </div>

          <button
            onClick={onContinue}
            disabled={starting || scenes.length === 0}
            className="flex items-center gap-1.5 rounded-2xl bg-foreground px-5 py-2.5 text-xs font-bold text-background transition-all hover:bg-ink-2 disabled:opacity-40"
          >
            <Clapperboard size={12} />
            {starting ? "Starting…" : "Render the film"}
            <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
