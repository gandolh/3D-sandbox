import type { Shot } from "@solstice/schema";
import type { RenderRequest } from "./SandboxEngine.js";

/**
 * Measured throughput, in samples per second at 1920 × 1080, on the machine
 * this was developed on — see `corpus/wiki/render-performance.md`.
 *
 * Quoted from one GPU on one day. It is here to stop a button silently
 * committing the machine to an hour, not to promise a finishing time.
 */
export const MEASURED_SAMPLES_PER_SECOND = 0.69;
const MEASURED_PIXELS = 1920 * 1080;

export interface QueueEstimate {
  shots: number;
  samples: number;
  seconds: number;
}

/**
 * Every declared shot, in document order.
 *
 * Document order rather than anything computed: it is the order a human wrote
 * the shots in, and that is the only ordering that carries intent. Sorting by
 * cost would render the cheap ones first and quietly reorder someone's
 * storyboard.
 */
export function renderQueue(shots: readonly Shot[]): RenderRequest[] {
  return shots.map((shot) => ({ ...shot.render, shot }));
}

/**
 * What the queue will cost.
 *
 * Sample rate scales with pixel count — a 960 × 540 shot is four times the
 * measured area's speed — which is why this cannot just be samples ÷ rate.
 */
export function estimateQueue(requests: readonly RenderRequest[]): QueueEstimate {
  let samples = 0;
  let seconds = 0;
  for (const request of requests) {
    const pixels = request.width * request.height;
    // Guard the degenerate case rather than dividing by zero: a zero-area shot
    // cannot pass the schema, but an estimate that returns Infinity for one
    // would put "Infinityh" in a button label.
    const rate =
      pixels > 0 ? MEASURED_SAMPLES_PER_SECOND * (MEASURED_PIXELS / pixels) : MEASURED_SAMPLES_PER_SECOND;
    samples += request.samples;
    seconds += request.samples / rate;
  }
  return { shots: requests.length, samples, seconds };
}

/** Coarse duration for a button label — "58 min", "1 h 4 min", "40 s". */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  if (total < 90) return `${total} s`;
  const minutes = Math.round(total / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/**
 * What travels on the `solstice:render` event.
 *
 * The directory handle rides along rather than being acquired where the render
 * runs, because `showDirectoryPicker` requires a user gesture and the render
 * loop is several promises away from the click that started it.
 */
export interface RenderRequestEvent {
  requests: RenderRequest | RenderRequest[];
  directory?: FileSystemDirectoryHandle | null;
}

/**
 * Ask for somewhere to put a queue's images, on the click that starts it.
 *
 * Returns `null` when the browser has no File System Access — the caller then
 * falls back to `<a download>`, which is fine for one file and lossy for many.
 * Throws `AbortError` if the user dismisses the picker, which means "don't
 * render", not "render into Downloads".
 */
export async function pickRenderDirectory(): Promise<FileSystemDirectoryHandle | null> {
  const picker = window.showDirectoryPicker;
  if (picker === undefined) return null;
  return picker({ id: "solstice-renders", mode: "readwrite" });
}
