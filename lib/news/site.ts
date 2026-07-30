// Canonical identity for the Optiq Studio blog. Every sitemap, feed and
// JSON-LD block reads from here.

export const SITE = {
  name: "Optiq Studio",
  origin: "https://optiq.studio",
  newsPath: "/blog",
  tagline: "Studio-quality video ads for less than $5.",
  description:
    "Optiq Studio turns a description of your business into a studio-quality video commercial for less than five dollars. A product of DaveLabs.",
  logo: "/media/davelabs-logo.png",
  defaultOgImage: "/horizon/optiq-horizon.jpg",
  locale: "en_GB",
  twitter: "@DaveLabs_",
  email: "optiq@davelabs.co",
  sales: "sales@davelabs.co",
  phone: "+220 781 0880",
  phoneHref: "tel:+2207810880",
  whatsapp: "https://wa.me/2207810880",
  founded: "2023",
  parent: "DaveLabs",
  parentUrl: "https://davelabs.co",
  sameAs: [
    "https://davelabs.co",
    "https://x.com/DaveLabs_",
    "https://www.instagram.com/davelabs__/",
    "https://linkedin.com/company/davelabs",
  ],
} as const;

export const url = (path: string) =>
  `${SITE.origin}${path.startsWith("/") ? path : `/${path}`}`;

export const postUrl = (slug: string) => url(`${SITE.newsPath}/${slug}`);

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatMonth(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
