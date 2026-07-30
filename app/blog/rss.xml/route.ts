import { HORIZON } from "@/lib/horizon-assets";
import { allPosts, blocksToText } from "@/lib/news";
import { SITE, postUrl, url } from "@/lib/news/site";

// RSS 2.0 with media:content for the hero image. Aggregators pick this up, and it gives the
// blog a machine-readable surface that does not depend on parsing the HTML.
export const revalidate = 3600;

const escape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export function GET() {
  const posts = allPosts();
  const built = new Date().toUTCString();

  const items = posts
    .map((post) => {
      const hero = HORIZON[post.hero];
      const link = postUrl(post.slug);
      return `    <item>
      <title>${escape(post.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${new Date(post.published).toUTCString()}</pubDate>
      <category>${escape(post.category)}</category>
      <dc:creator>${escape(post.authors.join(", "))}</dc:creator>
      <description>${escape(post.excerpt)}</description>
      <content:encoded><![CDATA[${blocksToText(post.body).slice(0, 2000)}]]></content:encoded>
      <media:content url="${url(hero.og)}" medium="image" />
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:media="http://search.yahoo.com/mrss/"
     xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(SITE.name)} Blog</title>
    <link>${url("/blog")}</link>
    <atom:link href="${url("/blog/rss.xml")}" rel="self" type="application/rss+xml" />
    <description>${escape(SITE.description)}</description>
    <language>en-gb</language>
    <copyright>© ${new Date().getFullYear()} ${escape(SITE.name)}</copyright>
    <lastBuildDate>${built}</lastBuildDate>
    <image>
      <url>${url(SITE.logo)}</url>
      <title>${escape(SITE.name)} Blog</title>
      <link>${url("/blog")}</link>
    </image>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
