/**
 * The lint options a scene file is checked against, wherever it is checked
 * from: `npm run scenes`, the CLI, and anything later that wants the same
 * answer. One copy, so the build and the CLI report the same findings for the
 * same file.
 *
 * The asset lists live in `assets/`, outside the workspaces, and are reached
 * where they are rather than copied. That is why this package ships its source
 * and runs under Node's type-stripping, as `scenes/build.ts` does, instead of
 * compiling to `dist/` like the other packages: a compiled package cannot
 * import a file outside its own `src/`.
 */
import { knownAssets } from "../../../assets/manifest.ts";
import verified from "../../../assets/verified.json" with { type: "json" };

export interface SceneLintOptions {
  /** What `loadScene` is given. Both lists are always set, so both rules are armed. */
  options: { knownAssets: ReadonlySet<string>; knownMaterials: ReadonlySet<string> };
  /** Asset directories found under `assets-src/` on this machine. */
  downloaded: number;
  /** Asset slugs `assets/verified.json` confirms exist at source. */
  verified: number;
}

/**
 * Read the asset lists and build the options.
 *
 * **`knownAssets`**, for `asset-resolves`, is everything known to be **real**,
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
 *
 * **`knownMaterials`** is the same, for `material-slug-resolves`. The manifest
 * does not tell models from materials, so `downloaded` is shared; a material
 * slug that only exists as a model directory is not a case worth a second
 * scan. A scene that adds a material fails here until `npm run assets` has
 * verified it, which is how `ambientcg/PavingStones137` went missing from
 * `verified.json` unnoticed.
 *
 * Read on every call, not cached: `assets-src/` changes when assets are
 * downloaded, and a long-running caller should see that.
 */
export async function sceneLintOptions(): Promise<SceneLintOptions> {
  const downloaded = await knownAssets();
  return {
    options: {
      knownAssets: new Set([...verified.assets, ...downloaded]),
      knownMaterials: new Set([...verified.materials, ...downloaded]),
    },
    downloaded: downloaded.size,
    verified: verified.assets.length,
  };
}
