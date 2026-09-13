import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SceneDocument, type SceneDocumentInput } from "@solstice/schema";
import { planSvg } from "../src/plan.js";
import { WEIGHT } from "../src/style.js";

/**
 * The whole drawing is a string, which is the point.
 *
 * A plan has to be generatable on a machine with no browser and no GPU — the
 * same reason `skyRadianceMap` is pure arithmetic — and the payoff is that
 * every convention it claims to follow can be *asserted* rather than eyeballed.
 * A screenshot cannot tell you whether a door has a swing arc.
 */
const scene = (id: string): SceneDocument =>
  SceneDocument.parse(
    JSON.parse(
      readFileSync(fileURLToPath(new URL(`../../../scenes/${id}.scene.json`, import.meta.url)), "utf8"),
    ),
  );

const greenhollow = scene("greenhollow");
const svg = planSvg(greenhollow);

/** The house's own walls — the ones the plan is of. */
const houseWalls = greenhollow.subject.levels[0]!.walls.filter((w) => /^(W-|P-)/.test(w.id));
const doors = houseWalls.flatMap((w) => w.openings.filter((o) => o.kind === "door"));
const windows = houseWalls.flatMap((w) => w.openings.filter((o) => o.kind === "window"));

describe("the plan is a drawing", () => {
  it("is an SVG with a real paper size", () => {
    expect(svg.startsWith("<svg")).toBe(true);
    // Millimetres, because a drawing at 1:100 is only a drawing if the sheet
    // has a size. 11.3 m of building at 10 mm/m is 113 mm plus margins.
    expect(svg).toMatch(/width="\d+(\.\d+)?mm" height="\d+(\.\d+)?mm"/);
  });

  it("draws one swing arc per door", () => {
    // The arc is the most information-dense mark on a floor plan: struck from
    // the hinge through 90°, it gives the clear width, the swing direction and
    // what the door will foul. A rectangle in a wall carries none of that.
    const arcs = svg.match(/ A\d/g) ?? [];
    expect(doors.length).toBeGreaterThan(5);
    expect(arcs).toHaveLength(doors.length);
  });

  it("draws glazing in every window", () => {
    const glazing = svg.match(/stroke="#7f9bb0"/g) ?? [];
    expect(windows.length).toBeGreaterThan(5);
    expect(glazing).toHaveLength(windows.length);
  });

  it("labels every room with its name and area", () => {
    for (const room of greenhollow.subject.levels[0]!.rooms) {
      expect(svg, room.name).toContain(room.name.toUpperCase());
    }
    expect(svg.match(/m²/g) ?? []).toHaveLength(greenhollow.subject.levels[0]!.rooms.length);
  });

  it("fills the cut walls with poché", () => {
    expect(svg).toContain('fill="#b8b4ad"');
  });

  it("keeps the line-weight hierarchy, heaviest for what is cut", () => {
    // The four-step hierarchy is what makes a drawing read as a drawing. If
    // every line claimed equal importance this would be a diagram.
    expect(WEIGHT.cut).toBeGreaterThan(WEIGHT.seen);
    expect(WEIGHT.seen).toBeGreaterThan(WEIGHT.symbol);
    expect(WEIGHT.symbol).toBeGreaterThan(WEIGHT.fine);
    // ISO 128-2 asks for at least 2:1 between thickest and thinnest.
    expect(WEIGHT.cut / WEIGHT.fine).toBeGreaterThanOrEqual(2);
  });

  it("quotes overall dimensions in millimetres", () => {
    // 11 m footprint plus 2 × 150 mm of wall either side of the centreline.
    expect(svg).toContain(">11300<");
    expect(svg).toContain(">12300<");
  });

  it("carries a scale bar and names its scale", () => {
    expect(svg).toContain("5 m");
    expect(svg).toContain("1:100");
  });
});

describe("the plan is a section, not a top view", () => {
  const cutAt = (cut: number) => planSvg(greenhollow, { cut });

  it("opens a wall where the plane passes through a door", () => {
    // At 1.2 m every door (sill 0, head 2.1+) is cut, so each becomes a hole
    // with jambs and a swing.
    expect((cutAt(1.2).match(/ A\d/g) ?? []).length).toBe(doors.length);
  });

  it("draws a door below the cut as a threshold, with no swing", () => {
    // Raise the plane above every head and nothing is cut any more: the doors
    // are *seen*, so they are dashed rather than swung. A top view cannot make
    // this distinction at all, which is the difference this test is about.
    const high = cutAt(2.5);
    expect(high.match(/ A\d/g) ?? []).toHaveLength(0);
    expect(high).toContain("stroke-dasharray");
  });
});

describe("the north point", () => {
  it("turns with the site's own rotation", () => {
    // `site.northOffset` is "scene +Z is true north rotated by this many
    // degrees", so true north on a sheet where +Z is up sits at −northOffset.
    // A north point that ignores the site's rotation is worse than none.
    expect(greenhollow.site.northOffset).toBe(40);
    expect(svg).toContain("rotate(-40)");
  });

  it("points up when the plot is square to the compass", () => {
    const square = planSvg(
      SceneDocument.parse({
        ...(JSON.parse(JSON.stringify(greenhollow)) as SceneDocumentInput),
        site: { ...greenhollow.site, northOffset: 0 },
      }),
    );
    expect(square).toContain("rotate(0)");
  });
});

describe("which building the plan is of", () => {
  it("draws the house, not the plot", () => {
    // The level also holds the garage, the greenhouse and a 32 m boundary
    // wall. Including the boundary would scale the sheet to the whole plot and
    // render the house 30 mm across.
    const width = Number(/width="([\d.]+)mm"/.exec(svg)![1]);
    expect(width).toBeGreaterThan(150);
    expect(width).toBeLessThan(200);
  });

  it("includes the partitions, which touch no external corner", () => {
    // Connectivity alone finds envelopes and misses partitions: `P-hall-w`
    // shares an endpoint with nothing. Grouping by connectivity drew the house
    // as four blank walls and lost six of its ten doors.
    const partitions = houseWalls.filter((w) => w.id.startsWith("P-"));
    expect(partitions.length).toBeGreaterThan(5);
    const internalDoors = partitions.flatMap((w) =>
      w.openings.filter((o) => o.kind === "door"),
    );
    expect((svg.match(/ A\d/g) ?? []).length).toBeGreaterThan(internalDoors.length);
  });
});
