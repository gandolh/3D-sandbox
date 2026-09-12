import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { ASSET_ID, insideRoot } from "../bake/paths.js";

/**
 * The bake server writes files into the repo on an unauthenticated POST, with
 * the destination directory built from a form field. That makes these two
 * functions the whole of its security, and a traversal guard that has never
 * been run against `../` is a guard on paper.
 */
const ROOT = resolve("/srv/project/assets-src");

describe("what the bake server will accept as an asset id", () => {
  it("accepts a real manifest id", () => {
    for (const id of ["polyhaven/pine_tree_01", "ambientcg/Concrete034", "a1/b-2_3.x"]) {
      expect([id, ASSET_ID.test(id)]).toEqual([id, true]);
    }
  });

  it("rejects every way of leaving the directory", () => {
    for (const id of [
      "../../etc/passwd",
      "polyhaven/../../../etc/passwd",
      "..%2f..%2fetc%2fpasswd",
      "/etc/passwd",
      "polyhaven/..",
      "..",
      ".",
      "C:\\Windows\\system32",
      "polyhaven\\..\\..\\etc",
      "polyhaven/sub/dir",
      "",
      "polyhaven/",
      "/polyhaven/tree",
      "-leading/dash",
    ]) {
      expect([id, ASSET_ID.test(id)]).toEqual([id, false]);
    }
  });
});

describe("containment", () => {
  it("accepts the root and what is under it", () => {
    expect(insideRoot(ROOT, ROOT)).toBe(true);
    expect(insideRoot(ROOT, `${ROOT}/polyhaven/tree/impostor`)).toBe(true);
  });

  it("rejects a sibling whose name merely starts the same way", () => {
    // The bug a bare `startsWith` has: this directory is not inside the root,
    // and without the trailing separator the test says it is.
    expect(insideRoot(ROOT, `${ROOT}-evil/atlas.png`)).toBe(false);
    expect(insideRoot(ROOT, `${ROOT}x`)).toBe(false);
  });

  it("rejects a path that climbs back out", () => {
    expect(insideRoot(ROOT, `${ROOT}/../../etc/passwd`)).toBe(false);
    expect(insideRoot(ROOT, "/etc/passwd")).toBe(false);
  });
});
