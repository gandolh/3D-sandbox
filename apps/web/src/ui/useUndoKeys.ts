import { useEffect } from "react";
import { redo, undo } from "../state/store.js";

/** Input types a person types text into, and so which keep their own undo. */
const TEXT_INPUTS = new Set(["text", "number", "search", "email", "url", "tel", "password"]);

/**
 * Does this element edit text, so Ctrl+Z belongs to it rather than to the
 * document?
 *
 * Text fields only. A range input is not one: after a drag of the sun slider,
 * focus is on the slider, and Ctrl+Z there must undo the drag. Nor is a
 * checkbox or a select.
 */
export function editsText(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.tagName === "TEXTAREA") return true;
  return target instanceof HTMLInputElement && TEXT_INPUTS.has(target.type);
}

/**
 * Ctrl+Z undoes, Ctrl+Shift+Z or Ctrl+Y redoes; Cmd works the same, for a Mac.
 *
 * Bound on `window`, because focus is usually on the canvas or the plan when
 * the hand goes to the keys. Inside a text field the keys are left alone, so a
 * half-typed number is undone by the field and not the document behind it.
 */
export function useUndoKeys(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      const isRedo = (key === "z" && event.shiftKey) || (key === "y" && !event.shiftKey);
      const isUndo = key === "z" && !event.shiftKey;
      if (!isUndo && !isRedo) return;
      if (editsText(event.target)) return;
      // Otherwise the browser's own undo runs too, against whatever field
      // last had focus.
      event.preventDefault();
      if (isUndo) undo();
      else redo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
