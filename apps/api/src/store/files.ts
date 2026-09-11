import { readFile, readdir, rm, writeFile, stat } from "node:fs/promises";
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

  const serialized = serializeScene(document);
  await writeFile(path, serialized, "utf8");
  return { document, bytes: Buffer.byteLength(serialized) };
}

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
