"use client";

// AgentHistory — the conversations you've had about this film.
//
// The room used to hold exactly one thread with a "New thread" button that
// DELETED it. Everything the director had worked out with the agent went in the
// bin to start a new subject. Now every conversation is kept, listed here, and
// deleting one is a deliberate act on that one.
//
// A panel on desktop and a sheet on phones — same component, same list, because
// the only real difference is how it gets on screen.

import React from "react";
import { MessageSquare, Plus, Trash2, X } from "lucide-react";
import { AgentThread } from "./types";

interface AgentHistoryProps {
  threads: AgentThread[];
  activeThreadId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  /** Phones only: renders as a full-height sheet with a close control. */
  asSheet?: boolean;
  onClose?: () => void;
}

/** "2 hours ago", roughly. Enough to order a list by eye. */
function ago(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(then).toLocaleDateString();
}

export default function AgentHistory({
  threads,
  activeThreadId,
  onSelect,
  onNew,
  onDelete,
  asSheet = false,
  onClose,
}: AgentHistoryProps) {
  // A brand-new conversation exists only in local state until it's spoken in, so
  // it has no row in the list. Show it as one anyway — otherwise pressing New
  // appears to do nothing.
  const unsaved = !threads.some((t) => t.id === activeThreadId);

  return (
    <aside
      className={
        asSheet
          ? "flex h-full w-full flex-col bg-surface"
          : "flex h-full w-[240px] shrink-0 flex-col border-r border-line bg-surface"
      }
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2.5">
        <span className="flex-1 tabular-nums text-[9px] font-bold uppercase tracking-widest text-muted">
          History
        </span>
        <button
          onClick={onNew}
          title="Start a new conversation"
          className="flex items-center gap-1 rounded-xl border border-line bg-surface-2 px-2 py-1 text-[10px] font-bold text-ink-3 transition-colors hover:text-foreground active:scale-95"
        >
          <Plus size={10} /> New
        </button>
        {asSheet && onClose && (
          <button
            onClick={onClose}
            aria-label="Close history"
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {unsaved && (
          <ThreadRow
            title="New conversation"
            meta="not saved yet"
            active
            onSelect={() => undefined}
          />
        )}
        {threads.length === 0 && !unsaved && (
          <p className="px-2 py-6 text-center text-[11px] leading-relaxed text-muted">
            Nothing yet. Whatever you work out with the agent will be kept here.
          </p>
        )}
        {threads.map((thread) => (
          <ThreadRow
            key={thread.id}
            title={thread.title}
            meta={`${thread.messageCount} message${thread.messageCount === 1 ? "" : "s"} · ${ago(thread.updatedAt)}`}
            active={thread.id === activeThreadId}
            busy={thread.busy}
            onSelect={() => onSelect(thread.id)}
            onDelete={() => onDelete(thread.id)}
          />
        ))}
      </div>
    </aside>
  );
}

function ThreadRow({
  title,
  meta,
  active,
  busy,
  onSelect,
  onDelete,
}: {
  title: string;
  meta: string;
  active: boolean;
  busy?: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={`group relative mb-1 rounded-2xl border transition-colors ${
        active ? "border-accent-line bg-surface-2" : "border-transparent hover:bg-surface-2"
      }`}
    >
      <button onClick={onSelect} className="block w-full px-2.5 py-2 pr-8 text-left">
        <span className="flex items-center gap-1.5">
          {busy ? (
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" />
          ) : (
            <MessageSquare size={10} className="shrink-0 text-faint" />
          )}
          <span
            className={`line-clamp-2 text-[11px] font-semibold leading-snug ${
              active ? "text-foreground" : "text-ink-3"
            }`}
          >
            {title}
          </span>
        </span>
        <span className="mt-0.5 block pl-[18px] tabular-nums text-[9px] text-faint">{meta}</span>
      </button>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm("Delete this conversation? The script itself is not affected.")) onDelete();
          }}
          aria-label="Delete conversation"
          title="Delete conversation"
          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-muted opacity-0 transition-all hover:bg-danger-soft hover:text-danger focus:opacity-100 group-hover:opacity-100"
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
}
