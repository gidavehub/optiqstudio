"use client";

// AgentHistory — the conversations you've had about this film, drawn into the
// studio rail.
//
// The room used to hold exactly one thread with a "New thread" button that
// DELETED it. Everything the director had worked out with the agent went in the
// bin to start a new subject. Now every conversation is kept and listed here,
// and deleting one is a deliberate act on that one.
//
// The shell owns the column and the sheet it becomes on a phone, so this is
// just the list — no panel chrome of its own.

import React from "react";
import { Icon } from "../../../../components/icons";
import { RailGroup } from "../../_shell/StudioRail";
import { AgentThread } from "./types";

interface AgentHistoryProps {
  threads: AgentThread[];
  activeThreadId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
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
}: AgentHistoryProps) {
  // A brand-new conversation exists only in local state until it's spoken in, so
  // it has no row in the list. Show it as one anyway — otherwise pressing New
  // appears to do nothing.
  const unsaved = !threads.some((t) => t.id === activeThreadId);

  return (
    <RailGroup title="Conversations" hint={threads.length ? `${threads.length}` : undefined}>
      <button
        onClick={onNew}
        className="mb-2.5 flex w-full items-center justify-center gap-2 rounded-[22px] border border-line-2 bg-background px-4 py-3.5 text-[15px] font-bold tracking-tight text-foreground transition-all hover:border-foreground hover:bg-foreground hover:text-background active:scale-[0.99]"
      >
        <Icon name="plus" size={18} /> New conversation
      </button>

      <div className="space-y-2">
        {unsaved && <ThreadRow title="New conversation" meta="not saved yet" active onSelect={() => undefined} />}

        {threads.length === 0 && !unsaved && (
          <p className="rounded-[22px] border border-line-2 bg-background px-4 py-8 text-center text-[12px] font-semibold leading-relaxed text-muted">
            Nothing yet. Whatever you work out with the agent is kept here.
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
    </RailGroup>
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
      className={`group relative rounded-[22px] border transition-all ${
        active
          ? "border-transparent bg-foreground text-background"
          : "border-line-2 bg-background text-foreground hover:border-foreground hover:bg-surface-2"
      }`}
    >
      <button onClick={onSelect} className="block w-full px-4 py-3 pr-11 text-left">
        <span className="flex items-start gap-2">
          {busy ? (
            <span className="mt-1.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent" />
          ) : (
            <Icon name="message" size={15} className={`mt-0.5 shrink-0 ${active ? "" : "text-ink-3"}`} />
          )}
          <span className="line-clamp-2 text-[14px] font-bold leading-snug tracking-tight">{title}</span>
        </span>
        <span className={`mt-1 block pl-[23px] text-[11px] font-semibold tabular-nums ${active ? "opacity-65" : "text-faint"}`}>
          {meta}
        </span>
      </button>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm("Delete this conversation? The script itself is not affected.")) onDelete();
          }}
          aria-label="Delete conversation"
          title="Delete conversation"
          className={`absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full opacity-0 transition-all focus:opacity-100 group-hover:opacity-100 ${
            active ? "text-background hover:bg-background/20" : "text-muted hover:bg-danger-soft hover:text-danger"
          }`}
        >
          <Icon name="trash" size={14} />
        </button>
      )}
    </div>
  );
}
