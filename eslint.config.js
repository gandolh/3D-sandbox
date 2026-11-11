import { houseStyle, restrictedSyntax } from "./vendor/house-style/eslint.config.js";

/**
 * The house config from the vendored house-style copy, given Solstice's folders. Thin on purpose: the
 * compiler is the first gate, and the house adds only what it cannot see. The rules and the reason for
 * each are in the copy.
 */
const web = "apps/web/src";

export default [
  ...houseStyle({
    root: import.meta.dirname,
    web,
    tailwind: { css: "apps/web/src/styles.css" },
    server: "apps/api/src",
    // Run by hand, so they print and read the environment: the asset downloader and baker, and the scene CLI.
    scripts: ["assets", "apps/cli"],
    // Allowed to print: the scene build reports each scene, and the API entry says where it listens.
    console: ["scenes/build.ts", "apps/api/src/server.ts"],
    // A scene builder's default export is a load-time contract: scenes/build.ts reads `mod.default`.
    defaultExports: ["scenes/src/*.ts"],
    // The scene files and the downloaded assets are data; assets-src/ is gitignored.
    ignores: ["assets-src/**", "apps/api/.data/**"],
    // Typed lint reads every tsconfig: the packages' src/, the web app, the scene sources, the two tools,
    // and the tests config that holds the tests, the asset scripts and the Vitest config.
    typed: {
      project: ["packages/*/tsconfig.json", "apps/*/tsconfig.json", "scenes/tsconfig.json", "tsconfig.tests.json"],
    },
  }),
  {
    // Carried over from Biome: a button says its type, a modal's first control takes focus on purpose
    // (each use says why), and HTML is injected only from this repo's own plan drawing.
    name: "solstice/web-restricted-syntax",
    files: [`${web}/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...restrictedSyntax,
        {
          selector: "JSXOpeningElement[name.name='button']:not(:has(JSXAttribute[name.name='type']))",
          message: "A <button> inside a form submits it: give it a type.",
        },
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "Injected HTML needs a reason: only markup this repo builds itself, and a disable that says so.",
        },
        {
          selector: "JSXAttribute[name.name='autoFocus']",
          message: "autoFocus moves focus on mount: only a modal's first control, with a disable that says why.",
        },
      ],
    },
  },
  {
    // The bake page runs in a browser, not in Node.
    name: "solstice/bake-page-globals",
    files: ["assets/bake/impostor.js"],
    languageOptions: {
      globals: { document: "readonly", location: "readonly", requestAnimationFrame: "readonly", window: "readonly" },
    },
  },
  {
    // A warning for now (2026-11-11): the plan tools mirror state into a ref during render so a window key
    // listener bound once reads the latest value, and reset state in an effect when the document or level
    // changes. Rewriting that changes how the drawing tools behave. When the tools are reworked, this block
    // goes and these rules are errors again.
    name: "solstice/plan-tools-compiler-rules-warn",
    files: [`${web}/ui/plan/use*Tool*.tsx`],
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
    },
  },
];
