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
          <span className="text-ink tabular-nums">
            {building
              ? `${Math.round(progress.build * 100)}%`
              : `${progress.samples.toLocaleString("en-GB")} / ${progress.targetSamples.toLocaleString("en-GB")} samples`}
          </span>
          <span className="text-subtle tabular-nums">{seconds(progress.elapsedMs)}</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-line">
          <div
            className="h-full bg-accent transition-[width] duration-200"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 rounded-sm border border-line bg-panel px-3 py-1.5 text-[12px] font-medium text-ink"
      >
        Cancel
      </button>
    </div>
  );
}
