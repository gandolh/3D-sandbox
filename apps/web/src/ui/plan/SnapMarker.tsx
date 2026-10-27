import { SNAP_LABEL, type Snap } from "../../lib/drawing/snap.js";
import { toScreen, type ViewTransform } from "../../lib/plan-view.js";
import { SELECTED } from "./LevelDrawing.jsx";

/** The word by the cursor: what the point snapped to, and "Ortho" while Shift holds it. */
export function snapWord(snap: Snap): string {
  const base = snap.kind === "angle" ? `${snap.bearing ?? 0}°` : SNAP_LABEL[snap.kind];
  if (!snap.ortho) return base;
  return base === "" ? "Ortho" : `${base} · Ortho`;
}

/**
 * Where a click would land, and why: a marker and a word by the cursor.
 *
 * Each kind has its own shape, the convention CAD programs share: a square for
 * an end, a triangle for a middle, a cross for a point on a wall, a plus for a
 * grid intersection, a ring for a free point or a snapped angle. The word is
 * there too, because a shape alone is a code to learn.
 */
export function SnapMarker({ snap, view }: { snap: Snap; view: ViewTransform }) {
  const [x, y] = toScreen(view, snap.point);
  const s = 5;
  const word = snapWord(snap);
  const shape = (() => {
    switch (snap.kind) {
      case "end":
        return <rect x={x - s} y={y - s} width={s * 2} height={s * 2} fill="none" />;
      case "middle":
        return <path d={`M${x},${y - s - 1} L${x + s + 1},${y + s} L${x - s - 1},${y + s} Z`} fill="none" />;
      case "on-wall":
        return <path d={`M${x - s},${y - s} L${x + s},${y + s} M${x + s},${y - s} L${x - s},${y + s}`} />;
      case "grid":
        return <path d={`M${x - s - 1},${y} H${x + s + 1} M${x},${y - s - 1} V${y + s + 1}`} />;
      default:
        return <circle cx={x} cy={y} r={s - 1} fill="none" />;
    }
  })();
  return (
    <g pointerEvents="none" stroke={SELECTED} strokeWidth={1.6} data-snap={snap.kind}>
      {shape}
      {word !== "" && (
        <text
          x={x + 10}
          y={y - 9}
          fontSize={11}
          fill={SELECTED}
          stroke="#ffffff"
          strokeWidth={3}
          paintOrder="stroke"
          fontFamily="ui-monospace, monospace"
        >
          {word}
        </text>
      )}
    </g>
  );
}
