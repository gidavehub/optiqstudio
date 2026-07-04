"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

// Helper to format track durations nicely
function formatTime(seconds: number) {
  if (isNaN(seconds) || seconds === Infinity) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

// Modular, deconstructed lesson segments matching the master timeline
const LESSON_SEGMENTS = [
  {
    id: "welcome",
    title: "1. Welcome & Introduction",
    description: "Teacher Rohey walks in, welcoming high-level guests (Nafisa, Stephane, Turker, Franklin, Karl, Imma) to her classroom and presenting the core question: how would they redesign education if every child had internet access?",
    videoUrl: "/media/rohey-hello.mp4",
    audioUrl: "/media/rohey-hello.wav",
    transcript: "Good evening, class. I wasn't expecting the class to be so full... Nafisa, lovely to have you with us... Stephane, Turker, good evening. Ah, Franklin, Karl, and Imma! Welcome... Welcome to my classroom. I know it's not much... There are 1,978 schools in The Gambia. Look at all the red dots on the map—they are unconnected. If every child in The Gambia had internet access at school, how would you re-design education? Think about the question. Discuss it during the break. I will be back.",
    prompt: "Bring this avatar to life. Rohey is speaking, smiling, and waving hello warmly, greeting Nafisa, Stephane, Franklin, Karl, Imma. Static background."
  },
  {
    id: "listening",
    title: "2. Active Standby & Listening Loop",
    description: "During student collaboration, dinner service, or break times, Rohey enters an active listening state, naturally blinking and nodding to maintain physical presence and connection.",
    videoUrl: "/media/rohey-listening.mp4",
    audioUrl: null, // Silent loop
    transcript: "(The teacher stands at the front of the classroom, nodding and smiling in quiet encouragement as the students discuss among themselves.)",
    prompt: "Bring this avatar to life. Rohey is in silent listening mode, looking forward, nodding head slightly, blinking naturally. No speech. Static background."
  },
  {
    id: "giga",
    title: "3. The Giga Connectivity Story",
    description: "Rohey returns to share real-world Giga data, explaining how Sierra Leone cut school connection costs by 90% and how the Gambian government is mapping every health and educational node.",
    videoUrl: "/media/rohey-giga.mp4",
    audioUrl: "/media/rohey-giga.wav",
    transcript: "What you have imagined is already being accomplished. In Sierra Leone, connecting a school dropped from $12,000 to just $1,500 per year—a 90% drop! In Kakuma refugee camp in Kenya, Darlene is learning to code. Across Kenya, Giga connected 659 schools... And here in The Gambia? Our VP signed the letter of interest in May. Every single one of the 1,978 schools is now mapped. Data from health facilities is being added. What we need now is the doing.",
    prompt: "Bring this avatar to life. Rohey is explaining Giga with enthusiasm, gesturing naturally, talking and teaching about unmapped schools. Static background."
  },
  {
    id: "feedback",
    title: "4. Student Response & Feedback (Transformed Classroom)",
    description: "The connected classroom transforms. Lights up, colorful, devices on desks, children engaged. A striking contrast with Video 1.",
    videoUrl: "/media/connected-classroom.mp4",
    audioUrl: "/media/rohey-feedback.wav",
    transcript: "Right class, settle down please... So tell me class, what did you discuss? Don't be shy, it's not like you're talking in front of a room full of ministers and diplomats! Yes, remote learning—a classroom without walls! Imagine Basse connected to Dakar, Lagos... Teacher training? Finally, someone remembers us! No internet, no AI. It's that simple.",
    prompt: "An active, bright, modern school classroom in The Gambia filled with tablets on every desk and children laughing, working together, and coding. Rohey stands at the front, beaming with quiet pride, animated premium cinematic footage."
  },
  {
    id: "closing",
    title: "5. Parting Lesson & Dismissal",
    description: "The lesson concludes with an inspiring call to action, encouraging students to find the courage to solve hard problems, followed by a graceful bow and waves goodbye.",
    videoUrl: "/media/rohey-closing.mp4",
    audioUrl: "/media/rohey-closing.wav",
    transcript: "You know, when I started teaching, someone told me: the best teachers don't give students answers. They give them the right question and the courage to act on it. You have had the question all evening. My thirty-two students are counting on your courage. Class dismissed.",
    prompt: "Bring this avatar to life. Rohey gives a moving parting lesson, bows gracefully, smiles, and waves goodbye to the class. Static background."
  }
];

// Audio library browse data
const AUDIO_LIBRARY = [
  {
    id: "rohey-hello.wav",
    title: "Lesson Segment 1: Welcome & Introduction",
    url: "/media/rohey-hello.wav",
    accent: "Vibrant young Gambian female teacher, warm and friendly tone",
    transcript: "Good evening, class. I wasn't expecting the class to be so full... Nafisa, lovely to have you with us... Stephane, Turker, good evening. Ah, Franklin, Karl, and Imma! Welcome... Welcome to my classroom. I know it's not much... There are 1,978 schools in The Gambia. Look at all the red dots on the map—they are unconnected. If every child in The Gambia had internet access at school, how would you re-design education? Think about the question. Discuss it during the break. I will be back."
  },
  {
    id: "rohey-giga.wav",
    title: "Lesson Segment 3: The Giga Connectivity Story",
    url: "/media/rohey-giga.wav",
    accent: "Inspiring, passionate, and vibrant young Gambian lady, professional pacing",
    transcript: "What you have imagined is already being accomplished. In Sierra Leone, connecting a school dropped from $12,000 to just $1,500 per year—a 90% drop! In Kakuma refugee camp in Kenya, Darlene is learning to code. Across Kenya, Giga connected 659 schools... And here in The Gambia? Our VP signed the letter of interest in May. Every single one of the 1,978 schools is now mapped. Data from health facilities is being added. What we need now is the doing."
  },
  {
    id: "rohey-feedback.wav",
    title: "Lesson Segment 4: Student Response & Feedback",
    url: "/media/rohey-feedback.wav",
    accent: "Highly engaging, warm, conversational, and energetic Gambian voice",
    transcript: "Right class, settle down please... So tell me class, what did you discuss? Don't be shy, it's not like you're talking in front of a room full of ministers and diplomats! Yes, remote learning—a classroom without walls! Imagine Basse connected to Dakar, Lagos... Teacher training? Finally, someone remembers us! No internet, no AI. It's that simple."
  },
  {
    id: "rohey-closing.wav",
    title: "Lesson Segment 5: Parting Lesson & Dismissal",
    url: "/media/rohey-closing.wav",
    accent: "Moving, warm, and inspiring young Gambian voice with emotional clarity",
    transcript: "You know, when I started teaching, someone told me: the best teachers don't give students answers. They give them the right question and the courage to act on it. You have had the question all evening. My thirty-two students are counting on your courage. Class dismissed."
  }
];

function ScrollingLessonSection({ 
  title, 
  description, 
  videoUrl, 
  audioUrl, 
  transcript, 
  prompt 
}: { 
  title: string; 
  description: string; 
  videoUrl: string; 
  audioUrl: string | null; 
  transcript: string; 
  prompt: string; 
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [inView, setInView] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false); // Play original video audio by default

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
      },
      {
        threshold: 0.3,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const onLoadedMetadata = () => {
      setDuration(video.duration || 0);
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (inView) {
      video.muted = isMuted;
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [inView, isMuted]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    const video = videoRef.current;
    if (video) {
      video.muted = nextMute;
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * duration;

    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  return (
    <div ref={containerRef} className="py-20 md:py-28 w-full max-w-4xl mx-auto flex flex-col items-center text-center px-6">
      <h3 className="text-2xl md:text-3xl font-semibold text-[#1f2023] tracking-tight mb-4 animate-fade-in">
        {title}
      </h3>
      
      <p className="text-neutral-500 text-sm md:text-base max-w-2xl leading-relaxed mb-10 font-normal">
        {description}
      </p>

      {/* Video Container */}
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-[#fafafa] border border-neutral-100 shadow-sm mb-6 group">
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          loop
          muted={isMuted}
          className="w-full h-full object-cover"
        />

        {isMuted && (
          <button
            onClick={toggleMute}
            className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-md text-[#1f2023] text-xs font-semibold px-4 py-2 rounded-full shadow-md border border-neutral-200/50 flex items-center gap-2 hover:bg-white hover:scale-105 transition-all z-10"
          >
            <svg className="w-3.5 h-3.5 fill-current animate-pulse text-red-500" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </svg>
            Click to Hear Video's Original Audio
          </button>
        )}
      </div>

      {/* Media Controller Bar */}
      <div className="w-full max-w-2xl bg-neutral-50/60 border border-neutral-100/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-[#1f2023] hover:bg-neutral-800 text-white transition-all shadow-sm shrink-0"
            title={isPlaying ? "Pause Lesson" : "Play Lesson"}
          >
            {isPlaying ? (
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 fill-current translate-x-0.5" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <div className="text-left">
            <span className="text-xs font-semibold text-neutral-800 block">
              {isPlaying ? "Playing Lesson" : "Lesson Paused"}
            </span>
            <span className="text-[10px] text-neutral-400 font-mono">
              {formatTime(currentTime)} / {formatTime(duration || 10)}
            </span>
          </div>
        </div>

        {/* Progress seek timeline */}
        <div className="flex-1 w-full sm:mx-4">
          <div 
            onClick={handleSeek}
            className="relative w-full h-1.5 bg-neutral-200/60 rounded-full cursor-pointer overflow-hidden hover:h-2 transition-all"
          >
            <div 
              className="absolute top-0 left-0 h-full bg-[#1f2023] transition-all duration-75"
              style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Sound toggle action */}
        <button
          onClick={toggleMute}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-xs font-medium transition-all ${
            !isMuted 
              ? "bg-neutral-100 border-neutral-300 text-neutral-800 font-semibold" 
              : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50 shadow-sm"
          }`}
        >
          {isMuted ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
              Unmute Original Audio
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 fill-current text-green-600" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V3L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
              Video Sound On
            </>
          )}
        </button>
      </div>

      {/* Transcript & Prompt Display */}
      <div className="max-w-2xl">
        <p className="text-neutral-800 text-base md:text-lg leading-relaxed italic mb-5 font-serif px-4">
          &ldquo;{transcript}&rdquo;
        </p>
        <div className="text-neutral-400 text-xs font-mono tracking-wide">
          Prompt: {prompt}
        </div>
      </div>
    </div>
  );
}

// Custom Player component for the Browse Audio Section
function AudioLibraryPlayer({ 
  title, 
  url, 
  accent, 
  transcript,
  filename
}: { 
  title: string; 
  url: string; 
  accent: string; 
  transcript: string;
  filename: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      const allAudios = document.querySelectorAll("audio");
      allAudios.forEach((a) => {
        if (a !== audio) a.pause();
      });
      
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    audio.currentTime = percentage * duration;
    setCurrentTime(audio.currentTime);
  };

  return (
    <div className="bg-white border border-neutral-100 rounded-2xl p-6 flex flex-col hover:shadow-md transition-all duration-300">
      <audio ref={audioRef} src={url} />
      
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="text-left">
          <h4 className="text-base font-semibold text-neutral-800 tracking-tight">
            {title}
          </h4>
          <span className="text-xs text-neutral-400 font-medium font-sans">
            File: {filename}
          </span>
        </div>
        
        {/* Animated Equalizer Waveform Indicator */}
        <div className="flex items-center gap-0.5 h-5 shrink-0 px-2 bg-neutral-50 rounded-full border border-neutral-100/50">
          {[1, 2, 3, 4, 5].map((bar) => (
            <div
              key={bar}
              className={`w-0.5 bg-[#1f2023] rounded-full ${
                isPlaying ? "animate-wave" : "h-1.5"
              }`}
              style={{
                animationDelay: `${bar * 0.15}s`,
                height: isPlaying ? undefined : "6px"
              }}
            />
          ))}
        </div>
      </div>

      <div className="text-left mb-4">
        <span className="inline-block text-[10px] font-semibold text-neutral-500 uppercase tracking-widest bg-neutral-100 px-2.5 py-0.5 rounded-full font-mono mb-2">
          {accent}
        </span>
        <p className="text-neutral-500 text-xs leading-relaxed font-serif italic border-l-2 border-neutral-100 pl-3 py-1">
          &ldquo;{transcript}&rdquo;
        </p>
      </div>

      {/* Audio Control Segment */}
      <div className="flex items-center gap-3 mt-auto pt-4 border-t border-neutral-50">
        <button
          onClick={togglePlay}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-[#1f2023] hover:bg-neutral-800 text-white transition-all shadow-sm shrink-0"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 fill-current translate-x-0.5" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Timeline Slider */}
        <div className="flex-1">
          <div 
            onClick={handleSeek}
            className="relative w-full h-1 bg-neutral-100 rounded-full cursor-pointer hover:h-1.5 transition-all"
          >
            <div 
              className="absolute top-0 left-0 h-full bg-[#1f2023]"
              style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Time display */}
        <span className="text-[10px] text-neutral-400 font-mono shrink-0">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* Download Button */}
        <a
          href={url}
          download={filename}
          className="flex items-center justify-center w-8 h-8 rounded-full border border-neutral-200 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50 transition-all shadow-sm shrink-0 ml-1"
          title="Download WAV Audio"
        >
          <svg className="w-3.5 h-3.5 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </a>
      </div>
    </div>
  );
}

const CONTROL_STATES = {
  welcome: {
    id: "welcome",
    name: "1. Welcome Intro",
    status: "Active Lecture - Speaking",
    video: "rohey-hello.mp4",
    audio: "rohey-hello.wav (unmuted)",
    rule: "onInit -> Trigger Session Welcome",
    waveform: "active",
    transcript: "Good evening, class. Welcome to my classroom... If every child in The Gambia had internet access at school, how would you re-design education?"
  },
  listening: {
    id: "listening",
    name: "2. Active Standby",
    status: "Standby Listening Loop",
    video: "rohey-listening.mp4",
    audio: "Silent loop (original camera ambient)",
    rule: "onIdle -> Loop while students collaborate",
    waveform: "idle",
    transcript: "(Teacher Rohey stands at the front of the classroom, nodding and smiling in quiet encouragement as the students discuss...)"
  },
  giga: {
    id: "giga",
    name: "3. Giga Story",
    status: "Active Lecture - Speaking",
    video: "rohey-giga.mp4",
    audio: "rohey-giga.wav (unmuted)",
    rule: "onTrigger -> Giga connectivity presentation",
    waveform: "active",
    transcript: "What you have imagined is already being accomplished. In Sierra Leone, connecting a school dropped from $12,000 to just $1,500..."
  },
  feedback: {
    id: "feedback",
    name: "4. Smart Feedback",
    status: "Active Feedback - Speaking",
    video: "connected-classroom.mp4",
    audio: "rohey-feedback.wav (unmuted)",
    rule: "onStudentResponse -> Affirm and challenge class",
    waveform: "active",
    transcript: "Right class, settle down please... Yes, remote learning—a classroom without walls! Imagine Basse connected to Dakar, Lagos..."
  },
  closing: {
    id: "closing",
    name: "5. Parting & Dismissal",
    status: "Closing Address - Speaking",
    video: "rohey-closing.mp4",
    audio: "rohey-closing.wav (unmuted)",
    rule: "onEnd -> Conclude and release classroom",
    waveform: "active",
    transcript: "The best teachers don't give students answers. They give them the right question and the courage to act on it. Class dismissed."
  }
} as const;

type ControlStateId = keyof typeof CONTROL_STATES;

export default function PlanPage() {
  const [activeControlState, setActiveControlState] = useState<ControlStateId>("welcome");

  return (
    <div className="min-h-screen bg-white text-[#1f2023] selection:bg-neutral-100 selection:text-black">
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes wave-bounce {
          0%, 100% { height: 4px; }
          50% { height: 16px; }
        }
        .animate-wave {
          animation: wave-bounce 0.8s ease-in-out infinite;
        }

        /* Technical animations for the Schematic */
        @keyframes dash-slide {
          to {
            stroke-dashoffset: -20;
          }
        }
        .active-path {
          stroke: #1f2023;
          stroke-width: 3;
          stroke-linecap: round;
          stroke-dasharray: 6, 6;
          animation: dash-slide 1.2s linear infinite;
        }
        @keyframes pulse-router {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.45; }
        }
        .pulse-outer {
          animation: pulse-router 2s ease-in-out infinite;
        }
        @keyframes blink-record {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        .animate-blink-dot {
          animation: blink-record 1.2s ease-in-out infinite;
        }

        /* Mock Screen Waveforms */
        @keyframes bar-grow-1 {
          0%, 100% { height: 8px; }
          50% { height: 28px; }
        }
        @keyframes bar-grow-2 {
          0%, 100% { height: 4px; }
          50% { height: 20px; }
        }
        @keyframes bar-grow-3 {
          0%, 100% { height: 12px; }
          50% { height: 36px; }
        }
        .animate-bar-1 { animation: bar-grow-1 0.6s ease-in-out infinite; }
        .animate-bar-2 { animation: bar-grow-2 0.7s ease-in-out infinite; }
        .animate-bar-3 { animation: bar-grow-3 0.5s ease-in-out infinite; }
      ` }} />

      {/* ── ULTRA-MINIMAL HEADER ── */}
      <header className="w-full bg-white border-b border-neutral-100 py-5 px-8 md:px-16 flex justify-between items-center sticky top-0 z-50 shadow-xs">
        <div className="flex items-center gap-4">
          <Link 
            href="/"
            className="text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white px-3.5 py-1.5 rounded-lg transition-all"
          >
            ← Session Launcher
          </Link>
          <span className="text-sm font-semibold tracking-tight text-neutral-800 font-sans hidden sm:inline">
            Virtual Teacher Project Plan
          </span>
        </div>
        <span className="text-xs font-semibold text-neutral-400 font-sans">
          Kids Edutainment Labs × UNICEF Gambia
        </span>
      </header>

      {/* ── CENTRAL STORYFLOW ── */}
      <main className="w-full max-w-4xl mx-auto px-6 md:px-0">
        
        {/* TOP INTRO TEXT BLOCK */}
        <section className="pt-20 pb-12 text-center max-w-3xl mx-auto flex flex-col items-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-4 font-mono">
            Event Script & Implementation Roadmap
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold text-[#1f2023] leading-tight tracking-tight max-w-2xl">
            Bringing UNICEF’s Virtual Teacher to Life in The Gambia
          </h2>
          <p className="text-neutral-500 text-base md:text-lg mt-6 leading-relaxed max-w-2xl font-normal">
            By decomposing long lesson scripts into high-quality, modular segments, we build a seamless educational experience. A single consistent reference avatar anchors each reactive visual response dynamically.
          </p>
        </section>

        {/* ── SCROLLING LESSON STORYFLOW ── */}
        <section className="divide-y divide-neutral-100">
          
          {LESSON_SEGMENTS.map((segment) => (
            <ScrollingLessonSection
              key={segment.id}
              title={segment.title}
              description={segment.description}
              videoUrl={segment.videoUrl}
              audioUrl={segment.audioUrl}
              transcript={segment.transcript}
              prompt={segment.prompt}
            />
          ))}

          {/* ── MAP SECTION ── */}
          <div className="py-24 md:py-32 w-full max-w-4xl mx-auto flex flex-col items-center text-center px-6">
            <h3 className="text-2xl md:text-3xl font-semibold text-[#1f2023] tracking-tight mb-4">
              Mapping Every School in The Gambia
            </h3>
            <p className="text-neutral-500 text-sm md:text-base max-w-2xl leading-relaxed mb-10">
              UNICEF and Giga have mapped all 1,978 educational institutions across the country, creating the unified baseline data system required to systematically address and close the digital learning gap.
            </p>
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-neutral-100 bg-[#fafafa] shadow-sm">
              <Image 
                src="/media/giga-gambia-map.png" 
                alt="Giga Gambia Map" 
                fill 
                className="object-cover" 
              />
            </div>
          </div>

          {/* ── CONDITIONAL RENDER PIPELINE & DASHBOARD SIMULATOR ── */}
          <div className="py-24 md:py-32 w-full max-w-4xl mx-auto flex flex-col items-center px-6">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="inline-block text-[10px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50 border border-neutral-100 px-3 py-1 rounded-full font-mono mb-4">
                Architecture Blueprint
              </span>
              <h3 className="text-2xl md:text-3xl font-semibold text-[#1f2023] tracking-tight mb-4">
                Conditional Rendering Pipeline
              </h3>
              <p className="text-neutral-500 text-sm md:text-base leading-relaxed">
                Experience how the Virtual Teacher Operator Dashboard triggers seamless, conditional state-transitions. Choose any command state in the console below to trace the decision paths and observe the live-feed simulation.
              </p>
            </div>

            {/* Scrollable Blueprint Grid */}
            <div className="w-full overflow-x-auto pb-6 scrollbar-thin">
              <div className="min-w-[760px] px-4">
                
                {/* SVG Connecting Flow Lines */}
                <svg className="w-full h-28 overflow-visible mb-2" viewBox="0 0 800 112" fill="none">
                  {/* Central Router Node Glow Aura */}
                  <circle cx="400" cy="20" r="20" className="pulse-outer" fill="#1f2023" />

                  {/* Flow Paths to target state boxes */}
                  {/* 1. Welcome Intro (Center: 80, Cy: 96) */}
                  <path d="M 400 20 L 400 45 L 80 45 L 80 96" stroke={activeControlState === "welcome" ? "#1f2023" : "#e5e7eb"} strokeWidth={activeControlState === "welcome" ? 3 : 2} className={activeControlState === "welcome" ? "active-path" : ""} />
                  {/* 2. Active Standby (Center: 240, Cy: 96) */}
                  <path d="M 400 20 L 400 45 L 240 45 L 240 96" stroke={activeControlState === "listening" ? "#1f2023" : "#e5e7eb"} strokeWidth={activeControlState === "listening" ? 3 : 2} className={activeControlState === "listening" ? "active-path" : ""} />
                  {/* 3. Giga Story (Center: 400, Cy: 96) */}
                  <path d="M 400 20 L 400 96" stroke={activeControlState === "giga" ? "#1f2023" : "#e5e7eb"} strokeWidth={activeControlState === "giga" ? 3 : 2} className={activeControlState === "giga" ? "active-path" : ""} />
                  {/* 4. Student Response (Center: 560, Cy: 96) */}
                  <path d="M 400 20 L 400 45 L 560 45 L 560 96" stroke={activeControlState === "feedback" ? "#1f2023" : "#e5e7eb"} strokeWidth={activeControlState === "feedback" ? 3 : 2} className={activeControlState === "feedback" ? "active-path" : ""} />
                  {/* 5. Dismiss Session (Center: 720, Cy: 96) */}
                  <path d="M 400 20 L 400 45 L 720 45 L 720 96" stroke={activeControlState === "closing" ? "#1f2023" : "#e5e7eb"} strokeWidth={activeControlState === "closing" ? 3 : 2} className={activeControlState === "closing" ? "active-path" : ""} />

                  {/* Central Router Node Circle */}
                  <circle cx="400" cy="20" r="10" fill="white" stroke="#1f2023" strokeWidth="2.5" />
                  <circle cx="400" cy="20" r="4" fill="#1f2023" />
                  <text x="400" y="4" textAnchor="middle" className="text-[9px] font-semibold font-mono fill-neutral-400">TELEMETRY ROUTER</text>
                </svg>

                {/* 5-Column HTML Grid */}
                <div className="grid grid-cols-5 gap-4">
                  {(Object.keys(CONTROL_STATES) as ControlStateId[]).map((key) => {
                    const state = CONTROL_STATES[key];
                    const isActive = activeControlState === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setActiveControlState(key)}
                        className={`text-left p-4 rounded-xl border transition-all duration-300 flex flex-col justify-between h-36 relative ${
                          isActive 
                            ? "bg-white border-[#1f2023] shadow-md -translate-y-1" 
                            : "bg-neutral-50/50 border-neutral-100 hover:bg-neutral-50 hover:border-neutral-200"
                        }`}
                      >
                        {/* Glowing node point */}
                        <div className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white transition-colors duration-300 ${
                          isActive ? "bg-[#1f2023]" : "bg-neutral-200"
                        }`} />

                        <div className="pt-2">
                          <span className="block text-[10px] font-semibold text-neutral-400 font-mono mb-1 uppercase tracking-wider">
                            {state.rule.split(" -> ")[0]}
                          </span>
                          <h4 className="text-xs font-semibold text-neutral-800 leading-tight">
                            {state.name.split(". ")[1]}
                          </h4>
                        </div>

                        <div className="border-t border-neutral-100/80 pt-2 mt-2">
                          <span className="block text-[9px] font-mono text-neutral-400 leading-normal truncate">
                            File: {state.video}
                          </span>
                          <span className="block text-[8px] font-mono font-medium text-neutral-500 uppercase mt-0.5">
                            {state.rule.split(" -> ")[1]}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

              </div>
            </div>

            {/* ── MOCK OPERATOR CONTROL PANEL DASHBOARD (Tactile Simulator UI) ── */}
            <div className="w-full mt-10 bg-[#121314] text-white rounded-3xl p-6 md:p-8 border border-neutral-800 shadow-xl relative overflow-hidden">
              {/* Subtle background tech line */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-neutral-500/20 to-transparent" />
              
              <div className="flex flex-col lg:flex-row items-stretch gap-8">
                
                {/* Left Side: Mock Live Feed Video Monitor */}
                <div className="flex-1 bg-black rounded-2xl p-5 border border-neutral-800/80 flex flex-col justify-between relative overflow-hidden aspect-[4/3] lg:aspect-auto min-h-[300px]">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%] pointer-events-none opacity-40" />

                  {/* Monitor Header */}
                  <div className="flex items-center justify-between z-10">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-50 animate-blink-dot" />
                      <span className="text-[10px] font-bold tracking-widest font-mono text-neutral-400 uppercase">
                        LIVE MONITOR // PORT: 3000
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                      STATE: {activeControlState.toUpperCase()}
                    </span>
                  </div>

                  {/* Monitor Center */}
                  <div className="my-auto py-6 flex flex-col items-center justify-center text-center z-10">
                    <div className="w-16 h-16 rounded-full border border-neutral-800 bg-neutral-900/60 flex items-center justify-center mb-4 shadow-inner relative group">
                      <div className={`absolute inset-0 rounded-full border border-neutral-700/50 transition-all duration-700 ${
                        CONTROL_STATES[activeControlState].waveform === "active" 
                          ? "scale-125 opacity-10 animate-ping bg-white" 
                          : "scale-100 opacity-0"
                      }`} />
                      
                      <span className="text-xl font-medium tracking-tight text-neutral-300 font-serif select-none animate-pulse">
                        R
                      </span>
                    </div>

                    {/* Speech / State waveform */}
                    <div className="flex items-end justify-center gap-1.5 h-10 mb-4 px-8 w-full">
                      {CONTROL_STATES[activeControlState].waveform === "active" ? (
                        <>
                          <div className="w-1 bg-white/70 rounded-full animate-bar-1" style={{ animationDelay: "0.1s" }} />
                          <div className="w-1 bg-white/80 rounded-full animate-bar-2" style={{ animationDelay: "0.3s" }} />
                          <div className="w-1 bg-white rounded-full animate-bar-3" style={{ animationDelay: "0s" }} />
                          <div className="w-1 bg-white/90 rounded-full animate-bar-2" style={{ animationDelay: "0.4s" }} />
                          <div className="w-1 bg-white/70 rounded-full animate-bar-1" style={{ animationDelay: "0.2s" }} />
                        </>
                      ) : (
                        <>
                          <div className="w-1 h-1.5 bg-neutral-800 rounded-full transition-all duration-500" />
                          <div className="w-1 h-1 bg-neutral-800 rounded-full transition-all duration-500" />
                          <div className="w-1 h-1.5 bg-neutral-700 rounded-full transition-all duration-500" />
                          <div className="w-1 h-1 bg-neutral-800 rounded-full transition-all duration-500" />
                          <div className="w-1 h-1.5 bg-neutral-800 rounded-full transition-all duration-500" />
                        </>
                      )}
                    </div>

                    <span className="text-xs font-semibold text-neutral-200 uppercase tracking-wider font-mono">
                      {CONTROL_STATES[activeControlState].status}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono mt-1">
                      Render Asset: {CONTROL_STATES[activeControlState].video}
                    </span>
                  </div>

                  {/* Monitor Footer */}
                  <div className="bg-neutral-950/80 border border-neutral-900 rounded-xl p-3 z-10">
                    <span className="block text-[8px] font-mono text-neutral-500 mb-1 tracking-widest uppercase">
                      ACTIVE TRANSCRIPT // TRANSLATION ENGINE
                    </span>
                    <p className="text-xs text-neutral-300 font-serif leading-relaxed italic">
                      &ldquo;{CONTROL_STATES[activeControlState].transcript}&rdquo;
                    </p>
                  </div>
                </div>

                {/* Right Side: Tactile System Dashboard Controls */}
                <div className="w-full lg:w-96 flex flex-col justify-between gap-6">
                  <div>
                    <h4 className="text-sm font-semibold tracking-wider uppercase font-mono text-neutral-400 mb-1">
                      System Operator Panel
                    </h4>
                    <p className="text-xs text-neutral-500 leading-relaxed font-sans">
                      Select a trigger target below to manually override the conditional render tree. The underlying Next.js client router responds with zero-latency buffer swaps.
                    </p>
                  </div>

                  {/* Manual State Select Buttons */}
                  <div className="flex flex-col gap-3">
                    {(Object.keys(CONTROL_STATES) as ControlStateId[]).map((key) => {
                      const state = CONTROL_STATES[key];
                      const isActive = activeControlState === key;
                      return (
                        <button
                          key={key}
                          onClick={() => setActiveControlState(key)}
                          className={`w-full text-left px-4 py-3 rounded-xl border flex items-center justify-between transition-all duration-200 group ${
                            isActive
                              ? "bg-white border-white text-black shadow-lg shadow-white/5 font-semibold"
                              : "bg-neutral-900 border-neutral-800/80 text-neutral-400 hover:bg-neutral-900/60 hover:text-white hover:border-neutral-700"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`w-2.5 h-2.5 rounded-full border transition-all duration-300 ${
                              isActive 
                                ? "bg-[#1f2023] border-[#1f2023] scale-110 shadow-[0_0_8px_rgba(255,255,255,0.6)]" 
                                : "bg-neutral-800 border-neutral-700 group-hover:border-neutral-500"
                            }`} />
                            <span className="text-xs tracking-tight font-sans">
                              {state.name}
                            </span>
                          </div>

                          <span className={`text-[9px] font-mono uppercase tracking-widest ${
                            isActive ? "text-neutral-500 font-medium" : "text-neutral-600"
                          }`}>
                            {isActive ? "ACTIVE" : "STANDBY"}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Operator Status Footer Panel */}
                  <div className="border-t border-neutral-900 pt-4 flex justify-between text-[10px] font-mono text-neutral-500 font-sans">
                    <span>OPERATOR: GLOBAL</span>
                    <span>PING: 4ms</span>
                    <span>STREAM: SYNCHRONIZED</span>
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* ── GENERATED LESSON AUDIO ARCHIVE & EXPLORER ── */}
          <div className="py-24 md:py-32 w-full max-w-4xl mx-auto px-6 text-center">
            <h3 className="text-2xl md:text-3xl font-semibold text-[#1f2023] tracking-tight mb-3">
              Synthesized Voice Profile & Audio Library
            </h3>
            <p className="text-neutral-500 text-sm md:text-base max-w-2xl leading-relaxed mb-12 mx-auto">
              Browse and play the high-fidelity Gambian lesson audio tracks generated using <code className="text-xs bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded font-mono font-medium">gemini-3.1-flash-tts-preview</code>. Our voice instructions specifically model a vibrant young Gambian lady's natural speaking accent.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left max-w-4xl mx-auto">
              {AUDIO_LIBRARY.map((audio) => (
                <AudioLibraryPlayer
                  key={audio.id}
                  title={audio.title}
                  url={audio.url}
                  accent={audio.accent}
                  transcript={audio.transcript}
                  filename={audio.id}
                />
              ))}
            </div>

            {/* ── PIPELINE OPTIMIZATION & BUDGET LEDGER ── */}
            <div className="mt-24 pt-20 border-t border-neutral-100 text-left max-w-4xl mx-auto">
              <div className="text-center max-w-2xl mx-auto mb-12">
                <span className="inline-block text-[10px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50 border border-neutral-100 px-3 py-1 rounded-full font-mono mb-4">
                  Financial Architecture & Efficiency
                </span>
                <h3 className="text-2xl md:text-3xl font-semibold text-[#1f2023] tracking-tight mb-3">
                  Production Cost-Benefit Analysis
                </h3>
                <p className="text-neutral-500 text-xs md:text-sm leading-relaxed">
                  A comparative breakdown detailing why Kids Edutainment Labs engineered a custom rendering pipeline using Optiq Studio rather than subscribing to expensive, rigid commercial platforms.
                </p>
              </div>

              {/* Cost-Benefit Visual Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch mb-12">
                
                {/* HeyGen Platform (Disadvantage) */}
                <div className="bg-neutral-50/50 border border-neutral-100 rounded-2xl p-6 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block mb-2">
                      Alternative Route
                    </span>
                    <h4 className="text-base font-semibold text-neutral-800 mb-3">
                      Commercial Platform (HeyGen)
                    </h4>
                    <p className="text-xs text-neutral-500 leading-relaxed mb-4">
                      Relying on commercial SaaS platforms locks the production process into expensive subscription tiers and rigid templates.
                    </p>
                    
                    <ul className="space-y-2 text-xs text-neutral-500 mb-6">
                      <li className="flex items-start gap-2">
                        <span className="text-red-500 font-bold shrink-0">✕</span>
                        <span>$400+ monthly base subscription fee</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-500 font-bold shrink-0">✕</span>
                        <span>Video credits billed separately on top</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-500 font-bold shrink-0">✕</span>
                        <span>No programmatic support for idle/listening states</span>
                      </li>
                    </ul>
                  </div>

                  <div className="border-t border-neutral-100 pt-4 mt-auto">
                    <span className="block text-[10px] font-mono text-neutral-400 uppercase">Estimated Total Cost</span>
                    <span className="text-xl font-bold text-neutral-700">$700.00 – $900.00</span>
                  </div>
                </div>

                {/* Custom Optiq Studio Pipeline (Advantage) */}
                <div className="bg-white border-2 border-[#1f2023] rounded-2xl p-6 flex flex-col justify-between shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-[#1f2023] text-white text-[8px] font-mono font-bold px-3 py-1 uppercase tracking-widest rounded-bl-xl">
                    Selected
                  </div>

                  <div>
                    <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block mb-2">
                      Engineered Solution
                    </span>
                    <h4 className="text-base font-semibold text-neutral-800 mb-3">
                      Custom Optiq Studio Pipeline
                    </h4>
                    <p className="text-xs text-neutral-500 leading-relaxed mb-4">
                      Decomposing long scripts and running custom AI video/audio nodes provides absolute freedom and direct savings.
                    </p>
                    
                    <ul className="space-y-2 text-xs text-neutral-600 mb-6 font-medium">
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold shrink-0">✓</span>
                        <span>$0.00 base platform subscription fee</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold shrink-0">✓</span>
                        <span>All video chunks generated under $1.00 production cost</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 font-bold shrink-0">✓</span>
                        <span>Seamless custom idle/standby loops</span>
                      </li>
                    </ul>
                  </div>

                  <div className="border-t border-neutral-100 pt-4 mt-auto">
                    <span className="block text-[10px] font-mono text-neutral-400 uppercase">Total Cap Budget</span>
                    <span className="text-xl font-bold text-[#1f2023]">$350.00</span>
                  </div>
                </div>

                {/* Savings Callout Card */}
                <div className="bg-[#1f2023] text-white rounded-2xl p-6 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block mb-2">
                      Financial Efficiency
                    </span>
                    <h4 className="text-base font-semibold mb-3 text-white">
                      Direct Financial Savings
                    </h4>
                    <p className="text-xs text-neutral-400 leading-relaxed mb-4">
                      By avoiding heavy monthly commercial platforms, the project secures immediate capital savings while preserving top-tier quality.
                    </p>

                    <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 mb-4">
                      <div className="flex justify-between text-xs font-mono text-neutral-400 mb-1">
                        <span>Funded Amount:</span>
                        <span className="text-white font-medium">$170.00</span>
                      </div>
                      <div className="flex justify-between text-xs font-mono text-neutral-400 mb-1">
                        <span>Remaining Balance:</span>
                        <span className="text-white font-medium">$180.00</span>
                      </div>
                      <div className="border-t border-neutral-800/80 pt-1.5 mt-1.5 flex justify-between text-xs font-mono text-neutral-300 font-medium">
                        <span>Total Budget:</span>
                        <span className="text-white font-bold">$350.00</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-neutral-800 pt-4 mt-auto">
                    <span className="block text-[10px] font-mono text-neutral-400 uppercase">Net Cost Savings</span>
                    <span className="text-xl font-bold text-green-400">+$350.00 – $550.00 Saved</span>
                  </div>
                </div>

              </div>

              {/* Math / Rationale Callout Box */}
              <div className="bg-neutral-50/40 border border-neutral-100 rounded-2xl p-6">
                <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-widest block mb-2 font-bold">
                  PROJECT ALLOCATION BRIEF
                </span>
                <p className="text-xs text-neutral-500 leading-relaxed font-sans mb-3">
                  Under commercial platform models, subscription packages alone command a <strong>$400.00+ base price point</strong>, with video generation and character tuning adding another <strong>$300.00 to $500.00</strong> to the ledger. This totals an estimated <strong>$700.00 to $900.00</strong>.
                </p>
                <p className="text-xs text-neutral-500 leading-relaxed font-sans">
                  By routing generations directly through the custom <strong>Optiq Studio Pipeline</strong>, we cap our total technical budget at <strong>$350.00</strong>. This all-inclusive allocation fully covers our high-fidelity Gambian lady voice profile tuning, continuous character consistency cards, and direct second-by-second video outputs. Having already funded <strong>$170.00</strong> of our credit ledger, an additional allocation of <strong>$180.00</strong> will fully complete and finalize all remaining lesson generation scenes.
                </p>
              </div>

            </div>

          </div>

        </section>

      </main>

      {/* ── FOOTER ── */}
      <footer className="w-full bg-white border-t border-neutral-100 py-12 text-center mt-24">
        <p className="text-xs text-neutral-400 font-sans tracking-wide">
          © 2026 Kids Edutainment Labs. Supported by UNICEF The Gambia.
        </p>
      </footer>

    </div>
  );
}
