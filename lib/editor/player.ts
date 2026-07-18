/**
 * Optiq Editor Engine — DOM playback adapter.
 *
 * Binds a headless PlaybackController to real DOM: one stacked <video>/<audio>
 * element per track inside a preview container, each routed through a WebAudio
 * GainNode for per-clip volume and fades. This file OWNS no timing or mixing
 * logic — it reconciles elements to the desired state computed in playback.ts.
 * It touches the DOM/WebAudio, so it is exercised by the browser and the
 * Stage-8 UI, not the Node test suite (the scheduling it renders is fully
 * unit-tested in scripts/test-playback-engine.ts).
 *
 * Media elements are created with crossOrigin="anonymous" so WebAudio can mix
 * them. If a source host rejects CORS, the element errors out entirely — in
 * that case the track falls back to "direct" mode: a plain element without
 * crossOrigin whose volume is set directly (no WebAudio), so playback keeps
 * working instead of showing a black screen.
 */

import { EditorDoc } from "./types";
import {
  AudioVoiceState,
  PlaybackController,
  PlaybackFrame,
  VideoLayerState,
  needsResync,
} from "./playback";

interface TrackMedia {
  el: HTMLVideoElement;
  /** Lazily-created overlay for image assets (a <video> cannot render them). */
  img: HTMLImageElement | null;
  gain: GainNode | null;
  source: MediaElementAudioSourceNode | null;
  currentUrl: string | null;
  /** True when CORS failed and this track bypasses WebAudio. */
  direct: boolean;
  zIndex: number;
  hidden: boolean;
}

export interface EditorPlayerOptions {
  loop?: boolean;
  /** Seek-correction threshold, seconds. */
  resyncThreshold?: number;
}

export class EditorPlayer {
  readonly controller: PlaybackController;
  private container: HTMLElement;
  private doc: EditorDoc;
  private media = new Map<string, TrackMedia>();
  private audioCtx: AudioContext | null = null;
  private rafId: number | null = null;
  private unsub: () => void;
  private resyncThreshold: number;

  constructor(container: HTMLElement, doc: EditorDoc, opts: EditorPlayerOptions = {}) {
    this.container = container;
    this.doc = doc;
    this.resyncThreshold = opts.resyncThreshold ?? 0.25;
    this.controller = new PlaybackController(doc, { loop: opts.loop });
    this.buildTracks();
    this.unsub = this.controller.subscribe((frame) => this.render(frame));
  }

  // ── Transport passthrough ───────────────────────────────────────────────

  play(): void {
    void this.ensureAudioContext();
    this.controller.play();
    this.startLoop();
  }

  pause(): void {
    this.controller.pause();
    this.stopLoop();
    this.pauseAllElements();
  }

  seek(time: number): void {
    this.controller.seek(time);
  }

  toggle(): void {
    this.controller.isPlaying() ? this.pause() : this.play();
  }

  setDoc(doc: EditorDoc): void {
    this.doc = doc;
    this.buildTracks(); // add/remove elements for new/removed tracks
    this.controller.setDoc(doc);
  }

  dispose(): void {
    this.stopLoop();
    this.unsub();
    for (const m of this.media.values()) {
      try {
        m.source?.disconnect();
        m.gain?.disconnect();
      } catch {
        /* already torn down */
      }
      m.el.remove();
      m.img?.remove();
    }
    this.media.clear();
    if (this.audioCtx) void this.audioCtx.close();
    this.audioCtx = null;
  }

  // ── Element pool ────────────────────────────────────────────────────────

  private createElement(trackId: string, zIndex: number, hidden: boolean, direct: boolean): HTMLVideoElement {
    const el = document.createElement("video");
    el.playsInline = true;
    // Element audio is silenced while WebAudio owns the mix; direct mode
    // (CORS fallback) plays the element itself, volume set in applyAudio.
    el.muted = !direct;
    el.preload = "auto";
    if (!direct) el.crossOrigin = "anonymous";
    el.style.position = "absolute";
    el.style.inset = "0";
    el.style.width = "100%";
    el.style.height = "100%";
    el.style.objectFit = "contain";
    el.style.zIndex = String(zIndex);
    el.style.pointerEvents = "none";
    if (hidden) el.style.display = "none";
    el.addEventListener("error", () => this.handleMediaError(trackId));
    this.container.appendChild(el);
    return el;
  }

  private buildTracks(): void {
    const wanted = new Set(this.doc.tracks.map((t) => t.id));
    for (const [trackId, m] of this.media) {
      if (!wanted.has(trackId)) {
        m.el.remove();
        m.img?.remove();
        this.media.delete(trackId);
      }
    }
    // Bottom→top: base video track first in DOM (lowest z-index).
    this.doc.tracks.forEach((track, index) => {
      const existing = this.media.get(track.id);
      if (existing) {
        existing.zIndex = index;
        existing.el.style.zIndex = String(index);
        if (existing.img) existing.img.style.zIndex = String(index);
        return;
      }
      const hidden = track.kind === "audio";
      const el = this.createElement(track.id, index, hidden, false);
      const m: TrackMedia = {
        el,
        img: null,
        gain: null,
        source: null,
        currentUrl: null,
        direct: false,
        zIndex: index,
        hidden,
      };
      this.media.set(track.id, m);
      // Tracks born mid-session (e.g. a layer dropped during playback) join
      // the mix immediately instead of waiting for the next play() call.
      if (this.audioCtx) this.wireElement(m);
    });
  }

  /**
   * A media element failed to load. The overwhelmingly common cause with
   * crossOrigin set is a host without CORS headers — rebuild the track in
   * direct mode (no crossOrigin, no WebAudio) so playback still works.
   */
  private handleMediaError(trackId: string): void {
    const m = this.media.get(trackId);
    if (!m || m.direct) return;
    const failedUrl = m.currentUrl;
    try {
      m.source?.disconnect();
      m.gain?.disconnect();
    } catch {
      /* not wired */
    }
    m.source = null;
    m.gain = null;
    m.el.remove();
    m.direct = true;
    m.el = this.createElement(trackId, m.zIndex, m.hidden, true);
    m.currentUrl = null;
    if (failedUrl) {
      // Re-apply the current frame so the fresh element picks the URL back up.
      this.render(this.controller.frame());
    }
  }

  /**
   * Route one element through a GainNode. CRITICAL: the element must be
   * UNMUTED afterwards — createMediaElementSource captures the element's
   * muted/volume state, so a muted element feeds pure silence into the graph
   * (this was why clips played picture with no sound). Once wired, the
   * element's direct output is disconnected and the gain node owns loudness.
   */
  private wireElement(m: TrackMedia): void {
    if (m.source || m.direct || !this.audioCtx) return;
    try {
      m.source = this.audioCtx.createMediaElementSource(m.el);
      m.gain = this.audioCtx.createGain();
      m.gain.gain.value = 0;
      m.source.connect(m.gain).connect(this.audioCtx.destination);
      m.el.muted = false;
      m.el.volume = 1;
    } catch {
      /* element may already be attached elsewhere */
    }
  }

  private async ensureAudioContext(): Promise<void> {
    if (!this.audioCtx) {
      const Ctor: typeof AudioContext =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new Ctor();
    }
    // Lazily wire each element into the graph (skip CORS-fallback tracks —
    // a MediaElementSource on tainted media outputs pure silence).
    for (const m of this.media.values()) this.wireElement(m);
    if (this.audioCtx.state === "suspended") await this.audioCtx.resume();
  }

  // ── Frame reconciliation ────────────────────────────────────────────────

  private render(frame: PlaybackFrame): void {
    for (const layer of frame.video) this.applyVideoLayer(layer, frame.playing);
    this.applyAudioTracks(frame);
    this.applyGains(frame.audio);
  }

  private ensureImageEl(m: TrackMedia): HTMLImageElement {
    if (m.img) return m.img;
    const img = document.createElement("img");
    img.style.position = "absolute";
    img.style.inset = "0";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "contain";
    img.style.zIndex = String(m.zIndex);
    img.style.pointerEvents = "none";
    img.style.display = "none";
    this.container.appendChild(img);
    m.img = img;
    return img;
  }

  private applyVideoLayer(layer: VideoLayerState, playing: boolean): void {
    const m = this.media.get(layer.trackId);
    if (!m) return;
    const { el } = m;

    if (!layer.clipId || !layer.url) {
      el.style.opacity = "0";
      if (!el.paused) el.pause();
      if (m.img) m.img.style.display = "none";
      return;
    }

    // Still images render through an <img>; the <video> element for the track
    // goes dormant while one is active.
    if (layer.isImage) {
      const img = this.ensureImageEl(m);
      if (img.getAttribute("src") !== layer.url) img.src = layer.url;
      img.style.display = "block";
      this.applyTransform(img, layer);
      el.style.opacity = "0";
      if (!el.paused) el.pause();
      return;
    }
    if (m.img) m.img.style.display = "none";

    if (m.currentUrl !== layer.url) {
      el.src = layer.url;
      m.currentUrl = layer.url;
      el.currentTime = layer.sourceTime;
    } else if (needsResync(el.currentTime, layer.sourceTime, this.resyncThreshold)) {
      el.currentTime = layer.sourceTime;
    }

    el.playbackRate = layer.speed;
    this.applyTransform(el, layer);

    if (playing) {
      if (el.paused) void el.play().catch(() => undefined);
    } else if (!el.paused) {
      el.pause();
    }
  }

  private applyTransform(el: HTMLElement, layer: VideoLayerState): void {
    // Applies to EVERY clip, base track included — shrinking/rotating the main
    // video is a real edit, not an overlay-only trick.
    const t = layer.transform;
    const isDefault =
      t.x === 0 && t.y === 0 && t.scale === 1 && t.rotation === 0 && t.opacity === 1;
    if (isDefault) {
      el.style.transform = "none";
      el.style.opacity = "1";
      return;
    }
    el.style.transform =
      `translate(${(t.x * 100).toFixed(3)}%, ${(t.y * 100).toFixed(3)}%) ` +
      `scale(${t.scale}) rotate(${t.rotation}deg)`;
    el.style.opacity = String(t.opacity);
  }

  /**
   * Drive the hidden elements of audio tracks (src / seek / play). Video-track
   * embedded audio rides the same element as the picture, so only audio-kind
   * tracks are handled here.
   */
  private applyAudioTracks(frame: PlaybackFrame): void {
    const byTrack = new Map<string, AudioVoiceState>();
    for (const v of frame.audio) byTrack.set(v.trackId, v);
    for (const track of this.doc.tracks) {
      if (track.kind !== "audio") continue;
      const m = this.media.get(track.id);
      if (!m) continue;
      const voice = byTrack.get(track.id);
      const { el } = m;
      if (!voice) {
        if (!el.paused) el.pause();
        continue;
      }
      if (m.currentUrl !== voice.url) {
        el.src = voice.url;
        m.currentUrl = voice.url;
        el.currentTime = voice.sourceTime;
      } else if (needsResync(el.currentTime, voice.sourceTime, this.resyncThreshold)) {
        el.currentTime = voice.sourceTime;
      }
      el.playbackRate = voice.speed;
      if (frame.playing) {
        if (el.paused) void el.play().catch(() => undefined);
      } else if (!el.paused) {
        el.pause();
      }
    }
  }

  private applyGains(voices: AudioVoiceState[]): void {
    const byTrack = new Map<string, AudioVoiceState>();
    for (const v of voices) byTrack.set(v.trackId, v);
    const t = this.audioCtx?.currentTime ?? 0;
    for (const [trackId, m] of this.media) {
      const voice = byTrack.get(trackId);
      const gain = voice ? voice.gain : 0;
      if (m.direct) {
        m.el.volume = Math.max(0, Math.min(1, gain));
        m.el.muted = gain <= 1e-4;
      } else if (m.gain && this.audioCtx) {
        m.gain.gain.setTargetAtTime(gain, t, 0.015);
      }
    }
  }

  // ── rAF loop ──────────────────────────────────────────────────────────────

  private startLoop(): void {
    if (this.rafId !== null) return;
    const step = () => {
      this.controller.tick();
      if (this.controller.isPlaying()) {
        this.rafId = requestAnimationFrame(step);
      } else {
        this.rafId = null;
        this.pauseAllElements();
      }
    };
    this.rafId = requestAnimationFrame(step);
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private pauseAllElements(): void {
    for (const m of this.media.values()) if (!m.el.paused) m.el.pause();
  }
}
