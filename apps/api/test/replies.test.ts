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

const read = async (file: string) => JSON.parse(await readFile(join(SCENES, file), "utf8")) as Record<string, unknown>;
const loaded = async (file: string) => JSON.stringify(loadScene(await read(file)).document);

describe("the scene replies through their response schemas", () => {
  it("cover the three scenes", () => {
    expect(FILES).toEqual(["elmsgate.scene.json", "greenhollow.scene.json", "villa-carpathia.scene.json"]);
  });

  it.each(FILES)("GET returns %s byte for byte", async (file) => {
    const res = await app.inject({ method: "GET", url: `/api/scenes/${file.replace(".scene.json", "")}` });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(await loaded(file));
  });

  it.each(FILES)("POST of a copy of %s returns the created document byte for byte", async (file) => {
    const copy = { ...(await read(file)), id: `copy-of-${file.replace(".scene.json", "")}` };
    const res = await app.inject({ method: "POST", url: "/api/scenes", payload: copy });
    expect(res.statusCode).toBe(201);
    expect(res.body).toBe(JSON.stringify(loadScene(copy).document));

    const again = await app.inject({ method: "POST", url: "/api/scenes", payload: copy });
    expect(again.statusCode).toBe(409);
    expect(again.body).toBe(JSON.stringify({ error: "exists", message: `Scene "${copy.id}" already exists` }));
  });

  it.each(FILES)("PUT of %s answers the saved summary, and a bad precondition 400", async (file) => {
    const id = file.replace(".scene.json", "");
    const document = await read(file);
    const bad = await app.inject({
      method: "PUT",
      url: `/api/scenes/${id}`,
      headers: { "x-scene-mtime": "yesterday" },
      payload: document,
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.body).toBe('{"error":"invalid_precondition","message":"x-scene-mtime must be a number"}');

    const res = await app.inject({ method: "PUT", url: `/api/scenes/${id}`, payload: document });
    expect(res.statusCode).toBe(200);
    const bytes = Buffer.byteLength(await readFile(join(SCENES, file)));
    expect(res.body).toBe(JSON.stringify({ ok: true, id, bytes, warnings: 0 }));
  });

  it.each(FILES)("DELETE of the copy of %s answers the id it removed", async (file) => {
    const id = `copy-of-${file.replace(".scene.json", "")}`;
    const res = await app.inject({ method: "DELETE", url: `/api/scenes/${id}` });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(JSON.stringify({ ok: true, id }));
  });
});
