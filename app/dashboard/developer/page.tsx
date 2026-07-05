"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../../../components/AuthProvider";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Loader2,
  Code,
  Terminal,
  BookOpen,
  Info,
} from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  apiKey: string;
  createdAt: string;
  lastUsedAt?: string;
  active: boolean;
}

export default function DeveloperPage() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [keyName, setKeyName] = useState("");
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [copyingText, setCopyingText] = useState<string | null>(null);
  const [copyingGuide, setCopyingGuide] = useState(false);
  const [activeTab, setActiveTab] = useState<"image" | "video" | "tts">("image");

  // Load user's API keys in real-time
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "api_keys"),
      where("uid", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: ApiKey[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          fetched.push({
            id: doc.id,
            name: data.name,
            apiKey: data.apiKey,
            createdAt: data.createdAt,
            lastUsedAt: data.lastUsedAt,
            active: data.active,
          });
        });
        // Sort by newest first
        fetched.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setKeys(fetched);
        setLoadingKeys(false);
      },
      (err) => {
        console.error("Failed to load API keys:", err);
        setLoadingKeys(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Generate a random secure API Key
  const generateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !keyName.trim()) return;

    setCreating(true);
    try {
      // Create random secure hex string
      const array = new Uint8Array(24);
      window.crypto.getRandomValues(array);
      const randomHex = Array.from(array)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      
      const newKey = `optiq_live_${randomHex}`;

      await addDoc(collection(db, "api_keys"), {
        uid: user.uid,
        name: keyName.trim(),
        apiKey: newKey,
        createdAt: new Date().toISOString(),
        active: true,
      });

      setKeyName("");
    } catch (err) {
      console.error("Failed to create API key:", err);
    } finally {
      setCreating(false);
    }
  };

  // Revoke an API key
  const revokeKey = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this API key? External clients using it will lose access immediately.")) {
      return;
    }
    try {
      await deleteDoc(doc(db, "api_keys", id));
    } catch (err) {
      console.error("Failed to revoke key:", err);
    }
  };

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopyingId(id);
    setTimeout(() => setCopyingId(null), 2000);
  };

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyingText(label);
    setTimeout(() => setCopyingText(null), 2000);
  };

  const handleCopyGuide = () => {
    const fullGuide = `OPTIQ STUDIO - DEVELOPER GUIDE & API REFERENCE

1. AUTHENTICATION & QUICKSTART
All developer APIs use secure endpoints deployed in region us-east4. Request parameters are passed via standard JSON. Authentication is fulfilled via Bearer tokens in the Authorization header.

Authorization Header:
Authorization: Bearer optiq_live_YOUR_API_KEY

API Base URL:
https://us-east4-davelabs-tools.cloudfunctions.net

--------------------------------------------------

2. API ENDPOINTS & REFERENCE

A. IMAGE GENERATION (POST /apiGenerateImage)
Generates photorealistic images using gemini-3.1-flash-image-preview. Optionally supports input reference image attachments to guide generation.
Cost: 5 Credits / Request

Request Example (Text-to-Image):
curl -X POST "https://us-east4-davelabs-tools.cloudfunctions.net/apiGenerateImage" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Cinematic wide shot of a young Black scuba diver exploring a bioluminescent coral shipwreck",
    "aspectRatio": "16:9",
    "purpose": "image"
  }'

Request Example (With Reference Image Attachment):
curl -X POST "https://us-east4-davelabs-tools.cloudfunctions.net/apiGenerateImage" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Cinematic wide shot of a young Black scuba diver exploring a bioluminescent coral shipwreck",
    "aspectRatio": "16:9",
    "purpose": "image",
    "referenceImages": [
      {
        "base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "mimeType": "image/png"
      }
    ]
  }'

Response Example:
{
  "id": "gen_8kC9dfS2X9j",
  "url": "https://storage.googleapis.com/davelabs-tools/generations/user_123/gen_8kC9dfS2X9j.jpg",
  "mimeType": "image/jpeg",
  "cost": 5
}

--------------------------------------------------

B. VIDEO GENERATION (POST /apiGenerateVideo)
Generates cinematic high-motion video using gemini-omni-flash-preview. Supports optional image or video first-frame/reference attachments.
Cost: 12 Credits / Second

Request Example (Text-to-Video):
curl -X POST "https://us-east4-davelabs-tools.cloudfunctions.net/apiGenerateVideo" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Dramatic slow-motion tracking shot of a focused female sprinter starting a race, neon lagos background",
    "model": "omni",
    "durationSeconds": 8
  }'

Request Example (With Image Reference Attachment):
curl -X POST "https://us-east4-davelabs-tools.cloudfunctions.net/apiGenerateVideo" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Dramatic slow-motion tracking shot of a focused female sprinter starting a race, neon lagos background",
    "model": "omni",
    "durationSeconds": 8,
    "imageBase64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "imageMimeType": "image/png"
  }'

Request Example (With Video Reference Attachment):
curl -X POST "https://us-east4-davelabs-tools.cloudfunctions.net/apiGenerateVideo" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Dramatic slow-motion tracking shot of a focused female sprinter starting a race, neon lagos background",
    "model": "omni",
    "durationSeconds": 8,
    "videoBase64": "AAAAIGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQAAAApZnJlZQAAAgNtZGF0...",
    "videoMimeType": "video/mp4"
  }'

Request Example (With Audio Reference Attachment):
curl -X POST "https://us-east4-davelabs-tools.cloudfunctions.net/apiGenerateVideo" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Cinematic tracking shot of a presenter talking, Yoruba traditional clothes, matching the voice tone of the attached sample",
    "model": "omni",
    "durationSeconds": 8,
    "audioBase64": "UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=",
    "audioMimeType": "audio/wav"
  }'

Response Example:
{
  "id": "gen_4jSk2Lp0As1",
  "status": "generating",
  "cost": 96
}

--------------------------------------------------

C. GET VIDEO STATUS (GET /apiGetVideoStatus)
Retrieve render state and video MP4 download URL.
Request Example:
curl -X GET "https://us-east4-davelabs-tools.cloudfunctions.net/apiGetVideoStatus?id=YOUR_GENERATION_ID" \\
  -H "Authorization: Bearer YOUR_API_KEY"

Response Example (Completed):
{
  "id": "gen_4jSk2Lp0As1",
  "status": "succeeded",
  "videoUrl": "https://storage.googleapis.com/davelabs-tools/generations/user_123/gen_4jSk2Lp0As1.mp4",
  "error": null,
  "prompt": "Dramatic slow-motion tracking shot of a focused female sprinter starting a race, neon lagos background",
  "completedAt": "2026-07-04T12:52:00Z"
}

--------------------------------------------------

D. TEXT-TO-SPEECH (POST /apiGenerateTTS)
Compiles studio-grade narrative speech recordings using gemini-3.1-flash-preview-tts.
Cost: 1 Credit / 100 Characters

Request Example:
curl -X POST "https://us-east4-davelabs-tools.cloudfunctions.net/apiGenerateTTS" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Welcome to Optiq Studio. Bring your wildest imaginations to life.",
    "voice": "Charon",
    "style": "cinematic movie-trailer gravitas"
  }'

Response Example:
{
  "id": "gen_a2Dsf9Km1Pz",
  "url": "https://storage.googleapis.com/davelabs-tools/generations/user_123/gen_a2Dsf9Km1Pz.wav",
  "cost": 5
}
`;
    navigator.clipboard.writeText(fullGuide);
    setCopyingGuide(true);
    setTimeout(() => setCopyingGuide(false), 2000);
  };

  // Code snippets for Docs
  const curlImage = `curl -X POST "https://us-east4-davelabs-tools.cloudfunctions.net/apiGenerateImage" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Cinematic wide shot of a young Black scuba diver exploring a bioluminescent coral shipwreck",
    "aspectRatio": "16:9",
    "purpose": "image"
  }'`;

  const responseImage = `{
  "id": "gen_8kC9dfS2X9j",
  "url": "https://storage.googleapis.com/davelabs-tools/generations/user_123/gen_8kC9dfS2X9j.jpg",
  "mimeType": "image/jpeg",
  "cost": 5
}`;

  const curlVideo = `curl -X POST "https://us-east4-davelabs-tools.cloudfunctions.net/apiGenerateVideo" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Dramatic slow-motion tracking shot of a focused female sprinter starting a race, neon lagos background",
    "model": "omni",
    "durationSeconds": 8
  }'`;

  const responseVideo = `{
  "id": "gen_4jSk2Lp0As1",
  "status": "generating",
  "cost": 96
}`;

  const curlVideoStatus = `curl -X GET "https://us-east4-davelabs-tools.cloudfunctions.net/apiGetVideoStatus?id=YOUR_GENERATION_ID" \\
  -H "Authorization: Bearer YOUR_API_KEY"`;

  const responseVideoStatus = `{
  "id": "gen_4jSk2Lp0As1",
  "status": "succeeded",
  "videoUrl": "https://storage.googleapis.com/davelabs-tools/generations/user_123/gen_4jSk2Lp0As1.mp4",
  "error": null,
  "prompt": "Dramatic slow-motion tracking shot of a focused female sprinter starting a race, neon lagos background",
  "completedAt": "2026-07-04T12:52:00Z"
}`;

  const curlTts = `curl -X POST "https://us-east4-davelabs-tools.cloudfunctions.net/apiGenerateTTS" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Welcome to Optiq Studio. Bring your wildest imaginations to life.",
    "voice": "Charon",
    "style": "cinematic movie-trailer gravitas"
  }'`;

  const responseTts = `{
  "id": "gen_a2Dsf9Km1Pz",
  "url": "https://storage.googleapis.com/davelabs-tools/generations/user_123/gen_a2Dsf9Km1Pz.wav",
  "cost": 5
}`;

  return (
    <div className="h-full overflow-y-auto bg-black text-white">
      <div className="w-full px-8 py-10">
        
        {/* Title */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/5 bg-[#0a0a0a]">
            <Code className="text-neutral-400" size={18} />
          </div>
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight">API & Developers</h1>
            <p className="mt-1 text-[13px] text-neutral-500">
              Integrate Optiq’s premium generative models into your custom pipelines and external services.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-12">
          
          {/* Left Column: API Keys manager */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Generate Key Card */}
            <div className="rounded-lg border border-white/5 bg-[#0a0a0a] p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-neutral-300">
                <Key size={15} />
                <h2>Generate API Credentials</h2>
              </div>
              <form onSubmit={generateKey} className="mt-4 flex gap-2">
                <input
                  type="text"
                  placeholder="Key name (e.g. Production App)"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  disabled={creating}
                  className="flex-1 rounded-md border border-white/5 bg-black px-3 py-2 text-[13px] text-white placeholder-neutral-600 outline-none focus:border-white/20 transition-colors"
                />
                <button
                  type="submit"
                  disabled={creating || !keyName.trim()}
                  className="inline-flex h-9 items-center justify-center rounded-md bg-white px-3.5 text-[13px] font-medium text-black hover:bg-neutral-200 transition-colors disabled:opacity-40 disabled:hover:bg-white"
                >
                  {creating ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <>
                      <Plus className="mr-1" size={14} /> Generate
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* List Keys Card */}
            <div className="rounded-lg border border-white/5 bg-[#0a0a0a] p-5">
              <h3 className="text-sm font-medium text-neutral-300">Active API Keys</h3>
              <p className="mt-1 text-[11px] text-neutral-500 leading-normal">
                Credentials carry full spending access to your standard billing balance. Never expose live keys on client-side JS.
              </p>

              {loadingKeys ? (
                <div className="mt-8 flex justify-center py-6">
                  <Loader2 className="animate-spin text-neutral-600" size={20} />
                </div>
              ) : keys.length === 0 ? (
                <div className="mt-6 flex flex-col items-center justify-center rounded-md border border-dashed border-white/5 py-8 text-center text-neutral-600">
                  <Terminal size={22} className="mb-2" />
                  <p className="text-[12px]">No API keys found.</p>
                </div>
              ) : (
                <div className="mt-4 divide-y divide-white/5">
                  {keys.map((key) => {
                    const masked = `${key.apiKey.slice(0, 15)}••••${key.apiKey.slice(-4)}`;
                    return (
                      <div key={key.id} className="py-3.5 first:pt-0 last:pb-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-[13px] font-medium text-neutral-300">{key.name}</p>
                            <p className="mt-1 font-mono text-[11px] text-neutral-500">{masked}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleCopy(key.apiKey, key.id)}
                              title="Copy Key"
                              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/5 text-neutral-400 hover:text-white transition-colors"
                            >
                              {copyingId === key.id ? (
                                <Check className="text-emerald-500" size={13} />
                              ) : (
                                <Copy size={13} />
                              )}
                            </button>
                            <button
                              onClick={() => revokeKey(key.id)}
                              title="Revoke Key"
                              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-red-950/20 text-neutral-500 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between text-[10px] text-neutral-600">
                          <span>Created {new Date(key.createdAt).toLocaleDateString()}</span>
                          <span>
                            {key.lastUsedAt
                              ? `Used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                              : "Never used"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Documentation */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Getting Started Guide */}
            <div className="rounded-lg border border-white/5 bg-[#0a0a0a] p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-neutral-300">
                  <BookOpen size={15} />
                  <h2>Developer Quickstart</h2>
                </div>
                <button
                  onClick={handleCopyGuide}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white px-3 text-[11px] font-semibold text-neutral-300 transition-colors"
                >
                  {copyingGuide ? (
                    <>
                      <Check className="text-emerald-500" size={11} /> Guide Copied
                    </>
                  ) : (
                    <>
                      <Copy size={11} /> Copy Entire Guide
                    </>
                  )}
                </button>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-neutral-400">
                All developer APIs use secure endpoints deployed in region <code className="font-mono text-neutral-300">us-east4</code>. Request parameters are passed via standard JSON, and authentication is fulfilled via bearer tokens:
              </p>
              <div className="mt-4 rounded-md bg-black border border-white/5 px-4 py-3 font-mono text-[12px] text-neutral-300">
                Authorization: Bearer <span className="text-violet-400">optiq_live_YOUR_API_KEY</span>
              </div>
              
              <div className="mt-5 flex gap-2 rounded-md bg-neutral-900/30 border border-white/5 p-3 text-[11px] text-neutral-500 leading-relaxed">
                <Info className="shrink-0 text-neutral-400 mt-0.5" size={13} />
                <div>
                  Our dashboard and external API share the exact same credit balances. For instance, generating an image costs <code className="font-mono text-neutral-300">5 credits</code> directly charged against your standard Optiq wallet.
                </div>
              </div>
            </div>

            {/* Docs Tabs Card */}
            <div className="rounded-lg border border-white/5 bg-[#0a0a0a] overflow-hidden">
              
              {/* Tab Selector Header */}
              <div className="flex border-b border-white/5 bg-black">
                {(["image", "video", "tts"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-3 text-center font-mono text-[11px] tracking-wider uppercase border-b-2 transition-all ${
                      activeTab === tab
                        ? "border-white text-white bg-white/5 font-semibold"
                        : "border-transparent text-neutral-500 hover:text-white"
                    }`}
                  >
                    {tab === "tts" ? "TTS (Speech)" : tab}
                  </button>
                ))}
              </div>

              {/* Tab Contents */}
              <div className="p-6 space-y-5">
                
                {activeTab === "image" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-mono text-[12px] font-bold text-neutral-300">
                        POST /apiGenerateImage
                      </h4>
                      <span className="rounded-full bg-violet-950/40 border border-violet-800/30 px-2 py-0.5 text-[10px] text-violet-300">
                        5 - 15 Credits
                      </span>
                    </div>
                     <p className="text-[12.5px] leading-relaxed text-neutral-400">
                      Creates premium photorealistic graphics using <code className="font-mono text-neutral-300">gemini-3.1-flash-image-preview</code>. Supports optional reference image attachments (passed via <code className="font-mono text-neutral-300">{'referenceImages: [{"base64", "mimeType"}]'}</code>) to guide generations, or character sheets for subject consistency.
                    </p>

                    <div>
                      <div className="flex items-center justify-between bg-black/60 px-4 py-2 border-t border-x border-white/5 rounded-t-md text-[11px] text-neutral-500">
                        <span>CURL COMMAND</span>
                        <button
                          onClick={() => handleCopyText(curlImage, "curl-image")}
                          className="flex items-center gap-1 hover:text-white transition-colors"
                        >
                          {copyingText === "curl-image" ? (
                            <>
                              <Check size={11} className="text-emerald-500" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy size={11} /> Copy
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="overflow-x-auto rounded-b-md bg-black p-4 font-mono text-[11px] text-neutral-300 leading-normal border-x border-b border-white/5">
                        {curlImage}
                      </pre>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                        Response Schema (200 OK)
                      </p>
                      <pre className="overflow-x-auto rounded-md bg-black/40 p-4 font-mono text-[11px] text-neutral-300 leading-normal border border-white/5">
                        {responseImage}
                      </pre>
                    </div>
                  </div>
                )}

                {activeTab === "video" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-mono text-[12px] font-bold text-neutral-300">
                        POST /apiGenerateVideo
                      </h4>
                      <span className="rounded-full bg-violet-950/40 border border-violet-800/30 px-2 py-0.5 text-[10px] text-violet-300">
                        5 - 12 Credits / Sec
                      </span>
                    </div>
                    <p className="text-[12.5px] leading-relaxed text-neutral-400">
                      Generates high-motion cinematic video using <code className="font-mono text-neutral-300">gemini-omni-flash-preview</code>. Returns a unique tracking ID to poll for completion. You can optionally attach reference images or videos (using <code className="font-mono text-neutral-300">imageBase64</code>/<code className="font-mono text-neutral-300">imageMimeType</code> or <code className="font-mono text-neutral-300">videoBase64</code>/<code className="font-mono text-neutral-300">videoMimeType</code>) to guide the first frame of the generated output, as well as an audio voice reference (using <code className="font-mono text-neutral-300">audioBase64</code>/<code className="font-mono text-neutral-300">audioMimeType</code>) to extract and clone custom voice profiles for character speech.
                    </p>

                    <div>
                      <div className="flex items-center justify-between bg-black/60 px-4 py-2 border-t border-x border-white/5 rounded-t-md text-[11px] text-neutral-500">
                        <span>CURL COMMAND</span>
                        <button
                          onClick={() => handleCopyText(curlVideo, "curl-video")}
                          className="flex items-center gap-1 hover:text-white transition-colors"
                        >
                          {copyingText === "curl-video" ? (
                            <>
                              <Check size={11} className="text-emerald-500" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy size={11} /> Copy
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="overflow-x-auto rounded-b-md bg-black p-4 font-mono text-[11px] text-neutral-300 leading-normal border-x border-b border-white/5">
                        {curlVideo}
                      </pre>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                        Response Schema
                      </p>
                      <pre className="overflow-x-auto rounded-md bg-black/40 p-4 font-mono text-[11px] text-neutral-300 leading-normal border border-white/5">
                        {responseVideo}
                      </pre>
                    </div>

                    <div className="border-t border-white/5 pt-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-mono text-[12px] font-bold text-neutral-300">
                          GET /apiGetVideoStatus
                        </h4>
                        <span className="text-[10px] text-neutral-500">
                          Polling Query
                        </span>
                      </div>
                      <p className="text-[12.5px] leading-relaxed text-neutral-400">
                        Check execution states and retrieve finalized mp4 CDN URLs.
                      </p>

                      <div>
                        <div className="flex items-center justify-between bg-black/60 px-4 py-2 border-t border-x border-white/5 rounded-t-md text-[11px] text-neutral-500">
                          <span>CURL STATUS COMMAND</span>
                          <button
                            onClick={() => handleCopyText(curlVideoStatus, "curl-video-status")}
                            className="flex items-center gap-1 hover:text-white transition-colors"
                          >
                            {copyingText === "curl-video-status" ? (
                              <>
                                <Check size={11} className="text-emerald-500" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy size={11} /> Copy
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="overflow-x-auto rounded-b-md bg-black p-4 font-mono text-[11px] text-neutral-300 leading-normal border-x border-b border-white/5">
                          {curlVideoStatus}
                        </pre>
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                          Status Schema (Succeeded)
                        </p>
                        <pre className="overflow-x-auto rounded-md bg-black/40 p-4 font-mono text-[11px] text-neutral-300 leading-normal border border-white/5">
                          {responseVideoStatus}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "tts" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-mono text-[12px] font-bold text-neutral-300">
                        POST /apiGenerateTTS
                      </h4>
                      <span className="rounded-full bg-violet-950/40 border border-violet-800/30 px-2 py-0.5 text-[10px] text-violet-300">
                        1 Credit / 100 Chars
                      </span>
                    </div>
                    <p className="text-[12.5px] leading-relaxed text-neutral-400">
                      Generate hyper-realistic natural speech audio using <code className="font-mono text-neutral-300">gemini-3.1-flash-preview-tts</code>. Customize delivery style directions like accents, dramatic pause, and tone.
                    </p>

                    <div>
                      <div className="flex items-center justify-between bg-black/60 px-4 py-2 border-t border-x border-white/5 rounded-t-md text-[11px] text-neutral-500">
                        <span>CURL COMMAND</span>
                        <button
                          onClick={() => handleCopyText(curlTts, "curl-tts")}
                          className="flex items-center gap-1 hover:text-white transition-colors"
                        >
                          {copyingText === "curl-tts" ? (
                            <>
                              <Check size={11} className="text-emerald-500" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy size={11} /> Copy
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="overflow-x-auto rounded-b-md bg-black p-4 font-mono text-[11px] text-neutral-300 leading-normal border-x border-b border-white/5">
                        {curlTts}
                      </pre>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                        Response Schema
                      </p>
                      <pre className="overflow-x-auto rounded-md bg-black/40 p-4 font-mono text-[11px] text-neutral-300 leading-normal border border-white/5">
                        {responseTts}
                      </pre>
                    </div>
                  </div>
                )}

              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
