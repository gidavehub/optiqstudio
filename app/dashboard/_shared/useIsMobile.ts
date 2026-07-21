"use client";

import { useEffect, useState } from "react";

/**
 * True on phone-sized viewports. Matches Tailwind's `sm` breakpoint so CSS and
 * JS agree on what "mobile" means.
 *
 * Starts false and resolves after mount, so server and first client render
 * always agree (no hydration mismatch). Components that branch on this should
 * therefore treat desktop as the initial paint.
 */
export function useIsMobile(query = "(max-width: 639px)"): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);

  return isMobile;
}

export default useIsMobile;
