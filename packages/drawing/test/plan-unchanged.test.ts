import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SceneDocument } from "@solstice/schema";
import { describe, expect, it } from "vitest";
import { planSvg } from "../src/plan.js";

/**
 * The sheet, byte for byte, on every level of the three scenes.
 *
 * Brief 75 pulled the wall and opening linework out of `planSvg` so the plan
 * view could draw the same marks. These fixtures were written by the code as
 * it stood **before** that extraction, so a refactor that changes one digit of
 * the sheet fails here rather than being argued for by inspection. A scene
 * edit legitimately changes them: rerun with `vitest -u` and review the diff
 * like any other drawing change.
 */
const scene = (id: string): SceneDocument =>
  SceneDocument.parse(
    JSON.parse(
      readFileSync(fileURLToPath(new URL(`../../../scenes/${id}.scene.json`, import.meta.url)), "utf8"),
    ),
  );

describe("the sheet is unchanged by the plan view's extraction", () => {
  for (const id of ["greenhollow", "elmsgate", "villa-carpathia"]) {
    const doc = scene(id);
    for (const level of doc.subject.levels) {
      it(`${id} · ${level.id}`, async () => {
        await expect(planSvg(doc, { levelId: level.id })).toMatchFileSnapshot(
          `./__snapshots__/plan-${id}-${level.id}.svg`,
        );
      });
    }
  }
});
