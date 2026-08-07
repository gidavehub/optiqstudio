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
import { ref as storageRef, uploadString } from "firebase/storage";
import { db, storage } from "../../../../lib/firebase";
import { AgentChatMessage, AgentAttachment, AgentThread, MAIN_THREAD_ID } from "./types";

export interface AgentChat {
  /** Messages in the ACTIVE thread only. */
  messages: AgentChatMessage[];
  loading: boolean;
  /** True while a turn is queued or running — the composer locks on this. */
  busy: boolean;
  /** The step the agent is on right now, for the live status line. */
  activity: string | null;
  send: (text: string, images?: AgentAttachment[]) => Promise<void>;
  /** Deletes the active thread's messages. */
  clear: () => Promise<void>;

  // ── History ──────────────────────────────────────────────────────────────
  /** Every conversation on this film, most recently touched first. */
  threads: AgentThread[];
  activeThreadId: string;
  selectThread: (id: string) => void;
  /**
   * Start a fresh conversation. Mints an id locally and writes nothing — an
   * empty thread that was never spoken in should leave no trace.
   */
  newThread: () => void;
  deleteThread: (id: string) => Promise<void>;
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
  const allMessages = useMemo(() => raw.map(withTimeout), [raw]);

  // ── Threads ───────────────────────────────────────────────────────────────
  //
  // Grouped from the messages rather than stored in their own collection: every
  // message is already in this snapshot, so the sidebar is free and instant, and
  // there is nothing to keep in sync or migrate. Messages predating threads have
  // no threadId and fall into MAIN_THREAD_ID.
  const threads = useMemo<AgentThread[]>(() => {
    const byId = new Map<string, AgentChatMessage[]>();
    for (const message of allMessages) {
      const id = message.threadId || MAIN_THREAD_ID;
      const list = byId.get(id);
      if (list) list.push(message);
      else byId.set(id, [message]);
    }
    const out: AgentThread[] = [];
    for (const [id, list] of byId) {
      const firstSaid = list.find((m) => m.role === "user" && m.text.trim());
      const last = list[list.length - 1];
      out.push({
        id,
        title: firstSaid ? firstSaid.text.trim().replace(/\s+/g, " ").slice(0, 80) : "New conversation",
        messageCount: list.length,
        updatedAt: last?.updatedAt || last?.createdAt || "",
        busy: last?.role === "assistant" && (last.status === "queued" || last.status === "working"),
      });
    }
    return out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  }, [allMessages]);

  // Which conversation is on screen. Unset means "whatever is most recent", so a
  // freshly opened room lands on the newest thread without persisting anything.
  //
  // Stamped with the project it belongs to, and derived rather than reset in an
  // effect — the same shape `thread` above uses, for the same reason: clearing it
  // from an effect on projectId is a cascading render, and React's lint rules
  // (rightly) reject it. A stamp that doesn't match simply reads as no selection.
  const [selected, setSelected] = useState<{ projectId: string; threadId: string } | null>(null);
  const selectedThreadId = selected && selected.projectId === projectId ? selected.threadId : null;
  const activeThreadId = selectedThreadId ?? threads[0]?.id ?? MAIN_THREAD_ID;

  const messages = useMemo(
    () => allMessages.filter((m) => (m.threadId || MAIN_THREAD_ID) === activeThreadId),
    [allMessages, activeThreadId]
  );

  const last = messages[messages.length - 1];
  const busy = last?.role === "assistant" && (last.status === "queued" || last.status === "working");

  const activity = useMemo(() => {
    if (!busy) return null;
    const running = (last?.steps || []).filter((s) => s.status === "running").pop();
    if (running) return running.detail ? `${running.label} — ${running.detail}` : running.label;
    return last?.status === "queued" ? "Picking up your message…" : "Thinking…";
  }, [busy, last]);

  const send = useCallback(
    async (text: string, images: AgentAttachment[] = []) => {
      const body = text.trim();
      if ((!body && images.length === 0) || !projectId || !uid) return;

      const chat = collection(db, "projects", projectId, "agentChat");
      const now = Date.now();
      const userRef = doc(chat);
      const replyRef = doc(chat);

      // Attachments go to Storage first and only their paths go into Firestore.
      // A document is capped at 1MB and one still is bigger than that, so
      // writing base64 inline would reject the whole message. storylineAgent
      // reads these back and hands them to the model as inlineData parts.
      const uploaded: { path: string; mimeType: string }[] = [];
      for (const [i, img] of images.entries()) {
        // The extension is read back off the URL when the thread is reopened,
        // to decide between an <img> and a <video>, so it has to be truthful.
        const ext =
          img.kind === "video"
            ? img.mimeType.includes("webm") ? "webm" : img.mimeType.includes("quicktime") ? "mov" : "mp4"
            : img.mimeType.includes("png") ? "png" : img.mimeType.includes("webp") ? "webp" : "jpg";
        const path = `projects/${projectId}/agentUploads/${userRef.id}/${i}.${ext}`;
        await uploadString(storageRef(storage, path), img.base64, "base64", {
          contentType: img.mimeType,
        });
        uploaded.push({ path, mimeType: img.mimeType });
      }

      await setDoc(userRef, {
        role: "user",
        text: body,
        // Kept on the message too, so the bubble can show what was attached
        // when the thread is reopened.
        images: uploaded,
        threadId: activeThreadId,
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
        threadId: activeThreadId,
        status: "queued",
        createdAt: new Date(now + 1).toISOString(),
      });
      await addDoc(collection(db, "agentJobs"), {
        uid,
        projectId,
        replyTo: replyRef.id,
        text: body,
        // The trigger reads these paths back out of Storage.
        images: uploaded,
        // So the function carries only THIS conversation's history into the turn.
        // Without it the agent would read every thread on the film as one.
        threadId: activeThreadId,
        status: "queued",
        createdAt: new Date().toISOString(),
      });
    },
    [projectId, uid, activeThreadId]
  );

  /** Delete one conversation. Legacy messages carry no threadId, hence the ?? . */
  const deleteThread = useCallback(
    async (id: string) => {
      if (!projectId) return;
      const snap = await getDocs(collection(db, "projects", projectId, "agentChat"));
      const doomed = snap.docs.filter((d) => ((d.data().threadId as string) || MAIN_THREAD_ID) === id);
      await Promise.all(doomed.map((d) => deleteDoc(d.ref)));
      // Deleting the thread you were reading drops you back to the newest one.
      setSelected((current) => (current?.threadId === id ? null : current));
    },
    [projectId]
  );

  const clear = useCallback(() => deleteThread(activeThreadId), [deleteThread, activeThreadId]);

  const selectThread = useCallback(
    (id: string) => {
      if (projectId) setSelected({ projectId, threadId: id });
    },
    [projectId]
  );

  const newThread = useCallback(() => {
    if (!projectId) return;
    setSelected({
      projectId,
      threadId: `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    });
  }, [projectId]);

  return {
    messages,
    loading,
    busy: !!busy,
    activity,
    send,
    clear,
    threads,
    activeThreadId,
    selectThread,
    newThread,
    deleteThread,
  };
}
