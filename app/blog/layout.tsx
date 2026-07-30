import type { Metadata } from "next";
import BlogHeader from "@/components/news/BlogHeader";
import BlogFooter from "@/components/news/BlogFooter";
import ProgressiveBlur from "@/components/news/ProgressiveBlur";

export const metadata: Metadata = {
  alternates: {
    canonical: "/blog",
    types: {
      "application/rss+xml": [{ url: "/blog/rss.xml", title: "Optiq Studio Blog" }],
    },
  },
};

// The app shell is dark; the blog is light, like the enterprise page. Scoped
// here rather than in globals so the studio keeps its own theme.
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-[#1f1f1f]">
      <BlogHeader />
      <ProgressiveBlur />
      <main className="pt-[68px]">{children}</main>
      <BlogFooter />
    </div>
  );
}
