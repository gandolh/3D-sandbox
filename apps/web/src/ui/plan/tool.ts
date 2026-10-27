import type { Level, SceneDocument } from "@solstice/schema";
import type { ReactNode } from "react";
import type { ViewTransform } from "../../lib/plan-view.js";

/** One pointer event, already in world metres. */
export interface ToolPointer {
  /** The world point under the pointer, unsnapped. */
  world: [number, number];
  /** Surface pixels, for placing overlays. */
  screen: [number, number];
  shift: boolean;
  /** What was under the pointer: a mark with `data-entity`, a grip, or bare ground. */
  target: Element | null;
}

/** What a tool needs to know about where it is working. */
export interface ToolContext {
  doc: SceneDocument;
  level: Level;
  view: ViewTransform;
  active: boolean;
}

/**
 * A plan view tool: the surface owns pan, zoom and the pointer, and hands
 * every other gesture to whichever tool is chosen.
 */
export interface Tool {
  /** Left button down. Return true to take the drag (a grip); the surface then sends `move` and `up`. */
  down?(p: ToolPointer): boolean;
  move?(p: ToolPointer): void;
  up?(p: ToolPointer): void;
  /** A press and release that did not travel: a click. */
  click?(p: ToolPointer): void;
  doubleClick?(p: ToolPointer): void;
  contextMenu?(p: ToolPointer): void;
  leave?(): void;
  /** SVG over the level, in surface pixels. */
  overlay?: ReactNode | undefined;
  /** HTML over the surface, positioned in surface pixels. */
  html?: ReactNode | undefined;
  /** The level as the tool would leave it, while a drag is in flight. */
  preview?: Level | undefined;
  cursor: string;
}
