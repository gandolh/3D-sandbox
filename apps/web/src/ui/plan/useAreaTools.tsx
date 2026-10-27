import { area, type Level, type Room, type SceneDocument } from "@solstice/schema";
import { useEffect, useRef, useState } from "react";
import { floorOutline, roomOutline } from "../../lib/drawing/faces.js";
import { defaultWallMaterial, nextId } from "../../lib/drawing/walls.js";
import { toScreen, type ViewTransform } from "../../lib/plan-view.js";
import { editDocument, getState, setPlanTool, setStatus, useStore } from "../../state/store.js";
import { editsText } from "../useUndoKeys.js";
import { SELECTED } from "./LevelDrawing.jsx";
import type { Tool, ToolContext } from "./tool.js";

export const NOT_ENCLOSED = "Not inside a closed set of walls";

const n = (v: number): string => v.toFixed(2);

/** The room uses the schema allows, as a person would name them. */
export const ROOM_USES: { use: Room["use"]; label: string }[] = [
  { use: "living", label: "Living" },
  { use: "bed", label: "Bedroom" },
  { use: "kitchen", label: "Kitchen" },
  { use: "bath", label: "Bathroom" },
  { use: "hall", label: "Hall" },
  { use: "store", label: "Store" },
  { use: "utility", label: "Utility" },
];

/** A polygon traced over the plan, for showing what a click would make. */
function Outline({
  polygon,
  view,
  dashed,
}: {
  polygon: [number, number][];
  view: ViewTransform;
  dashed?: boolean;
}) {
  const d = `${polygon.map((p, i) => `${i === 0 ? "M" : "L"}${toScreen(view, p).map(n).join(",")}`).join(" ")} Z`;
  return (
    <path
      d={d}
      pointerEvents="none"
      fill={SELECTED}
      fillOpacity={0.14}
      stroke={SELECTED}
      strokeWidth={1.4}
      strokeDasharray={dashed === true ? "6 4" : undefined}
      data-preview=""
    />
  );
}

/** Esc leaves the tool, as every tool's does. */
function useEscapeToSelect(active: boolean, busy: () => boolean): void {
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Escape" || editsText(event.target) || busy()) return;
      event.preventDefault();
      setPlanTool("select");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, busy]);
}

/**
 * The Room tool: click inside walls and name what they enclose.
 *
 * The polygon is the **clear internal outline** the schema asks for — the
 * closed area around the click found from the walls' centrelines, each edge
 * moved in by its own wall's half thickness — so the area on the plan's label
 * is floor a person stands on. A small popover asks for the name and the use.
 */
export function useRoomTool({ doc, level, view, active }: ToolContext): Tool {
  const [hover, setHover] = useState<[number, number][] | null>(null);
  const [asking, setAsking] = useState<{ polygon: [number, number][]; at: [number, number] } | null>(null);
  const askingRef = useRef(asking);
  askingRef.current = asking;
  const busy = useRef(() => askingRef.current !== null).current;
  useEscapeToSelect(active, busy);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on identity change only
  useEffect(() => {
    setHover(null);
    setAsking(null);
  }, [doc.id, level.id, active]);

  const add = (name: string, use: Room["use"], polygon: [number, number][]): void => {
    const current = getState().document;
    if (current === null) return;
    const id = nextId(current, "r-", 1);
    editDocument(
      (draft) => {
        draft.subject.levels.find((l) => l.id === level.id)?.rooms.push({ id, name, use, polygon });
      },
      { label: `Add room ${name}` },
    );
    setAsking(null);
  };

  return {
    cursor: "crosshair",
    move(p) {
      if (askingRef.current === null) setHover(roomOutline(level.walls, p.world));
    },
    leave() {
      setHover(null);
    },
    click(p) {
      if (askingRef.current !== null) {
        setAsking(null);
        return;
      }
      const polygon = roomOutline(level.walls, p.world);
      if (polygon === null) {
        setStatus(NOT_ENCLOSED);
        return;
      }
      setAsking({ polygon, at: p.screen });
    },
    overlay: !active ? null : asking !== null ? (
      <Outline polygon={asking.polygon} view={view} />
    ) : hover !== null ? (
      <Outline polygon={hover} view={view} dashed />
    ) : null,
    html:
      !active || asking === null ? null : (
        <RoomPopover
          at={asking.at}
          area={area(asking.polygon)}
          onAdd={(name, use) => add(name, use, asking.polygon)}
          onCancel={() => setAsking(null)}
        />
      ),
  };
}

function RoomPopover({
  at,
  area: floor,
  onAdd,
  onCancel,
}: {
  at: [number, number];
  area: number;
  onAdd: (name: string, use: Room["use"]) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("Room");
  const [use, setUse] = useState<Room["use"]>("living");
  const submit = (): void => {
    if (name.trim() !== "") onAdd(name.trim(), use);
  };
  return (
    <form
      data-testid="room-popover"
      aria-label="New room"
      style={{ left: at[0] + 12, top: at[1] + 12 }}
      className="absolute z-10 flex w-[220px] flex-col gap-2 rounded-sm border border-line bg-chrome p-2.5 shadow-lg"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <span className="font-mono text-[9.5px] tracking-[0.12em] text-subtle uppercase">
        New room · {floor.toFixed(1)} m²
      </span>
      <label className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted">Name</span>
        <input
          // biome-ignore lint/a11y/noAutofocus: the popover exists to ask for this
          autoFocus
          type="text"
          aria-label="Room name"
          value={name}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setName(event.target.value)}
          className="w-[130px] rounded-sm border border-line bg-input px-1.5 py-[2px] text-[11.5px] text-ink"
        />
      </label>
      <label className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted">Use</span>
        <select
          aria-label="Room use"
          value={use}
          onChange={(event) => setUse(event.target.value as Room["use"])}
          className="w-[130px] rounded-sm border border-line bg-input px-1 py-[2px] text-[11.5px] text-ink"
        >
          {ROOM_USES.map((u) => (
            <option key={u.use} value={u.use}>
              {u.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-sm border border-line bg-panel px-2 py-[3px] text-[11px] text-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-sm border border-accent bg-accent px-2 py-[3px] text-[11px] font-medium text-accent-ink"
        >
          Add room
        </button>
      </div>
    </form>
  );
}

/**
 * The slab material a new floor gets: the one most used by the level's slabs,
 * then by the document's, and only then the walls' default. A floor is not
 * plaster, and the first slab on a new level is usually like the ones below.
 */
export function defaultSlabMaterial(doc: SceneDocument, level: Level): string | null {
  const mostUsed = (slabs: readonly { material: string }[]): string | undefined => {
    const counts = new Map<string, number>();
    for (const slab of slabs) {
      if (doc.materials[slab.material] !== undefined)
        counts.set(slab.material, (counts.get(slab.material) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  return (
    mostUsed(level.slabs) ??
    mostUsed(doc.subject.levels.flatMap((l) => l.slabs)) ??
    defaultWallMaterial(doc, level)
  );
}

/**
 * The Floor tool: click inside a building and lay a slab under it.
 *
 * Under its **outer** outline: the outside of the walls that close around the
 * click, out to their outer faces, so the slab carries the walls standing on
 * it. Thickness and material come from the options bar.
 */
export function useFloorTool({ doc, level, view, active }: ToolContext): Tool {
  const options = useStore((s) => s.slabOptions);
  const [hover, setHover] = useState<[number, number][] | null>(null);
  const busy = useRef(() => false).current;
  useEscapeToSelect(active, busy);
  const material = options.material ?? defaultSlabMaterial(doc, level);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on identity change only
  useEffect(() => setHover(null), [doc.id, level.id, active]);

  return {
    cursor: material === null ? "not-allowed" : "crosshair",
    move(p) {
      setHover(floorOutline(level.walls, p.world));
    },
    leave() {
      setHover(null);
    },
    click(p) {
      const polygon = floorOutline(level.walls, p.world);
      if (polygon === null) {
        setStatus(NOT_ENCLOSED);
        return;
      }
      const current = getState().document;
      if (current === null || material === null) return;
      const id = nextId(current, "slab-", 1);
      editDocument(
        (draft) => {
          draft.subject.levels
            .find((l) => l.id === level.id)
            ?.slabs.push({ id, polygon, thickness: options.thickness, material });
        },
        { label: `Add floor ${id}` },
      );
    },
    overlay: !active || hover === null ? null : <Outline polygon={hover} view={view} dashed />,
  };
}
