import { openingPlan } from "@solstice/drawing";
import type { Opening } from "@solstice/schema";
import { useEffect, useRef, useState } from "react";
import {
  nextOpeningId,
  offsetAt,
  offsetFromTyped,
  openingProblems,
  type WallHit,
  wallUnder,
} from "../../lib/drawing/openings.js";
import { parseDecimal } from "../../lib/drawing/walls.js";
import { toScreen, type ViewTransform } from "../../lib/plan-view.js";
import { editDocument, getState, setPlanTool, setStatus, useStore } from "../../state/store.js";
import { editsText } from "../useUndoKeys.js";
import { SELECTED } from "./LevelDrawing.jsx";
import type { Tool, ToolContext, ToolPointer } from "./tool.js";

/** The red a part turns when the linter would refuse it. */
export const REFUSED = "#c8381c";

const n = (v: number): string => v.toFixed(2);

/** An opening's ghost: its stretch of wall, slightly wider than the wall, and a word. */
export function OpeningGhost({
  wall,
  opening,
  view,
  ok,
  word,
}: {
  wall: WallHit["wall"];
  opening: Pick<Opening, "offset" | "width">;
  view: ViewTransform;
  ok: boolean;
  word: string;
}) {
  const plan = openingPlan(wall, opening as Opening);
  const h = plan.halfThickness + 3 / view.scale;
  const [nx, nz] = plan.normal;
  const corners: [number, number][] = [
    [plan.near[0] + nx * h, plan.near[1] + nz * h],
    [plan.far[0] + nx * h, plan.far[1] + nz * h],
    [plan.far[0] - nx * h, plan.far[1] - nz * h],
    [plan.near[0] - nx * h, plan.near[1] - nz * h],
  ];
  const d = `${corners.map((c, i) => `${i === 0 ? "M" : "L"}${toScreen(view, c).map(n).join(",")}`).join(" ")} Z`;
  const ink = ok ? SELECTED : REFUSED;
  const [lx, ly] = toScreen(view, plan.far);
  return (
    <g pointerEvents="none" data-ghost={ok ? "ok" : "refused"}>
      <path d={d} fill={ink} fillOpacity={0.3} stroke={ink} strokeWidth={1.4} />
      <text
        x={n(lx + 10)}
        y={n(ly - 8)}
        fontSize={11}
        fill={ink}
        stroke="#ffffff"
        strokeWidth={3}
        paintOrder="stroke"
        fontFamily="ui-monospace, monospace"
      >
        {word}
      </text>
    </g>
  );
}

/**
 * The Door and Window tools: hover a wall and the opening follows the pointer
 * along it; click to cut it.
 *
 * The offset snaps to the wall's centre and otherwise to 0.05 m steps. Typing
 * a number sets the distance from the nearer end instead. The ghost turns red
 * when the linter's own opening rules would refuse it, and a click on a red
 * ghost places nothing. One `editDocument` per opening, "Add door d-2".
 */
export function useOpeningTool(kind: Opening["kind"], { doc, level, view, active }: ToolContext): Tool {
  const size = useStore((s) => s.openingOptions[kind]);
  const [hover, setHover] = useState<{ hit: WallHit; pointer: ToolPointer } | null>(null);
  const [typing, setTyping] = useState<string | null>(null);
  const hoverRef = useRef(hover);
  hoverRef.current = hover;
  const typingRef = useRef(typing);
  typingRef.current = typing;

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on identity change only
  useEffect(() => {
    setHover(null);
    setTyping(null);
  }, [doc.id, level.id, active]);

  /** The opening this tool would cut now, and what the linter says about it. */
  const candidate = (h: typeof hover, t: string | null) => {
    if (h === null) return null;
    const typed = t === null ? null : parseDecimal(t);
    const snapped = offsetAt(h.hit, size.width, view.scale);
    const offset = typed === null ? snapped.offset : offsetFromTyped(h.hit, size.width, typed);
    const opening: Opening = { id: nextOpeningId(doc, kind), kind, offset, ...size };
    const problems = openingProblems(doc, level.id, h.hit.wall.id, opening);
    const fromStart = h.hit.along <= h.hit.length / 2;
    const gap = fromStart ? offset : h.hit.length - offset - size.width;
    const word =
      problems.length > 0
        ? "Does not fit"
        : typed === null && snapped.centred
          ? "Centre"
          : `${gap.toFixed(2)} m from the ${fromStart ? "start" : "end"}`;
    return { opening, problems, word, wall: h.hit.wall };
  };

  const place = (c: ReturnType<typeof candidate>): void => {
    if (c === null) return;
    if (c.problems.length > 0) {
      setStatus(`Not placed: ${c.problems[0]}`);
      return;
    }
    const current = getState().document;
    if (current === null) return;
    const opening = { ...c.opening, id: nextOpeningId(current, kind) };
    editDocument(
      (draft) => {
        const wall = draft.subject.levels
          .find((l) => l.id === level.id)
          ?.walls.find((w) => w.id === c.wall.id);
        wall?.openings.push(opening);
      },
      { label: `Add ${kind} ${opening.id}` },
    );
  };
  const placeRef = useRef(place);
  placeRef.current = place;
  const candidateRef = useRef(candidate);
  candidateRef.current = candidate;

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.ctrlKey || event.metaKey || event.altKey || editsText(event.target)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setPlanTool("select");
        return;
      }
      if (hoverRef.current !== null && typingRef.current === null && /^[0-9.,]$/.test(event.key)) {
        event.preventDefault();
        setTyping(event.key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  const current = active ? candidate(hover, typing) : null;
  const label = kind === "door" ? "Door" : "Window";

  return {
    cursor: "crosshair",
    move(p) {
      const hit = wallUnder(level.walls, p.world, view.scale);
      // While a distance is being typed the wall stays put, so the pointer can
      // wander off it without losing the opening.
      if (hit === null) {
        if (typingRef.current === null) setHover(null);
        return;
      }
      setHover({ hit, pointer: p });
    },
    leave() {
      if (typingRef.current === null) setHover(null);
    },
    click(p) {
      const hit = wallUnder(level.walls, p.world, view.scale);
      setTyping(null);
      if (hit === null) return;
      place(candidate({ hit, pointer: p }, null));
    },
    overlay:
      current === null ? null : (
        <OpeningGhost
          wall={current.wall}
          opening={current.opening}
          view={view}
          ok={current.problems.length === 0}
          word={current.word}
        />
      ),
    html:
      !active || typing === null || hover === null ? null : (
        <div
          data-testid="typed-field"
          style={{ left: hover.pointer.screen[0] + 16, top: hover.pointer.screen[1] + 16 }}
          className="absolute z-10 flex items-center gap-1.5 rounded-sm border border-line bg-chrome px-2 py-1 shadow-lg"
        >
          <span className="text-[10px] tracking-wider text-muted uppercase">{label} from the nearer end</span>
          <input
            // biome-ignore lint/a11y/noAutofocus: opened by typing, so the typing has to land here
            autoFocus
            type="text"
            inputMode="decimal"
            aria-label="Distance from the nearer end"
            value={typing}
            onFocus={(event) => {
              const end = event.currentTarget.value.length;
              event.currentTarget.setSelectionRange(end, end);
            }}
            onChange={(event) => setTyping(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                const c = candidateRef.current(hoverRef.current, typingRef.current);
                setTyping(null);
                placeRef.current(c);
              } else if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setTyping(null);
              }
            }}
            className="w-[64px] rounded-sm border border-line bg-input px-1.5 py-[2px] text-right font-mono text-[11.5px] text-ink"
          />
          <span className="font-mono text-[10px] text-subtle">m</span>
        </div>
      ),
  };
}
