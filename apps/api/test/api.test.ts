import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serializeScene } from "@solstice/schema";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
    const { scenes } = (await get("/api/scenes")).json() as {
      scenes: Array<Record<string, number | string>>;
    };
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
  it.each(["..", "../secrets", "..%2Fsecrets", "a/b", "a.b", "-leading"])("rejects %s", async (id) => {
    const res = await get(`/api/scenes/${id}`);
    expect([400, 404]).toContain(res.statusCode);
    expect(res.statusCode).not.toBe(200);
  });

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
    (edited.title as unknown) = "Villa Carpathia II";

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
    const res = await app.inject({
      method: "PUT",
      url: "/api/scenes/villa-carpathia",
      payload: { hello: 1 },
    });
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

/**
 * Who may call this API, and what it says when it fails.
 *
 * The service is deliberately unauthenticated and bound to loopback, which is a
 * settled decision and fine. What was not fine was `origin: true` on top of it:
 * that reflects the caller's own origin back, which is not a relaxed CORS
 * setting but the removal of the browser's same-origin protection. Any page in
 * any tab could read every scene on the machine and delete them.
 */
describe("the cross-origin boundary", () => {
  const preflight = (origin: string) =>
    app.inject({
      method: "OPTIONS",
      url: "/api/scenes",
      headers: { origin, "access-control-request-method": "DELETE" },
    });

  it("lets the dev client through", async () => {
    const res = await preflight("http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("does not reflect a foreign origin", async () => {
    const res = await preflight("https://evil.example");
    // The absence is the whole assertion: with no allow-origin header the
    // browser refuses to hand the response to the calling page.
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("keeps a 500's detail out of the response", async () => {
    // Deleting the scenes directory out from under a running app is the
    // cheapest way to reach the unanticipated-failure branch. Whatever comes
    // back must not carry a filesystem path.
    await rm(dir, { recursive: true, force: true });
    const res = await app.inject({
      method: "PUT",
      url: "/api/scenes/villa-carpathia",
      payload: reference,
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.json())).not.toContain(dir);
  });

  it("does not publish the scenes directory on the health check", async () => {
    expect(JSON.stringify((await get("/api/health")).json())).not.toContain(dir);
  });
});

/**
 * Writing a scene must not be able to destroy one.
 *
 * Two separate promises: a write either lands whole or not at all, and a write
 * built on a stale read is refused rather than silently winning.
 */
describe("writing a scene", () => {
  const read = () => app.inject({ method: "GET", url: "/api/scenes/villa-carpathia" });

  it("hands out the version the caller is holding", async () => {
    const res = await read();
    expect(Number(res.headers["x-scene-mtime"])).toBeGreaterThan(0);
  });

  it("refuses a write built on a stale read", async () => {
    const before = await read();
    const stale = Number(before.headers["x-scene-mtime"]);

    // Someone else saves in the meantime.
    const meanwhile = { ...reference, title: "Changed by someone else" };
    await app.inject({ method: "PUT", url: "/api/scenes/villa-carpathia", payload: meanwhile });

    const res = await app.inject({
      method: "PUT",
      url: "/api/scenes/villa-carpathia",
      headers: { "x-scene-mtime": String(stale) },
      payload: { ...reference, title: "Would have clobbered it" },
    });
    expect(res.statusCode).toBe(409);

    // And it changed nothing: the other person's title is still on disk.
    const after = await read();
    expect((after.json() as { title: string }).title).toBe("Changed by someone else");
  });

  it("accepts a write that carries the current version", async () => {
    const before = await read();
    const res = await app.inject({
      method: "PUT",
      url: "/api/scenes/villa-carpathia",
      headers: { "x-scene-mtime": String(before.headers["x-scene-mtime"]) },
      payload: { ...reference, title: "Edited" },
    });
    expect(res.statusCode).toBe(200);
    expect(((await read()).json() as { title: string }).title).toBe("Edited");
  });

  it("does not create a scene through PUT", async () => {
    // A typo'd id used to write a second scene beside the one being edited,
    // and the index listed it. Creation has exactly one door, and it is POST.
    const res = await app.inject({
      method: "PUT",
      url: "/api/scenes/villa-carpthia",
      payload: { ...reference, id: "villa-carpthia" },
    });
    expect(res.statusCode).toBe(404);
    expect(await readdir(dir)).not.toContain("villa-carpthia.scene.json");
  });

  it("leaves no temp files beside the scenes", async () => {
    // The atomic write puts its temp file in the same directory on purpose —
    // rename is only atomic within a filesystem — so it has to clean up after
    // itself or the index would start scanning half-written documents.
    await app.inject({ method: "PUT", url: "/api/scenes/villa-carpathia", payload: reference });
    expect((await readdir(dir)).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });
});
