"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ImagePlus,
  Loader2,
  UploadCloud,
  Users,
  Wand2,
  X,
  Play,
  Pause,
  Trash2,
  ArrowLeft,
  Plus,
  Volume2,
  CheckCircle,
  Mic,
  FileAudio
} from "lucide-react";
import { useAuth } from "../../../components/AuthProvider";
import { db, storage } from "../../../lib/firebase";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  deleteDoc
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

interface Character {
  id: string;
  uid: string;
  name: string;
  imageUrl: string | null;
  voiceUrl: string | null;
  voiceType: "prebuilt" | "cloned" | "uploaded" | "described" | "synthesize" | "clone" | "upload" | null;
  voiceDescription: string | null;
  imageDescription: string | null;
  createdAt: string;
}

const VOICES = [
  { id: "Kore", label: "Awa (Wolof)", vibe: "Soft, warm female Wolof speaker" },
  { id: "Charon", label: "Moussa (Wolof)", vibe: "Deep, resonant male Wolof speaker" },
  { id: "Leda", label: "Fatou (Mandinka)", vibe: "Bright, youthful female Mandinka speaker" },
  { id: "Fenrir", label: "Lamin (Mandinka)", vibe: "Gravelly, strong male Mandinka speaker" },
  { id: "Aoede", label: "Chioma (Igbo)", vibe: "Melodic, expressive female Igbo speaker" },
  { id: "Orus", label: "Chinedu (Igbo)", vibe: "Authoritative, firm male Igbo speaker" },
  { id: "Puck", label: "Efe (Nigerian English)", vibe: "Energetic, clear female English speaker" },
  { id: "Enceladus", label: "Kofi (African-British)", vibe: "Contemplative, British-African male accent" },
];

export default function CharacterStudio() {
  const { user, apiFetch, pricing, refreshProfile } = useAuth();
  
  // View states: 'list' or 'editor'
  const [view, setView] = useState<"list" | "editor">("list");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loadingCast, setLoadingCast] = useState(false);

  // Editor Character States
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [imageDescription, setImageDescription] = useState("");
  const [voiceDescription, setVoiceDescription] = useState("");
  
  // Image creation states (generated or direct upload)
  const [imageMode, setImageMode] = useState<"generate" | "upload">("generate");
  const [uploadedImage, setUploadedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  
  // Consistency image reference states for generating character
  const [imageReference, setImageReference] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const [isDraggingImageRef, setIsDraggingImageRef] = useState(false);
  const dragCounterImageRef = useRef(0);

  // Voice creation states (synthesized prebuilt, cloned or direct upload)
  const [voiceMode, setVoiceMode] = useState<"synthesize" | "clone" | "upload">("synthesize");
  const [voiceProfile, setVoiceProfile] = useState("Kore");
  const [voiceStyle, setVoiceProfileStyle] = useState("");
  const [voiceUploadFile, setVoiceUploadFile] = useState<File | null>(null);
  const [voiceSamplePreview, setVoiceSamplePreview] = useState<string | null>(null);
  const [cloningAudioSample, setCloningAudioSample] = useState<{ base64: string; mimeType: string; name: string } | null>(null);
  const [isDraggingVoiceSample, setIsDraggingVoiceSample] = useState(false);
  const dragCounterVoiceSample = useRef(0);

  // Output generated results preview
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generatedVoiceUrl, setGeneratedVoiceUrl] = useState<string | null>(null);

  // Operational states
  const [busy, setBusy] = useState(false);
  const [operationMsg, setBusyMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Audio playing states for cast list cards
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioPlayersRef = useRef<{ [key: string]: HTMLAudioElement }>({});

  const imageCost = pricing?.costs?.characterSheet ?? 150;
  const ttsCost = 15; // standard minimised tts fee
  const cloneCost = 30; // standard voice cloning fee

  // 1. Fetch entire Character Cast from Firestore
  const loadCast = useCallback(async () => {
    if (!user) return;
    setLoadingCast(true);
    setError(null);
    try {
      const q = query(collection(db, "characters"), where("uid", "==", user.uid));
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Character[];
      
      // Sort newest first
      items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setCharacters(items);
    } catch (err) {
      console.error("Failed to load cast from Firestore:", err);
      setError("Failed to load your character list.");
    } finally {
      setLoadingCast(false);
    }
  }, [user]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadCast();
    });
  }, [loadCast]);

  // Clean up playing audio elements on unmount
  useEffect(() => {
    const currentPlayers = audioPlayersRef.current;
    return () => {
      Object.values(currentPlayers).forEach((p) => {
        p.pause();
      });
    };
  }, []);

  // 2. Play/Pause voice clip in cast view
  const togglePlayVoice = (id: string, url: string) => {
    if (playingId === id) {
      audioPlayersRef.current[id]?.pause();
      setPlayingId(null);
    } else {
      // Pause currently playing if any
      if (playingId && audioPlayersRef.current[playingId]) {
        audioPlayersRef.current[playingId].pause();
      }
      
      if (!audioPlayersRef.current[id]) {
        const audio = new Audio(url);
        audio.onended = () => setPlayingId(null);
        audioPlayersRef.current[id] = audio;
      }
      
      audioPlayersRef.current[id].currentTime = 0;
      audioPlayersRef.current[id].play()
        .then(() => setPlayingId(id))
        .catch(() => setError("Failed to play character voice clip"));
    }
  };

  // 3. Delete character
  const handleDeleteCharacter = async (charId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to retire this character from your cast?")) return;
    try {
      if (playingId === charId) {
        audioPlayersRef.current[charId]?.pause();
        setPlayingId(null);
      }
      await deleteDoc(doc(db, "characters", charId));
      setCharacters((prev) => prev.filter((c) => c.id !== charId));
    } catch {
      setError("Failed to delete character");
    }
  };

  // 4. Open character editor/creation mode
  const openEditor = (c?: Character) => {
    setError(null);
    if (c) {
      // Edit existing
      setEditId(c.id);
      setName(c.name);
      setImageDescription(c.imageDescription || "");
      setVoiceDescription(c.voiceDescription || "");
      setImagePreviewUrl(c.imageUrl);
      setGeneratedImageUrl(c.imageUrl);
      setGeneratedVoiceUrl(c.voiceUrl);
      
      if (c.voiceType === "cloned") {
        setVoiceMode("clone");
      } else if (c.voiceType === "uploaded") {
        setVoiceMode("upload");
      } else {
        setVoiceMode("synthesize");
      }
    } else {
      // New creation
      setEditId(null);
      setName("");
      setImageDescription("");
      setVoiceDescription("");
      setImagePreviewUrl(null);
      setUploadedFile(null);
      setGeneratedImageUrl(null);
      setGeneratedVoiceUrl(null);
      setImageReference(null);
      setVoiceUploadFile(null);
      setVoiceSamplePreview(null);
      setCloningAudioSample(null);
      setImageMode("generate");
      setVoiceMode("synthesize");
    }
    setView("editor");
  };

  // Drag and drop logic for image consistency reference
  const handleDragImageRef = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterImageRef.current++;
    if (dragCounterImageRef.current === 1) setIsDraggingImageRef(true);
  };

  const handleLeaveImageRef = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterImageRef.current--;
    if (dragCounterImageRef.current === 0) setIsDraggingImageRef(false);
  };

  const handleDropImageRef = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterImageRef.current = 0;
    setIsDraggingImageRef(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      attachImageRef(file);
    }
  };

  const attachImageRef = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImageReference({ base64: dataUrl.split(",")[1], mimeType: file.type, preview: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  // Direct portrait image uploading
  const handleDirectImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setUploadedFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setGeneratedImageUrl(null); // Direct upload takes precedence
    }
  };

  // Voice sample for Cloning drag and drop
  const handleDragVoiceSample = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterVoiceSample.current++;
    if (dragCounterVoiceSample.current === 1) setIsDraggingVoiceSample(true);
  };

  const handleLeaveVoiceSample = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterVoiceSample.current--;
    if (dragCounterVoiceSample.current === 0) setIsDraggingVoiceSample(false);
  };

  const handleDropVoiceSample = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterVoiceSample.current = 0;
    setIsDraggingVoiceSample(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith("audio/") || file.name.endsWith(".wav") || file.name.endsWith(".mp3"))) {
      attachVoiceSample(file);
    }
  };

  const attachVoiceSample = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setCloningAudioSample({ base64: dataUrl.split(",")[1], mimeType: file.type, name: file.name });
    };
    reader.readAsDataURL(file);
  };

  const handleDirectVoiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVoiceUploadFile(file);
      setVoiceSamplePreview(URL.createObjectURL(file));
      setGeneratedVoiceUrl(null); // Direct upload takes precedence
    }
  };

  // 5. Generate Portrait Image using Vertex AI Imagen model
  const generatePortrait = async () => {
    if (!imageDescription.trim() || busy) return;
    setBusy(true);
    setBusyMessage("Dreaming on Vertex AI...");
    setError(null);
    try {
      const promptText = imageReference
        ? `Keep this exact character's identity, face and styling perfectly consistent. ${imageDescription}`
        : `Character design sheet, single subject, studio lighting, photorealistic detail. ${imageDescription}`;

      const res = await apiFetch<{ url: string }>("/api/image/generate", {
        method: "POST",
        body: JSON.stringify({
          prompt: promptText,
          purpose: "character",
          referenceImages: imageReference
            ? [{ base64: imageReference.base64, mimeType: imageReference.mimeType }]
            : undefined,
          aspectRatio: "3:4",
        }),
      });

      setGeneratedImageUrl(res.url);
      setImagePreviewUrl(res.url);
      setUploadedFile(null); // generated takes precedence over pre-selected local file
      void refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portrait generation failed");
    } finally {
      setBusy(false);
    }
  };

  // 6. Synthesize or Clone Voice
  const generateVoice = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);

    const speakScript = voiceDescription.trim() || `Hello, I am ${name || "your custom character"}. My voice profile is fully synthesized and initialized on Optiq Studio.`;

    if (voiceMode === "clone") {
      if (!cloningAudioSample) {
        setError("Please attach a 6-15s voice sample for cloning first.");
        setBusy(false);
        return;
      }
      setBusyMessage("Cloning custom voice with GPU worker...");
      try {
        const res = await apiFetch<{ id: string; status: string }>("/api/voice/generate", {
          method: "POST",
          body: JSON.stringify({
            text: speakScript,
            voiceBase64: cloningAudioSample.base64,
            voiceMimeType: cloningAudioSample.mimeType,
          }),
        });

        // Background polling for voice cloning status
        pollVoiceCloningStatus(res.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Voice cloning failed");
        setBusy(false);
      }
    } else {
      setBusyMessage("Synthesizing prebuilt localized voice...");
      try {
        const res = await apiFetch<{ url: string }>("/api/voice/generate", {
          method: "POST",
          body: JSON.stringify({
            text: speakScript,
            voice: voiceProfile,
            style: voiceStyle || undefined,
          }),
        });
        setGeneratedVoiceUrl(res.url);
        void refreshProfile();
        setBusy(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Voice synthesis failed");
        setBusy(false);
      }
    }
  };

  const pollVoiceCloningStatus = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const status = await apiFetch<{
          status: string;
          audioUrl?: string;
          error?: string;
        }>(`/api/video/status?id=${jobId}`);

        if (status.status === "succeeded" && status.audioUrl) {
          clearInterval(interval);
          setGeneratedVoiceUrl(status.audioUrl);
          void refreshProfile();
          setBusy(false);
        } else if (status.status === "failed") {
          clearInterval(interval);
          setError(status.error || "Voice cloning failed on GPU cluster");
          setBusy(false);
        }
      } catch {
        // ignore glitches
      }
    }, 4000);
  };

  // 7. Save complete Character Profile to Firestore
  const handleSaveCharacter = async () => {
    if (!user) {
      setError("You must be logged in to save characters.");
      return;
    }
    if (!name.trim()) {
      setError("A character name is required to establish their profile");
      return;
    }
    setBusy(true);
    setBusyMessage("Saving character profile card...");
    setError(null);

    try {
      const charId = editId || `char_${Date.now()}`;
      let finalImageUrl = generatedImageUrl;
      let finalVoiceUrl = generatedVoiceUrl;

      // Direct local file uploads to Firebase Storage
      if (imageMode === "upload" && uploadedImage) {
        setBusyMessage("Uploading avatar portrait to Cloud Storage...");
        const imgRef = ref(storage, `characters/${user.uid}/${charId}_avatar.png`);
        const result = await uploadBytes(imgRef, uploadedImage);
        finalImageUrl = await getDownloadURL(result.ref);
      }

      if (voiceMode === "upload" && voiceUploadFile) {
        setBusyMessage("Uploading voice clip to Cloud Storage...");
        const soundRef = ref(storage, `characters/${user.uid}/${charId}_voice.wav`);
        const result = await uploadBytes(soundRef, voiceUploadFile);
        finalVoiceUrl = await getDownloadURL(result.ref);
      }

      const characterDoc: Character = {
        id: charId,
        uid: user.uid,
        name,
        imageUrl: finalImageUrl,
        voiceUrl: finalVoiceUrl,
        voiceType: voiceMode,
        voiceDescription: voiceDescription.trim() || null,
        imageDescription: imageDescription.trim() || null,
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "characters", charId), characterDoc);
      setView("list");
      loadCast();
    } catch (err) {
      console.error("Save failed:", err);
      setError("Failed to compile and save character profile card.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-black text-white">
      <div className="mx-auto max-w-5xl px-8 py-10">
        
        {/* VIEW 1: GRID CAST LIST */}
        {view === "list" ? (
          <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-900">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-800 text-neutral-300 border border-neutral-700">
                    <Users size={15} />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-widest block">
                    OPTICS CAST
                  </span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white mt-1">Character Studio</h1>
                <p className="text-xs text-neutral-500 mt-1 max-w-2xl leading-relaxed">
                  Design unique actors with permanent traits and voices. Inject them on-the-fly across image, voice, and video generator workspaces.
                </p>
              </div>

              <button
                onClick={() => openEditor()}
                className="flex items-center gap-2 self-start rounded-full bg-white px-5 py-2.5 text-xs font-bold text-black hover:bg-neutral-200 transition-all shadow-md active:scale-95 shrink-0"
              >
                <Plus size={14} /> Define Character
              </button>
            </div>

            {loadingCast ? (
              <div className="flex flex-col items-center justify-center py-20 text-neutral-500 gap-3">
                <Loader2 size={24} className="animate-spin text-white" />
                <p className="text-xs font-mono">Synchronizing cast list with cloud ledger...</p>
              </div>
            ) : characters.length === 0 ? (
              /* Premium Empty State card */
              <div className="relative rounded-2xl border border-neutral-900 bg-neutral-950/40 p-12 text-center overflow-hidden flex flex-col items-center justify-center min-h-[350px]">
                <div className="absolute inset-0 bg-gradient-to-b from-neutral-600/[0.03] to-transparent pointer-events-none" />
                
                {/* Glowing neon halo behind vector */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-neutral-600/5 blur-[80px] pointer-events-none rounded-full" />

                <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-900 border border-white/5 text-neutral-300 mb-4 shadow-xl">
                  <Users size={24} />
                </div>
                
                <h3 className="relative z-10 text-sm font-bold font-mono uppercase tracking-widest text-white">
                  Your Cast is Empty
                </h3>
                <p className="relative z-10 text-xs text-neutral-500 mt-2 max-w-sm leading-relaxed">
                  Establish custom actors with consistent faces and synthesized voiceover profiles to maintain cohesive identities across story generation scenes.
                </p>
                <button
                  onClick={() => openEditor()}
                  className="relative z-10 mt-6 flex items-center gap-2 rounded-full bg-white hover:bg-neutral-200 px-6 py-2.5 text-xs font-bold text-black transition-all shadow-lg"
                >
                  <Plus size={14} /> Create Your First Character
                </button>
              </div>
            ) : (
              /* Rich Card Grid */
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {characters.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => openEditor(c)}
                    className="group relative rounded-2xl border border-neutral-900 bg-neutral-950/40 hover:border-neutral-800 transition-all cursor-pointer flex flex-col overflow-hidden select-none hover:shadow-2xl hover:shadow-neutral-600/[0.02]"
                  >
                    {/* Media viewport container */}
                    <div className="aspect-[3/4] w-full bg-neutral-950 relative overflow-hidden shrink-0 border-b border-neutral-900/60">
                      {c.imageUrl ? (
                        <img
                          src={c.imageUrl}
                          alt={c.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-xs font-bold bg-neutral-800 text-neutral-400">
                          <Users size={32} className="opacity-30 mb-2" />
                          No Portrait
                        </div>
                      )}

                      {/* Attribute badging */}
                      <div className="absolute top-2 left-2 flex gap-1 z-10">
                        {c.imageUrl && (
                          <span className="text-[8px] font-bold font-mono tracking-wider bg-black/60 backdrop-blur text-neutral-300 px-1.5 py-0.5 rounded uppercase">
                            Appearance
                          </span>
                        )}
                        {c.voiceUrl && (
                          <span className="text-[8px] font-bold font-mono tracking-wider bg-black/60 backdrop-blur text-neutral-300 border border-neutral-800 px-1.5 py-0.5 rounded uppercase">
                            Voice
                          </span>
                        )}
                      </div>

                      {/* Play-voice overlay button */}
                      {c.voiceUrl && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePlayVoice(c.id, c.voiceUrl!);
                          }}
                          className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-black hover:bg-neutral-200 hover:text-black transition-all shadow-md hover:scale-110 active:scale-90 z-20"
                          title="Monitor synthesized voiceover"
                        >
                          {playingId === c.id ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="ml-0.5" />}
                        </button>
                      )}

                      {/* Hover Overlay Delete */}
                      <button
                        onClick={(e) => handleDeleteCharacter(c.id, e)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-lg bg-black/70 hover:bg-red-950 border border-white/5 text-neutral-400 hover:text-red-400 transition-all z-20"
                        title="Retire Character"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {/* Metadata summary */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between">
                      <div>
                        <p className="text-xs font-bold text-white group-hover:text-neutral-300 transition-colors truncate">
                          {c.name}
                        </p>
                        {c.imageDescription && (
                          <p className="text-[10px] text-neutral-500 mt-1 line-clamp-2 leading-relaxed">
                            {c.imageDescription}
                          </p>
                        )}
                      </div>
                      <div className="border-t border-neutral-900/60 pt-2.5 mt-2.5 flex items-center justify-between text-[8px] text-neutral-500 font-mono uppercase tracking-wider">
                        <span>CREATED</span>
                        <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* VIEW 2: EDITOR CREATOR SUITE */
          <div className="space-y-8 animate-rise">
            {/* Header / Nav Back */}
            <div className="pb-6 border-b border-neutral-900 flex items-center justify-between">
              <button
                onClick={() => setView("list")}
                disabled={busy}
                className="flex items-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-white transition-colors disabled:opacity-40"
              >
                <ArrowLeft size={14} /> Back to Cast
              </button>
              
              <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest font-bold">
                {editId ? "REFINING CHARACTER PROFILE" : "DESIGNING NEW CHARACTER"}
              </div>
            </div>

            {/* Slick Cool Borderless Title Field */}
            <div className="py-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Character Name"
                disabled={busy}
                className="w-full bg-transparent border-0 border-b border-transparent focus:border-neutral-900 py-2 text-3xl font-bold tracking-tight text-white placeholder:text-neutral-800 focus:ring-0 focus:outline-none transition-colors"
                style={{
                  color: name ? "white" : "rgba(115, 115, 115, 0.2)",
                  caretColor: "white"
                }}
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-950 bg-red-950/20 px-4 py-3 text-xs text-red-400 animate-rise border-red-900/40">
                {error}
              </div>
            )}

            {/* Form Panels Section */}
            <div className="grid gap-8 md:grid-cols-2 items-start">
              
              {/* Appearance Panel */}
              <div className="space-y-4 bg-surface border border-neutral-900 rounded-2xl p-5 relative">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-900/60">
                  <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest block">
                    APPEARANCE (PORTRAIT)
                  </span>
                  
                  {/* Selector Segment */}
                  <div className="flex p-0.5 rounded-lg bg-neutral-950 border border-neutral-900 shrink-0">
                    <button
                      onClick={() => setImageMode("generate")}
                      disabled={busy}
                      className={`px-2 py-1 text-[9px] font-bold uppercase rounded transition-all ${
                        imageMode === "generate" ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-white"
                      }`}
                    >
                      AI Generate
                    </button>
                    <button
                      onClick={() => setImageMode("upload")}
                      disabled={busy}
                      className={`px-2 py-1 text-[9px] font-bold uppercase rounded transition-all ${
                        imageMode === "upload" ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-white"
                      }`}
                    >
                      Direct Upload
                    </button>
                  </div>
                </div>

                {imageMode === "generate" ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block">
                        Appearance Description
                      </label>
                      <textarea
                        rows={3}
                        value={imageDescription}
                        onChange={(e) => setImageDescription(e.target.value)}
                        placeholder="Describe portrait design, e.g. 'A rugged deep-sea diver in her 50s, silver hair, glowing amber eyes, wearing worn pilot gears...'"
                        disabled={busy}
                        className="w-full resize-none text-xs rounded-xl bg-neutral-950 border border-neutral-900/80 p-3 placeholder:text-neutral-600 focus:border-white/25 focus:ring-0 focus:outline-none text-white leading-relaxed"
                      />
                    </div>

                    {/* Consistency Reference attached logic */}
                    <div
                      onDragEnter={handleDragImageRef}
                      onDragOver={(e) => e.preventDefault()}
                      onDragLeave={handleLeaveImageRef}
                      onDrop={handleDropImageRef}
                      className={`relative rounded-xl border border-dashed p-4 text-center transition-all ${
                        isDraggingImageRef
                          ? "border-white bg-white/5"
                          : imageReference
                          ? "border-neutral-800 bg-surface-2"
                          : "border-neutral-900 hover:border-neutral-800 bg-neutral-950"
                      }`}
                    >
                      {imageReference ? (
                        <div className="flex items-center gap-3 text-left">
                          <img
                            src={imageReference.preview}
                            alt="Reference"
                            className="h-10 w-10 rounded border border-white/5 object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-white truncate">Face Reference Attached</p>
                            <p className="text-[9px] text-neutral-500 font-mono mt-0.5">Slightly models features for consistency</p>
                          </div>
                          <button
                            onClick={() => setImageReference(null)}
                            className="text-neutral-400 hover:text-white cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center gap-1 cursor-pointer">
                          <ImagePlus size={18} className="text-neutral-600" />
                          <span className="text-[10px] text-neutral-500">
                            Drag consistency reference face or <span className="text-white hover:underline">browse</span>
                          </span>
                          <span className="text-[8px] text-neutral-600 font-mono">JPG, PNG · Keeps face details consistent</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => e.target.files?.[0] && attachImageRef(e.target.files[0])}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>

                    <button
                      onClick={generatePortrait}
                      disabled={busy || !imageDescription.trim()}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-bold py-2 px-4 transition-all"
                    >
                      <Wand2 size={12} className="text-neutral-300 animate-pulse" />
                      Generate Portrait Sheet ({imageCost} cr)
                    </button>
                  </div>
                ) : (
                  /* Direct Upload Portrait Image */
                  <div className="space-y-4">
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                      Upload Profile Photo
                    </p>
                    <label className="flex flex-col items-center justify-center border border-dashed border-neutral-900 bg-neutral-950 rounded-xl p-8 hover:border-neutral-800 hover:bg-neutral-950/60 transition-all cursor-pointer group text-center min-h-[160px]">
                      <UploadCloud size={24} className="text-neutral-500 group-hover:text-white mb-2 transition-colors" />
                      <span className="text-xs font-medium text-neutral-400 group-hover:text-neutral-200 transition-colors">
                        {uploadedImage ? uploadedImage.name : "Select or drag character portrait"}
                      </span>
                      <span className="text-[9px] text-neutral-600 mt-1">Supports PNG, JPG, WEBP up to 5MB</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleDirectImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {/* Live Image Preview frame inside editor */}
                {imagePreviewUrl && (
                  <div className="pt-4 border-t border-neutral-900/60 space-y-2">
                    <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block">
                      Active Portrait Preview
                    </span>
                    <div className="relative max-w-[200px] mx-auto aspect-[3/4] overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 shadow-md">
                      <img src={imagePreviewUrl} alt="Active design" className="w-full h-full object-cover" />
                    </div>
                  </div>
                )}

              </div>

              {/* Voice Panel */}
              <div className="space-y-4 bg-surface border border-neutral-900 rounded-2xl p-5">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-900/60">
                  <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest block">
                    VOICE PROFILE
                  </span>

                  {/* Mode Selector */}
                  <div className="flex p-0.5 rounded-lg bg-neutral-950 border border-neutral-900 shrink-0">
                    <button
                      onClick={() => setVoiceMode("synthesize")}
                      disabled={busy}
                      className={`px-1.5 py-1 text-[9px] font-bold uppercase rounded transition-all ${
                        voiceMode === "synthesize" ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-white"
                      }`}
                    >
                      AI Synth
                    </button>
                    <button
                      onClick={() => setVoiceMode("clone")}
                      disabled={busy}
                      className={`px-1.5 py-1 text-[9px] font-bold uppercase rounded transition-all ${
                        voiceMode === "clone" ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-white"
                      }`}
                    >
                      AI Clone
                    </button>
                    <button
                      onClick={() => setVoiceMode("upload")}
                      disabled={busy}
                      className={`px-1.5 py-1 text-[9px] font-bold uppercase rounded transition-all ${
                        voiceMode === "upload" ? "bg-neutral-800 text-white" : "text-neutral-500 hover:text-white"
                      }`}
                    >
                      Upload
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {voiceMode === "synthesize" && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block">
                          Prebuilt Voice speaker
                        </label>
                        <select
                          value={voiceProfile}
                          onChange={(e) => setVoiceProfile(e.target.value)}
                          className="w-full text-xs rounded-xl bg-neutral-950 border border-neutral-900/80 p-2.5 text-white focus:outline-none focus:border-white/25"
                        >
                          {VOICES.map((v) => (
                            <option key={v.id} value={v.id} className="bg-surface-2">
                              {v.label} ({v.vibe})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block">
                          Delivery Style / Directions (Optional)
                        </label>
                        <input
                          type="text"
                          value={voiceStyle}
                          onChange={(e) => setVoiceProfileStyle(e.target.value)}
                          placeholder="e.g. 'deep narrative, whispering movie-trailer, excited'"
                          className="w-full text-xs rounded-xl bg-neutral-950 border border-neutral-900/80 p-2.5 text-white placeholder:text-neutral-700 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {voiceMode === "clone" && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block">
                          Voice Sample Reference
                        </label>
                        
                        <div
                          onDragEnter={handleDragVoiceSample}
                          onDragOver={(e) => e.preventDefault()}
                          onDragLeave={handleLeaveVoiceSample}
                          onDrop={handleDropVoiceSample}
                          className={`relative rounded-xl border border-dashed p-4 text-center transition-all ${
                            isDraggingVoiceSample
                              ? "border-white bg-white/5"
                              : cloningAudioSample
                              ? "border-neutral-800 bg-surface-2"
                              : "border-neutral-900 hover:border-neutral-800 bg-neutral-950"
                          }`}
                        >
                          {cloningAudioSample ? (
                            <div className="flex items-center gap-3 text-left">
                              <div className="flex h-8 w-8 items-center justify-center rounded bg-neutral-800 border border-neutral-700 text-neutral-400 shrink-0">
                                <FileAudio size={16} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-white truncate">{cloningAudioSample.name}</p>
                                <p className="text-[9px] text-neutral-500 font-mono mt-0.5 uppercase">Reference sample attached</p>
                              </div>
                              <button
                                onClick={() => setCloningAudioSample(null)}
                                className="text-neutral-400 hover:text-white cursor-pointer"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center gap-1 cursor-pointer">
                              <Mic size={18} className="text-neutral-600" />
                              <span className="text-[10px] text-neutral-500">
                                Drag voice recording sample or <span className="text-white hover:underline">browse</span>
                              </span>
                              <span className="text-[8px] text-neutral-600 font-mono">WAV/MP3 · 6-15s max · GPU clones sample voice</span>
                              <input
                                type="file"
                                accept="audio/*"
                                onChange={(e) => e.target.files?.[0] && attachVoiceSample(e.target.files[0])}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {voiceMode === "upload" && (
                    <div className="space-y-3">
                      <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block">
                        Direct Voice File Upload
                      </p>
                      <label className="flex flex-col items-center justify-center border border-dashed border-neutral-900 bg-neutral-950 rounded-xl p-6 hover:border-neutral-800 hover:bg-neutral-950/60 transition-all cursor-pointer group text-center min-h-[120px]">
                        <UploadCloud size={20} className="text-neutral-500 group-hover:text-white mb-2 transition-colors" />
                        <span className="text-[11px] font-medium text-neutral-400 group-hover:text-neutral-200 transition-colors">
                          {voiceUploadFile ? voiceUploadFile.name : "Select or drag custom voice clip"}
                        </span>
                        <span className="text-[8px] text-neutral-600 mt-1 font-mono">WAV, MP3, AAC up to 8MB</span>
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={handleDirectVoiceUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}

                  {/* Synthesise prompt phrase */}
                  {(voiceMode === "synthesize" || voiceMode === "clone") && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                          Voice test script script
                        </label>
                        <span className="text-[9px] text-neutral-600 font-mono font-semibold">MAX 500 CHARS</span>
                      </div>
                      <textarea
                        rows={2}
                        value={voiceDescription}
                        maxLength={500}
                        onChange={(e) => setVoiceDescription(e.target.value)}
                        placeholder={`Introduce this character, e.g. 'Hello there! I am ${name || "your new character"}. My voice profile is synchronized.'`}
                        disabled={busy}
                        className="w-full resize-none text-xs rounded-xl bg-neutral-950 border border-neutral-900/80 p-2.5 placeholder:text-neutral-600 focus:border-white/25 focus:ring-0 focus:outline-none text-white leading-relaxed font-mono"
                      />
                      
                      <button
                        onClick={generateVoice}
                        disabled={busy || (voiceMode === "clone" && !cloningAudioSample)}
                        className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-bold py-2 px-4 transition-all mt-1"
                      >
                        <Volume2 size={12} className="text-neutral-300" />
                        Generate Voiceover ({voiceMode === "clone" ? `${cloneCost} cr` : `${ttsCost} cr`})
                      </button>
                    </div>
                  )}

                  {/* Generated voice playback preview */}
                  {(generatedVoiceUrl || voiceSamplePreview) && (
                    <div className="pt-4 border-t border-neutral-900/60 space-y-2">
                      <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block">
                        Character Voice playback preview
                      </span>
                      <div className="rounded-xl border border-neutral-900 bg-neutral-950 p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300">
                            <Volume2 size={14} />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-white uppercase tracking-wider">AUDIO TAKE READIED</p>
                            <p className="text-[9px] text-neutral-500 font-mono mt-0.5">WAV sample generated</p>
                          </div>
                        </div>
                        <button
                          onClick={() => togglePlayVoice("editor_preview", generatedVoiceUrl || voiceSamplePreview!)}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black hover:bg-neutral-200 transition-colors shadow"
                        >
                          {playingId === "editor_preview" ? <Pause size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" className="ml-0.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>

            </div>

            {/* Editor Action buttons */}
            <div className="border-t border-neutral-900 pt-6 flex justify-end gap-3">
              <button
                onClick={() => setView("list")}
                disabled={busy}
                className="rounded-full border border-neutral-900 hover:border-neutral-800 px-6 py-2.5 text-xs font-bold text-neutral-400 hover:text-white transition-all disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCharacter}
                disabled={busy || !name.trim()}
                className="rounded-full bg-white hover:bg-neutral-200 text-black text-xs font-bold px-8 py-2.5 transition-all flex items-center gap-2 shadow-lg disabled:opacity-40"
              >
                {busy ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    {operationMsg || "Processing..."}
                  </>
                ) : (
                  <>
                    <CheckCircle size={13} />
                    Save Character profile
                  </>
                )}
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
