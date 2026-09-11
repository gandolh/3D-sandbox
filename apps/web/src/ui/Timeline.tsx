import { useMemo } from "react";
import { dayBounds, sunPosition, utcToLocalClock } from "@solstice/solar";
import { evaluate, minutesToClock } from "@solstice/animation";
import { setSolar, useStore } from "../state/store.js";

const transport = (action: "play" | "pause" | "seek", at?: number): void => {
  window.dispatchEvent(
    new CustomEvent("solstice:transport", { detail: at === undefined ? { action } : { action, at } }),
  );
};

const HOURS = 24;
const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const toClock = (minutes: number): string => {
  const clamped = Math.max(0, Math.min(HOURS * 60 - 1, Math.round(minutes)));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
};

/**
 * Animation time and solar time share one track.
 *
 * Solar time is a single scalar on the document, so a sun-path study is one
 * tween over it — which is why the same strip serves both. Dragging sets the
 * clock directly; playing hands it to `Player`, which drives the engine rather
 * than the document, because an edit per frame would regenerate the scene per
 * frame.
 */
export function Timeline() {
  const doc = useStore((s) => s.document);
  const playhead = useStore((s) => s.playhead);
  const playing = useStore((s) => s.playing);
  const animation = doc?.animation;

  /**
   * What the readout shows: the played time while a track drives the sun, the
   * document's time otherwise.
   *
   * Playback never writes to the document — an edit per frame would regenerate
   * the scene per frame — so reading `doc.solar` during playback leaves the
   * numbers frozen while the viewport plainly shows morning. The document is
   * still the truth; it is just not the truth about *right now*.
   *
   * Only **while playing**, though. Preferring the playhead whenever an
   * animation merely exists killed the solar scrub: dragging it edited the
   * document and the readout went on showing the playhead. Paused, the document
   * wins — and `seek` commits to it, so scrubbing the playhead stays live too.
   */
  const played =
    playing && animation !== undefined
      ? evaluate(animation, playhead)["solar.minutes"]
      : undefined;
  const minutes = played ?? (doc === null ? 0 : toMinutes(doc.solar.time));

  const solarState = useMemo(() => {
    if (doc === null) return null;
    const solar = { ...doc.solar, time: minutesToClock(minutes) };
    return {
      position: sunPosition(doc.site, solar),
      bounds: dayBounds(doc.site, solar),
      clock: solar.time,
    };
  }, [doc, minutes]);

  if (doc === null || solarState === null) return null;
  const { position, bounds } = solarState;
  const pct = (minutes / (HOURS * 60)) * 100;
  const bandStart =
    bounds.sunrise === null
      ? 0
      : (toMinutes(utcToLocalClock(bounds.sunrise, doc.site.timezone)) / (HOURS * 60)) * 100;
  const bandEnd =
    bounds.sunset === null
      ? 100
      : (toMinutes(utcToLocalClock(bounds.sunset, doc.site.timezone)) / (HOURS * 60)) * 100;

  return (
    <div className="shrink-0 border-t border-line bg-chrome px-4 pt-2.5 pb-3">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-mono text-[12px] font-medium text-ink tabular-nums">
          {solarState.clock}
        </span>
        <span className="flex flex-wrap gap-x-3 font-mono text-[10px] text-muted">
          <span>{doc.solar.date.toUpperCase()}</span>
          <span>
            ALT <b className="font-medium text-ink">{position.altitude.toFixed(1)}°</b>
          </span>
          <span>
            AZ <b className="font-medium text-ink">{position.azimuth.toFixed(1)}°</b>
          </span>
          <span>
            ↑ <b className="font-medium text-ink">{bounds.labels.sunrise}</b> ↓{" "}
            <b className="font-medium text-ink">{bounds.labels.sunset}</b>
          </span>
          {doc.solar.hdri !== undefined && (
            <span>
              HDRI <b className="font-medium text-ink">{doc.solar.hdri}</b>
            </span>
          )}
        </span>
      </div>

      {animation !== undefined && (
        <div className="mb-1.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => transport(playing ? "pause" : "play", playing ? undefined : playhead)}
            aria-label={playing ? "Pause" : "Play"}
            className="rounded-sm border border-line bg-panel px-2 py-0.5 font-mono text-[11px] text-ink hover:border-accent"
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <input
            type="range"
            aria-label="Animation time"
            min={0}
            max={animation.duration}
            step={0.05}
            value={playhead}
            onChange={(event) => transport("seek", Number(event.target.value))}
            className="h-1 flex-1 cursor-ew-resize accent-accent"
          />
          <span className="w-20 text-right font-mono text-[10px] text-subtle tabular-nums">
            {playhead.toFixed(1)} / {animation.duration.toFixed(1)}s
          </span>
        </div>
      )}

      <div className="relative h-6">
        <div className="absolute inset-0 overflow-hidden rounded-sm border border-line bg-viewport">
          <div
            className="absolute inset-y-0 bg-gradient-to-r from-[#20283a] via-[#6b4e1e] to-[#2a2436]"
            style={{ left: `${bandStart}%`, right: `${100 - bandEnd}%` }}
          />
        </div>
        <div
          className="pointer-events-none absolute -top-1 -bottom-1 w-0.5 bg-accent"
          style={{ left: `${pct}%` }}
        >
          <span className="absolute -top-1 -left-[3px] size-2 rounded-full bg-accent" />
        </div>
        <input
          type="range"
          aria-label="Solar time"
          min={0}
          max={HOURS * 60 - 1}
          step={1}
          value={minutes}
          onChange={(event) =>
            setSolar({ ...doc.solar, time: toClock(Number(event.target.value)) })
          }
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>

      <div className="mt-1 flex justify-between font-mono text-[9px] text-subtle">
        {["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "24:00"].map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </div>
  );
}
