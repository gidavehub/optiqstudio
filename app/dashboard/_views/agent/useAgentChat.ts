"use client";

// useAgentChat — the thread at projects/{id}/agentChat, live.
//
// Sending is deliberately a pure Firestore write, not an HTTP call: the client
// drops the director's message, an empty assistant bubble and a job doc, and the
// storylineAgent Cloud Function fills the bubble in. A film-wide rewrite takes
// minutes, so nothing may depend on this tab staying open — closing it and
// coming back resumes exactly where the agent is, the same way storyboard
// generation already does.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { db } from "../../../../lib/firebase";
import { AgentChatMessage } from "./types";

export interface AgentChat {
  messages: AgentChatMessage[];
  loading: boolean;
  /** True while a turn is queued or running — the composer locks on this. */
  busy: boolean;
  /** The step the agent is on right now, for the live status line. */
  activity: string | null;
  send: (text: string) => Promise<void>;
  clear: () => Promise<void>;
}

const NO_MESSAGES: AgentChatMessage[] = [];

// The agent function can't outlive its own 540s ceiling, and it writes to the
// bubble at least once a second while it works. A turn still marked in-flight
// long past that lost to a crash or a cold-start that never landed — surface it
// as a failure rather than leaving the composer locked on a bubble that will
// never finish.
const STALE_TURN_MS = 10 * 60 * 1000;

function withTimeout(message: AgentChatMessage): AgentChatMessage {
  if (message.status !== "queued" && message.status !== "working") return message;
  const lastBeat = Date.parse(message.updatedAt || message.createdAt || "");
  if (!Number.isFinite(lastBeat) || Date.now() - lastBeat < STALE_TURN_MS) return message;
  return {
    ...message,
    status: "failed",
    error: message.error || "That turn stopped responding. Send it again — nothing was charged.",
  };
}

export default function useAgentChat(projectId: string | null, uid: string | null): AgentChat {
  // One piece of state, stamped with the project it belongs to. Loading is then
  // derived — "we haven't heard from this project yet" — rather than being a
  // second flag flipped from inside the effect body, which is a cascading
  // render and which React's lint rules (rightly) reject.
  const [thread, setThread] = useState<{ projectId: string; messages: AgentChatMessage[] } | null>(null);

  useEffect(() => {
    if (!projectId) return;
    const q = query(collection(db, "projects", projectId, "agentChat"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setThread({
          projectId,
          messages: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AgentChatMessage),
        });
      },
      (err) => {
        console.error("Failed to subscribe to the storyline agent thread:", err);
        setThread({ projectId, messages: [] });
      }
    );
    return () => unsubscribe();
  }, [projectId]);

  const settled = thread?.projectId === projectId;
  const raw = settled ? thread.messages : NO_MESSAGES;
  const loading = !!projectId && !settled;

  // Recomputed on render, which is what makes the timeout above actually fire:
  // a project whose turn died sends no further snapshots, so nothing else would
  // ever re-evaluate it.
  const messages = useMemo(() => raw.map(withTimeout), [raw]);

  const last = messages[messages.length - 1];
  const busy = last?.role === "assistant" && (last.status === "queued" || last.status === "working");

  const activity = useMemo(() => {
    if (!busy) return null;
    const running = (last?.steps || []).filter((s) => s.status === "running").pop();
    if (running) return running.detail ? `${running.label} — ${running.detail}` : running.label;
    return last?.status === "queued" ? "Picking up your message…" : "Thinking…";
  }, [busy, last]);

  const send = useCallback(
    async (text: string) => {
      const body = text.trim();
      if (!body || !projectId || !uid) return;

      const chat = collection(db, "projects", projectId, "agentChat");
      const now = Date.now();
      const userRef = doc(chat);
      const replyRef = doc(chat);

      await setDoc(userRef, {
        role: "user",
        text: body,
        status: "done",
        createdAt: new Date(now).toISOString(),
      });
      // The empty assistant bubble is written by the client so it appears the
      // instant you hit send, rather than after the trigger cold-starts.
      // +1ms keeps it sorted after the message it answers.
      await setDoc(replyRef, {
        role: "assistant",
        text: "",
        steps: [],
        status: "queued",
        createdAt: new Date(now + 1).toISOString(),
      });
      await addDoc(collection(db, "agentJobs"), {
        uid,
        projectId,
        replyTo: replyRef.id,
        text: body,
        status: "queued",
        createdAt: new Date().toISOString(),
      });
    },
    [projectId, uid]
  );

  const clear = useCallback(async () => {
    if (!projectId) return;
    const snap = await getDocs(collection(db, "projects", projectId, "agentChat"));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }, [projectId]);

  return { messages, loading, busy: !!busy, activity, send, clear };
}
