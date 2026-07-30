// The DaveLabs Horizon Summer '26 broadcast, cut into its published pieces.
//
// One map so a re-upload or a swapped cut is a single-line change here rather
// than a hunt through every article, product page and landing section.
//
// Titles are the published YouTube titles — they're what goes into the
// VideoObject JSON-LD, so they should match what the video is actually called.

export const VIDEOS = {
  fullBroadcast: {
    id: "gkI3M8lN7K8",
    title:
      "DaveLabs Horizon Summer ’26 | Official Full Event Broadcast (Amaka AI & Optiq Studio)",
  },
  amakaKeynote: {
    id: "VtCmg18ZzK8",
    title:
      "Unveiling Amaka AI | Official Presentation & Live Demo (DaveLabs Horizon Summer ’26)",
  },
  amakaDemo: {
    id: "bgU2MgHat9Q",
    title: "Amaka AI Live Demo | The Visual Reasoning Engine for Education",
  },
  optiqKeynote: {
    id: "4rGdc3ZYMes",
    title:
      "Optiq Studio $5 Video Ads | Official Presentation & Launch Trailer (Horizon Summer ’26)",
  },
  optiqTrailer: {
    id: "2B0EzgMiU8k",
    title:
      "Optiq Studio Official Trailer | Generate Studio-Quality Commercial Ads in Seconds",
  },
  enterpriseKeynote: {
    id: "KpHQvjVlJwU",
    title:
      "Optiq Studio Enterprise | Official Presentation & Performance Campaign Engine",
  },
} as const;

export type VideoKey = keyof typeof VIDEOS;
