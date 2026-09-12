import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { loadAssets } from "../src/engine/AssetLoader.js";

/**
 * Every failure here resolves to "no asset" rather than throwing, because a
 * production build has no `/assets-src` at all and the correct behaviour there
 * is the proxy, not a blank viewport. Four separate paths do that silently,
 * which is exactly why they need saying out loud.
 */
const respondWith = (impl: (url: string) => Response | Promise<Response>) =>
  vi.stubGlobal("fetch", (input: RequestInfo | URL) => Promise.resolve(impl(String(input))));

afterEach(() => {
  vi.unstubAllGlobals();
  // Spies too: a stubbed loader left standing would quietly make a later test
  // pass for the wrong reason.
  vi.restoreAllMocks();
});

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

/**
 * One library, many documents.
 *
 * Everything the library holds is keyed by its own `<source>/<slug>` names and
 * downloaded once. Everything a *document* needs is keyed by that document's
 * ids. Conflating the two is what made every scene after the first render
 * untextured and unphysical: the mapping was built when the download landed,
 * against whichever scene was open at that moment, and then reused forever.
 *
 * So the property under test is not "the mapping is right" but "the mapping is
 * a function of the document you pass, and stays one".
 */
describe("the library outlives any one document", () => {
  const stubLoaders = () => {
    vi.spyOn(THREE.TextureLoader.prototype, "loadAsync").mockImplementation(async () =>
      Promise.resolve(new THREE.Texture()),
    );
    const scene = new THREE.Scene();
    // 1.2 x 0.75 x 0.8: a table, so a wrong size is recognisable as one.
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.75, 0.8)));
    vi.spyOn(GLTFLoader.prototype, "loadAsync").mockImplementation(
      async () => Promise.resolve({ scene }) as never,
    );
  };

  const docWith = (materials: Record<string, { source: string; slug: string }>) =>
    ({
      materials: Object.fromEntries(
        Object.entries(materials).map(([id, m]) => [id, { label: id, ...m }]),
      ),
    }) as never;

  it("resolves each document's own material ids against the same library", async () => {
    stubLoaders();
    respondWith((url) =>
      url.endsWith("index.json")
        ? json({ materials: [{ id: "polyhaven/clay_plaster", maps: { map: "p.png" } }] })
        : new Response("", { status: 404 }),
    );
    const loaded = await loadAssets();

    // Greenhollow's name for it, then Elmsgate's. Both must resolve, in either
    // order, from the one library — and neither document's ids may leak into
    // the other's lookup.
    const first = loaded.materialsFor(
      docWith({ "plaster-lime": { source: "polyhaven", slug: "clay_plaster" } }),
    );
    const second = loaded.materialsFor(
      docWith({ "render-stucco": { source: "polyhaven", slug: "clay_plaster" } }),
    );

    expect(first.maps("plaster-lime")).toBeDefined();
    expect(second.maps("render-stucco")).toBeDefined();
    expect(second.maps("plaster-lime")).toBeUndefined();
    // And the first view is unchanged by the second having been taken.
    expect(first.maps("plaster-lime")).toBeDefined();
    expect(first.maps("render-stucco")).toBeUndefined();
  });

  it("reports every loaded model's size, not one document's slice", async () => {
    stubLoaders();
    respondWith((url) =>
      url.endsWith("index.json")
        ? json({
            models: [
              { id: "a/table", path: "a/table.gltf" },
              { id: "a/bench", path: "a/bench.gltf" },
            ],
          })
        : new Response("", { status: 404 }),
    );
    const loaded = await loadAssets();

    // `deriveColliders` skips any placement whose size it does not know. A
    // table filtered to one scene's placements is how a later scene's bench
    // ended up with no collider at all — no overlay box, and drop-to-rest
    // falling through the terrain.
    expect([...loaded.sizes.keys()].sort()).toEqual(["a/bench", "a/table"]);
    expect(loaded.sizes.get("a/bench")?.map((n) => Number(n.toFixed(3)))).toEqual([1.2, 0.75, 0.8]);
  });
});
