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
  /**
   * Origins a browser may call this API from.
   *
   * The dev client, and nothing else by default. See the note beside the `cors`
   * registration for why this is not `true`.
   */
  allowedOrigins: string[];
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
    allowedOrigins:
      overrides.allowedOrigins ??
      (process.env["SOLSTICE_ALLOWED_ORIGINS"]?.split(",").map((o) => o.trim()).filter(Boolean) ?? [
        // Vite picks the next free port when 5173 is taken, which it routinely
        // is, so both are listed rather than making a fresh clone fail with a
        // CORS error that looks like a bug in the API.
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
      ]),
  };
}
