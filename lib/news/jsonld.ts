import { HORIZON } from "@/lib/horizon-assets";
import { SITE, postUrl, url } from "./site";
import { blocksToText, videosIn } from "./index";
import type { Post } from "./types";

// Optiq Studio is a product of DaveLabs, so the publisher graph names both:
// the Organization that publishes the blog, and its parent.

export const organization = () => ({
  "@type": "Organization",
  "@id": `${SITE.origin}/#organization`,
  name: SITE.name,
  url: SITE.origin,
  logo: { "@type": "ImageObject", url: url(SITE.logo) },
  description: SITE.description,
  email: SITE.email,
  telephone: SITE.phone,
  foundingDate: SITE.founded,
  parentOrganization: {
    "@type": "Organization",
    name: SITE.parent,
    url: SITE.parentUrl,
  },
  address: {
    "@type": "PostalAddress",
    addressCountry: "GM",
    addressLocality: "Banjul",
    addressRegion: "The Gambia",
  },
  sameAs: [...SITE.sameAs],
});

export function articleJsonLd(post: Post) {
  const hero = HORIZON[post.hero];
  const canonical = postUrl(post.slug);

  const graph: Record<string, unknown>[] = [
    organization(),
    {
      "@type": ["BlogPosting", "NewsArticle"],
      "@id": `${canonical}#article`,
      isPartOf: { "@id": `${SITE.origin}/#website` },
      headline: post.title.slice(0, 110),
      name: post.title,
      description: post.excerpt,
      articleSection: post.category,
      keywords: post.keywords.join(", "),
      inLanguage: "en-GB",
      datePublished: post.published,
      dateModified: post.updated ?? post.published,
      url: canonical,
      mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
      image: [url(hero.og), url(hero.src)],
      author: post.authors.map((name) => ({ "@type": "Person", name })),
      publisher: { "@id": `${SITE.origin}/#organization` },
      articleBody: blocksToText(post.body),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE.origin },
        { "@type": "ListItem", position: 2, name: "Blog", item: url(SITE.newsPath) },
        { "@type": "ListItem", position: 3, name: post.title, item: canonical },
      ],
    },
  ];

  for (const video of videosIn(post.body)) {
    graph.push({
      "@type": "VideoObject",
      name: video.title,
      description: post.excerpt,
      uploadDate: post.published,
      thumbnailUrl: [`https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`],
      embedUrl: `https://www.youtube-nocookie.com/embed/${video.id}`,
      contentUrl: `https://www.youtube.com/watch?v=${video.id}`,
      publisher: { "@id": `${SITE.origin}/#organization` },
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

export function blogCollectionJsonLd(posts: Post[]) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      organization(),
      {
        "@type": "WebSite",
        "@id": `${SITE.origin}/#website`,
        url: SITE.origin,
        name: SITE.name,
        description: SITE.description,
        publisher: { "@id": `${SITE.origin}/#organization` },
        inLanguage: "en-GB",
      },
      {
        "@type": "Blog",
        "@id": `${url(SITE.newsPath)}#blog`,
        url: url(SITE.newsPath),
        name: `${SITE.name} Blog`,
        description:
          "Product launches, research and how-to from the team building Optiq Studio.",
        isPartOf: { "@id": `${SITE.origin}/#website` },
        blogPost: posts.map((post) => ({
          "@type": "BlogPosting",
          headline: post.title,
          url: postUrl(post.slug),
          datePublished: post.published,
          image: url(HORIZON[post.hero].og),
        })),
      },
    ],
  };
}

export function jsonLdScript(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
