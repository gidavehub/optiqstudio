"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AspectRatioPicker from "../../_shared/AspectRatioPicker";
import { IMAGE_ASPECTS } from "../../_shared/aspectOptions";

interface ImageSettingsRailProps {
  aspectRatio: string;
  setAspectRatio: (v: string) => void;
}

export default function SettingsRail({ aspectRatio, setAspectRatio }: ImageSettingsRailProps) {
  return (
    <aside className="hidden w-full shrink-0 space-y-7 overflow-y-auto border-b border-neutral-900 bg-background p-5 sm:block sm:w-64 sm:border-b-0 sm:border-r sm:pt-24">
      <Link
        href="/dashboard"
        className="group flex w-fit items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-neutral-500 transition-colors hover:text-white"
      >
        <ArrowLeft size={12} className="transition-transform group-hover:-translate-x-0.5" />
        Back
      </Link>

      <AspectRatioPicker options={IMAGE_ASPECTS} value={aspectRatio} onChange={setAspectRatio} />
    </aside>
  );
}
