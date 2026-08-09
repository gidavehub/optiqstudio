// The one list of studios. The island reads it, so adding a studio is a line
// here rather than an edit in four files that then drift apart.

import type { NavItem } from "./types";

export const STUDIO_NAV: readonly NavItem[] = [
  { id: "video", label: "Video", icon: "video", href: "/dashboard/video" },
  { id: "image", label: "Image", icon: "image", href: "/dashboard/image" },
  { id: "voice", label: "Voice", icon: "voice", href: "/dashboard/voice" },
  { id: "music", label: "Music", icon: "music", href: "/dashboard/music" },
];

/** Routes that own the floating island and must suppress the old chrome pills. */
export const SHELL_ROUTES = [
  "/dashboard/video",
  "/dashboard/image",
  "/dashboard/voice",
  "/dashboard/music",
];
