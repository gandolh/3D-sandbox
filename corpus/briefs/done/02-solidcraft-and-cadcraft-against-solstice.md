# Brief 02 — SolidCraft and CADCraft against Solstice

## Context

The owner asked on 2026-11-06 for "one brief for solidcraft vs cadcraft vs what we have in 3d
sandbox". This is a research brief: the findings are below, and nothing gets built until the owner
answers the decisions at the end. Each yes becomes its own build brief. It has the same shape as
brief 74 (2026-10-19, last held in commit `f8f39a0`), which compared CADCraft alone. From that one
the owner chose to build the CAD habits into Solstice's own editor, with no fork and no DXF import
([decisions.md](../../wiki/decisions.md#the-browser-draws-building-parts-never-free-geometry)).

Everything below was read from each project's own repository and docs on 2026-11-06, with no
clone and no build. Hackaday is cited only for the date it covered SolidCraft.

**The CADCraft link given with the request is dead.** `codeberg.org/Veraxus/cadcraft` returns 404,
and that Codeberg user has no CADCraft repository. `github.com/Veraxus/cadcraft` is a fork with
no stars, untouched since 2026-10-07. The project is
[storytold/cadcraft](https://github.com/storytold/cadcraft), the one brief 74 compared. A
different project with a similar name,
[getcadcraft/cadcraft](https://github.com/getcadcraft/cadcraft) ("2D drafting and 3D modeling",
DWG and DXF, created 2026-10-13), is not compared here.

## The three at a glance

| | **Solstice** (this repo) | **SolidCraft** | **CADCraft** |
|---|---|---|---|
| Purpose | One house and its plot, lit by the real sun, rendered photoreal | Mechanical parts and assemblies: feature-based solid CAD | 2D drafting in the AutoCAD mould |
| Model | Building parts (`Wall`, `Opening`, `Slab`, `Room`, `Level`, `Roof`); meshes are derived and never stored | B-rep solids from sketches and a feature timeline | 2D entities (lines, arcs, polylines, text, blocks, dimensions, hatches) |
| Kernel | None: TypeScript derives three.js meshes on the CPU | [solidcore](https://github.com/tangency-labs/solidcore), their Rust port of NVIDIA's SMLib (Apache-2.0) | Own f64 2D geometry crate |
| Constraints | None. Walls meet by sharing end points, found by derivation | Own solver: exact placement plus Levenberg–Marquardt | Own damped Gauss–Newton solver, with parameters |
| Native file | `*.scene.json`, Zod-validated and linted, `schemaVersion` 1 | `.sc` (earlier releases used `.solidcraft`) | DXF |
| Interop | None beyond the plan as SVG and stills as PNG | STEP, IGES, 3MF, STL, OBJ, glTF, URDF, FreeCAD and Rhino import; DXF export of a view | DXF R12–2018; DWG through `acadrust`; PDF, SVG and PNG |
| IFC | No | No | No |
| Renderer | WebGL2 three.js viewport plus `three-gpu-pathtracer` stills, sun and sky from date and place | wgpu viewport; its docs say HDRI, refraction and texture maps are not implemented | wgpu or CPU raster for 2D display lists |
| Browser | React and three.js; the whole build is 4.4 MB, 1.55 MB gzipped (built 2026-11-04); first paint was 349 KB gzipped at the 2026-09 audit | egui on WASM (WebGPU, or WebGL2 with `?webgl`); the hosted app's WASM is 101 MB, 32 MB gzipped | egui on WASM; each release ships an 11 MB zip; DWG is left out of the WASM build |
| Agents | None in the app, by decision; authoring happens in the repo | Command registry, JSON scripts, headless CLI, MCP, `window.solidcraft` in the browser | Command registry, command line, CLI, MCP, JSON control channel |
| Size | About 17.6k lines of TypeScript plus 9.5k lines of tests | 47 MB of Rust outside `vendor/`, roughly 0.9–1.1 million lines | 11.2 MB of Rust, roughly 220–260k lines |
| Tests | 712 (2026-11-03), several verified by mutation | 75 of 76 reference parts match analytic or FreeCAD volumes, areas, centres of mass and boxes ([oracle](https://github.com/tangency-labs/solidcraft/blob/28dcbbc862f450c1f7d5f0a13b3ff59dcd400f53/docs/oracle.md)) | 2,212 at brief 74; not recounted |
| Licence | None yet, all rights reserved | MIT OR Apache-2.0 | MIT OR Apache-2.0; brand excluded |

The line counts for the two Rust projects are estimates, because GitHub reports bytes. Crates
fetched in full came to 43 bytes a line (CADCraft `dxf` and `constraints`) and 51 (SolidCraft
`dynamics` and `mcp`). Solstice's counts are `wc -l` over the source and test files.

## SolidCraft (checked at `28dcbbc`)

- **What it is.** "An open-source parametric 3D CAD application built in pure Rust"
  ([README](https://github.com/tangency-labs/solidcraft/blob/28dcbbc862f450c1f7d5f0a13b3ff59dcd400f53/README.md)).
  It has sketches with constraints, then extrude, revolve, sweep, loft, fillet, shell, holes,
  threads and patterns on an editable timeline, plus assemblies with joints and sheet metal. It
  has no architectural vocabulary: no walls, levels or openings.
- **Kernel.** `crates/kernel` wraps solidcore, a separate repository pinned by commit (Apache-2.0,
  "safe, deterministic, wasm-compatible"). The
  [architecture page](https://github.com/tangency-labs/solidcraft/blob/28dcbbc862f450c1f7d5f0a13b3ff59dcd400f53/docs/architecture.md)
  still names `truck`. Meshes come from their own tessellation planner, evaluated in a compute
  shader.
- **Constraint solver** (`crates/sketch`, 1.5 MB). Points fixed by known geometry are placed
  exactly (after Owen 1991 and Fudos–Hoffmann 1997), Levenberg–Marquardt solves the rest, and the
  Jacobian's rank gives the remaining degrees of freedom
  ([capabilities](https://github.com/tangency-labs/solidcraft/blob/28dcbbc862f450c1f7d5f0a13b3ff59dcd400f53/docs/capabilities.md)).
- **Agents.** Every UI action is a command with JSON parameters, and the same registry serves the
  toolbar, `solidcraft-cli run script.json`, the MCP server and `window.solidcraft.execute` in the
  browser. MCP tools include `list_commands`, `describe_command` (JSON Schemas), `execute`, a
  `batch` that rolls back on error, `inspect_design`, `measure`, `screenshot`, `check_parameters`
  (try values and restore) and `export`
  ([mcp.md](https://github.com/tangency-labs/solidcraft/blob/28dcbbc862f450c1f7d5f0a13b3ff59dcd400f53/docs/mcp.md)).
- **Browser.** egui and wgpu compiled to WASM with Trunk. The hosted app loads one 101 MB WASM
  file, served as 32 MB gzipped (measured 2026-11-06).
- **Activity.** The repository was created 2026-10-07. It has 73 releases from v0.1.0 (2026-10-09)
  to v0.40.0-rc.2 (2026-11-03), about 4,740 commits, about 285 contributors (anonymous ones
  included), 4,895 open issues, 721 open PRs and 14.1k stars. Hackaday covered it on
  [2026-10-17](https://hackaday.com/2026/10/17/solidcraft-is-parametric-automation-friendly-cad-for-desktop-and-browser/):
  "still in early development, but so far quite a few features seem to work as they should". Its
  own status line is "early but usable for simple parts".

## CADCraft (checked at `fc157ea`)

- **What it is.** "An open-source, clean-room AutoCAD-style app in pure Rust", from the ArtCraft
  team. It has the command line with `@dx,dy` and `@d<a`, object snaps, polar tracking, layers,
  dimensions, hatches, blocks, paper-space layouts and PLOT to PDF
  ([README](https://github.com/storytold/cadcraft/blob/fc157ea91fd96bba6f7ff7611fb3465820f6530c/README.md)).
  The README now says "2D and 3D", but the
  [roadmap](https://github.com/storytold/cadcraft/blob/fc157ea91fd96bba6f7ff7611fb3465820f6530c/ROADMAP.md)
  still rates 3D modelling at 2% and calls the project "pre-alpha", about 38% ready for real work.
- **Since brief 74** (2026-10-19): commits went from 583 to about 1,234, contributors from 73 to
  about 133, and releases from v0.8 to v0.17.1 (16 in all). It has 578 open issues, 631 open PRs
  and 7.7k stars. It still has no building parts: a wall is lines on a layer.
- **The small crates are less separable than they were.** `cadcraft-dxf` is a tag reader and
  writer of 1,896 lines, and mapping tags to entities happens in `io`. `cadcraft-constraints`
  (5,254 lines) now depends on `cadcraft-doc`, the drawing database. DWG goes through `acadrust`
  (MPL-2.0, used unmodified), which is not in the WASM build.

## What Solstice is, for this comparison

- **A semantic model with no kernel.** The document stores architectural meaning, and geometry,
  colliders and the plan are derived from it. A primitive-and-boolean model and a B-rep kernel were
  both rejected on 2026-09-11 ("Parametric-semantic document, not mesh CSG" in
  [decisions.md](../../wiki/decisions.md)). SolidCraft's 101 MB of WASM is what that decision
  avoided.
- **Joins come from derivation, not a solver.** `wallEnds` finds walls that share an end within
  1e-6 m, the Wall tool's snaps make corners exact by construction, grips move every end at a
  corner, and openings ride their wall by offset ([drawing.md](../../wiki/drawing.md)).
- **Validation is a linter.** It runs in the browser on every edit, in the API on every save and
  in `npm run scenes` for the three builders. Nothing lints a scene file or draws its plan from
  the command line on its own.
- **Interop is nil by choice.** DXF import was rejected on 2026-10-21. Of the outside formats, IFC
  (`IfcWall`, `IfcOpeningElement`, `IfcSlab`, `IfcSpace`, `IfcBuildingStorey`) is the one that
  matches this model. Neither project reads or writes it.

## The office suite's CAD app, for context

`imbatranim-office` has its own CAD app: a TypeScript DXF viewer and editor drawn on Canvas 2D,
"behaviour after CADCraft", with no CADCraft code. It reads DXF with `dxf-viewer`'s parser and
writes with `@tarikjabiri/dxf` 2.9.0 (MIT), picked in a measured spike on 2026-10-21. It opens DWG
through LibreDWG on the suite's server and saves DXF only. It shares no code with Solstice. If
Solstice ever writes DXF, that spike is the nearest reference, and its picks are TypeScript and
MIT, which suits this repo better than a Rust crate behind a WASM toolchain. The office repo
itself is AGPL-3.0.

## What to take, and what would be a rewrite

| Item | From | Verdict |
|---|---|---|
| B-rep kernel | SolidCraft (solidcore) | Rewrite, and already rejected (2026-09-11). Houses need no fillets |
| Constraint solver | either | Nothing to take now. Both are Rust; CADCraft's is now tied to its document crate. Worth it only if the owner wants dimension-driven walls ("this room stays 4 m wide"), which needs a grill first |
| DXF reader/writer | CADCraft `dxf` | Nothing. Import is rejected. For export, the office suite's TypeScript writer fits better |
| DWG | CADCraft (`acadrust`) | No. MPL-2.0, native only |
| STEP, IGES, 3MF, URDF | SolidCraft | No use for a house |
| glTF | SolidCraft imports it | If the owner wants the house in Blender or SolidCraft, three.js's own `GLTFExporter` (in `three/addons`, already installed) writes it. No outside code |
| Renderer | either | Nothing. Solstice's path tracer is ahead for this purpose |
| Reference-measure oracle | SolidCraft | Already practised here: the wall-end tests tile each corner's area, and cross-package tests hold mesh, collider and plan together |
| **Command registry, CLI, MCP** | both | **The one idea worth taking.** Both route every action through a command with JSON parameters and serve that registry to scripts, a headless CLI and MCP. Solstice has the core of that already: an edit is a document mutation, the document is validated JSON, the linter explains what is wrong, and `@solstice/drawing` renders a plan with no GPU. What it lacks is an entry point outside the browser |

## Licence

Solstice has no licence yet ("all rights reserved", README). MIT OR Apache-2.0 code may be copied
into it as long as the notices are kept, and for Apache-2.0 that includes its NOTICE file.
solidcore is Apache-2.0. `acadrust` is MPL-2.0, which matters only if DWG ever comes. The office
suite's AGPL-3.0 code is the owner's own to relicense, though its third-party parts keep their own
terms. None of the follow-ups copies code from either project, so nothing needs doing now.

## Maturity

Both projects are about four weeks old and are built by many agents at high speed. CADCraft's
roadmap measures its remaining work in "Opus 5.5 agent wall-clock hours". Their stars measure
attention, not maturity. Their formats and APIs move weekly; SolidCraft renamed its design files
within a month. Neither is something to depend on. Both are good to read for how a feature behaves.

## Follow-ups worth doing, each small

1. **A headless CLI over the existing packages.** `lint <file>` would print the linter's findings,
   and `plan <file> [level]` would write the plan SVG. It needs no new dependency and is one
   brief. It gives Claude Code a checked loop on drawn scenes. Those have no builder, so outside
   the browser and the API nothing checks them today.
2. **Then, if wanted, an MCP server** in its own workspace on stdio, over the CLI's functions and
   the API's `PUT`, which refuses an invalid document. Its tools would list and read scenes, lint,
   replace a document and draw a plan. It would use the MCP TypeScript SDK in a separate process,
   not `@anthropic-ai/sdk` in the app. That fits "No LLM inside the application", which already
   calls the document the tool vocabulary. One brief.
3. **Only for a real use, plan export as DXF.** Wall outlines would become closed polylines on a
   walls layer, along with openings and room labels, written with the office suite's writer. The
   file would open in the office CAD app, CADCraft or AutoCAD. Import stays rejected. One brief.
4. **Only for a real use, the house as glTF** through `GLTFExporter`. One brief.

## Owner decisions

1. **SolidCraft and CADCraft stay references only**: no fork, no crate, no dependency.
   Recommended.
2. **No constraint solver.** Recommended, unless dimension-driven walls are wanted, which would go
   to `grill-me` first.
3. **Agent interface:** none, the CLI only (recommended as the first step), or the CLI and then
   MCP.
4. **Plan DXF export:** yes or no. Recommended: no until someone needs to send a plan to another
   program.
5. **glTF export:** yes or no. Same recommendation.

## Files you OWN (for this research brief)

- This brief's outcome note, when it moves to `done/`
- `corpus/log.md`, and the follow-up build briefs
- `corpus/wiki/decisions.md`, only to record what the owner picks

## Files you must NOT touch

- Any code. This brief builds nothing.

## Acceptance

- The owner has answered the five decisions, and the answers are in this brief's outcome.
- Each yes has a build brief in `briefs/todo/`.
- Any new or revisited decision is in `decisions.md` with its date and why, plus a `log.md` note.

## Outcome (2026-11-06)

The owner answered the five decisions, each with the recommendation:

1. SolidCraft and CADCraft stay **references only**: no fork, no crate, no
   dependency.
2. **No constraint solver.**
3. **Agent interface: the CLI first.** Brief 03 (`lint` and `plan`). MCP
   stays a later "if wanted", not briefed.
4. **No DXF plan export** until someone needs to send a plan elsewhere.
5. **No glTF export**, the same.

Recorded in [decisions.md](../../wiki/decisions.md), "Agents get a CLI;
no constraint solver", and in `log.md`.
