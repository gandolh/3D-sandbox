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
  sceneCounts,
  scheduleOfAreas,
  serializeScene,
} from "@solstice/schema";
import { knownAssets } from "../assets/manifest.ts";
import verified from "../assets/verified.json" with { type: "json" };

/**
 * What `asset-resolves` is checked against: everything known to be **real**,
 * whether or not it is on this machine.
 *
 * The rule that matters is *this slug exists*. Eight of Greenhollow's were
 * invented and nothing caught them, because the rule had never been armed at
 * all. Whether a file has been fetched is a different question, and not one a
 * scene document can be wrong about.
 *
 * An earlier version made "downloaded" the stricter standard: if anything was
 * present, a scene could only name what was present. That is incoherent here,
 * because *not* downloading some assets is the designed state — Poly Haven's
 * three trees are 1.5 GB of mesh and `download.sh` deliberately skips them. The
 * strict rule and the heavy-asset split were written an hour apart and
 * contradicted each other; every build failed.
 *
 * A missing *file* is the generator's problem, and it already has an answer:
 * fall back to the proxy. A missing *asset* is the author's problem, and that
 * is what this catches.
 */
const downloaded = await knownAssets();
const assets = new Set([...verified.assets, ...downloaded]);
console.log(
  `  manifest: ${downloaded.size} downloaded, ${verified.assets.length} verified — ${assets.size} known`,
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

    const counts = sceneCounts(document);
    console.log(
      `✓ ${document.id}  ${counts.walls} walls, ${counts.openings} openings, ${counts.shots} shots  →  ${document.id}.scene.json`,
    );
    // The schedule is printed by the thing that computes it. Brief 46's areas
    // lived in a comment, worked out by hand and checked by nobody.
    const schedule = scheduleOfAreas(document);
    if (schedule.length > 0) {
      const total = schedule.reduce((n, r) => n + r.area, 0);
      const widest = Math.max(...schedule.map((r) => r.room.name.length));
      for (const { room, area } of schedule) {
        console.log(
          `    ${room.name.padEnd(widest)}  ${room.use.padEnd(7)} ${area.toFixed(1).padStart(6)} m²`,
        );
      }
      console.log(`    ${"".padEnd(widest)}  ${"total".padEnd(7)} ${total.toFixed(1).padStart(6)} m²`);
    }
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
