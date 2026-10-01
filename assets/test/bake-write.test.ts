import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BakeTargetError, impostorDir, writeImpostor } from "../bake/write.ts";
import { readManifest } from "../manifest.js";

/**
 * Where a bake lands, judged by whether the manifest then finds it.
 *
 * Asserting that the atlas exists somewhere proves nothing: the defect was that
 * it existed at `<source>/impostor/`, where the manifest reads a phantom asset
 * called `impostor` and the tree it was baked for has no impostor at all.
 */
let root: string;

/** A downloaded model, as `download.sh` leaves one. */
const model = async (id: string): Promise<void> => {
  await mkdir(join(root, id), { recursive: true });
  await writeFile(join(root, id, `${id.split("/")[1]}_2k.gltf`), "{}");
};

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "solstice-bake-"));
});
afterEach(async () => rm(root, { recursive: true, force: true }));

describe("a baked impostor", () => {
  it("is found by the manifest, on the asset it was baked for", async () => {
    await model("polyhaven/pine_tree_01");
    await writeImpostor(root, "polyhaven/pine_tree_01", Buffer.from("atlas"), '{"frames":8}');

    const manifest = await readManifest(root);
    expect(manifest.map((e) => e.id)).toEqual(["polyhaven/pine_tree_01"]);
    expect(manifest[0]?.impostor).toEqual({ atlas: "impostor/atlas.png", meta: "impostor/impostor.json" });
  });

  it("does not invent an asset called impostor", async () => {
    await model("polyhaven/pine_tree_01");
    await writeImpostor(root, "polyhaven/pine_tree_01", Buffer.from("atlas"), "{}");
    expect((await readManifest(root)).map((e) => e.id)).not.toContain("polyhaven/impostor");
  });

  it("leaves both atlases intact when two assets from one source are baked", async () => {
    await model("polyhaven/pine_tree_01");
    await model("polyhaven/fir_tree_01");
    await writeImpostor(root, "polyhaven/pine_tree_01", Buffer.from("pine"), "{}");
    await writeImpostor(root, "polyhaven/fir_tree_01", Buffer.from("fir"), "{}");

    expect(await readFile(join(root, "polyhaven/pine_tree_01/impostor/atlas.png"), "utf8")).toBe("pine");
    expect(await readFile(join(root, "polyhaven/fir_tree_01/impostor/atlas.png"), "utf8")).toBe("fir");
    expect((await readManifest(root)).filter((e) => e.impostor !== undefined)).toHaveLength(2);
  });

  it("is still refused outside the assets root", () => {
    for (const id of ["../../etc/passwd", "polyhaven/..", "/etc/passwd", "polyhaven"]) {
      expect(() => impostorDir(root, id), id).toThrow(BakeTargetError);
    }
  });
});
