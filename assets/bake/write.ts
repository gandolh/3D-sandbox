import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ASSET_ID, insideRoot } from "./paths.ts";

/** Refused before anything is written; the server answers 400. */
export class BakeTargetError extends Error {}

/**
 * Where an asset's impostor lives: `<root>/<source>/<slug>/impostor/`.
 *
 * Inside the asset's own directory, because that is where `readManifest`
 * looks — `impostor/atlas.png` among that asset's files. It used to be
 * `dirname(asset)`, i.e. `<root>/<source>/impostor/`, which the manifest read
 * as a phantom asset called `impostor` and every asset from one source shared,
 * so each bake overwrote the last and none of them was ever found.
 */
export function impostorDir(root: string, asset: string): string {
  if (!ASSET_ID.test(asset)) throw new BakeTargetError("asset must be <source>/<slug>");
  const dir = resolve(root, asset, "impostor");
  // Belt and braces: the pattern above already makes this unreachable, and it
  // is one line to guarantee rather than argue that no future edit to the
  // pattern reopens it.
  if (!insideRoot(root, dir)) throw new BakeTargetError("outside the assets root");
  return dir;
}

/** Write a finished bake where the manifest will find it, and say where. */
export async function writeImpostor(
  root: string,
  asset: string,
  atlas: Buffer,
  meta: string,
): Promise<string> {
  const dir = impostorDir(root, asset);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "atlas.png"), atlas);
  await writeFile(join(dir, "impostor.json"), `${meta}\n`);
  return dir;
}
