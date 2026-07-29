"use client";

// useReusePrompt — "run this again, with everything it used".
//
// Reusing a prompt only ever restored the text, which quietly dropped the
// reference images that made the result look the way it did. A generation doc
// stores those as Cloud Storage paths (`images: [{ path, mimeType }]`), so this
// resolves them back to the base64 payload the generate endpoints expect and
// hands both halves back to the console.

import { useCallback } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { db, storage } from "../../../lib/firebase";

export interface ReusedImage {
  id: string;
  base64: string;
  mimeType: string;
  preview: string;
}

export interface ReusedPrompt {
  prompt: string;
  images: ReusedImage[];
}

async function toAttachment(path: string, mimeType?: string): Promise<ReusedImage | null> {
  try {
    const url = await getDownloadURL(storageRef(storage, path));
    const blob = await (await fetch(url)).blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return {
      id: Math.random().toString(36).slice(2, 9),
      base64: dataUrl.split(",")[1],
      mimeType: mimeType || blob.type || "image/png",
      preview: dataUrl,
    };
  } catch {
    // A reference whose file has since been deleted just doesn't come back —
    // the prompt text is still worth restoring on its own.
    return null;
  }
}

export function useReusePrompt() {
  return useCallback(async (generationId: string): Promise<ReusedPrompt | null> => {
    try {
      const snap = await getDoc(doc(db, "generations", generationId));
      if (!snap.exists()) return null;
      const data = snap.data() as {
        prompt?: string;
        text?: string;
        images?: { path?: string; mimeType?: string }[];
        imagePath?: string;
        imageMimeType?: string;
      };

      // `text` carries the full script for voice takes (prompt is truncated).
      const prompt = data.text || data.prompt || "";

      const refs =
        Array.isArray(data.images) && data.images.length > 0
          ? data.images
          : data.imagePath
            ? [{ path: data.imagePath, mimeType: data.imageMimeType }]
            : [];

      const resolved = await Promise.all(
        refs
          .filter((r) => !!r?.path)
          .map((r) => toAttachment(r.path as string, r.mimeType))
      );

      return { prompt, images: resolved.filter(Boolean) as ReusedImage[] };
    } catch {
      return null;
    }
  }, []);
}
