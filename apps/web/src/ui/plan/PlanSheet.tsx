import { planSvg } from "@solstice/drawing";
import type { SceneDocument } from "@solstice/schema";
import { useMemo } from "react";
import { Scroll } from "../Scroll.jsx";

/**
 * The 1:100 sheet of one level, behind the plan view's Sheet toggle.
 *
 * `planSvg` is a pure function of the document, so this is a `useMemo` and
 * nothing else — no canvas, no engine, no lifecycle. It draws the level the
 * plan view is on, which is the first time Elmsgate's upper floor has had a
 * sheet in the app.
 *
 * White ground in both themes, deliberately. Darkroom is a locked decision for
 * the chrome because a render cannot be judged against a light surround, but a
 * *drawing* is a black-on-white document and inverting it would make it a
 * diagram of a plan rather than a plan. The sheet sits on the dark chrome the
 * way a real one sits on a desk.
 */
export function PlanSheet({ doc, levelId }: { doc: SceneDocument; levelId: string | undefined }) {
  const svg = useMemo(() => {
    try {
      return planSvg(doc, levelId === undefined ? {} : { levelId });
    } catch (error) {
      return { error: (error as Error).message };
    }
  }, [doc, levelId]);

  if (typeof svg !== "string") {
    return (
      <div
        role="alert"
        className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-viewport px-6 text-center text-[11.5px] text-danger"
      >
        This level cannot be drawn as a sheet: {svg.error}
      </div>
    );
  }

  // A column, so `Scroll`'s `min-h-0 flex-1` has a flex parent to act in: as a
  // plain block the scroll root took the sheet's full height, never scrolled,
  // and painted the bottom of a large plan over the timeline (brief 73).
  return (
    <div data-testid="plan-sheet" className="flex min-h-0 min-w-0 flex-1 flex-col bg-viewport">
      <Scroll>
        <div className="flex justify-center p-6">
          <div
            className="rounded-sm bg-white p-2 shadow-lg [&>svg]:h-auto [&>svg]:max-w-full"
            // The SVG is built by this repo from its own document — no user
            // HTML reaches it, and it is the only way to hand a browser a
            // vector drawing without re-implementing it as JSX.
            // biome-ignore lint/security/noDangerouslySetInnerHtml: built by `planSvg` from this repo's own document; see above
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      </Scroll>
    </div>
  );
}
