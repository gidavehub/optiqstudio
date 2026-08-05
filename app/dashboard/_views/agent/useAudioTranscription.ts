"use client";

// useAudioTranscription — the storyline agent's mic.
//
// This is deliberately NOT _shared/useDictation, which the studio consoles use.
// That hook is the browser's Web Speech API: a different engine in every
// browser, unavailable in some, and it mishears the words that matter most here
// — brand names, and Gambian / Nigerian proper nouns. A round-trip probe of
// "land the Banjul tub before Amaka turns to camera" came back from Web
// Speech-class recognition as "banjo" and "Omaka".
//
// So the agent records a real audio packet with MediaRecorder and posts it to
// gemini-3.5-flash, which transcribes it in one shot with the project's own
// names supplied as spelling hints. The trade is that there is no live interim
// text — you get the transcript when you stop, not as you speak — which is the
// right trade for direction, where you say a whole thought and then send it.

import { useCallback, useRef, useState } from "react";

export interface AudioTranscription {
  /** Mic is open and capturing. */
  recording: boolean;
  /** Audio captured, waiting on the model. */
  transcribing: boolean;
  /** Whatever went wrong, in words a director can act on. */
  error: string | null;
  toggle: () => void;
  stop: () => void;
}

/** The first container the browser actually supports, in preference order. */
function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

/**
 * @param onTranscript  Called with the finished text. Appending vs replacing is
 *                      the caller's decision.
 * @param transcribe    Posts the packet and resolves the transcript.
 */
export default function useAudioTranscription(
  onTranscript: (text: string) => void,
  transcribe: (audioBase64: string, mimeType: string) => Promise<string>
): AudioTranscription {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = async () => {
        // Release the mic immediately — leaving the track live keeps the
        // browser's recording indicator on and looks like we're still listening.
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);

        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        chunksRef.current = [];
        // A tap rather than a hold produces a few bytes of silence; there is
        // nothing to send and a round trip would only return an empty string.
        if (blob.size < 1024) return;

        setTranscribing(true);
        try {
          const dataUrl: string = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Could not read the recording"));
            reader.readAsDataURL(blob);
          });
          // Strip any codec parameters — the API wants a bare container type.
          const bare = (rec.mimeType || "audio/webm").split(";")[0];
          const text = await transcribe(dataUrl.split(",")[1], bare);
          if (text.trim()) onTranscript(text.trim());
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not transcribe that");
        } finally {
          setTranscribing(false);
        }
      };

      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      setError("No microphone access — check the browser's permission for this site.");
    }
  }, [onTranscript, transcribe]);

  const toggle = useCallback(() => {
    if (recording) stop();
    else void start();
  }, [recording, start, stop]);

  return { recording, transcribing, error, toggle, stop };
}
