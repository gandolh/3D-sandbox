import { type ReactNode, useEffect, useRef, useState } from "react";

export const PanelTitle = ({ children }: { children: ReactNode }) => (
  <div className="px-3 pt-3 pb-2 font-mono text-[9.5px] tracking-[0.13em] text-subtle uppercase">
    {children}
  </div>
);

/**
 * A numeric property of the document.
 *
 * **`onCommit` means what it says: it fires when the value is committed, not
 * while it is being typed.** It used to be wired to React's `onChange`, which
 * on an `<input>` fires on every character — and every call ran
 * `structuredClone` of the whole document, a full Zod re-parse, a full re-lint
 * and a **complete scene regeneration**. Measured on Greenhollow that is about
 * 100 ms per keystroke, so typing a four-digit millimetre value blocked the
 * main thread for roughly 0.4 s.
 *
 * It was also wrong, not just slow. Typing `150` committed a wall of length 1,
 * then 15, then 150 — each a real document, each fully linted, each able to
 * flash findings into the Inspector for a plan the user never asked for. A
 * half-typed number is not an edit.
 *
 * So the input keeps its own text while focused and commits on **blur** and on
 * **Enter**; Escape abandons the edit. The arrow keys and the spinner commit
 * immediately, because those produce a complete value in one gesture and a user
 * pressing Up expects the model to move.
 */
export function Field({
  label,
  value,
  unit,
  onCommit,
  step = 0.01,
  disabled = false,
}: {
  label: string;
  value: number;
  unit?: string | undefined;
  onCommit?: ((next: number) => void) | undefined;
  step?: number | undefined;
  disabled?: boolean | undefined;
}) {
  const readOnly = onCommit === undefined || disabled;
  const shown = Number.isFinite(value) ? Number(value.toFixed(4)) : 0;
  const [draft, setDraft] = useState<string | null>(null);
  const input = useRef<HTMLInputElement | null>(null);

  // While the field is not being edited it mirrors the document, so an undo, a
  // scene switch or a drag-driven change shows up here without the field
  // fighting it. While it *is* being edited the draft wins, or every keystroke
  // would be overwritten by the value the user is trying to replace.
  useEffect(() => {
    if (draft !== null && document.activeElement !== input.current) setDraft(null);
  }, [draft]);

  const commit = (raw: string): void => {
    setDraft(null);
    const next = Number.parseFloat(raw);
    // An unparseable or unchanged value is not an edit. Committing `shown`
    // again would still bump the revision and rebuild the scene.
    if (!Number.isFinite(next) || next === shown) return;
    onCommit?.(next);
  };

  return (
    <label className="mb-1.5 flex items-center justify-between gap-2">
      <span className="text-[11.5px] text-muted">{label}</span>
      <span className="flex items-center gap-1">
        <input
          ref={input}
          type="number"
          step={step}
          disabled={readOnly}
          value={draft ?? shown}
          onChange={(event) => {
            // `-`, `0.` and an empty field are all states a number input passes
            // through legitimately on the way to a value. Held, not committed.
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit(event.currentTarget.value);
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setDraft(null);
              return;
            }
            // A spinner press produces a whole value in one gesture, so it
            // commits at once — waiting for blur would make the arrows feel
            // broken.
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              requestAnimationFrame(() => {
                if (input.current !== null) commit(input.current.value);
              });
            }
          }}
          onBlur={(event) => commit(event.target.value)}
          className="w-[86px] rounded-sm border border-line bg-input px-2 py-[3px] text-right font-mono text-[11.5px] text-ink tabular-nums disabled:text-muted"
        />
        {unit !== undefined && <span className="w-5 font-mono text-[10px] text-subtle">{unit}</span>}
      </span>
    </label>
  );
}

export const Divider = ({ children }: { children: ReactNode }) => (
  <div className="mt-4 mb-2 border-t border-line pt-3 font-mono text-[9.5px] tracking-[0.12em] text-subtle uppercase">
    {children}
  </div>
);
