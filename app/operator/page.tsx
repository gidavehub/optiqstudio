"use client";

import React, { useState, useEffect } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { 
  Play, Pause, Wifi, WifiOff, Sparkles, Image as ImageIcon, Map, HelpCircle, 
  MessageSquare, Send, CheckCircle, ArrowLeft, RefreshCw, Hand, Eye
} from "lucide-react";
import Link from "next/link";

interface SessionState {
  currentSegmentId: string;
  mode: "video" | "avatar";
  gesture: string;
  subtitles: string;
  isPlaying: boolean;
  activeVisual?: "none" | "map" | "kenya" | "unicef";
  updatedAt: number;
}

// Pre-defined pre-recorded chapter settings
const PRE_RECORDED_SEGMENTS = [
  {
    id: "welcome",
    name: "1. Welcome & Introduction",
    desc: "Starts the dinner, greets Nafisa, Karl, Imma, Stephane, and Turkish partners. Prompts the re-design question.",
    video: "rohey-hello.mp4",
    defaultSubtitles: "Good evening, class. Welcome to my classroom! If every child in The Gambia had internet access at school, how would you re-design education? Think about it. Discuss it with your classmates."
  },
  {
    id: "giga",
    name: "2. The Giga Story",
    desc: "Rohey talks about Sierra Leone's 90% cost drop ($12k to $1,500) and Kenya's Kakuma coding center. Maps out Gambia's 1,978 schools.",
    video: "rohey-giga.mp4",
    defaultSubtitles: "What you have imagined is already being accomplished. In Sierra Leone, connectivity dropped from $12,000 to just $1,500. In Kakuma, Darlene is learning to code. Across Kenya, Giga connected 659 schools."
  },
  {
    id: "feedback",
    name: "3. Transformed Classroom (Activity C Pt 1)",
    desc: "Connected classroom visual climax. Tablets on desks, energetic audio, children laughing and coding.",
    video: "connected-classroom.mp4",
    defaultSubtitles: "Tonight, you were asked to imagine. Maybe you imagined a girl in rural Gambia learning from scientists, or teachers getting training. I want you to see what you described. This is connectivity."
  },
  {
    id: "closing",
    name: "4. Parting Lesson & Dismissal",
    desc: "Closing remarks. The best teachers don't give answers, they give questions and the courage to act.",
    video: "rohey-closing.mp4",
    defaultSubtitles: "You know, the best teachers don't give students answers. They give them the right question and the courage to act on it. My thirty-two students are counting on your courage. Class dismissed."
  }
];

// Pre-defined Live Speech Quick-Sends (matches the script exchanges)
const LIVE_SPEECH_QUICK_SENS = [
  {
    label: "Class Settle Down",
    text: "Right class, settle down please. I hope you had enough time to think about my question, because class is back in session."
  },
  {
    label: "Ask for Ideas",
    text: "So tell me class, what did you discuss? Don't be shy. It's just a classroom discussion; it's not like you are talking in front of a room full of ministers."
  },
  {
    label: "Remote Learning Reply",
    text: "Yes! A classroom without walls. Imagine my students in Basse logging into the same lesson as a child in Banjul, Dakar, or Lagos. That's not a dream."
  },
  {
    label: "Teacher Training Reply",
    text: "Thank you, finally someone who remembers us! Teachers are backbones. Train the teachers, connect the schools, then watch what becomes possible."
  },
  {
    label: "AI & Technology Reply",
    text: "Safe use of AI for learning, I am a big fan of, obviously. But here is the thing: AI is only as useful as the connection it runs on. No internet, no AI."
  },
  {
    label: "Homework Joke Pivot",
    text: "You have given me a lot to work with – this is a case of students giving their teacher homework. What a clever class you are! Look at what we can accomplish..."
  },
  {
    label: "Telehealth Investment Case",
    text: "Furthermore, our mapped health facilities will become nodes of modern telehealth, bringing specialist pediatric care and life-saving diagnoses directly to rural villages, bypassing hours of difficult travel."
  },
  {
    label: "Commitment Card Intro",
    text: "My lovely class monitors in blue shirts will come to each of your tables in a moment. They have cards. They want to hear your answer tonight."
  },
  {
    label: "Share commitments",
    text: "Now, I'd love some of you to share what you wrote down. Raise your hand and share please. Don't be shy."
  },
  {
    label: "Walk the Talk",
    text: "These are fantastic ideas. Please do not let this be just a talk. We all must walk the talk - our children are counting on you."
  }
];

export default function OperatorConsole() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [customSubtitles, setCustomSubtitles] = useState("");
  const [syncing, setSyncing] = useState(false);

  // Sync state from Firestore
  useEffect(() => {
    const docRef = doc(db, "sessions", "unicef");
    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        setLoading(false);
        setOffline(false);
        if (snap.exists()) {
          setSession(snap.data() as SessionState);
        } else {
          // Initialize database state if missing
          const defaultState: SessionState = {
            currentSegmentId: "welcome",
            mode: "video",
            gesture: "none",
            subtitles: "Good evening, class. Welcome to my classroom...",
            isPlaying: false,
            activeVisual: "none",
            updatedAt: Date.now(),
          };
          setDoc(docRef, defaultState).catch(() => {});
          setSession(defaultState);
        }
      },
      (error) => {
        console.error("Firestore session watch failed:", error);
        setOffline(true);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Set general session state in Firestore
  const updateSession = async (updates: Partial<SessionState>) => {
    if (!session) return;
    setSyncing(true);
    const docRef = doc(db, "sessions", "unicef");
    const updated = {
      ...session,
      ...updates,
      updatedAt: Date.now(),
    };
    try {
      await setDoc(docRef, updated);
    } catch (err) {
      console.error("Error syncing operator state:", err);
      alert("Sync failed! Check network permissions.");
    } finally {
      setSyncing(false);
    }
  };

  // Helper to trigger specific video segments
  const triggerSegment = (segmentId: string, text: string) => {
    updateSession({
      currentSegmentId: segmentId,
      mode: "video",
      subtitles: text,
      isPlaying: true,
      activeVisual: "none", // clear any temporary slides
    });
  };

  // Helper to activate live standby mode (nods)
  const triggerStandby = () => {
    updateSession({
      currentSegmentId: "listening",
      mode: "avatar",
      subtitles: "(Rohey is listening and nodding encouragingly to the audience...)",
      gesture: "none",
    });
  };

  // Trigger physical gesture signals on stage
  const triggerGesture = (gesture: string) => {
    let actionText = "";
    if (gesture === "left") actionText = "*Points left toward tables 1 & 2*";
    else if (gesture === "right") actionText = "*Points right toward tables 3 & 4*";
    else if (gesture === "center") actionText = "*Looks and gestures center class*";
    else actionText = "(Listening and nodding attentively...)";

    updateSession({
      gesture,
      subtitles: actionText,
    });
  };

  // Submit typed custom subtitles
  const submitCustomSubtitles = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSubtitles.trim()) return;
    updateSession({ subtitles: customSubtitles.trim() });
    setCustomSubtitles("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070809] flex flex-col items-center justify-center text-white">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-400 mb-4" />
        <span className="text-xs font-mono text-neutral-500">ESTABLISHING FEED...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090a] text-neutral-100 flex flex-col justify-between selection:bg-neutral-800">
      
      {/* ── HEADER NAVIGATION ── */}
      <header className="sticky top-0 z-50 bg-[#090a0c]/80 backdrop-blur-md border-b border-white/[0.04] py-4 px-6 md:px-12 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-4">
          <Link 
            href="/"
            className="p-2 bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors border border-white/[0.04]"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-sm font-semibold tracking-tight">Operator Command Panel</h1>
            <p className="text-[10px] text-neutral-500 font-mono">ROHEY REMOTE // DB STATUS</p>
          </div>
        </div>

        {/* Network Status Capsule */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full border bg-white/[0.02] border-white/[0.06]">
          {offline ? (
            <>
              <WifiOff className="w-3.5 h-3.5 text-red-500" />
              <span className="text-[10px] font-mono text-red-400 uppercase font-semibold">OFFLINE</span>
            </>
          ) : (
            <>
              <Wifi className="w-3.5 h-3.5 text-green-500 animate-pulse" />
              <span className="text-[10px] font-mono text-green-400 uppercase font-semibold">SYNCD</span>
            </>
          )}
          {syncing && <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping ml-1" />}
        </div>
      </header>

      {/* ── MAIN TACTILE COMMAND CONSOLE ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: ACTIVE MONITORS & STATE STATUS (SPAN 5) */}
        <div className="lg:col-span-5 flex flex-col gap-6 w-full">
          
          {/* Active Status Display Card */}
          <div className="bg-[#0b0c0f] border border-white/[0.04] rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-600" />
            
            <h2 className="text-xs font-mono font-bold tracking-widest text-neutral-400 uppercase mb-5">
              CURRENT STREAM CONSOLE
            </h2>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-white/[0.03]">
                <span className="text-xs text-neutral-500">PLAYBACK STATE:</span>
                <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${
                  session?.isPlaying ? "text-green-400 bg-green-500/10" : "text-yellow-400 bg-yellow-500/10"
                }`}>
                  {session?.isPlaying ? "STREAMING" : "PAUSED"}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-white/[0.03]">
                <span className="text-xs text-neutral-500">AVATAR STATE:</span>
                <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${
                  session?.mode === "video" ? "text-blue-400 bg-blue-500/10" : "text-purple-400 bg-purple-500/10"
                }`}>
                  {session?.mode === "video" ? "CHAPTER PLAYBACK" : "LIVE STANDBY"}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-white/[0.03]">
                <span className="text-xs text-neutral-500">ACTIVE CHAPTER:</span>
                <span className="text-xs font-mono font-bold text-white uppercase bg-neutral-900 px-2 py-0.5 rounded border border-white/[0.04]">
                  {session?.currentSegmentId || "NONE"}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-white/[0.03]">
                <span className="text-xs text-neutral-500">ACTIVE SLIDE:</span>
                <span className="text-xs font-mono font-semibold text-pink-400">
                  {session?.activeVisual?.toUpperCase() || "NONE"}
                </span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span className="text-xs text-neutral-500">GESTURE CUE:</span>
                <span className="text-xs font-mono font-semibold text-purple-400 uppercase">
                  {session?.gesture || "NONE"}
                </span>
              </div>
            </div>

            {/* Micro Monitor Playback Bar */}
            <div className="mt-8 flex gap-4">
              <button
                onClick={() => updateSession({ isPlaying: true })}
                className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold tracking-wider border transition-all cursor-pointer ${
                  session?.isPlaying 
                    ? "bg-green-500 text-black border-green-500 shadow-md shadow-green-500/10" 
                    : "bg-[#101114] text-neutral-400 border-white/[0.04] hover:border-white/[0.1] hover:text-white"
                }`}
              >
                <Play size={14} className="fill-current" /> PLAY STREAM
              </button>
              <button
                onClick={() => updateSession({ isPlaying: false })}
                className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold tracking-wider border transition-all cursor-pointer ${
                  !session?.isPlaying 
                    ? "bg-yellow-500 text-black border-yellow-500 shadow-md shadow-yellow-500/10" 
                    : "bg-[#101114] text-neutral-400 border-white/[0.04] hover:border-white/[0.1] hover:text-white"
                }`}
              >
                <Pause size={14} className="fill-current" /> PAUSE STREAM
              </button>
            </div>
          </div>

          {/* Real-time Subtitles Monitor Box */}
          <div className="bg-[#0b0c0f] border border-white/[0.04] rounded-2xl p-6 shadow-xl">
            <h2 className="text-xs font-mono font-bold tracking-widest text-neutral-400 uppercase mb-4">
              PROJECTOR SUBTITLES PREVIEW
            </h2>
            <div className="bg-[#0e0f12] rounded-xl p-5 border border-white/[0.02] min-h-[100px] flex items-center justify-center text-center">
              <p className="text-base font-serif italic text-neutral-200 leading-relaxed">
                &ldquo;{session?.subtitles || "(No subtitles active)"}&rdquo;
              </p>
            </div>
          </div>

          {/* Stage Quick Launcher Links */}
          <div className="bg-[#0b0c0f] border border-white/[0.04] rounded-2xl p-6 shadow-xl flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Eye size={18} />
              </div>
              <div className="text-left">
                <h4 className="text-xs font-bold text-white">PROJECTOR WINDOW</h4>
                <p className="text-[10px] text-neutral-500 leading-none mt-1">Open stage on dining monitor</p>
              </div>
            </div>
            <Link 
              href="/stage" 
              target="_blank"
              className="text-xs font-mono font-semibold text-blue-400 bg-blue-500/5 hover:bg-blue-500/15 border border-blue-500/20 px-4 py-2 rounded-xl transition-all"
            >
              OPEN STAGE →
            </Link>
          </div>

        </div>

        {/* RIGHT COLUMN: CONTROLLER ACTIONS MATRIX (SPAN 7) */}
        <div className="lg:col-span-7 flex flex-col gap-6 w-full">
          
          {/* Action 1: Pre-recorded Chapters */}
          <div className="bg-[#0b0c0f] border border-white/[0.04] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xs font-mono font-bold tracking-widest text-neutral-400 uppercase">
                TRIGGER PRE-RECORDED CHAPTERS
              </h2>
              <span className="text-[9px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                VIDEO FEED
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PRE_RECORDED_SEGMENTS.map((seg) => {
                const isActive = session?.currentSegmentId === seg.id && session?.mode === "video";
                return (
                  <button
                    key={seg.id}
                    onClick={() => triggerSegment(seg.id, seg.defaultSubtitles)}
                    className={`text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                      isActive
                        ? "bg-white border-white text-black shadow-lg"
                        : "bg-[#111216] border-white/[0.03] hover:bg-[#15171c] hover:border-white/[0.1] text-white"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold font-sans tracking-tight">{seg.name}</span>
                      <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded ${
                        isActive ? "bg-black text-white" : "bg-neutral-800 text-neutral-500"
                      }`}>
                        {isActive ? "LIVE" : "TRIGGER"}
                      </span>
                    </div>
                    <p className={`text-[10px] leading-relaxed font-sans ${isActive ? "text-neutral-700" : "text-neutral-500"}`}>
                      {seg.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action 2: Live Standby & Active Nod Loops */}
          <div className="bg-[#0b0c0f] border border-white/[0.04] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xs font-mono font-bold tracking-widest text-neutral-400 uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                LIVE AVATAR - INTERACTION CONSOLE
              </h2>
              <button
                onClick={triggerStandby}
                className={`py-1.5 px-4 rounded-full text-[10px] font-bold font-mono tracking-widest uppercase transition-all cursor-pointer ${
                  session?.mode === "avatar" && session?.currentSegmentId === "listening"
                    ? "bg-purple-500 text-black shadow-md shadow-purple-500/10 border border-purple-500"
                    : "bg-[#121316] text-purple-400 border border-purple-500/20 hover:bg-[#1c1d24]"
                }`}
              >
                ACTIVATE ACTIVE LISTENING LOOP
              </button>
            </div>

            {/* Grid for gestures & pointing */}
            <div className="border-t border-white/[0.03] pt-5 mb-6">
              <span className="block text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3.5">
                Avatar Physical Pointing & Gestures
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  onClick={() => triggerGesture("left")}
                  className={`py-3 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    session?.gesture === "left" && session?.mode === "avatar"
                      ? "bg-purple-500 text-black border-purple-500"
                      : "bg-[#111216] border-white/[0.03] hover:bg-neutral-900 text-neutral-400 hover:text-white"
                  }`}
                >
                  <Hand size={13} className="rotate-[-45deg]" /> Point Left
                </button>
                <button
                  onClick={() => triggerGesture("center")}
                  className={`py-3 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    session?.gesture === "center" && session?.mode === "avatar"
                      ? "bg-purple-500 text-black border-purple-500"
                      : "bg-[#111216] border-white/[0.03] hover:bg-neutral-900 text-neutral-400 hover:text-white"
                  }`}
                >
                  <Hand size={13} /> Look Center
                </button>
                <button
                  onClick={() => triggerGesture("right")}
                  className={`py-3 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    session?.gesture === "right" && session?.mode === "avatar"
                      ? "bg-purple-500 text-black border-purple-500"
                      : "bg-[#111216] border-white/[0.03] hover:bg-neutral-900 text-neutral-400 hover:text-white"
                  }`}
                >
                  <Hand size={13} className="rotate-[45deg]" /> Point Right
                </button>
                <button
                  onClick={() => triggerGesture("none")}
                  className="py-3 px-3 rounded-xl bg-neutral-900 border border-white/[0.03] hover:border-white/[0.1] text-xs font-semibold text-neutral-500 hover:text-white transition-all cursor-pointer"
                >
                  Clear Pose
                </button>
              </div>
            </div>

            {/* Visual Slide-In Controllers */}
            <div className="border-t border-white/[0.03] pt-5">
              <span className="block text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3.5">
                Projector Overlay Visual Panels
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  onClick={() => updateSession({ activeVisual: "map" })}
                  className={`py-3 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    session?.activeVisual === "map"
                      ? "bg-pink-500 text-black border-pink-500"
                      : "bg-[#111216] border-white/[0.03] hover:bg-neutral-900 text-neutral-400 hover:text-white"
                  }`}
                >
                  <Map size={13} /> Show Giga Map
                </button>
                <button
                  onClick={() => updateSession({ activeVisual: "kenya" })}
                  className={`py-3 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    session?.activeVisual === "kenya"
                      ? "bg-pink-500 text-black border-pink-500"
                      : "bg-[#111216] border-white/[0.03] hover:bg-neutral-900 text-neutral-400 hover:text-white"
                  }`}
                >
                  <ImageIcon size={13} /> Show Kenya Photo
                </button>
                <button
                  onClick={() => updateSession({ activeVisual: "unicef" })}
                  className={`py-3 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    session?.activeVisual === "unicef"
                      ? "bg-pink-500 text-black border-pink-500"
                      : "bg-[#111216] border-white/[0.03] hover:bg-neutral-900 text-neutral-400 hover:text-white"
                  }`}
                >
                  <Sparkles size={13} /> Show UNICEF Logo
                </button>
                <button
                  onClick={() => updateSession({ activeVisual: "none" })}
                  className="py-3 px-3 rounded-xl bg-neutral-900 border border-white/[0.03] hover:border-white/[0.1] text-xs font-semibold text-neutral-500 hover:text-white transition-all cursor-pointer"
                >
                  Clear Visual
                </button>
              </div>
            </div>
          </div>

          {/* Action 3: Speech Quick-Saves */}
          <div className="bg-[#0b0c0f] border border-white/[0.04] rounded-2xl p-6 shadow-xl">
            <h2 className="text-xs font-mono font-bold tracking-widest text-neutral-400 uppercase mb-5">
              LIVE SPEECE SUBTITLE QUICK-SANDS
            </h2>
            <div className="flex flex-wrap gap-2">
              {LIVE_SPEECH_QUICK_SENS.map((item) => (
                <button
                  key={item.label}
                  onClick={() => updateSession({ subtitles: item.text, mode: "avatar" })}
                  className="px-3.5 py-2.5 rounded-lg bg-[#111216] border border-white/[0.03] hover:bg-[#1d1f27] hover:border-purple-500/20 text-xs font-medium text-neutral-300 hover:text-white transition-all cursor-pointer max-w-full truncate"
                  title={item.text}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action 4: Custom Subtitles Transmitter */}
          <div className="bg-[#0b0c0f] border border-white/[0.04] rounded-2xl p-6 shadow-xl">
            <h2 className="text-xs font-mono font-bold tracking-widest text-neutral-400 uppercase mb-4">
              CUSTOM SUBTITLE TRANSMITTER
            </h2>
            <form onSubmit={submitCustomSubtitles} className="flex gap-3">
              <input
                type="text"
                value={customSubtitles}
                onChange={(e) => setCustomSubtitles(e.target.value)}
                placeholder="Type what Rohey says live in the room..."
                className="flex-1 px-4 py-3.5 rounded-xl bg-[#121316] border border-white/[0.05] text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition-all font-sans"
              />
              <button
                type="submit"
                className="px-5 py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-black hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer"
              >
                <Send size={13} className="stroke-[2.5]" /> TRANSMIT
              </button>
            </form>
          </div>

        </div>

      </main>

      {/* ── FOOTER STATUS ── */}
      <footer className="w-full bg-[#070809] border-t border-white/[0.04] py-5 text-center mt-12">
        <p className="text-[10px] text-neutral-600 font-mono tracking-widest uppercase">
          Supported by Kids Edutainment Labs × UNICEF Gambia © 2026
        </p>
      </footer>

    </div>
  );
}
