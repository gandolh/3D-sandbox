import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { planSvg } from "@solstice/drawing";
import { loadScene, SceneDocument } from "@solstice/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { lintSceneFile, planSceneFile, sceneLintOptions } from "../src/index.ts";

const here = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));
const sceneFile = (id: string): string => here(`../../../scenes/${id}.scene.json`);
const greenhollow = sceneFile("greenhollow");
const broken = here("fixtures/opening-wider-than-wall.scene.json");

let tmp: string;
beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "scene-tools-"));
});
afterAll(async () => {
  await rm(tmp, { recursive: true, force: true });
});

const json = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8")) as unknown;

describe("sceneLintOptions", () => {
  it("arms both asset rules with the verified lists, downloaded or not", async () => {
    const { options, verified } = await sceneLintOptions();
    const list = (await json(here("../../../assets/verified.json"))) as {
      assets: string[];
      materials: string[];
    };
    expect(verified).toBe(list.assets.length);
    for (const id of list.assets) expect(options.knownAssets.has(id)).toBe(true);
    for (const id of list.materials) expect(options.knownMaterials.has(id)).toBe(true);
  });
});

describe("lintSceneFile", () => {
  it("lints a builder scene clean, with the findings the build reports", async () => {
    const result = await lintSceneFile(greenhollow);
    expect(result.kind).toBe("linted");
    if (result.kind !== "linted") return;
    expect(result.errors).toBe(0);
    expect(result.document?.id).toBe("greenhollow");

    const { options } = await sceneLintOptions();
    expect(result.findings).toEqual(loadScene(await json(greenhollow), options).findings);
  });

  it("names the error in a scene with an opening wider than its wall", async () => {
    const result = await lintSceneFile(broken);
    expect(result.kind).toBe("linted");
    if (result.kind !== "linted") return;
    expect(result.errors).toBe(1);
    expect(result.document).toBeUndefined();
    expect(result.findings[0]).toMatchObject({
      rule: "opening-fits-wall",
      severity: "error",
      path: "subject.levels[0].walls[0].openings[0]",
    });
  });

  it("catches an invented asset slug, so the real-asset list is in use", async () => {
    const doc = (await json(greenhollow)) as { subject: { placements: { asset: string }[] } };
    const placement = doc.subject.placements[0];
    if (placement === undefined) throw new Error("greenhollow has no placements to break");
    placement.asset = "polyhaven/no_such_bench";
    const path = join(tmp, "invented-asset.scene.json");
    await writeFile(path, JSON.stringify(doc), "utf8");

    const result = await lintSceneFile(path);
    expect(result.kind === "linted" && result.findings.map((f) => f.rule)).toContain("asset-resolves");
  });

  it("reports a wrong shape as schema findings, not as unreadable", async () => {
    const path = join(tmp, "wrong-shape.scene.json");
    await writeFile(path, JSON.stringify({ schemaVersion: 1, id: "x" }), "utf8");
    const result = await lintSceneFile(path);
    expect(result.kind).toBe("linted");
    expect(result.kind === "linted" && result.findings.every((f) => f.rule === "schema")).toBe(true);
    expect(result.kind === "linted" && result.errors).toBeGreaterThan(0);
  });

  it("returns why, without throwing, for a missing file and for a file that is not JSON", async () => {
    expect(await lintSceneFile(join(tmp, "absent.scene.json"))).toMatchObject({
      kind: "unreadable",
      reason: "no such file",
    });

    const path = join(tmp, "not-json.scene.json");
    await writeFile(path, "{ walls: [", "utf8");
    const result = await lintSceneFile(path);
    expect(result.kind).toBe("unreadable");
    expect(result.kind === "unreadable" && result.reason).toMatch(/^not JSON: /);
  });

  it("lints every committed scene without errors", async () => {
    for (const id of ["elmsgate", "greenhollow", "villa-carpathia"]) {
      const result = await lintSceneFile(sceneFile(id));
      expect(result.kind === "linted" && result.errors, id).toBe(0);
    }
  });
});

describe("planSceneFile", () => {
  it("draws the same plan as planSvg for the same scene", async () => {
    const result = await planSceneFile(greenhollow);
    expect(result.kind).toBe("plan");
    if (result.kind !== "plan") return;
    expect(result.svg).toBe(planSvg(SceneDocument.parse(await json(greenhollow))));
    expect(result.levelId).toBe(SceneDocument.parse(await json(greenhollow)).subject.levels[0]?.id);
  });

  it("draws the level asked for", async () => {
    const doc = SceneDocument.parse(await json(sceneFile("elmsgate")));
    const upper = doc.subject.levels[1];
    if (upper === undefined) throw new Error("elmsgate has one level");
    const result = await planSceneFile(sceneFile("elmsgate"), upper.id);
    expect(result).toMatchObject({ kind: "plan", levelId: upper.id });
    expect(result.kind === "plan" && result.svg).toBe(planSvg(doc, { levelId: upper.id }));
  });

  it("refuses a scene with lint errors, and gives them", async () => {
    const result = await planSceneFile(broken);
    expect(result.kind).toBe("refused");
    if (result.kind !== "refused") return;
    expect(result.reason).toBe("1 lint error; fix it first");
    expect(result.findings.map((f) => f.rule)).toEqual(["opening-fits-wall"]);
  });

  it("refuses a level the scene does not have, rather than drawing the first", async () => {
    const result = await planSceneFile(greenhollow, "attic");
    expect(result.kind).toBe("refused");
    expect(result.kind === "refused" && result.reason).toMatch(/^the scene has no level "attic"; its levels are /);
  });

  it("passes an unreadable file through", async () => {
    expect((await planSceneFile(join(tmp, "absent.scene.json"))).kind).toBe("unreadable");
  });
});
