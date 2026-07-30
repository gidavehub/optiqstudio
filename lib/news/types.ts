// The shape of a Optiq Studio blog post.
//
// Articles are authored as typed blocks rather than raw HTML so that one
// renderer controls the entire look, and so the same content can be walked to
// build the JSON-LD `articleBody`, the RSS description and the Google News
// sitemap without re-parsing markup.

import type { HORIZON } from "@/lib/horizon-assets";

export type HorizonAssetKey = keyof typeof HORIZON;

export type Category =
  | "Models"
  | "Product"
  | "Research"
  | "Enterprise"
  | "Company"
  | "Event";

/** Inline text supports **bold**, *italic* and [label](href). Nothing else. */
export type Inline = string;

export type Block =
  | { t: "p"; text: Inline }
  /** Opening paragraph — larger, sets the tone. One per article, at the top. */
  | { t: "lede"; text: Inline }
  | { t: "h2"; text: string }
  | { t: "h3"; text: string }
  | { t: "list"; items: Inline[]; ordered?: boolean }
  | { t: "quote"; text: Inline; cite?: string }
  | { t: "image"; asset: HorizonAssetKey; caption?: Inline; full?: boolean }
  /**
   * A YouTube embed. `id: null` renders the placeholder card — the video is
   * cut and scheduled but the link isn't public yet. Drop the ID in and the
   * same block becomes a real (click-to-load) player.
   */
  | { t: "youtube"; id: string | null; title: string; caption?: Inline }
  | { t: "stats"; items: { value: string; label: string }[] }
  | { t: "callout"; title: string; body: Inline; cta?: { label: string; href: string } }
  /** Timestamped run of show, used on the event pages. */
  | { t: "agenda"; items: { at: string; label: string }[] }
  | { t: "divider" };

export type Post = {
  slug: string;
  title: string;
  /** Shorter headline for cards where the full title would wrap four lines. */
  cardTitle?: string;
  category: Category;
  /** ISO 8601 with offset. Drives <time>, JSON-LD and the news sitemap. */
  published: string;
  updated?: string;
  /** One or two sentences. Used for the card, the meta description and RSS. */
  excerpt: string;
  authors: string[];
  hero: HorizonAssetKey;
  /** Overrides the hero for the card thumbnail when a squarer crop reads better. */
  cardImage?: HorizonAssetKey;
  /** Lifts the post into the large featured slot on /blog. */
  featured?: boolean;
  keywords: string[];
  body: Block[];
};

/**
 * The subset of a post the listing cards actually render.
 *
 * The index filters on the client, so whatever it receives is serialised into
 * the RSC payload. Handing it full `Post` objects shipped every article body
 * twice — once as HTML, once as JSON — for text no card ever displays.
 */
export type PostCard = Pick<
  Post,
  "slug" | "title" | "cardTitle" | "category" | "published" | "hero" | "cardImage"
>;

export const toCard = (post: Post): PostCard => ({
  slug: post.slug,
  title: post.title,
  cardTitle: post.cardTitle,
  category: post.category,
  published: post.published,
  hero: post.hero,
  cardImage: post.cardImage,
});
