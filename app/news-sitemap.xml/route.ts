import { allPosts } from "@/lib/news";
import { SITE, postUrl } from "@/lib/news/site";

// Google News sitemap.
//
// The spec is narrow on purpose: only articles published in the last two days
// belong here, and each entry needs publication name, language and a precise
// publication date. Everything older stays in the regular sitemap.
//
// Revalidated hourly so entries age out of the window without a redeploy.
export const revalidate = 3600;

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

const escape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export function GET() {
  const cutoff = Date.now() - TWO_DAYS_MS;
  const recent = allPosts().filter((post) => +new Date(post.published) >= cutoff);

  const entries = recent
    .map(
      (post) => `  <url>
    <loc>${postUrl(post.slug)}</loc>
    <news:news>
      <news:publication>
        <news:name>${escape(SITE.name)}</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${new Date(post.published).toISOString()}</news:publication_date>
      <news:title>${escape(post.title)}</news:title>
      <news:keywords>${escape(post.keywords.join(", "))}</news:keywords>
    </news:news>
  </url>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${entries}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
