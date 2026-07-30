"use client";

import { useMemo, useState } from "react";
import type { PostCard } from "@/lib/news/types";
import { FeaturedCard, RailCard } from "./NewsCard";

/**
 * Filtering runs on the client over a list the server already rendered, so the
 * full set of articles is in the HTML on first byte — the chips are a
 * convenience for readers, never a gate on what a crawler can see.
 */
export default function NewsIndex({ posts }: { posts: PostCard[] }) {
  const [active, setActive] = useState<string>("All");

  const chips = useMemo(() => {
    const seen: string[] = [];
    for (const p of posts) if (!seen.includes(p.category)) seen.push(p.category);
    return ["All", ...seen];
  }, [posts]);

  const visible = active === "All" ? posts : posts.filter((p) => p.category === active);
  const [lead, ...rest] = visible;

  return (
    <>
      <div className="mx-auto mb-14 flex max-w-[1600px] flex-wrap gap-2 px-5 sm:px-8 lg:px-12">
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => setActive(chip)}
            aria-pressed={active === chip}
            className={`rounded-full border px-4 py-2 text-[14px] font-medium transition-colors ${
              active === chip
                ? "border-[#1f1f1f] bg-[#1f1f1f] text-white"
                : "border-[#dadce0] bg-white text-[#3c4043] hover:bg-[#f8f9fa]"
            }`}
          >
            {chip}
          </button>
        ))}
      </div>

      <div className="mx-auto max-w-[1600px] px-5 pb-24 sm:px-8 lg:px-12">
        {lead ? (
          <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
            <FeaturedCard post={lead} />

            <div className="flex flex-col">
              {rest.map((post, i) => {
                // Every fourth entry lifts onto a filled card so a long rail
                // doesn't read as one undifferentiated column.
                const tinted = i % 4 === 2;
                return (
                  <div
                    key={post.slug}
                    className={
                      tinted
                        ? "py-5"
                        : "border-b border-[#e8eaed] py-8 first:pt-0 last:border-b-0"
                    }
                  >
                    <RailCard post={post} tinted={tinted} priority={i < 2} />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-[16px] text-[#5f6368]">Nothing filed under {active} yet.</p>
        )}
      </div>
    </>
  );
}
