import { useEffect } from "react";
import { openScene, refreshScenes, saveOpenScene } from "./lib/scene-source.js";
import { getState, useStore } from "./state/store.js";
import { Inspector } from "./ui/Inspector.jsx";
import { PlanView } from "./ui/PlanView.jsx";
import { SceneDialogs } from "./ui/SceneDialogs.jsx";
import { SceneTree } from "./ui/SceneTree.jsx";
import { Timeline } from "./ui/Timeline.jsx";
import { Toolbar } from "./ui/Toolbar.jsx";
import { Viewport } from "./ui/Viewport.jsx";

export function App() {
  const status = useStore((s) => s.status);
  const alert = useStore((s) => s.alert);
  const showPlan = useStore((s) => s.showPlan);
  const findings = useStore((s) => s.findings);
  const errors = findings.filter((f) => f.severity === "error").length;

  // Ask the API what it has before opening anything, so the first scene comes
  // from the file on disk when there is one rather than from the bundle and
  // then again from the API. The listing gives up after 1.5 s, so a missing
  // API costs that and no more. Every later open — the picker, New house, a
  // reload — goes through the same `openScene`.
  useEffect(() => {
    void refreshScenes().then(() => openScene(getState().sceneId));
  }, []);

  return (
    <div className="flex h-full flex-col">
      <Toolbar onSave={() => void saveOpenScene()} />
      <div className="flex min-h-0 flex-1">
        <SceneTree />
        {/*
          The viewport stays mounted under the plan rather than being swapped
          out: unmounting it disposes the engine, the WebGL context and every
          loaded asset, so toggling Plan twice would cost a full reload of the
          scene. `hidden` keeps the canvas alive and out of the layout.
        */}
        <div className={showPlan ? "hidden" : "flex min-w-0 flex-1"}>
          <Viewport />
        </div>
        {showPlan && <PlanView />}
        <Inspector />
      </div>
      <Timeline />
      <SceneDialogs />
      {/*
        The one place the app says what it just did — a save, a drop, a scene
        load, a parse failure, every step of a render queue — and until now it
        said it only to people looking at this strip of the screen.

        `role="status"` is `aria-live="polite"`: announced at the next pause,
        never interrupting. `aria-atomic` so the whole line is read rather than
        the changed word alone, which for "12 model(s) loaded" → "3 model(s)
        loaded" would otherwise announce just a number.
      */}
      <footer
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="flex h-[22px] shrink-0 items-center gap-3 border-t border-line bg-chrome px-3.5 font-mono text-[10px] text-subtle"
      >
        {/*
          The alert takes the footer's own slot rather than sitting beside it,
          so the sighted reading and the announced one are the same sentence.
          `setStatus` clears it, so an alert stays until something else happens
          rather than until the next repaint.
        */}
        {alert === null ? (
          <span>{status}</span>
        ) : (
          <span role="alert" className="text-danger">
            {status}
          </span>
        )}
        {errors > 0 && <span className="text-danger">{errors} error(s)</span>}
        {errors === 0 && findings.length > 0 && (
          <span className="text-warn">{findings.length} warning(s)</span>
        )}
      </footer>
    </div>
  );
}
