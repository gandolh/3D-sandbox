import { type ReactNode, useState } from "react";
import { idFromTitle } from "../lib/api.js";
import { createHouse, openScene } from "../lib/scene-source.js";
import { allowDrawing, type PlanTool, setDialog, setPlanTool, useStore } from "../state/store.js";
import { newHouseTitle } from "./Toolbar.jsx";

const button = (primary: boolean): string =>
  `rounded-sm border px-3 py-1.5 text-[12px] disabled:cursor-default disabled:opacity-40 ${
    primary ? "border-accent bg-accent font-semibold text-accent-ink" : "border-line bg-panel text-ink"
  }`;

/**
 * A modal question: an overlay, a panel, and Esc to back out.
 *
 * A fixed overlay with `role="dialog"` rather than `<dialog>.showModal()`,
 * which the test DOM does not implement. Focus goes to the panel's first
 * control (`autoFocus` there), and the overlay takes every click outside.
 */
function Modal({ title, onCancel, children }: { title: string; onCancel: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scene-dialog-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
          }
        }}
        className="w-[420px] max-w-[calc(100vw-32px)] rounded-sm border border-line bg-panel p-4 shadow-2xl"
      >
        <h2 id="scene-dialog-title" className="mb-2 text-[13px] font-semibold text-ink">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

/** The app's modal questions, one at a time, from `state.dialog`. */
export function SceneDialogs() {
  const dialog = useStore((s) => s.dialog);
  if (dialog === null) return null;
  if (dialog.kind === "builder") return <BuilderWarning tool={dialog.tool} />;
  if (dialog.kind === "stale") return <StaleSave />;
  return <NewHouse copy={dialog.copy} tool={dialog.tool} error={dialog.error} />;
}

/**
 * The warning before drawing in a scene with a builder.
 *
 * Its builder is the scene's source and its JSON is output, so `npm run
 * scenes` writes the JSON again from the TypeScript and anything drawn here is
 * gone. Said once per scene per session, plainly, with the way out next to it:
 * a copy with no builder, which nothing rebuilds.
 */
function BuilderWarning({ tool }: { tool: PlanTool }) {
  const doc = useStore((s) => s.document);
  const apiState = useStore((s) => s.apiState);
  if (doc === null) return null;
  const close = (): void => setDialog(null);
  return (
    <Modal title={`${doc.title} has a builder`} onCancel={close}>
      <p className="mb-4 text-[12px] leading-relaxed text-muted">
        {doc.title} is built from <code className="font-mono text-ink">scenes/src/{doc.id}.ts</code>. What you
        draw here is erased the next time the scenes are rebuilt.
      </p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={close} className={button(false)}>
          Cancel
        </button>
        <button
          type="button"
          disabled={apiState !== "up"}
          title={
            apiState === "up"
              ? "Copy this scene under a new title, with no builder, and draw in that"
              : newHouseTitle(apiState)
          }
          onClick={() => setDialog({ kind: "new-house", copy: true, tool })}
          className={button(false)}
        >
          Save as a new house
        </button>
        <button
          type="button"
          // biome-ignore lint/a11y/noAutofocus: a modal's first control takes focus
          autoFocus
          onClick={() => {
            allowDrawing(doc.id);
            setPlanTool(tool);
            close();
          }}
          className={button(true)}
        >
          Draw anyway
        </button>
      </div>
    </Modal>
  );
}

/** New house, or Save as a new house: a title, the id it makes, and Create. */
function NewHouse({
  copy,
  tool,
  error,
}: {
  copy: boolean;
  tool?: PlanTool | undefined;
  error?: string | undefined;
}) {
  const doc = useStore((s) => s.document);
  const [title, setTitle] = useState(copy && doc !== null ? `${doc.title} copy` : "");
  const [busy, setBusy] = useState(false);
  const id = idFromTitle(title);
  const close = (): void => setDialog(null);
  const submit = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    const why = await createHouse(title, { copy, ...(tool === undefined ? {} : { tool }) });
    setBusy(false);
    // Still open, with the reason: an id already taken asks for another title.
    if (why !== null)
      setDialog({ kind: "new-house", copy, ...(tool === undefined ? {} : { tool }), error: why });
  };
  return (
    <Modal title={copy ? "Save as a new house" : "New house"} onCancel={close}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <p className="mb-3 text-[12px] leading-relaxed text-muted">
          {copy
            ? `A copy of ${doc?.title ?? "this scene"} as its own scene file, with no builder, so rebuilding the scenes never touches it.`
            : `An empty level on ${doc?.title ?? "this scene"}'s site, with its sun and materials, saved as a new scene file.`}
        </p>
        <label className="mb-1 flex items-center gap-2">
          <span className="w-10 text-[11.5px] text-muted">Title</span>
          <input
            // biome-ignore lint/a11y/noAutofocus: the dialog exists to ask for this
            autoFocus
            type="text"
            aria-label="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="flex-1 rounded-sm border border-line bg-input px-2 py-1 text-[12px] text-ink"
          />
        </label>
        <p className="mb-3 pl-12 font-mono text-[10.5px] text-subtle">
          {id === null ? "Starts with a letter" : `scenes/${id}.scene.json`}
        </p>
        {error !== undefined && (
          <p
            role="alert"
            className="mb-3 rounded-sm border border-danger/40 bg-danger/10 p-2 text-[11.5px] text-danger"
          >
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={close} className={button(false)}>
            Cancel
          </button>
          <button type="submit" disabled={id === null || busy} className={button(true)}>
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Save found the file changed on disk since it was opened: nothing was written. */
function StaleSave() {
  const doc = useStore((s) => s.document);
  const close = (): void => setDialog(null);
  if (doc === null) return null;
  return (
    <Modal title="The file changed on disk" onCancel={close}>
      <p className="mb-4 text-[12px] leading-relaxed text-muted">
        <code className="font-mono text-ink">{doc.id}.scene.json</code> changed on disk since it was opened
        here. Saving would have overwritten that change, so nothing was saved. Reload it to see the file as it
        is now; your edits here are lost if you do.
      </p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={close} className={button(false)}>
          Keep editing
        </button>
        <button
          type="button"
          // biome-ignore lint/a11y/noAutofocus: a modal's first control takes focus
          autoFocus
          onClick={() => {
            close();
            void openScene(doc.id);
          }}
          className={button(true)}
        >
          Reload from disk
        </button>
      </div>
    </Modal>
  );
}
