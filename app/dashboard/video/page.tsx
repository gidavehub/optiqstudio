"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Clapperboard,
  Download,
  ImagePlus,
  Loader2,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useAuth } from "../../../components/AuthProvider";

interface HistoryItem {
  id: string;
  status: string;
  prompt: string;
  videoUrl: string | null;
  createdAt: string;
}

const ASPECTS = ["16:9", "9:16"] as const;
const DURATIONS = [4, 6, 8] as const;
const RESOLUTIONS = ["720p", "1080p"] as const;

function VideoWorkspace() {
  const { apiFetch, profile, pricing, refreshProfile } = useAuth();
  const searchParams = useSearchParams();

  const [prompt, setPrompt] = useState(searchParams.get("prompt") ?? "");
  const [model, setModel] = useState<"omni" | "omni-fast">("omni");
  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]>("16:9");
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>(8);
  const [resolution, setResolution] = useState<(typeof RESOLUTIONS)[number]>("720p");
  const [audioOn, setAudioOn] = useState(true);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [image, setImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);

  const [phase, setPhase] = useState<"idle" | "generating" | "done" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const perSecond = pricing?.costs.videoPerSecond?.[model] ?? (model === "omni" ? 12 : 5);
  const cost = perSecond * duration;

  const loadHistory = useCallback(() => {
    apiFetch<{ items: HistoryItem[] }>("/api/generations?type=video")
      .then((d) => setHistory(d.items))
      .catch(() => {});
  }, [apiFetch]);

  useEffect(() => {
    loadHistory();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadHistory]);

  const attachImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      setImage({ base64, mimeType: file.type, preview: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const enhance = async () => {
    if (!prompt.trim() || enhancing) return;
    setEnhancing(true);
    try {
      const data = await apiFetch<{ prompt: string }>("/api/enhance", {
        method: "POST",
        body: JSON.stringify({ prompt }),
      });
      setPrompt(data.prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enhance failed");
    } finally {
      setEnhancing(false);
    }
  };

  const generate = async () => {
    if (!prompt.trim() || phase === "generating") return;
    setPhase("generating");
    setError(null);
    setResultUrl(null);
    try {
      const start = await apiFetch<{ id: string }>("/api/video/generate", {
        method: "POST",
        body: JSON.stringify({
          prompt,
          model,
          aspectRatio: aspect,
          durationSeconds: duration,
          resolution,
          generateAudio: audioOn,
          negativePrompt: negativePrompt || undefined,
          imageBase64: image?.base64,
          imageMimeType: image?.mimeType,
        }),
      });
      void refreshProfile();

      pollRef.current = setInterval(async () => {
        try {
          const status = await apiFetch<{
            status: string;
            videoUrl?: string;
            error?: string;
          }>(`/api/video/status?id=${start.id}`);
          if (status.status === "succeeded") {
            if (pollRef.current) clearInterval(pollRef.current);
            setResultUrl(status.videoUrl ?? null);
            setPhase("done");
            loadHistory();
            void refreshProfile();
          } else if (status.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            setError(status.error ?? "Generation failed");
            setPhase("failed");
            void refreshProfile();
          }
        } catch {
          // transient poll errors are fine — keep polling
        }
      }, 6000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setPhase("failed");
      void refreshProfile();
    }
  };

  return (
    <div className="flex h-full">
      {/* Settings rail */}
      <aside className="w-64 shrink-0 space-y-6 overflow-y-auto border-r border-line p-5">
        <div>
          <p className="eyebrow mb-2">Model</p>
          <div className="space-y-1.5">
            {(
              [
                { id: "omni", name: "Omni", note: "Highest fidelity, native audio" },
                { id: "omni-fast", name: "Omni Fast", note: "Fast drafts, lower cost" },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                onClick={() => setModel(m.id)}
                className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  model === m.id
                    ? "border-white/40 bg-surface-2"
                    : "border-line bg-surface hover:border-white/20"
                }`}
              >
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-[11px] text-neutral-500">{m.note}</p>
              </button>
            ))}
          </div>
        </div>

        <Segmented label="Aspect ratio" options={ASPECTS} value={aspect} onChange={setAspect} />
        <Segmented
          label="Duration"
          options={DURATIONS}
          value={duration}
          onChange={setDuration}
          render={(d) => `${d}s`}
        />
        <Segmented label="Resolution" options={RESOLUTIONS} value={resolution} onChange={setResolution} />

        <div>
          <p className="eyebrow mb-2">Audio</p>
          <button
            onClick={() => setAudioOn(!audioOn)}
            className="flex w-full items-center justify-between rounded-lg border border-line bg-surface px-3 py-2.5 text-sm hover:border-white/20 transition-colors"
          >
            <span>{audioOn ? "Native audio on" : "Silent"}</span>
            {audioOn ? <Volume2 size={14} /> : <VolumeX size={14} className="text-neutral-500" />}
          </button>
        </div>

        <div>
          <p className="eyebrow mb-2">Negative prompt</p>
          <textarea
            rows={2}
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            placeholder="What to avoid…"
            className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-xs placeholder:text-neutral-600 focus:border-white/40"
          />
        </div>

        <div className="rounded-lg border border-line bg-surface px-3 py-2.5 text-xs text-neutral-400">
          This run: <span className="text-white font-medium">{cost} credits</span>
          <br />
          Balance: {profile ? profile.credits.toLocaleString() : "—"}
        </div>
      </aside>

      {/* Stage */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex flex-1 items-center justify-center p-8">
          {phase === "generating" ? (
            <div className="text-center">
              <Loader2 size={26} className="mx-auto animate-spin text-neutral-400" />
              <p className="mt-4 text-sm text-neutral-300">Rendering your shot…</p>
              <p className="mt-1 text-xs text-neutral-600">
                Omni is composing frames and sound. This usually takes one to three minutes.
              </p>
            </div>
          ) : resultUrl ? (
            <div className={`w-full ${aspect === "9:16" ? "max-w-sm" : "max-w-3xl"}`}>
              <video src={resultUrl} controls autoPlay loop className="w-full rounded-xl border border-line" />
              <div className="mt-3 flex justify-end">
                <a
                  href={resultUrl}
                  download
                  className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-xs hover:bg-surface-2 transition-colors"
                >
                  <Download size={13} /> Download MP4
                </a>
              </div>
            </div>
          ) : (
            <div className="text-center text-neutral-600">
              <Clapperboard size={28} className="mx-auto" />
              <p className="mt-3 text-sm">Describe a shot below to begin.</p>
            </div>
          )}
        </div>

        {error && (
          <div className="mx-8 mb-3 rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-2.5 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Prompt bar */}
        <div className="border-t border-line p-5">
          {image && (
            <div className="mb-3 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.preview} alt="Reference" className="h-14 w-14 rounded-lg object-cover border border-line" />
              <button onClick={() => setImage(null)} className="text-neutral-500 hover:text-white">
                <X size={14} />
              </button>
              <span className="text-xs text-neutral-500">First-frame reference attached</span>
            </div>
          )}
          <div className="flex items-end gap-3 rounded-2xl border border-line bg-surface p-3">
            <label className="cursor-pointer p-1.5 text-neutral-400 hover:text-white transition-colors" title="Attach first-frame image">
              <ImagePlus size={17} />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && attachImage(e.target.files[0])}
              />
            </label>
            <textarea
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A slow dolly through a rain-soaked neon market at night…"
              className="flex-1 resize-none bg-transparent py-1 text-sm placeholder:text-neutral-600"
            />
            <button
              onClick={enhance}
              disabled={enhancing || !prompt.trim()}
              title="Enhance prompt"
              className="p-1.5 text-neutral-400 hover:text-white transition-colors disabled:opacity-40"
            >
              {enhancing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            </button>
            <button
              onClick={generate}
              disabled={phase === "generating" || !prompt.trim()}
              className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black hover:bg-neutral-200 transition-colors disabled:opacity-40"
            >
              {phase === "generating" ? "Generating…" : `Generate · ${cost}`}
            </button>
          </div>
        </div>

        {/* History strip */}
        {history.length > 0 && (
          <div className="border-t border-line px-5 py-4">
            <p className="eyebrow mb-3">Recent generations</p>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {history.map((h) => (
                <button
                  key={h.id}
                  onClick={() => h.videoUrl && (setResultUrl(h.videoUrl), setPhase("done"))}
                  className="w-40 shrink-0 overflow-hidden rounded-lg border border-line bg-surface text-left hover:border-white/25 transition-colors"
                  title={h.prompt}
                >
                  <div className="aspect-video bg-black">
                    {h.videoUrl ? (
                      <video src={h.videoUrl} muted playsInline className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-neutral-600">
                        {h.status}
                      </div>
                    )}
                  </div>
                  <p className="truncate px-2 py-1.5 text-[10px] text-neutral-500">{h.prompt}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  render,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  render?: (v: T) => string;
}) {
  return (
    <div>
      <p className="eyebrow mb-2">{label}</p>
      <div className="grid grid-flow-col gap-1 rounded-lg bg-surface p-1">
        {options.map((opt) => (
          <button
            key={String(opt)}
            onClick={() => onChange(opt)}
            className={`rounded-md px-2 py-1.5 text-xs transition-colors ${
              value === opt ? "bg-surface-2 text-white" : "text-neutral-500 hover:text-white"
            }`}
          >
            {render ? render(opt) : String(opt)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function VideoPage() {
  return (
    <Suspense>
      <VideoWorkspace />
    </Suspense>
  );
}
