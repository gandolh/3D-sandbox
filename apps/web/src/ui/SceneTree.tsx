import { Fragment, useRef } from "react";
import type { Run } from "@solstice/schema";
import { runLength } from "@solstice/geometry";
import { select, useStore } from "../state/store.js";
import { PanelTitle } from "./primitives.jsx";
import { Scroll } from "./Scroll.jsx";

const RUN_GLYPH: Record<Run["kind"], string> = {
  hedge: "❖",
  fence: "⫿",
  colonnade: "⊓",
  pergola: "⌸",
};

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
  const shared = `flex w-full items-center gap-1.5 rounded-sm py-[3.5px] pr-2 text-left text-[12px] whitespace-nowrap`;
  const inner = (
    <>
      <span className="w-3 shrink-0 text-[10px] opacity-70">{glyph}</span>
      <span className="truncate">{label}</span>
      {badge !== undefined && (
        <span className="ml-auto font-mono text-[9.5px] text-subtle">{badge}</span>
      )}
    </>
  );

  /**
   * A heading is structure, not a broken control.
   *
   * "Site", "Terrain", "Ground floor" and the tier headers used to be
   * `<button disabled>`, which tells a screen reader there is a thing you could
   * press if only it worked. They select nothing and never did. Rendered as
   * presentational rows they simply drop out of the control count, and the
   * tree's item count becomes the number of things you can actually reach.
   */
  if (id === undefined) {
    return (
      <div
        role="presentation"
        style={{ paddingLeft: 7 + depth * 12 }}
        className={`${shared} cursor-default text-ink`}
      >
        {inner}
      </div>
    );
  }

  return (
    <div
      role="treeitem"
      // Flat tree: depth is carried by `aria-level` rather than by nesting, so
      // the outline a sighted reader gets from the indent is the one a screen
      // reader announces.
      aria-level={depth + 1}
      aria-selected={selected}
      // Roving tab stop. The whole tree is one stop in the tab order — tabbing
      // through sixty walls to reach the viewport is not navigation, it is a
      // punishment — and the arrow keys move within it.
      tabIndex={selected ? 0 : -1}
      data-node="1"
      onClick={() => select(id)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        select(id);
      }}
      style={{ paddingLeft: 7 + depth * 12 }}
      className={`${shared} cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
        selected ? "bg-accent-soft font-semibold text-accent" : "text-ink hover:bg-line/50"
      }`}
    >
      {inner}
    </div>
  );
}

export function SceneTree() {
  const doc = useStore((s) => s.document);
  const tree = useRef<HTMLDivElement | null>(null);
  const selection = useStore((s) => s.selection);
  if (doc === null) return null;

  /**
   * Arrow keys walk the tree; Home and End jump to its ends.
   *
   * Driven off the DOM rather than off a flattened copy of the document,
   * because the tree is built from six different collections in render order
   * and rebuilding that order here would be a second source of truth that
   * drifts the first time a section is added.
   */
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const items = [...(tree.current?.querySelectorAll<HTMLElement>("[data-node]") ?? [])];
    if (items.length === 0) return;
    const here = items.findIndex((el) => el === document.activeElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : here === -1
            ? 0
            : Math.min(items.length - 1, Math.max(0, here + (event.key === "ArrowDown" ? 1 : -1)));
    event.preventDefault();
    items[next]?.focus();
  };

  return (
    <aside className="flex w-[196px] shrink-0 flex-col border-r border-line bg-panel">
      <PanelTitle>Scene</PanelTitle>
      <Scroll>
        <div
          ref={tree}
          role="tree"
          aria-label="Scene tree"
          onKeyDown={onKeyDown}
          // With nothing selected there is no roving stop, so the tree would be
          // unreachable by keyboard entirely. This makes the container itself
          // the stop until the first selection exists.
          tabIndex={selection === null ? 0 : -1}
          className="px-1.5 pb-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
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

          {doc.subject.runs.length > 0 && (
            <Node label="Runs" depth={1} glyph="⌇" badge={`${doc.subject.runs.length}`} />
          )}
          {doc.subject.runs.map((run) => (
            <Node
              key={run.id}
              id={run.id}
              label={run.id}
              depth={2}
              glyph={RUN_GLYPH[run.kind]}
              badge={`${runLength(run).toFixed(0)} m`}
            />
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
            <Node
              key={field.id}
              label={field.id}
              depth={1}
              glyph="✦"
              // A row planting's count comes from its spacing, so quoting a
              // density here would be quoting a number nothing uses.
              badge={
                field.arrangement === "rows"
                  ? `${field.rowSpacing[0]} × ${field.rowSpacing[1]} m`
                  : `${field.density}/100m²`
              }
            />
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
