import { useEffect, useRef, useState } from "react";
import { SandboxEngine } from "../engine/SandboxEngine.js";
import { editDocument, getState, select, useStore } from "../state/store.js";
import { translateWall } from "../lib/entities.js";

export function Viewport() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SandboxEngine | null>(null);
  const [stats, setStats] = useState({ triangles: 0, instances: 0 });

  const doc = useStore((s) => s.document);
  const revision = useStore((s) => s.revision);
  const selection = useStore((s) => s.selection);
  const showContext = useStore((s) => s.showContext);

  // The engine outlives every render; React only feeds it.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    const engine = new SandboxEngine(canvas, {
      onSelect: select,
      onTranslate: (id, dx, dz) =>
        editDocument((draft) => {
          for (const level of draft.subject.levels) {
            const wall = level.walls.find((w) => w.id === id);
            if (wall !== undefined) translateWall(wall, dx, dz);
          }
        }),
      onStats: setStats,
    });
    engineRef.current = engine;

    const current = getState().document;
    if (current !== null) {
      engine.setDocument(current, { includeContext: getState().showContext });
    }
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (doc !== null) engineRef.current?.setDocument(doc, { includeContext: showContext });
  }, [doc, revision, showContext]);

  useEffect(() => {
    engineRef.current?.select(selection);
  }, [selection]);

  return (
    <div className="relative min-w-0 flex-1 bg-viewport">
      <canvas ref={canvasRef} className="block size-full" />

      <Hud className="top-2.5 left-2.5">
        <span className="size-1.5 rounded-full bg-accent" />
        Perspective · 50 mm
      </Hud>
      {selection !== null && <Hud className="top-2.5 right-2.5">{selection}</Hud>}
      <Hud className="bottom-2.5 left-2.5">
        {stats.triangles.toLocaleString("en-GB")} tris · {stats.instances.toLocaleString("en-GB")}{" "}
        instances
      </Hud>
    </div>
  );
}

const Hud = ({ className, children }: { className: string; children: React.ReactNode }) => (
  <div
    className={`pointer-events-none absolute flex items-center gap-1.5 rounded-sm border border-line/70 bg-chrome/80 px-2 py-1 font-mono text-[10px] text-muted backdrop-blur-sm ${className}`}
  >
    {children}
  </div>
);
