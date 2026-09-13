import elmsgate from "../../../scenes/elmsgate.scene.json";
import greenhollow from "../../../scenes/greenhollow.scene.json";
import villaCarpathia from "../../../scenes/villa-carpathia.scene.json";

/**
 * The scenes this build can open.
 *
 * Bundled at build time rather than fetched, which is the same call the deploy
 * already rests on: the static client ships the scenes it can open and derives
 * everything else in the browser, so it works with no API behind it.
 *
 * `json` is deliberately `unknown`. A `.scene.json` is inert data that happens
 * to live in the repo, and typing it as a `SceneDocument` would assert it is
 * valid without anything having checked — which is exactly the assertion the
 * schema exists to refuse. Every entry goes through `SceneDocument.safeParse`
 * on the way in, including the first one.
 */
export interface BundledScene {
  id: string;
  title: string;
  json: unknown;
}

export const SCENES: readonly BundledScene[] = [
  { id: "greenhollow", title: "Greenhollow", json: greenhollow },
  { id: "elmsgate", title: "Elmsgate", json: elmsgate },
  // The regression fixture, and openable for the first time here. It is worth
  // being able to look at: its forest rendering as one species went unnoticed
  // for as long as it did partly because nobody could.
  { id: "villa-carpathia", title: "Villa Carpathia", json: villaCarpathia },
];

export const DEFAULT_SCENE_ID = "greenhollow";

export function sceneById(id: string): BundledScene | undefined {
  return SCENES.find((s) => s.id === id);
}
