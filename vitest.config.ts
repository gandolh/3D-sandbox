import { defineConfig } from "vitest/config";

/**
 * Two projects, split by what a test *needs* rather than by where it lives.
 *
 * Almost everything here is headless by design — the generator, the linter, the
 * solar maths, the plan drawing, the API — and giving those a DOM would be
 * paying for a browser they never touch. One of them actively breaks in one:
 * `contrast.test.ts` reads `styles.css` off disk, and under a DOM environment
 * `import.meta.url` is an `http:` URL that `fileURLToPath` refuses.
 *
 * But the app's chrome cannot be tested without a DOM, and until it had one
 * **every `.tsx` file in the repo had zero tests** — the keyboard access from
 * brief 36, the live regions from brief 35, and `Field`'s commit behaviour from
 * brief 51 were all verified by reading.
 *
 * **The convention is the file extension.** A test that renders components is
 * `.test.tsx` and gets `happy-dom`; everything else is `.test.ts` and gets
 * Node. That is self-describing — a test needing a DOM is one that writes JSX —
 * and it left all 27 existing test files exactly where they were.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          // `assets/` is scripts rather than a workspace, but the bake server's
          // path guards are security code and have to be tested like it.
          include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts", "assets/test/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "web",
          environment: "happy-dom",
          include: ["apps/web/test/**/*.test.tsx"],
          setupFiles: ["apps/web/test/setup.ts"],
        },
      },
    ],
  },
});
