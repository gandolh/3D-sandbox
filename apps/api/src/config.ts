import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const here = dirname(fileURLToPath(import.meta.url));

/** The API's settings, parsed once at start. No other file reads the environment. */
export interface Config {
  /** `SOLSTICE_SCENES_DIR`: the directory holding `*.scene.json`. The source of truth. */
  scenesDir: string;
  /** `SOLSTICE_INDEX_DB`: the derived index. Disposable: deleting it costs a rescan, nothing more. */
  databasePath: string;
  /** `PORT`, 5174 by default. */
  port: number;
  /** `HOST`, 127.0.0.1 by default: the API is unauthenticated, so it answers this machine only. */
  host: string;
  /**
   * `SOLSTICE_ALLOWED_ORIGINS`, comma-separated: the origins a browser may call this API from.
   *
   * The dev client, and nothing else by default. See the note beside the `cors` registration for why this is
   * not `true`.
   */
  allowedOrigins: string[];
}

/** The environment can't run the API. The message names every variable at fault. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

// Vite picks the next free port when 5173 is taken, which it routinely is, so both are listed rather than
// making a fresh clone fail with a CORS error that looks like a bug in the API.
const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
];

/** `KEY=` counts as unset, so the default applies rather than an empty string. */
function unset(value: unknown): unknown {
  return value === "" ? undefined : value;
}

/**
 * A comma-separated list, trimmed, with empty items dropped. Set, it must name at least one: a list that
 * parsed to nothing used to turn every browser call into a CORS failure with no message.
 */
const list = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item !== ""),
  )
  .pipe(z.array(z.string()).min(1, "Name at least one origin, or leave the variable unset for the defaults."));

const envSchema = z.object({
  SOLSTICE_SCENES_DIR: z.preprocess(unset, z.string().optional()),
  SOLSTICE_INDEX_DB: z.preprocess(unset, z.string().optional()),
  PORT: z.preprocess(unset, z.coerce.number<string>().int().min(1).max(65535).default(5174)),
  HOST: z.preprocess(unset, z.string().default("127.0.0.1")),
  SOLSTICE_ALLOWED_ORIGINS: z.preprocess(unset, list.optional()),
});

/**
 * Parses the settings, or throws `ConfigError` naming every bad variable: `PORT=abc` fails here rather than
 * listening on `NaN`. An override wins over its variable. Tests pass their own `env`.
 */
export function loadConfig(overrides: Partial<Config> = {}, env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) throw new ConfigError(z.prettifyError(parsed.error));
  const { SOLSTICE_SCENES_DIR, SOLSTICE_INDEX_DB, PORT, HOST, SOLSTICE_ALLOWED_ORIGINS } = parsed.data;
  return {
    scenesDir: overrides.scenesDir ?? SOLSTICE_SCENES_DIR ?? resolve(here, "../../../scenes"),
    databasePath: overrides.databasePath ?? SOLSTICE_INDEX_DB ?? resolve(here, "../.data/index.db"),
    port: overrides.port ?? PORT,
    host: overrides.host ?? HOST,
    allowedOrigins: overrides.allowedOrigins ?? SOLSTICE_ALLOWED_ORIGINS ?? DEV_ORIGINS,
  };
}
