import Link from "next/link";
import { SITE } from "@/lib/news/site";

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "Make an ad", href: "/dashboard/create" },
      { label: "Video Studio", href: "/dashboard/video" },
      { label: "Audio Studio", href: "/dashboard/audio" },
      { label: "Image Studio", href: "/dashboard/image" },
      { label: "Developer API", href: "/api-docs" },
    ],
  },
  {
    heading: "Enterprise",
    links: [
      { label: "Optiq Studio Enterprise", href: "/enterprise" },
      { label: "Custom video production", href: "/blog/optiq-studio-enterprise" },
      { label: "Campaign Engine", href: "/blog/enterprise-campaign-engine" },
      { label: "329 industries", href: "/blog/329-industries" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "DaveLabs", href: "https://davelabs.co" },
      { label: "DaveLabs News", href: "https://davelabs.co/news" },
      { label: "Amaka AI", href: "https://amaka.app" },
      { label: "RSS", href: "/blog/rss.xml" },
    ],
  },
  {
    heading: "Contact",
    links: [
      { label: SITE.email, href: `mailto:${SITE.email}` },
      { label: SITE.sales, href: `mailto:${SITE.sales}` },
      { label: SITE.phone, href: SITE.phoneHref },
      { label: "WhatsApp", href: SITE.whatsapp },
    ],
  },
];

export default function BlogFooter() {
  return (
    <footer className="border-t border-[#e8eaed] bg-white">
      <div className="mx-auto max-w-[1600px] px-5 py-16 sm:px-8 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div>
            <div className="flex items-center gap-2.5 text-[20px] font-bold lowercase tracking-tight text-[#1f1f1f]">
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden>
                <circle cx="16" cy="16" r="16" fill="white" stroke="#e5e5e5" strokeWidth={1} />
                <circle cx="16" cy="16" r="8" fill="none" stroke="black" strokeWidth={4} />
              </svg>
              optiq studio
            </div>
            <p className="mt-5 max-w-xs text-[15px] leading-[1.65] text-[#5f6368]">
              {SITE.tagline} Built in The Gambia. A product of{" "}
              <a
                href={SITE.parentUrl}
                target="_blank"
                rel="noopener"
                className="text-[#1f1f1f] underline decoration-[#bdc1c6] underline-offset-[3px]"
              >
                DaveLabs
              </a>
              .
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
            {COLUMNS.map((col) => (
              <div key={col.heading}>
                <h2 className="text-[13px] font-medium uppercase tracking-[0.08em] text-[#5f6368]">
                  {col.heading}
                </h2>
                <ul className="mt-4 flex flex-col gap-3">
                  {col.links.map((link) => {
                    const external = /^(https?:|mailto:|tel:)/.test(link.href);
                    return (
                      <li key={link.label}>
                        {external ? (
                          <a
                            href={link.href}
                            target={link.href.startsWith("http") ? "_blank" : undefined}
                            rel="noopener"
                            className="text-[15px] text-[#3c4043] transition-colors hover:text-[#1f1f1f]"
                          >
                            {link.label}
                          </a>
                        ) : (
                          <Link
                            href={link.href}
                            className="text-[15px] text-[#3c4043] transition-colors hover:text-[#1f1f1f]"
                          >
                            {link.label}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-[#e8eaed] pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-[#5f6368]">
            © {new Date().getFullYear()} DaveLabs. All rights reserved.
          </p>
          <p className="text-[13px] text-[#5f6368]">Banjul, The Gambia · West Africa</p>
        </div>
      </div>
    </footer>
  );
}
