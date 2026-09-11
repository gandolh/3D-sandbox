import { Fragment } from "react";
import { select, useStore } from "../state/store.js";
import { PanelTitle } from "./primitives.jsx";
import { Scroll } from "./Scroll.jsx";

function Node({
  id,
  label,
  depth,
  glyph,
  badge,
}: {
  id?: string | undefined;
  label: string;
  depth: number;
  glyph: string;
  badge?: string | undefined;
}) {
  const selected = useStore((s) => s.selection === id && id !== undefined);
  return (
    <button
      type="button"
      onClick={() => id !== undefined && select(id)}
      disabled={id === undefined}
      style={{ paddingLeft: 7 + depth * 12 }}
      className={`flex w-full items-center gap-1.5 rounded-sm py-[3.5px] pr-2 text-left text-[12px] whitespace-nowrap ${
        selected ? "bg-accent-soft font-semibold text-accent" : "text-ink hover:bg-line/50"
      } ${id === undefined ? "cursor-default" : "cursor-pointer"}`}
    >
      <span className="w-3 shrink-0 text-[10px] opacity-70">{glyph}</span>
      <span className="truncate">{label}</span>
      {badge !== undefined && (
        <span className="ml-auto font-mono text-[9.5px] text-subtle">{badge}</span>
      )}
    </button>
  );
}

export function SceneTree() {
  const doc = useStore((s) => s.document);
  if (doc === null) return null;

  return (
    <aside className="flex w-[196px] shrink-0 flex-col border-r border-line bg-panel">
      <PanelTitle>Scene</PanelTitle>
      <Scroll>
        <div className="px-1.5 pb-3">
          <Node label="Site" depth={0} glyph="◈" />
          <Node label="Terrain" depth={1} glyph="▤" />

          {doc.subject.levels.map((level) => (
            <Fragment key={level.id}>
              <Node label={level.name} depth={1} glyph="▭" badge={`${level.walls.length}`} />
              {level.walls.map((wall) => (
                <Node
                  key={wall.id}
                  id={wall.id}
                  label={wall.id}
                  depth={2}
                  glyph="│"
                  badge={wall.openings.length > 0 ? String(wall.openings.length) : undefined}
                />
              ))}
              {level.slabs.map((slab) => (
                <Node key={slab.id} id={slab.id} label={slab.id} depth={2} glyph="▬" />
              ))}
            </Fragment>
          ))}

          {doc.subject.placements.length > 0 && (
            <Node label="Placements" depth={1} glyph="◇" badge={`${doc.subject.placements.length}`} />
          )}
          {doc.subject.placements.map((placement) => (
            <Node key={placement.id} id={placement.id} label={placement.id} depth={2} glyph="◦" />
          ))}

          {doc.subject.roofs.map((roof) => (
            <Node
              key={roof.id}
              id={roof.id}
              label={roof.id}
              depth={1}
              glyph="◹"
              badge={`${roof.pitch}°`}
            />
          ))}

          <div className="mt-2 border-t border-line px-2 pt-2 pb-1 font-mono text-[8.5px] tracking-[0.1em] text-subtle uppercase">
            Context · instanced
          </div>
          {doc.context.scatter.map((field) => (
            <Node key={field.id} label={field.id} depth={1} glyph="✦" badge={`${field.density}/100m²`} />
          ))}
          <Node label="Neighbours" depth={1} glyph="▦" badge={`${doc.context.masses.length}`} />
          {doc.context.roads.map((road) => (
            <Node key={road.id} label={road.id} depth={1} glyph="═" />
          ))}
        </div>
      </Scroll>
    </aside>
  );
}
