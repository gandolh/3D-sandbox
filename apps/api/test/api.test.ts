import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { serializeScene } from "@solstice/schema";
import { buildApp } from "../src/app.js";
import type { SceneIndex } from "../src/store/index-db.js";

const REFERENCE = new URL("../../../scenes/villa-carpathia.scene.json", import.meta.url);

let dir: string;
let app: FastifyInstance;
let index: SceneIndex;
let reference: Record<string, unknown>;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "solstice-api-"));
  reference = JSON.parse(await readFile(REFERENCE, "utf8")) as Record<string, unknown>;
  await writeFile(join(dir, "villa-carpathia.scene.json"), serializeScene(reference as never), "utf8");
  ({ app, index } = await buildApp({ scenesDir: dir, databasePath: ":memory:" }));
});

afterEach(async () => {
  await app.close();
  await rm(dir, { recursive: true, force: true });
});

const get = (url: string) => app.inject({ method: "GET", url });

describe("health and listing", () => {
  it("reports the scenes it indexed at boot", async () => {
    const res = await get("/api/health");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, scenes: 1 });
  });

  it("summarises each scene without re-reading the file", async () => {
    const { scenes } = (await get("/api/scenes")).json() as { scenes: Array<Record<string, number | string>> };
    expect(scenes).toHaveLength(1);
    expect(scenes[0]).toMatchObject({
      id: "villa-carpathia",
      title: "Villa Carpathia",
      walls: 4,
      openings: 5,
      shots: 2,
      warnings: 0,
    });
  });
});

describe("reading a scene", () => {
  it("returns the parsed document", async () => {
    const res = await get("/api/scenes/villa-carpathia");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: "villa-carpathia", schemaVersion: 1 });
  });

  it("404s an unknown scene", async () => {
    expect((await get("/api/scenes/nope")).statusCode).toBe(404);
  });
});

describe("path traversal", () => {
  // The id becomes a filename. This is the security boundary, not a nicety.
  it.each(["..", "../secrets", "..%2Fsecrets", "a/b", "a.b", "-leading"])(
    "rejects %s",
    async (id) => {
      const res = await get(`/api/scenes/${id}`);
      expect([400, 404]).toContain(res.statusCode);
      expect(res.statusCode).not.toBe(200);
    },
  );

  it("rejects traversal on write too", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/scenes/..%2F..%2Fescape",
      payload: reference,
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});

describe("writing", () => {
  it("accepts a valid document and updates the index", async () => {
    const edited = structuredClone(reference) as Record<string, unknown>;
    (edited["title"] as unknown) = "Villa Carpathia II";

    const res = await app.inject({ method: "PUT", url: "/api/scenes/villa-carpathia", payload: edited });
    expect(res.statusCode).toBe(200);
    expect(index.get("villa-carpathia")?.title).toBe("Villa Carpathia II");

    const onDisk = JSON.parse(await readFile(join(dir, "villa-carpathia.scene.json"), "utf8")) as {
      title: string;
    };
    expect(onDisk.title).toBe("Villa Carpathia II");
  });

  it("refuses a document whose id disagrees with the route", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/scenes/villa-carpathia",
      payload: { ...reference, id: "something-else" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("leaves the file byte-identical when the document has errors", async () => {
    const path = join(dir, "villa-carpathia.scene.json");
    const before = await readFile(path, "utf8");

    const broken = structuredClone(reference) as never as {
      subject: { levels: Array<{ walls: Array<{ material: string }> }> };
    };
    broken.subject.levels[0]!.walls[0]!.material = "no-such-material";

    const res = await app.inject({ method: "PUT", url: "/api/scenes/villa-carpathia", payload: broken });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: "invalid_document" });
    expect((res.json() as { findings: unknown[] }).findings.length).toBeGreaterThan(0);

    expect(await readFile(path, "utf8")).toBe(before);
  });

  it("rejects a payload that is not a scene at all", async () => {
    const res = await app.inject({ method: "PUT", url: "/api/scenes/villa-carpathia", payload: { hello: 1 } });
    expect(res.statusCode).toBe(422);
  });

  it("creates a new scene and refuses to create it twice", async () => {
    const fresh = { ...structuredClone(reference), id: "cabin", title: "Cabin" };
    expect((await app.inject({ method: "POST", url: "/api/scenes", payload: fresh })).statusCode).toBe(201);
    expect((await app.inject({ method: "POST", url: "/api/scenes", payload: fresh })).statusCode).toBe(409);
  });
});

describe("deleting", () => {
  it("removes the file and the index row", async () => {
    expect((await app.inject({ method: "DELETE", url: "/api/scenes/villa-carpathia" })).statusCode).toBe(200);
    expect(index.get("villa-carpathia")).toBeNull();
    expect((await get("/api/scenes/villa-carpathia")).statusCode).toBe(404);
  });

  it("404s deleting something that is not there", async () => {
    expect((await app.inject({ method: "DELETE", url: "/api/scenes/ghost" })).statusCode).toBe(404);
  });
});

describe("the index is derived, not authoritative", () => {
  // The property the whole persistence design rests on: scenes are hand-edited
  // outside this service routinely, so a rescan has to catch up.
  it("picks up a file written behind the API's back", async () => {
    const smuggled = { ...structuredClone(reference), id: "smuggled", title: "Smuggled In" };
    await writeFile(join(dir, "smuggled.scene.json"), serializeScene(smuggled as never), "utf8");

    expect(index.get("smuggled")).toBeNull();

    const res = await app.inject({ method: "POST", url: "/api/reindex" });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { indexed: string[] }).indexed).toContain("smuggled");
    expect(index.get("smuggled")?.title).toBe("Smuggled In");
  });

  it("notices a file edited behind the API's back", async () => {
    const edited = { ...structuredClone(reference), title: "Edited By Hand" };
    await writeFile(join(dir, "villa-carpathia.scene.json"), serializeScene(edited as never), "utf8");

    await app.inject({ method: "POST", url: "/api/reindex" });
    expect(index.get("villa-carpathia")?.title).toBe("Edited By Hand");
  });

  it("drops a broken file from the index instead of failing the whole rescan", async () => {
    await writeFile(join(dir, "broken.scene.json"), "{ not json", "utf8");
    const res = await app.inject({ method: "POST", url: "/api/reindex" });
    const body = res.json() as { indexed: string[]; failed: string[] };
    expect(body.failed).toContain("broken");
    expect(body.indexed).toContain("villa-carpathia");
  });

  it("can be rebuilt from nothing", async () => {
    const rebuilt = await index.reindex(dir);
    expect(rebuilt.indexed).toEqual(["villa-carpathia"]);
  });
});
