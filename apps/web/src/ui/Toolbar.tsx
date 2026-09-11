import {
  setShotId,
  setShowColliders,
  setShowContext,
  setTheme,
  useStore,
} from "../state/store.js";
import type { RenderRequest } from "../engine/SandboxEngine.js";

export function Toolbar({ onSave }: { onSave: () => void }) {
  const doc = useStore((s) => s.document);
  const theme = useStore((s) => s.theme);
  const showContext = useStore((s) => s.showContext);
  const showColliders = useStore((s) => s.showColliders);
  const shotId = useStore((s) => s.shotId);
  const shots = doc?.shots ?? [];
  const shot = shots.find((s) => s.id === shotId);

  return (
    <header className="flex h-[46px] shrink-0 items-center gap-3 border-b border-line bg-chrome px-3.5">
      <span className="text-[14px] font-semibold tracking-tight text-ink">Solstice</span>
      <span className="rounded-sm border border-line bg-panel px-2 py-[3px] font-mono text-[11.5px] text-muted">
        {doc === null ? "—" : `${doc.id}.scene.json`}
      </span>

      <div className="flex-1" />

      <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[10px] tracking-wider text-muted uppercase">
        <input
          type="checkbox"
          checked={showContext}
          onChange={(event) => setShowContext(event.target.checked)}
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
        className="rounded-sm border border-line bg-panel px-3 py-1.5 text-[12px] font-medium text-ink"
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
          window.dispatchEvent(new CustomEvent("solstice:render", { detail: request }));
        }}
        title={
          shot === undefined
            ? "Path-trace the current viewport at 1280 × 720"
            : `Path-trace "${shot.name}" · ${shot.render.width} × ${shot.render.height} · ${shot.render.samples} samples${shot.solar === undefined ? "" : ` · ${shot.solar.time}`}`
        }
        className="rounded-sm border border-accent bg-accent px-3 py-1.5 text-[12px] font-semibold text-accent-ink"
      >
        Render
      </button>
    </header>
  );
}
