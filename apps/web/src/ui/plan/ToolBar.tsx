import type { Level, SceneDocument } from "@solstice/schema";
import { useState } from "react";
import { parseDecimal } from "../../lib/drawing/walls.js";
import {
  type PlanTool,
  setOpeningOptions,
  setPlanTool,
  setSlabOptions,
  setWallOptions,
  useStore,
} from "../../state/store.js";
import { defaultSlabMaterial } from "./useAreaTools.jsx";

const toolButton = (on: boolean): string =>
  `rounded-sm border px-2 py-[3px] font-mono text-[10px] tracking-wider uppercase disabled:cursor-default disabled:opacity-40 ${
    on ? "border-accent bg-accent text-accent-ink" : "border-line bg-panel text-muted hover:text-ink"
  }`;

/** Why a tool is off, or null when it is available. */
export function toolUnavailable(tool: PlanTool, doc: SceneDocument): string | null {
  if (Object.keys(doc.materials).length > 0) return null;
  if (tool === "wall") return "This scene has no materials, and every wall must name one";
  if (tool === "floor") return "This scene has no materials, and every floor slab must name one";
  return null;
}

/** Why a door swings the way it does, and why there is no flip. */
export const SWING_NOTE =
  "A door swings to its wall's left, walking from the wall's start to its end. There is no flip: " +
  "flipping would mean reversing the wall, which moves every other opening on it.";

/** Select and the drawing tools. The chosen one lives in the store; Esc returns to Select. */
export function ToolBar({ doc }: { doc: SceneDocument }) {
  const tool = useStore((s) => s.planTool);
  const tools: { id: PlanTool; label: string; title: string }[] = [
    { id: "select", label: "Select", title: "Select a part; drag a selected wall's end or an opening (Esc)" },
    { id: "wall", label: "Wall", title: "Click points to draw walls; type a length while drawing" },
    {
      id: "door",
      label: "Door",
      title: "Hover a wall and click to cut a door; type a distance from the nearer end",
    },
    {
      id: "window",
      label: "Window",
      title: "Hover a wall and click to cut a window; type a distance from the nearer end",
    },
    { id: "room", label: "Room", title: "Click inside a closed set of walls to name the room" },
    { id: "floor", label: "Floor", title: "Click inside a building to lay a floor slab under it" },
  ];
  return (
    <div role="toolbar" aria-label="Plan tools" className="flex">
      {tools.map((t, i) => {
        const why = toolUnavailable(t.id, doc);
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={tool === t.id}
            disabled={why !== null}
            title={why ?? t.title}
            onClick={() => setPlanTool(t.id)}
            className={`${toolButton(tool === t.id)} ${i > 0 ? "-ml-px" : ""}`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A metre value in an options bar: typed, committed on Enter or blur, with a
 * comma or a dot. An empty field means "none" where `optional` allows it.
 */
function MetreBox({
  label,
  value,
  placeholder,
  optional,
  allowZero,
  onCommit,
}: {
  label: string;
  value: number | null;
  placeholder?: string;
  optional?: boolean;
  /** A sill can be 0; a width or a thickness cannot. */
  allowZero?: boolean;
  onCommit: (next: number | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (text: string): void => {
    setDraft(null);
    if (text.trim() === "") {
      if (optional === true) onCommit(null);
      return;
    }
    const next = parseDecimal(text);
    if (next !== null && (next > 0 || (allowZero === true && next === 0))) onCommit(next);
  };
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[10.5px] text-muted">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        aria-label={label}
        value={draft ?? (value === null ? "" : String(value))}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit(event.currentTarget.value);
          if (event.key === "Escape") setDraft(null);
        }}
        className="w-[58px] rounded-sm border border-line bg-input px-1.5 py-[2px] text-right font-mono text-[11px] text-ink placeholder:text-subtle"
      />
      <span className="font-mono text-[10px] text-subtle">m</span>
    </label>
  );
}

/** What the Wall tool gives a new wall: thickness, height, material. */
export function WallOptionsBar({ doc, levelHeight }: { doc: SceneDocument; levelHeight: number }) {
  const options = useStore((s) => s.wallOptions);
  const materials = Object.entries(doc.materials);
  return (
    <fieldset
      aria-label="Wall options"
      className="flex h-[30px] min-w-0 shrink-0 items-center gap-4 border-0 border-b border-line bg-panel px-2.5"
    >
      <MetreBox
        label="Thickness"
        value={options.thickness}
        onCommit={(thickness) => thickness !== null && setWallOptions({ thickness })}
      />
      <MetreBox
        label="Height"
        value={options.height}
        optional
        placeholder={`${levelHeight}`}
        onCommit={(height) => setWallOptions({ height })}
      />
      <label className="flex items-center gap-1.5">
        <span className="text-[10.5px] text-muted">Material</span>
        <select
          aria-label="Material"
          value={options.material ?? ""}
          onChange={(event) =>
            setWallOptions({ material: event.target.value === "" ? null : event.target.value })
          }
          className="max-w-[180px] rounded-sm border border-line bg-input px-1.5 py-[2px] text-[11px] text-ink"
        >
          <option value="">Most used on this level</option>
          {materials.map(([id, material]) => (
            <option key={id} value={id}>
              {material.label}
            </option>
          ))}
        </select>
      </label>
      <span className="ml-auto text-[10.5px] text-subtle">
        Type a length while drawing · Tab for bearing · Shift for ortho · Enter ends
      </span>
    </fieldset>
  );
}

const barClass =
  "flex h-[30px] min-w-0 shrink-0 items-center gap-4 border-0 border-b border-line bg-panel px-2.5";

/** What the Door or Window tool cuts. The tooltip says why a door cannot be flipped. */
export function OpeningOptionsBar({ kind }: { kind: "door" | "window" }) {
  const size = useStore((s) => s.openingOptions[kind]);
  const set = (patch: Partial<typeof size>): void => setOpeningOptions(kind, patch);
  return (
    <fieldset aria-label={kind === "door" ? "Door options" : "Window options"} className={barClass}>
      <MetreBox label="Width" value={size.width} onCommit={(width) => width !== null && set({ width })} />
      <MetreBox
        label="Height"
        value={size.height}
        onCommit={(height) => height !== null && set({ height })}
      />
      <MetreBox
        label="Sill"
        value={size.sill}
        allowZero
        onCommit={(sill) => sill !== null && set({ sill })}
      />
      {kind === "door" && (
        <span
          title={SWING_NOTE}
          className="cursor-help text-[10.5px] text-subtle underline decoration-dotted"
        >
          Swings to the wall's left
        </span>
      )}
      <span className="ml-auto text-[10.5px] text-subtle">
        Snaps to the centre and 0.05 m steps · type a distance from the nearer end · red will not fit
      </span>
    </fieldset>
  );
}

/** What the Floor tool lays. */
export function FloorOptionsBar({ doc, level }: { doc: SceneDocument; level: Level }) {
  const options = useStore((s) => s.slabOptions);
  const fallback = defaultSlabMaterial(doc, level);
  return (
    <fieldset aria-label="Floor options" className={barClass}>
      <MetreBox
        label="Thickness"
        value={options.thickness}
        onCommit={(thickness) => thickness !== null && setSlabOptions({ thickness })}
      />
      <label className="flex items-center gap-1.5">
        <span className="text-[10.5px] text-muted">Material</span>
        <select
          aria-label="Material"
          value={options.material ?? ""}
          onChange={(event) =>
            setSlabOptions({ material: event.target.value === "" ? null : event.target.value })
          }
          className="max-w-[180px] rounded-sm border border-line bg-input px-1.5 py-[2px] text-[11px] text-ink"
        >
          <option value="">
            {fallback === null ? "None" : `Default: ${doc.materials[fallback]?.label ?? fallback}`}
          </option>
          {Object.entries(doc.materials).map(([id, material]) => (
            <option key={id} value={id}>
              {material.label}
            </option>
          ))}
        </select>
      </label>
      <span className="ml-auto text-[10.5px] text-subtle">
        Click inside a building: the slab runs to the walls' outer faces
      </span>
    </fieldset>
  );
}

/** The Room tool has nothing to set before the click; the popover asks after it. */
export function RoomOptionsBar() {
  return (
    <fieldset aria-label="Room options" className={barClass}>
      <span className="text-[10.5px] text-subtle">
        Click inside a closed set of walls, then name the room. Its outline is the walls' inner faces.
      </span>
    </fieldset>
  );
}
