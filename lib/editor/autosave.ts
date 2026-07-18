/**
 * Optiq Editor Engine — autosave & conflict manager.
 *
 * Debounces document writes and resolves the live/remote race. All I/O is
 * injected (the `save` callback does the Firestore write; timers are
 * overridable), so the scheduling and conflict POLICY are fully unit-tested
 * with a fake clock. Revisions are a monotonic counter: each save bumps it,
 * and a remote snapshot only wins when the local buffer is clean — an in-flight
 * edit is never clobbered and the engine's undo history stays intact.
 */

import { EditorDoc } from "./types";
import { serializeDoc } from "./persistence";

export interface SavePayload {
  doc: EditorDoc;
  rev: number;
}

export type RemoteOutcome = "adopt-remote" | "keep-local" | "ignore";

export interface AutosaveOptions {
  debounceMs?: number;
  /** Revision already present in storage when the editor opened. */
  initialRev?: number;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  /** Persists the payload. Rejecting keeps the buffer dirty for retry. */
  save: (payload: SavePayload) => Promise<void>;
}

export class EditorAutosaver {
  private debounceMs: number;
  private baseRev: number;
  private now: () => number;
  private setTimer: (fn: () => void, ms: number) => unknown;
  private clearTimer: (handle: unknown) => void;
  private save: (payload: SavePayload) => Promise<void>;

  private lastDoc: EditorDoc | null = null;
  private dirty = false;
  private saving = false;
  private timer: unknown = null;
  private lastSavedAt = 0;

  constructor(opts: AutosaveOptions) {
    this.debounceMs = opts.debounceMs ?? 1500;
    this.baseRev = opts.initialRev ?? 0;
    this.now = opts.now ?? (() => Date.now());
    this.setTimer =
      opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms) as unknown);
    this.clearTimer =
      opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
    this.save = opts.save;
  }

  get rev(): number {
    return this.baseRev;
  }
  get isDirty(): boolean {
    return this.dirty;
  }
  get savedAt(): number {
    return this.lastSavedAt;
  }

  /** Record a new document state and schedule a debounced save. */
  markDirty(doc: EditorDoc): void {
    this.lastDoc = doc;
    this.dirty = true;
    this.schedule();
  }

  /** Subscribe to an engine so every change autosaves. Returns an unsubscribe. */
  bindEngine(engine: { subscribe: (fn: (doc: EditorDoc) => void) => () => void }): () => void {
    return engine.subscribe((doc) => this.markDirty(doc));
  }

  /** Force an immediate save of any pending changes. */
  async flush(): Promise<void> {
    if (this.timer != null) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
    await this.doSave();
  }

  /**
   * Reconcile an incoming remote snapshot.
   *  - dirty buffer            → keep-local (our next save wins; undo preserved)
   *  - clean and strictly newer → adopt-remote (and adopt its revision)
   *  - otherwise (our echo)    → ignore
   */
  onRemote(remoteRev: number): RemoteOutcome {
    if (this.dirty || this.saving) return "keep-local";
    if (remoteRev > this.baseRev) {
      this.baseRev = remoteRev;
      return "adopt-remote";
    }
    return "ignore";
  }

  /** Adopt a revision without saving (after adopting a remote document). */
  syncRev(rev: number): void {
    if (rev > this.baseRev) this.baseRev = rev;
  }

  dispose(): void {
    if (this.timer != null) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
  }

  private schedule(): void {
    if (this.timer != null) this.clearTimer(this.timer);
    this.timer = this.setTimer(() => {
      this.timer = null;
      void this.doSave();
    }, this.debounceMs);
  }

  private async doSave(): Promise<void> {
    if (this.saving) return; // in-flight save will reschedule if still dirty
    if (!this.dirty || !this.lastDoc) return;

    this.saving = true;
    const doc = this.lastDoc;
    const rev = this.baseRev + 1;
    this.dirty = false; // optimistic; restored on failure
    try {
      await this.save({ doc: serializeDoc(doc), rev });
      this.baseRev = rev;
      this.lastSavedAt = this.now();
    } catch {
      this.dirty = true; // keep pending for the next flush/markDirty
    } finally {
      this.saving = false;
      if (this.dirty) this.schedule();
    }
  }
}
