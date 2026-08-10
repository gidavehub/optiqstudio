// A failed render, in as few words as a scene card can show.
//
// The server names every render failure before storing it — "Quota limit",
// "Policy violation", "Timed out" — because the two things that actually go
// wrong want opposite responses from the director, and for a long time both said
// "Video generation failed". functions/renderFailure.js is where the naming
// happens and what each name means.
//
// This is only the reader, and it exists for one reason: the stored error is not
// always one of those names. A scene that failed before failures were named
// still carries whatever was thrown at the time, and for a video render that is
// the entire failed interaction — several hundred characters of JSON, which is
// what actually ended up on the card. So anything that isn't a short, clean
// label is reported as the one honest short word instead.

/** Longest a stored error can be and still be a label rather than a dump. */
const LABEL_MAX = 24;

/** What the server writes between label and detail, on anything written before
 *  the message was cut down to the label alone. */
const SPLIT = " — ";

export function renderErrorLabel(error?: string | null): string {
  const text = (error || "").trim();
  if (!text) return "Failed";

  // "Quota limit — the per-minute cap was full…" → "Quota limit"
  const at = text.indexOf(SPLIT);
  const head = at > 0 ? text.slice(0, at).trim() : text;

  // A label is a couple of words. Anything longer, or anything with the shape of
  // a payload, is not something to put in front of a director.
  if (head.length > LABEL_MAX || /[{}[\]"]/.test(head)) return "Failed";
  return head;
}
