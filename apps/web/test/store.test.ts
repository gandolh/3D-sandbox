import { beforeEach, describe, expect, it } from "vitest";
import { SceneDocument } from "@solstice/schema";
import {
  editDocument,
  getState,
  loadDocument,
  setPlayhead,
  setAlert,
  setLoadError,
  setShotId,
  setSolar,
  setStatus,
} from "../src/state/store.js";
import scene from "../../../scenes/greenhollow.scene.json";

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
