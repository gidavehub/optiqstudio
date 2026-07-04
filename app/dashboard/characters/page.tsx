"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Download, ImagePlus, Loader2, Users, Wand2, X } from "lucide-react";
import { useAuth } from "../../../components/AuthProvider";

interface CharacterItem {
  id: string;
  type: string;
  prompt: string;
  imageUrl: string | null;
  createdAt: string;
}

export default function CharacterStudio() {
  const { apiFetch, pricing, refreshProfile } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [reference, setReference] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const [selected, setSelected] = useState<CharacterItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [characters, setCharacters] = useState<CharacterItem[]>([]);

  const cost = pricing?.costs.characterSheet ?? 15;

  const load = useCallback(() => {
    apiFetch<{ items: CharacterItem[] }>("/api/generations?type=character")
      .then((d) => setCharacters(d.items.filter((c) => c.imageUrl)))
      .catch(() => {});
  }, [apiFetch]);

  useEffect(load, [load]);

  const attach = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setReference({ base64: dataUrl.split(",")[1], mimeType: file.type, preview: dataUrl });
      setSelected(null);
    };
    reader.readAsDataURL(file);
  };

  /** Reuse an existing character as the consistency reference. */
  const useCharacter = async (c: CharacterItem) => {
    if (!c.imageUrl) return;
    setSelected(c);
    setReference(null);
    try {
      const res = await fetch(c.imageUrl);
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      setReference({
        base64: dataUrl.split(",")[1],
        mimeType: blob.type || "image/png",
        preview: dataUrl,
      });
      setSelected(c);
    } catch {
      setError("Couldn't load that character's image for reuse");
    }
  };

  const generate = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<{ url: string }>("/api/image/generate", {
        method: "POST",
        body: JSON.stringify({
          prompt: reference
            ? `Keep this exact character's identity, face and styling perfectly consistent. ${prompt}`
            : `Character design sheet, single subject, studio lighting, photorealistic detail. ${prompt}`,
          purpose: "character",
          referenceImages: reference
            ? [{ base64: reference.base64, mimeType: reference.mimeType }]
            : undefined,
          aspectRatio: "3:4",
        }),
      });
      setResultUrl(data.url);
      load();
      void refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <h1 className="display text-2xl">Character Studio</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Design a character once, then keep their identity consistent across every generation.
      </p>

      <div className="mt-8 grid gap-8 md:grid-cols-[1fr_320px]">
        <div>
          <div className="rounded-2xl border border-line bg-surface p-3">
            {reference && (
              <div className="mb-3 flex items-center gap-3 px-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={reference.preview} alt="Reference" className="h-14 w-14 rounded-lg border border-line object-cover" />
                <span className="text-xs text-neutral-500">
                  {selected ? "Reusing existing character" : "Reference attached"}
                </span>
                <button onClick={() => { setReference(null); setSelected(null); }} className="text-neutral-500 hover:text-white">
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="flex items-end gap-3">
              <label className="cursor-pointer p-1.5 text-neutral-400 hover:text-white transition-colors" title="Attach reference image">
                <ImagePlus size={17} />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && attach(e.target.files[0])} />
              </label>
              <textarea
                rows={2}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A weathered deep-sea salvage diver in her 50s, silver hair, amber eyes…"
                className="flex-1 resize-none bg-transparent py-1 text-sm placeholder:text-neutral-600"
              />
              <button
                onClick={generate}
                disabled={busy || !prompt.trim()}
                className="flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-medium text-black hover:bg-neutral-200 transition-colors disabled:opacity-40"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                {busy ? "Creating…" : `Create · ${cost}`}
              </button>
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <div className="mt-6 flex min-h-[320px] items-center justify-center rounded-xl border border-line bg-surface">
            {busy ? (
              <Loader2 size={22} className="animate-spin text-neutral-500" />
            ) : resultUrl ? (
              <div className="w-full p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resultUrl} alt="Generated character" className="mx-auto max-h-[480px] rounded-lg" />
                <div className="mt-3 flex justify-end">
                  <a href={resultUrl} download className="flex items-center gap-2 rounded-full border border-line px-4 py-1.5 text-xs hover:bg-surface-2 transition-colors">
                    <Download size={12} /> Download
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-center text-neutral-600">
                <Users size={26} className="mx-auto" />
                <p className="mt-3 text-sm">Your character will appear here.</p>
              </div>
            )}
          </div>
        </div>

        {/* Cast */}
        <div>
          <p className="eyebrow mb-3">Your cast</p>
          {characters.length === 0 ? (
            <p className="text-xs text-neutral-600">
              Characters you create show up here. Click one to reuse it as a consistency reference.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {characters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => void useCharacter(c)}
                  className={`overflow-hidden rounded-lg border text-left transition-colors ${
                    selected?.id === c.id ? "border-white/50" : "border-line hover:border-white/25"
                  }`}
                  title={c.prompt}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.imageUrl!} alt={c.prompt} className="aspect-[3/4] w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
