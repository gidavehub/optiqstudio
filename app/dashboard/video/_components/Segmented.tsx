"use client";

import React from "react";

export default function Segmented<T extends string | number>({
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
      <div className="grid grid-flow-col gap-1 rounded-lg bg-[#0c0c0e] p-1 border border-neutral-900">
        {options.map((opt) => (
          <button
            key={String(opt)}
            onClick={() => onChange(opt)}
            className={`rounded-md px-2 py-1.5 text-xs transition-all border ${
              value === opt
                ? "bg-[#0c152d] border-blue-500 text-white"
                : "border-transparent text-neutral-500 hover:text-neutral-200"
            }`}
          >
            {render ? render(opt) : String(opt)}
          </button>
        ))}
      </div>
    </div>
  );
}
