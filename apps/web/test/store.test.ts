import { SceneDocument } from "@solstice/schema";
import { beforeEach, describe, expect, it } from "vitest";
import scene from "../../../scenes/greenhollow.scene.json";
import {
  editDocument,
  getState,
  HISTORY_LIMIT,
  loadDocument,
  redo,
  select,
  setAlert,
  setLoadError,
  setPlayhead,
  setRendering,
  setShotId,
  setSolar,
  setStatus,
  undo,
} from "../src/state/store.js";

const doc = () => SceneDocument.parse(scene);

describe("editDocument", () => {
  beforeEach(() => loadDocument(doc()));

  it("re-parses and re-lints, and bumps the revision", () => {
    const before = getState().revision;
    setSolar({ ...getState().document!.solar, time: "09:00" });
    expect(getState().document?.solar.time).toBe("09:00");
    expect(getState().revision).toBe(before + 1);
  });

  it("rejects an edit that breaks the schema, leaving the document alone", () => {
    // The guard that makes it safe to hand `editDocument` to a slider.
    const before = getState().document;
    editDocument((draft) => {
      (draft as { solar: { time: string } }).solar.time = "not a time";
    });
    expect(getState().document).toBe(before);
    expect(getState().status).toMatch(/Rejected/);
  });

  it("does not mutate the document in place", () => {
    // Callers hold the previous document; an in-place edit would make React's
    // identity check miss the change and the viewport never regenerate.
    const before = getState().document!;
    const time = before.solar.time;
    setSolar({ ...before.solar, time: "11:11" });
    expect(before.solar.time).toBe(time);
    expect(getState().document).not.toBe(before);
  });
});

describe("cheap setters", () => {
  beforeEach(() => loadDocument(doc()));

  it("do not touch the document or the revision", () => {
    // The playhead moves every frame during playback. If it bumped the revision
    // the viewport would regenerate the whole scene sixty times a second.
    const before = getState();
    setPlayhead(4.2);
    setShotId("approach");
    expect(getState().document).toBe(before.document);
    expect(getState().revision).toBe(before.revision);
    expect(getState().playhead).toBe(4.2);
  });
});

describe("what the app tells you", () => {
  it("distinguishes no document from nothing selected", () => {
    // These are different states, and the Inspector rendered the same sentence
    // for both — inviting the user to select something in a scene that never
    // loaded. `document === null` alone cannot tell them apart, because it is
    // also true for a moment on every load.
    loadDocument(SceneDocument.parse(scene));
    expect(getState().loadError).toBeNull();

    setLoadError("Greenhollow failed to parse: expected number");
    expect(getState().document).toBeNull();
    expect(getState().loadError).toMatch(/failed to parse/);
    // And the selection is dropped, because it pointed into a document that is
    // no longer there.
    expect(getState().selection).toBeNull();
  });

  it("clears a load error when a document arrives", () => {
    setLoadError("broken");
    loadDocument(SceneDocument.parse(scene));
    expect(getState().loadError).toBeNull();
  });

  it("keeps the polite and the interrupting channels apart", () => {
    // `status` is announced by a polite live region and waits its turn, which
    // is right for "12 model(s) loaded" and wrong for "Render failed" after
    // forty minutes of GPU. Both show in the same footer slot, so the sighted
    // reading and the announced one are one sentence.
    setStatus("12 model(s) loaded");
    expect(getState().alert).toBeNull();

    setAlert("Render failed: out of memory");
    expect(getState().alert).toBe("Render failed: out of memory");
    expect(getState().status).toBe("Render failed: out of memory");

    // An alert stands until something else actually happens.
    setStatus("Saved");
    expect(getState().alert).toBeNull();
  });
});

describe("undo and redo", () => {
  beforeEach(() => {
    setRendering(false);
    loadDocument(doc());
  });

  const thicken = (by: number, label = "Thicken W-01"): void =>
    editDocument(
      (draft) => {
        draft.subject.levels[0]!.walls[0]!.thickness += by;
      },
      { label },
    );

  it("undo then redo returns the identical document", () => {
    const original = getState().document;
    thicken(0.01);
    const edited = getState().document;
    undo();
    // The same object, not an equal one: the step is a reference to the
    // document the edit replaced.
    expect(getState().document).toBe(original);
    redo();
    expect(getState().document).toBe(edited);
  });

  it("re-lints and bumps the revision, so the engine regenerates", () => {
    const loaded = getState().findings;
    // An opening off the end of its wall parses, and the linter flags it.
    editDocument((draft) => {
      draft.subject.levels[0]!.walls[0]!.openings[0]!.offset = 900;
    });
    expect(getState().findings).not.toEqual(loaded);
    const revision = getState().revision;
    undo();
    expect(getState().revision).toBe(revision + 1);
    expect(getState().findings).toEqual(loaded);
    redo();
    expect(getState().revision).toBe(revision + 2);
    expect(getState().findings).not.toEqual(loaded);
  });

  it("names each step after the edit", () => {
    thicken(0.01, "Change W-01 thickness");
    expect(getState().undoStack.at(-1)?.label).toBe("Change W-01 thickness");
    undo();
    expect(getState().redoStack.at(-1)?.label).toBe("Change W-01 thickness");
    expect(getState().status).toBe("Undid: Change W-01 thickness");
  });

  it("clears redo on a new edit", () => {
    thicken(0.01);
    thicken(0.01);
    undo();
    expect(getState().redoStack).toHaveLength(1);
    thicken(0.02);
    expect(getState().redoStack).toHaveLength(0);
  });

  it("keeps at most the cap, dropping the oldest step", () => {
    const original = getState().document;
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) thicken(0.001, `step ${i}`);
    const stack = getState().undoStack;
    expect(stack).toHaveLength(HISTORY_LIMIT);
    // Steps 0–4 are gone; the oldest left is the one step 5 replaced.
    expect(stack[0]!.label).toBe("step 5");
    expect(stack.some((step) => step.document === original)).toBe(false);
    for (let i = 0; i < HISTORY_LIMIT; i++) undo();
    expect(getState().undoStack).toHaveLength(0);
    expect(getState().document).not.toBe(original);
  });

  it("folds consecutive edits with one group into one step", () => {
    // One drag of the sun slider: a `setSolar` per input event.
    const original = getState().document;
    for (const time of ["09:00", "09:10", "09:20", "09:30"]) setSolar({ ...original!.solar, time });
    expect(getState().undoStack).toHaveLength(1);
    expect(getState().undoStack[0]!.label).toBe("Set the sun to 09:30");
    undo();
    expect(getState().document).toBe(original);
  });

  it("ends a group when a different edit arrives, or on undo", () => {
    const solar = getState().document!.solar;
    setSolar({ ...solar, time: "08:00" });
    setSolar({ ...solar, time: "08:30" });
    thicken(0.01);
    setSolar({ ...solar, time: "09:00" });
    expect(getState().undoStack).toHaveLength(3);
    undo();
    setSolar({ ...solar, time: "10:00" });
    // A new step, not folded into the one just undone.
    expect(getState().undoStack).toHaveLength(3);
  });

  it("leaves history alone when an edit is rejected", () => {
    thicken(0.01);
    const stack = getState().undoStack;
    editDocument((draft) => {
      (draft as { solar: { time: string } }).solar.time = "not a time";
    });
    expect(getState().undoStack).toBe(stack);
  });

  it("is cleared by loading a document, because a different scene is not a step back", () => {
    thicken(0.01);
    thicken(0.01);
    undo();
    loadDocument(doc());
    expect(getState().undoStack).toHaveLength(0);
    expect(getState().redoStack).toHaveLength(0);
  });

  it("clears a selection the undo removed", () => {
    const id = "W-new";
    editDocument(
      (draft) => {
        draft.subject.levels[0]!.walls.push({
          id,
          start: [40, 40],
          end: [44, 40],
          thickness: 0.24,
          material: draft.subject.levels[0]!.walls[0]!.material,
          openings: [],
        });
      },
      { label: `Add wall ${id}` },
    );
    select(id);
    undo();
    expect(getState().selection).toBeNull();
    // And keeps one that still exists.
    select("W-01");
    redo();
    expect(getState().selection).toBe("W-01");
  });

  it("does nothing while a render runs", () => {
    thicken(0.01);
    const edited = getState().document;
    setRendering(true);
    undo();
    expect(getState().document).toBe(edited);
    setRendering(false);
    undo();
    expect(getState().document).not.toBe(edited);
  });
});
