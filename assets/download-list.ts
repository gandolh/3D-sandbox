/**
 * Emit the list of assets the scenes reference, and a script that fetches them.
 *
 * Downloads are done by hand, so the useful artefact is not a wiki page that
 * goes stale — it is a file generated from the scenes themselves, which cannot
 * disagree with them. Run it, read `assets-src/DOWNLOADS.md`, then run
 * `assets-src/download.sh`.
 *
 * Resolution is 2k throughout: `.gitignore` keeps 4k out of git, and 2k is what
 * a 1920×1080 render can actually resolve.
 */
import { mkdir, readFile, readdir, writeFile, chmod } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SceneDocument } from "@solstice/schema";

const here = dirname(fileURLToPath(import.meta.url));
const scenesDir = join(here, "..", "scenes");
const outDir = join(here, "..", "assets-src");

const RES = "2k";

interface Wanted {
  source: string;
  slug: string;
  kind: "model" | "material";
  usedBy: Set<string>;
}

/* ── what the scenes ask for ───────────────────────────────────── */

const wanted = new Map<string, Wanted>();
const want = (source: string, slug: string, kind: Wanted["kind"], scene: string): void => {
  const key = `${source}/${slug}`;
  const existing = wanted.get(key);
  if (existing !== undefined) {
    existing.usedBy.add(scene);
    return;
  }
  wanted.set(key, { source, slug, kind, usedBy: new Set([scene]) });
};

for (const file of (await readdir(scenesDir)).filter((f) => f.endsWith(".scene.json"))) {
  const doc = SceneDocument.parse(JSON.parse(await readFile(join(scenesDir, file), "utf8")));

  for (const placement of doc.subject.placements) {
    const [source, slug] = placement.asset.split("/");
    if (source !== undefined && slug !== undefined) want(source, slug, "model", doc.id);
  }
  for (const field of doc.context.scatter) {
    for (const asset of field.assets) {
      const [source, slug] = asset.split("/");
      if (source !== undefined && slug !== undefined) want(source, slug, "model", doc.id);
    }
  }
  for (const material of Object.values(doc.materials)) {
    // `procedural` is a colour, not a download.
    if (material.source === "procedural" || material.slug === undefined) continue;
    want(material.source, material.slug, "material", doc.id);
  }
}

/* ── resolve real URLs ─────────────────────────────────────────── */

interface Download {
  url: string;
  /** Path under `assets-src/<source>/<slug>/`. */
  target: string;
}

interface Resolved extends Wanted {
  ok: boolean;
  downloads: Download[];
  note?: string;
}

/** Poly Haven texture maps worth having. `arm` packs AO/roughness/metalness. */
const PH_MAPS = ["Diffuse", "nor_gl", "arm", "Displacement"];

async function resolvePolyHaven(w: Wanted): Promise<Resolved> {
  const response = await fetch(`https://api.polyhaven.com/files/${w.slug}`);
  if (!response.ok) {
    return { ...w, ok: false, downloads: [], note: `not found (HTTP ${response.status})` };
  }
  const files = (await response.json()) as Record<string, unknown>;
  const downloads: Download[] = [];

  if (w.kind === "model") {
    const gltf = (files["gltf"] as Record<string, { gltf?: { url?: string; include?: Record<string, { url?: string }> } }> | undefined)?.[RES]?.gltf;
    if (gltf?.url === undefined) return { ...w, ok: false, downloads: [], note: `no ${RES} glTF` };
    downloads.push({ url: gltf.url, target: `${w.slug}_${RES}.gltf` });
    // A glTF is useless without the images it names.
    for (const [rel, file] of Object.entries(gltf.include ?? {})) {
      if (file.url !== undefined) downloads.push({ url: file.url, target: rel });
    }
  } else {
    for (const map of PH_MAPS) {
      const url = (files[map] as Record<string, Record<string, { url?: string }>> | undefined)?.[RES]?.["jpg"]?.url;
      if (url !== undefined) downloads.push({ url, target: url.split("/").pop() ?? `${map}.jpg` });
    }
    if (downloads.length === 0) return { ...w, ok: false, downloads: [], note: `no ${RES} maps` };
  }
  return { ...w, ok: true, downloads };
}

async function resolveAmbientCg(w: Wanted): Promise<Resolved> {
  const response = await fetch(
    `https://ambientcg.com/api/v2/full_json?id=${w.slug}&include=downloadData`,
  );
  if (!response.ok) {
    return { ...w, ok: false, downloads: [], note: `not found (HTTP ${response.status})` };
  }
  const body = (await response.json()) as {
    foundAssets?: { downloadFolders?: Record<string, { downloadFiletypeCategories?: Record<string, { downloads?: { attribute?: string; downloadLink?: string }[] }> }> }[];
  };
  const zips =
    body.foundAssets?.[0]?.downloadFolders?.["default"]?.downloadFiletypeCategories?.["zip"]
      ?.downloads ?? [];
  const pick = zips.find((z) => z.attribute === `${RES.toUpperCase()}-JPG`);
  if (pick?.downloadLink === undefined) {
    return { ...w, ok: false, downloads: [], note: `no ${RES.toUpperCase()}-JPG zip` };
  }
  return {
    ...w,
    ok: true,
    // A zip, so the script has to unpack it — flagged by the extension.
    downloads: [{ url: pick.downloadLink, target: `${w.slug}_${RES.toUpperCase()}-JPG.zip` }],
  };
}

const resolved: Resolved[] = [];
for (const w of [...wanted.values()].sort((a, b) => `${a.source}/${a.slug}`.localeCompare(`${b.source}/${b.slug}`))) {
  if (w.source === "polyhaven") resolved.push(await resolvePolyHaven(w));
  else if (w.source === "ambientcg") resolved.push(await resolveAmbientCg(w));
  else resolved.push({ ...w, ok: false, downloads: [], note: `unknown source "${w.source}"` });
}

/* ── write the artefacts ───────────────────────────────────────── */

await mkdir(outDir, { recursive: true });

const missing = resolved.filter((r) => !r.ok);
const bytes = (n: number): string => `${(n / 1024 / 1024).toFixed(1)} MB`;

const rows = resolved
  .map(
    (r) =>
      `| \`${r.source}/${r.slug}\` | ${r.kind} | ${r.ok ? `${r.downloads.length} file(s)` : `**${r.note}**`} | ${[...r.usedBy].join(", ")} |`,
  )
  .join("\n");

await writeFile(
  join(outDir, "DOWNLOADS.md"),
  `# Assets to download

Generated by \`node assets/download-list.ts\` from the scenes themselves — do not
edit by hand, and do not treat it as a record of what is *present*. What is
present is whatever \`assets-src/\` contains; \`assets/manifest.ts\` reads that,
and \`npm run check\` fails when a scene names something missing.

All sources here are **CC0**. Resolution is ${RES}; 4k is gitignored.

Run \`bash assets-src/download.sh\` to fetch everything into place.

| Asset | Kind | Files | Used by |
|---|---|---|---|
${rows}

${missing.length === 0 ? "Every referenced asset resolved." : `## Unresolved\n\n${missing.map((m) => `- \`${m.source}/${m.slug}\` — ${m.note}`).join("\n")}\n\nThese must be fixed in the scene, not worked around here.`}
`,
);

const script = [
  "#!/usr/bin/env bash",
  "# Generated by `node assets/download-list.ts`. Re-run that, not this, to update.",
  "set -euo pipefail",
  'cd "$(dirname "$0")"',
  "",
  ...resolved.flatMap((r) => {
    if (!r.ok) return [`# SKIP ${r.source}/${r.slug} — ${r.note}`, ""];
    const dir = `${r.source}/${r.slug}`;
    const lines = [`echo "→ ${dir}"`, `mkdir -p "${dir}"`];
    for (const d of r.downloads) {
      const target = `${dir}/${d.target}`;
      const sub = d.target.includes("/") ? `mkdir -p "${dir}/${d.target.replace(/\/[^/]+$/, "")}"` : null;
      if (sub !== null) lines.push(sub);
      lines.push(`[ -f "${target}" ] || curl -fsSL -o "${target}" "${d.url}"`);
      if (d.target.endsWith(".zip")) {
        lines.push(`unzip -oq "${target}" -d "${dir}" && rm "${target}"`);
      }
    }
    return [...lines, ""];
  }),
  'echo "done — now run: npm run check"',
  "",
].join("\n");

await writeFile(join(outDir, "download.sh"), script);
await chmod(join(outDir, "download.sh"), 0o755);

/**
 * Slugs confirmed to exist at their source.
 *
 * Committed, and checked **offline** by the build. This is the layer that stops
 * invented slugs: verifying against the live API needs the network, and a check
 * that needs the network is a check that gets skipped. Regenerate this whenever
 * a scene names a new asset — which is exactly when you would run this script
 * anyway, to find out how to download it.
 */
await writeFile(
  join(here, "verified.json"),
  `${JSON.stringify(
    {
      note: "Generated by `node assets/download-list.ts`. Slugs confirmed to exist at source.",
      generated: new Date().toISOString().slice(0, 10),
      assets: resolved.filter((r) => r.ok && r.kind === "model").map((r) => `${r.source}/${r.slug}`),
      materials: resolved.filter((r) => r.ok && r.kind === "material").map((r) => `${r.source}/${r.slug}`),
    },
    null,
    2,
  )}\n`,
);

const totalFiles = resolved.reduce((n, r) => n + r.downloads.length, 0);
console.log(
  `${resolved.length} assets referenced · ${totalFiles} files to fetch · ${missing.length} unresolved`,
);
for (const m of missing) console.error(`  ✗ ${m.source}/${m.slug} — ${m.note}`);
if (missing.length > 0) process.exitCode = 1;
void bytes;
