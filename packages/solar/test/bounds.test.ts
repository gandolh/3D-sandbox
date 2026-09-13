import { describe, expect, it } from "vitest";
import { dayBounds } from "../src/index.js";

const SITE = {
  latitude: 44.4268,
  longitude: 26.1025,
  timezone: "Europe/Bucharest",
  northOffset: 0,
} as never;

/**
 * The property that makes hoisting `dayBounds` out of a per-frame memo safe.
 *
 * It was computed alongside `sunPosition` on `[doc, minutes]`, and `minutes`
 * changes every animation frame — so four astronomical calculations ran ~60
 * times a second for an answer that cannot change until the date does.
 */
describe("dayBounds", () => {
  it("is the same all day, whatever clock it is handed", () => {
    const at = (time: string) => dayBounds(SITE, { date: "2026-06-21", time } as never);
    const noon = JSON.stringify(at("12:00"));
    for (const time of ["00:00", "06:30", "17:42", "23:59"]) {
      expect(JSON.stringify(at(time)), time).toBe(noon);
    }
  });

  it("does change when the date does", () => {
    const june = dayBounds(SITE, { date: "2026-06-21", time: "12:00" } as never);
    const december = dayBounds(SITE, { date: "2026-12-21", time: "12:00" } as never);
    expect(december.labels.sunrise).not.toBe(june.labels.sunrise);
  });
});
