import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { HORIZON } from "@/lib/horizon-assets";
import { formatMonth } from "@/lib/news/site";
import type { PostCard } from "@/lib/news/types";

function Meta({ post, className = "" }: { post: PostCard; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-1 text-[14px] text-[#5f6368] ${className}`}>
      <time dateTime={post.published}>{formatMonth(post.published)}</time>
      <span>{post.category}</span>
      <span className="inline-flex items-center gap-1 text-[#1f1f1f]">
        Learn more
        <ChevronRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
      </span>
    </div>
  );
}

/** The lead story: headline first, then the image beneath it. */
export function FeaturedCard({ post }: { post: PostCard }) {
  const asset = HORIZON[post.hero];
  return (
    <article>
      <Link href={`/blog/${post.slug}`} className="group block">
        <h2 className="text-[40px] font-normal leading-[1.08] tracking-[-0.028em] text-[#1f1f1f] sm:text-[52px]">
          {post.title}
        </h2>
        <Meta post={post} className="mt-6" />
        <div className="mt-8 overflow-hidden rounded-2xl bg-[#f1f3f4]">
          <Image
            src={asset.src}
            alt=""
            width={asset.width}
            height={asset.height}
            priority
            fetchPriority="high"
            placeholder="blur"
            blurDataURL={asset.blurDataURL}
            sizes="(max-width: 1024px) 100vw, 46vw"
            className="w-full transition-transform duration-500 group-hover:scale-[1.02]"
          />
        </div>
      </Link>
    </article>
  );
}

/**
 * The right-hand rail entry: text left, square thumbnail right. `tinted` puts
 * it on a filled card, which the index alternates in to break up the run.
 */
export function RailCard({
  post,
  tinted = false,
  priority = false,
}: {
  post: PostCard;
  tinted?: boolean;
  priority?: boolean;
}) {
  const asset = HORIZON[post.cardImage ?? post.hero];
  return (
    <article className={tinted ? "rounded-2xl bg-[#f8f9fa] p-6 sm:p-7" : ""}>
      <Link href={`/blog/${post.slug}`} className="group flex items-start gap-5 sm:gap-8">
        <div className="min-w-0 flex-1">
          <h3 className="text-[21px] font-normal leading-[1.22] tracking-[-0.018em] text-[#1f1f1f] sm:text-[25px]">
            {post.cardTitle ?? post.title}
          </h3>
          <Meta post={post} className="mt-4" />
        </div>
        <div className="w-[92px] shrink-0 overflow-hidden rounded-xl bg-[#f1f3f4] sm:w-[132px]">
          <Image
            src={asset.src}
            alt=""
            width={asset.width}
            height={asset.height}
            priority={priority}
            placeholder="blur"
            blurDataURL={asset.blurDataURL}
            sizes="132px"
            className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        </div>
      </Link>
    </article>
  );
}

/** Used for "More from the newsroom" under an article. */
export function GridCard({ post }: { post: PostCard }) {
  const asset = HORIZON[post.cardImage ?? post.hero];
  return (
    <article>
      <Link href={`/blog/${post.slug}`} className="group block">
        <div className="overflow-hidden rounded-2xl bg-[#f1f3f4]">
          <Image
            src={asset.src}
            alt=""
            width={asset.width}
            height={asset.height}
            loading="lazy"
            placeholder="blur"
            blurDataURL={asset.blurDataURL}
            sizes="(max-width: 768px) 100vw, 33vw"
            className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
        <h3 className="mt-5 text-[19px] font-normal leading-[1.25] tracking-[-0.015em] text-[#1f1f1f]">
          {post.cardTitle ?? post.title}
        </h3>
        <Meta post={post} className="mt-3" />
      </Link>
    </article>
  );
}
