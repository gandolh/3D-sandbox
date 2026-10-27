import { type LintFinding, lintScene, SceneDocument, type SolarTime } from "@solstice/schema";
import { useSyncExternalStore } from "react";
import { apiBase } from "../lib/api.js";
import type { ViewTransform } from "../lib/plan-view.js";
import { DEFAULT_SCENE_ID, SCENES } from "../scenes.js";

/**
 * A ~50-line store on `useSyncExternalStore`.
 *
 * The engine is imperative and lives outside React, so React needs to subscribe
 * to state rather than own it. That is exactly what `useSyncExternalStore` is
 * for, and it is less indirection than a state library would add for one screen.
 */
export interface AppState {
  document: SceneDocument | null;
  /** Entity id, e.g. `W-03`. Null when nothing is selected. */
  selection: string | null;
  /** Re-run on every document change — the inspector shows these live. */
  findings: readonly LintFinding[];
  /** Bumped whenever geometry must be regenerated. */
  revision: number;
  showContext: boolean;
  showColliders: boolean;
  /** Which scene is open, by id. Set by `loadDocument`; `openScene` is the way in. */
  sceneId: string;
  /** Shot id to render, or null for "whatever the viewport is looking at". */
  shotId: string | null;
  /** Animation playhead, in seconds. Driven at frame rate — see `setPlayhead`. */
  playhead: number;
  playing: boolean;
  /**
   * Loaded asset sizes, `id → [x, y, z]` metres. Empty until the models arrive,
   * and empty forever in a build that ships none — which is why physics treats a
   * placement with no size as having no collider rather than guessing one.
   */
  assetSizes: ReadonlyMap<string, readonly [number, number, number]>;
  theme: "dark" | "light";
  status: string;
  /**
   * Why there is no document, when there is none.
   *
   * Separate from `status` because they answer different questions and one of
   * them has to survive the next message. A scene that fails to parse used to
   * leave `document` null and say so **only** in the status line — so the
   * Inspector rendered its ordinary "Select something in the viewport or the
   * tree" empty state, inviting the user to select something in a scene that
   * never loaded, and the one contradicting signal was a strip of text that the
   * next status overwrote.
   */
  loadError: string | null;
  /**
   * Something failed and the user must be told now, not at the next pause.
   *
   * Separate from `status` because the two map onto the two live-region
   * politenesses: `status` is `aria-live="polite"` and waits its turn, which is
   * right for "12 model(s) loaded" and wrong for "Render failed" after forty
   * minutes of GPU. A failure is announced with `role="alert"`.
   *
   * Also shown visually, in the footer — this is not a screen-reader-only
   * channel with a sighted equivalent that says something different.
   */
  alert: string | null;
  /** Is the plan view showing instead of the viewport? */
  showPlan: boolean;
  /**
   * Which level the plan view shows, by id. Null means the first.
   *
   * An id rather than an index so a level added or removed above it does not
   * silently move the view to a different floor. When the id names nothing —
   * the level was deleted — the plan view falls back to the first.
   */
  planLevelId: string | null;
  /**
   * The plan view's pan and zoom. Null until the surface has a size to fit to.
   *
   * Here rather than in the component because the plan view unmounts when Plan
   * is toggled off, and coming back to a different zoom than you left is the
   * kind of small betrayal that makes a drawing tool feel untrustworthy.
   */
  planView: ViewTransform | null;
  /** Is the plan view showing the 1:100 sheet rather than the editable view? */
  planSheet: boolean;
  /**
   * The world point under the pointer in the plan view, `[x, z]` metres, or
   * null when the pointer is elsewhere. Moves at pointer rate; only the plan
   * view's readout subscribes to it.
   */
  planPointer: readonly [number, number] | null;
  /**
   * The plan view's tool. Select edits what exists; the others turn clicks
   * into one kind of building part. Esc returns to Select.
   */
  planTool: PlanTool;
  /**
   * What the Wall tool's options bar says a new wall gets. `material` null
   * means "the default": the level's most used, or the document's first.
   */
  wallOptions: { thickness: number; height: number | null; material: string | null };
  /** What the Door and Window tools cut: a door 0.9 × 2.1 m, a window 1.2 × 1.2 m at 0.9 m. */
  openingOptions: { door: OpeningSizes; window: OpeningSizes };
  /** What the Floor tool lays. `material` null means the level's most used slab material. */
  slabOptions: { thickness: number; material: string | null };
  /**
   * Whether a path trace owns the GPU right now.
   *
   * Here rather than inside the engine because the controls that must not be
   * touched during one — the scene picker, the context toggle, Save — are in
   * the toolbar, nowhere near it. A render can last an hour, and switching
   * scenes mid-render frees the geometry being traced while the queue goes on
   * reporting success.
   */
  rendering: boolean;
  /**
   * Undo history: the documents edits replaced, newest last, each named by the
   * edit that replaced it. Redo is the same, for steps undone.
   *
   * Whole documents, not patches. `editDocument` already makes a fresh, parsed
   * document on every edit and never mutates the old one, so keeping a
   * reference to the old one *is* an exact undo step, with no diffing and no
   * inverse to write for each kind of edit (brief 76).
   */
  undoStack: readonly HistoryStep[];
  redoStack: readonly HistoryStep[];
  /**
   * What the scene picker lists: the API's scenes when it answers, with the
   * bundled ones filling in any id it does not have.
   */
  scenes: readonly SceneEntry[];
  /** `none`: this build has no API. `down`: it has one that does not answer. */
  apiState: "checking" | "none" | "down" | "up";
  /**
   * The version of the open scene's file, from the API's `x-scene-mtime`, so
   * Save can refuse to overwrite a file changed on disk since. Null for a
   * bundled scene.
   */
  sceneMtime: number | null;
  /** The one modal question the app is asking, if any. */
  dialog: SceneDialog | null;
}

/** One entry in the scene picker. */
export interface SceneEntry {
  id: string;
  title: string;
  /** `scenes/src/<id>.ts` exists: the next `npm run scenes` rewrites this file. */
  hasBuilder: boolean;
  source: "api" | "bundled";
}

export type SceneDialog =
  /** New house, or Save as a new house when `copy` is set; `tool` is picked once it opens. */
  | { kind: "new-house"; copy: boolean; tool?: PlanTool; error?: string }
  /** A drawing tool was picked in a scene that has a builder. */
  | { kind: "builder"; tool: PlanTool }
  /** Save found the file changed on disk since it was opened. */
  | { kind: "stale" };

export type PlanTool = "select" | "wall" | "door" | "window" | "room" | "floor";

/** An opening's size, as the Door and Window tools' options bars hold it. */
export interface OpeningSizes {
  width: number;
  height: number;
  sill: number;
}

/** One undoable step: the document to go back to, and what the step did. */
export interface HistoryStep {
  document: SceneDocument;
  /** e.g. "Move P-03", for the button's tooltip. */
  label: string;
}

/**
 * How many steps undo keeps; the oldest goes first.
 *
 * Measured on Greenhollow, the largest scene (49 KB on disk): 100 steps held
 * about 7 MB of heap in Chromium and 10 MB in Node, 70–100 KB a step. Cheap
 * enough that the cap is not about memory pressure today, only about a long
 * session not growing without bound.
 */
export const HISTORY_LIMIT = 100;

let state: AppState = {
  document: null,
  selection: null,
  findings: [],
  revision: 0,
  showContext: true,
  showColliders: false,
  sceneId: DEFAULT_SCENE_ID,
  shotId: null,
  playhead: 0,
  playing: false,
  assetSizes: new Map(),
  theme: "dark",
  status: "Loading…",
  loadError: null,
  alert: null,
  showPlan: false,
  planLevelId: null,
  planView: null,
  planSheet: false,
  planPointer: null,
  planTool: "select",
  wallOptions: { thickness: 0.24, height: null, material: null },
  openingOptions: {
    door: { width: 0.9, height: 2.1, sill: 0 },
    window: { width: 1.2, height: 1.2, sill: 0.9 },
  },
  slabOptions: { thickness: 0.25, material: null },
  rendering: false,
  undoStack: [],
  redoStack: [],
  // The bundled scenes all have builders: they are the three in scenes/src.
  scenes: SCENES.map((scene) => ({ id: scene.id, title: scene.title, hasBuilder: true, source: "bundled" })),
  apiState: apiBase() === "" ? "none" : "checking",
  sceneMtime: null,
  dialog: null,
};

/**
 * The group of the last edit, while consecutive edits share one.
 *
 * Module state rather than `AppState` because nothing renders from it: it is
 * only how `editDocument` knows to fold the next edit into the step before.
 * Undo, redo and a load all end a group.
 */
let lastGroup: string | null = null;

const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((l) => l());

const set = (patch: Partial<AppState>): void => {
  state = { ...state, ...patch };
  emit();
};

export const getState = (): AppState => state;

export function useStore<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => select(state),
    () => select(state),
  );
}

/* ── actions ───────────────────────────────────────────────────── */

export function loadDocument(document: SceneDocument, sceneId?: string): void {
  lastGroup = null;
  set({
    document,
    findings: lintScene(document),
    revision: state.revision + 1,
    // Selection, shot and playhead are all ids into the document that is being
    // replaced. Carried over, they point at nothing: a shot id from Greenhollow
    // selected against Villa Carpathia leaves the Render button naming a shot
    // that does not exist.
    selection: null,
    shotId: null,
    playhead: 0,
    playing: false,
    // The plan view's level and framing are about this document too: a level
    // id from Elmsgate names nothing in Greenhollow, and a zoom that fit one
    // site shows empty ground on another. Null refits on the next paint.
    planLevelId: null,
    planView: null,
    // A material chosen for one scene's walls is a key into that scene's
    // table, and names nothing in the next one.
    wallOptions: { ...state.wallOptions, material: null },
    slabOptions: { ...state.slabOptions, material: null },
    // A different scene is not a step back. Undoing into the last scene's
    // document would swap scenes behind the picker's back.
    undoStack: [],
    redoStack: [],
    ...(sceneId === undefined ? {} : { sceneId }),
    status: `${document.title} loaded`,
    loadError: null,
  });
}

/** No document, and this is why. Clears when one loads. */
export const setLoadError = (loadError: string): void => {
  lastGroup = null;
  set({
    loadError,
    document: null,
    undoStack: [],
    redoStack: [],
    findings: [],
    selection: null,
    status: loadError,
    alert: loadError,
  });
};

export const select = (selection: string | null): void => set({ selection });

export const setTheme = (theme: "dark" | "light"): void => {
  document.documentElement.dataset.theme = theme;
  set({ theme });
};

export const setShowColliders = (showColliders: boolean): void => set({ showColliders });

export const setShowContext = (showContext: boolean): void =>
  set({ showContext, revision: state.revision + 1 });

export const setShowPlan = (showPlan: boolean): void => set({ showPlan });

export const setPlanLevelId = (planLevelId: string | null): void => set({ planLevelId });
export const setPlanView = (planView: ViewTransform | null): void => set({ planView });
export const setPlanSheet = (planSheet: boolean): void => set({ planSheet });
export const setPlanTool = (planTool: PlanTool): void => set({ planTool });

/** Scenes where "draw anyway" was chosen this session. Not saved: a reload asks again. */
const drawingAllowed = new Set<string>();

/** Answer the builder warning for this scene, for the rest of the session. */
export const allowDrawing = (sceneId: string): void => {
  drawingAllowed.add(sceneId);
};

/**
 * Pick a plan view tool, warning first when it draws into a scene that has a
 * builder: the next `npm run scenes` rewrites that scene's JSON from its
 * TypeScript and the drawing is gone (decisions.md, "The browser draws
 * building parts"). Select never warns; it edits what is there.
 *
 * Keyed on the open document's id, which the API holds equal to the file's
 * name, rather than on `sceneId`, which only the picker sets.
 */
export function pickTool(tool: PlanTool): void {
  const id = state.document?.id;
  const entry = state.scenes.find((s) => s.id === id);
  if (tool !== "select" && id !== undefined && entry?.hasBuilder === true && !drawingAllowed.has(id)) {
    set({ dialog: { kind: "builder", tool } });
    return;
  }
  set({ planTool: tool });
}

export const setDialog = (dialog: SceneDialog | null): void => set({ dialog });
export const setScenes = (scenes: readonly SceneEntry[], apiState: AppState["apiState"]): void =>
  set({ scenes, apiState });
export const setSceneMtime = (sceneMtime: number | null): void => set({ sceneMtime });
export const setWallOptions = (patch: Partial<AppState["wallOptions"]>): void =>
  set({ wallOptions: { ...state.wallOptions, ...patch } });
export const setOpeningOptions = (kind: "door" | "window", patch: Partial<OpeningSizes>): void =>
  set({ openingOptions: { ...state.openingOptions, [kind]: { ...state.openingOptions[kind], ...patch } } });
export const setSlabOptions = (patch: Partial<AppState["slabOptions"]>): void =>
  set({ slabOptions: { ...state.slabOptions, ...patch } });
/** Pointer rate, like `setPlayhead`: cheap because only the readout selects it. */
export const setPlanPointer = (planPointer: readonly [number, number] | null): void => set({ planPointer });

/** The ordinary channel: polite, and it clears any standing alert. */
export const setStatus = (status: string): void => set({ status, alert: null });

/** The interrupting one. Shown in the footer *and* announced immediately. */
export const setAlert = (alert: string): void => set({ alert, status: alert });

export const setShotId = (shotId: string | null): void => set({ shotId });

/**
 * Move the playhead. Called every frame during playback, so it must stay cheap.
 *
 * It is safe because `useStore` is `useSyncExternalStore` with a selector:
 * components whose selected value is unchanged do not re-render, so only the
 * timeline reacts. The scene itself is driven straight from the engine — going
 * through the document would clone, re-parse, re-lint and regenerate the whole
 * scene sixty times a second.
 */
export const setPlayhead = (playhead: number): void => set({ playhead });
export const setPlaying = (playing: boolean): void => set({ playing });

export const setRendering = (rendering: boolean): void => set({ rendering });

export const setAssetSizes = (assetSizes: ReadonlyMap<string, readonly [number, number, number]>): void =>
  set({ assetSizes });

/** What an edit is called in the undo history, and whether it folds into the one before. */
export interface EditOptions {
  /** The step's name, e.g. "Add wall W-07". Shown on the Undo button. */
  label?: string;
  /**
   * Consecutive edits with the same group fold into one undo step until a
   * different edit arrives. For anything that edits per input event: one drag
   * of the sun slider is a hundred `setSolar` calls and one step.
   */
  group?: string;
}

/**
 * Apply an edit to the document, then re-validate.
 *
 * The edit is re-parsed through the schema so defaults and coercions apply the
 * same way they would on load — an edited document and a loaded one must be
 * indistinguishable, or the editor becomes a second source of truth.
 *
 * The document it replaces goes on the undo stack, and any edit clears redo.
 * A rejected edit changes nothing, history included.
 */
export function editDocument(mutate: (draft: SceneDocument) => void, options: EditOptions = {}): void {
  const previous = state.document;
  if (previous === null) return;
  const draft = structuredClone(previous) as SceneDocument;
  mutate(draft);

  const parsed = SceneDocument.safeParse(draft);
  if (!parsed.success) {
    set({ status: `Rejected: ${parsed.error.issues[0]?.message ?? "invalid edit"}` });
    return;
  }

  const label = options.label ?? "Edit";
  const top = state.undoStack.at(-1);
  const folds = options.group !== undefined && options.group === lastGroup && top !== undefined;
  // Folding keeps the document from before the group began, so one undo goes
  // back past the whole drag; the label follows the latest edit.
  const undoStack = folds
    ? [...state.undoStack.slice(0, -1), { document: top.document, label }]
    : [...state.undoStack, { document: previous, label }].slice(-HISTORY_LIMIT);
  lastGroup = options.group ?? null;

  set({
    document: parsed.data,
    findings: lintScene(parsed.data),
    revision: state.revision + 1,
    undoStack,
    redoStack: [],
  });
}

/** Does anything in the document carry this id? Openings and rooms included. */
function hasId(node: unknown, id: string): boolean {
  if (Array.isArray(node)) return node.some((item) => hasId(item, id));
  if (node === null || typeof node !== "object") return false;
  if ((node as { id?: unknown }).id === id) return true;
  return Object.values(node).some((value) => hasId(value, id));
}

/**
 * Put a document from history back, through the same path an edit takes:
 * re-lint and bump the revision, so the engine regenerates as it would for
 * any other change. Not while a render runs — the same rule that guards the
 * scene picker and Save, because the trace is sampling the geometry this
 * would dispose.
 */
function restore(
  from: "undoStack" | "redoStack",
  to: "undoStack" | "redoStack",
  verb: "Undid" | "Redid",
): void {
  const current = state.document;
  const step = state[from].at(-1);
  if (current === null || step === undefined || state.rendering) return;
  lastGroup = null;
  const selection =
    state.selection !== null && hasId(step.document.subject, state.selection) ? state.selection : null;
  set({
    document: step.document,
    findings: lintScene(step.document),
    revision: state.revision + 1,
    [from]: state[from].slice(0, -1),
    [to]: [...state[to], { document: current, label: step.label }],
    // A selection pointing at a wall the undo removed would leave the
    // Inspector and the gizmo holding nothing.
    selection,
    status: `${verb}: ${step.label}`,
    alert: null,
  });
}

export const undo = (): void => restore("undoStack", "redoStack", "Undid");
export const redo = (): void => restore("redoStack", "undoStack", "Redid");

export const setSolar = (solar: SolarTime): void =>
  editDocument(
    (draft) => {
      draft.solar = solar;
    },
    { label: `Set the sun to ${solar.time}`, group: "solar" },
  );
