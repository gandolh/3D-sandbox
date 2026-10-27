import {
  lintScene,
  type SceneDocument,
  SceneDocument as SceneSchema,
  serializeScene,
} from "@solstice/schema";
import { DEFAULT_SCENE_ID, SCENES, sceneById } from "../scenes.js";
import {
  getState,
  loadDocument,
  type PlanTool,
  type SceneEntry,
  setAlert,
  setDialog,
  setLoadError,
  setPlanTool,
  setSceneMtime,
  setScenes,
  setShowPlan,
  setStatus,
} from "../state/store.js";
import {
  apiBase,
  createScene,
  idFromTitle,
  listScenes,
  newHouseDocument,
  readScene,
  saveScene,
} from "./api.js";

/**
 * Where scenes come from, and where they go.
 *
 * Two sources: the three scenes bundled at build time, which the static
 * deploy can always open, and `apps/api`, which can also open what it wrote —
 * a drawn house has no builder and so is in no bundle. When the API answers,
 * its copy of an id wins, because the file on disk is the truth and the
 * bundle is a snapshot of it from build time.
 */

const bundledEntries = (): SceneEntry[] =>
  SCENES.map((scene) => ({ id: scene.id, title: scene.title, hasBuilder: true, source: "bundled" }));

/** Ask the API what it has, and merge it over the bundled list. */
export async function refreshScenes(): Promise<void> {
  if (apiBase() === "") {
    setScenes(bundledEntries(), "none");
    return;
  }
  const listed = await listScenes();
  if (listed === null) {
    setScenes(bundledEntries(), "down");
    return;
  }
  const fromApi: SceneEntry[] = listed.map((s) => ({ ...s, source: "api" }));
  const ids = new Set(fromApi.map((s) => s.id));
  setScenes([...fromApi, ...bundledEntries().filter((s) => !ids.has(s.id))], "up");
}

/**
 * Open a scene by id: from the API if it lists it, else from the bundle.
 *
 * The one path every way in takes — first load, the picker, New house, a
 * reload after a stale save — so a scene reached one way is never validated
 * less than one reached another. Either way the JSON goes through
 * `SceneDocument.safeParse`; a file is inert data until that says otherwise.
 */
export async function openScene(id: string): Promise<boolean> {
  const entry = getState().scenes.find((s) => s.id === id);
  if (entry?.source === "api") {
    setStatus(`Opening ${id}…`);
    const read = await readScene(id);
    if (read !== null) {
      const parsed = SceneSchema.safeParse(read.json);
      if (!parsed.success) {
        setLoadError(`${id}.scene.json failed to parse: ${parsed.error.issues[0]?.message ?? "unknown"}`);
        return false;
      }
      loadDocument(parsed.data, id);
      setSceneMtime(read.mtime);
      return true;
    }
    // The API listed it a moment ago and is not answering now. The bundled
    // copy, if there is one, is better than nothing; say which it is.
    if (sceneById(id) === undefined) {
      setLoadError(`The API did not return ${id}.scene.json`);
      return false;
    }
    setAlert(`The API did not return ${id}.scene.json — opened the bundled copy`);
  }

  const scene = sceneById(id) ?? sceneById(DEFAULT_SCENE_ID);
  if (scene === undefined) {
    setLoadError("No scenes are bundled in this build");
    return false;
  }
  const parsed = SceneSchema.safeParse(scene.json);
  if (!parsed.success) {
    setLoadError(`${scene.title} failed to parse: ${parsed.error.issues[0]?.message ?? "unknown"}`);
    return false;
  }
  loadDocument(parsed.data, scene.id);
  setSceneMtime(null);
  return true;
}

/** Download the canonical file: Save's answer when there is no API to write it. */
function download(doc: SceneDocument): void {
  const blob = new Blob([serializeScene(doc)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${doc.id}.scene.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Save the open document through the API, conditional on the version it was
 * opened at, so a file edited by hand meanwhile is reported and kept, not
 * overwritten. With no API in the build, or none answering, the file is
 * downloaded instead, so the round-trip format stays inspectable either way.
 *
 * An empty `apiBase()` is checked first: it means "no API at all", which is a
 * different thing from one that is merely down. Posting into a static host's
 * 404 page returns a valid HTTP response, so the unreachable path would never
 * be taken and the user would be told the API refused a save it never saw.
 */
export async function saveOpenScene(): Promise<void> {
  const doc = getState().document;
  if (doc === null) return;
  if (lintScene(doc).some((f) => f.severity === "error")) {
    setStatus("Not saved — the document has errors");
    return;
  }
  if (apiBase() === "") {
    download(doc);
    setStatus("No API in this build — downloaded instead");
    return;
  }
  setStatus("Saving…");
  const outcome = await saveScene(doc, getState().sceneMtime);
  switch (outcome.kind) {
    case "saved":
      setSceneMtime(outcome.mtime);
      setStatus(`Saved · ${outcome.bytes} bytes`);
      return;
    case "stale":
      setAlert(`Not saved — ${doc.id}.scene.json changed on disk since it was opened`);
      setDialog({ kind: "stale" });
      return;
    case "unreachable":
      download(doc);
      setStatus("API unreachable — downloaded instead");
      return;
    default:
      setStatus(
        outcome.kind === "refused"
          ? `API refused the save (${outcome.status})${outcome.message === "" ? "" : `: ${outcome.message}`}`
          : "API refused the save",
      );
  }
}

/**
 * New house, or Save as a new house: `POST` a document under an id made from
 * the title, then open it in the plan view.
 *
 * New is an empty plot on the open scene's site; a copy is the whole open
 * document under the new id and title. Returns why it did not, for the
 * dialog to show and ask again: an id already on disk is refused by the API,
 * never replaced.
 */
export async function createHouse(
  title: string,
  options: { copy: boolean; tool?: PlanTool },
): Promise<string | null> {
  const from = getState().document;
  if (from === null) return "There is no open scene to start from";
  const id = idFromTitle(title);
  if (id === null) return "Give it a title that starts with a letter";
  const doc = options.copy ? { ...from, id, title: title.trim() } : newHouseDocument(id, title.trim(), from);
  const outcome = await createScene(doc);
  if (outcome.kind === "exists") return `There is already a scene called ${id}. Choose another title.`;
  if (outcome.kind === "unreachable") return "The API is not answering, so nothing was created";
  if (outcome.kind === "refused")
    return `The API refused it (${outcome.status})${outcome.message ? `: ${outcome.message}` : ""}`;
  await refreshScenes();
  if (!(await openScene(id))) return `Created ${id}.scene.json, but could not open it`;
  setDialog(null);
  setShowPlan(true);
  setPlanTool(options.tool ?? "wall");
  setStatus(`${title.trim()} created as ${id}.scene.json`);
  return null;
}
