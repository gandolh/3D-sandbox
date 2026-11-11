import { Slider as BaseSlider } from "@base-ui/react/slider";
import { cn } from "../../lib/cn.js";

export interface SliderProps {
  /** Names the thumb for a screen reader. */
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onValueChange: (value: number) => void;
  /**
   * `track` draws its own bar and thumb. `scrub` is invisible: it lies over a strip the caller draws, takes the
   * drag, and shows only a focus outline.
   */
  look?: "track" | "scrub";
  className?: string;
}

/** A single-value slider. Each move of a drag reports its value; arrow keys step it. */
export function Slider({ label, min, max, step, value, onValueChange, look = "track", className }: SliderProps) {
  const scrub = look === "scrub";
  return (
    <BaseSlider.Root
      min={min}
      max={max}
      step={step}
      value={value}
      onValueChange={(next) => onValueChange(Array.isArray(next) ? (next[0] ?? value) : next)}
      className={cn(scrub ? "absolute inset-0" : "flex-1", className)}
    >
      <BaseSlider.Control className="flex h-full w-full cursor-ew-resize items-center">
        <BaseSlider.Track className={cn("w-full", scrub ? "h-full" : "h-1 rounded-sm bg-line")}>
          <BaseSlider.Thumb
            aria-label={label}
            className={
              scrub
                ? "h-full w-3 rounded-sm opacity-0 outline-none focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent"
                : "size-3 rounded-full bg-accent outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            }
          />
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  );
}
