"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

// "Make an ad" is the way into the studio, so a separate Studio link would just
// be a second door to the same room.
const LINKS = [
  { label: "Blog", href: "/blog" },
  { label: "Enterprise", href: "/enterprise" },
  { label: "API", href: "/api-docs" },
];

function OptiqMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden className="shrink-0">
      <circle cx="16" cy="16" r="16" fill="white" stroke="#e5e5e5" strokeWidth={1} />
      <circle cx="16" cy="16" r="8" fill="none" stroke="black" strokeWidth={4} />
    </svg>
  );
}

export default function BlogHeader() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // This header also fronts the landing page now, which is where signed-out
  // visitors actually arrive, so the way in has to be somewhere. One slot,
  // either direction — no second call to action competing with "Make an ad".
  const links = [
    ...LINKS,
    user ? { label: "Studio", href: "/dashboard" } : { label: "Log in", href: "/login" },
  ];

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50">
        <nav className="mx-auto flex h-[68px] max-w-[1600px] items-center gap-8 px-5 sm:px-8 lg:px-12">
          <Link
            href="/"
            className="flex shrink-0 select-none items-center gap-2.5 text-[19px] font-bold lowercase leading-none tracking-tight text-[#1f1f1f]"
          >
            <OptiqMark />
            optiq studio
          </Link>

          <div className="hidden items-center gap-8 lg:flex">
            {links.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`text-[15px] font-medium tracking-[-0.01em] transition-colors ${
                    active ? "text-[#1f1f1f]" : "text-[#5f6368] hover:text-[#1f1f1f]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            <a
              href="https://davelabs.co/news"
              target="_blank"
              rel="noopener"
              className="hidden rounded-full border border-[#dadce0] bg-white px-5 py-2.5 text-[14px] font-medium text-[#1f1f1f] transition-colors hover:bg-[#f8f9fa] md:block"
            >
              DaveLabs News
            </a>
            <Link
              href="/dashboard/create"
              className="hidden rounded-full bg-[#1f1f1f] px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-black sm:block"
            >
              Make an ad
            </Link>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dadce0] bg-white text-[#1f1f1f] lg:hidden"
            >
              <Menu size={18} />
            </button>
          </div>
        </nav>
      </header>

      {open && (
        <div className="fixed inset-0 z-[60] bg-white lg:hidden">
          <div className="flex h-[68px] items-center justify-between px-5 sm:px-8">
            <Link href="/" className="flex items-center gap-2.5 text-[19px] font-bold lowercase text-[#1f1f1f]">
              <OptiqMark /> optiq studio
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dadce0]"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex flex-col px-5 pt-6 sm:px-8">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="border-b border-[#e8eaed] py-5 text-[26px] font-normal tracking-[-0.02em] text-[#1f1f1f]"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/dashboard/create"
              className="mt-8 rounded-full bg-[#1f1f1f] px-6 py-3.5 text-center text-[15px] font-medium text-white"
            >
              Make an ad
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
