import { formatMetres } from "../lib/plan-view.js";
import { getState, setPlanLevelId, setPlanSheet, setPlanView, useStore } from "../state/store.js";
import { PlanSheet } from "./plan/PlanSheet.jsx";
import { PlanSurface } from "./plan/PlanSurface.jsx";

const barButton = (on: boolean): string =>
  `rounded-sm border px-2 py-[3px] font-mono text-[10px] tracking-wider uppercase ${
    on ? "border-accent bg-accent text-accent-ink" : "border-line bg-panel text-muted hover:text-ink"
  }`;

/**
 * The plan view, in place of the viewport: where the house is drawn.
 *
 * Two surfaces behind one toggle. The **plan view** is an SVG in world metres
 * with pan, zoom, a grid and selection, for working on. The **sheet** is the
 * 1:100 `planSvg` drawing, for reading. The owner settled the split on
 * 2026-10-21: the toolbar's Plan button opens the plan view, and the drawing
 * moved behind Sheet. A 1:100 sheet refits to the walls on every call and
 * cannot show an empty level, which is right for a drawing and wrong for a
 * surface you add walls to.
 *
 * Not the 3D viewport with a top-down camera: a camera pointing down sees a
 * roof, and a plan is a section cut at 1.2 m. The viewport stays mounted
 * underneath (see `App.tsx`) for looking at the result.
 */
export function PlanView() {
  const doc = useStore((s) => s.document);
  const planLevelId = useStore((s) => s.planLevelId);
  const sheet = useStore((s) => s.planSheet);

  if (doc === null) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center bg-viewport text-[11.5px] text-subtle">
        No document to draw.
      </div>
    );
  }

  const levels = doc.subject.levels;
  // An id that names nothing — the level was removed, or a scene switch has
  // not reset it yet — falls back to the first, rather than to a blank view.
  const level = levels.find((l) => l.id === planLevelId) ?? levels[0];

  // A null view is what the surface refits from, at the size it has measured.
  const fit = (): void => setPlanView(null);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-viewport">
      <div className="flex h-[34px] shrink-0 items-center gap-2 border-b border-line bg-chrome px-2.5">
        {levels.length > 1 ? (
          <select
            aria-label="Level"
            value={level?.id ?? ""}
            onChange={(event) => setPlanLevelId(event.target.value)}
            className="rounded-sm border border-line bg-panel px-2 py-[3px] text-[11.5px] text-ink"
          >
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="px-1 text-[11.5px] text-muted">{level?.name ?? "No levels"}</span>
        )}
        {!sheet && (
          <button
            type="button"
            onClick={fit}
            title={
              level === undefined || level.walls.length === 0
                ? "Show 20 × 20 m around the origin"
                : "Zoom to this level's walls"
            }
            className={barButton(false)}
          >
            Fit
          </button>
        )}
        <div className="flex-1" />
        <button
          type="button"
          aria-pressed={sheet}
          onClick={() => setPlanSheet(!getState().planSheet)}
          title="The 1:100 drawing of this level, for reading and printing"
          className={barButton(sheet)}
        >
          Sheet
        </button>
      </div>

      {sheet ? <PlanSheet doc={doc} levelId={level?.id} /> : <PlanSurface level={level} />}

      {!sheet && <PointerReadout />}
    </div>
  );
}

/**
 * Where the pointer is, in world metres to the centimetre.
 *
 * A strip of its own at the foot of the plan rather than in the app's footer.
 * That footer is a polite live region (`role="status"`, `aria-atomic`), so a
 * coordinate there would be read aloud at every pointer move, and writing it
 * through `setStatus` would clear a standing alert. This strip is `aria-live`
 * off: it is a readout to glance at, not news.
 */
function PointerReadout() {
  const pointer = useStore((s) => s.planPointer);
  return (
    <div
      data-testid="plan-pointer"
      aria-live="off"
      className="flex h-[22px] shrink-0 items-center gap-3 border-t border-line bg-chrome px-3.5 font-mono text-[10px] text-subtle tabular-nums"
    >
      {pointer === null ? (
        <span>Pointer off the plan</span>
      ) : (
        <span>
          x {formatMetres(pointer[0])} m · z {formatMetres(pointer[1])} m
        </span>
      )}
      <span className="ml-auto">Wheel zooms · middle drag or Space + drag pans</span>
    </div>
  );
}
