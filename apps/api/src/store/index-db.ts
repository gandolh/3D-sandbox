import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { estimateScatterInstances, lintScene, sceneCounts } from "@solstice/schema";
import {
  idFromFilename,
  listSceneFiles,
  readSceneFile,
  sceneBytes,
  sceneMtime,
} from "./files.js";

/**
 * The derived index.
 *
 * Nothing here is authoritative — every column is recomputed from the scene
 * files, and deleting the database costs a rescan and nothing else. That is
 * deliberate: scenes are hand-edited outside this service as a matter of
 * routine, so an index that claimed to be a source of truth would be wrong by
 * lunchtime.
 *
 * Uses Node's built-in `node:sqlite` rather than a native module: no compile
 * step on a VPS, no dependency to keep pinned. It is still flagged experimental,
 * which is an acceptable risk precisely because the data is disposable.
 */
export interface SceneSummary {
  id: string;
  title: string;
  bytes: number;
  mtime: number;
  walls: number;
  openings: number;
  shots: number;
  scatterInstances: number;
  warnings: number;
}

export class SceneIndex {
  private readonly db: DatabaseSync;

  constructor(databasePath: string) {
    if (databasePath !== ":memory:") mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new DatabaseSync(databasePath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scenes (
        id               TEXT PRIMARY KEY,
        title            TEXT NOT NULL,
        bytes            INTEGER NOT NULL,
        mtime            REAL NOT NULL,
        walls            INTEGER NOT NULL,
        openings         INTEGER NOT NULL,
        shots            INTEGER NOT NULL,
        scatterInstances INTEGER NOT NULL,
        warnings         INTEGER NOT NULL
      );
      -- Per-viewer conveniences only. Explicitly disposable; never read by
      -- anything that matters.
      CREATE TABLE IF NOT EXISTS ui_state (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  list(): SceneSummary[] {
    return this.db.prepare("SELECT * FROM scenes ORDER BY id").all() as unknown as SceneSummary[];
  }

  get(id: string): SceneSummary | null {
    const row = this.db.prepare("SELECT * FROM scenes WHERE id = ?").get(id);
    return (row as unknown as SceneSummary | undefined) ?? null;
  }

  upsert(summary: SceneSummary): void {
    this.db
      .prepare(
        `INSERT INTO scenes (id, title, bytes, mtime, walls, openings, shots, scatterInstances, warnings)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title, bytes = excluded.bytes, mtime = excluded.mtime,
           walls = excluded.walls, openings = excluded.openings, shots = excluded.shots,
           scatterInstances = excluded.scatterInstances, warnings = excluded.warnings`,
      )
      .run(
        summary.id,
        summary.title,
        summary.bytes,
        summary.mtime,
        summary.walls,
        summary.openings,
        summary.shots,
        summary.scatterInstances,
        summary.warnings,
      );
  }

  remove(id: string): void {
    this.db.prepare("DELETE FROM scenes WHERE id = ?").run(id);
  }

  close(): void {
    this.db.close();
  }

  /**
   * Rebuild from disk. Scenes that fail to load are dropped from the index
   * rather than crashing the rescan — a broken file should make one scene
   * unavailable, not the whole service.
   */
  async reindex(scenesDir: string): Promise<{ indexed: string[]; failed: string[] }> {
    const files = await listSceneFiles(scenesDir);
    const indexed: string[] = [];
    const failed: string[] = [];

    this.db.exec("DELETE FROM scenes");

    for (const file of files) {
      const id = idFromFilename(file);
      try {
        const document = await readSceneFile(scenesDir, id);
        this.upsert(await summarize(scenesDir, id, document));
        indexed.push(id);
      } catch {
        failed.push(id);
      }
    }

    return { indexed, failed };
  }
}

export async function summarize(
  scenesDir: string,
  id: string,
  document: Awaited<ReturnType<typeof readSceneFile>>,
  bytes?: number,
): Promise<SceneSummary> {
  const counts = sceneCounts(document);
  const scatterInstances = document.context.scatter.reduce(
    (n, f) => n + estimateScatterInstances(f).instances,
    0,
  );

  return {
    id,
    title: document.title,
    bytes: bytes ?? (await sceneBytes(scenesDir, id).catch(() => 0)),
    mtime: await sceneMtime(scenesDir, id).catch(() => 0),
    walls: counts.walls,
    openings: counts.openings,
    shots: counts.shots,
    scatterInstances,
    warnings: lintScene(document).length,
  };
}
