import { editDocument, getState, setStatus, useStore } from "../state/store.js";
import { physicsFor, sizesFromMap } from "../lib/physics.js";
import {
  findEntity,
  setWallBearing,
  setWallLength,
  wallBearing,
  wallLength,
} from "../lib/entities.js";
import { Divider, Field, PanelTitle } from "./primitives.jsx";
import { Scroll } from "./Scroll.jsx";

export function Inspector() {
  const doc = useStore((s) => s.document);
  const selection = useStore((s) => s.selection);
  const findings = useStore((s) => s.findings);

  const entity = doc !== null && selection !== null ? findEntity(doc, selection) : null;
  const relevant =
    selection === null ? [] : findings.filter((f) => f.entities.includes(selection));

  return (
    <aside className="flex w-[238px] shrink-0 flex-col border-l border-line bg-panel">
      <PanelTitle>Inspector</PanelTitle>
      <Scroll>
        <div className="px-3 pb-4">
          {entity === null ? (
            <p className="py-6 text-center text-[11.5px] text-subtle">
              Select something in the viewport or the tree.
            </p>
          ) : entity.kind === "wall" ? (
            <WallInspector
              id={entity.wall.id}
              levelIndex={entity.levelIndex}
              wallIndex={entity.wallIndex}
            />
          ) : entity.kind === "placement" ? (
            <PlacementInspector index={entity.index} />
          ) : (
            <div className="pt-2">
              <Header kind={entity.kind} id={selection ?? ""} />
              <p className="text-[11.5px] text-muted">
                No editable parameters yet for this entity type.
              </p>
            </div>
          )}

          {relevant.length > 0 && (
            <div className="mt-3 space-y-2">
              {relevant.map((finding, i) => (
                <div
                  key={`${finding.rule}-${i}`}
                  className={`rounded-sm border p-2 text-[11px] leading-snug ${
                    finding.severity === "error"
                      ? "border-danger/40 bg-danger/10 text-danger"
                      : "border-warn/40 bg-warn/10 text-warn"
                  }`}
                >
                  <span className="mb-1 block font-mono text-[9.5px] tracking-[0.1em] uppercase">
                    {finding.rule}
                  </span>
                  {finding.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </Scroll>
    </aside>
  );
}

const Header = ({ kind, id }: { kind: string; id: string }) => (
  <div className="mb-2.5 flex items-center gap-2 border-b border-line pt-2 pb-2.5">
    <span className="rounded-sm bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] font-medium text-accent">
      {kind.toUpperCase()}
    </span>
    <span className="text-[13px] font-semibold text-ink">{id}</span>
  </div>
);

function WallInspector({
  id,
  levelIndex,
  wallIndex,
}: {
  id: string;
  levelIndex: number;
  wallIndex: number;
}) {
  const doc = useStore((s) => s.document);
  const wall = doc?.subject.levels[levelIndex]?.walls[wallIndex];
  const level = doc?.subject.levels[levelIndex];
  if (wall === undefined || level === undefined) return null;

  const edit = (mutate: (w: NonNullable<typeof wall>) => void): void =>
    editDocument((draft) => {
      const target = draft.subject.levels[levelIndex]?.walls[wallIndex];
      if (target !== undefined) mutate(target);
    });

  return (
    <div>
      <Header kind="wall" id={id} />

      <Field
        label="Length"
        unit="m"
        value={wallLength(wall)}
        onCommit={(next) => next > 0 && edit((w) => setWallLength(w, next))}
      />
      <Field
        label="Height"
        unit="m"
        value={wall.height ?? level.height}
        onCommit={(next) => next > 0 && edit((w) => { w.height = next; })}
      />
      <Field
        label="Thickness"
        unit="mm"
        step={10}
        value={wall.thickness * 1000}
        onCommit={(next) => next > 0 && edit((w) => { w.thickness = next / 1000; })}
      />
      <Field
        label="Bearing"
        unit="°"
        step={0.5}
        value={wallBearing(wall)}
        onCommit={(next) => edit((w) => setWallBearing(w, next))}
      />

      <Divider>Openings · {wall.openings.length}</Divider>
      {wall.openings.length === 0 ? (
        <p className="text-[11px] text-subtle">None.</p>
      ) : (
        wall.openings.map((opening, openingIndex) => (
          <div key={opening.id} className="mb-3 border-l border-line pl-2">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="font-mono text-[10.5px] text-ink">{opening.id}</span>
              <span className="font-mono text-[9.5px] text-subtle">{opening.kind}</span>
            </div>
            <Field
              label="Offset"
              unit="m"
              value={opening.offset}
              onCommit={(next) =>
                edit((w) => {
                  const o = w.openings[openingIndex];
                  if (o !== undefined) o.offset = next;
                })
              }
            />
            <Field
              label="Width"
              unit="m"
              value={opening.width}
              onCommit={(next) =>
                next > 0 &&
                edit((w) => {
                  const o = w.openings[openingIndex];
                  if (o !== undefined) o.width = next;
                })
              }
            />
            <Field
              label="Height"
              unit="m"
              value={opening.height}
              onCommit={(next) =>
                next > 0 &&
                edit((w) => {
                  const o = w.openings[openingIndex];
                  if (o !== undefined) o.height = next;
                })
              }
            />
            <Field
              label="Sill"
              unit="m"
              value={opening.sill}
              onCommit={(next) =>
                edit((w) => {
                  const o = w.openings[openingIndex];
                  if (o !== undefined) o.sill = next;
                })
              }
            />
          </div>
        ))
      )}

      <Divider>Material</Divider>
      <div className="flex items-center gap-2">
        <span
          className="size-5 shrink-0 rounded-sm border border-line"
          style={{ background: doc?.materials[wall.material]?.baseColor ?? "#9A958C" }}
        />
        <span className="text-[11.5px] text-ink">
          {doc?.materials[wall.material]?.label ?? wall.material}
          <small className="block font-mono text-[9.5px] text-subtle">
            {doc?.materials[wall.material]?.source ?? "—"}
          </small>
        </span>
      </div>
    </div>
  );
}


/**
 * Placements are the one thing physics is here to help with.
 *
 * "Drop to floor" settles the object under gravity and writes the resting
 * position back to the document — the simulation itself is never persisted, only
 * the transform it arrived at.
 */
function PlacementInspector({ index }: { index: number }) {
  const doc = useStore((s) => s.document);
  const revision = useStore((s) => s.revision);
  const assetSizes = useStore((s) => s.assetSizes);
  const placement = doc?.subject.placements[index];
  const assetSize = placement === undefined ? undefined : assetSizes.get(placement.asset);
  if (doc === undefined || doc === null || placement === undefined) return null;

  const edit = (mutate: (p: NonNullable<typeof placement>) => void): void =>
    editDocument((draft) => {
      const target = draft.subject.placements[index];
      if (target !== undefined) mutate(target);
    });

  const drop = async (): Promise<void> => {
    const current = getState().document;
    if (current === null) return;
    setStatus(`Dropping ${placement.id}…`);
    const world = await physicsFor(current, revision, sizesFromMap(getState().assetSizes));
    // The asset's real size when it is loaded; the old guess when it is not.
    // A guessed box is why placements could not collide before — it settles
    // things onto a surface that is not where the model's surface is.
    const size = getState().assetSizes.get(placement.asset);
    const half: [number, number, number] =
      size === undefined
        ? [0.3 * placement.scale, 0.45 * placement.scale, 0.3 * placement.scale]
        : [
            (size[0] * placement.scale) / 2,
            (size[1] * placement.scale) / 2,
            (size[2] * placement.scale) / 2,
          ];
    const from: [number, number, number] = [
      placement.position[0],
      Math.max(placement.position[1], half[1] + 0.05) + 2,
      placement.position[2],
    ];
    // Without this the placement lands on its own static collider and never
    // moves — "bench-vine settled on bench-vine".
    const result = world.dropToRest(from, { halfExtents: half, ignoreEntity: placement.id });

    edit((p) => {
      p.position = [result.position[0], result.position[1] - half[1], result.position[2]];
    });
    setStatus(
      result.settled
        ? `${placement.id} settled on ${result.restingOn ?? "nothing"} after ${result.steps} steps`
        : `${placement.id} did not settle in ${result.steps} steps`,
    );
  };

  return (
    <div>
      <Header kind="placement" id={placement.id} />
      <Field label="X" unit="m" value={placement.position[0]}
        onCommit={(v) => edit((p) => { p.position = [v, p.position[1], p.position[2]]; })} />
      <Field label="Y" unit="m" value={placement.position[1]}
        onCommit={(v) => edit((p) => { p.position = [p.position[0], v, p.position[2]]; })} />
      <Field label="Z" unit="m" value={placement.position[2]}
        onCommit={(v) => edit((p) => { p.position = [p.position[0], p.position[1], v]; })} />
      <Field label="Rotation" unit="°" step={5} value={placement.rotationY}
        onCommit={(v) => edit((p) => { p.rotationY = v; })} />
      <Field label="Scale" value={placement.scale} step={0.05}
        onCommit={(v) => v > 0 && edit((p) => { p.scale = v; })} />

      <button
        type="button"
        onClick={() => void drop()}
        className="mt-3 w-full rounded-sm border border-accent/60 bg-accent-soft px-3 py-2 text-[12px] font-medium text-accent"
      >
        Drop to floor
      </button>

      <Divider>Asset</Divider>
      <p className="font-mono text-[10.5px] break-all text-muted">{placement.asset}</p>
      <p className="mt-1 text-[10.5px] text-subtle">
        {assetSize === undefined
          ? "Proxy geometry — this asset is not downloaded."
          : `${assetSize[0].toFixed(2)} × ${assetSize[1].toFixed(2)} × ${assetSize[2].toFixed(2)} m`}
      </p>
    </div>
  );
}
