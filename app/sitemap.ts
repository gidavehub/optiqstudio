import type { MetadataRoute } from "next";
import { allPosts } from "@/lib/news";
import { postUrl, url } from "@/lib/news/site";

// The dashboard is behind auth and has nothing for a crawler, so only the
// public surface is listed.

const STATIC: {
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/blog", priority: 0.9, changeFrequency: "daily" },
  { path: "/enterprise", priority: 0.9, changeFrequency: "weekly" },
  { path: "/plans", priority: 0.7, changeFrequency: "monthly" },
  { path: "/api-docs", priority: 0.5, changeFrequency: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = allPosts();
  const newest = posts[0]?.published ?? new Date().toISOString();

  return [
    ...STATIC.map((entry) => ({
      url: url(entry.path),
      lastModified: entry.path === "/blog" ? new Date(newest) : new Date(),
      changeFrequency: entry.changeFrequency,
      priority: entry.priority,
    })),
    ...posts.map((post) => ({
      url: postUrl(post.slug),
      lastModified: new Date(post.updated ?? post.published),
      changeFrequency: "monthly" as const,
      priority: post.featured ? 0.9 : 0.8,
      images: [url(`/horizon/${post.hero}.jpg`)],
    })),
  ];
}
