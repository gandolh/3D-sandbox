import { describe, expect, it } from "vitest";
import { SceneDocument } from "@solstice/schema";
import { translateEntity } from "../src/lib/entities.js";
import { DEFAULT_SCENE_ID, sceneById } from "../src/scenes.js";

/**
 * What the gizmo's drag is allowed to move.
 *
 * The bug this guards: the gizmo attaches to **any** selected mesh, because
 * `findMesh` matches `name.endsWith(":" + id)` and placements are named
 * `placement:<id>`. The handler searched only `level.walls`, so a furniture
 * drag matched nothing, changed nothing, and still bumped the revision — the
 * scene then rebuilt from the unchanged document and the chair snapped back,
 * silently.
 */
const fresh = () => SceneDocument.parse(sceneById(DEFAULT_SCENE_ID)!.json);

describe("translateEntity", () => {
  it("moves a placement across the ground and leaves its height alone", () => {
    const doc = fresh();
    const before = doc.subject.placements[0]!;
    const { id } = before;
    const [x, y, z] = before.position;

    expect(translateEntity(doc, id, 1.5, -2.25)).toBe(true);

    const after = doc.subject.placements.find((p) => p.id === id)!;
    expect(after.position[0]).toBeCloseTo(x + 1.5, 6);
    expect(after.position[2]).toBeCloseTo(z - 2.25, 6);
    // Y is `drop to floor`'s business. A lateral drag that also changed height
    // would put the one control that knows about collisions in a fight with the
    // one that does not.
    expect(after.position[1]).toBe(y);
  });

  it("moves a wall by both endpoints", () => {
    const doc = fresh();
    const wall = doc.subject.levels[0]!.walls[0]!;
    const start = [...wall.start] as [number, number];
    const end = [...wall.end] as [number, number];

    expect(translateEntity(doc, wall.id, 0.4, 0.9)).toBe(true);
    expect(wall.start).toEqual([start[0] + 0.4, start[1] + 0.9]);
    expect(wall.end).toEqual([end[0] + 0.4, end[1] + 0.9]);
  });

  it("refuses an id it cannot move, rather than reporting success", () => {
    // The whole failure mode: returning nothing and returning "done" used to be
    // the same thing.
    const doc = fresh();
    expect(translateEntity(doc, "no-such-entity", 1, 1)).toBe(false);
  });

  it("refuses a roof, which is positioned by its footprint and not by a point", () => {
    const doc = fresh();
    const roof = doc.subject.roofs[0]!;
    const footprint = JSON.stringify(roof.footprint);
    expect(translateEntity(doc, roof.id, 1, 1)).toBe(false);
    expect(JSON.stringify(roof.footprint)).toBe(footprint);
  });

  it("touches nothing but the entity it names", () => {
    const doc = fresh();
    const target = doc.subject.placements[0]!.id;
    const others = doc.subject.placements
      .filter((p) => p.id !== target)
      .map((p) => JSON.stringify(p.position));

    translateEntity(doc, target, 3, 3);

    expect(
      doc.subject.placements.filter((p) => p.id !== target).map((p) => JSON.stringify(p.position)),
    ).toEqual(others);
  });
});
