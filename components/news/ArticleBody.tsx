import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HORIZON } from "@/lib/horizon-assets";
import type { Block } from "@/lib/news/types";
import LiteYouTube from "./LiteYouTube";
import { inline } from "./inline";

// One renderer for every article on the site. Prose sits in a fixed measure;
// images, video and data blocks are allowed to break out wider, which is what
// gives the layout its rhythm.

const MEASURE = "mx-auto w-full max-w-[640px] px-5 sm:px-0";
const WIDE = "mx-auto w-full max-w-[1000px] px-5 sm:px-8";

export default function ArticleBody({ body }: { body: Block[] }) {
  return (
    <div className="flex flex-col gap-6 pb-4">
      {body.map((block, i) => {
        switch (block.t) {
          case "lede":
            return (
              <p
                key={i}
                className={`${MEASURE} text-[20px] leading-[1.6] tracking-[-0.011em] text-[#1f1f1f] sm:text-[21px]`}
              >
                {inline(block.text)}
              </p>
            );

          case "p":
            return (
              <p
                key={i}
                className={`${MEASURE} text-[17px] leading-[1.75] text-[#3c4043] sm:text-[18px]`}
              >
                {inline(block.text)}
              </p>
            );

          case "h2":
            return (
              <h2
                key={i}
                className={`${MEASURE} mt-10 text-[30px] font-normal leading-[1.2] tracking-[-0.022em] text-[#1f1f1f] sm:text-[36px]`}
              >
                {block.text}
              </h2>
            );

          case "h3":
            return (
              <h3
                key={i}
                className={`${MEASURE} mt-6 text-[21px] font-medium leading-[1.3] tracking-[-0.015em] text-[#1f1f1f] sm:text-[23px]`}
              >
                {block.text}
              </h3>
            );

          case "list":
            return (
              <ul
                key={i}
                className={`${MEASURE} flex list-none flex-col gap-3 text-[17px] leading-[1.7] text-[#3c4043] sm:text-[18px]`}
              >
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-3">
                    <span aria-hidden className="mt-[11px] h-[5px] w-[5px] shrink-0 rounded-full bg-[#9aa0a6]" />
                    <span>{inline(item)}</span>
                  </li>
                ))}
              </ul>
            );

          case "quote":
            return (
              <figure key={i} className={`${MEASURE} my-6`}>
                <blockquote className="border-l-2 border-[#1f1f1f] pl-6 text-[22px] font-normal leading-[1.45] tracking-[-0.015em] text-[#1f1f1f] sm:text-[25px]">
                  {inline(block.text)}
                </blockquote>
                {block.cite && (
                  <figcaption className="mt-4 pl-6 text-[14px] text-[#5f6368]">
                    {block.cite}
                  </figcaption>
                )}
              </figure>
            );

          case "image": {
            const asset = HORIZON[block.asset];
            return (
              <figure key={i} className={`${block.full ? WIDE : MEASURE} my-4`}>
                <Image
                  src={asset.src}
                  alt={block.caption ? String(block.caption).replace(/[*[\]()]/g, "") : ""}
                  width={asset.width}
                  height={asset.height}
                  placeholder="blur"
                  blurDataURL={asset.blurDataURL}
                  sizes={block.full ? "(max-width: 1000px) 100vw, 1000px" : "(max-width: 640px) 100vw, 640px"}
                  className="w-full rounded-2xl"
                />
                {block.caption && (
                  <figcaption className="mt-3 text-[13px] leading-[1.6] text-[#5f6368]">
                    {inline(block.caption)}
                  </figcaption>
                )}
              </figure>
            );
          }

          case "youtube":
            return (
              <figure key={i} className={`${WIDE} my-4`}>
                <LiteYouTube id={block.id} title={block.title} />
                {block.caption && (
                  <figcaption className="mt-3 text-[13px] leading-[1.6] text-[#5f6368]">
                    {inline(block.caption)}
                  </figcaption>
                )}
              </figure>
            );

          case "stats":
            return (
              <div key={i} className={`${WIDE} my-6`}>
                <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-[#e8eaed] sm:grid-cols-3">
                  {block.items.map((item) => (
                    <div key={item.label} className="bg-[#f8f9fa] px-7 py-8">
                      <div className="text-[38px] font-normal leading-none tracking-[-0.03em] text-[#1f1f1f]">
                        {item.value}
                      </div>
                      <div className="mt-3 text-[14px] leading-[1.5] text-[#5f6368]">
                        {item.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );

          case "agenda":
            return (
              <div key={i} className={`${MEASURE} my-4`}>
                <ol className="overflow-hidden rounded-2xl border border-[#e8eaed]">
                  {block.items.map((item, j) => (
                    <li
                      key={item.at}
                      className={`flex items-baseline gap-5 px-6 py-4 ${
                        j % 2 ? "bg-[#f8f9fa]" : "bg-white"
                      }`}
                    >
                      <span className="w-[52px] shrink-0 font-mono text-[13px] tabular-nums text-[#5f6368]">
                        {item.at}
                      </span>
                      <span className="text-[16px] leading-[1.5] text-[#1f1f1f]">
                        {item.label}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            );

          case "callout":
            return (
              <aside key={i} className={`${MEASURE} my-6`}>
                <div className="rounded-2xl bg-[#f8f9fa] px-7 py-7">
                  <h3 className="text-[19px] font-medium tracking-[-0.012em] text-[#1f1f1f]">
                    {block.title}
                  </h3>
                  <p className="mt-2.5 text-[16px] leading-[1.65] text-[#3c4043]">
                    {inline(block.body)}
                  </p>
                  {block.cta && (
                    <Link
                      href={block.cta.href}
                      className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#1f1f1f] px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-black"
                    >
                      {block.cta.label} <ArrowRight size={15} />
                    </Link>
                  )}
                </div>
              </aside>
            );

          case "divider":
            return <hr key={i} className={`${MEASURE} my-6 border-t border-[#e8eaed]`} />;

          default:
            return null;
        }
      })}
    </div>
  );
}
