import { useSyncExternalStore } from "react";
import {
  SceneDocument,
  lintScene,
  type LintFinding,
  type SolarTime,
} from "@solstice/schema";

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

export function loadDocument(document: SceneDocument): void {
  set({
    document,
    findings: lintScene(document),
    revision: state.revision + 1,
    selection: null,
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
