"use client";

import React from "react";
import AspectRatioPicker from "../../_shared/AspectRatioPicker";
import { IMAGE_ASPECTS } from "../../_shared/aspectOptions";

interface ImageSettingsRailProps {
  aspectRatio: string;
  setAspectRatio: (v: string) => void;
}

export default function SettingsRail({ aspectRatio, setAspectRatio }: ImageSettingsRailProps) {
  return (
    <aside className="hidden w-full shrink-0 space-y-7 overflow-y-auto border-b border-line bg-background p-5 sm:block sm:w-64 sm:border-b-0 sm:border-r sm:pt-24">

      <AspectRatioPicker options={IMAGE_ASPECTS} value={aspectRatio} onChange={setAspectRatio} />
    </aside>
  );
}
