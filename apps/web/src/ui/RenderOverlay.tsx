import { useEffect, useRef } from "react";
import type { RenderProgress } from "../engine/PathTracer.js";

const seconds = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;

/**
 * Shown only while a render is accumulating. The sample count is the honest
 * progress signal — a path trace has no percentage until it is finished, so the
 * bar tracks samples against the shot's target rather than inventing one.
 */
export function RenderOverlay({
  progress,
  onCancel,
}: {
  progress: RenderProgress;
  onCancel: () => void;
}) {
  const cancel = useRef<HTMLButtonElement | null>(null);

  /**
   * Escape cancels, and the button takes focus when the overlay appears.
   *
   * This is the control that stops an hour of GPU, and it was the hardest thing
   * in the app to reach: a small button at the bottom of a bar, behind every
   * focusable control in the toolbar and the whole scene tree. Escape is what
   * everyone already presses at a modal-looking thing, and moving focus here
   * means the keyboard answer is "Enter".
   *
   * Bound on `window` rather than the overlay so it works wherever focus went —
   * including the canvas, which is where it usually is when someone starts a
   * render.
   */
  useEffect(() => {
    cancel.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const building = progress.phase === "building";
  const pct = building
    ? progress.build * 100
    : (progress.samples / Math.max(1, progress.targetSamples)) * 100;

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex items-center gap-4 border-t border-line bg-chrome/95 px-4 py-3 backdrop-blur">
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-baseline gap-3 font-mono text-[11px]">
          <span className="font-medium tracking-wider text-accent uppercase">
            {building ? "Building BVH" : progress.phase === "done" ? "Complete" : "Path tracing"}
          </span>
          {/* Only present in a queue. Where you are in an hour of rendering is
              the one number the sample count cannot tell you. */}
          {progress.queue !== undefined && (
            <span className="shrink-0 rounded-sm border border-line px-1.5 py-px text-[10px] tracking-wider text-muted uppercase tabular-nums">
              Shot {progress.queue.index} / {progress.queue.total}
            </span>
          )}
          <span className="text-ink tabular-nums">
            {building
              ? `${Math.round(progress.build * 100)}%`
              : `${progress.samples.toLocaleString("en-GB")} / ${progress.targetSamples.toLocaleString("en-GB")} samples`}
          </span>
          <span className="text-subtle tabular-nums">{seconds(progress.elapsedMs)}</span>
          {progress.label !== undefined && (
            <span className="truncate text-subtle">{progress.label}</span>
          )}
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-line">
          <div
            className="h-full bg-accent transition-[width] duration-200"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      </div>
      <button
        ref={cancel}
        type="button"
        onClick={onCancel}
        title="Stop this render — Escape also works"
        className="shrink-0 rounded-sm border border-line bg-panel px-3 py-1.5 text-[12px] font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Cancel <span className="text-subtle">Esc</span>
      </button>
    </div>
  );
}
