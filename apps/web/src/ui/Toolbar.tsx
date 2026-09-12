import {
  setSceneId,
  setShotId,
  setShowColliders,
  setShowContext,
  setTheme,
  useStore,
} from "../state/store.js";
import type { RenderRequest } from "../engine/SandboxEngine.js";
import {
  estimateQueue,
  formatDuration,
  pickRenderDirectory,
  renderQueue,
} from "../engine/queue.js";
import { setStatus } from "../state/store.js";
import { SCENES } from "../scenes.js";

export function Toolbar({ onSave }: { onSave: () => void }) {
  const doc = useStore((s) => s.document);
  const theme = useStore((s) => s.theme);
  const showContext = useStore((s) => s.showContext);
  const showColliders = useStore((s) => s.showColliders);
  const shotId = useStore((s) => s.shotId);
  const sceneId = useStore((s) => s.sceneId);
  /**
   * A render owns the GPU, and these controls can pull the ground from under it.
   *
   * Switching scenes calls `setDocument`, whose first act is to dispose every
   * geometry and material the running trace is sampling — and because
   * accumulation carries on from the BVH already uploaded, the queue writes
   * files and reports success for a scene the user has navigated away from.
   * The Context toggle regenerates for the same reason. Save serialises a
   * document that is about to be replaced.
   *
   * Disabled rather than blocked-with-a-message: a control that looks live and
   * silently corrupts an hour of work is worse than one that is plainly not
   * available yet.
   */
  const rendering = useStore((s) => s.rendering);
  const duringRender = rendering ? "A render is running" : undefined;
  const shots = doc?.shots ?? [];
  const shot = shots.find((s) => s.id === shotId);

  return (
    <header className="flex h-[46px] shrink-0 items-center gap-3 border-b border-line bg-chrome px-3.5">
      <span className="text-[14px] font-semibold tracking-tight text-ink">Solstice</span>
      {SCENES.length > 1 ? (
        <select
          value={sceneId}
          onChange={(event) => setSceneId(event.target.value)}
          disabled={rendering}
          title={duringRender ?? "Which scene is open"}
          className="rounded-sm border border-line bg-panel px-2 py-[3px] font-mono text-[11.5px] text-muted disabled:opacity-40"
        >
          {SCENES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id}.scene.json
            </option>
          ))}
        </select>
      ) : (
        <span className="rounded-sm border border-line bg-panel px-2 py-[3px] font-mono text-[11.5px] text-muted">
          {doc === null ? "—" : `${doc.id}.scene.json`}
        </span>
      )}

      <div className="flex-1" />

      <label
        title={duringRender}
        className="flex cursor-pointer items-center gap-1.5 font-mono text-[10px] tracking-wider text-muted uppercase has-disabled:cursor-default has-disabled:opacity-40"
      >
        <input
          type="checkbox"
          checked={showContext}
          onChange={(event) => setShowContext(event.target.checked)}
          disabled={rendering}
          className="accent-accent"
        />
        Context
      </label>

      <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[10px] tracking-wider text-muted uppercase">
        <input
          type="checkbox"
          checked={showColliders}
          onChange={(event) => setShowColliders(event.target.checked)}
          className="accent-accent"
        />
        Colliders
      </label>

      <button
        type="button"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="rounded-sm border border-line bg-panel px-2.5 py-1.5 font-mono text-[10px] tracking-wider text-muted uppercase hover:text-ink"
      >
        {theme === "dark" ? "Light" : "Dark"}
      </button>

      <button
        type="button"
        onClick={onSave}
        disabled={rendering}
        title={duringRender}
        className="rounded-sm border border-line bg-panel px-3 py-1.5 text-[12px] font-medium text-ink disabled:opacity-40"
      >
        Save
      </button>
      {shots.length > 0 && (
        <select
          value={shotId ?? ""}
          onChange={(event) => {
            const next = event.target.value === "" ? null : event.target.value;
            setShotId(next);
            // Framing the viewport to the shot is what makes the picker honest:
            // otherwise the button says "Garden elevation" while the screen
            // shows something else entirely.
            const picked = shots.find((s) => s.id === next);
            if (picked !== undefined) {
              window.dispatchEvent(new CustomEvent("solstice:frame", { detail: picked }));
            }
          }}
          title="Which shot the Render button reproduces"
          className="rounded-sm border border-line bg-panel px-2 py-1.5 text-[12px] text-ink"
        >
          <option value="">Viewport</option>
          {shots.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}

      <button
        type="button"
        onClick={() => {
          // A Shot is the reproducible unit: its camera, its clock, its output
          // size and its sample budget. Taking the size alone — which is what
          // this did before — reproduces nothing.
          const request: RenderRequest =
            shot === undefined
              ? { width: 1280, height: 720, samples: 256 }
              : { ...shot.render, shot };
          window.dispatchEvent(
            new CustomEvent("solstice:render", { detail: { requests: request } }),
          );
        }}
        title={
          duringRender ??
          (shot === undefined
            ? "Path-trace the current viewport at 1280 × 720"
            : `Path-trace "${shot.name}" · ${shot.render.width} × ${shot.render.height} · ${shot.render.samples} samples${shot.solar === undefined ? "" : ` · ${shot.solar.time}`}`)
        }
        disabled={rendering}
        className="rounded-sm border border-accent bg-accent px-3 py-1.5 text-[12px] font-semibold text-accent-ink disabled:opacity-40"
      >
        Render
      </button>
      {shots.length > 1 && (
        <button
          type="button"
          onClick={() => {
            // Asked for here, inside the click, because `showDirectoryPicker`
            // needs a user gesture and the render loop is several promises
            // downstream of it. Also the one honest moment to ask: before an
            // hour of GPU, not after the first image is already lost.
            void (async () => {
              let directory: FileSystemDirectoryHandle | null = null;
              try {
                directory = await pickRenderDirectory();
              } catch {
                // Dismissing the picker means "don't render", not "render into
                // Downloads and lose all but the first".
                setStatus("Render queue cancelled — no folder chosen");
                return;
              }
              if (directory === null) {
                setStatus("This browser cannot write a folder — images may be blocked after the first");
              }
              window.dispatchEvent(
                new CustomEvent("solstice:render", {
                  detail: { requests: renderQueue(shots), directory },
                }),
              );
            })();
          }}
          // The estimate is the point of the button, not decoration: four shots
          // at 600 samples is about an hour, and a control that commits the
          // machine to that without saying so is a worse control than one that
          // does. Quoted from one measured GPU — see the wiki — so it says
          // "about", and the title carries the caveat the label has no room for.
          title={`Path-trace all ${String(shots.length)} shots in order — ${String(
            estimateQueue(renderQueue(shots)).samples,
          )} samples, about ${formatDuration(
            estimateQueue(renderQueue(shots)).seconds,
          )} on the machine this was measured on. Each image downloads as it finishes; cancelling stops the queue.`}
          disabled={rendering}
          className="rounded-sm border border-line bg-panel px-3 py-1.5 text-[12px] text-ink disabled:opacity-40"
        >
          Render all · ~{formatDuration(estimateQueue(renderQueue(shots)).seconds)}
        </button>
      )}
    </header>
  );
}
