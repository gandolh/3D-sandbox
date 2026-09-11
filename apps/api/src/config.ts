import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export interface Config {
  /** Directory holding `*.scene.json`. The source of truth. */
  scenesDir: string;
  /** Derived index. Disposable — deleting it costs a rescan, nothing more. */
  databasePath: string;
  port: number;
  host: string;
}

export function loadConfig(overrides: Partial<Config> = {}): Config {
  return {
    scenesDir:
      overrides.scenesDir ??
      process.env["SOLSTICE_SCENES_DIR"] ??
      resolve(here, "../../../scenes"),
    databasePath:
      overrides.databasePath ?? process.env["SOLSTICE_INDEX_DB"] ?? resolve(here, "../.data/index.db"),
    port: overrides.port ?? Number(process.env["PORT"] ?? 5174),
    host: overrides.host ?? process.env["HOST"] ?? "127.0.0.1",
  };
}
