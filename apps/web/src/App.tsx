import { useEffect } from "react";
import { SceneDocument, lintScene, serializeScene } from "@solstice/schema";
import { Inspector } from "./ui/Inspector.jsx";
import { SceneTree } from "./ui/SceneTree.jsx";
import { Timeline } from "./ui/Timeline.jsx";
import { Toolbar } from "./ui/Toolbar.jsx";
import { Viewport } from "./ui/Viewport.jsx";
import { getState, loadDocument, setLoadError, setStatus, useStore } from "./state/store.js";
import { DEFAULT_SCENE_ID, sceneById } from "./scenes.js";

export function App() {
  const status = useStore((s) => s.status);
  const alert = useStore((s) => s.alert);
  const findings = useStore((s) => s.findings);
  const errors = findings.filter((f) => f.severity === "error").length;

  const sceneId = useStore((s) => s.sceneId);

  // Re-runs on every scene change, and goes through the same parse each time.
  // A scene reached by switching is not a scene anyone validated less.
  useEffect(() => {
    const scene = sceneById(sceneId) ?? sceneById(DEFAULT_SCENE_ID);
    if (scene === undefined) {
      setLoadError("No scenes are bundled in this build");
      return;
    }
    const parsed = SceneDocument.safeParse(scene.json);
    if (!parsed.success) {
      setLoadError(
        `${scene.title} failed to parse: ${parsed.error.issues[0]?.message ?? "unknown"}`,
      );
      return;
    }
    loadDocument(parsed.data, scene.id);
  }, [sceneId]);

  /**
   * Save writes through the API, which validates again before the file is
   * touched. When the API is not running — the common case while working on the
   * viewport alone — it falls back to downloading the canonical file, so the
   * round-trip format stays inspectable either way.
   *
   * `__API_BASE__` is empty in a build that has no API behind it at all (the
   * static sub-path deploy). That is a different thing from an API that is
   * merely down, and it is checked first: posting into a host's 404 page
   * returns a valid HTTP response, so the unreachable path would never be
   * taken and the user would be told the API refused a save it never saw.
   */
  const onSave = async (): Promise<void> => {
    const doc = getState().document;
    if (doc === null) return;
    if (lintScene(doc).some((f) => f.severity === "error")) {
      setStatus("Not saved — the document has errors");
      return;
    }

    const download = (): void => {
      const blob = new Blob([serializeScene(doc)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${doc.id}.scene.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    };

    if (__API_BASE__ === "") {
      download();
      setStatus("No API in this build — downloaded instead");
      return;
    }

    setStatus("Saving…");
    try {
      const response = await fetch(`${__API_BASE__}/scenes/${doc.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: serializeScene(doc),
      });
      if (response.ok) {
        const body = (await response.json()) as { bytes?: number };
        setStatus(`Saved · ${body.bytes ?? 0} bytes`);
        return;
      }
      setStatus(`API refused the save (${response.status})`);
    } catch {
      download();
      setStatus("API unreachable — downloaded instead");
    }
  };

  return (
    <div className="flex h-full flex-col">
      <Toolbar onSave={() => void onSave()} />
      <div className="flex min-h-0 flex-1">
        <SceneTree />
        <Viewport />
        <Inspector />
      </div>
      <Timeline />
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
