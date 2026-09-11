import { afterEach, describe, expect, it, vi } from "vitest";
import { loadAssets } from "../src/engine/AssetLoader.js";

/**
 * Every failure here resolves to "no asset" rather than throwing, because a
 * production build has no `/assets-src` at all and the correct behaviour there
 * is the proxy, not a blank viewport. Four separate paths do that silently,
 * which is exactly why they need saying out loud.
 */
const respondWith = (impl: (url: string) => Response | Promise<Response>) =>
  vi.stubGlobal("fetch", (input: RequestInfo | URL) => Promise.resolve(impl(String(input))));

afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

describe("loadAssets", () => {
  it("yields an empty source when there is no index — the production case", async () => {
    respondWith(() => new Response("not found", { status: 404 }));
    const loaded = await loadAssets();
    expect(loaded.assets.get("polyhaven/anything")).toBeUndefined();
    expect(loaded.assets.impostor?.("polyhaven/anything")).toBeUndefined();
  });

  it("yields an empty source when the fetch itself throws", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    const loaded = await loadAssets();
    expect(loaded.assets.get("x/y")).toBeUndefined();
  });

  it("survives an index that lists a model which does not load", async () => {
    respondWith((url) =>
      url.endsWith("index.json")
        ? json({ models: [{ id: "a/b", path: "a/b/b.gltf" }] })
        : new Response("nope", { status: 500 }),
    );
    const loaded = await loadAssets();
    // Absent, so the generator falls back to its proxy rather than to nothing.
    expect(loaded.assets.get("a/b")).toBeUndefined();
  });

  it("survives an impostor whose metadata is missing", async () => {
    respondWith((url) =>
      url.endsWith("index.json")
        ? json({ impostors: [{ id: "a/t", atlas: "a/t/atlas.png", meta: "a/t/m.json" }] })
        : new Response("nope", { status: 404 }),
    );
    const loaded = await loadAssets();
    expect(loaded.assets.impostor?.("a/t")).toBeUndefined();
  });

  it("maps library textures onto the document's own material ids", async () => {
    // The document names materials by its ids; the library by `<source>/<slug>`.
    // This mapping is the only place that knows both, and getting it wrong shows
    // up as every surface silently staying its fallback colour.
    respondWith((url) => (url.endsWith("index.json") ? json({ materials: [] }) : new Response("", { status: 404 })));
    const loaded = await loadAssets();
    const source = loaded.materialsFor({
      materials: { wall: { label: "W", source: "polyhaven", slug: "clay_plaster" } },
    } as never);
    expect(source.maps("wall")).toBeUndefined();
    expect(source.maps("nonexistent")).toBeUndefined();
  });
});
