"use client";

// Resolves a generation's attached reference images (stored as Firebase
// Storage paths on the generation doc) into displayable download URLs.

import { useEffect, useState } from "react";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { storage } from "../../../lib/firebase";

export interface StoredRefImage {
  path?: string;
  mimeType?: string;
}

export function useReferenceImages(images: StoredRefImage[] | undefined): string[] {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const paths = (images ?? []).map((i) => i?.path).filter(Boolean) as string[];
    if (paths.length === 0) {
      setUrls([]);
      return;
    }
    void Promise.all(
      paths.map((p) =>
        getDownloadURL(storageRef(storage, p)).catch(() => null)
      )
    ).then((resolved) => {
      if (!cancelled) setUrls(resolved.filter(Boolean) as string[]);
    });
    return () => {
      cancelled = true;
    };
  }, [JSON.stringify(images?.map((i) => i?.path))]); // eslint-disable-line react-hooks/exhaustive-deps

  return urls;
}
