import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { planSvg } from "@solstice/drawing";
import { SceneDocument } from "@solstice/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { run, USAGE } from "../src/run.ts";

/**
 * The CLI without the process: `run` gets the arguments and a fake terminal,
 * and returns the exit code. Paths are relative to the repo root, as they are
 * under `npm run solstice --`.
 */
const root = fileURLToPath(new URL("../../../", import.meta.url));

interface Ran {
  code: number;
  stdout: string;
  stderr: string;
}

async function cli(...argv: string[]): Promise<Ran> {
  let stdout = "";
  let stderr = "";
  const code = await run(argv, {
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
    cwd: root,
  });
  return { code, stdout, stderr };
}

const GREENHOLLOW = "scenes/greenhollow.scene.json";

let tmp: string;
/** A copy of Greenhollow with one opening made wider than its wall. */
let widened: string;
let widenedId: string;

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "solstice-cli-"));
  type Point = [number, number];
  const doc = JSON.parse(await readFile(join(root, GREENHOLLOW), "utf8")) as {
    subject: {
      levels: {
        walls: { start: Point; end: Point; openings: { id: string; offset: number; width: number }[] }[];
      }[];
    };
  };
  // A wall with one opening, so the only error is the opening running past the wall's end.
  const wall = doc.subject.levels[0]?.walls.find((w) => w.openings.length === 1);
  const opening = wall?.openings[0];
  if (wall === undefined || opening === undefined) throw new Error("greenhollow has no lone opening to widen");
  const length = Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
  opening.width = length - opening.offset + 0.5;
  widenedId = opening.id;
  widened = join(tmp, "widened.scene.json");
  await writeFile(widened, JSON.stringify(doc), "utf8");
});
afterAll(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe("arguments", () => {
  it("prints the usage on --help and exits 0", async () => {
    for (const flag of ["--help", "-h"]) {
      const { code, stdout } = await cli(flag);
      expect(code).toBe(0);
      expect(stdout).toBe(USAGE);
    }
  });

  it("prints the usage for no command or an unknown one, and exits 2", async () => {
    const none = await cli();
    expect(none.code).toBe(2);
    expect(none.stderr).toContain("missing <command>");
    expect(none.stderr).toContain(USAGE);

    const unknown = await cli("render", GREENHOLLOW);
    expect(unknown.code).toBe(2);
    expect(unknown.stderr).toContain('unknown command "render"');
    expect(unknown.stderr).toContain(USAGE);
  });

  it("says which argument is missing", async () => {
    const file = await cli("lint");
    expect(file.code).toBe(2);
    expect(file.stderr).toMatch(/^lint: missing <file>/);

    const level = await cli("plan", GREENHOLLOW, "--level");
    expect(level.code).toBe(2);
    expect(level.stderr).toContain("--level");
  });

  it("refuses an option the command does not take, and an unknown one", async () => {
    expect((await cli("lint", GREENHOLLOW, "--out", "x.svg")).stderr).toMatch(/^lint does not take --out/);
    expect((await cli("plan", GREENHOLLOW, "--json")).code).toBe(2);
    expect((await cli("lint", GREENHOLLOW, "--fix")).code).toBe(2);
    expect((await cli("lint", GREENHOLLOW, "extra")).stderr).toMatch(/^lint: unexpected argument "extra"/);
  });
});

describe("lint", () => {
  it("exits 0 on a clean scene and ends with the count", async () => {
    const { code, stdout } = await cli("lint", GREENHOLLOW);
    expect(code).toBe(0);
    expect(stdout).toBe(`${GREENHOLLOW}: 0 errors, 0 warnings\n`);
  });

  it("exits 1 and names the finding when an opening is wider than its wall", async () => {
    const { code, stdout } = await cli("lint", widened);
    expect(code).toBe(1);
    const lines = stdout.trimEnd().split("\n");
    expect(lines[0]).toMatch(new RegExp(`^✗ \\S+ \\[opening-fits-wall\\] opening "${widenedId}" ends at`));
    expect(lines.at(-1)).toMatch(/: 1 error, \d+ warnings?$/);
  });

  it("prints the findings as JSON with --json", async () => {
    const { code, stdout } = await cli("lint", widened, "--json");
    expect(code).toBe(1);
    const out = JSON.parse(stdout) as { file: string; errors: number; findings: { rule: string }[] };
    expect(out.file).toBe(widened);
    expect(out.errors).toBe(1);
    expect(out.findings[0]?.rule).toBe("opening-fits-wall");
  });

  it("exits 2 when the file is missing or is not JSON", async () => {
    const missing = await cli("lint", "scenes/no-such.scene.json");
    expect(missing.code).toBe(2);
    expect(missing.stderr).toBe("scenes/no-such.scene.json: no such file\n");

    const garbled = join(tmp, "garbled.scene.json");
    await writeFile(garbled, "not json", "utf8");
    const notJson = await cli("lint", garbled, "--json");
    expect(notJson.code).toBe(2);
    expect(notJson.stdout).toBe("");
    expect(notJson.stderr).toContain("not JSON");
  });
});

describe("plan", () => {
  const expected = async (): Promise<string> =>
    planSvg(SceneDocument.parse(JSON.parse(await readFile(join(root, GREENHOLLOW), "utf8"))));

  it("writes planSvg's drawing of the first level to stdout", async () => {
    const { code, stdout } = await cli("plan", GREENHOLLOW);
    expect(code).toBe(0);
    expect(stdout).toBe(await expected());
  });

  it("writes it to --out and says where", async () => {
    const out = join(tmp, "greenhollow.svg");
    const { code, stdout } = await cli("plan", GREENHOLLOW, "--out", out);
    expect(code).toBe(0);
    expect(stdout).toMatch(/^wrote .*greenhollow\.svg \(level \S+\)\n$/);
    expect(await readFile(out, "utf8")).toBe(await expected());
  });

  it("refuses a scene with lint errors, printing them, and exits 1", async () => {
    const out = join(tmp, "widened.svg");
    const { code, stdout, stderr } = await cli("plan", widened, "--out", out);
    expect(code).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toContain("no plan drawn: 1 lint error");
    expect(stderr).toContain("[opening-fits-wall]");
    await expect(readFile(out, "utf8")).rejects.toThrow();
  });

  it("refuses an unknown level and exits 1", async () => {
    const { code, stderr } = await cli("plan", GREENHOLLOW, "--level", "attic");
    expect(code).toBe(1);
    expect(stderr).toContain('no level "attic"');
  });
});
