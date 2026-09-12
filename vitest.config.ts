import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // `assets/` is scripts rather than a workspace, but the bake server's
    // path guards are security code and have to be tested like it.
    include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts", "assets/test/**/*.test.ts"],
  },
});
