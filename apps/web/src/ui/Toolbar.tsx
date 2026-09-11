import { setShowColliders, setShowContext, setTheme, useStore } from "../state/store.js";
import type { RenderSettings } from "../engine/PathTracer.js";

export function Toolbar({ onSave }: { onSave: () => void }) {
  const doc = useStore((s) => s.document);
  const theme = useStore((s) => s.theme);
  const showContext = useStore((s) => s.showContext);
  const showColliders = useStore((s) => s.showColliders);

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
      <button
        type="button"
        onClick={() => {
          // A Shot is the reproducible unit, so its declared output size wins.
          const shot = doc?.shots[0];
          const settings: RenderSettings = {
            width: shot?.render.width ?? 1280,
            height: shot?.render.height ?? 720,
            samples: shot?.render.samples ?? 256,
          };
          window.dispatchEvent(new CustomEvent("solstice:render", { detail: settings }));
        }}
        title={
          doc?.shots[0] === undefined
            ? "Path-trace at 1280 × 720"
            : `Path-trace shot "${doc.shots[0].name}" at ${doc.shots[0].render.width} × ${doc.shots[0].render.height}`
        }
        className="rounded-sm border border-accent bg-accent px-3 py-1.5 text-[12px] font-semibold text-accent-ink"
      >
        Render
      </button>
    </header>
  );
}
