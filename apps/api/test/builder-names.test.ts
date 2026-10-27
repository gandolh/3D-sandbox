import { readdir } from "node:fs/promises";
import { basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * `hasBuilder` looks for `src/<id>.ts`, and `scenes/build.ts` names what a
 * builder writes by its `document.id`. The two meet only if every builder's
 * file name is the id of the document it builds. Nothing else holds that, so
 * a builder renamed, or an id changed in one, would make the browser stop
 * warning before drawing in a scene the next build erases.
 */
const SRC = fileURLToPath(new URL("../../../scenes/src/", import.meta.url));

describe("every scene builder is named for the document it builds", async () => {
  const builders = (await readdir(SRC)).filter((f) => f.endsWith(".ts")).sort();

  it("finds the builders", () => {
    expect(builders.length).toBeGreaterThanOrEqual(3);
  });

  for (const file of builders) {
    it(file, async () => {
      const mod = (await import(pathToFileURL(`${SRC}${file}`).href)) as { default?: { id?: unknown } };
      expect(mod.default?.id).toBe(basename(file, ".ts"));
    });
  }
});
