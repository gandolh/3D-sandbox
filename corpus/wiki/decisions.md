---
summary: Locked technical and design calls with the reasons behind them — read before proposing an alternative, so settled trade-offs are not relitigated.
updated: 2026-09-11
---

# Decisions

All settled 2026-09-11 in a design session held before any code existed. Changing
one requires an explicit revisit and a `log.md` note.

## WebGL2, not WebGPU
_2026-09-11_ — The renderer is `THREE.WebGLRenderer`. No `three/webgpu`, no TSL
node materials, for the life of the project.
Rejected: WebGPU (strategically the better direction, and three 0.185.1 ships the
build). **Why**: `three-gpu-pathtracer` is built on WebGL 2 and its entry point is
`new WebGLPathTracer(renderer: WebGLRenderer)`. Photoreal renders are the stated
goal of the project; TSL is a means to an end we do not need. This is a forced
consequence, not a preference — record it or it looks arbitrary.

## Imperative three.js, no React Three Fiber
_2026-09-11_ — A `SandboxEngine` class owns renderer, scene, camera and loop.
React renders chrome only.
Rejected: R3F 9.7.0 + drei 10.7.8, which would have supplied `TransformControls`,
`Grid` and `GizmoHelper` free. **Why**: the scene graph is *derived output* — a
generator compiles the document into meshes — so declaring it in JSX means writing
a compiler that emits React elements. R3F also pins `react >=19 <19.3`, costing
React 19.3.0 for nothing, and both the path tracer and rapier want direct control
of the loop. `three/addons` supplies the controls drei wraps.

## Parametric-semantic document, not mesh CSG
_2026-09-11_ — Documents store architectural meaning (`Wall`, `Opening`, `Roof`,
`Slab`); geometry is derived.
Rejected: a primitive-plus-boolean-tree model (what VibeCAD does), and a true
B-rep kernel (`replicad`/OpenCascade). **Why**: mechanical parts have no shared
vocabulary, so VibeCAD must be general; houses do have one. Semantics make the
document small enough to hand-author, make physics colliders derivable for free, and
keep editing coherent — dragging a wall re-derives its openings instead of
orphaning them. A B-rep kernel is multi-MB WASM for fillets a house does not need.

## Two fidelity tiers
_2026-09-11_ — `subject` is parametric and editable; `context` is instanced scatter.
Rejected: one uniform representation where a forest is just many placements.
**Why**: a photoreal tree is 50–200k triangles; 300 of them is tens of millions,
which makes the path tracer's BVH build unusable. Not an optimisation — the
difference between the render button working and not.

## No LLM inside the application
_2026-09-11_ — No `@anthropic-ai/sdk` dependency. Authoring happens in the repo.
Rejected: an in-app agent panel (VibeCAD's model). **Why**: the hard design problem
is the typed vocabulary of operations that can build a house, and that is identical
either way. Getting it right makes an agent a thin later addition; getting it wrong
cannot be rescued by prompting. The architecture stays agent-ready because the tool
vocabulary *is* the document.

## Scene files are truth; SQLite is a derived index
_2026-09-11_ — Scene JSON lives as repo files. SQLite holds only metadata that can
be recomputed by rescanning, plus a disposable table for UI state.
Rejected: database-as-truth, and a files/DB round-trip with export.
**Why**: scenes are hand-edited outside the app as a matter of routine. If the
database held anything authoritative, every hand-edit would desync it. Derived
means the app just notices and re-reads. Git becomes version control for scenes
for free, and every save is a reviewable diff.

## Validation is a linter, not a schema
_2026-09-11_ — Zod parsing is followed by a semantic pass; invalid documents are
never written.
**Why**: documents are AI-authored. The failures that occur are referential and
geometric — an opening on a nonexistent wall, a window taller than its wall — and
no amount of `z.object()` catches those.

## TypeScript authors, JSON ships
_2026-09-11_ — Builders are TypeScript modules; a build step emits canonical JSON.
**Why**: hand-authoring a picket fence as forty literals is untenable, so authoring
needs loops and helpers. Shipping a TypeScript evaluator into the runtime would be
absurd, and the API must store inert data.

## Degrees in documents, radians internally
_2026-09-11_ — Angles are degrees on disk and on screen, radians past the schema
boundary. Metres, Y-up, right-handed.
**Why**: documents are written by hand. Y-up because fighting three.js's native
axis means fighting every addon.

## Visual direction: Darkroom
_2026-09-11_ — Near-black chrome, hairline separation, sun-amber accent.
Rejected: "Drawing Set" (paper ground, drafting overlays) and "Gallery" (inset
viewport, generous light chrome) — both mocked up and compared.
**Why**: a path-traced render cannot be judged for exposure against a light
surround, and producing renders is the goal. B's annotation vernacular returns as a
toggleable overlay; C's inset viewport returns as a render mode.
Light theme is a deliberate concession: chrome lightens, the viewport keeps a dark
matte, and the render is identical in both themes.

## npm workspaces with exact pins
_2026-09-11_ — One lockfile, `save-exact=true`, no `^` or `~` anywhere.
**Why**: the user asked for fixed versions. The stack has live compatibility
edges — `@types/three` trails `three` by a minor, and R3F's React ceiling was the
kind of thing a caret range hides until it breaks.

## `node:sqlite`, not a native SQLite driver
_2026-09-11_ — The derived index uses Node's built-in `node:sqlite`.
Rejected: `better-sqlite3@13.0.3`, which has a stable API but is a native module.
**Why**: the index is derived and disposable — deleting it costs a rescan and
nothing else — so an experimental API carries almost no risk here, while a native
module means a compile step on every machine and on the VPS. It prints an
`ExperimentalWarning`; that is the entire cost. Revisit if the index ever holds
anything that cannot be recomputed.
