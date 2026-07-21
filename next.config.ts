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
    ];
  },
};

export default nextConfig;
