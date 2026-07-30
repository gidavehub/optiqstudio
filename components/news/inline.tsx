import Link from "next/link";
import type { ReactNode } from "react";

// A deliberately tiny inline formatter: **bold**, *italic*, [label](href).
// Article bodies are typed data, not user input, so there is nothing to
// sanitise and no reason to pull in a markdown runtime.

const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;

export function inline(text: string): ReactNode[] {
  return text.split(TOKEN).filter(Boolean).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-medium text-[#1f1f1f]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      const [, label, href] = link;
      const external = /^https?:\/\//.test(href);
      const className =
        "underline decoration-[#bdc1c6] underline-offset-[3px] transition-colors hover:decoration-[#1f1f1f]";
      return external ? (
        <a key={i} href={href} target="_blank" rel="noopener" className={className}>
          {label}
        </a>
      ) : (
        <Link key={i} href={href} className={className}>
          {label}
        </Link>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
