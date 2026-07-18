// Shared types + static data for the storyboard editor flow.
// Extracted from the former monolithic dashboard/page.tsx so the provider and
// each stage view can import them without duplication.

export interface Scene {
  sceneNumber: number;
  setting: string;
  action: string;
  dialogue: string;
  sound: string;
  fullPrompt: string;
}

export interface CharacterLock {
  name: string;
  description: string;
  wardrobe: string;
}

export interface Storyboard {
  title: string;
  concept: string;
  characterLock: CharacterLock;
  styleHeader: string;
  scenes: Scene[];
}

export type SceneStatus = "idle" | "rendering" | "succeeded" | "failed";

export interface VideoStatusEntry {
  id?: string;
  status: SceneStatus;
  url?: string;
  error?: string;
  revisionInput?: string;
  revising?: boolean;
  editingPrompt?: boolean;
  customPrompt?: string;
}

export type VideoStatusMap = Record<number, VideoStatusEntry>;

export interface TimelineItem {
  sceneIndex: number;
  videoUrl: string;
  trimStart: number;
  trimEnd: number;
  volume: number;
}

export type ProjectLength = "30s" | "60s" | "90s";
export type ProductionMode = "manual" | "auto-merge" | null;
export type DashboardView = "home" | "wizard" | "storyboard";

export interface BrandMaterial {
  name: string;
  data: string;
}

export interface StoryboardTemplate {
  name: string;
  subtitle: string;
  concept: string;
  brandName: string;
  product: string;
  hasCharacter: boolean;
  characterName: string;
  characterDesc: string;
  coverVideo: string;
}

export const STORYBOARD_TEMPLATES: StoryboardTemplate[] = [
  {
    name: "Traditional Welcoming Feast",
    subtitle: "Organic & Earthy Vibe",
    concept:
      "An earthy, heartwarming commercial script. Inside a beautiful traditional family compound at sunset, hosts prepare a welcoming meal for visiting in-laws, grinding fresh regional ingredients and slow-cooking a rich, steaming groundnut sauce over open embers.",
    brandName: "Local Harvest",
    product: "Organic Groundnut Sauce",
    hasCharacter: true,
    characterName: "Nyima",
    characterDesc: "An elegant, hardworking Gambian woman, neat thin cornrow braids, 20s",
    coverVideo: "/media/template-1.mp4",
  },
  {
    name: "Childhood Kitchen Discovery",
    subtitle: "Warm & Cozy Vibe",
    concept:
      "A warm, nostalgia-rich commercial. A young boy comes home, searches kitchen cupboards for a quick after-school snack, and happily discovers a fresh jar of premium spread, spreading it generously on local warm crusty bread with a huge smile.",
    brandName: "Sweet Morning",
    product: "Creamy Nut Butter",
    hasCharacter: true,
    characterName: "Alieu",
    characterDesc: "A cheerful 8-year-old Gambian boy, school uniform, bright smile",
    coverVideo: "/media/template-2.mp4",
  },
  {
    name: "Fast-Paced Urban Commerce",
    subtitle: "Modern & Dynamic Vibe",
    concept:
      "A high-octane, rhythm-driven commercial tracking active urban merchants, shopkeepers, and busy tailors managing fast-moving phone transactions and ledger operations in bustling city markets.",
    brandName: "Metro Pay",
    product: "Sleek Ledger App",
    hasCharacter: false,
    characterName: "",
    characterDesc: "",
    coverVideo: "/media/template-3.mp4",
  },
  {
    name: "Empowering Community Journey",
    subtitle: "Inspirational Vibe",
    concept:
      "An inspiring, narrative-driven commercial showing an entrepreneur's journey at dawn—supplying merchants, coordinating/loading trucks, and connecting with distant family members over a secure network.",
    brandName: "Reach Mobile",
    product: "Local Mobile Network",
    hasCharacter: true,
    characterName: "Nyima",
    characterDesc: "A proactive, tech-savvy Gambian female entrepreneur in her late 20s",
    coverVideo: "/media/template-4.mp4",
  },
  {
    name: "High-Energy Matchday Victory",
    subtitle: "Exciting & Electric Vibe",
    concept:
      "An electric, high-energy commercial capturing the raw excitement of friends in a local parlor celebrating a dramatic football goal together, cheering with high-fives under glowing neon lights.",
    brandName: "Winner Sports",
    product: "Sports App",
    hasCharacter: false,
    characterName: "",
    characterDesc: "",
    coverVideo: "/media/template-5.mp4",
  },
  {
    name: "High-Fashion Street Editorial",
    subtitle: "Sleek & Chic Vibe",
    concept:
      "A sleek, editorial commercial script. A confident young model walking down a sun-drenched, palm-lined street in warm summer knitwear, catching natural golden hour highlights as the camera tracks smoothly.",
    brandName: "Aura Wear",
    product: "Summer Knitwear Line",
    hasCharacter: true,
    characterName: "Fatou",
    characterDesc: "A striking, confident young Gambian model, natural afro, sharp cheekbones",
    coverVideo: "/media/template-6.mp4",
  },
  {
    name: "Sleek Lab Innovation",
    subtitle: "Futuristic & Tech Vibe",
    concept:
      "A crisp, high-tech commercial sequence. An engineer adjusting a precision robotic arm inside a modern research studio, bathed in glowing cyan indicators and clean rim lighting.",
    brandName: "Apex Systems",
    product: "AI Precision Robotic Arm",
    hasCharacter: false,
    characterName: "",
    characterDesc: "",
    coverVideo: "/media/template-7.mp4",
  },
  {
    name: "Cozy Childhood Playroom",
    subtitle: "Dreamy & Playful Vibe",
    concept:
      "A soft, dreamlike commercial sequence. Warm wooden toys and handcrafted plush blocks resting on vibrant traditional patterned rugs inside a cozy sunlit room, basking in a warm amber glow.",
    brandName: "Kindred Toys",
    product: "Handcrafted Wooden Playsets",
    hasCharacter: false,
    characterName: "",
    characterDesc: "",
    coverVideo: "/media/template-8.mp4",
  },
  {
    name: "Rain-Soaked Neon Haze",
    subtitle: "Moody & Cinematic Vibe",
    concept:
      "A highly atmospheric, cinematic commercial scene. A young traveler wearing a dark rain jacket walking along a wet, glowing neon-lit city street at midnight, catching soft moody backlights through a misty haze.",
    brandName: "Vanguard Outerwear",
    product: "All-Weather Rain Jacket",
    hasCharacter: true,
    characterName: "Ebrima",
    characterDesc: "A tall, contemplative Gambian man, hooded rain jacket, 20s",
    coverVideo: "/media/template-9.mp4",
  },
  {
    name: "Coastal Beach Boardwalk",
    subtitle: "Candid & Documentary Vibe",
    concept:
      "A refreshing, documentary-style commercial script. Friends sharing broad laughter on a bright beach boardwalk at midday, with seabirds gliding through the deep blue sky, bathed in highly natural sunlit exposures.",
    brandName: "Sanyang Sun",
    product: "Polarized Sunglasses",
    hasCharacter: false,
    characterName: "",
    characterDesc: "",
    coverVideo: "/media/template-10.mp4",
  },
  {
    name: "Winter Forest Expedition",
    subtitle: "Adventure & Cinematic Vibe",
    concept:
      "A dramatic, high-contrast adventure commercial. Two intrepid explorers equipped with rugged backpacks stepping through a rustic cabin doorway into a silent, snow-covered pine forest under crisp blue twilight.",
    brandName: "Summit Gear",
    product: "Extreme Weather Parkas",
    hasCharacter: false,
    characterName: "",
    characterDesc: "",
    coverVideo: "/media/template-11.mp4",
  },
];
