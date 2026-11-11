import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

/**
 * What the API answers when a request goes wrong before a route can explain itself: Fastify's own 4xx keep
 * their status, an unknown route gets the API's body, and an unanticipated failure is a 500 that is logged in
 * full and reported as a fact.
 */
const REFERENCE = new URL("../../../scenes/villa-carpathia.scene.json", import.meta.url);

let dir: string;
let app: FastifyInstance;
let logged: string[];

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "solstice-api-errors-"));
  logged = [];
  const logger = { level: "error", stream: { write: (line: string) => void logged.push(line) } };
  ({ app } = await buildApp(loadConfig({ scenesDir: dir, databasePath: ":memory:" }, {}), { server: { logger } }));
});

afterEach(async () => {
  await app.close();
  await rm(dir, { recursive: true, force: true });
});

const sendJson = (method: "POST" | "PUT", url: string, payload: string) =>
  app.inject({ method, url, headers: { "content-type": "application/json" }, payload });

describe("Fastify's own 4xx keep their status, and are not logged", () => {
  it("answers an empty JSON body with 400", async () => {
    const res = await sendJson("POST", "/api/scenes", "");
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "bad_request", message: expect.any(String) });
    expect(logged).toEqual([]);
  });

  it("answers malformed JSON with 400, on a create and on a replace", async () => {
    for (const [method, url] of [
      ["POST", "/api/scenes"],
      ["PUT", "/api/scenes/villa-carpathia"],
    ] as const) {
      const res = await sendJson(method, url, "{{{");
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: "bad_request", message: expect.any(String) });
    }
    expect(logged).toEqual([]);
  });

  it("answers a body over the 1 MiB limit with 413", async () => {
    const res = await sendJson("POST", "/api/scenes", JSON.stringify({ pad: "x".repeat(1_100_000) }));
    expect(res.statusCode).toBe(413);
    expect(res.json()).toEqual({ error: "too_large", message: expect.any(String) });
    expect(logged).toEqual([]);
  });
});

describe("the API's own answers", () => {
  it("answers an unknown route with a 404 in the API's body", async () => {
    const res = await app.inject({ method: "GET", url: "/api/nothing" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "not_found", message: "There is no route GET /api/nothing." });
  });

  it("answers an unsafe id on a replace with 400 invalid_id", async () => {
    const res = await sendJson("PUT", "/api/scenes/a.b", await readFile(REFERENCE, "utf8"));
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      error: "invalid_id",
      message: '"a.b" is not a valid scene id — letters, digits, hyphen and underscore only',
    });
  });
});

describe("an unanticipated failure", () => {
  it("answers 500 with a fixed message, and logs the detail it keeps from the client", async () => {
    // A create into a scenes directory that has gone: the existence check finds nothing, and the write fails
    // with an error naming the path.
    await rm(dir, { recursive: true, force: true });
    const document = { ...(JSON.parse(await readFile(REFERENCE, "utf8")) as object), id: "cabin" };
    const res = await sendJson("POST", "/api/scenes", JSON.stringify(document));
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "internal", message: "The API failed; its log says why." });
    expect(res.body).not.toContain(dir);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain("unhandled error");
    expect(logged[0]).toContain(dir);
  });
});
