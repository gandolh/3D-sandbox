import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Field } from "../src/ui/primitives.jsx";

/**
 * `Field` is the numeric input behind every editable property in the Inspector.
 *
 * Its prop is called `onCommit` and it used to be wired to React's `onChange`,
 * which on an `<input>` fires on every character. Every call ran a
 * `structuredClone` of the whole document, a Zod re-parse, a re-lint and a full
 * scene regeneration — about 100 ms each on Greenhollow.
 *
 * These tests assert the *behaviour* a person would describe, not the
 * implementation: how many times the document is asked to change.
 */
describe("Field", () => {
  it("commits once for a multi-character value, not once per keystroke", async () => {
    const onCommit = vi.fn();
    render(<Field label="Length" value={11} onCommit={onCommit} />);
    const input = screen.getByRole("spinbutton");

    await userEvent.clear(input);
    await userEvent.type(input, "150");
    expect(onCommit, "committed while typing").not.toHaveBeenCalled();

    await userEvent.tab();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(150);
  });

  it("never commits a half-typed number", async () => {
    // `-` and `0.` are states a number input passes through on the way to a
    // value. Committing them made real documents: typing `150` used to commit a
    // wall of length 1, then 15, each fully linted.
    const onCommit = vi.fn();
    render(<Field label="X" value={5} onCommit={onCommit} />);
    const input = screen.getByRole("spinbutton");
    await userEvent.clear(input);
    await userEvent.type(input, "-0.");
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("commits on Enter without waiting for blur", async () => {
    const onCommit = vi.fn();
    render(<Field label="Height" value={2.4} onCommit={onCommit} />);
    const input = screen.getByRole("spinbutton");
    await userEvent.clear(input);
    await userEvent.type(input, "2.7{Enter}");
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(2.7);
  });

  it("abandons the edit on Escape and shows the document's value again", async () => {
    const onCommit = vi.fn();
    render(<Field label="Height" value={2.4} onCommit={onCommit} />);
    const input = screen.getByRole("spinbutton");
    await userEvent.clear(input);
    await userEvent.type(input, "99{Escape}");
    expect(onCommit).not.toHaveBeenCalled();
    // Plain DOM assertions rather than `jest-dom`: one fewer dependency, and it
    // is clearer what is actually being read.
    expect((input as HTMLInputElement).value).toBe("2.4");
  });

  it("does not commit a value that did not change", async () => {
    // Tabbing through a field must not cost a revision bump and a scene
    // rebuild for an edit nobody made.
    const onCommit = vi.fn();
    render(<Field label="X" value={5} onCommit={onCommit} />);
    await userEvent.click(screen.getByRole("spinbutton"));
    await userEvent.tab();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("follows the document when the value changes underneath it", async () => {
    // An undo, a scene switch or a gizmo drag changes the value while the field
    // is not focused; the field has to show it rather than hold a stale draft.
    const { rerender } = render(<Field label="X" value={5} onCommit={vi.fn()} />);
    rerender(<Field label="X" value={8.25} onCommit={vi.fn()} />);
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("8.25");
  });

  it("is read-only with no handler, so a derived value cannot be typed into", () => {
    render(<Field label="Area" value={31.6} />);
    expect((screen.getByRole("spinbutton") as HTMLInputElement).disabled).toBe(true);
  });
});
