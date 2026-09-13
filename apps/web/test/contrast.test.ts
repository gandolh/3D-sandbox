import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The palette's text tones must clear WCAG AA, in both themes.
 *
 * Read out of `styles.css` and computed, rather than written down beside it.
 * The comment in that file records the measured ratios, and a comment is what
 * this project has repeatedly found disagreeing with the thing it describes —
 * the whole point of this test is that the numbers cannot drift from the hex
 * values they claim to describe.
 */

const css = readFileSync(fileURLToPath(new URL("../src/styles.css", import.meta.url)), "utf8");

/** Tokens from one block of the stylesheet. */
const tokens = (block: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    out[name!] = value!;
  }
  return out;
};

const light = tokens(css.slice(css.indexOf(':root[data-theme="light"]')));
// Everything before the light block is the dark default.
const dark = tokens(css.slice(0, css.indexOf(':root[data-theme="light"]')));

const channel = (c: number): number => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string): number => {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (hi! + 0.05) / (lo! + 0.05);
};

const AA = 4.5;

describe.each([
  ["dark", dark],
  ["light", light],
])("%s theme", (_name, theme) => {
  it("parsed a full palette", () => {
    for (const key of ["chrome", "panel", "ink", "muted", "subtle", "danger", "warn", "faint"]) {
      expect(theme[key], key).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  // `subtle` is the app's own status line, the inspector's empty state, and
  // every badge and axis label — the one place the app says what it just did.
  // It was the least legible text in the interface: 3.20 and 3.06 in dark,
  // 2.73 and 2.99 in light, against a 4.5 floor.
  it.each(["ink", "muted", "subtle", "danger", "warn"])("%s clears AA on both grounds", (token) => {
    expect(contrast(theme[token]!, theme.chrome!)).toBeGreaterThanOrEqual(AA);
    expect(contrast(theme[token]!, theme.panel!)).toBeGreaterThanOrEqual(AA);
  });

  it("keeps a genuinely quiet tone available, and out of the text tokens", () => {
    // `faint` is deliberately below the floor — a tone quiet enough to read as
    // ornament cannot also be legible body text. It exists so `subtle` could be
    // raised without losing the quieter register entirely, and it must never be
    // used for text. Asserted here so the split stays deliberate.
    expect(contrast(theme.faint!, theme.panel!)).toBeLessThan(AA);
  });

  it("keeps subtle quieter than muted", () => {
    // Otherwise the two tokens have collapsed into one and the hierarchy the
    // palette describes is not there.
    const away = (token: string) => Math.abs(luminance(theme[token]!) - luminance(theme.chrome!));
    expect(away("subtle")).toBeLessThan(away("muted"));
  });
});

describe("the stylesheet's own claims", () => {
  it("does not use faint for text anywhere", () => {
    // The one thing a ratio cannot check: that the ornament token stayed
    // ornament.
    const sources = import.meta.glob("../src/**/*.tsx", {
      eager: true,
      query: "?raw",
      import: "default",
    }) as Record<string, string>;
    const offenders = Object.entries(sources)
      .filter(([, source]) => source.includes("text-faint"))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
