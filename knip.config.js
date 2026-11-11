import preset from "./vendor/house-style/knip.json" with { type: "json" };

// knip has no `extends`, so this spreads the house preset and names what knip cannot follow on its own:
// files that Node runs by name, and files a script loads by reading a folder.
export default {
  ...preset,
  workspaces: {
    ".": {
      // The check script is run by `check:fast`; the bake server and its page are started by hand.
      entry: ["scripts/*.mjs", "assets/bake/serve.ts", "assets/bake/impostor.js"],
      // The Vitest config names the happy-dom environment as a string, and the bake page loads three
      // through an import map in the browser.
      ignoreDependencies: ["happy-dom", "three"],
    },
    // `npm run api` starts the built server through a script knip does not follow.
    "apps/api": { entry: ["src/server.ts"] },
    // scenes/build.ts imports every file in src/ by reading the folder.
    scenes: { entry: ["src/*.ts"] },
    // Left alone for now (2026-11-11): the package declares this and never imports it (the physics package
    // does). When the dependency is dropped from its package.json, this entry goes.
    "packages/geometry": { ignoreDependencies: ["@dimforge/rapier3d-compat"] },
  },
};
