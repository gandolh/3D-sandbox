import { CUT_HEIGHT } from "@solstice/drawing";
import type { Level, SceneDocument } from "@solstice/schema";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  fitExtent,
  levelExtent,
  pan,
  toWorld,
  type ViewTransform,
  wheelFactor,
  zoomAt,
} from "../../lib/plan-view.js";
import { getState, setPlanPointer, setPlanView, useStore } from "../../state/store.js";
import { Grid } from "./Grid.jsx";
import { LevelDrawing } from "./LevelDrawing.jsx";
import type { Tool, ToolPointer } from "./tool.js";
import { useSelectTool } from "./useSelectTool.jsx";
import { useWallTool } from "./useWallTool.jsx";

/** Used until the surface has been measured, and forever in a DOM that does no layout. */
const FALLBACK_SIZE = { width: 800, height: 600 };

/** A press that travels further than this, in px, is a drag and not a click. */
const CLICK_SLOP = 4;

/** An empty level to hand the tools when the document has none, so hooks run unconditionally. */
const NO_LEVEL: Level = {
  id: "none",
  name: "No levels",
  elevation: 0,
  height: 2.7,
  walls: [],
  slabs: [],
  rooms: [],
};

/**
 * The world point under a pointer event, `[x, z]` metres.
 *
 * Measured against the SVG's own box and the view transform, both of which the
 * app controls, rather than through `getScreenCTM`: the answer is the same, and
 * this one is plain arithmetic a test can check without a layout engine. Every
 * drawing tool reads the pointer through this one function.
 */
export function pointerWorld(
  svg: SVGSVGElement,
  view: ViewTransform,
  event: { clientX: number; clientY: number },
): [number, number] {
  const box = svg.getBoundingClientRect();
  return toWorld(view, [event.clientX - box.left, event.clientY - box.top]);
}

/** Fit the view to a level at the surface's current size. */
export function fitTo(level: Level | undefined, width: number, height: number): ViewTransform {
  return fitExtent(levelExtent(level?.walls ?? []), width, height);
}

/**
 * The editable plan: an SVG in world metres, on white.
 *
 * The surface owns the view: wheel zooms about the pointer; middle-button
 * drag pans, and so does Space plus drag, for a trackpad with no middle
 * button. Every other gesture goes to the chosen tool — Select picks parts and
 * drags their grips, Wall draws.
 */
export function PlanSurface({ doc, level }: { doc: SceneDocument; level: Level | undefined }) {
  const box = useRef<HTMLDivElement | null>(null);
  const svg = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState(FALLBACK_SIZE);
  const [grabbing, setGrabbing] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const view = useStore((s) => s.planView);
  const selection = useStore((s) => s.selection);
  const planTool = useStore((s) => s.planTool);

  const hover = useRef(false);
  const space = useRef(false);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    travelled: number;
    panning: boolean;
    tool: boolean;
  } | null>(null);

  // Measure, and keep measuring: the pane changes size with the window and
  // when the side panels do.
  useLayoutEffect(() => {
    const el = box.current;
    if (el === null) return;
    const measure = (): void => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setSize({ width: rect.width, height: rect.height });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // First paint of a document, or after a scene switch: frame the level.
  useEffect(() => {
    if (view === null) setPlanView(fitTo(level, size.width, size.height));
  }, [view, level, size.width, size.height]);

  // Native, not React's `onWheel`: React attaches wheel listeners as passive,
  // so `preventDefault` is ignored and Ctrl+wheel or a pinch zooms the whole
  // page along with the plan.
  useEffect(() => {
    const el = svg.current;
    if (el === null) return;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const current = getState().planView;
      if (current === null) return;
      const rect = el.getBoundingClientRect();
      const at: [number, number] = [event.clientX - rect.left, event.clientY - rect.top];
      // Lines-mode wheels (Firefox) report notches, not pixels.
      const delta = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY;
      setPlanView(zoomAt(current, at, wheelFactor(delta)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Space held over the plan turns a left drag into a pan. Window-level,
  // because focus is rarely on the SVG when the hand goes to the space bar.
  useEffect(() => {
    const typing = (target: EventTarget | null): boolean =>
      target instanceof HTMLElement &&
      (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
    const down = (event: KeyboardEvent): void => {
      if (event.key !== " " || !hover.current || typing(event.target)) return;
      // Otherwise the page scrolls, or a focused toolbar button presses itself.
      event.preventDefault();
      if (!space.current) {
        space.current = true;
        setSpaceHeld(true);
      }
    };
    const up = (event: KeyboardEvent): void => {
      if (event.key !== " ") return;
      if (space.current) event.preventDefault();
      space.current = false;
      setSpaceHeld(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Leaving the plan view must not leave a stale coordinate in the readout.
  useEffect(() => () => setPlanPointer(null), []);

  const shown = view ?? fitTo(level, size.width, size.height);

  // Both tools run every render — hooks cannot be conditional — and only the
  // chosen one is active and receives events.
  const context = { doc, level: level ?? NO_LEVEL, view: shown };
  const tools: Record<typeof planTool, Tool> = {
    select: useSelectTool({ ...context, active: planTool === "select" && level !== undefined }),
    wall: useWallTool({ ...context, active: planTool === "wall" && level !== undefined }),
  };
  const tool = level === undefined ? null : tools[planTool];

  const pointerOf = (event: React.PointerEvent | React.MouseEvent): ToolPointer => {
    const current = getState().planView ?? shown;
    const rect = (svg.current ?? (event.currentTarget as Element)).getBoundingClientRect();
    const screen: [number, number] = [event.clientX - rect.left, event.clientY - rect.top];
    return {
      world: toWorld(current, screen),
      screen,
      shift: event.shiftKey,
      target: event.target as Element,
    };
  };

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>): void => {
    const panning = event.button === 1 || (event.button === 0 && space.current);
    if (event.button !== 0 && !panning) return;
    const took = !panning && (tool?.down?.(pointerOf(event)) ?? false);
    if (panning || took) {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    if (panning) setGrabbing(true);
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      travelled: 0,
      panning,
      tool: took,
    };
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>): void => {
    const current = getState().planView ?? shown;
    setPlanPointer(pointerWorld(event.currentTarget, current, event));
    const d = drag.current;
    if (d !== null && d.id === event.pointerId) {
      const dx = event.clientX - d.x;
      const dy = event.clientY - d.y;
      d.travelled += Math.hypot(dx, dy);
      d.x = event.clientX;
      d.y = event.clientY;
      if (d.panning) {
        setPlanView(pan(current, dx, dy));
        return;
      }
    }
    tool?.move?.(pointerOf(event));
  };

  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>): void => {
    const d = drag.current;
    drag.current = null;
    if (d === null || d.id !== event.pointerId) return;
    if (d.panning) {
      setGrabbing(false);
      return;
    }
    if (d.tool) {
      tool?.up?.(pointerOf(event));
      return;
    }
    if (d.travelled > CLICK_SLOP) return;
    tool?.click?.(pointerOf(event));
  };

  const cursor = grabbing ? "grabbing" : spaceHeld ? "grab" : (tool?.cursor ?? "default");

  return (
    <div ref={box} className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-white">
      <svg
        ref={svg}
        role="img"
        aria-label={level === undefined ? "Plan view" : `Plan view of ${level.name}`}
        data-testid="plan-surface"
        data-tool={planTool}
        width={size.width}
        height={size.height}
        style={{ cursor }}
        className="absolute inset-0 block size-full touch-none select-none"
        onPointerEnter={() => {
          hover.current = true;
        }}
        onPointerLeave={() => {
          hover.current = false;
          setPlanPointer(null);
          tool?.leave?.();
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
          setGrabbing(false);
        }}
        onDoubleClick={(event) => tool?.doubleClick?.(pointerOf(event))}
        // The middle button's autoscroll (and, on Linux, its paste) would
        // otherwise take over the pan.
        onMouseDown={(event) => {
          if (event.button === 1) event.preventDefault();
        }}
        onAuxClick={(event) => event.preventDefault()}
        onContextMenu={(event) => {
          event.preventDefault();
          tool?.contextMenu?.(pointerOf(event));
        }}
      >
        <rect width={size.width} height={size.height} fill="#ffffff" />
        <Grid view={shown} width={size.width} height={size.height} />
        {level !== undefined && (
          <LevelDrawing level={tool?.preview ?? level} view={shown} selection={selection} cut={CUT_HEIGHT} />
        )}
        {tool?.overlay}
      </svg>
      {tool?.html}
    </div>
  );
}
