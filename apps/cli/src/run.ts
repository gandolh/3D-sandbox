import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { lintSceneFile, planSceneFile } from "@solstice/scene-tools";
import { formatFinding, type LintFinding } from "@solstice/schema";

/** Where the CLI writes, and what relative paths are relative to. */
export interface Io {
  stdout(text: string): void;
  stderr(text: string): void;
  cwd: string;
}

export const USAGE = `Usage: npm run solstice -- <command> <file> [options]

Commands:
  lint <file>         Lint a scene file with the options \`npm run scenes\` uses,
                      real-asset list included. Prints each finding, then a count.
      --json          Print the findings as JSON instead.
  plan <file>         Draw a level's floor plan as SVG. A scene with lint errors
                      is refused, with the errors printed.
      --level <id>    The level to draw. Default: the first.
      --out <path>    Write the SVG to a file. Default: stdout.

Options:
  -h, --help          Print this.

Exit codes:
  0  no lint errors (warnings allowed); for plan, the plan was drawn
  1  the scene has lint errors, or the plan cannot be drawn
  2  the file cannot be read or is not JSON, or the command line is wrong

Run through npm with -s (\`npm run -s solstice -- ...\`) when you read stdout,
so npm's own header lines stay out of the JSON or the SVG.
`;

const OPTIONS = {
  json: { type: "boolean" },
  level: { type: "string" },
  out: { type: "string" },
  help: { type: "boolean", short: "h" },
} as const;

/** Which options each command takes. */
const ACCEPTS: Record<string, readonly (keyof typeof OPTIONS)[]> = {
  lint: ["json"],
  plan: ["level", "out"],
};

/**
 * The whole CLI, minus the process: parse `argv`, run the command, print,
 * and return the exit code. The entry point only wires it to `process`.
 */
export async function run(argv: readonly string[], io: Io): Promise<number> {
  let parsed: ReturnType<typeof parseArgs<{ options: typeof OPTIONS; allowPositionals: true }>>;
  try {
    parsed = parseArgs({ args: [...argv], options: OPTIONS, allowPositionals: true, strict: true });
  } catch (error) {
    return usageError(io, (error as Error).message);
  }
  const { values, positionals } = parsed;

  if (values.help === true) {
    io.stdout(USAGE);
    return 0;
  }

  const [command, file, ...extra] = positionals;
  if (command === undefined) return usageError(io, "missing <command>: lint or plan");
  const accepts = ACCEPTS[command];
  if (accepts === undefined) return usageError(io, `unknown command "${command}"`);
  if (file === undefined) return usageError(io, `${command}: missing <file>, the scene file to ${command}`);
  if (extra.length > 0) return usageError(io, `${command}: unexpected argument "${extra[0]}"`);
  const stray = (Object.keys(values) as (keyof typeof OPTIONS)[]).find((k) => !accepts.includes(k));
  if (stray !== undefined) return usageError(io, `${command} does not take --${stray}`);

  const path = resolve(io.cwd, file);
  return command === "lint"
    ? lint(io, file, path, values.json === true)
    : plan(io, file, path, values.level, values.out);
}

async function lint(io: Io, file: string, path: string, json: boolean): Promise<number> {
  const result = await lintSceneFile(path);
  if (result.kind === "unreadable") {
    io.stderr(`${file}: ${result.reason}\n`);
    return 2;
  }

  const { findings, errors, warnings } = result;
  if (json) {
    io.stdout(`${JSON.stringify({ file, errors, warnings, findings }, null, 2)}\n`);
  } else {
    for (const f of findings) io.stdout(`${formatFinding(f)}\n`);
    io.stdout(`${file}: ${count(errors, "error")}, ${count(warnings, "warning")}\n`);
  }
  return errors > 0 ? 1 : 0;
}

async function plan(
  io: Io,
  file: string,
  path: string,
  levelId: string | undefined,
  out: string | undefined,
): Promise<number> {
  const result = await planSceneFile(path, levelId);
  if (result.kind === "unreadable") {
    io.stderr(`${file}: ${result.reason}\n`);
    return 2;
  }
  if (result.kind === "refused") {
    io.stderr(`${file}: no plan drawn: ${result.reason}\n`);
    printFindings(io, result.findings);
    return 1;
  }

  if (out === undefined) {
    io.stdout(result.svg);
    return 0;
  }
  try {
    await writeFile(resolve(io.cwd, out), result.svg, "utf8");
  } catch (error) {
    io.stderr(`${out}: cannot write it: ${(error as Error).message}\n`);
    return 2;
  }
  io.stdout(`wrote ${out} (level ${result.levelId})\n`);
  return 0;
}

function printFindings(io: Io, findings: readonly LintFinding[]): void {
  for (const f of findings) io.stderr(`${formatFinding(f)}\n`);
}

function usageError(io: Io, message: string): number {
  io.stderr(`${message}\n\n${USAGE}`);
  return 2;
}

const count = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? "" : "s"}`;
