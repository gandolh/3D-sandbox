/**
 * `npm run solstice -- <command> <file>`: lint a scene file, or draw a level's
 * plan, from outside the app. `run.ts` holds the CLI; this wires it to the
 * process.
 *
 * Run with plain `node`, as `scenes/build.ts` is; Node strips the types itself.
 * `npm run` starts scripts in the repo root, so relative paths resolve against
 * `INIT_CWD`, the directory the command was typed in.
 */
import { run } from "./run.ts";

process.exitCode = await run(process.argv.slice(2), {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  cwd: process.env.INIT_CWD ?? process.cwd(),
});
