import type { z } from "zod";
import { SceneDocument } from "./document.js";
import { errorsOf, formatFinding, type LintFinding, type LintOptions, lintScene } from "./lint/index.js";

export class SceneValidationError extends Error {
  readonly findings: readonly LintFinding[];

  constructor(documentId: string, findings: readonly LintFinding[]) {
    const errors = errorsOf(findings);
    super(
      `Scene "${documentId}" has ${errors.length} error${errors.length === 1 ? "" : "s"}:\n` +
        findings.map((f) => `  ${formatFinding(f)}`).join("\n"),
    );
    this.name = "SceneValidationError";
    this.findings = findings;
  }
}

export interface LoadResult {
  document: SceneDocument;
  /** Warnings only — errors throw. */
  findings: readonly LintFinding[];
}

/**
 * Parse, then lint. A document that fails either does not load.
 *
 * Nothing in this project ever writes an invalid document: the API validates on
 * write, the build step validates on emit, and the editor validates on load. A
 * malformed scene should be impossible to persist, not merely discouraged.
 */
export function loadScene(input: unknown, options: LintOptions = {}): LoadResult {
  const parsed = SceneDocument.safeParse(input);
  if (!parsed.success) {
    // Shape failures are surfaced as findings too, so every caller deals with
    // one error type. A route handler should not have to know that Zod exists.
    throw new SceneValidationError("document", schemaFindings(parsed.error));
  }

  const document = parsed.data;
  const findings = lintScene(document, options);
  if (errorsOf(findings).length > 0) {
    throw new SceneValidationError(document.id, findings);
  }
  return { document, findings };
}

/** Zod issues as lint findings, so the two validation layers report alike. */
function schemaFindings(error: z.ZodError): LintFinding[] {
  return error.issues.map((issue) => ({
    rule: "schema",
    severity: "error" as const,
    path: issue.path.length === 0 ? "<root>" : issue.path.join("."),
    message: issue.message,
    entities: [],
  }));
}

/** Canonical on-disk form: stable key order via the schema, two-space indent. */
export const serializeScene = (doc: SceneDocument): string => `${JSON.stringify(doc, null, 2)}\n`;
