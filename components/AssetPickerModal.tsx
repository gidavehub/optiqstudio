"use client";

import React, { useEffect, useState, useRef } from "react";
import { X, Users, Sparkles, UploadCloud, CheckCircle, Loader2 } from "lucide-react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "./AuthProvider";

interface CharacterItem {
  id: string;
  name: string;
  imageUrl?: string | null;
  voiceUrl?: string | null;
  voiceType?: string | null;
  voiceDescription?: string | null;
  imageDescription?: string | null;
}

interface AssetPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCharacter?: (c: CharacterItem) => void;
  onSelectTrait?: (trait: string) => void;
  onUploadFile?: (file: File) => void;
  allowedUploadTypes?: string;
}

const TRAITS = [
  {
    category: "Visual Styles",
    items: [
      { label: "Cinematic Still", value: "cinematic still, professional color grading, shot on anamorphic lens, shallow depth of field" },
      { label: "Hyperrealistic", value: "photorealistic, hyperrealistic 8k resolution, extreme lifelike skin texture, shot on RED camera" },
      { label: "Cyberpunk Art", value: "cyberpunk concept art, neon lit environment, futuristic street style, digital drawing" },
      { label: "Vibrant Anime", value: "modern anime illustration, sharp lines, highly detailed backgrounds, colorful cell shading" },
      { label: "3D Studio Render", value: "3D render, Pixar style character design, octane render, stylized lighting, high gloss" },
    ],
  },
  {
    category: "Dramatic Lighting",
    items: [
      { label: "Studio Softbox", value: "softbox studio lighting, three-point portrait lighting, clean dark background" },
      { label: "Volumetric Glow", value: "volumetric lighting, glowing god rays, mystical ambient fog, high contrast" },
      { label: "Neon Cyberpunk", value: "neon-colored highlights, blue and fuchsia backlighting, high-contrast city reflections" },
      { label: "Chiaroscuro", value: "dramatic chiaroscuro lighting, deep shadows, single warm candle light source" },
    ],
  },
  {
    category: "Mood & Vibes",
    items: [
      { label: "Neo-Noir Mystery", value: "moody neo-noir ambiance, mysterious shadows, dark detective atmosphere" },
      { label: "Nostalgic Analog", value: "vintage film grain, faded warm tones, nostalgic retro aesthetic, Polaroid border style" },
      { label: "Epic Adventure", value: "heroic action posture, epic scale atmosphere, wide angle horizon, dust particles" },
      { label: "Ethereal Dream", value: "ethereal dreamlike quality, soft pastel focus, pastel colors, magical sparkles" },
    ],
  },
  {
    category: "Aesthetics & Attire",
    items: [
      { label: "Street Techwear", value: "wearing futuristic techwear outfit, cargo straps, high-tech reflective details" },
      { label: "Vintage Leather", value: "wearing a worn-out vintage brown leather pilot jacket, metal zippers" },
      { label: "Royal Attire", value: "wearing elegant high-collar velvet noble robe, intricate gold embroidery" },
      { label: "Steampunk Gear", value: "steampunk design details, wearing brass goggles, complex clockwork gears and leather vest" },
    ],
  },
];

export default function AssetPickerModal({
  isOpen,
  onClose,
  onSelectCharacter,
  onSelectTrait,
  onUploadFile,
  allowedUploadTypes = "image/*,audio/*,video/*",
}: AssetPickerModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"characters" | "traits" | "upload">("characters");
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [loadingChars, setLoadingCharacters] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load characters directly from Firestore
  useEffect(() => {
    if (!isOpen || !user) return;
    Promise.resolve().then(() => setLoadingCharacters(true));
    const q = query(collection(db, "characters"), where("uid", "==", user.uid));
    getDocs(q)
      .then((snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as CharacterItem[];
        setCharacters(list);
      })
      .catch((err) => console.error("Error fetching characters for picker:", err))
      .finally(() => setLoadingCharacters(false));
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setUploadedFile(file);
      if (onUploadFile) onUploadFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFile(file);
      if (onUploadFile) onUploadFile(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-neutral-900 bg-[#070708] shadow-2xl animate-rise">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-900 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600/10 text-violet-400">
              <Sparkles size={14} />
            </div>
            <h3 className="text-sm font-bold font-mono text-white tracking-widest uppercase">
              STUDIO ASSET COMPOSER
            </h3>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-neutral-500 hover:bg-white/5 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-900 bg-neutral-950/40 px-6 py-2 gap-2">
          {onSelectCharacter && (
            <button
              onClick={() => setActiveTab("characters")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "characters" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white"
              }`}
            >
              Character Cast
            </button>
          )}
          {onSelectTrait && (
            <button
              onClick={() => setActiveTab("traits")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "traits" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white"
              }`}
            >
              Style Modifiers
            </button>
          )}
          {onUploadFile && (
            <button
              onClick={() => setActiveTab("upload")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "upload" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white"
              }`}
            >
              Quick Upload
            </button>
          )}
        </div>

        {/* Content Viewports */}
        <div className="p-6 max-h-[380px] overflow-y-auto">
          
          {/* Tab 1: Characters Grid */}
          {activeTab === "characters" && (
            <div>
              {loadingChars ? (
                <div className="flex flex-col items-center justify-center py-12 text-neutral-500 gap-3">
                  <Loader2 size={20} className="animate-spin text-violet-500" />
                  <p className="text-xs font-mono">Loading character database...</p>
                </div>
              ) : characters.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-neutral-500 border border-dashed border-neutral-900 rounded-xl bg-neutral-950/20">
                  <Users size={24} className="text-neutral-700 mb-2" />
                  <p className="text-xs font-bold text-neutral-400">Your cast is empty</p>
                  <p className="text-[10px] text-neutral-600 mt-1 max-w-sm">
                    Go to the <strong>Characters</strong> section from the main sidebar to create and customize your consistent actors.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {characters.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        if (onSelectCharacter) onSelectCharacter(c);
                        onClose();
                      }}
                      className="group flex items-center gap-3 rounded-xl border border-neutral-900 bg-neutral-950 p-2.5 text-left transition-all hover:border-violet-500/40 hover:bg-neutral-900/60"
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-neutral-900 border border-white/5 relative">
                        {c.imageUrl ? (
                          <img src={c.imageUrl} alt={c.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-violet-400 bg-violet-600/10">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white group-hover:text-violet-300 truncate">
                          {c.name}
                        </p>
                        <div className="flex gap-1 mt-0.5">
                          {c.imageUrl && <span className="text-[8px] bg-neutral-800 text-neutral-400 px-1 rounded-sm font-mono uppercase">Image</span>}
                          {c.voiceUrl && <span className="text-[8px] bg-neutral-800 text-neutral-400 px-1 rounded-sm font-mono uppercase">Voice</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Style Modifiers */}
          {activeTab === "traits" && (
            <div className="space-y-6">
              {TRAITS.map((group) => (
                <div key={group.category} className="space-y-2">
                  <h4 className="text-[10px] font-bold font-mono text-neutral-500 uppercase tracking-widest">
                    {group.category}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map((trait) => (
                      <button
                        key={trait.label}
                        onClick={() => {
                          if (onSelectTrait) onSelectTrait(trait.value);
                        }}
                        className="rounded-lg border border-neutral-900 bg-neutral-950 px-3 py-1.5 text-xs text-neutral-300 transition-all hover:border-violet-500/30 hover:text-white hover:bg-neutral-900 active:scale-95"
                      >
                        {trait.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 3: Quick Direct Upload */}
          {activeTab === "upload" && (
            <div className="space-y-4">
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center border border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                  dragActive
                    ? "border-violet-500 bg-violet-600/[0.04]"
                    : uploadedFile
                    ? "border-emerald-500/40 bg-emerald-500/[0.02]"
                    : "border-neutral-900 hover:border-neutral-800 bg-neutral-950/40"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept={allowedUploadTypes}
                  onChange={handleFileChange}
                  className="hidden"
                />

                {uploadedFile ? (
                  <div className="space-y-2">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                      <CheckCircle size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white truncate max-w-[280px] mx-auto">
                        {uploadedFile.name}
                      </p>
                      <p className="text-[10px] text-neutral-500 font-mono mt-0.5 uppercase">
                        {(uploadedFile.type || "unknown").split("/")[1] || "File"} · {Math.round(uploadedFile.size / 1024)} KB
                      </p>
                    </div>
                    <span className="text-[10px] text-violet-400 hover:underline inline-block font-semibold">
                      Change File
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <UploadCloud size={28} className="mx-auto text-neutral-500" />
                    <div>
                      <p className="text-xs font-bold text-neutral-300">
                        Drag and drop file or <span className="text-white hover:underline">browse</span>
                      </p>
                      <p className="text-[10px] text-neutral-600 mt-1">
                        Supports images (PNG, JPG), audio (WAV, MP3), or video files
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {uploadedFile && (
                <div className="flex justify-end gap-2 pt-2 border-t border-neutral-900/60">
                  <button
                    onClick={() => {
                      setUploadedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="rounded-lg border border-neutral-900 bg-transparent px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={onClose}
                    className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-black hover:bg-neutral-200 transition-colors"
                  >
                    Confirm Attachment
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer info guide */}
        <div className="border-t border-neutral-900 bg-neutral-950/20 px-6 py-4 text-[10px] text-neutral-500 leading-normal font-sans flex items-center justify-between">
          <span>Clicking traits or characters directly appends styling and identities to your active prompt context.</span>
        </div>

      </div>
    </div>
  );
}
