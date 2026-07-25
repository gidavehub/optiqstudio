"use client";

// Enterprise contact. Reaching us IS the conversion on /enterprise — if a brand
// can't get hold of the team, the page has failed. So every "Start a project"
// button opens this dialog instead of firing a bare mailto (which silently does
// nothing on a machine with no mail client configured), and the same details are
// repeated in the page's CTA band.

import { useEffect, useState } from "react";
import { Mail, Phone, X } from "lucide-react";

export const CONTACT = {
  emails: ["optiq@davelabs.co", "sales@davelabs.co"],
  phoneDisplay: "+220 781 0880",
  phoneHref: "tel:+2207810880",
  whatsappHref: "https://wa.me/2207810880",
  mailSubject: "?subject=Optiq%20Studio%20Enterprise%20project",
};

/** WhatsApp's own glyph — lucide has no brand icon and recognition matters here. */
export function WhatsAppIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0 0 20.464 3.488" />
    </svg>
  );
}

function Row({
  icon,
  label,
  value,
  href,
  tint,
  external,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
  tint: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white px-4 py-3.5 transition-colors hover:border-neutral-400"
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: tint }}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
          {label}
        </span>
        <span className="block truncate text-[16px] font-bold text-black">{value}</span>
      </span>
    </a>
  );
}

/** The contact rows — shared by the dialog and the page's CTA band. */
export function ContactRows() {
  return (
    <div className="flex flex-col gap-2.5">
      <Row
        icon={<WhatsAppIcon size={22} />}
        label="WhatsApp"
        value={CONTACT.phoneDisplay}
        href={CONTACT.whatsappHref}
        tint="#25D366"
        external
      />
      <Row
        icon={<Phone size={19} />}
        label="Call us"
        value={CONTACT.phoneDisplay}
        href={CONTACT.phoneHref}
        tint="#000000"
      />
      {CONTACT.emails.map((email, i) => (
        <Row
          key={email}
          icon={<Mail size={19} />}
          label={i === 0 ? "Email" : "Sales"}
          value={email}
          href={`mailto:${email}${CONTACT.mailSubject}`}
          tint="#1a56db"
        />
      ))}
    </div>
  );
}

/**
 * A "Start a project" button that opens the contact dialog.
 * `className` styles the trigger so the same component serves the nav, the hero
 * and the CTA band.
 */
export default function StartProjectButton({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Contact Optiq Studio Enterprise"
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-2xl bg-white p-6 text-black sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[22px] font-bold leading-tight tracking-tight">Talk to our team</h2>
                <p className="mt-1 text-[13px] text-neutral-500">
                  Reach us on any of these — we reply fast.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="-mr-1 -mt-1 rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-black"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5">
              <ContactRows />
            </div>

            <a
              href={CONTACT.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#25D366" }}
            >
              <WhatsAppIcon size={18} />
              Message us on WhatsApp
            </a>
          </div>
        </div>
      )}
    </>
  );
}
