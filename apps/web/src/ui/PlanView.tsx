import { useMemo } from "react";
import { planSvg } from "@solstice/drawing";
import { useStore } from "../state/store.js";
import { Scroll } from "./Scroll.jsx";

/**
 * The floor plan, in place of the viewport.
 *
 * `planSvg` is a pure function of the document, so this is a `useMemo` and
 * nothing else — no canvas, no engine, no lifecycle. That is the payoff for
 * generating the drawing headlessly: the component that shows it is six lines.
 *
 * White ground in both themes, deliberately. Darkroom is a locked decision for
 * the chrome because a render cannot be judged against a light surround, but a
 * *drawing* is a black-on-white document and inverting it would make it a
 * diagram of a plan rather than a plan. The sheet sits on the dark chrome the
 * way a real one sits on a desk.
 */
export function PlanView() {
  const doc = useStore((s) => s.document);
  const svg = useMemo(() => {
    if (doc === null) return null;
    try {
      return planSvg(doc);
    } catch (error) {
      return { error: (error as Error).message };
    }
  }, [doc]);

  if (svg === null) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center bg-viewport text-[11.5px] text-subtle">
        No document to draw.
      </div>
    );
  }

  if (typeof svg !== "string") {
    return (
      <div
        role="alert"
        className="flex min-w-0 flex-1 items-center justify-center bg-viewport px-6 text-center text-[11.5px] text-danger"
      >
        This level cannot be drawn as a plan: {svg.error}
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1 bg-viewport">
      <Scroll>
        <div className="flex justify-center p-6">
          <div
            className="rounded-sm bg-white p-2 shadow-lg [&>svg]:h-auto [&>svg]:max-w-full"
            // The SVG is built by this repo from its own document — no user
            // HTML reaches it, and it is the only way to hand a browser a
            // vector drawing without re-implementing it as JSX.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      </Scroll>
    </div>
  );
}
