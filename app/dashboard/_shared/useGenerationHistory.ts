"use client";

// useGenerationHistory — the one place a studio's "wall" of past generations is
// owned.
//
// THE BUG THIS EXISTS TO KILL
// Every studio used to do `apiFetch(...).then(d => setHistory(d.items))`, driven
// by a useEffect keyed on the fetcher's identity. Two things then conspired:
//
//   1. `apiFetch` changed identity whenever the wallet balance changed — and
//      generating ALWAYS changes the balance — so a reload fired the instant a
//      generation was submitted.
//   2. The reload REPLACED the whole list with whatever Firestore had. The card
//      the user had just watched appear was optimistic (audio/music/image are
//      only written server-side once the model returns), so it was wiped.
//
// Result: the card popped in, vanished, and only a manual refresh brought it
// back. `apiFetch` is stable now; this hook closes the second half by MERGING
// server truth over local state instead of overwriting it — a pending local
// card is never dropped just because the server hasn't caught up yet.

import { useCallback, useEffect, useRef, useState } from "react";

/** Minimum shape every studio's item satisfies. */
export interface HistoryRecord {
  id: string;
  status?: string;
  createdAt?: string;
}

export const TEMP_PREFIX = "temp_";

/** A generation that hasn't reached a terminal state yet. */
export function isPending(item: { id: string; status?: string }): boolean {
  if (item.id.startsWith(TEMP_PREFIX)) return true;
  const s = item.status;
  return s === "rendering" || s === "generating" || s === "processing" || s === "queued";
}

// How long an optimistic card is allowed to survive without the server ever
// confirming it. Long enough for a slow video render to be claimed, short
// enough that a genuinely lost request doesn't haunt the wall forever.
const ORPHAN_TTL_MS = 30 * 60 * 1000;

const timeOf = (item: HistoryRecord): number => {
  const t = new Date(item.createdAt ?? 0).getTime();
  return Number.isFinite(t) ? t : 0;
};

/**
 * Folds a fresh server list into the current local list.
 *
 * - Server wins for anything it knows about, but locally-set fields the server
 *   hasn't written yet (a just-returned url, say) are preserved underneath it.
 * - Local-only items survive while they're still pending and inside the TTL.
 * - Locally deleted items simply aren't in `local`, so they stay gone.
 */
export function mergeHistory<T extends HistoryRecord>(local: T[], server: T[]): T[] {
  const serverById = new Map(server.map((item) => [item.id, item]));
  const localById = new Map(local.map((item) => [item.id, item]));
  const now = Date.now();

  const merged: T[] = server.map((item) => {
    const mine = localById.get(item.id);
    return mine ? ({ ...mine, ...item } as T) : item;
  });

  for (const item of local) {
    if (serverById.has(item.id)) continue;
    // Keep an in-flight card the server hasn't published yet.
    if (isPending(item) && now - timeOf(item) < ORPHAN_TTL_MS) merged.push(item);
    // Also keep one we just resolved ourselves from a synchronous response —
    // Firestore's query is eventually consistent and would otherwise "lose" it
    // for a beat, which reads as the card flickering out.
    else if (!item.id.startsWith(TEMP_PREFIX) && now - timeOf(item) < 60_000) merged.push(item);
  }

  return merged.sort((a, b) => timeOf(b) - timeOf(a));
}

interface Options<T extends HistoryRecord> {
  /** Fetches the authoritative list (usually via apiFetch). */
  fetcher: () => Promise<T[]>;
  /** Poll interval for the wall itself; 0 disables. */
  refreshMs?: number;
}

export function useGenerationHistory<T extends HistoryRecord>({
  fetcher,
  refreshMs = 0,
}: Options<T>) {
  const [history, setHistory] = useState<T[]>([]);
  // Ids added in this session — the grid uses these to play the pop-in once.
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const load = useCallback(async () => {
    try {
      const items = await fetcherRef.current();
      setHistory((prev) => mergeHistory(prev, items));
    } catch {
      // A failed refresh must never blank the wall — keep showing what we have.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!refreshMs) return;
    const t = setInterval(() => void load(), refreshMs);
    return () => clearInterval(t);
  }, [load, refreshMs]);

  /** Drops an optimistic card in at the top and marks it for the pop-in. */
  const addOptimistic = useCallback((item: T) => {
    setHistory((prev) => [item, ...prev]);
    setFreshIds((prev) => new Set(prev).add(item.id));
  }, []);

  /** Swaps a temp card for its real one (id + whatever the server returned). */
  const resolveOptimistic = useCallback((tempId: string, patch: Partial<T> & { id?: string }) => {
    setHistory((prev) => prev.map((item) => (item.id === tempId ? ({ ...item, ...patch } as T) : item)));
    if (patch.id && patch.id !== tempId) {
      setFreshIds((prev) => {
        const next = new Set(prev);
        next.delete(tempId);
        next.add(patch.id as string);
        return next;
      });
    }
  }, []);

  const removeItem = useCallback((id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
    setFreshIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const patchItem = useCallback((id: string, patch: Partial<T>) => {
    setHistory((prev) => prev.map((item) => (item.id === id ? ({ ...item, ...patch } as T) : item)));
  }, []);

  return {
    history,
    setHistory,
    freshIds,
    load,
    addOptimistic,
    resolveOptimistic,
    removeItem,
    patchItem,
  };
}
