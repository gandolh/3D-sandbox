import { useEffect } from "react";
import { SceneDocument, lintScene, serializeScene } from "@solstice/schema";
import { Inspector } from "./ui/Inspector.jsx";
import { SceneTree } from "./ui/SceneTree.jsx";
import { Timeline } from "./ui/Timeline.jsx";
import { Toolbar } from "./ui/Toolbar.jsx";
import { Viewport } from "./ui/Viewport.jsx";
import { getState, loadDocument, setStatus, useStore } from "./state/store.js";
import sceneJson from "../../../scenes/villa-carpathia.scene.json";

export function App() {
  const status = useStore((s) => s.status);
  const findings = useStore((s) => s.findings);
  const errors = findings.filter((f) => f.severity === "error").length;

  useEffect(() => {
    const parsed = SceneDocument.safeParse(sceneJson);
    if (!parsed.success) {
      setStatus(`Scene failed to parse: ${parsed.error.issues[0]?.message ?? "unknown"}`);
      return;
    }
    loadDocument(parsed.data);
  }, []);

  /**
   * Save writes through the API, which validates again before the file is
   * touched. When the API is not running — the common case while working on the
   * viewport alone — it falls back to downloading the canonical file, so the
   * round-trip format stays inspectable either way.
   */
  const onSave = async (): Promise<void> => {
    const doc = getState().document;
    if (doc === null) return;
    if (lintScene(doc).some((f) => f.severity === "error")) {
      setStatus("Not saved — the document has errors");
      return;
    }

    setStatus("Saving…");
    try {
      const response = await fetch(`/api/scenes/${doc.id}`, {
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
      const blob = new Blob([serializeScene(doc)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${doc.id}.scene.json`;
      anchor.click();
      URL.revokeObjectURL(url);
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
      <footer className="flex h-[22px] shrink-0 items-center gap-3 border-t border-line bg-chrome px-3.5 font-mono text-[10px] text-subtle">
        <span>{status}</span>
        {errors > 0 && <span className="text-danger">{errors} error(s)</span>}
        {errors === 0 && findings.length > 0 && (
          <span className="text-warn">{findings.length} warning(s)</span>
        )}
      </footer>
    </div>
  );
}
