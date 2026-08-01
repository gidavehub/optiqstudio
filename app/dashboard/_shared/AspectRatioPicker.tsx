"use client";

// AspectRatioPicker — the "so even a 50-year-old gets it" aspect selector.
//
// Instead of abstract labels like "16:9", it draws the actual shape: a wide
// rectangle for landscape, a tall one for portrait, a square for square. Shared
// by every Direct Studio rail (video, image) so the affordance is identical
// everywhere. Options carry the ratio as w/h; the outline box is scaled to it.

import React from "react";
import { Check } from "lucide-react";

export interface AspectOption {
  id: string;
  label: string;
  /** Ratio numerator/denominator — drives the drawn rectangle's proportions. */
  w: number;
  h: number;
  /** Optional one-line hint, e.g. "Landscape · TV, YouTube". */
  hint?: string;
}

interface AspectRatioPickerProps {
  label?: string;
  options: readonly AspectOption[];
  value: string;
  onChange: (id: string) => void;
}

// Longest side of the drawn rectangle, in px. The short side scales down.
const MAX = 26;

export default function AspectRatioPicker({
  label = "Aspect ratio",
  options,
  value,
  onChange,
}: AspectRatioPickerProps) {
  return (
    <div>
      <p className="eyebrow mb-2.5">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const active = opt.id === value;
          const landscape = opt.w >= opt.h;
          const rectW = landscape ? MAX : Math.round(MAX * (opt.w / opt.h));
          const rectH = landscape ? Math.round(MAX * (opt.h / opt.w)) : MAX;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              aria-pressed={active}
              className={`group relative flex flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3.5 transition-all duration-300 ${
                active
                  ? "border-accent bg-surface shadow-[0_0_24px_-10px_rgba(26,115,232,0.45)]"
                  : "border-line bg-background hover:border-line-2 hover:bg-surface"
              }`}
            >
              {active && (
                <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-white">
                  <Check size={9} strokeWidth={3} />
                </span>
              )}
              {/* The actual shape, drawn to scale */}
              <span className="flex h-7 items-center justify-center">
                <span
                  style={{ width: rectW, height: rectH }}
                  className={`rounded-[3px] border-2 transition-colors ${
                    active ? "border-accent" : "border-line-2 group-hover:border-line-2"
                  }`}
                />
              </span>
              <span
                className={`text-[11px] font-semibold tracking-tight transition-colors ${
                  active ? "text-foreground" : "text-ink-3 group-hover:text-foreground"
                }`}
              >
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
