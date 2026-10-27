import { Id, type SceneDocument, type SceneDocumentInput, serializeScene } from "@solstice/schema";

/**
 * The small client for `apps/api`: list, read, create, replace.
 *
 * Every function says what happened rather than throwing, because each caller
 * has a different honest answer to "the API is not there": the picker falls
 * back to the bundled scenes, Save downloads the file, New house turns itself
 * off.
 */

/**
 * Where the API is, or "" for a build with none (the static deploy).
 *
 * `__API_BASE__` is a Vite `define`, replaced in the source text at build
 * time. Under vitest nothing defines it, so a bare read would throw; the
 * `typeof` guard reads as "no API" there instead. Read it nowhere else.
 */
export function apiBase(): string {
  return typeof __API_BASE__ === "undefined" ? "" : __API_BASE__;
}

/** One scene as `GET /api/scenes` lists it. */
export interface ApiScene {
  id: string;
  title: string;
  /** Whether `scenes/src/<id>.ts` exists, so `npm run scenes` would overwrite it. */
  hasBuilder: boolean;
}

/** How long to wait for the listing before treating the API as down. */
const LIST_TIMEOUT_MS = 1500;

/**
 * The API's scenes, or null when there is no API or it does not answer.
 *
 * A non-OK answer counts as down too: with the API stopped, Vite's dev proxy
 * still answers, with a 500.
 */
export async function listScenes(): Promise<ApiScene[] | null> {
  if (apiBase() === "") return null;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), LIST_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiBase()}/scenes`, { signal: abort.signal });
    if (!response.ok) return null;
    const body = (await response.json()) as { scenes?: unknown };
    if (!Array.isArray(body.scenes)) return null;
    return body.scenes
      .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
      .filter((s) => typeof s.id === "string")
      .map((s) => ({
        id: s.id as string,
        title: typeof s.title === "string" ? s.title : (s.id as string),
        hasBuilder: s.hasBuilder === true,
      }));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const mtimeOf = (response: Response): number | null => {
  const header = response.headers.get("x-scene-mtime");
  const value = header === null ? Number.NaN : Number(header);
  return Number.isFinite(value) ? value : null;
};

/** A scene's JSON as the file holds it, and the version it was read at. */
export async function readScene(id: string): Promise<{ json: unknown; mtime: number | null } | null> {
  try {
    const response = await fetch(`${apiBase()}/scenes/${encodeURIComponent(id)}`);
    if (!response.ok) return null;
    return { json: await response.json(), mtime: mtimeOf(response) };
  } catch {
    return null;
  }
}

export type WriteOutcome =
  | { kind: "saved"; bytes: number; mtime: number | null }
  | { kind: "created"; mtime: number | null }
  /** `PUT`: the file changed on disk since it was read. */
  | { kind: "stale" }
  /** `POST`: a scene with that id is already on disk. */
  | { kind: "exists" }
  | { kind: "refused"; status: number; message: string }
  | { kind: "unreachable" };

const refusal = async (response: Response): Promise<WriteOutcome> => {
  const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
  if (response.status === 409 && body.error === "stale") return { kind: "stale" };
  if (response.status === 409 && body.error === "exists") return { kind: "exists" };
  return { kind: "refused", status: response.status, message: body.message ?? body.error ?? "" };
};

/**
 * Replace a scene, conditional on the version it was read at when there is
 * one: a file edited by hand since it was opened is refused, not overwritten.
 */
export async function saveScene(doc: SceneDocument, mtime: number | null): Promise<WriteOutcome> {
  try {
    const response = await fetch(`${apiBase()}/scenes/${encodeURIComponent(doc.id)}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        ...(mtime === null ? {} : { "x-scene-mtime": String(mtime) }),
      },
      body: serializeScene(doc),
    });
    if (!response.ok) return await refusal(response);
    const body = (await response.json().catch(() => ({}))) as { bytes?: number };
    return { kind: "saved", bytes: body.bytes ?? 0, mtime: mtimeOf(response) };
  } catch {
    return { kind: "unreachable" };
  }
}

/** Create a scene. `POST` never overwrites: a file already there is `exists`. */
export async function createScene(doc: SceneDocumentInput): Promise<WriteOutcome> {
  try {
    const response = await fetch(`${apiBase()}/scenes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(doc),
    });
    if (!response.ok) return await refusal(response);
    return { kind: "created", mtime: mtimeOf(response) };
  } catch {
    return { kind: "unreachable" };
  }
}

/**
 * A scene id from a title: lowercase, words joined by hyphens, accents
 * dropped, so "Căsuța de la Munte" is `casuta-de-la-munte`. Null when nothing
 * usable is left, or the result is not a valid id (it must start with a
 * letter, so "2nd Cottage" needs another title).
 */
export function idFromTitle(title: string): string | null {
  const id = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/, "");
  return id !== "" && Id.safeParse(id).success ? id : null;
}

/**
 * The smallest document a new house can be: the open scene's site, sun and
 * materials, one empty level, and nothing else. Everything the linter would
 * object to in an empty plot is a warning, so the API accepts it.
 */
export function newHouseDocument(id: string, title: string, from: SceneDocument): SceneDocumentInput {
  return {
    schemaVersion: from.schemaVersion,
    id,
    title,
    site: from.site,
    solar: from.solar,
    materials: from.materials,
    subject: {
      levels: [
        { id: "ground", name: "Ground floor", elevation: 0, height: 2.7, walls: [], slabs: [], rooms: [] },
      ],
      roofs: [],
      placements: [],
      runs: [],
    },
    context: { paving: [], scatter: [], masses: [], roads: [] },
    shots: [],
  };
}
