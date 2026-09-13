import { type LintFinding, lintScene, SceneDocument, type SolarTime } from "@solstice/schema";
import { useSyncExternalStore } from "react";
import { DEFAULT_SCENE_ID } from "../scenes.js";

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
  /** Which bundled scene is open — see `scenes.ts`. */
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
  /** Is the floor plan showing instead of the viewport? */
  showPlan: boolean;
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
}

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
  rendering: false,
};

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
    ...(sceneId === undefined ? {} : { sceneId }),
    status: `${document.title} loaded`,
    loadError: null,
  });
}

/** No document, and this is why. Clears when one loads. */
export const setLoadError = (loadError: string): void =>
  set({
    loadError,
    document: null,
    findings: [],
    selection: null,
    status: loadError,
    alert: loadError,
  });

export const select = (selection: string | null): void => set({ selection });

export const setTheme = (theme: "dark" | "light"): void => {
  document.documentElement.dataset.theme = theme;
  set({ theme });
};

export const setShowColliders = (showColliders: boolean): void => set({ showColliders });

export const setShowContext = (showContext: boolean): void =>
  set({ showContext, revision: state.revision + 1 });

export const setShowPlan = (showPlan: boolean): void => set({ showPlan });

/** The ordinary channel: polite, and it clears any standing alert. */
export const setStatus = (status: string): void => set({ status, alert: null });

/** The interrupting one. Shown in the footer *and* announced immediately. */
export const setAlert = (alert: string): void => set({ alert, status: alert });

export const setShotId = (shotId: string | null): void => set({ shotId });

/**
 * Open a different bundled scene.
 *
 * Only sets the id — `App` watches it and does the parse, so switching and
 * first load take the same path rather than two that can drift apart.
 */
export const setSceneId = (sceneId: string): void => set({ sceneId });

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

/**
 * Apply an edit to the document, then re-validate.
 *
 * The edit is re-parsed through the schema so defaults and coercions apply the
 * same way they would on load — an edited document and a loaded one must be
 * indistinguishable, or the editor becomes a second source of truth.
 */
export function editDocument(mutate: (draft: SceneDocument) => void): void {
  if (state.document === null) return;
  const draft = structuredClone(state.document) as SceneDocument;
  mutate(draft);

  const parsed = SceneDocument.safeParse(draft);
  if (!parsed.success) {
    set({ status: `Rejected: ${parsed.error.issues[0]?.message ?? "invalid edit"}` });
    return;
  }

  set({
    document: parsed.data,
    findings: lintScene(parsed.data),
    revision: state.revision + 1,
  });
}

export const setSolar = (solar: SolarTime): void =>
  editDocument((draft) => {
    draft.solar = solar;
  });
