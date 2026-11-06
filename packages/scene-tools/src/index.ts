/**
 * Working with a scene file from outside the app: read it, lint it with the
 * build's options, draw a level's plan. `scenes/build.ts` and `apps/cli` use
 * it, and anything later that offers the same checks (an MCP server, say)
 * should too, so every caller gets the same answer for the same file.
 */
export * from "./files.ts";
export * from "./lint-options.ts";
