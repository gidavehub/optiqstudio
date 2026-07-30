// The blur that "pours" out of the top of the page.
//
// A single backdrop-filter gives you a hard edge where the blur stops. Stacking
// six layers — each blurring twice as much as the last, each masked to a
// shorter run from the top — makes the transition continuous: the strip right
// under the header carries all six blurs, and it eases to nothing by the
// bottom. A white gradient sits on top so the page colour fades in with it.

const LAYERS = [
  { blur: 0.5, stop: 100 },
  { blur: 1, stop: 84 },
  { blur: 2, stop: 68 },
  { blur: 4, stop: 52 },
  { blur: 8, stop: 36 },
  { blur: 16, stop: 20 },
];

export default function ProgressiveBlur({
  height = 128,
  from = "rgba(255,255,255,0.92)",
  className = "",
}: {
  height?: number;
  /** Colour poured from the top edge — match the page background. */
  from?: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-x-0 top-0 z-40 ${className}`}
      style={{ height }}
    >
      {LAYERS.map((layer) => {
        const mask = `linear-gradient(to bottom, #000 0%, #000 ${layer.stop * 0.4}%, transparent ${layer.stop}%)`;
        return (
          <div
            key={layer.blur}
            style={{
              position: "absolute",
              inset: 0,
              backdropFilter: `blur(${layer.blur}px)`,
              WebkitBackdropFilter: `blur(${layer.blur}px)`,
              maskImage: mask,
              WebkitMaskImage: mask,
            }}
          />
        );
      })}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(to bottom, ${from} 0%, ${from.replace(/[\d.]+\)$/, "0.6)")} 45%, transparent 100%)`,
        }}
      />
    </div>
  );
}
