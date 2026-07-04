"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Check, Copy, ArrowLeft, Terminal, BookOpen, Key, Info, Cpu, Code2, Globe } from "lucide-react";

export default function ApiDocsPage() {
  const [activeTab, setActiveTab] = useState<"image" | "video" | "tts">("image");
  const [copyingText, setCopyingText] = useState<string | null>(null);

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyingText(label);
    setTimeout(() => setCopyingText(null), 2000);
  };

  // Static API Specs
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
    <div className="min-h-screen bg-black text-neutral-100 font-sans antialiasedSelection">
      {/* Top Banner */}
      <div className="sticky top-0 z-50 border-b border-white/5 bg-black/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-6 lg:px-16">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-[20px] font-bold lowercase tracking-tight text-white hover:opacity-80 transition-opacity">
              optiq studio
            </Link>
            <span className="hidden h-4 w-px bg-white/10 md:block" />
            <span className="hidden font-mono text-[11px] tracking-[0.12em] text-neutral-500 md:block uppercase">
              API Documentation
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={13} /> Back to Home
            </Link>
            <Link
              href="/login"
              className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-black hover:bg-neutral-200 transition-colors"
            >
              Get API Keys
            </Link>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="mx-auto max-w-[1440px] px-6 py-12 lg:px-16">
        
        {/* Intro Header */}
        <div className="max-w-3xl border-b border-white/5 pb-10">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-neutral-200">
            <Code2 size={16} />
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Programmatic Creative Suite
          </h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-neutral-400">
            Welcome to the Optiq Studio API. Our developer suite allows brands, startups, and marketing platforms to programmatically trigger studio-grade vertical video renders, photorealistic image creations, and lifelike audio narrations on top of our low-latency global edge network.
          </p>
        </div>

        {/* content split grid */}
        <div className="mt-12 grid gap-12 lg:grid-cols-12">
          
          {/* Left Column: Quickstart info */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Quickstart card */}
            <div className="rounded-xl border border-white/5 bg-[#0a0a0a] p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-neutral-200">
                <BookOpen size={15} className="text-neutral-400" />
                <h2>Developer Quickstart</h2>
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed text-neutral-400">
                All external API calls must be directed to our high-capacity serverless clusters deployed inside region <code className="font-mono text-neutral-300">us-east4</code>.
              </p>
              
              <div className="mt-4 rounded-lg bg-black border border-white/5 px-3 py-2.5 font-mono text-[11px] text-neutral-300">
                Authorization: Bearer <span className="text-violet-400">optiq_live_...</span>
              </div>

              <p className="mt-4 text-[12px] leading-relaxed text-neutral-500">
                Generate, revoke, and monitor your keys anytime inside the secure <Link href="/dashboard/developer" className="text-white underline">Developer Panel</Link> of your active subscription workspace.
              </p>
            </div>

            {/* Core Specs card */}
            <div className="rounded-xl border border-white/5 bg-[#0a0a0a] p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-neutral-200">
                <Globe size={15} className="text-neutral-400" />
                <h2>Global Endpoints</h2>
              </div>
              <ul className="mt-3.5 space-y-3 font-mono text-[11px] text-neutral-400">
                <li className="flex items-center gap-2">
                  <span className="rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/30 px-1 py-0.5 text-[9px] uppercase font-bold">POST</span>
                  <span>/apiGenerateImage</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/30 px-1 py-0.5 text-[9px] uppercase font-bold">POST</span>
                  <span>/apiGenerateVideo</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="rounded bg-violet-950/40 text-violet-400 border border-violet-800/30 px-1 py-0.5 text-[9px] uppercase font-bold">GET</span>
                  <span>/apiGetVideoStatus</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/30 px-1 py-0.5 text-[9px] uppercase font-bold">POST</span>
                  <span>/apiGenerateTTS</span>
                </li>
              </ul>
            </div>

            {/* Credits Usage info */}
            <div className="rounded-xl border border-white/5 bg-[#0a0a0a] p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-neutral-200">
                <Info size={14} className="text-neutral-400" />
                <h2>Billing & Ledger</h2>
              </div>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-neutral-400">
                Your programmatic generations share the same credit balance as your interactive workspace. Cost metrics:
              </p>
              <ul className="mt-3.5 space-y-2 text-[12px] text-neutral-400">
                <li className="flex justify-between border-b border-white/5 pb-1.5">
                  <span>Image Generation</span>
                  <span className="font-mono text-white">5 Credits</span>
                </li>
                <li className="flex justify-between border-b border-white/5 pb-1.5">
                  <span>Video Generation</span>
                  <span className="font-mono text-white">12 Credits / Sec</span>
                </li>
                <li className="flex justify-between pb-0">
                  <span>TTS Synthesis</span>
                  <span className="font-mono text-white">1 Credit / 100 Chars</span>
                </li>
              </ul>
            </div>

          </div>

          {/* Right Column: Documentation Details & Code Sandbox */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Nav tabs for interactive API quick look */}
            <div className="rounded-xl border border-white/5 bg-[#0a0a0a] overflow-hidden">
              
              {/* Selector */}
              <div className="flex border-b border-white/5 bg-black">
                {(["image", "video", "tts"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-4 text-center font-mono text-[11px] tracking-wider uppercase border-b-2 transition-all ${
                      activeTab === tab
                        ? "border-white text-white bg-white/5 font-semibold"
                        : "border-transparent text-neutral-500 hover:text-white"
                    }`}
                  >
                    {tab === "tts" ? "TTS (Speech)" : tab}
                  </button>
                ))}
              </div>

              {/* Dynamic endpoints docs */}
              <div className="p-6 space-y-6">
                
                {/* 1. Image Endpoint */}
                {activeTab === "image" && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/30 px-2 py-0.5 text-[10px] uppercase font-bold font-mono">POST</span>
                        <h3 className="font-mono text-[13px] font-bold text-white">
                          /apiGenerateImage
                        </h3>
                      </div>
                      <span className="rounded-full bg-violet-950/40 border border-violet-800/30 px-2.5 py-0.5 text-[10px] text-violet-300">
                        5 Credits / Request
                      </span>
                    </div>
                    
                    <p className="text-[13px] leading-relaxed text-neutral-400">
                      Creates photorealistic scenery, backdrops, and product-oriented images using <code className="font-mono text-neutral-300">gemini-3.1-flash-image-preview</code>. Leverages precise prompt control.
                    </p>

                    <div>
                      <div className="flex items-center justify-between bg-black px-4 py-2 border-t border-x border-white/5 rounded-t-md text-[11px] text-neutral-500">
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
                        JSON Response Body
                      </p>
                      <pre className="overflow-x-auto rounded-md bg-black/40 p-4 font-mono text-[11px] text-neutral-300 leading-normal border border-white/5">
                        {responseImage}
                      </pre>
                    </div>
                  </div>
                )}

                {/* 2. Video Endpoint */}
                {activeTab === "video" && (
                  <div className="space-y-6">
                    
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/30 px-2 py-0.5 text-[10px] uppercase font-bold font-mono">POST</span>
                          <h3 className="font-mono text-[13px] font-bold text-white">
                            /apiGenerateVideo
                          </h3>
                        </div>
                        <span className="rounded-full bg-violet-950/40 border border-violet-800/30 px-2.5 py-0.5 text-[10px] text-violet-300">
                          12 Credits / Second
                        </span>
                      </div>
                      
                      <p className="text-[13px] leading-relaxed text-neutral-400">
                        Triggers asynchronous high-motion cinematic video render processes powered by <code className="font-mono text-neutral-300">gemini-omni-flash-preview</code>. Returns a unique tracking ID to poll for status.
                      </p>

                      <div>
                        <div className="flex items-center justify-between bg-black px-4 py-2 border-t border-x border-white/5 rounded-t-md text-[11px] text-neutral-500">
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
                          JSON Response Body
                        </p>
                        <pre className="overflow-x-auto rounded-md bg-black/40 p-4 font-mono text-[11px] text-neutral-300 leading-normal border border-white/5">
                          {responseVideo}
                        </pre>
                      </div>
                    </div>

                    <div className="border-t border-white/5 pt-6 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-violet-950/40 text-violet-400 border border-violet-800/30 px-2 py-0.5 text-[10px] uppercase font-bold font-mono">GET</span>
                          <h3 className="font-mono text-[13px] font-bold text-white">
                            /apiGetVideoStatus
                          </h3>
                        </div>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          Polling Query
                        </span>
                      </div>
                      
                      <p className="text-[13px] leading-relaxed text-neutral-400">
                        Retrieves the completed render parameters and direct GCS CDN mp4 download links once compilation processes successfully finish.
                      </p>

                      <div>
                        <div className="flex items-center justify-between bg-black px-4 py-2 border-t border-x border-white/5 rounded-t-md text-[11px] text-neutral-500">
                          <span>CURL STATUS CHECK</span>
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
                          Status Response Body (Render Complete)
                        </p>
                        <pre className="overflow-x-auto rounded-md bg-black/40 p-4 font-mono text-[11px] text-neutral-300 leading-normal border border-white/5">
                          {responseVideoStatus}
                        </pre>
                      </div>
                    </div>

                  </div>
                )}

                {/* 3. TTS Endpoint */}
                {activeTab === "tts" && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/30 px-2 py-0.5 text-[10px] uppercase font-bold font-mono">POST</span>
                        <h3 className="font-mono text-[13px] font-bold text-white">
                          /apiGenerateTTS
                        </h3>
                      </div>
                      <span className="rounded-full bg-violet-950/40 border border-violet-800/30 px-2.5 py-0.5 text-[10px] text-violet-300">
                        1 Credit / 100 Characters
                      </span>
                    </div>
                    
                    <p className="text-[13px] leading-relaxed text-neutral-400">
                      Compiles studio-grade narrative speech recordings leveraging <code className="font-mono text-neutral-300">gemini-2.5-flash-preview-tts</code>. Customize accents, delivery speeds, and voiceover tones dynamically.
                    </p>

                    <div>
                      <div className="flex items-center justify-between bg-black px-4 py-2 border-t border-x border-white/5 rounded-t-md text-[11px] text-neutral-500">
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
                        JSON Response Body
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

      {/* Footer */}
      <footer className="border-t border-white/5 bg-black py-8 mt-20 text-neutral-600 text-center text-xs">
        <p>© {new Date().getFullYear()} Optiq Studio, Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}
