import { useEffect, useRef, useState } from "react";
import { SandboxEngine, type RenderRequest } from "../engine/SandboxEngine.js";
import type { RenderProgress } from "../engine/PathTracer.js";
import { RenderOverlay } from "./RenderOverlay.jsx";
import {
  editDocument,
  getState,
  select,
  setAssetSizes,
  setStatus,
  useStore,
} from "../state/store.js";
import { translateWall } from "../lib/entities.js";
import { collidersFor, sizesFromMap } from "../lib/physics.js";
import { loadAssets } from "../engine/AssetLoader.js";
import type { Shot } from "@solstice/schema";

export function Viewport() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SandboxEngine | null>(null);
  const [stats, setStats] = useState({ triangles: 0, instances: 0 });
  const [render, setRender] = useState<RenderProgress | null>(null);

  const doc = useStore((s) => s.document);
  const revision = useStore((s) => s.revision);
  const selection = useStore((s) => s.selection);
  const showContext = useStore((s) => s.showContext);
  const showColliders = useStore((s) => s.showColliders);
  const assetSizes = useStore((s) => s.assetSizes);
  // The only thing that changes the viewport camera's focal length is framing a
  // shot, so the picker's selection is an accurate read of it.
  const shotId = useStore((s) => s.shotId);
  const framedShot = doc?.shots.find((s) => s.id === shotId);

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
      onRenderProgress: setRender,
    });
    engineRef.current = engine;

    const current = getState().document;
    if (current !== null) {
      engine.setDocument(current, { includeContext: getState().showContext });
    }
    // The toolbar's Render button is far from the engine; a custom event keeps
    // the engine out of global state without threading a ref through the tree.
    const onRenderRequest = (event: Event): void => {
      const request = (event as CustomEvent<RenderRequest>).detail;
      void engine.startRender(request).then((blob) => {
        if (blob === null) return;
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        // Name the file after the shot: a render nobody can trace back to its
        // framing is just a picture.
        anchor.download = `${request.shot?.id ?? "viewport"}-${Date.now()}.png`;
        anchor.click();
        URL.revokeObjectURL(url);
        setStatus("Render downloaded");
      });
    };
    const onFrame = (event: Event): void => {
      engine.frameShot((event as CustomEvent<Shot>).detail);
    };
    window.addEventListener("solstice:render", onRenderRequest);
    window.addEventListener("solstice:frame", onFrame);

    // Models arrive after the first frame. The scene is already standing by
    // then, built from proxies — which is the point: the viewport is usable
    // immediately and improves, rather than waiting on 135 MB of glTF.
    const assetLoad = new AbortController();
    void loadAssets(assetLoad.signal).then((loaded) => {
      if (assetLoad.signal.aborted) return;
      const doc = getState().document;
      if (doc === null) return;
      engine.setAssets(loaded.assets, loaded.materialsFor(doc), {
        includeContext: getState().showContext,
      });

      const sizes = new Map<string, readonly [number, number, number]>();
      for (const id of new Set(doc.subject.placements.map((p) => p.asset))) {
        const asset = loaded.assets.get(id);
        if (asset !== undefined) sizes.set(id, asset.size);
      }
      setAssetSizes(sizes);
      if (sizes.size > 0) setStatus(`${sizes.size} model(s) loaded`);
    });

    return () => {
      assetLoad.abort();
      window.removeEventListener("solstice:render", onRenderRequest);
      window.removeEventListener("solstice:frame", onFrame);
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

  useEffect(() => {
    if (doc === null) return;
    engineRef.current?.setColliderOverlay(
      showColliders ? collidersFor(doc, sizesFromMap(assetSizes)) : null,
    );
  }, [doc, revision, showColliders]);

  return (
    <div className="relative min-w-0 flex-1 bg-viewport">
      <canvas ref={canvasRef} className="block size-full" />

      <Hud className="top-2.5 left-2.5">
        <span className="size-1.5 rounded-full bg-accent" />
        Perspective · {framedShot?.camera.focalLength ?? 50} mm
      </Hud>
      {selection !== null && <Hud className="top-2.5 right-2.5">{selection}</Hud>}
      <Hud className="bottom-2.5 left-2.5">
        {stats.triangles.toLocaleString("en-GB")} tris · {stats.instances.toLocaleString("en-GB")}{" "}
        instances
      </Hud>

      {render !== null && (
        <RenderOverlay
          progress={render}
          onCancel={() => engineRef.current?.cancelRender()}
        />
      )}
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
