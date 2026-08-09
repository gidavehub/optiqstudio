"use client";

// StudioDock — the bottom of every studio, in two layers.
//
//   LAYER 1  four big tiles. Attach, dictate, enhance, shape. These used to be
//            16px glyphs crammed inside the input bar, where they were both
//            invisible and un-hittable. Four is the cap, on purpose: the tile
//            only stays big if there are four of them.
//
//   LAYER 2  the input bar and one round send button. Nothing else is allowed
//            in here — no paperclip, no mic, no wand. The bar is for words.
//
// Attachments preview above layer 1, so neither layer ever changes height.

import React, { useEffect, useRef } from "react";
import { Icon } from "../../../components/icons";
import type { DockTile } from "./types";

interface StudioDockProps {
  tiles: readonly DockTile[];
  value: string;
  setValue: (v: string) => void;
  placeholder: string;
  onSubmit: () => void;
  /** Blocks send and spins the button. */
  busy?: boolean;
  /** Locks the whole dock — e.g. the agent room before a script exists. */
  disabled?: boolean;
  /** Typing is blocked but sending isn't — the mic owns the box right now. */
  readOnly?: boolean;
  /** Enter sends, Shift+Enter breaks the line. Off for long-form scripts. */
  submitOnEnter?: boolean;
  /** Hard cap, mirrored in the counter under the bar. */
  maxLength?: number;
  /** Right-hand note under the bar — cost, speaker, clip length. */
  hint?: string;
  /** Staged references, rendered above the tiles. */
  attachments?: React.ReactNode;
  /** Error strip above everything. */
  error?: string | null;
  onDismissError?: () => void;
}

function TileButton({ tile }: { tile: DockTile }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const press = () => {
    if (tile.disabled) return;
    if (tile.file) fileRef.current?.click();
    else tile.onSelect?.();
  };

  // Inked when it's doing something, outlined when it isn't. Danger swaps the
  // ink for red rather than adding a fifth visual state.
  const skin = tile.danger
    ? "border-transparent bg-danger text-white"
    : tile.active
      ? "border-transparent bg-foreground text-background"
      : "border-line-2 bg-surface text-ink-2 hover:border-foreground hover:bg-surface-2 hover:text-foreground";

  return (
    <button
      type="button"
      onClick={press}
      disabled={tile.disabled}
      title={tile.label}
      className={`group relative flex h-[68px] flex-col items-center justify-center gap-1 rounded-[22px] border transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35 sm:h-[84px] sm:gap-1.5 sm:rounded-[28px] ${skin} ${
        tile.danger ? "animate-pulse" : ""
      }`}
    >
      {tile.busy ? (
        <Icon name="spinner" size={22} className="animate-spin sm:h-[26px] sm:w-[26px]" />
      ) : (
        <Icon name={tile.icon} size={22} className="sm:h-[26px] sm:w-[26px]" />
      )}
      <span className="max-w-full truncate px-2 text-[11px] font-bold tracking-tight sm:text-[13px]">
        {tile.label}
      </span>
      {tile.value && (
        <span className="max-w-full truncate px-2 text-[10px] font-semibold opacity-60 sm:text-[11px]">
          {tile.value}
        </span>
      )}
      {!!tile.badge && tile.badge > 0 && (
        <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold tabular-nums text-white">
          {tile.badge}
        </span>
      )}
      {tile.file && (
        <input
          ref={fileRef}
          type="file"
          accept={tile.file.accept}
          multiple={tile.file.multiple}
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length) tile.file?.onFiles(files);
            // Reset, or picking the same file twice in a row fires nothing.
            e.target.value = "";
          }}
        />
      )}
    </button>
  );
}

export default function StudioDock({
  tiles,
  value,
  setValue,
  placeholder,
  onSubmit,
  busy = false,
  disabled = false,
  readOnly = false,
  submitOnEnter = false,
  maxLength,
  hint,
  attachments,
  error,
  onDismissError,
}: StudioDockProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grow with the text, then scroll. Runs on every value change so dictated
  // words resize the box exactly like typed ones.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const canSend = !busy && !disabled && !!value.trim();

  return (
    <div className="shrink-0 px-3 pb-3 sm:px-5 sm:pb-5">
      {error && (
        <div className="mb-2.5 flex animate-rise items-center justify-between gap-3 rounded-[20px] border border-danger bg-danger-soft px-4 py-3 text-[13px] font-semibold text-danger">
          <span className="min-w-0 flex-1 truncate">{error}</span>
          <button onClick={onDismissError} aria-label="Dismiss" className="shrink-0 opacity-70 hover:opacity-100">
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {attachments}

      {/* ── LAYER 1 ── */}
      <div className="mb-2.5 grid grid-cols-4 gap-2 sm:mb-3 sm:gap-3">
        {tiles.map((tile) => (
          <TileButton key={tile.id} tile={tile} />
        ))}
      </div>

      {/* ── LAYER 2 ── */}
      <div className="flex items-end gap-2.5 sm:gap-3">
        <div className="flex min-w-0 flex-1 flex-col rounded-[26px] border border-line-2 bg-surface px-4 py-3 transition-colors focus-within:border-foreground sm:rounded-[30px] sm:px-5 sm:py-4">
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            maxLength={maxLength}
            disabled={disabled}
            readOnly={readOnly}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (submitOnEnter && e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend) onSubmit();
              }
            }}
            placeholder={placeholder}
            className="max-h-40 w-full resize-none overflow-y-auto bg-transparent text-[15px] font-medium leading-relaxed text-foreground placeholder:text-faint focus:outline-none disabled:cursor-not-allowed sm:text-base"
          />
          {(maxLength || hint) && (
            <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] font-semibold tabular-nums text-faint">
              <span>{maxLength ? `${value.length.toLocaleString()} / ${maxLength.toLocaleString()}` : ""}</span>
              {hint && <span className="truncate">{hint}</span>}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSend}
          aria-label="Generate"
          title="Generate"
          className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-all hover:bg-ink-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-25 sm:h-[68px] sm:w-[68px]"
        >
          <Icon name={busy ? "spinner" : "send"} size={26} className={busy ? "animate-spin" : ""} />
        </button>
      </div>
    </div>
  );
}
