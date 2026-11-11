import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config.js";

/** The error `loadConfig` throws for this environment, as text. */
function failure(env: NodeJS.ProcessEnv): string {
  try {
    loadConfig({}, env);
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError);
    return String(error);
  }
  throw new Error("loadConfig accepted the environment");
}

describe("loadConfig", () => {
  it("fills the defaults from an empty environment", () => {
    const config = loadConfig({}, {});
    expect(config.port).toBe(5174);
    expect(config.host).toBe("127.0.0.1");
    expect(config.allowedOrigins).toEqual([
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5174",
    ]);
    expect(config.scenesDir).toMatch(/[/\\]scenes$/);
    expect(config.databasePath).toMatch(/[/\\]apps[/\\]api[/\\]\.data[/\\]index\.db$/);
  });

  it("treats an empty value as unset", () => {
    const empty = { SOLSTICE_SCENES_DIR: "", SOLSTICE_INDEX_DB: "", PORT: "", HOST: "", SOLSTICE_ALLOWED_ORIGINS: "" };
    expect(loadConfig({}, empty)).toEqual(loadConfig({}, {}));
  });

  it("reads each variable, splitting and trimming the origins", () => {
    const config = loadConfig(
      {},
      {
        SOLSTICE_SCENES_DIR: "/srv/scenes",
        SOLSTICE_INDEX_DB: "/srv/index.db",
        PORT: "8080",
        HOST: "0.0.0.0",
        SOLSTICE_ALLOWED_ORIGINS: " http://a.test , http://b.test,",
      },
    );
    expect(config).toEqual({
      scenesDir: "/srv/scenes",
      databasePath: "/srv/index.db",
      port: 8080,
      host: "0.0.0.0",
      allowedOrigins: ["http://a.test", "http://b.test"],
    });
  });

  it("lets an override win over its variable", () => {
    expect(
      loadConfig({ port: 9000, scenesDir: "/tmp/x" }, { PORT: "8080", SOLSTICE_SCENES_DIR: "/srv" }),
    ).toMatchObject({ port: 9000, scenesDir: "/tmp/x" });
  });

  it.each(["abc", "0", "65536", "80.5"])("refuses PORT=%s, naming the variable", (port) => {
    expect(failure({ PORT: port })).toMatch(/PORT/);
  });

  it("refuses an origins list with nothing in it, naming the variable", () => {
    expect(failure({ SOLSTICE_ALLOWED_ORIGINS: " , " })).toMatch(/SOLSTICE_ALLOWED_ORIGINS/);
  });

  it("names every bad variable at once", () => {
    const message = failure({ PORT: "abc", SOLSTICE_ALLOWED_ORIGINS: "," });
    expect(message).toMatch(/PORT/);
    expect(message).toMatch(/SOLSTICE_ALLOWED_ORIGINS/);
  });
});
