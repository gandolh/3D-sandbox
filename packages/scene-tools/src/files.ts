import { readFile } from "node:fs/promises";
import { planSvg } from "@solstice/drawing";
import {
  errorsOf,
  type LintFinding,
  loadScene,
  type SceneDocument,
  SceneValidationError,
} from "@solstice/schema";
import { sceneLintOptions } from "./lint-options.ts";

/** The file could not be linted at all: it could not be read, or it is not JSON. */
export interface Unreadable {
  kind: "unreadable";
  path: string;
  reason: string;
}

/** The file was read and linted. */
export interface Linted {
  kind: "linted";
  path: string;
  /** Errors first, then warnings, in rule order, as `lintScene` reports them. */
  findings: readonly LintFinding[];
  errors: number;
  warnings: number;
  /** The parsed document. Absent when it has errors: `loadScene` refuses those. */
  document?: SceneDocument;
}

export type SceneFileLint = Unreadable | Linted;

/**
 * Read a scene file, parse it, and lint it with the build's options.
 *
 * Never throws for a bad file; the result says why. A file that is valid JSON
 * but the wrong shape is `linted`, with `schema` findings, because that is a
 * mistake in the scene, the same as any other error a rule finds. Only a file
 * that cannot be read or parsed as JSON is `unreadable`.
 */
export async function lintSceneFile(path: string): Promise<SceneFileLint> {
  const read = await readJson(path);
  if (read.kind === "unreadable") return read;

  const { options } = await sceneLintOptions();
  try {
    const { document, findings } = loadScene(read.json, options);
    return linted(path, findings, document);
  } catch (error) {
    // `loadScene` reports shape and lint errors alike by throwing this.
    if (error instanceof SceneValidationError) return linted(path, error.findings);
    throw error;
  }
}

export interface Plan {
  kind: "plan";
  path: string;
  /** The level drawn. */
  levelId: string;
  svg: string;
  /** Warnings only: a scene with errors is refused. */
  findings: readonly LintFinding[];
}

/** The scene was read but no plan was drawn, and why. */
export interface Refused {
  kind: "refused";
  path: string;
  reason: string;
  /** The lint errors (and warnings) when that is the reason; empty otherwise. */
  findings: readonly LintFinding[];
}

export type ScenePlan = Unreadable | Refused | Plan;

/**
 * Draw one level's floor plan, as `planSvg` does, from a scene file.
 *
 * A scene with lint errors is refused, since a plan of a broken scene
 * misleads. So is a level id the scene does not have: `planSvg` would quietly
 * draw the first level instead, which is the wrong drawing with no warning.
 */
export async function planSceneFile(path: string, levelId?: string): Promise<ScenePlan> {
  const lint = await lintSceneFile(path);
  if (lint.kind === "unreadable") return lint;

  const { document, findings } = lint;
  if (document === undefined) {
    return {
      kind: "refused",
      path,
      reason: `${count(lint.errors, "lint error")}; fix ${lint.errors === 1 ? "it" : "them"} first`,
      findings,
    };
  }

  const levels = document.subject.levels;
  const level = levelId === undefined ? levels[0] : levels.find((l) => l.id === levelId);
  if (level === undefined) {
    const known = levels.map((l) => l.id).join(", ");
    return {
      kind: "refused",
      path,
      reason:
        levelId === undefined
          ? "the scene has no levels"
          : `the scene has no level "${levelId}"${known === "" ? "" : `; its levels are ${known}`}`,
      findings: [],
    };
  }
  if (level.walls.length === 0) {
    return { kind: "refused", path, reason: `level "${level.id}" has no walls to draw`, findings: [] };
  }

  return { kind: "plan", path, levelId: level.id, svg: planSvg(document, { levelId: level.id }), findings };
}

type Read = Unreadable | { kind: "json"; json: unknown };

async function readJson(path: string): Promise<Read> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    return { kind: "unreadable", path, reason: readFailure(error) };
  }
  try {
    return { kind: "json", json: JSON.parse(text) as unknown };
  } catch (error) {
    return { kind: "unreadable", path, reason: `not JSON: ${(error as Error).message}` };
  }
}

function readFailure(error: unknown): string {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "ENOENT") return "no such file";
  if (code === "EISDIR") return "a directory, not a file";
  if (code === "EACCES") return "not allowed to read it";
  return `cannot read it: ${(error as Error).message}`;
}

function linted(path: string, findings: readonly LintFinding[], document?: SceneDocument): Linted {
  const errors = errorsOf(findings).length;
  return {
    kind: "linted",
    path,
    findings,
    errors,
    warnings: findings.length - errors,
    ...(document === undefined ? {} : { document }),
  };
}

const count = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? "" : "s"}`;
