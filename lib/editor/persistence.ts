/**
 * Optiq Editor Engine — persistence helpers (pure).
 *
 * Serialize an EditorDoc into a Firestore-safe plain object and back. Firestore
 * rejects `undefined`, so the doc's optional fields (audio clips have no
 * transform, images no duration, etc.) are stripped on write and reappear as
 * absent-optional on read. Load goes through migrateDoc + validateDoc so a
 * corrupt or future-versioned document fails loudly instead of half-loading.
 */

import { EditorDoc, validateDoc } from "./types";
import { migrateDoc } from "./engine";

/** Project-document field names the editor owns. */
export const EDITOR_DOC_FIELD = "editorDoc";
export const EDITOR_DOC_REV_FIELD = "editorDocRev";

/**
 * Deep-clone `value` dropping every `undefined` (recursively), so the result is
 * safe to hand to Firestore. `null`, numbers, strings, booleans, arrays, and
 * nested objects are preserved; array order is kept.
 */
export function sanitizeForStore<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeForStore(v)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue;
    out[k] = sanitizeForStore(v);
  }
  return out as T;
}

/** Validate then produce a Firestore-safe representation of the document. */
export function serializeDoc(doc: EditorDoc): EditorDoc {
  validateDoc(doc);
  return sanitizeForStore(doc);
}

/** Parse a stored document: migrate to the current schema, then validate. */
export function deserializeDoc(raw: unknown): EditorDoc {
  const doc = migrateDoc(raw);
  validateDoc(doc);
  return doc;
}

/** True when there is any stored editor document on a project record. */
export function hasStoredDoc(projectData: Record<string, unknown> | null | undefined): boolean {
  return !!projectData && projectData[EDITOR_DOC_FIELD] != null;
}
