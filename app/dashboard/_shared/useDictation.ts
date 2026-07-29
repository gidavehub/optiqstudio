"use client";

// useDictation — the live speech-to-text mic, extracted so every prompt console
// gets the exact same behaviour as the storyboard wizard's mic button.
//
// This is the Web Speech API running continuously with interim results ON, so
// words appear in the box as they're spoken rather than only at the end. Text is
// appended to whatever was already typed, never replacing it.

import { useCallback, useEffect, useRef, useState } from "react";

/** The slice of the Web Speech API this hook actually touches. */
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechResultEvent) => void) | null;
}

interface SpeechResultEvent {
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

type SetText = (updater: (prev: string) => string) => void;

export interface Dictation {
  /** True while the mic is open. */
  recording: boolean;
  /** Words recognised so far in this session but not yet committed. */
  interim: string;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

export function useDictation(setText: SetText, lang = "en-US"): Dictation {
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  // The text as it stood when the mic opened — every result is appended to this
  // so a long dictation doesn't stack duplicates of earlier phrases.
  const baseRef = useRef("");
  const setTextRef = useRef(setText);

  useEffect(() => {
    setTextRef.current = setText;
  });

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
    recRef.current = null;
    setRecording(false);
    setInterim("");
  }, []);

  const start = useCallback(() => {
    const SR = getRecognitionCtor();
    if (!SR) {
      // Same message the storyboard wizard gives, so behaviour is consistent.
      alert("Speech recognition is not supported in this browser. Please type instead.");
      return;
    }
    if (recRef.current) return;

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;

    // Capture the starting text once, via the setter, so we never need the
    // current value as a dependency (which would re-create this on every
    // keystroke and tear the mic down mid-sentence).
    setTextRef.current((prev) => {
      baseRef.current = prev;
      return prev;
    });

    rec.onstart = () => setRecording(true);

    rec.onresult = (e) => {
      let finalText = "";
      let pending = "";
      for (let i = 0; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += chunk + " ";
        else pending += chunk;
      }
      setInterim(pending.trim());
      const committed = finalText.trim();
      if (committed) {
        const base = baseRef.current;
        setTextRef.current(() => (base ? `${base} ${committed}` : committed));
      }
    };

    rec.onerror = () => {
      recRef.current = null;
      setRecording(false);
      setInterim("");
    };
    rec.onend = () => {
      recRef.current = null;
      setRecording(false);
      setInterim("");
    };

    recRef.current = rec;
    rec.start();
  }, [lang]);

  const toggle = useCallback(() => {
    if (recRef.current) stop();
    else start();
  }, [start, stop]);

  // Never leave the mic hot after the console unmounts.
  useEffect(() => () => stop(), [stop]);

  return { recording, interim, start, stop, toggle };
}
