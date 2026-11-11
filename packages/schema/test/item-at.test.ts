import { describe, expect, it } from "vitest";
import { itemAt } from "../src/index.js";

describe("itemAt", () => {
  it("returns the item at an index in range", () => {
    expect(itemAt(["a", "b", "c"], 2)).toBe("c");
  });

  it("names the index when it is out of range", () => {
    expect(() => itemAt(["a"], 3)).toThrow("index 3 is outside an array of 1");
    expect(() => itemAt([], 0)).toThrow(RangeError);
  });
});
