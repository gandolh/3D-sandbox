import { copyFile, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadScene } from "@solstice/schema";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

/**
 * A response schema must change nothing a client reads. The document routes encode every reply through
 * `SceneDocument`, so each real scene, read through the API, must come out as the exact bytes Fastify sent
 * before the schema: `JSON.stringify` of the loaded document.
 */
const SCENES = fileURLToPath(new URL("../../../scenes/", import.meta.url));
const FILES = (await readdir(SCENES)).filter((file) => file.endsWith(".scene.json")).sort();

let dir: string;
let app: FastifyInstance;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "solstice-api-replies-"));
  for (const file of FILES) await copyFile(join(SCENES, file), join(dir, file));
  ({ app } = await buildApp(loadConfig({ scenesDir: dir, databasePath: ":memory:" }, {})));
});

afterAll(async () => {
  await app.close();
  await rm(dir, { recursive: true, force: true });
});

const loaded = async (file: string) =>
  JSON.stringify(loadScene(JSON.parse(await readFile(join(SCENES, file), "utf8")) as unknown).document);

describe("the scene replies through their response schemas", () => {
  it("cover the three scenes", () => {
    expect(FILES).toEqual(["elmsgate.scene.json", "greenhollow.scene.json", "villa-carpathia.scene.json"]);
  });

  it.each(FILES)("GET returns %s byte for byte", async (file) => {
    const res = await app.inject({ method: "GET", url: `/api/scenes/${file.replace(".scene.json", "")}` });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(await loaded(file));
  });
});
