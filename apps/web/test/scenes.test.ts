import { describe, expect, it } from "vitest";
import { SceneDocument, lintScene } from "@solstice/schema";
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
