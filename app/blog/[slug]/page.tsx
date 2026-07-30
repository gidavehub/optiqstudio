import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import ArticleBody from "@/components/news/ArticleBody";
import { GridCard } from "@/components/news/NewsCard";
import ShareSheet from "@/components/news/ShareSheet";
import { HORIZON } from "@/lib/horizon-assets";
import { POSTS, allPosts, getPost, readingTime, relatedPosts } from "@/lib/news";
import { articleJsonLd, jsonLdScript } from "@/lib/news/jsonld";
import { SITE, formatDate, postUrl, url } from "@/lib/news/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};

  const hero = HORIZON[post.hero];
  const canonical = postUrl(post.slug);
  const image = { url: url(hero.og), width: 1200, height: 670, alt: post.title };

  return {
    title: post.title,
    description: post.excerpt,
    keywords: post.keywords,
    authors: post.authors.map((name) => ({ name })),
    category: post.category,
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: canonical,
      title: post.title,
      description: post.excerpt,
      siteName: SITE.name,
      locale: SITE.locale,
      publishedTime: post.published,
      modifiedTime: post.updated ?? post.published,
      authors: post.authors,
      section: post.category,
      tags: post.keywords,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [image.url],
      site: SITE.twitter,
    },
    other: {
      "article:published_time": post.published,
      "article:modified_time": post.updated ?? post.published,
      "article:section": post.category,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const hero = HORIZON[post.hero];
  const related = relatedPosts(post.slug);
  const minutes = readingTime(post.body);
  const total = allPosts().length;

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(articleJsonLd(post))}
      />

      <header className="mx-auto max-w-[1000px] px-5 pt-16 text-center sm:px-8 sm:pt-24">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[15px] text-[#5f6368]">
          <time dateTime={post.published}>{formatDate(post.published)}</time>
          <span>{post.category}</span>
          <span>{minutes} min read</span>
        </div>

        <h1 className="mx-auto mt-6 max-w-[860px] text-[38px] font-normal leading-[1.06] tracking-[-0.03em] text-[#1f1f1f] sm:text-[58px]">
          {post.title}
        </h1>

        <p className="mt-7 text-[17px] font-medium text-[#5f6368]">{post.authors.join(" and ")}</p>

        <ShareSheet url={postUrl(post.slug)} title={post.title} className="mt-7" />
      </header>

      <div className="mx-auto mt-14 max-w-[1290px] px-5 sm:px-8">
        <Image
          src={hero.src}
          alt={post.title}
          width={hero.width}
          height={hero.height}
          priority
          fetchPriority="high"
          placeholder="blur"
          blurDataURL={hero.blurDataURL}
          sizes="(max-width: 1290px) 100vw, 1290px"
          className="w-full rounded-2xl"
        />
      </div>

      <div className="mt-16 sm:mt-20">
        <ArticleBody body={post.body} />
      </div>

      <div className="mx-auto mt-14 max-w-[640px] px-5 sm:px-0">
        <div className="border-t border-[#e8eaed] pt-10">
          <ShareSheet url={postUrl(post.slug)} title={post.title} />
        </div>
      </div>

      {related.length > 0 && (
        <section className="mx-auto mt-20 max-w-[1290px] border-t border-[#e8eaed] px-5 py-16 sm:px-8">
          <div className="mb-10 flex items-end justify-between gap-6">
            <h2 className="text-[28px] font-normal tracking-[-0.022em] text-[#1f1f1f] sm:text-[34px]">
              More from the blog
            </h2>
            <Link
              href="/blog"
              className="inline-flex shrink-0 items-center gap-2 text-[15px] font-medium text-[#1f1f1f] hover:underline"
            >
              <ArrowLeft size={15} /> All {total} posts
            </Link>
          </div>
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <GridCard key={p.slug} post={p} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
