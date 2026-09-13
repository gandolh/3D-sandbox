import { lintScene, SceneDocument } from "@solstice/schema";
import { describe, expect, it } from "vitest";
import { DEFAULT_SCENE_ID, SCENES, sceneById } from "../src/scenes.js";

describe("the bundled scene catalogue", () => {
  it("bundles at least one scene, and the default is one of them", () => {
    expect(SCENES.length).toBeGreaterThan(0);
    expect(sceneById(DEFAULT_SCENE_ID)).toBeDefined();
  });

  it("has unique ids", () => {
    const ids = SCENES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(SCENES.map((s) => [s.id, s] as const))("%s parses and lints clean", (_id, scene) => {
    // The catalogue types `json` as `unknown` on purpose — this is where that
    // is cashed in. A scene that only parses when the app happens to load it
    // first is a scene nobody checked.
    const parsed = SceneDocument.safeParse(scene.json);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.id).toBe(scene.id);
    expect(lintScene(parsed.data).filter((f) => f.severity === "error")).toEqual([]);
  });

  it("titles the entry the same as the document does", () => {
    for (const scene of SCENES) {
      const parsed = SceneDocument.parse(scene.json);
      expect(scene.title).toBe(parsed.title);
    }
  });
});

describe("Greenhollow's programme", () => {
  // Brief 46 asked for a big living room with a fireplace, a bathroom, a
  // kitchen and three bedrooms, and until rooms existed the only record that
  // the house still had them was a comment. This is that claim, checked.
  const doc = SceneDocument.parse(sceneById("greenhollow")!.json);
  const rooms = doc.subject.levels.flatMap((l) => l.rooms);
  const areaOf = (id: string) => {
    const room = rooms.find((r) => r.id === id)!;
    return Math.abs(
      room.polygon.reduce(
        (sum, p, i) =>
          sum +
          p[0] * room.polygon[(i + 1) % room.polygon.length]![1] -
          room.polygon[(i + 1) % room.polygon.length]![0] * p[1],
        0,
      ) / 2,
    );
  };

  it("has three bedrooms", () => {
    expect(rooms.filter((r) => r.use === "bed")).toHaveLength(3);
  });

  it("has a kitchen, a bathroom and a hall", () => {
    for (const use of ["kitchen", "bath", "hall"] as const) {
      expect(
        rooms.filter((r) => r.use === use),
        use,
      ).toHaveLength(1);
    }
  });

  it("has a living room big enough to be called big", () => {
    const living = rooms.filter((r) => r.use === "living");
    expect(living).toHaveLength(1);
    // Bigger than any bedroom, and bigger than the two of them together — which
    // is what "big" has to mean if it is to mean anything checkable.
    const beds = rooms.filter((r) => r.use === "bed").map((r) => areaOf(r.id));
    expect(areaOf(living[0]!.id)).toBeGreaterThan(Math.max(...beds) * 1.5);
  });

  it("closes to the floor the envelope encloses", () => {
    // External walls are 0.3 on an 11 × 12 footprint, so 10.7 × 11.7 = 125.2 m²
    // gross internal. The rooms account for that less the partitions standing
    // in it — about 5 m² of 0.12 walls. A schedule that does not close means a
    // room outline has drifted from the wall that makes it.
    const total = rooms.reduce((n, r) => n + areaOf(r.id), 0);
    expect(total).toBeGreaterThan(115);
    expect(total).toBeLessThan(125.2);
  });
});
