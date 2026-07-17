"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";

export default function LoginPage() {
  const { user, profile, loading, signInGoogle, signInEmail, signUpEmail } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      if (profile && profile.planStatus === "active") {
        router.replace("/dashboard");
      } else if (profile) {
        router.replace("/plans");
      }
    }
  }, [loading, user, profile, router]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace("Firebase: ", "") : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const BACKGROUND_VIDEOS = [
    "/media/template-1.mp4",
    "/media/template-2.mp4",
    "/media/template-3.mp4",
    "/media/template-4.mp4",
    "/media/template-5.mp4",
    "/media/template-6.mp4"
  ];

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-black px-4 sm:px-6 py-12">
      
      {/* Immersive Cinematic Background Video Grid — Responsive 2col Mobile / 3col Desktop */}
      <div className="absolute inset-0 grid grid-cols-2 md:grid-cols-3 gap-2.5 p-2 bg-black pointer-events-none select-none overflow-hidden">
        {BACKGROUND_VIDEOS.map((src, index) => (
          <div 
            key={index} 
            className="relative w-full h-full overflow-hidden rounded-xl bg-neutral-950 border border-white/[0.02]"
          >
            <video
              src={src}
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 w-full h-full object-cover opacity-35 filter saturate-[0.85] contrast-[1.05]"
            />
          </div>
        ))}
      </div>

      {/* Premium Cinematic Vignette / Radial Gradient Edge-Tint */}
      <div className="absolute inset-0 pointer-events-none select-none bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.1)_0%,rgba(0,0,0,0.9)_100%)] bg-gradient-to-b from-black/70 via-transparent to-black" />

      {/* Floating Glassmorphic Authentication Card — Super Transparent & Blended */}
      <div className="relative z-10 w-full max-w-sm p-7 sm:p-9 transition-all duration-300 animate-in fade-in-50 zoom-in-95 bg-transparent">
        
        {/* Brand Logo Header */}
        <div className="text-center mb-8 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] flex flex-col items-center justify-center">
          <Link href="/" className="inline-flex items-center gap-3 text-2xl font-bold tracking-wider text-white hover:text-neutral-300 transition-colors uppercase font-mono select-none">
            <svg width="26" height="26" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
              <circle cx="16" cy="16" r="16" fill="white" />
              <circle cx="16" cy="16" r="8" fill="none" stroke="black" strokeWidth={4} />
            </svg>
            <span>OPTIQ STUDIO</span>
          </Link>
          <p className="text-[10px] text-neutral-400 uppercase tracking-widest mt-2 font-mono">
            Direct Cinema Production
          </p>
        </div>

        <div className="space-y-1 mb-6 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
          <h1 className="text-xl font-bold tracking-tight text-white">
            {mode === "signin" ? "Welcome back" : "Create account"}
          </h1>
          <p className="text-xs text-neutral-300">
            {mode === "signin"
              ? "Your cinematic advertising pipeline is ready."
              : "Set up your direct pipeline and start creating."}
          </p>
        </div>

        {/* Social Authentication */}
        <button
          onClick={() => run(signInGoogle)}
          disabled={busy}
          className="w-full h-11 rounded-xl bg-white text-black hover:bg-neutral-100 text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(255,255,255,0.15)] hover:scale-[1.01]"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.18 1-.78 1.85-1.63 2.42v2.81h2.64c1.55-2.43 2.63-6 2.63-9.52z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-2.64-2.05c-.73.49-1.66.78-2.64.78-2.85 0-5.27-1.92-6.13-4.51H1.08v2.1C2.9 20.12 7.15 23 12 23z" fill="#34A853" />
            <path d="M5.87 14.56c-.22-.66-.35-1.36-.35-2.08s.13-1.42.35-2.08V8.3H1.08C.39 9.64 0 11.14 0 13s.39 3.36 1.08 4.7l4.79-2.14z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.15 1 2.9 3.88 1.08 7.9l4.79 3.7c.86-2.59 3.28-4.51 6.13-4.51z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 my-5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
          <div className="h-px flex-1 bg-white/20" />
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-mono">or</span>
          <div className="h-px flex-1 bg-white/20" />
        </div>

        {/* Traditional Credentials Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() =>
              mode === "signin" ? signInEmail(email, password) : signUpEmail(email, password)
            );
          }}
          className="space-y-3.5"
        >
          <div>
            <input
              type="email"
              required
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 rounded-xl bg-black/75 border border-white/20 px-4 text-xs text-white placeholder:text-neutral-500 focus:border-white focus:ring-1 focus:ring-white outline-none font-medium transition-all shadow-lg"
            />
          </div>
          <div>
            <input
              type="password"
              required
              minLength={6}
              placeholder="Secure password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 rounded-xl bg-black/75 border border-white/20 px-4 text-xs text-white placeholder:text-neutral-500 focus:border-white focus:ring-1 focus:ring-white outline-none font-medium transition-all shadow-lg"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full h-11 rounded-xl bg-white hover:bg-neutral-200 text-xs font-bold text-black transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg hover:scale-[1.01]"
          >
            {busy && <Loader2 size={13} className="animate-spin" />}
            {mode === "signin" ? "Log In with Email" : "Sign Up with Email"}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3.5 text-xs text-red-300 shadow-lg drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
            {error}
          </div>
        )}

        <div className="mt-6 text-center text-xs text-neutral-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
          <span>{mode === "signin" ? "Don't have an account yet?" : "Already configured an account?"}</span>{" "}
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-white font-bold hover:underline ml-1"
          >
            {mode === "signin" ? "Sign Up" : "Log In"}
          </button>
        </div>

      </div>
    </main>
  );
}
