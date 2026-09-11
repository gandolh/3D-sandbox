import type { Animation, Easing, Track } from "@solstice/schema";

/**
 * Evaluating a timeline: (track, t) → value.
 *
 * Deliberately free of three.js, the DOM and any animation library. The clock
 * that *drives* playback belongs to the browser; deciding what a track is worth
 * at a given second is arithmetic, and arithmetic that is tested headlessly is
 * arithmetic that stays right — the same reason geometry and solar are packages
 * rather than code inside the app.
 */

const EASINGS: Record<Easing, (t: number) => number> = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => t * (2 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
};

export function ease(kind: Easing, t: number): number {
  return EASINGS[kind](Math.min(1, Math.max(0, t)));
}

/**
 * A track's value at time `t`, in seconds.
 *
 * Held flat before the first keyframe and after the last, rather than
 * extrapolated: a sun that keeps rising past the end of the study because the
 * gradient said so is worse than one that stops.
 *
 * Keyframes are sorted here rather than assumed sorted. The document is
 * hand- and machine-authored, and an out-of-order keyframe should animate
 * oddly at worst, not produce a value that runs backwards.
 */
export function evaluateTrack(track: Track, t: number): number {
  const keys = [...track.keyframes].sort((a, b) => a.at - b.at);
  const first = keys[0]!;
  const last = keys[keys.length - 1]!;

  if (t <= first.at) return first.value;
  if (t >= last.at) return last.value;

  for (let i = 1; i < keys.length; i++) {
    const from = keys[i - 1]!;
    const to = keys[i]!;
    if (t > to.at) continue;
    const span = to.at - from.at;
    // Two keyframes at the same instant are a step, not a division by zero.
    if (span <= 0) return to.value;
    // The easing belongs to the keyframe being approached, so a track can ease
    // into one segment and run linearly through the next.
    const k = ease(to.easing, (t - from.at) / span);
    return from.value + (to.value - from.value) * k;
  }
  return last.value;
}

/** Every track's value at `t`, keyed by target. */
export type Sample = Partial<Record<Track["target"], number>>;

export function evaluate(animation: Animation, t: number): Sample {
  const clock = animation.loop && animation.duration > 0 ? mod(t, animation.duration) : t;
  const out: Sample = {};
  // Later tracks win on a repeated target. Two tracks driving one property is a
  // document error, not something to average into a value neither asked for.
  for (const track of animation.tracks) out[track.target] = evaluateTrack(track, clock);
  return out;
}

/** Positive modulo — `-1 % 10` is `-1` in JavaScript, and a playhead is never negative. */
export function mod(t: number, span: number): number {
  return ((t % span) + span) % span;
}

/** `540` → `"09:00"`. Minutes past local midnight, clamped to one day. */
export function minutesToClock(minutes: number): string {
  const clamped = Math.min(24 * 60 - 1, Math.max(0, Math.round(minutes)));
  const h = String(Math.floor(clamped / 60)).padStart(2, "0");
  const m = String(clamped % 60).padStart(2, "0");
  return `${h}:${m}`;
}

/** `"09:00"` → `540`. */
export function clockToMinutes(clock: string): number {
  const [h, m] = clock.split(":");
  return Number(h) * 60 + Number(m);
}
