// The house dependency-cruiser preset, from the vendored house-style copy: no cycles, no unresolvable
// imports, a feature used through its index only, no Fastify in lib/.
module.exports = {
  extends: "./vendor/house-style/.dependency-cruiser.cjs",
  forbidden: [
    // A warning for now (2026-11-11): packages/solar/src/sky-map.ts imports packages/solar/src/index.ts, which
    // re-exports it. When sky-map.ts imports what it needs from the module that defines it, this goes and the
    // rule is an error again.
    { name: "no-circular", severity: "warn" },
  ],
};
