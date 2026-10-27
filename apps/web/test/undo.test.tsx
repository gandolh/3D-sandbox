import { SceneDocument } from "@solstice/schema";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SCENE_ID, sceneById } from "../src/scenes.js";
import { editDocument, getState, loadDocument, setRendering } from "../src/state/store.js";
import { Field } from "../src/ui/primitives.jsx";
import { Toolbar } from "../src/ui/Toolbar.jsx";

const load = () => loadDocument(SceneDocument.parse(sceneById(DEFAULT_SCENE_ID)!.json));
const thicken = (label: string): void =>
  act(() =>
    editDocument(
      (draft) => {
        draft.subject.levels[0]!.walls[0]!.thickness += 0.01;
      },
      { label },
    ),
  );
const button = (name: "Undo" | "Redo") => screen.getByRole("button", { name }) as HTMLButtonElement;

beforeEach(() => {
  setRendering(false);
  load();
});

describe("the undo and redo buttons", () => {
  it("are disabled with nothing to take back, and say so", () => {
    render(<Toolbar onSave={vi.fn()} />);
    expect(button("Undo").disabled).toBe(true);
    expect(button("Undo").title).toBe("Nothing to undo");
    expect(button("Redo").disabled).toBe(true);
  });

  it("name the step they would take", async () => {
    render(<Toolbar onSave={vi.fn()} />);
    thicken("Move P-03");
    expect(button("Undo").disabled).toBe(false);
    expect(button("Undo").title).toBe("Undo Move P-03 (Ctrl+Z)");
    await userEvent.click(button("Undo"));
    expect(button("Redo").title).toBe("Redo Move P-03 (Ctrl+Shift+Z)");
  });

  it("disables Undo once the last step is undone", async () => {
    render(<Toolbar onSave={vi.fn()} />);
    thicken("one");
    thicken("two");
    await userEvent.click(button("Undo"));
    expect(button("Undo").disabled).toBe(false);
    await userEvent.click(button("Undo"));
    expect(button("Undo").disabled).toBe(true);
    expect(button("Redo").disabled).toBe(false);
  });

  it("are off while a render runs", () => {
    render(<Toolbar onSave={vi.fn()} />);
    thicken("one");
    act(() => setRendering(true));
    expect(button("Undo").disabled).toBe(true);
    expect(button("Undo").title).toBe("A render is running");
  });
});

describe("the undo keys", () => {
  it("undo with Ctrl+Z and redo with Ctrl+Shift+Z or Ctrl+Y", async () => {
    render(<Toolbar onSave={vi.fn()} />);
    const original = getState().document;
    thicken("one");
    const edited = getState().document;
    document.body.focus();
    await userEvent.keyboard("{Control>}z{/Control}");
    expect(getState().document).toBe(original);
    await userEvent.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
    expect(getState().document).toBe(edited);
    await userEvent.keyboard("{Control>}z{/Control}");
    await userEvent.keyboard("{Control>}y{/Control}");
    expect(getState().document).toBe(edited);
  });

  it("take Cmd on a Mac", async () => {
    render(<Toolbar onSave={vi.fn()} />);
    const original = getState().document;
    thicken("one");
    await userEvent.keyboard("{Meta>}z{/Meta}");
    expect(getState().document).toBe(original);
  });

  it("leave a text field's own undo alone", async () => {
    // Ctrl+Z in an Inspector field undoes the typing, not the document.
    render(
      <>
        <Toolbar onSave={vi.fn()} />
        <Field label="Thickness" value={240} onCommit={vi.fn()} />
      </>,
    );
    thicken("one");
    const edited = getState().document;
    const field = screen.getByRole("spinbutton");
    await userEvent.click(field);
    await userEvent.keyboard("{Control>}z{/Control}");
    expect(getState().document).toBe(edited);
  });

  it("still undo from the sun slider, which is a range and not a text field", async () => {
    render(
      <>
        <Toolbar onSave={vi.fn()} />
        <input type="range" aria-label="Sun" />
      </>,
    );
    const original = getState().document;
    thicken("one");
    screen.getByRole("slider").focus();
    await userEvent.keyboard("{Control>}z{/Control}");
    expect(getState().document).toBe(original);
  });
});
