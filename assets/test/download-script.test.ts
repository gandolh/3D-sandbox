import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * `fetch_one`, the shell helper the generated download scripts share.
 *
 * Tested as shell, because that is what it is. The defect it exists for cannot
 * be reasoned about from the TypeScript that emits it: `curl -fsSL -o "$target"`
 * writes **in place**, and the only guard was `[ -f "$target" ]` — so a transfer
 * cut off mid-stream left a truncated file that, because it existed, every
 * future run skipped forever. `curl -f` does not cover that; it guards against
 * an HTTP error *response*, not a connection dropping mid-body.
 *
 * `file://` URLs rather than a server: curl handles them, and what is under
 * test is the temp-file-and-rename dance, not HTTP.
 */

const script = readFileSync(
  fileURLToPath(new URL("../../assets-src/download.sh", import.meta.url)),
  "utf8",
);

/** The helper, lifted out of the generated script so the real text is tested. */
const helper = script.slice(script.indexOf("fetch_one() {"), script.indexOf("\n}\n") + 3);

let dir: string;
let source: string;
const BODY = "x".repeat(4096);

beforeAll(() => {
  expect(helper).toMatch(/^fetch_one\(\) \{/);
  dir = mkdtempSync(join(tmpdir(), "solstice-dl-"));
  source = join(dir, "source.bin");
  writeFileSync(source, BODY);
});

/** Run `fetch_one url target want` against the real helper text. */
const run = (target: string, want: number): { ok: boolean; err: string } => {
  try {
    const err = execFileSync(
      "bash",
      // stderr folded into stdout: the warnings are the interesting output, and
      // `execFileSync` only hands back the latter.
      [
        "-c",
        `set -euo pipefail\n${helper}\nfetch_one "file://${source}" "${target}" ${want} 2>&1`,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return { ok: true, err };
  } catch (error) {
    // stdout, because the invocation folds stderr into it — and a non-zero
    // exit still carries whatever was written before the failure.
    const e = error as { stdout?: string; stderr?: string };
    return { ok: false, err: String(e.stdout ?? "") + String(e.stderr ?? "") };
  }
};

describe("fetch_one", () => {
  it("downloads a file that is not there", () => {
    const target = join(dir, "fresh.bin");
    expect(run(target, BODY.length).ok).toBe(true);
    expect(readFileSync(target, "utf8")).toBe(BODY);
  });

  it("leaves a complete file alone", () => {
    const target = join(dir, "already.bin");
    writeFileSync(target, BODY);
    const before = statSync(target).mtimeMs;
    expect(run(target, BODY.length).ok).toBe(true);
    expect(statSync(target).mtimeMs).toBe(before);
  });

  it("refetches a file that is the wrong length", () => {
    // The brief's case: interrupt a download, run the script again. Before this
    // the file existed, so it was skipped — forever, silently, and the scene
    // loaded broken geometry because `assets/manifest.ts` checks a file is
    // present, never that it is valid.
    const target = join(dir, "truncated.bin");
    writeFileSync(target, BODY.slice(0, 1000));
    const result = run(target, BODY.length);
    expect(result.ok).toBe(true);
    expect(result.err).toMatch(/refetching/);
    expect(readFileSync(target, "utf8")).toBe(BODY);
  });

  it("refetches something implausibly small for any asset", () => {
    // The shape of a saved error page, which this project has shipped once. No
    // expected size is needed to know a 20-byte model is wrong.
    const target = join(dir, "errorpage.bin");
    writeFileSync(target, "<html>404</html>");
    const result = run(target, 0);
    expect(result.ok).toBe(true);
    expect(result.err).toMatch(/suspiciously small/);
    expect(readFileSync(target, "utf8")).toBe(BODY);
  });

  it("refuses to install a download that arrives the wrong length", () => {
    const target = join(dir, "mismatch.bin");
    const result = run(target, BODY.length + 1);
    expect(result.ok).toBe(false);
    expect(result.err).toMatch(/expected/);
    // Nothing left behind for the next run to accept.
    expect(existsSync(target)).toBe(false);
    expect(existsSync(`${target}.part`)).toBe(false);
  });

  it("ignores a stale .part from an interrupted run", () => {
    // The point of the temp name: what an interruption leaves is not something
    // the existence check will ever accept.
    const target = join(dir, "resumed.bin");
    writeFileSync(`${target}.part`, "half");
    expect(run(target, BODY.length).ok).toBe(true);
    expect(readFileSync(target, "utf8")).toBe(BODY);
  });
});

describe("the generated scripts", () => {
  it("route every download through the helper", () => {
    // A single `curl -o "$target"` slipping back in would restore the bug for
    // that one asset, quietly.
    for (const name of ["download.sh", "download-heavy.sh"]) {
      const text = readFileSync(
        fileURLToPath(new URL(`../../assets-src/${name}`, import.meta.url)),
        "utf8",
      );
      const direct = text
        .split("\n")
        .filter((line) => line.includes("curl") && !line.startsWith("  curl -fsSL -o \"$target.part\""));
      expect(direct, name).toEqual([]);
    }
  });

  it("quotes a real size for every fetched asset", () => {
    // "—" used to stand for an unknown size, which reads as a small one — and
    // that is how ambientCG sat outside the heavy-asset split entirely, its
    // `bytes` hardcoded to 0 while the API reported a real number all along.
    const md = readFileSync(
      fileURLToPath(new URL("../../assets-src/DOWNLOADS.md", import.meta.url)),
      "utf8",
    );
    expect(md).not.toMatch(/\| — \|/);
    expect(md).not.toMatch(/size unknown/);
  });
});
