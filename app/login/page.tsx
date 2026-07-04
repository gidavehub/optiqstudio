"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";

export default function LoginPage() {
  const { user, loading, signInGoogle, signInEmail, signUpEmail } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message.replace("Firebase: ", "") : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <Link href="/" className="mb-10 text-xl font-medium tracking-tight lowercase">
        optiq studio
      </Link>

      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-medium tracking-tight mb-1">
          {mode === "signin" ? "Log in" : "Create your account"}
        </h1>
        <p className="text-sm text-muted mb-8">
          {mode === "signin"
            ? "Welcome back. Your worlds are waiting."
            : "Start creating with 300 free credits."}
        </p>

        <button
          onClick={() => run(signInGoogle)}
          disabled={busy}
          className="w-full h-11 rounded-full bg-white text-black text-sm font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50"
        >
          Continue with Google
        </button>

        <div className="flex items-center gap-3 my-6">
          <div className="h-px flex-1 bg-line" />
          <span className="eyebrow">or</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() =>
              mode === "signin" ? signInEmail(email, password) : signUpEmail(email, password)
            );
          }}
          className="space-y-3"
        >
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-11 rounded-lg bg-surface border border-line px-4 text-sm placeholder:text-muted focus:border-white/40"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-11 rounded-lg bg-surface border border-line px-4 text-sm placeholder:text-muted focus:border-white/40"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full h-11 rounded-full border border-line text-sm font-medium hover:bg-surface-2 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {mode === "signin" ? "Log in with email" : "Sign up with email"}
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <p className="mt-8 text-sm text-muted">
          {mode === "signin" ? "No account?" : "Already have an account?"}{" "}
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-white underline underline-offset-4"
          >
            {mode === "signin" ? "Sign up" : "Log in"}
          </button>
        </p>
      </div>
    </main>
  );
}
