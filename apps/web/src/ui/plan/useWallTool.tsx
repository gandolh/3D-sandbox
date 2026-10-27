import { wallCorners } from "@solstice/drawing";
import { useCallback, useEffect, useRef, useState } from "react";
import { directionOf, type Snap, snapPoint, toCentimetre } from "../../lib/drawing/snap.js";
import {
  type Chain,
  defaultWallMaterial,
  makeWall,
  nextWallId,
  parseDecimal,
  placePoint,
  pointAlong,
  recordWall,
  trimChain,
} from "../../lib/drawing/walls.js";
import { gridTier, toScreen } from "../../lib/plan-view.js";
import { editDocument, getState, setPlanTool, setStatus, useStore } from "../../state/store.js";
import { editsText } from "../useUndoKeys.js";
import { SELECTED } from "./LevelDrawing.jsx";
import { SnapMarker } from "./SnapMarker.jsx";
import type { Tool, ToolContext, ToolPointer } from "./tool.js";

/** What has been typed while a wall is in progress. */
interface Typing {
  length: string;
  bearing: string;
  field: "length" | "bearing";
}

const n = (v: number): string => v.toFixed(2);

/**
 * The Wall tool: click points, and each pair becomes a wall.
 *
 * The habits are Revit's and ArchiCAD's (brief 74): pick the tool, click a
 * start, click or type each next point, and the chain carries on from where the
 * last wall ended. Enter, a double-click or a right-click ends it; a click on
 * the chain's first point closes the loop; Esc drops the wall in progress, and
 * a second Esc returns to Select.
 *
 * Each wall is one `editDocument` call, labelled "Add wall W-07", so the 3D
 * view updates as you draw and one Ctrl+Z takes back one wall.
 */
export function useWallTool({ doc, level, view, active }: ToolContext): Tool {
  const [chain, setChain] = useState<Chain | null>(null);
  const [hover, setHover] = useState<{ snap: Snap; pointer: ToolPointer } | null>(null);
  const [typing, setTyping] = useState<Typing | null>(null);
  const options = useStore((s) => s.wallOptions);
  const material = options.material ?? defaultWallMaterial(doc, level);

  // Handlers read the latest state through refs: the window key listener is
  // bound once, and a stale chain there would start walls from the wrong point.
  const chainRef = useRef(chain);
  chainRef.current = chain;
  const hoverRef = useRef(hover);
  hoverRef.current = hover;
  const typingRef = useRef(typing);
  typingRef.current = typing;

  const last = chain?.points[chain.points.length - 1] ?? null;

  const snapAt = useCallback(
    (p: ToolPointer, from: readonly [number, number] | null): Snap =>
      snapPoint(p.world, level.walls, view.scale, {
        from,
        shift: p.shift,
        gridStep: gridTier(view.scale).minor,
      }),
    [level.walls, view.scale],
  );

  // A different level or scene, or another tool: the chain was about walls
  // that are not here any more.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on identity change only
  useEffect(() => {
    setChain(null);
    setTyping(null);
  }, [doc.id, level.id, active]);

  // A Ctrl+Z mid-chain removes the last wall; the chain steps back with it, so
  // the next wall starts where the last surviving one ends.
  useEffect(() => {
    const current = chainRef.current;
    if (current === null) return;
    const ids = new Set(level.walls.map((w) => w.id));
    const trimmed = trimChain(current, (id) => ids.has(id));
    if (trimmed?.points.length !== current.points.length) setChain(trimmed);
  }, [level.walls]);

  /** Where the wall in progress would end now: the typed numbers, or the snapped pointer. */
  const target = (from: readonly [number, number] | null, h: typeof hover, t: Typing | null) => {
    if (from === null) return h?.snap.point ?? null;
    const length = t === null ? null : parseDecimal(t.length);
    const bearing = t === null ? null : parseDecimal(t.bearing);
    if (bearing !== null) {
      const direction = directionOf(bearing);
      const along =
        length ??
        (h === null
          ? 1
          : Math.max(
              0.01,
              toCentimetre(
                (h.snap.point[0] - from[0]) * direction[0] + (h.snap.point[1] - from[1]) * direction[1],
              ),
            ));
      return length !== null && length <= 0 ? null : pointAlong(from, direction, along);
    }
    if (length !== null) {
      if (length <= 0) return null;
      const direction = h?.snap.direction ?? [1, 0];
      return pointAlong(from, direction, length);
    }
    return h?.snap.point ?? null;
  };

  const place = useCallback(
    (point: readonly [number, number]): void => {
      if (material === null) return;
      const result = placePoint(chainRef.current, point);
      if (result.kind === "started") {
        setChain(result.chain);
        return;
      }
      if (result.kind === "ignored") {
        if (result.reason !== "same point") setStatus(`Not placed: ${result.reason}`);
        return;
      }
      const current = getState().document;
      if (current === null) return;
      const id = nextWallId(current);
      const wall = makeWall(id, result.start, result.end, {
        thickness: options.thickness,
        height: options.height,
        material,
      });
      editDocument(
        (draft) => {
          draft.subject.levels.find((l) => l.id === level.id)?.walls.push(wall);
        },
        { label: `Add wall ${id}` },
      );
      // Only carry the chain on if the wall actually landed: a rejected edit
      // leaves the document as it was, and the chain must not run ahead of it.
      const landed = getState().document?.subject.levels.some((l) => l.walls.some((w) => w.id === id));
      if (!landed) return;
      setChain(result.chain === null ? null : recordWall(result.chain, id));
    },
    [material, options.thickness, options.height, level.id],
  );
  const placeRef = useRef(place);
  placeRef.current = place;

  const commitTyped = (): void => {
    const from = chainRef.current?.points.at(-1) ?? null;
    const point = target(from, hoverRef.current, typingRef.current);
    setTyping(null);
    if (point !== null) placeRef.current(point);
  };

  // Keys, on `window`: focus is rarely on the SVG. Text fields — the
  // Inspector's, and the typed-length field's own — keep theirs.
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.ctrlKey || event.metaKey || event.altKey || editsText(event.target)) return;
      if (event.key === "Shift") {
        const h = hoverRef.current;
        if (h !== null) {
          const pointer = { ...h.pointer, shift: event.type === "keydown" };
          setHover({ pointer, snap: snapAtRef.current(pointer, chainRef.current?.points.at(-1) ?? null) });
        }
        return;
      }
      if (event.type !== "keydown") return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (chainRef.current !== null) setChain(null);
        else setPlanTool("select");
        return;
      }
      if (event.key === "Enter") {
        if (chainRef.current === null) return;
        event.preventDefault();
        setChain(null);
        return;
      }
      // A number while a wall is in progress opens the length field with it.
      if (chainRef.current !== null && /^[0-9.,]$/.test(event.key)) {
        event.preventDefault();
        setTyping({ length: event.key, bearing: "", field: "length" });
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, [active]);
  const snapAtRef = useRef(snapAt);
  snapAtRef.current = snapAt;

  const end = (): void => {
    setChain(null);
    setTyping(null);
  };

  const ghostEnd = target(last, hover, typing);
  const overlay = !active ? null : (
    <g pointerEvents="none">
      {chain !== null && last !== null && ghostEnd !== null && (
        <Ghost from={last} to={ghostEnd} thickness={options.thickness} view={view} />
      )}
      {chain !== null && <ChainPoints points={chain.points} view={view} />}
      {hover !== null && typing === null && <SnapMarker snap={hover.snap} view={view} />}
    </g>
  );

  const html =
    !active || typing === null || last === null ? null : (
      <TypedField
        // By the cursor, or by the wall's start if the pointer has left the plan.
        at={hover?.pointer.screen ?? toScreen(view, last)}
        typing={typing}
        onChange={setTyping}
        onCommit={commitTyped}
        onCancel={() => setTyping(null)}
      />
    );

  return {
    cursor: material === null ? "not-allowed" : "crosshair",
    move(p) {
      setHover({ pointer: p, snap: snapAt(p, chainRef.current?.points.at(-1) ?? null) });
    },
    leave() {
      if (typingRef.current === null) setHover(null);
    },
    click(p) {
      if (typingRef.current !== null) setTyping(null);
      place(snapAt(p, chainRef.current?.points.at(-1) ?? null).point);
    },
    doubleClick: end,
    contextMenu: end,
    overlay,
    html,
  };
}

/** The points placed so far; the first is open, because a click on it closes the loop. */
function ChainPoints({ points, view }: { points: Chain["points"]; view: ToolContext["view"] }) {
  const [first, ...rest] = points.map((pt) => toScreen(view, pt));
  if (first === undefined) return null;
  const dots = rest
    .map(([x, y]) => `M${n(x - 2.5)},${n(y)} a2.5,2.5 0 1,0 5,0 a2.5,2.5 0 1,0 -5,0`)
    .join(" ");
  return (
    <g data-chain={points.length}>
      {dots !== "" && <path d={dots} fill={SELECTED} />}
      <circle cx={first[0]} cy={first[1]} r={4} fill="#ffffff" stroke={SELECTED} strokeWidth={1.5} />
    </g>
  );
}

/** The wall in progress: its outline, dashed, and its live length as a dimension line. */
function Ghost({
  from,
  to,
  thickness,
  view,
}: {
  from: readonly [number, number];
  to: readonly [number, number];
  thickness: number;
  view: ToolContext["view"];
}) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  if (length < 1e-6) return null;
  const corners = wallCorners({
    id: "ghost",
    start: [from[0], from[1]],
    end: [to[0], to[1]],
    thickness,
    material: "ghost",
    openings: [],
  });
  const d = `${corners.map((c, i) => `${i === 0 ? "M" : "L"}${toScreen(view, c).map(n).join(",")}`).join(" ")} Z`;
  const a = toScreen(view, from);
  const b = toScreen(view, to);
  const ux = (b[0] - a[0]) / Math.hypot(b[0] - a[0], b[1] - a[1]);
  const uy = (b[1] - a[1]) / Math.hypot(b[0] - a[0], b[1] - a[1]);
  // The dimension sits off the wall's left side, clear of the wall at any thickness.
  const off = Math.max(16, (thickness * view.scale) / 2 + 12);
  const nx = uy * off;
  const ny = -ux * off;
  const a2: [number, number] = [a[0] + nx, a[1] + ny];
  const b2: [number, number] = [b[0] + nx, b[1] + ny];
  const mid: [number, number] = [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2];
  return (
    <g data-ghost="">
      <path
        d={d}
        fill={SELECTED}
        fillOpacity={0.18}
        stroke={SELECTED}
        strokeWidth={1.2}
        strokeDasharray="5 3"
      />
      <path
        d={`M${n(a[0])},${n(a[1])} L${n(a2[0])},${n(a2[1])} M${n(b[0])},${n(b[1])} L${n(b2[0])},${n(b2[1])} M${n(a2[0])},${n(a2[1])} L${n(b2[0])},${n(b2[1])}`}
        stroke={SELECTED}
        strokeWidth={0.8}
        fill="none"
      />
      <text
        x={n(mid[0])}
        y={n(mid[1])}
        dy={4}
        textAnchor="middle"
        fontSize={11}
        fill={SELECTED}
        stroke="#ffffff"
        strokeWidth={3}
        paintOrder="stroke"
        fontFamily="ui-monospace, monospace"
        data-length=""
      >
        {length.toFixed(2)} m
      </text>
    </g>
  );
}

/**
 * The length and bearing field by the cursor, opened by typing a number.
 *
 * `type="text"` with a decimal keypad, not `type="number"`: Chrome's number
 * input refuses a comma, and "4,2" is how much of Europe writes 4.2. Tab moves
 * between the two; Enter places the point; Esc closes the field and keeps the
 * wall in progress.
 *
 * Bearing, not a CAD angle: degrees clockwise from north, the convention the
 * Inspector's Bearing field and the document already use, so a wall typed at
 * 90 reads 90 when you select it.
 */
function TypedField({
  at,
  typing,
  onChange,
  onCommit,
  onCancel,
}: {
  at: [number, number];
  typing: Typing;
  onChange: (next: Typing) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const length = useRef<HTMLInputElement | null>(null);
  const bearing = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const el = typing.field === "length" ? length.current : bearing.current;
    el?.focus();
    const end = el?.value.length ?? 0;
    el?.setSelectionRange(end, end);
  }, [typing.field]);

  const keys = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Tab") {
      event.preventDefault();
      onChange({ ...typing, field: typing.field === "length" ? "bearing" : "length" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      onCommit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
  };
  const invalid = (text: string): boolean => text.trim() !== "" && parseDecimal(text) === null;
  const box = (name: "length" | "bearing", label: string, unit: string) => (
    <label className="flex items-center gap-1">
      <span className="text-[10px] tracking-wider text-muted uppercase">{label}</span>
      <input
        ref={name === "length" ? length : bearing}
        type="text"
        inputMode="decimal"
        aria-label={label}
        aria-invalid={invalid(typing[name])}
        value={typing[name]}
        onChange={(event) => onChange({ ...typing, [name]: event.target.value })}
        onFocus={() => typing.field !== name && onChange({ ...typing, field: name })}
        onKeyDown={keys}
        className="w-[64px] rounded-sm border border-line bg-input px-1.5 py-[2px] text-right font-mono text-[11.5px] text-ink aria-invalid:border-danger"
      />
      <span className="w-3 font-mono text-[10px] text-subtle">{unit}</span>
    </label>
  );
  return (
    <div
      data-testid="typed-field"
      style={{ left: at[0] + 16, top: at[1] + 16 }}
      className="absolute z-10 flex items-center gap-2 rounded-sm border border-line bg-chrome px-2 py-1 shadow-lg"
    >
      {box("length", "Length", "m")}
      {box("bearing", "Bearing", "°")}
    </div>
  );
}
