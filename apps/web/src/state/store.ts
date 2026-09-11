import { useSyncExternalStore } from "react";
import {
  SceneDocument,
  lintScene,
  type LintFinding,
  type SolarTime,
} from "@solstice/schema";
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
  });
}

export const select = (selection: string | null): void => set({ selection });

export const setTheme = (theme: "dark" | "light"): void => {
  document.documentElement.dataset["theme"] = theme;
  set({ theme });
};

export const setShowColliders = (showColliders: boolean): void =>
  set({ showColliders });

export const setShowContext = (showContext: boolean): void =>
  set({ showContext, revision: state.revision + 1 });

export const setStatus = (status: string): void => set({ status });

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

export const setAssetSizes = (
  assetSizes: ReadonlyMap<string, readonly [number, number, number]>,
): void => set({ assetSizes });

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
