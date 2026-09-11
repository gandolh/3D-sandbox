import { setShowContext, setTheme, useStore } from "../state/store.js";

export function Toolbar({ onSave }: { onSave: () => void }) {
  const doc = useStore((s) => s.document);
  const theme = useStore((s) => s.theme);
  const showContext = useStore((s) => s.showContext);

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
        disabled
        title="Path-traced rendering arrives in a later brief"
        className="rounded-sm border border-accent bg-accent px-3 py-1.5 text-[12px] font-semibold text-accent-ink disabled:opacity-50"
      >
        Render
      </button>
    </header>
  );
}
