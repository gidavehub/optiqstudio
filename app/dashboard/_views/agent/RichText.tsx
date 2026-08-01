"use client";

// RichText — the small slice of markdown the storyline agent actually writes.
//
// The agent replies in prose with the occasional bullet list, **emphasis** and
// `exact prompt text`. That is all it needs, so this renders exactly that and
// nothing else rather than pulling a markdown library (and its parser, its
// sanitiser and its 40KB) into the dashboard bundle.
//
// Supported: paragraphs, bullet and numbered lists, "## " headings, **bold**,
// *italic*, `inline code`. Anything else renders as plain text.

import React from "react";

/** Splits one line into bold / italic / code / plain runs. */
function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;
    if (token.startsWith("**")) {
      parts.push(
        <strong key={key} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`")) {
      parts.push(
        <code
          key={key}
          className="rounded-xl border border-line bg-surface px-1 py-0.5 font-mono text-[0.92em] text-accent-ink"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else {
      parts.push(
        <em key={key} className="italic text-foreground">
          {token.slice(1, -1)}
        </em>
      );
    }
    cursor = match.index + token.length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;

export default function RichText({ text }: { text: string }) {
  const lines = (text || "").split("\n");
  const blocks: React.ReactNode[] = [];

  // Consecutive list lines collapse into one <ul>/<ol>; everything else between
  // blank lines becomes a paragraph.
  let listItems: string[] = [];
  let listKind: "ul" | "ol" | null = null;
  let paragraph: string[] = [];

  const flushList = (key: string) => {
    if (listItems.length === 0) return;
    const items = listItems.map((item, i) => (
      <li key={i} className="pl-0.5 marker:text-faint">
        {inline(item, `${key}-${i}`)}
      </li>
    ));
    blocks.push(
      listKind === "ol" ? (
        <ol key={key} className="ml-4 list-decimal space-y-1.5">
          {items}
        </ol>
      ) : (
        <ul key={key} className="ml-4 list-disc space-y-1.5">
          {items}
        </ul>
      )
    );
    listItems = [];
    listKind = null;
  };

  const flushParagraph = (key: string) => {
    if (paragraph.length === 0) return;
    blocks.push(
      <p key={key} className="leading-relaxed">
        {inline(paragraph.join(" "), key)}
      </p>
    );
    paragraph = [];
  };

  lines.forEach((raw, index) => {
    const line = raw.trimEnd();
    const key = `b${index}`;

    if (!line.trim()) {
      flushParagraph(key);
      flushList(key);
      return;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph(key);
      flushList(key);
      blocks.push(
        <h4 key={key} className="pt-1 text-[13px] font-bold tracking-tight text-foreground">
          {inline(heading[2], key)}
        </h4>
      );
      return;
    }

    if (BULLET.test(line) || NUMBERED.test(line)) {
      flushParagraph(key);
      const kind = NUMBERED.test(line) ? "ol" : "ul";
      if (listKind && listKind !== kind) flushList(key);
      listKind = kind;
      listItems.push(line.replace(BULLET, "").replace(NUMBERED, ""));
      return;
    }

    flushList(key);
    paragraph.push(line.trim());
  });

  flushParagraph("tail");
  flushList("tail-list");

  return <div className="space-y-3 text-[13px] text-ink-2">{blocks}</div>;
}
