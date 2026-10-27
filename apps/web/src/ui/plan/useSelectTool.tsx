import type { Level, Opening, Wall } from "@solstice/schema";
import { useEffect, useRef, useState } from "react";
import { offsetAt, openingProblems, wallUnder } from "../../lib/drawing/openings.js";
import { type Snap, snapPoint } from "../../lib/drawing/snap.js";
import { moveCorner, samePoint, wallsAt } from "../../lib/drawing/walls.js";
import { gridTier, toScreen } from "../../lib/plan-view.js";
import { editDocument, getState, select, setStatus, useStore } from "../../state/store.js";
import { editsText } from "../useUndoKeys.js";
import { SELECTED } from "./LevelDrawing.jsx";
import { SnapMarker } from "./SnapMarker.jsx";
import type { Tool, ToolContext } from "./tool.js";
import { OpeningGhost } from "./useOpeningTool.jsx";

/** A corner grip in flight. */
interface GripDrag {
  kind: "grip";
  /** The corner as it is in the document, verbatim. */
  from: [number, number];
  /** Every wall with an end there: they move together. */
  ids: string[];
  snap: Snap | null;
}

/** An opening being slid along its wall. */
interface OpeningDrag {
  kind: "opening";
  wall: Wall;
  opening: Opening;
  /** The new offset, once the pointer has moved. */
  offset: number | null;
  problems: string[];
}

const GRIP = 4.5;

/** What part of a level an id names, for Delete. */
function partOf(level: Level, id: string): "wall" | "opening" | "room" | "slab" | null {
  if (level.walls.some((w) => w.id === id)) return "wall";
  if (level.walls.some((w) => w.openings.some((o) => o.id === id))) return "opening";
  if (level.rooms.some((r) => r.id === id)) return "room";
  if (level.slabs.some((s) => s.id === id)) return "slab";
  return null;
}

/**
 * Select: click a part to select it; drag a selected wall's end, or an
 * opening along its wall.
 *
 * A grip moves **every** wall end at that point, so a corner stays a corner —
 * two walls that share an end are one structure, and dragging one of them away
 * would quietly split the building in two. The grip snaps like the Wall tool,
 * ignoring the walls it is moving, which would otherwise catch on themselves.
 *
 * An opening slides with the Door tool's snapping (the wall's centre, then
 * 0.05 m steps) and its red: a drag the linter would refuse is put back.
 *
 * Delete removes the selected wall (its openings with it), opening, room or
 * slab.
 */
export function useSelectTool({ doc, level, view, active }: ToolContext): Tool {
  const selection = useStore((s) => s.selection);
  const [drag, setDrag] = useState<GripDrag | OpeningDrag | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const wall = level.walls.find((w) => w.id === selection);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (editsText(event.target)) return;
      const id = getState().selection;
      const part = id === null ? null : partOf(level, id);
      if (id === null || part === null) return;
      event.preventDefault();
      editDocument(
        (draft) => {
          const target = draft.subject.levels.find((l) => l.id === level.id);
          if (target === undefined) return;
          if (part === "wall") target.walls = target.walls.filter((w) => w.id !== id);
          if (part === "opening") {
            for (const w of target.walls) w.openings = w.openings.filter((o) => o.id !== id);
          }
          if (part === "room") target.rooms = target.rooms.filter((r) => r.id !== id);
          if (part === "slab") target.slabs = target.slabs.filter((s) => s.id !== id);
        },
        { label: `Delete ${id}` },
      );
      select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, level]);

  const preview: Level | undefined = (() => {
    if (drag?.kind === "grip") {
      if (drag.snap === null || samePoint(drag.snap.point, drag.from)) return undefined;
      const walls = structuredClone(level.walls);
      moveCorner(walls, drag.from, drag.snap.point);
      return { ...level, walls };
    }
    if (drag?.kind === "opening" && drag.offset !== null && drag.problems.length === 0) {
      const { offset, opening } = drag;
      return {
        ...level,
        walls: level.walls.map((w) =>
          w.id !== drag.wall.id
            ? w
            : { ...w, openings: w.openings.map((o) => (o.id === opening.id ? { ...o, offset } : o)) },
        ),
      };
    }
    return undefined;
  })();

  const overlay = !active ? null : (
    <g>
      {wall !== undefined &&
        drag === null &&
        (["start", "end"] as const).map((which) => {
          const [x, y] = toScreen(view, wall[which]);
          return (
            <rect
              key={which}
              data-grip={which}
              aria-label={`${wall.id} ${which}`}
              x={x - GRIP}
              y={y - GRIP}
              width={GRIP * 2}
              height={GRIP * 2}
              fill="#ffffff"
              stroke={SELECTED}
              strokeWidth={1.6}
              className="cursor-move"
            />
          );
        })}
      {drag?.kind === "grip" && drag.snap !== null && <SnapMarker snap={drag.snap} view={view} />}
      {drag?.kind === "opening" && drag.offset !== null && drag.problems.length > 0 && (
        <OpeningGhost
          wall={drag.wall}
          opening={{ offset: drag.offset, width: drag.opening.width }}
          view={view}
          ok={false}
          word="Does not fit"
        />
      )}
    </g>
  );

  return {
    cursor: "default",
    preview,
    overlay,
    down(p) {
      const which = p.target?.getAttribute?.("data-grip");
      if (wall !== undefined && (which === "start" || which === "end")) {
        const from: [number, number] = [wall[which][0], wall[which][1]];
        setDrag({ kind: "grip", from, ids: wallsAt(level.walls, from).map((w) => w.id), snap: null });
        return true;
      }
      // An opening under the pointer: select it, and hold it in case this is a drag.
      const id = p.target?.closest?.("[data-entity]")?.getAttribute("data-entity");
      const host = level.walls.find((w) => w.openings.some((o) => o.id === id));
      const opening = host?.openings.find((o) => o.id === id);
      if (host === undefined || opening === undefined) return false;
      select(opening.id);
      setDrag({ kind: "opening", wall: host, opening, offset: null, problems: [] });
      return true;
    },
    move(p) {
      const d = dragRef.current;
      if (d === null) return;
      if (d.kind === "grip") {
        const snap = snapPoint(p.world, level.walls, view.scale, {
          gridStep: gridTier(view.scale).minor,
          ignore: new Set(d.ids),
          shift: p.shift,
          from: p.shift ? d.from : null,
        });
        setDrag({ ...d, snap });
        return;
      }
      // Along its own wall only: the pointer's foot on that wall, however far off it.
      const hit = wallUnder([d.wall], p.world, 1e-9);
      if (hit === null) return;
      const { offset } = offsetAt(hit, d.opening.width, view.scale);
      const problems = openingProblems(doc, level.id, d.wall.id, { ...d.opening, offset }, d.opening.id);
      setDrag({ ...d, offset, problems });
    },
    up() {
      const d = dragRef.current;
      setDrag(null);
      if (d === null) return;
      if (d.kind === "opening") {
        if (d.offset === null || Math.abs(d.offset - d.opening.offset) < 1e-9) return;
        if (d.problems.length > 0) {
          setStatus(`Not moved: ${d.problems[0]}`);
          return;
        }
        const { offset } = d;
        editDocument(
          (draft) => {
            const o = draft.subject.levels
              .find((l) => l.id === level.id)
              ?.walls.find((w) => w.id === d.wall.id)
              ?.openings.find((x) => x.id === d.opening.id);
            if (o !== undefined) o.offset = offset;
          },
          { label: `Move ${d.opening.id}` },
        );
        return;
      }
      if (d.snap === null || samePoint(d.snap.point, d.from)) return;
      const to = d.snap.point;
      editDocument(
        (draft) => {
          const target = draft.subject.levels.find((l) => l.id === level.id);
          if (target !== undefined) moveCorner(target.walls, d.from, to);
        },
        {
          label:
            d.ids.length > 1 ? `Move the corner of ${d.ids.join(" and ")}` : `Move the end of ${d.ids[0]}`,
        },
      );
    },
    click(p) {
      // The part under the pointer, by the `data-entity` its marks carry. The
      // drawing's own stacking decides ties, so an opening wins over its wall.
      const hit = p.target?.closest?.("[data-entity]");
      select(hit?.getAttribute("data-entity") ?? null);
    },
  };
}
