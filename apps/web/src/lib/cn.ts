import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge, told the app's own `@theme` z-index names, so it knows two of them clash. The colours
 * (`chrome`, `panel`, `accent` ...) and the one radius (`sm`) need no entry: it reads an unknown colour word
 * as a colour, and `sm` is a name it already has. Keep this list in step with `--z-index-*` in `styles.css`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      z: [{ z: ["raised", "overlay", "dialog", "popup"] }],
    },
  },
});

/** Joins class names, and lets a later class win over an earlier one it conflicts with. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
