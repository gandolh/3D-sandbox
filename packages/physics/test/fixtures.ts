import { SceneDocument } from "@solstice/schema";

/** A room with a doorway, a floor, and one neighbour to collide with. */
export const baseScene = (): SceneDocument =>
  SceneDocument.parse({
    schemaVersion: 1,
    id: "physics-fixture",
    title: "Physics Fixture",
    site: {
      latitude: 44.4,
      longitude: 26.1,
      timezone: "Europe/Bucharest",
      terrain: { kind: "flat", size: [80, 80], material: "m" },
    },
    solar: { date: "2026-06-21", time: "12:00" },
    materials: { m: { label: "M", source: "procedural", baseColor: "#888888" } },
    subject: {
      levels: [
        {
          id: "L1",
          name: "Ground",
          elevation: 0,
          height: 2.7,
          walls: [
            {
              id: "W-01",
              start: [0, 0],
              end: [6, 0],
              thickness: 0.24,
              material: "m",
              openings: [{ id: "d-01", kind: "door", offset: 2.5, width: 1, height: 2.1, sill: 0 }],
            },
            { id: "W-02", start: [6, 0], end: [6, 5], thickness: 0.24, material: "m" },
          ],
          slabs: [
            {
              id: "slab-1",
              polygon: [
                [0, 0],
                [6, 0],
                [6, 5],
                [0, 5],
              ],
              thickness: 0.25,
              material: "m",
            },
          ],
        },
      ],
    },
    context: {
      masses: [
        {
          id: "n-01",
          footprint: [
            [20, 20],
            [28, 20],
            [28, 27],
            [20, 27],
          ],
          height: 6,
          material: "m",
        },
      ],
    },
  });
