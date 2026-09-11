import { SceneDocument } from "./document.js";
import { errorsOf, formatFinding, lintScene, type LintFinding, type LintOptions } from "./lint/index.js";

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
  const document = SceneDocument.parse(input);
  const findings = lintScene(document, options);
  if (errorsOf(findings).length > 0) {
    throw new SceneValidationError(document.id, findings);
  }
  return { document, findings };
}

/** Canonical on-disk form: stable key order via the schema, two-space indent. */
export const serializeScene = (doc: SceneDocument): string => `${JSON.stringify(doc, null, 2)}\n`;
