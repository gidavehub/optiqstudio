"use client";

// AgentComposer — the box you talk to the agent through.
//
// Same card as the creation wizard's vision step (that is the house prompt
// surface), and the same live speech-to-text mic every prompt console in the
// studio uses — words land in the box as they're spoken, so you can direct the
// film out loud instead of typing a paragraph of notes.

import React, { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Mic, MicOff, Paperclip, Play, X } from "lucide-react";
import useAudioTranscription from "./useAudioTranscription";
import { AgentAttachment } from "./types";

interface AgentComposerProps {
  value: string;
  setValue: (v: string) => void;
  onSend: () => void;
  /** True while a turn is in flight — sending is locked, typing is not. */
  busy: boolean;
  /** The step the agent is on, shown above the box while it works. */
  activity: string | null;
  disabled?: boolean;
  /** Stills staged for the next message. Same shape and same affordances as
   *  the Image and Video studio consoles. */
  images: AgentAttachment[];
  onAttach: (files: FileList | null) => void;
  onRemoveImage: (id: string) => void;
  /** Set when a dropped file was rejected — e.g. too big for the payload. */
  attachError?: string | null;
  /** Posts a recorded packet to gemini-3.5-flash and resolves the transcript. */
  transcribe: (audioBase64: string, mimeType: string) => Promise<string>;
}

export default function AgentComposer({
  value,
  setValue,
  onSend,
  busy,
  activity,
  disabled = false,
  images,
  onAttach,
  onRemoveImage,
  attachError,
  transcribe,
}: AgentComposerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  // Depth counter, not a boolean: dragging over a child fires dragleave on the
  // parent, so a boolean flickers the overlay off mid-drag.
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Recorded audio to 3.5-flash, not Web Speech — see useAudioTranscription.
  // The transcript lands appended, so dictating twice builds one instruction.
  const dictation = useAudioTranscription(
    (text) => setValue(value.trim() ? `${value.trimEnd()} ${text}` : text),
    transcribe
  );

  // Grow with the text, then scroll. Runs on every value change so dictated
  // words resize the box exactly like typed ones.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  // An image on its own is a legitimate turn: attaching a reference and
  // saying nothing still tells the agent something.
  const canSend = !busy && !disabled && !dictation.transcribing && (!!value.trim() || images.length > 0);

  const endDrag = () => {
    dragDepth.current = 0;
    setDragging(false);
  };

  const submit = () => {
    // Stopping the recorder kicks off a round trip to the model, so hitting
    // send mid-recording can't also send: the words aren't in the box yet. Stop
    // and let the transcript land — the next press sends it.
    if (dictation.recording) {
      dictation.stop();
      return;
    }
    if (!canSend) return;
    onSend();
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      {(attachError || dictation.error) && (
        <div className="mb-2 px-1 text-[11px] font-semibold text-danger">{attachError || dictation.error}</div>
      )}

      {activity && (
        <div className="mb-2 flex items-center gap-2 px-1">
          <Loader2 size={11} className="shrink-0 animate-spin text-accent-ink" />
          <span className="truncate tabular-nums text-[10px] uppercase tracking-widest text-muted">
            {activity}
          </span>
        </div>
      )}

      <div
        onDragEnter={(e) => {
          e.preventDefault();
          if (disabled) return;
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) endDrag();
        }}
        onDrop={(e) => {
          e.preventDefault();
          endDrag();
          if (!disabled) onAttach(e.dataTransfer.files);
        }}
        className={`relative rounded-[28px] border bg-surface/80 p-3 elevate-lg backdrop-blur-xl transition-all duration-300 focus-within:border-accent-line focus-within:ring-2 focus-within:ring-accent-line ${
          dragging ? "border-accent ring-2 ring-accent-line" : "border-line"
        }`}
      >
        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[28px] bg-background/80 backdrop-blur-sm">
            <span className="flex items-center gap-2 text-xs font-bold text-accent-ink">
              <Paperclip size={13} /> Drop stills or clips for the agent to watch
            </span>
          </div>
        )}
        {images.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 px-1">
            {images.map((img) => (
              <div key={img.id} className="group relative h-14 w-14 overflow-hidden rounded-xl border border-line">
                {img.kind === "video" ? (
                  <>
                    {/* A muted first frame reads far better than a file name. */}
                    <video src={img.preview} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/25">
                      <Play size={12} fill="currentColor" className="text-white drop-shadow" />
                    </span>
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img.preview} alt="" className="h-full w-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => onRemoveImage(img.id)}
                  aria-label="Remove attachment"
                  className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background/85 text-ink-3 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          readOnly={dictation.recording || dictation.transcribing}
          disabled={disabled}
          placeholder={
            dictation.recording
              ? "Recording — tap Stop when you're done…"
              : dictation.transcribing
                ? "Transcribing…"
                : disabled
                ? "Generate the storyboard first…"
                : "Scene 4 drags — give it a real event, and land the tub in shot…"
          }
          className="max-h-[200px] w-full resize-none overflow-y-auto bg-transparent px-1.5 py-1 text-sm leading-relaxed text-foreground outline-none placeholder:text-faint"
        />

        <div className="mt-2 flex items-center justify-between border-t border-line pt-2.5">
          {/* Input affordances group left; send stays right. */}
          <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={dictation.toggle}
            disabled={disabled || dictation.transcribing}
            title={
              dictation.recording
                ? "Stop recording and transcribe"
                : dictation.transcribing
                  ? "Transcribing your recording…"
                  : "Record direction — it's transcribed when you stop"
            }
            className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-[11px] font-bold transition-all disabled:opacity-40 ${
              dictation.recording
                ? "animate-pulse border-danger bg-danger-soft text-danger"
                : "border-line bg-surface text-ink-3 hover:border-line hover:text-foreground"
            }`}
          >
            {dictation.transcribing ? (
              <Loader2 size={12} className="animate-spin text-accent-ink" />
            ) : dictation.recording ? (
              <MicOff size={12} />
            ) : (
              <Mic size={12} className="text-accent-ink" />
            )}
            {dictation.transcribing ? "Transcribing" : dictation.recording ? "Stop" : "Voice"}
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(e) => {
              onAttach(e.target.files);
              // Reset, or picking the same file twice in a row fires nothing.
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={disabled}
            title="Attach stills or clips — or just drop them on the box"
            className="flex items-center gap-1.5 rounded-2xl border border-line bg-surface px-3 py-2 text-[11px] font-bold text-ink-3 transition-all hover:text-foreground disabled:opacity-40"
          >
            <Paperclip size={12} className="text-accent-ink" /> Attach
          </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden tabular-nums text-[10px] uppercase tracking-widest text-faint sm:block">
              {busy ? "Working" : "Enter to send"}
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              aria-label="Send"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background transition-all hover:bg-ink-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
