import { useState } from "react";
import { Dialog } from "../components/ui/Dialog.jsx";
import { idFromTitle } from "../lib/api.js";
import { createHouse, openScene } from "../lib/scene-source.js";
import { allowDrawing, type PlanTool, setDialog, setPlanTool, useStore } from "../state/store.js";
import { newHouseTitle } from "./Toolbar.jsx";

const button = (primary: boolean): string =>
  `rounded-sm border px-3 py-1.5 text-[12px] disabled:cursor-default disabled:opacity-40 ${
    primary ? "border-accent bg-accent font-semibold text-accent-ink" : "border-line bg-panel text-ink"
  }`;

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
    <Dialog
      open
      onOpenChange={close}
      title={`${doc.title} has a builder`}
      footer={
        <>
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
            data-autofocus
            onClick={() => {
              allowDrawing(doc.id);
              setPlanTool(tool);
              close();
            }}
            className={button(true)}
          >
            Draw anyway
          </button>
        </>
      }
    >
      <p className="mb-4 text-[12px] leading-relaxed text-muted">
        {doc.title} is built from <code className="font-mono text-ink">scenes/src/{doc.id}.ts</code>. What you draw here
        is erased the next time the scenes are rebuilt.
      </p>
    </Dialog>
  );
}

/** New house, or Save as a new house: a title, the id it makes, and Create. */
function NewHouse({ copy, tool, error }: { copy: boolean; tool?: PlanTool | undefined; error?: string | undefined }) {
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
    if (why !== null) setDialog({ kind: "new-house", copy, ...(tool === undefined ? {} : { tool }), error: why });
  };
  return (
    <Dialog
      open
      onOpenChange={close}
      title={copy ? "Save as a new house" : "New house"}
      disablePointerDismissal
      footer={
        <>
          <button type="button" onClick={close} className={button(false)}>
            Cancel
          </button>
          <button type="submit" form="new-house" disabled={id === null || busy} className={button(true)}>
            {busy ? "Creating…" : "Create"}
          </button>
        </>
      }
    >
      <form
        id="new-house"
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
            data-autofocus
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
      </form>
    </Dialog>
  );
}

/** Save found the file changed on disk since it was opened: nothing was written. */
function StaleSave() {
  const doc = useStore((s) => s.document);
  const close = (): void => setDialog(null);
  if (doc === null) return null;
  return (
    <Dialog
      open
      onOpenChange={close}
      title="The file changed on disk"
      footer={
        <>
          <button type="button" onClick={close} className={button(false)}>
            Keep editing
          </button>
          <button
            type="button"
            data-autofocus
            onClick={() => {
              close();
              void openScene(doc.id);
            }}
            className={button(true)}
          >
            Reload from disk
          </button>
        </>
      }
    >
      <p className="mb-4 text-[12px] leading-relaxed text-muted">
        <code className="font-mono text-ink">{doc.id}.scene.json</code> changed on disk since it was opened here. Saving
        would have overwritten that change, so nothing was saved. Reload it to see the file as it is now; your edits
        here are lost if you do.
      </p>
    </Dialog>
  );
}
