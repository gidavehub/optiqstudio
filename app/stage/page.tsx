"use client";

import React, { useState, useEffect, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Volume2, VolumeX, Maximize, Sparkles } from "lucide-react";

interface SessionState {
  currentSegmentId: string;
  mode: "video" | "avatar";
  gesture: string;
  subtitles: string;
  isPlaying: boolean;
  activeVisual?: "none" | "map" | "kenya" | "unicef";
  updatedAt: number;
}

export default function StageProjection() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // References to our double-buffered video elements
  const preRecordedVideoRef = useRef<HTMLVideoElement>(null);
  const standbyVideoRef = useRef<HTMLVideoElement>(null);

  // Sync state with Firestore
  useEffect(() => {
    const docRef = doc(db, "sessions", "unicef");
    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          setSession(snap.data() as SessionState);
        } else {
          // Default fallbacks if document is empty
          setSession({
            currentSegmentId: "welcome",
            mode: "video",
            gesture: "none",
            subtitles: "Welcome class, settle down please...",
            isPlaying: false,
            activeVisual: "none",
            updatedAt: Date.now(),
          });
        }
      },
      (error) => {
        console.error("Firestore sync error:", error);
      }
    );
    return () => unsubscribe();
  }, []);

  // Monitor video mappings based on active segment
  const getVideoSrc = (segmentId: string) => {
    switch (segmentId) {
      case "welcome":
        return "/media/rohey-hello.mp4";
      case "giga":
        return "/media/rohey-giga.mp4";
      case "feedback":
        return "/media/connected-classroom.mp4";
      case "closing":
        return "/media/rohey-closing.mp4";
      default:
        return "/media/rohey-hello.mp4";
    }
  };

  // Sync HTML5 video play/pause/mute states based on real-time database state
  useEffect(() => {
    if (!unlocked || !session) return;

    const mainVid = preRecordedVideoRef.current;
    const standbyVid = standbyVideoRef.current;

    if (session.mode === "video") {
      // Pre-recorded active segment
      if (standbyVid) {
        standbyVid.pause();
      }

      if (mainVid) {
        // Swap src only if it actually changed
        const targetSrc = getVideoSrc(session.currentSegmentId);
        if (!mainVid.src.endsWith(targetSrc)) {
          mainVid.src = targetSrc;
          mainVid.load();
        }

        mainVid.muted = isMuted;
        if (session.isPlaying) {
          mainVid.play().catch((err) => console.log("Play blocked:", err));
        } else {
          mainVid.pause();
        }
      }
    } else {
      // Live Avatar Mode (Standby Listening loop active)
      if (mainVid) {
        mainVid.pause();
      }

      if (standbyVid) {
        standbyVid.muted = true; // Standby is always silent nodding
        if (session.isPlaying) {
          standbyVid.play().catch((err) => console.log("Play blocked:", err));
        } else {
          standbyVid.pause();
        }
      }
    }
  }, [session, unlocked, isMuted]);

  // Request fullscreen presentation
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error("Error going fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Safe activation click to unlock HTML5 browser audio
  const handleUnlock = () => {
    setUnlocked(true);
    // Trigger quick audio buffer playback if possible
    const mainVid = preRecordedVideoRef.current;
    const standbyVid = standbyVideoRef.current;
    if (mainVid) mainVid.play().then(() => mainVid.pause()).catch(() => {});
    if (standbyVid) standbyVid.play().then(() => standbyVid.pause()).catch(() => {});
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#020203] flex flex-col items-center justify-center text-center p-6 text-white selection:bg-neutral-800">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(147,51,234,0.08)_0,transparent_50%)] pointer-events-none filter blur-2xl" />
        
        <div className="relative z-10 max-w-lg p-10 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl flex flex-col items-center shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-8 text-purple-400">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          
          <h2 className="text-2xl font-semibold tracking-tight mb-3">UNICEF Dinner Projection</h2>
          <p className="text-xs text-neutral-400 leading-relaxed mb-8 max-w-xs">
            Unlock cinematic sound and secure real-time stream synchronization for the main projector screen.
          </p>

          <button
            onClick={handleUnlock}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-sm font-semibold tracking-wide transition-all shadow-lg hover:shadow-purple-500/10 active:scale-95 cursor-pointer"
          >
            ACTIVATE STAGE VIEW
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative flex flex-col justify-between overflow-hidden cursor-none select-none">
      
      {/* ── TOP STREAM UTILITY OVERLAY (auto-fades, shows on hover or click) ── */}
      <div className="absolute top-6 left-8 right-8 flex justify-between items-center z-50 pointer-events-auto opacity-0 hover:opacity-100 transition-opacity duration-300">
        <span className="text-xs font-mono text-neutral-500 bg-black/40 px-3 py-1.5 rounded-full border border-white/[0.04] backdrop-blur-md">
          STAGE VIEW // {session?.mode === "video" ? "PRE-RECORDED STREAM" : "LIVE AVATAR ACTIVE"}
        </span>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2.5 rounded-full bg-black/40 border border-white/[0.04] backdrop-blur-md hover:bg-neutral-900 text-neutral-400 hover:text-white transition-all cursor-pointer"
            title={isMuted ? "Unmute Sound" : "Mute Sound"}
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-full bg-black/40 border border-white/[0.04] backdrop-blur-md hover:bg-neutral-900 text-neutral-400 hover:text-white transition-all cursor-pointer"
            title="Toggle Fullscreen"
          >
            <Maximize size={15} />
          </button>
        </div>
      </div>

      {/* ── DOUBLE-BUFFERED VIDEO RENDERING MATRIX ── */}
      <div className="absolute inset-0 z-0">
        {/* Buffer A: Pre-Recorded Lecture Segment */}
        <video
          ref={preRecordedVideoRef}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
            session?.mode === "video" ? "opacity-100 z-10" : "opacity-0 z-0"
          }`}
          playsInline
          loop
          muted={isMuted}
        />

        {/* Buffer B: Standby Node Nodding Loop */}
        <video
          ref={standbyVideoRef}
          src="/media/rohey-listening.mp4"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
            session?.mode === "avatar" ? "opacity-100 z-10" : "opacity-0 z-0"
          }`}
          playsInline
          loop
          muted // node-nodding is strictly silent
        />
      </div>

      {/* ── SIDE-SLIDE HIGH-RESOLUTION VISUAL PANEL (Active Giga Map or Photo Slides) ── */}
      {session && session.activeVisual && session.activeVisual !== "none" && (
        <div className="absolute top-10 bottom-10 right-10 w-[42%] z-30 rounded-3xl overflow-hidden border border-white/[0.08] bg-black/60 backdrop-blur-xl shadow-2xl animate-fade-in-right flex flex-col items-center justify-center p-6">
          <div className="relative w-full h-full rounded-2xl overflow-hidden">
            {session.activeVisual === "map" && (
              <img
                src="/media/giga-gambia-map.png"
                alt="UNICEF Giga Map"
                className="w-full h-full object-contain animate-scale-up"
              />
            )}
            {session.activeVisual === "kenya" && (
              <img
                src="/media/darlene-coding.jpg"
                alt="Darlene coding in Kakuma"
                className="w-full h-full object-cover rounded-2xl animate-scale-up"
              />
            )}
            {session.activeVisual === "unicef" && (
              <div className="w-full h-full flex flex-col items-center justify-center bg-black/80 p-8 text-center">
                <img
                  src="/rohey-avatar.jpg"
                  alt="UNICEF Gambia Logo"
                  className="w-40 h-40 object-cover rounded-full mb-8 border-2 border-white/20"
                />
                <h3 className="text-xl font-semibold mb-3">UNICEF The Gambia</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Access to affordable, sustainable, safe and resilient connectivity for every child.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ACTIVE GESTURE / POINTING HUD INDICATOR (Avatar pointing HUD highlights) ── */}
      {session && session.mode === "avatar" && session.gesture && session.gesture !== "none" && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 bg-black/55 backdrop-blur-md border border-white/[0.06] rounded-full px-5 py-2 flex items-center gap-2.5 text-xs font-mono tracking-widest text-purple-300 uppercase animate-bounce shadow-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
          <span>ROHEY DETECTED ACTION: POINTING {session.gesture}</span>
        </div>
      )}

      {/* ── CINEMATIC DYNAMIC SUBTITLES OVERLAY Matrix ── */}
      {session && session.subtitles && (
        <div className="w-full flex justify-center pb-12 px-12 z-40 relative mt-auto">
          <div className="max-w-4xl bg-black/70 backdrop-blur-md border border-white/[0.05] shadow-[0_24px_50px_rgba(0,0,0,0.8)] px-10 py-5 rounded-2xl text-center flex flex-col items-center gap-1.5">
            {session.mode === "avatar" && (
              <span className="text-[9px] font-mono text-purple-400 tracking-[0.2em] font-bold uppercase animate-pulse">
                LIVE INTERACTION FEED
              </span>
            )}
            <p className="text-2xl md:text-[28px] font-serif text-white leading-relaxed tracking-wide font-normal drop-shadow-md">
              &ldquo;{session.subtitles}&rdquo;
            </p>
          </div>
        </div>
      )}

      {/* Injected custom micro-animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeInRight {
          from {
            opacity: 0;
            transform: translateX(50px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        .animate-fade-in-right {
          animation: fadeInRight 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes scaleUp {
          from {
            transform: scale(0.95);
            opacity: 0.8;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-scale-up {
          animation: scaleUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      ` }} />

    </div>
  );
}
