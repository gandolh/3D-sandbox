/**
 * Compile authored scenes to canonical JSON.
 *
 * `src/*.ts` are authoring modules — they may use loops, constants and helpers.
 * This step evaluates them once, validates the result, and writes inert JSON
 * that the app and the API consume. Nothing downstream ever sees TypeScript.
 *
 * Run with plain `node build.ts`; Node 22.12+ strips the types itself.
 */
import { readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  SceneValidationError,
  formatFinding,
  loadScene,
  serializeScene,
} from "@solstice/schema";
import { knownAssets } from "../assets/manifest.ts";
import verified from "../assets/verified.json" with { type: "json" };

/**
 * What `asset-resolves` is checked against — and it is **always** checked
 * against something. Eight of Greenhollow's asset slugs were invented and
 * nothing caught them, because the rule had never been wired up at all; an
 * arming condition that can quietly evaluate to "off" would reintroduce exactly
 * that.
 *
 * Two states, both armed:
 *
 * - Nothing downloaded — the common case on a fresh clone and in CI. Checked
 *   against `assets/verified.json`, the committed list of slugs confirmed to
 *   exist at their source. Offline, so it cannot be skipped.
 * - Assets present. Checked against what is actually on disk, which is stricter:
 *   a scene may not name something that has not been fetched.
 */
const downloaded = await knownAssets();
const assets = downloaded.size > 0 ? downloaded : new Set(verified.assets);
console.log(
  downloaded.size > 0
    ? `  manifest: ${downloaded.size} assets downloaded in assets-src/`
    : `  manifest: nothing downloaded — checking against ${assets.size} verified slugs`,
);

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, "src");

const entries = (await readdir(srcDir)).filter((f) => f.endsWith(".ts")).sort();

if (entries.length === 0) {
  console.error(`No scene sources found in ${srcDir}`);
  process.exit(1);
}

let failed = 0;

for (const entry of entries) {
  const modulePath = pathToFileURL(resolve(srcDir, entry)).href;
  const mod: { default?: unknown } = await import(modulePath);

  if (mod.default === undefined) {
    console.error(`✗ ${entry}: no default export`);
    failed++;
    continue;
  }

  try {
    const { document, findings } = loadScene(mod.default, { knownAssets: assets });
    const out = join(here, `${document.id}.scene.json`);
    await writeFile(out, serializeScene(document), "utf8");

    const counts = {
      walls: document.subject.levels.reduce((n, l) => n + l.walls.length, 0),
      openings: document.subject.levels.reduce(
        (n, l) => n + l.walls.reduce((m, w) => m + w.openings.length, 0),
        0,
      ),
      shots: document.shots.length,
    };
    console.log(
      `✓ ${document.id}  ${counts.walls} walls, ${counts.openings} openings, ${counts.shots} shots  →  ${document.id}.scene.json`,
    );
    for (const f of findings) console.log(`    ${formatFinding(f)}`);
  } catch (error) {
    failed++;
    if (error instanceof SceneValidationError) {
      console.error(`✗ ${entry}`);
      for (const f of error.findings) console.error(`    ${formatFinding(f)}`);
    } else {
      console.error(`✗ ${entry}:`, error);
    }
  }
}

if (failed > 0) {
  console.error(`\n${failed} scene${failed === 1 ? "" : "s"} failed to build.`);
  process.exit(1);
}
