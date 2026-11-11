/** Every floating panel: a select's list, a popover. */
export const panel = [
  "origin-(--transform-origin) rounded-sm border border-line bg-panel text-ink shadow-lg outline-none",
  "motion-safe:transition-[opacity,scale] motion-safe:duration-100",
  "data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
].join(" ");

/** A row in a select's list. */
export const row = [
  "flex cursor-default items-center gap-2 rounded-sm px-2 py-1 text-[11.5px] text-ink outline-none select-none",
  "data-disabled:opacity-40 data-highlighted:bg-accent-soft",
].join(" ");
