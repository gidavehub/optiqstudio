"use client";

// AspectRatioStrip — the compact, horizontally-scrolling cousin of
// AspectRatioPicker, for the docked mobile control bars. Same drawn-shape
// affordance (wide = landscape, tall = portrait), sized down to a thumb strip.

import React from "react";
import type { AspectOption } from "./AspectRatioPicker";

const MAX = 15;

export default function AspectRatioStrip({
  options,
  value,
  onChange,
}: {
  options: readonly AspectOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
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
            className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 transition-colors ${
              active ? "border-blue-500 bg-[#0c152d]" : "border-neutral-800 bg-[#07090f]"
            }`}
          >
            <span className="flex h-4 w-4 items-center justify-center">
              <span
                style={{ width: rectW, height: rectH }}
                className={`rounded-[2px] border ${active ? "border-blue-400" : "border-neutral-500"}`}
              />
            </span>
            <span className={`text-[11px] font-semibold ${active ? "text-white" : "text-neutral-400"}`}>
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
