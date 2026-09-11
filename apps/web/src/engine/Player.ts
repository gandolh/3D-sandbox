import { createTimer, type Timer } from "animejs";
import { evaluate, type Sample } from "@solstice/animation";
import type { Animation } from "@solstice/schema";

/**
 * The playhead.
 *
 * anime.js owns the clock rather than a hand-rolled `requestAnimationFrame`
 * loop, because a transport is more than a counter: play, pause, seek, loop and
 * a stable delta across a dropped frame are all things it already gets right,
 * and all things that are quietly wrong in the obvious implementation.
 *
 * What it drives is deliberately small. The timer advances a number; `evaluate`
 * — pure, headless, tested — turns that number into values; the engine applies
 * them. anime.js never touches the scene graph, which is the same division that
 * keeps React out of it.
 */
export class Player {
  private timer: Timer | null = null;
  private animation: Animation | null = null;

  constructor(
    private readonly onSample: (sample: Sample, seconds: number) => void,
    private readonly onEnd: () => void,
  ) {}

  setAnimation(animation: Animation | null): void {
    this.stop();
    this.animation = animation;
  }

  get duration(): number {
    return this.animation?.duration ?? 0;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  play(from = 0): void {
    const animation = this.animation;
    if (animation === null) return;
    this.stop();

    this.timer = createTimer({
      duration: animation.duration * 1000,
      loop: animation.loop,
      onUpdate: (timer) => {
        const seconds = timer.currentTime / 1000;
        this.onSample(evaluate(animation, seconds), seconds);
      },
      onComplete: () => {
        // A non-looping timer that has finished is not a timer any more; leaving
        // it live would make `playing` lie and the next `play()` a no-op.
        this.timer = null;
        this.onEnd();
      },
    });
    this.timer.seek(Math.max(0, Math.min(animation.duration, from)) * 1000);
  }

  stop(): void {
    this.timer?.pause();
    this.timer = null;
  }

  /** Scrub without playing. */
  seek(seconds: number): void {
    if (this.animation === null) return;
    this.onSample(evaluate(this.animation, seconds), seconds);
  }

  dispose(): void {
    this.stop();
    this.animation = null;
  }
}
