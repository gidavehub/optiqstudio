import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static media in /public (hero loops, dashboard ambience) is content-stable
  // and was being revalidated on every visit. These files are ~2.5MB each, so
  // that revalidation was a real cost on slow connections. Cache them hard —
  // if one changes, change its filename.
  async headers() {
    return [
      {
        source: "/media/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Horizon '26 brand assets — same rule, same reasoning.
        source: "/horizon/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },

  // Voice and Music used to live behind an /dashboard/audio gateway that no
  // longer exists — they're top-level studios now, sitting alongside Video and
  // Image. Anything already linked or bookmarked under the old tree lands on
  // the right studio instead of a 404. The two named children have to be
  // matched before /:id, which would otherwise swallow them.
  async redirects() {
    return [
      { source: "/dashboard/audio/voice", destination: "/dashboard/voice", permanent: true },
      { source: "/dashboard/audio/music", destination: "/dashboard/music", permanent: true },
      { source: "/dashboard/audio/:id", destination: "/dashboard/voice/:id", permanent: true },
      { source: "/dashboard/audio", destination: "/dashboard/voice", permanent: true },
    ];
  },
};

export default nextConfig;
