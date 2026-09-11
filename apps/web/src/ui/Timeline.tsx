import { useMemo } from "react";
import { dayBounds, sunPosition, utcToLocalClock } from "@solstice/solar";
import { setSolar, useStore } from "../state/store.js";

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
 * Solar time is a single scalar on the document, so dragging the playhead *is*
 * a sun-path study — the same tween an animation keyframe would drive.
 */
export function Timeline() {
  const doc = useStore((s) => s.document);
  const solarState = useMemo(() => {
    if (doc === null) return null;
    return {
      position: sunPosition(doc.site, doc.solar),
      bounds: dayBounds(doc.site, doc.solar),
    };
  }, [doc]);

  if (doc === null || solarState === null) return null;
  const { position, bounds } = solarState;

  const minutes = toMinutes(doc.solar.time);
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
          {doc.solar.time}
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
