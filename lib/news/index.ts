import { POSTS } from "./posts";
import type { Block, Category, Post } from "./types";

export * from "./types";
export { POSTS } from "./posts";

/** Newest first. Every consumer (index, RSS, sitemap) reads this order. */
export const allPosts = (): Post[] =>
  [...POSTS].sort((a, b) => +new Date(b.published) - +new Date(a.published));

export const getPost = (slug: string): Post | undefined =>
  POSTS.find((p) => p.slug === slug);

export const categories = (): Category[] => {
  const seen = new Set<Category>();
  for (const p of allPosts()) seen.add(p.category);
  return [...seen];
};

/**
 * Same category first, then whatever else is newest — so an article always has
 * three real links out of it. Internal links are most of what makes a fresh
 * page crawlable on day one.
 */
export function relatedPosts(slug: string, limit = 3): Post[] {
  const post = getPost(slug);
  if (!post) return allPosts().slice(0, limit);
  const others = allPosts().filter((p) => p.slug !== slug);
  const sameCategory = others.filter((p) => p.category === post.category);
  const rest = others.filter((p) => p.category !== post.category);
  return [...sameCategory, ...rest].slice(0, limit);
}

/** Strips inline markup so blocks can be reused as plain text. */
export function stripInline(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1");
}

/**
 * Flattens a body into prose for JSON-LD `articleBody` and the RSS
 * `content:encoded` summary. Search engines read this; humans never see it.
 */
export function blocksToText(body: Block[]): string {
  const out: string[] = [];
  for (const b of body) {
    switch (b.t) {
      case "p":
      case "lede":
      case "quote":
        out.push(stripInline(b.text));
        break;
      case "h2":
      case "h3":
        out.push(b.text);
        break;
      case "list":
        out.push(b.items.map(stripInline).join(" "));
        break;
      case "stats":
        out.push(b.items.map((i) => `${i.value} ${i.label}`).join(" "));
        break;
      case "callout":
        out.push(`${b.title} ${stripInline(b.body)}`);
        break;
      case "agenda":
        out.push(b.items.map((i) => `${i.at} ${i.label}`).join(" "));
        break;
      case "image":
        if (b.caption) out.push(stripInline(b.caption));
        break;
      case "youtube":
        out.push(b.title);
        break;
    }
  }
  return out.join("\n\n");
}

/** Rough reading time, shown next to the date like every news site does. */
export function readingTime(body: Block[]): number {
  const words = blocksToText(body).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Every YouTube ID in an article — each becomes a VideoObject in JSON-LD. */
export function videosIn(body: Block[]) {
  return body.flatMap((b) =>
    b.t === "youtube" && b.id ? [{ id: b.id, title: b.title }] : []
  );
}
