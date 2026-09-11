import type { SceneDocumentInput } from "../src/index.js";

/**
 * The smallest document that passes every rule. Tests clone it and break one
 * thing, so a test that fails tells you exactly which rule fired.
 */
export const baseScene = (): SceneDocumentInput => ({
  schemaVersion: 1,
  id: "fixture",
  title: "Fixture",
  site: {
    latitude: 44.4268,
    longitude: 26.1025,
    timezone: "Europe/Bucharest",
    terrain: { kind: "flat", material: "wall" },
  },
  solar: { date: "2026-06-21", time: "12:00" },
  materials: {
    wall: { label: "Wall", source: "procedural", baseColor: "#C9C3B6" },
    roof: { label: "Roof", source: "procedural", baseColor: "#4A4642" },
  },
  subject: {
    levels: [
      {
        id: "L1",
        name: "Ground",
        elevation: 0,
        height: 2.7,
        walls: [
          { id: "W-01", start: [0, 0], end: [6, 0], material: "wall" },
          { id: "W-02", start: [6, 0], end: [6, 8], material: "wall" },
          { id: "W-03", start: [6, 8], end: [0, 8], material: "wall" },
          { id: "W-04", start: [0, 8], end: [0, 0], material: "wall" },
        ],
      },
    ],
    roofs: [
      {
        id: "R-01",
        kind: "gable",
        footprint: [
          [-0.4, -0.4],
          [6.4, -0.4],
          [6.4, 8.4],
          [-0.4, 8.4],
        ],
        baseElevation: 2.7,
        pitch: 32,
        overhang: 0.4,
        material: "roof",
      },
    ],
  },
});
