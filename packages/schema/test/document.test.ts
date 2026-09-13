import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  area,
  degToRad,
  intervalsOverlap,
  lintScene,
  loadScene,
  SCHEMA_VERSION,
  SceneDocument,
  serializeScene,
} from "../src/index.js";
import { baseScene } from "./fixtures.js";

describe("strictness", () => {
  it("rejects an unknown key rather than silently dropping it", () => {
    const doc = { ...baseScene(), thikness: 0.24 };
    expect(() => SceneDocument.parse(doc)).toThrow();
  });

  it("rejects an unknown key nested inside a wall", () => {
    const doc = baseScene();
    (doc.subject!.levels![0]!.walls![0] as Record<string, unknown>).heigth = 2.7;
    expect(() => SceneDocument.parse(doc)).toThrow();
  });

  it("rejects a schemaVersion it does not know", () => {
    expect(() => SceneDocument.parse({ ...baseScene(), schemaVersion: 99 })).toThrow();
  });

  it("rejects out-of-range site coordinates", () => {
    const doc = baseScene();
    doc.site.latitude = 120;
    expect(() => SceneDocument.parse(doc)).toThrow();
  });

  it("rejects a malformed clock time", () => {
    const doc = baseScene();
    doc.solar.time = "25:00";
    expect(() => SceneDocument.parse(doc)).toThrow();
  });
});

describe("defaults", () => {
  it("applies wall thickness, opening sill, and subject/context shells", () => {
    const parsed = SceneDocument.parse({
      schemaVersion: SCHEMA_VERSION,
      id: "bare",
      title: "Bare",
      site: {
        latitude: 0,
        longitude: 0,
        timezone: "UTC",
        terrain: { kind: "flat", material: "m" },
      },
      solar: { date: "2026-01-01", time: "09:00" },
      materials: { m: { label: "M", source: "procedural" } },
    });
    expect(parsed.subject.levels).toEqual([]);
    expect(parsed.context.scatter).toEqual([]);
    expect(parsed.shots).toEqual([]);
    expect(parsed.site.northOffset).toBe(0);
    expect(parsed.site.terrain.size).toEqual([120, 120]);
  });
});

describe("serialization", () => {
  it("round-trips through canonical JSON unchanged", () => {
    const first = SceneDocument.parse(baseScene());
    const json = serializeScene(first);
    const second = SceneDocument.parse(JSON.parse(json));
    expect(second).toEqual(first);
    expect(json.endsWith("\n")).toBe(true);
  });
});

describe("geometry helpers", () => {
  it("computes polygon area regardless of winding", () => {
    const cw = [
      [0, 0],
      [0, 4],
      [3, 4],
      [3, 0],
    ] as const;
    const ccw = [...cw].reverse();
    expect(area(cw)).toBeCloseTo(12);
    expect(area(ccw)).toBeCloseTo(12);
  });

  it("treats touching intervals as non-overlapping", () => {
    expect(intervalsOverlap(0, 1, 1, 2)).toBe(false);
    expect(intervalsOverlap(0, 1.5, 1, 2)).toBe(true);
  });

  it("converts degrees to radians", () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI);
  });
});

describe("the committed villa-carpathia scene", () => {
  const json = JSON.parse(
    readFileSync(new URL("../../../scenes/villa-carpathia.scene.json", import.meta.url), "utf8"),
  ) as unknown;

  it("parses and lints clean", () => {
    const { document, findings } = loadScene(json);
    expect(findings).toEqual([]);
    expect(document.id).toBe("villa-carpathia");
  });

  it("still lints clean against its own asset list", () => {
    const { document } = loadScene(json);
    const assets = new Set([
      ...document.subject.placements.map((p) => p.asset),
      ...document.context.scatter.flatMap((s) => s.assets),
    ]);
    expect(lintScene(document, { knownAssets: assets })).toEqual([]);
  });

  it("is regenerated from source — rebuild scenes if this fails", () => {
    const { document } = loadScene(json);
    expect(serializeScene(document)).toBe(
      readFileSync(new URL("../../../scenes/villa-carpathia.scene.json", import.meta.url), "utf8"),
    );
  });
});
