import type { MetadataRoute } from "next";
import { SITE, url } from "@/lib/news/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Signed-in surfaces: nothing indexable, and crawling them just burns
        // budget on redirects to /login.
        disallow: ["/api/", "/dashboard/", "/login"],
      },
      { userAgent: "Googlebot-News", allow: ["/blog", "/blog/"] },
      { userAgent: "Googlebot-Image", allow: "/" },
    ],
    sitemap: [url("/sitemap.xml"), url("/news-sitemap.xml")],
    host: SITE.origin,
  };
}
