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
import { mkdir, readFile, readdir, stat, writeFile, chmod } from "node:fs/promises";
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
  bytes: number;
}

/**
 * Above this, an asset is not fetched by default.
 *
 * Poly Haven's photoreal vegetation is mesh-heavy beyond anything the two-tier
 * decision anticipated: `pine_tree_01.bin` is **905 MB** — every needle —
 * against 2.7 MB for an armchair. The wiki's estimate of "50–200k triangles for
 * a photoreal tree" is out by about two orders of magnitude.
 *
 * Instancing does not save you here: a 905 MB mesh is 905 MB whether it appears
 * once or 284 times, and it has to reach the GPU and get a BVH built over it
 * either way. These need decimating to a scatter LOD before they are usable,
 * which is its own brief — so the script lists them, loudly, and does not pull
 * them.
 */
const HEAVY_BYTES = 50 * 1024 * 1024;

const totalBytes = (d: Download[]): number => d.reduce((n, f) => n + f.bytes, 0);

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
    const gltf = (files["gltf"] as Record<string, { gltf?: { url?: string; size?: number; include?: Record<string, { url?: string; size?: number }> } }> | undefined)?.[RES]?.gltf;
    if (gltf?.url === undefined) return { ...w, ok: false, downloads: [], note: `no ${RES} glTF` };
    downloads.push({ url: gltf.url, target: `${w.slug}_${RES}.gltf`, bytes: gltf.size ?? 0 });
    // A glTF is useless without the images it names — or its .bin.
    for (const [rel, file] of Object.entries(gltf.include ?? {})) {
      if (file.url !== undefined) {
        downloads.push({ url: file.url, target: rel, bytes: file.size ?? 0 });
      }
    }
  } else {
    for (const map of PH_MAPS) {
      const entry = (files[map] as Record<string, Record<string, { url?: string; size?: number }>> | undefined)?.[RES]?.["jpg"];
      if (entry?.url !== undefined) {
        downloads.push({
          url: entry.url,
          target: entry.url.split("/").pop() ?? `${map}.jpg`,
          bytes: entry.size ?? 0,
        });
      }
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
    //
    // `pick.size` is reported by the API and was simply never read: every
    // ambientCG download carried a hardcoded `bytes: 0`. `totalBytes` was
    // therefore 0, which is always `<= HEAVY_BYTES`, so **the heavy-asset split
    // silently did not apply to this source at all** — the mechanism that keeps
    // the 900 MB pine tree out of the default download was not running for one
    // entire source. `DOWNLOADS.md` printed "—" for those rows, which reads as
    // "small" rather than as "unknown".
    downloads: [
      {
        url: pick.downloadLink,
        target: `${w.slug}_${RES.toUpperCase()}-JPG.zip`,
        bytes: pick.size ?? 0,
      },
    ],
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
const heavy = resolved.filter((r) => r.ok && totalBytes(r.downloads) > HEAVY_BYTES);
const fetchable = resolved.filter((r) => r.ok && totalBytes(r.downloads) <= HEAVY_BYTES);
/**
 * A size, or a warning that there is none.
 *
 * Never "—". An unknown size is not a small one, and printing a dash for it is
 * what let a whole source sit outside the heavy-asset split without anyone
 * noticing. If this string ever appears, the resolver for that source has
 * stopped reporting a size and the split has stopped protecting it.
 */
const bytes = (n: number): string =>
  n === 0 ? "**size unknown**" : `${(n / 1024 / 1024).toFixed(1)} MB`;

const rows = resolved
  .map((r) => {
    const size = r.ok ? bytes(totalBytes(r.downloads)) : "";
    const state = r.ok
      ? totalBytes(r.downloads) > HEAVY_BYTES
        ? `**too heavy** — ${size}`
        : `${r.downloads.length} file(s), ${size}`
      : `**${r.note}**`;
    return `| \`${r.source}/${r.slug}\` | ${r.kind} | ${state} | ${[...r.usedBy].join(", ")} |`;
  })
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

## Too heavy to fetch by default

${
  heavy.length === 0
    ? "None."
    : `Poly Haven's photoreal vegetation carries far more mesh than the two-tier
decision anticipated — the wiki's "50–200k triangles for a photoreal tree" is out
by about two orders of magnitude.

${heavy.map((h) => `- \`${h.source}/${h.slug}\` — **${bytes(totalBytes(h.downloads))}**, of which ${bytes(totalBytes(h.downloads.filter((d) => d.target.endsWith(".bin"))))} is mesh`).join("\n")}

Instancing does not help: a 905 MB mesh is 905 MB whether it appears once or 284
times, and a BVH has to be built over it either way. These want decimating to a
scatter LOD first. \`download.sh\` skips them; \`download-heavy.sh\` fetches them
if you want the originals to decimate from.`
}

Fetched by \`download.sh\`: **${bytes(fetchable.reduce((n, r) => n + totalBytes(r.downloads), 0))}** across ${fetchable.length} assets.
`,
);

/**
 * The one download helper both scripts use.
 *
 * Three things, and each earns its place:
 *
 * 1. **`.part`, then `mv`.** `curl -fsSL -o "$target"` writes in place, and the
 *    only check was `[ -f "$target" ]` — so a transfer cut off mid-stream left
 *    a truncated `.gltf` on disk, and because the file now *existed*, every
 *    future run skipped it **forever**. The scene then loaded broken geometry
 *    with nothing surfacing an error: `assets/manifest.ts` checks a file is
 *    present, never that it is valid. This project has already shipped a 404
 *    page saved as a model once.
 *
 *    `curl -f` does not cover this: it guards against an HTTP error *response*,
 *    not against a connection dropping mid-body.
 *
 * 2. **Size check where the source reports one.** Poly Haven and ambientCG both
 *    do. A file that arrives the wrong length is deleted rather than kept, so
 *    the next run retries instead of inheriting the corruption.
 *
 * 3. **A plausibility floor for what is already there.** A `.gltf` of 300 bytes
 *    or a `.jpg` of 1 KB is the shape of an error page, and an existing file is
 *    otherwise never looked at again.
 */
const HELPERS = String.raw`
fetch_one() {                                 # url target expected_bytes
  local url="$1" target="$2" want="$3" got

  if [ -f "$target" ]; then
    got=$(wc -c < "$target")
    if [ "$want" -gt 0 ] && [ "$got" -ne "$want" ]; then
      echo "  ! $target is $got bytes, expected $want — refetching" >&2
      rm -f "$target"
    elif [ "$got" -lt 512 ]; then
      echo "  ! $target is only $got bytes — suspiciously small, refetching" >&2
      rm -f "$target"
    else
      return 0
    fi
  fi

  # Never onto the target itself: an interrupted transfer must not leave
  # something the existence check above will accept for the rest of time.
  curl -fsSL -o "$target.part" "$url"
  got=$(wc -c < "$target.part")
  if [ "$want" -gt 0 ] && [ "$got" -ne "$want" ]; then
    rm -f "$target.part"
    echo "  ✗ $target: got $got bytes, expected $want" >&2
    return 1
  fi
  mv "$target.part" "$target"
}
`;

const script = [
  "#!/usr/bin/env bash",
  "# Generated by `node assets/download-list.ts`. Re-run that, not this, to update.",
  "set -euo pipefail",
  'cd "$(dirname "$0")"',
  HELPERS,
  "",
  ...fetchable.flatMap((r) => {
    const dir = `${r.source}/${r.slug}`;
    const lines = [`echo "→ ${dir}"`, `mkdir -p "${dir}"`];
    for (const d of r.downloads) {
      const target = `${dir}/${d.target}`;
      const sub = d.target.includes("/") ? `mkdir -p "${dir}/${d.target.replace(/\/[^/]+$/, "")}"` : null;
      if (sub !== null) lines.push(sub);
      lines.push(`fetch_one "${d.url}" "${target}" ${d.bytes}`);
      if (d.target.endsWith(".zip")) {
        lines.push(`unzip -oq "${target}" -d "${dir}" && rm "${target}"`);
        // ambientCG ships a whole DCC bundle in every zip. Keep the maps a
        // renderer can use and drop the rest: `.blend`/`.usdc`/`.mtlx`/`.tres`
        // are for other tools, the bare `.png` is a catalogue thumbnail, and
        // `NormalDX` is the DirectX-convention normal map — three.js wants the
        // OpenGL one, and carrying both doubles the largest file in the set.
        lines.push(
          `find "${dir}" -type f \\( -name '*.blend' -o -name '*.usdc' -o -name '*.mtlx' -o -name '*.tres' -o -name '*NormalDX*' -o -name '${r.slug}.png' \\) -delete`,
        );
      }
    }
    return [...lines, ""];
  }),
  ...missing.map((m) => `# UNRESOLVED ${m.source}/${m.slug} — ${m.note}`),
  ...heavy.map(
    (h) => `# SKIPPED ${h.source}/${h.slug} — ${bytes(totalBytes(h.downloads))}, see download-heavy.sh`,
  ),
  'echo "done — now run: npm run check"',
  "",
].join("\n");

await writeFile(join(outDir, "download.sh"), script);
await chmod(join(outDir, "download.sh"), 0o755);

const heavyScript = [
  "#!/usr/bin/env bash",
  "# The assets `download.sh` skips for size. Generated — re-run `npm run assets`.",
  "# These are decimation *sources*, not things to commit: see DOWNLOADS.md.",
  "set -euo pipefail",
  'cd "$(dirname "$0")"',
  HELPERS,
  "",
  ...heavy.flatMap((r) => {
    const dir = `${r.source}/${r.slug}`;
    const lines = [`echo "→ ${dir}  (${bytes(totalBytes(r.downloads))})"`, `mkdir -p "${dir}"`];
    for (const d of r.downloads) {
      const target = `${dir}/${d.target}`;
      if (d.target.includes("/")) {
        lines.push(`mkdir -p "${dir}/${d.target.replace(/\/[^/]+$/, "")}"`);
      }
      lines.push(`fetch_one "${d.url}" "${target}" ${d.bytes}`);
    }
    return [...lines, ""];
  }),
  "",
].join("\n");

await writeFile(join(outDir, "download-heavy.sh"), heavyScript);
await chmod(join(outDir, "download-heavy.sh"), 0o755);

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

/**
 * What is already on disk, and whether it is plausible.
 *
 * Nothing else looks. `download.sh` skips a file that exists, and
 * `assets/manifest.ts` checks a file is *present*, never that it is valid — so
 * a truncated model or a saved error page sits there indefinitely and the scene
 * loads broken geometry with no error anywhere. `fetch_one` now refuses to
 * create one; this is the sweep for the ones created before it existed.
 *
 * Two kinds of suspicion, and only ever reported — this script's job is to say
 * what to download, and deleting someone's assets is not its call.
 */
const SUSPICIOUS_BELOW = 512;
const suspect: string[] = [];
for (const r of resolved) {
  for (const d of r.downloads) {
    const path = join(outDir, `${r.source}/${r.slug}`, d.target);
    let size: number;
    try {
      size = (await stat(path)).size;
    } catch {
      continue; // Not downloaded. That is `DOWNLOADS.md`'s business, not this.
    }
    if (d.bytes > 0 && size !== d.bytes) {
      suspect.push(`${r.source}/${r.slug}/${d.target} — ${size} bytes on disk, source says ${d.bytes}`);
    } else if (size < SUSPICIOUS_BELOW) {
      suspect.push(`${r.source}/${r.slug}/${d.target} — only ${size} bytes`);
    }
  }
}

const totalFiles = resolved.reduce((n, r) => n + r.downloads.length, 0);
console.log(
  `${resolved.length} assets referenced · ${totalFiles} files to fetch · ${missing.length} unresolved`,
);
for (const m of missing) console.error(`  ✗ ${m.source}/${m.slug} — ${m.note}`);
for (const line of suspect) console.error(`  ! ${line} — delete it and re-run download.sh`);
if (suspect.length > 0) {
  console.error(
    `  ${suspect.length} file(s) on disk look wrong. A file that exists is never re-fetched, and nothing downstream checks it is valid.`,
  );
}
if (missing.length > 0) process.exitCode = 1;
void bytes;
