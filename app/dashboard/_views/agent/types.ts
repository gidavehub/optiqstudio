// Shared types for the storyline agent chat.
//
// These mirror what functions/storylineAgent writes into
// projects/{id}/agentChat — the client never invents these shapes, it only
// renders them.

/**
 * A still OR clip the director attached to a message, held in memory until sent.
 * Same shape the Image and Video studios' consoles use, so the attach control
 * and its previews behave identically across the product.
 */
export interface AgentAttachment {
  id: string;
  base64: string;
  mimeType: string;
  /** data: URL for the local thumbnail, never uploaded. */
  preview: string;
  /** 'image' or 'video' — decides the thumbnail and the size ceiling. */
  kind: "image" | "video";
}

/** What a sent attachment looks like once it lives in Storage. */
export interface AgentAttachmentRef {
  path: string;
  mimeType: string;
}

/** One tool call in an assistant turn's work log. */
export interface AgentStep {
  /** The tool's name, e.g. "rewrite_scene". */
  tool: string;
  /** Human label the agent's tool server produced, e.g. "Rewriting scene 4". */
  label: string;
  /** True when the tool changed the film (as opposed to just reading it). */
  writes: boolean;
  status: "running" | "done" | "failed";
  /** Live progress while running, or the outcome once finished. */
  detail?: string;
}

export type AgentTurnStatus = "queued" | "working" | "done" | "failed";

export interface AgentChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  steps?: AgentStep[];
  status?: AgentTurnStatus;
  error?: string;
  /** True when this turn actually edited the script. */
  touchedFilm?: boolean;
  createdAt: string;
  /** Last write from the agent — used to spot a turn that died mid-flight. */
  updatedAt?: string;
  /** Stills sent with a user message, as Storage refs. */
  images?: AgentAttachmentRef[];
}
