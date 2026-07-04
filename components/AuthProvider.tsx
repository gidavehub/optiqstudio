"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
} from "firebase/auth";
import { auth } from "../lib/firebase";

export interface Profile {
  credits: number;
  plan: string | null;
  planStatus: "active" | "none";
  planRenewsAt: string | null;
  email: string | null;
  name: string | null;
}

export interface Pricing {
  plan: { id: string; name: string; priceUsd: number; monthlyCredits: number };
  plans: { id: string; name: string; priceUsd: number; monthlyCredits: number; label: string }[];
  packs: { id: string; credits: number; priceUsd: number; label: string }[];
  costs: {
    videoPerSecond: Record<string, number>;
    image: number;
    ttsPer100Chars: number;
    ttsMinimum: number;
    characterSheet: number;
  };
}

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  pricing: Pricing | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  apiFetch: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
  signInGoogle: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [loading, setLoading] = useState(true);

  const apiFetch = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const current = auth.currentUser;
      if (!current) throw new Error("Not signed in");
      const token = await current.getIdToken();
      const res = await fetch(path, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers || {}),
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error || `Request failed (${res.status})`
        );
      }
      return data as T;
    },
    []
  );

  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      const data = await apiFetch<{ profile: Profile; pricing: Pricing }>(
        "/api/user"
      );
      setProfile(data.profile);
      setPricing(data.pricing);
    } catch (err) {
      // Backend may be up before GCP credentials are configured — the UI
      // stays usable and surfaces errors on action instead.
      console.warn("Profile fetch failed:", err);
    }
  }, [apiFetch]);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      if (u) void refreshProfile();
      else {
        setProfile(null);
        setPricing(null);
      }
    });
  }, [refreshProfile]);

  const value: AuthContextValue = {
    user,
    profile,
    pricing,
    loading,
    refreshProfile,
    apiFetch,
    signInGoogle: async () => {
      await signInWithPopup(auth, new GoogleAuthProvider());
    },
    signInEmail: async (email, password) => {
      await signInWithEmailAndPassword(auth, email, password);
    },
    signUpEmail: async (email, password) => {
      await createUserWithEmailAndPassword(auth, email, password);
    },
    signOut: async () => {
      await fbSignOut(auth);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
