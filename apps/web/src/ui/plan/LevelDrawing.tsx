import { INK, openingMark, sweepFlag, WEIGHT, wallSolids } from "@solstice/drawing";
import { area, bounds, type Level } from "@solstice/schema";
import { memo } from "react";
import { toScreen, type ViewTransform } from "../../lib/plan-view.js";

/**
 * Sheet millimetres to screen pixels, for line weights only.
 *
 * The sheet's weights are ISO pen widths on paper. On screen the same
 * hierarchy holds — what is cut is heaviest — but a 0.18 mm pen at one CSS
 * pixel per sheet millimetre would vanish, so every weight is doubled and none
 * goes below 0.6 px. The ratios, which are what make a plan read as a plan, are
 * kept.
 */
const px = (mm: number): number => Math.max(0.6, mm * 2);

/** The selection, in the plan's own black-on-white: the sun-amber accent, darkened to hold on white. */
export const SELECTED = "#c97a10";
const SELECTED_FILL = "#f3c983";

const n = (v: number): string => v.toFixed(2);
type Pt = readonly [number, number];

/**
 * One level, cut at `cut` metres, as the plan view draws it.
 *
 * The marks come from `@solstice/drawing` — `wallSolids` and `openingMark` are
 * the functions the 1:100 sheet draws with — so the two surfaces cannot
 * disagree about where a jamb or a swing is. Only the projection differs: the
 * sheet projects to paper millimetres, this projects to screen pixels through
 * the view transform, every frame of a pan.
 *
 * Every wall on the level is drawn, not just the house's. The sheet leaves out
 * a plot's boundary wall because it is about one building; this is where walls
 * are edited, and a wall you cannot see is a wall you cannot select.
 *
 * Each part carries `data-entity`, which is what a click resolves to.
 */
export const LevelDrawing = memo(function LevelDrawing({
  level,
  view,
  selection,
  cut,
}: {
  level: Level;
  view: ViewTransform;
  selection: string | null;
  cut: number;
}) {
  const p = (pt: Pt): string => {
    const [x, y] = toScreen(view, pt);
    return `${n(x)},${n(y)}`;
  };
  const poly = (points: readonly Pt[]): string =>
    `${points.map((pt, i) => `${i === 0 ? "M" : "L"}${p(pt)}`).join(" ")} Z`;
  const seg = ([a, b]: readonly [Pt, Pt]): string => `M${p(a)} L${p(b)}`;

  return (
    <g>
      {/* Rooms under everything, as on the sheet, so poché and symbols sit on top. */}
      {level.rooms.map((room) => (
        <path
          key={room.id}
          data-entity={room.id}
          data-selected={selection === room.id ? "true" : undefined}
          d={poly(room.polygon)}
          fill={selection === room.id ? SELECTED_FILL : "#f4f2ee"}
          stroke="none"
        />
      ))}

      {level.walls.map((wall) => {
        const selected = selection === wall.id;
        // The sheet's rule: the cut weight, but never more than a third of the
        // wall's drawn width, or a thin partition renders as a solid bar.
        const stroke = Math.min(px(WEIGHT.cut), (wall.thickness * view.scale) / 3);
        return (
          <g key={wall.id} data-entity={wall.id} data-selected={selected ? "true" : undefined}>
            {wallSolids(wall, cut).map((piece, i) => (
              <path
                // biome-ignore lint/suspicious/noArrayIndexKey: a wall's solid pieces have no identity beyond their order
                key={i}
                d={poly(piece)}
                fill={selected ? SELECTED_FILL : INK.poche}
                stroke={selected ? SELECTED : INK.line}
                strokeWidth={selected ? Math.max(stroke, 1.5) : stroke}
                strokeLinejoin="miter"
              />
            ))}
            {/*
              A hit line down the centreline, at least 10 px wide. A 100 mm
              partition zoomed out to a whole site is a pixel across, and a part
              you have to hunt for with the pointer is a part nobody selects.
            */}
            <path
              d={seg([wall.start, wall.end])}
              stroke="transparent"
              strokeWidth={Math.max(10, wall.thickness * view.scale)}
              pointerEvents="stroke"
              fill="none"
            />
          </g>
        );
      })}

      {level.walls.flatMap((wall) =>
        wall.openings.map((opening) => {
          const mark = openingMark(wall, opening, cut);
          const selected = selection === opening.id;
          const ink = selected ? SELECTED : INK.line;
          const bump = (w: number): number => (selected ? Math.max(w, 1.6) : w);
          return (
            <g key={opening.id} data-entity={opening.id} data-selected={selected ? "true" : undefined}>
              {mark.kind === "hidden" && (
                <path
                  d={seg([mark.from, mark.to])}
                  fill="none"
                  stroke={ink}
                  strokeWidth={bump(px(WEIGHT.seen))}
                  strokeDasharray="4 3"
                />
              )}
              {mark.kind === "window" && (
                <>
                  <path
                    d={`${seg(mark.reveals[0])} ${seg(mark.reveals[1])}`}
                    fill="none"
                    stroke={ink}
                    strokeWidth={bump(px(WEIGHT.seen))}
                  />
                  <path
                    d={seg(mark.glazing)}
                    fill="none"
                    stroke={selected ? SELECTED : INK.glass}
                    strokeWidth={bump(px(WEIGHT.symbol))}
                  />
                </>
              )}
              {mark.kind === "door" && <Door mark={mark} view={view} ink={ink} bump={bump} />}
              {/* Above the wall's own hit line, so a click on an opening selects the opening. */}
              <path
                d={seg(
                  mark.kind === "hidden"
                    ? [mark.from, mark.to]
                    : mark.kind === "window"
                      ? mark.glazing
                      : [mark.hinge, mark.shut],
                )}
                stroke="transparent"
                strokeWidth={Math.max(12, wall.thickness * view.scale + 4)}
                pointerEvents="stroke"
                fill="none"
              />
            </g>
          );
        }),
      )}

      {/*
        Labels in screen pixels, so they stay legible at every zoom and never
        catch a click. A room narrower on screen than its own name drops its
        label: zoomed out to the whole site, eight labels piled on one another
        say less than none.
      */}
      {level.rooms.map((room) => {
        const b = bounds(room.polygon);
        const [sx, sy] = toScreen(view, [(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2]);
        if ((b.maxX - b.minX) * view.scale < room.name.length * 7.5 + 8) return null;
        return (
          <g key={`label-${room.id}`} pointerEvents="none" textAnchor="middle">
            <text x={n(sx)} y={n(sy - 2)} fontSize={11} fill={INK.label} letterSpacing="0.04em">
              {room.name.toUpperCase()}
            </text>
            <text x={n(sx)} y={n(sy + 11)} fontSize={10} fill={INK.faint}>
              {area(room.polygon).toFixed(1)} m²
            </text>
          </g>
        );
      })}
    </g>
  );
});

function Door({
  mark,
  view,
  ink,
  bump,
}: {
  mark: Extract<ReturnType<typeof openingMark>, { kind: "door" }>;
  view: ViewTransform;
  ink: string;
  bump: (w: number) => number;
}) {
  const s = (pt: Pt): string => {
    const [x, y] = toScreen(view, pt);
    return `${n(x)},${n(y)}`;
  };
  const hinge = toScreen(view, mark.hinge);
  const leaf = toScreen(view, mark.leaf);
  const shut = toScreen(view, mark.shut);
  const r = Math.hypot(leaf[0] - hinge[0], leaf[1] - hinge[1]);
  return (
    <>
      <path
        d={`M${s(mark.jambs[0][0])} L${s(mark.jambs[0][1])} M${s(mark.jambs[1][0])} L${s(mark.jambs[1][1])}`}
        fill="none"
        stroke={ink}
        strokeWidth={bump(px(WEIGHT.seen))}
      />
      <path
        d={`M${s(mark.hinge)} L${s(mark.leaf)}`}
        fill="none"
        stroke={ink}
        strokeWidth={bump(px(WEIGHT.symbol))}
      />
      <path
        d={`M${s(mark.leaf)} A${n(r)} ${n(r)} 0 0 ${sweepFlag(hinge, leaf, shut)} ${s(mark.shut)}`}
        fill="none"
        stroke={ink}
        strokeWidth={bump(px(WEIGHT.fine))}
      />
    </>
  );
}
