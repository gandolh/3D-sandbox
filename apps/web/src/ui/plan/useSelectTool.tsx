import type { Level } from "@solstice/schema";
import { useEffect, useRef, useState } from "react";
import { type Snap, snapPoint } from "../../lib/drawing/snap.js";
import { moveCorner, samePoint, wallsAt } from "../../lib/drawing/walls.js";
import { gridTier, toScreen } from "../../lib/plan-view.js";
import { editDocument, getState, select, useStore } from "../../state/store.js";
import { editsText } from "../useUndoKeys.js";
import { SELECTED } from "./LevelDrawing.jsx";
import { SnapMarker } from "./SnapMarker.jsx";
import type { Tool, ToolContext } from "./tool.js";

interface GripDrag {
  /** The corner as it is in the document, verbatim. */
  from: [number, number];
  /** Every wall with an end there: they move together. */
  ids: string[];
  snap: Snap | null;
}

const GRIP = 4.5;

/**
 * Select: click a part to select it; drag a selected wall's end to move it.
 *
 * A grip moves **every** wall end at that point, so a corner stays a corner —
 * two walls that share an end are one structure, and dragging one of them away
 * would quietly split the building in two. The grip snaps like the Wall tool,
 * ignoring the walls it is moving, which would otherwise catch on themselves.
 *
 * Delete removes the selected wall, and its openings with it.
 */
export function useSelectTool({ level, view, active }: ToolContext): Tool {
  const selection = useStore((s) => s.selection);
  const [drag, setDrag] = useState<GripDrag | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const wall = level.walls.find((w) => w.id === selection);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (editsText(event.target)) return;
      const id = getState().selection;
      if (id === null || !level.walls.some((w) => w.id === id)) return;
      event.preventDefault();
      editDocument(
        (draft) => {
          const target = draft.subject.levels.find((l) => l.id === level.id);
          if (target !== undefined) target.walls = target.walls.filter((w) => w.id !== id);
        },
        { label: `Delete ${id}` },
      );
      select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, level]);

  const preview: Level | undefined =
    drag?.snap == null || samePoint(drag.snap.point, drag.from)
      ? undefined
      : (() => {
          const walls = structuredClone(level.walls);
          moveCorner(walls, drag.from, drag.snap.point);
          return { ...level, walls };
        })();

  const overlay =
    !active || wall === undefined ? null : (
      <g>
        {drag === null &&
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
        {drag?.snap != null && <SnapMarker snap={drag.snap} view={view} />}
      </g>
    );

  return {
    cursor: "default",
    preview,
    overlay,
    down(p) {
      const which = p.target?.getAttribute?.("data-grip");
      if (wall === undefined || (which !== "start" && which !== "end")) return false;
      const from: [number, number] = [wall[which][0], wall[which][1]];
      setDrag({ from, ids: wallsAt(level.walls, from).map((w) => w.id), snap: null });
      return true;
    },
    move(p) {
      const d = dragRef.current;
      if (d === null) return;
      const snap = snapPoint(p.world, level.walls, view.scale, {
        gridStep: gridTier(view.scale).minor,
        ignore: new Set(d.ids),
        shift: p.shift,
        from: p.shift ? d.from : null,
      });
      setDrag({ ...d, snap });
    },
    up() {
      const d = dragRef.current;
      setDrag(null);
      if (d?.snap == null || samePoint(d.snap.point, d.from)) return;
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
