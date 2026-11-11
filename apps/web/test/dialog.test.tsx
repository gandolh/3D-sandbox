import { SceneDocument } from "@solstice/schema";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "../src/components/ui/Dialog.jsx";
import { toScreen, type ViewTransform } from "../src/lib/plan-view.js";
import { sceneById } from "../src/scenes.js";
import {
  allowDrawing,
  getState,
  loadDocument,
  setDialog,
  setPlanLevelId,
  setPlanSheet,
  setPlanTool,
  setPlanView,
  setWallOptions,
} from "../src/state/store.js";
import { PlanView } from "../src/ui/PlanView.jsx";
import { SceneDialogs } from "../src/ui/SceneDialogs.jsx";

function Demo({ onOpenChange = () => undefined, pointer }: { onOpenChange?: (open: boolean) => void; pointer?: true }) {
  const [open, setOpen] = useState(true);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        setOpen(next);
      }}
      title="Rename"
      {...(pointer === true ? { disablePointerDismissal: true } : {})}
      footer={<button type="button">Save</button>}
    >
      <input aria-label="Name" />
      <button type="button" data-autofocus>
        Marked
      </button>
    </Dialog>
  );
}

describe("Dialog", () => {
  it("is a named dialog with a titled, labelled close control", () => {
    render(<Demo />);
    expect(screen.getByRole("dialog", { name: "Rename" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  });

  it("puts focus on the [data-autofocus] control, not on the X", async () => {
    render(<Demo />);
    await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Marked" })));
  });

  it("closes on Escape, and the Escape stops at the document", async () => {
    const seen: boolean[] = [];
    const spy = (event: KeyboardEvent): void => void seen.push(event.defaultPrevented);
    window.addEventListener("keydown", spy);
    const onOpenChange = vi.fn();
    render(<Demo onOpenChange={onOpenChange} />);
    await userEvent.keyboard("{Escape}");
    window.removeEventListener("keydown", spy);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(seen).toEqual([]);
  });

  it("leaves an Escape that an inner control already used to that control", async () => {
    const onOpenChange = vi.fn();
    render(<Demo onOpenChange={onOpenChange} />);
    await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Marked" })));
    const name = screen.getByRole("textbox", { name: "Name" });
    name.addEventListener("keydown", (event) => event.preventDefault());
    act(() => name.focus());
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("closes on an outside click, unless it holds a form", async () => {
    const plain = vi.fn();
    const { unmount } = render(<Demo onOpenChange={plain} />);
    await userEvent.click(document.body);
    expect(plain).toHaveBeenCalledWith(false);
    unmount();
    const form = vi.fn();
    render(<Demo onOpenChange={form} pointer />);
    await userEvent.click(document.body);
    expect(form).not.toHaveBeenCalled();
  });
});

const VIEW: ViewTransform = { scale: 40, originX: 400, originY: 300 };
const surface = (): SVGSVGElement => screen.getByTestId("plan-surface") as unknown as SVGSVGElement;
const click = (pt: readonly [number, number]): void => {
  const [clientX, clientY] = toScreen(VIEW, pt);
  const at = { clientX, clientY, pointerId: 1 };
  fireEvent.pointerMove(surface(), at);
  fireEvent.pointerDown(surface(), { ...at, button: 0 });
  fireEvent.pointerUp(surface(), { ...at, button: 0 });
};

describe("the scene dialogs and the wall tool", () => {
  beforeEach(() => {
    setPlanSheet(false);
    setPlanTool("select");
    setWallOptions({ thickness: 0.24, height: null, material: null });
    allowDrawing("villa-carpathia");
    const doc = SceneDocument.parse(sceneById("villa-carpathia")!.json);
    doc.subject.levels.push({ id: "attic", name: "Attic", elevation: 6, height: 2.4, walls: [], slabs: [], rooms: [] });
    loadDocument(SceneDocument.parse(doc));
    setPlanLevelId("attic");
    setDialog(null);
  });

  it("an Escape that closes a dialog does not cancel a half-drawn wall", async () => {
    render(
      <>
        <PlanView />
        <SceneDialogs />
      </>,
    );
    act(() => setPlanView(VIEW));
    await userEvent.click(screen.getByRole("button", { name: "Wall" }));
    click([0, 0]);
    act(() => setDialog({ kind: "stale" }));
    const dialog = await screen.findByRole("dialog");
    await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    await userEvent.keyboard("{Escape}");
    expect(getState().dialog).toBeNull();
    expect(getState().planTool).toBe("wall");
    click([4, 0]);
    expect(getState().document!.subject.levels.find((l) => l.id === "attic")!.walls.length).toBe(1);
  });

  it("New house ignores an outside click, and the builder warning does not", async () => {
    render(<SceneDialogs />);
    act(() => setDialog({ kind: "new-house", copy: false }));
    await screen.findByRole("dialog");
    await userEvent.click(document.body);
    expect(getState().dialog).not.toBeNull();
    await userEvent.keyboard("{Escape}");
    expect(getState().dialog).toBeNull();
  });
});
