import { useEffect, useRef, useState } from "react";
import { SandboxEngine, type RenderRequest } from "../engine/SandboxEngine.js";
import type { RenderProgress } from "../engine/PathTracer.js";
import { RenderOverlay } from "./RenderOverlay.jsx";
import {
  editDocument,
  getState,
  select,
  setAssetSizes,
  setPlayhead,
  setPlaying,
  setStatus,
  useStore,
} from "../state/store.js";
import { translateWall } from "../lib/entities.js";
import { collidersFor, sizesFromMap } from "../lib/physics.js";
import { loadAssets } from "../engine/AssetLoader.js";
import { Player } from "../engine/Player.js";
import type { RenderRequestEvent } from "../engine/queue.js";
import { minutesToClock } from "@solstice/animation";
import type { Shot } from "@solstice/schema";

export function Viewport() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SandboxEngine | null>(null);
  const playerRef = useRef<Player | null>(null);
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
    // Name the file after the shot: a render nobody can trace back to its
    // framing is just a picture.
    const filename = (request: RenderRequest): string =>
      `${request.shot?.id ?? "viewport"}-${Date.now()}.png`;

    /**
     * Write one finished render, and say whether it actually landed.
     *
     * Two paths, and the reason is measured rather than defensive. Chromium
     * gates automatic downloads after the first one from a page, and what that
     * gate does is **not deterministic**. Observed on 2026-09-11, over one page
     * load each: the first `<a download>` landed at once; the second sometimes
     * never arrived and once arrived ninety seconds late; the third onwards
     * never arrived at all. No error, no exception, no console message in any
     * of those cases — while the overlay counted happily to the end. That is
     * the black-render bug's shape again: the interface reporting success for
     * something that did not happen.
     *
     * An hour of GPU must not depend on that. So a queue asks for a directory
     * once, on the button's own click, and writes into it — a write that fails
     * throws, which is the whole point. The anchor stays as the fallback for a
     * single render and for browsers without File System Access, where one
     * download is exactly the case that works.
     */
    const save = async (
      blob: Blob,
      request: RenderRequest,
      directory: FileSystemDirectoryHandle | null,
    ): Promise<boolean> => {
      const name = filename(request);
      if (directory !== null) {
        const handle = await directory.getFileHandle(name, { create: true });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = name;
      anchor.click();
      URL.revokeObjectURL(url);
      return true;
    };

    const onRenderRequest = (event: Event): void => {
      const detail = (event as CustomEvent<RenderRequestEvent>).detail;
      const queue = Array.isArray(detail.requests) ? detail.requests : [detail.requests];
      const directory = detail.directory ?? null;
      if (queue.length === 0) return;
      // A render owns the frame, and playback drives the sun. Left running they
      // would fight over the lighting mid-accumulation, and the samples already
      // taken would be of a different time of day than the ones after.
      if (player.playing) {
        player.stop();
        setPlaying(false);
        commit();
      }
      void (async () => {
        let done = 0;
        for (const [index, request] of queue.entries()) {
          const blob = await engine.startRender(
            queue.length === 1
              ? request
              : { ...request, queue: { index: index + 1, total: queue.length } },
          );
          // Null means cancelled, and cancelling one shot cancels the queue —
          // otherwise the only way out of an hour of renders is to close the tab.
          if (blob === null) break;
          // Written the instant it lands rather than collected and saved at the
          // end: a queue abandoned at shot 3 must still leave shots 1 and 2 on
          // disk, because those took fifteen minutes each.
          try {
            await save(blob, request, directory);
          } catch (error) {
            // A write that fails must not be counted as a render that landed.
            setStatus(`Could not write ${filename(request)}: ${String(error)}`);
            break;
          }
          done += 1;
          setStatus(
            queue.length === 1
              ? "Render downloaded"
              : `Rendered ${String(done)} of ${String(queue.length)}`,
          );
        }
        if (queue.length > 1 && done < queue.length) {
          setStatus(`Queue stopped after ${String(done)} of ${String(queue.length)}`);
        }
      })();
    };
    const onFrame = (event: Event): void => {
      engine.frameShot((event as CustomEvent<Shot>).detail);
    };
    window.addEventListener("solstice:render", onRenderRequest);
    window.addEventListener("solstice:frame", onFrame);

    // The playhead drives the engine directly, never the document: an edit
    // clones, re-parses, re-lints and regenerates the scene, which is fine once
    // and impossible sixty times a second.
    let lastMinutes: number | null = null;
    const player = new Player(
      (sample, seconds) => {
        const minutes = sample["solar.minutes"];
        if (minutes !== undefined) {
          engine.setSolarMinutes(minutes);
          lastMinutes = minutes;
        }
        setPlayhead(seconds);
      },
      () => {
        setPlaying(false);
        commit();
      },
    );

    /**
     * Write where the playhead left the sun back into the document.
     *
     * Playback deliberately bypasses the document, so without this the engine
     * and the document disagree the moment you stop — and Save would record the
     * time the document last happened to hold rather than the one on screen.
     * Once, on stop; never during.
     */
    const commit = (): void => {
      if (lastMinutes === null) return;
      const time = minutesToClock(lastMinutes);
      const current = getState().document;
      if (current === null || current.solar.time === time) return;
      editDocument((draft) => {
        draft.solar = { ...draft.solar, time };
      });
    };
    playerRef.current = player;

    const onTransport = (event: Event): void => {
      const detail = (event as CustomEvent<{ action: "play" | "pause" | "seek"; at?: number }>).detail;
      if (detail.action === "play") {
        player.play(detail.at ?? 0);
        setPlaying(true);
        return;
      }
      if (detail.action === "seek") {
        player.seek(detail.at ?? 0);
        setPlayhead(detail.at ?? 0);
        // Commit while paused, so the readout, the document and the viewport
        // agree. During playback this would be an edit per frame; while
        // scrubbing it is an edit per drag event, which is what the solar
        // slider beside it has always cost.
        commit();
        return;
      }
      player.stop();
      setPlaying(false);
      commit();
    };
    window.addEventListener("solstice:transport", onTransport);

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
      player.dispose();
      playerRef.current = null;
      window.removeEventListener("solstice:transport", onTransport);
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
    playerRef.current?.setAnimation(doc?.animation ?? null);
  }, [doc?.animation]);

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
