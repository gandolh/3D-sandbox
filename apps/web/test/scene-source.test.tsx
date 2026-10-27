import { lintScene, SceneDocument, serializeScene } from "@solstice/schema";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { idFromTitle, newHouseDocument } from "../src/lib/api.js";
import { createHouse, openScene, refreshScenes, saveOpenScene } from "../src/lib/scene-source.js";
import { SCENES, sceneById } from "../src/scenes.js";
import { getState, loadDocument, pickTool, setDialog, setPlanTool, setScenes } from "../src/state/store.js";
import { SceneDialogs } from "../src/ui/SceneDialogs.jsx";
import { Toolbar } from "../src/ui/Toolbar.jsx";

const bundled = (id: string): SceneDocument => SceneDocument.parse(sceneById(id)!.json);

/** A fake `apps/api`: files in a map, each with a version, answering the four routes the app uses. */
function fakeApi(files: Record<string, { json: unknown; mtime: number; hasBuilder: boolean }>) {
  const calls: { method: string; url: string; mtime: string | null }[] = [];
  const reply = (status: number, body: unknown, mtime?: number): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "content-type": "application/json",
        ...(mtime === undefined ? {} : { "x-scene-mtime": String(mtime) }),
      },
    });
  const fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    const headers = new Headers(init.headers);
    calls.push({ method, url, mtime: headers.get("x-scene-mtime") });
    if (method === "GET" && url === "/api/scenes") {
      return reply(200, {
        scenes: Object.entries(files).map(([id, f]) => ({ id, title: id, hasBuilder: f.hasBuilder })),
      });
    }
    const id = decodeURIComponent(url.replace("/api/scenes/", ""));
    if (method === "GET")
      return files[id] === undefined ? reply(404, {}) : reply(200, files[id].json, files[id].mtime);
    if (method === "POST") {
      const doc = JSON.parse(String(init.body)) as { id: string };
      if (files[doc.id] !== undefined) return reply(409, { error: "exists" });
      files[doc.id] = { json: doc, mtime: 1000, hasBuilder: false };
      return reply(201, doc, 1000);
    }
    if (method === "PUT") {
      const file = files[id];
      if (file === undefined) return reply(404, { error: "not_found" });
      const expected = headers.get("x-scene-mtime");
      if (expected !== null && Number(expected) !== file.mtime) return reply(409, { error: "stale" });
      file.json = JSON.parse(String(init.body));
      file.mtime += 1;
      return reply(200, { ok: true, id, bytes: String(init.body).length }, file.mtime);
    }
    return reply(405, {});
  });
  vi.stubGlobal("fetch", fetch);
  return { files, calls, fetch };
}

beforeEach(() => {
  vi.stubGlobal("__API_BASE__", "/api");
  setDialog(null);
  setPlanTool("select");
});
afterEach(() => vi.unstubAllGlobals());

describe("titles and new documents", () => {
  it("derives an id from a title", () => {
    expect(idFromTitle("Test Cottage")).toBe("test-cottage");
    expect(idFromTitle("  Căsuța de la Munte! ")).toBe("casuta-de-la-munte");
    expect(idFromTitle("2nd Cottage")).toBeNull();
    expect(idFromTitle("   ")).toBeNull();
  });

  it("makes a minimal house that parses and has no errors", () => {
    const from = bundled("greenhollow");
    const doc = SceneDocument.parse(newHouseDocument("test-cottage", "Test Cottage", from));
    expect(doc.subject.levels).toEqual([
      { id: "ground", name: "Ground floor", elevation: 0, height: 2.7, walls: [], slabs: [], rooms: [] },
    ]);
    expect(doc.site).toEqual(from.site);
    expect(doc.solar).toEqual(from.solar);
    expect(doc.materials).toEqual(from.materials);
    expect(doc.context.scatter).toEqual([]);
    expect(doc.shots).toEqual([]);
    expect(lintScene(doc).filter((f) => f.severity === "error")).toEqual([]);
  });
});

describe("the picker reads the API", () => {
  it("lists the API's scenes, with the bundled ones filling in, the API's copy winning", async () => {
    fakeApi({
      greenhollow: { json: sceneById("greenhollow")!.json, mtime: 5, hasBuilder: true },
      "test-cottage": { json: {}, mtime: 7, hasBuilder: false },
    });
    await refreshScenes();
    expect(getState().apiState).toBe("up");
    expect(getState().scenes.map((s) => [s.id, s.source, s.hasBuilder])).toEqual([
      ["greenhollow", "api", true],
      ["test-cottage", "api", false],
      ["elmsgate", "bundled", true],
      ["villa-carpathia", "bundled", true],
    ]);
  });

  it("falls back to the bundled three when the API does not answer, or answers 500", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))),
    );
    await refreshScenes();
    expect(getState().apiState).toBe("down");
    expect(getState().scenes.map((s) => s.id)).toEqual(SCENES.map((s) => s.id));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("proxy error", { status: 500 })),
    );
    await refreshScenes();
    expect(getState().apiState).toBe("down");
  });

  it("marks every bundled scene as having a builder", async () => {
    vi.stubGlobal("__API_BASE__", "");
    await refreshScenes();
    expect(getState().apiState).toBe("none");
    expect(getState().scenes.every((s) => s.hasBuilder && s.source === "bundled")).toBe(true);
  });

  it("opens a scene from the API, through the schema, and keeps its version", async () => {
    const api = fakeApi({
      greenhollow: { json: sceneById("greenhollow")!.json, mtime: 42, hasBuilder: true },
    });
    await refreshScenes();
    expect(await openScene("greenhollow")).toBe(true);
    expect(getState().document?.id).toBe("greenhollow");
    expect(getState().sceneMtime).toBe(42);
    expect(api.calls.at(-1)).toMatchObject({ method: "GET", url: "/api/scenes/greenhollow" });
  });

  it("refuses an API scene that does not parse", async () => {
    fakeApi({ broken: { json: { id: "broken" }, mtime: 1, hasBuilder: false } });
    await refreshScenes();
    expect(await openScene("broken")).toBe(false);
    expect(getState().loadError).toMatch(/broken.scene.json failed to parse/);
  });
});

describe("saving", () => {
  async function openFromApi() {
    const api = fakeApi({
      greenhollow: { json: sceneById("greenhollow")!.json, mtime: 42, hasBuilder: true },
    });
    await refreshScenes();
    await openScene("greenhollow");
    return api;
  }

  it("sends the version it opened, and the new one on the next save", async () => {
    const api = await openFromApi();
    await saveOpenScene();
    expect(api.calls.at(-1)).toMatchObject({ method: "PUT", mtime: "42" });
    expect(getState().status).toMatch(/^Saved/);
    await saveOpenScene();
    expect(api.calls.at(-1)).toMatchObject({ method: "PUT", mtime: "43" });
    expect(getState().status).toMatch(/^Saved/);
  });

  it("says the file changed on disk, offers to reload it, and overwrites nothing", async () => {
    const api = await openFromApi();
    // Edited by hand while open.
    api.files.greenhollow!.json = { ...(sceneById("greenhollow")!.json as object), title: "By hand" };
    api.files.greenhollow!.mtime = 99;
    await saveOpenScene();
    expect(getState().dialog).toEqual({ kind: "stale" });
    expect(getState().alert).toMatch(/changed on disk since it was opened/);
    expect((api.files.greenhollow!.json as { title: string }).title).toBe("By hand");

    render(<SceneDialogs />);
    await userEvent.click(screen.getByRole("button", { name: "Reload from disk" }));
    await vi.waitFor(() => expect(getState().document?.title).toBe("By hand"));
    expect(getState().sceneMtime).toBe(99);
  });
});

describe("New house", () => {
  it("is off without an API, and says why", async () => {
    vi.stubGlobal("__API_BASE__", "");
    await refreshScenes();
    loadDocument(bundled("greenhollow"));
    render(<Toolbar onSave={vi.fn()} />);
    const button = screen.getByRole("button", { name: "New house" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.title).toMatch(/no API/);
  });

  it("is off when the API is down, and says how to start it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );
    await refreshScenes();
    render(<Toolbar onSave={vi.fn()} />);
    expect((screen.getByRole("button", { name: "New house" }) as HTMLButtonElement).title).toMatch(
      /npm run api/,
    );
  });

  it("creates the house, opens it in the plan view with the Wall tool, and lists it as drawn", async () => {
    const api = fakeApi({
      greenhollow: { json: sceneById("greenhollow")!.json, mtime: 42, hasBuilder: true },
    });
    await refreshScenes();
    await openScene("greenhollow");
    expect(await createHouse("Test Cottage", { copy: false })).toBeNull();
    const posted = api.files["test-cottage"]!.json as { title: string; subject: { levels: unknown[] } };
    expect(posted.title).toBe("Test Cottage");
    expect(posted.subject.levels).toHaveLength(1);
    expect(getState().document?.id).toBe("test-cottage");
    expect(getState().document?.subject.levels[0]?.walls).toEqual([]);
    expect(getState().showPlan).toBe(true);
    expect(getState().planTool).toBe("wall");
    expect(getState().scenes.find((s) => s.id === "test-cottage")?.hasBuilder).toBe(false);
  });

  it("asks for another title when the id is taken", async () => {
    fakeApi({
      greenhollow: { json: sceneById("greenhollow")!.json, mtime: 42, hasBuilder: true },
      "test-cottage": { json: {}, mtime: 1, hasBuilder: false },
    });
    await refreshScenes();
    await openScene("greenhollow");
    expect(await createHouse("Test Cottage", { copy: false })).toMatch(/already a scene called test-cottage/);
    expect(getState().document?.id).toBe("greenhollow");
  });

  it("keeps the dialog open with the reason, through the UI", async () => {
    fakeApi({
      greenhollow: { json: sceneById("greenhollow")!.json, mtime: 42, hasBuilder: true },
      "test-cottage": { json: {}, mtime: 1, hasBuilder: false },
    });
    await refreshScenes();
    await openScene("greenhollow");
    render(
      <>
        <Toolbar onSave={vi.fn()} />
        <SceneDialogs />
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "New house" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Title" }), "Test Cottage");
    expect(screen.getByText("scenes/test-cottage.scene.json")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Choose another title/);
  });
});

describe("the builder warning", () => {
  beforeEach(() => {
    setScenes(
      [
        { id: "greenhollow", title: "Greenhollow", hasBuilder: true, source: "api" },
        { id: "test-cottage", title: "Test Cottage", hasBuilder: false, source: "api" },
      ],
      "up",
    );
  });

  it("stops the first drawing tool in a scene with a builder, and says plainly why", async () => {
    // Nothing earlier in this file answers Greenhollow's warning.
    loadDocument(bundled("greenhollow"));
    act(() => pickTool("wall"));
    expect(getState().planTool).toBe("select");
    render(<SceneDialogs />);
    expect(screen.getByRole("dialog").textContent).toContain(
      "Greenhollow is built from scenes/src/greenhollow.ts. What you draw here is erased the next time the scenes are rebuilt.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Draw anyway" }));
    expect(getState().planTool).toBe("wall");
    // Once per scene per session.
    act(() => setPlanTool("select"));
    act(() => pickTool("door"));
    expect(getState().dialog).toBeNull();
    expect(getState().planTool).toBe("door");
  });

  it("never warns for Select, or in a drawn scene", () => {
    loadDocument({ ...bundled("greenhollow"), id: "test-cottage" });
    pickTool("wall");
    expect(getState().dialog).toBeNull();
    expect(getState().planTool).toBe("wall");
    pickTool("select");
    expect(getState().dialog).toBeNull();
  });

  it("saves a copy as a new house with no builder, and draws in that without a warning", async () => {
    const api = fakeApi({
      greenhollow: { json: sceneById("greenhollow")!.json, mtime: 42, hasBuilder: true },
    });
    await refreshScenes();
    // A scene whose warning nobody has answered yet this session.
    api.files["elm-copy-source"] = {
      json: { ...(sceneById("elmsgate")!.json as object), id: "elm-copy-source" },
      mtime: 3,
      hasBuilder: true,
    };
    await refreshScenes();
    await openScene("elm-copy-source");
    render(<SceneDialogs />);
    act(() => pickTool("wall"));
    await userEvent.click(screen.getByRole("button", { name: "Save as a new house" }));
    const title = screen.getByRole("textbox", { name: "Title" });
    await userEvent.clear(title);
    await userEvent.type(title, "Elm Copy");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    await vi.waitFor(() => expect(getState().document?.id).toBe("elm-copy"));
    const copy = api.files["elm-copy"]!.json as SceneDocument;
    expect(copy.subject.levels.length).toBe(bundled("elmsgate").subject.levels.length);
    expect(serializeScene(SceneDocument.parse(copy))).toContain('"title": "Elm Copy"');
    expect(getState().scenes.find((s) => s.id === "elm-copy")?.hasBuilder).toBe(false);
    expect(getState().planTool).toBe("wall");
    expect(getState().dialog).toBeNull();
  });
});
