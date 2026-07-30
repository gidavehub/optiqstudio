import type { Metadata } from "next";
import NewsIndex from "@/components/news/NewsIndex";
import { allPosts } from "@/lib/news";
import { toCard } from "@/lib/news/types";
import { blogCollectionJsonLd, jsonLdScript } from "@/lib/news/jsonld";
import { SITE, url } from "@/lib/news/site";

const TITLE = "Blog — Optiq Studio";
const DESCRIPTION =
  "Product launches, research and how-to from the team building Optiq Studio — the platform that makes a studio-quality video ad cost less than five dollars.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/blog",
    types: {
      "application/rss+xml": [{ url: "/blog/rss.xml", title: "Optiq Studio Blog" }],
    },
  },
  openGraph: {
    type: "website",
    url: url("/blog"),
    title: TITLE,
    description: DESCRIPTION,
    siteName: SITE.name,
    locale: SITE.locale,
    images: [{ url: url(SITE.defaultOgImage), width: 1200, height: 670, alt: "Optiq Studio" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [url(SITE.defaultOgImage)],
    site: SITE.twitter,
  },
};

export default function BlogPage() {
  const posts = allPosts();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(blogCollectionJsonLd(posts))}
      />

      <section className="mx-auto max-w-[1600px] px-5 pb-14 pt-20 sm:px-8 sm:pt-28 lg:px-12">
        <h1 className="text-[44px] font-normal leading-[1.05] tracking-[-0.03em] text-[#1f1f1f] sm:text-[64px]">
          Blog
        </h1>
        <p className="mt-3 max-w-[760px] text-[26px] font-normal leading-[1.15] tracking-[-0.022em] text-[#5f6368] sm:text-[38px]">
          How we build it, and how to get the most out of it
        </p>
      </section>

      {/* Only the card fields cross into the client bundle — see PostCard. */}
      <NewsIndex posts={posts.map(toCard)} />
    </>
  );
}
