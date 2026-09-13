import { open, readFile, readdir, rename, rm, stat, unlink } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import { SceneValidationError, loadScene, serializeScene, type SceneDocument } from "@solstice/schema";

const SLUG = /^[A-Za-z][A-Za-z0-9_-]*$/;
const SUFFIX = ".scene.json";

export class UnsafeIdError extends Error {
  constructor(id: string) {
    super(`"${id}" is not a valid scene id — letters, digits, hyphen and underscore only`);
    this.name = "UnsafeIdError";
  }
}

export class StalePreconditionError extends Error {
  // Not parameter properties: they need code generated for the assignments,
  // and this package is run straight from source by `npm run api`, where
  // Node strips types rather than compiling them.
  readonly id: string;
  readonly current: number;

  constructor(id: string, current: number) {
    super(`Scene "${id}" has changed on disk since you read it`);
    this.name = "StalePreconditionError";
    this.id = id;
    this.current = current;
  }
}

export class SceneNotFoundError extends Error {
  constructor(id: string) {
    super(`No scene "${id}"`);
    this.name = "SceneNotFoundError";
  }
}

/**
 * An id becomes a filename, so this is the security boundary, not a nicety.
 *
 * The slug pattern alone rejects `..` and separators, and the resolved path is
 * checked against the scenes directory afterwards — belt and braces, because a
 * path-traversal bug here reads arbitrary files off the host.
 */
export function scenePath(scenesDir: string, id: string): string {
  if (!SLUG.test(id)) throw new UnsafeIdError(id);
  const full = resolve(scenesDir, `${id}${SUFFIX}`);
  const root = resolve(scenesDir);
  if (!full.startsWith(root + sep)) throw new UnsafeIdError(id);
  return full;
}

export const idFromFilename = (file: string): string => basename(file, SUFFIX);

export async function listSceneFiles(scenesDir: string): Promise<string[]> {
  try {
    const entries = await readdir(scenesDir);
    return entries.filter((f) => f.endsWith(SUFFIX)).sort();
  } catch {
    return [];
  }
}

export async function readSceneFile(scenesDir: string, id: string): Promise<SceneDocument> {
  const path = scenePath(scenesDir, id);
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    throw new SceneNotFoundError(id);
  }
  return loadScene(JSON.parse(raw) as unknown).document;
}

export interface WriteResult {
  document: SceneDocument;
  bytes: number;
}

/**
 * Validate, then write. Never the other way round.
 *
 * `loadScene` throws `SceneValidationError` on any error finding, so a document
 * that would not load cannot reach the disk — which is what makes "scene files
 * are truth" safe to rely on everywhere else.
 */
export async function writeSceneFile(
  scenesDir: string,
  id: string,
  input: unknown,
  /**
   * The `mtimeMs` the caller last saw, when it has one.
   *
   * Absent means "write regardless", which is what a create does. Present and
   * stale throws `StalePreconditionError` rather than overwriting: the previous
   * behaviour was last-write-wins with no signal, so two tabs open on one scene
   * silently destroyed each other's work.
   *
   * Compared with a 1 ms tolerance because `mtimeMs` survives a round trip
   * through JSON as a float and some filesystems store coarser timestamps than
   * they report.
   */
  expectedMtime?: number,
): Promise<WriteResult> {
  const path = scenePath(scenesDir, id);
  const { document } = loadScene(input);

  if (document.id !== id) {
    throw new SceneValidationError(id, [
      {
        rule: "id-matches-filename",
        severity: "error",
        path: "id",
        message: `document id "${document.id}" does not match the route id "${id}"`,
        entities: [],
      },
    ]);
  }

  // The precondition is checked as late as possible and still before the write,
  // which is as close to atomic as a filesystem gets without locking. Two
  // clients saving the same scene in the same millisecond can still race; the
  // window this closes is the realistic one — a tab left open for an hour while
  // the file changed underneath it.
  if (expectedMtime !== undefined) {
    const current = await mtimeOrNull(path);
    if (current === null) throw new SceneNotFoundError(id);
    if (Math.abs(current - expectedMtime) > 1) throw new StalePreconditionError(id, current);
  }

  await writeAtomically(path, serializeScene(document));
  return { document, bytes: Buffer.byteLength(serializeScene(document)) };
}

/**
 * Write, or leave the previous file exactly as it was.
 *
 * A bare `writeFile` truncates the target and then streams into it, so a
 * process killed mid-write — or a full disk — leaves a **half a scene** on
 * disk, and this project's whole premise is that the files are the truth. A
 * temp file in the same directory, fsynced, then renamed over the target, gives
 * a reader either the old document or the new one and never a torn one:
 * `rename` within a filesystem is atomic, which is exactly why the temp file
 * must be a sibling rather than in `/tmp`.
 *
 * The fsync matters as much as the rename. Without it the rename can reach the
 * disk before the bytes do, and a power loss leaves a correctly-named empty
 * file where the old one was.
 */
async function writeAtomically(path: string, contents: string): Promise<void> {
  const temp = `${path}.${process.pid.toString(36)}${Date.now().toString(36)}.tmp`;
  let handle;
  try {
    handle = await open(temp, "wx");
    await handle.writeFile(contents, "utf8");
    await handle.sync();
  } finally {
    await handle?.close();
  }
  try {
    await rename(temp, path);
  } catch (error) {
    // A failed rename must not leave litter beside the scenes it failed to
    // replace — those are the files the index scans.
    await unlink(temp).catch(() => undefined);
    throw error;
  }
}

const mtimeOrNull = async (path: string): Promise<number | null> => {
  try {
    return (await stat(path)).mtimeMs;
  } catch {
    return null;
  }
};

export async function deleteSceneFile(scenesDir: string, id: string): Promise<void> {
  const path = scenePath(scenesDir, id);
  try {
    await stat(path);
  } catch {
    throw new SceneNotFoundError(id);
  }
  await rm(path);
}

export const sceneMtime = async (scenesDir: string, id: string): Promise<number> =>
  (await stat(join(scenesDir, `${id}${SUFFIX}`))).mtimeMs;

export const sceneBytes = async (scenesDir: string, id: string): Promise<number> =>
  (await stat(join(scenesDir, `${id}${SUFFIX}`))).size;
