"use client";

// Rail primitives — the big, loud controls that live down the left third.
//
// The old rails were a 256px column of 11px labels and 24px hit targets. This
// is the opposite bet: a third of the screen, three or four decisions on it,
// each one large enough to read across a room. If a control doesn't survive
// being drawn this big, it doesn't belong in the rail — it belongs in a tile,
// a menu, or nowhere.

import React from "react";
import { Icon, type IconName } from "../../../components/icons";

/** A titled block of the rail. */
export function RailGroup({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-[15px] font-bold tracking-tight text-foreground">{title}</h2>
        {hint && <span className="shrink-0 text-[11px] font-semibold text-faint">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * The rail's workhorse: a full-width choice. Selected is inked, not tinted —
 * a 1px accent border reads as nothing at this scale.
 */
export function RailChoice({
  label,
  sub,
  icon,
  media,
  selected,
  onSelect,
  trailing,
  disabled,
}: {
  label: string;
  sub?: string;
  icon?: IconName;
  /** Anything that isn't a glyph — a face, a drawn aspect box. */
  media?: React.ReactNode;
  selected?: boolean;
  onSelect: () => void;
  /** Right-hand slot: a price, a play button, a count. */
  trailing?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex w-full items-center gap-3 rounded-[22px] border p-2 transition-all ${
        selected
          ? "border-transparent bg-foreground text-background"
          : "border-line-2 bg-surface text-foreground hover:border-foreground hover:bg-surface-2"
      } ${disabled ? "pointer-events-none opacity-40" : ""}`}
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        className="flex min-w-0 flex-1 items-center gap-3 py-1.5 pl-2 text-left active:scale-[0.99]"
      >
        {media ??
          (icon ? (
            <Icon name={icon} size={22} className={selected ? "" : "text-ink-3"} />
          ) : null)}
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-bold tracking-tight">{label}</span>
          {sub && (
            <span className={`block truncate text-[12px] font-semibold ${selected ? "opacity-70" : "text-muted"}`}>
              {sub}
            </span>
          )}
        </span>
      </button>
      {trailing && <div className="shrink-0 pr-1.5">{trailing}</div>}
    </div>
  );
}

/**
 * The aspect picker, drawn at a size where the shape itself is the label —
 * a wide box means a wide video. "16:9" is a spec sheet; this is a picture.
 */
export function RailShapes({
  options,
  value,
  onChange,
}: {
  options: readonly { id: string; label: string; w: number; h: number }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const MAX = 46;
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {options.map((opt) => {
        const active = opt.id === value;
        const landscape = opt.w >= opt.h;
        const boxW = landscape ? MAX : Math.round(MAX * (opt.w / opt.h));
        const boxH = landscape ? Math.round(MAX * (opt.h / opt.w)) : MAX;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            className={`flex flex-col items-center justify-center gap-2.5 rounded-[22px] border py-4 transition-all active:scale-[0.97] ${
              active
                ? "border-transparent bg-foreground text-background"
                : "border-line-2 bg-surface text-foreground hover:border-foreground hover:bg-surface-2"
            }`}
          >
            <span className="flex h-[52px] items-center justify-center">
              <span
                style={{ width: boxW, height: boxH }}
                className={`rounded-[6px] border-[3px] ${active ? "border-background" : "border-ink-3"}`}
              />
            </span>
            <span className="text-[13px] font-bold tracking-tight">{opt.label}</span>
            <span className={`text-[11px] font-semibold tabular-nums ${active ? "opacity-60" : "text-faint"}`}>
              {opt.id}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * One number, drawn at the size it deserves. Used for the thing that actually
 * decides whether someone presses the big button: what this will cost.
 */
export function RailStat({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
}) {
  return (
    <div className="rounded-[22px] border border-line-2 bg-background p-4">
      <p className="text-[12px] font-bold uppercase tracking-widest text-faint">{label}</p>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className="text-[34px] font-bold leading-none tracking-tight tabular-nums text-foreground">
          {value}
        </span>
        {unit && <span className="text-[15px] font-bold text-ink-3">{unit}</span>}
      </p>
      {note && <p className="mt-1.5 text-[12px] font-semibold text-muted">{note}</p>}
    </div>
  );
}

/** Loose chips, for taggy things like moods where a full row would be absurd. */
export function RailChips({
  options,
  onPick,
}: {
  options: readonly string[];
  onPick: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onPick(opt)}
          className="rounded-full border border-line-2 bg-surface px-4 py-2.5 text-[13px] font-bold tracking-tight text-ink-2 transition-all hover:border-foreground hover:bg-foreground hover:text-background active:scale-95"
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
