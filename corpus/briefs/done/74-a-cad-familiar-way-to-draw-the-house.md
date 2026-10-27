# Task 74 — A CAD-familiar way to draw the house

## Context

The owner asked on 2026-10-19: look at CADCraft (cadcraft.org,
[storytold/cadcraft](https://github.com/storytold/cadcraft)) and decide whether to fork it and build
our idea of house building there, or keep Solstice and take what we need from CADCraft. Either way,
the goal is to draw a house in a program that feels like CAD.

**This is a decision brief.** Nothing gets built until the owner picks an option below. Then the
chosen option becomes its own build brief (75 onwards), and this one moves to `done/` with the choice
written into its outcome. If the choice needs a design session first, routing.md sends it to
`grill-me`.

## What CADCraft is (checked 2026-10-19, HEAD `0b32c2e`)

- **A 2D AutoCAD clone.** The README says "2D and 3D", but the code only draws in 2D.
  - ROADMAP.md rates "3D modelling and rendering" at 2% and estimates 300–450 agent-hours for a 3D
    kernel.
  - `3DORBIT` answers "CADCraft draws in 2D (plan view) only" (`crates/engine/src/cmd/exchange.rs:67`).
  - The Modeling tab's Box, Extrude and Revolve buttons are not wired to any command.
- **Rust only, no JavaScript.** Rust 2024, egui 0.36 and wgpu 30. The browser build is WASM via
  Trunk, using WebGPU with a WebGL2 fallback. There is no backend, no login and no LLM.
- **Size:** about 194k lines of Rust, with 2,212 tests.
  - `engine` is 97k lines and `ui-egui` 30k, both monoliths.
  - The small crates stand alone: `geom` (5k lines, 2D geometry), `constraints` (4.3k, a 2D sketch
    solver), `dxf` (1.2k, a DXF reader and writer) and `color`. A layer check keeps egui and wgpu out
    of everything below the UI crate.
- **No house semantics.** A wall is two polylines on a layer called Walls. There are no wall, door,
  window, roof, level or IFC objects.
- **What it has that we lack:** AutoCAD's way of working.
  - A command line taking typed coordinates (`@dx,dy`, `@d<a`).
  - Object snaps, ortho, polar tracking, grips and architectural units.
  - Layers and Properties palettes, dimensions, hatches, blocks, undo and redo.
  - DXF as its native format, plus PDF and SVG export.
  - An MCP server and a JSON control socket that let an agent drive it.
- **License:** `MIT OR Apache-2.0` (Cargo.toml, LICENSE-MIT, LICENSE-APACHE). The ArtCraft name and
  logos are excluded (`docs/brand/LICENSE-brand.txt`), so a distributed fork must remove them. DWG
  support pulls in `acadrust`, which is MPL-2.0 and isolated in `crates/dwg`.
- **Change rate.** The first commit was 2026-10-05. The code went from 57k lines on 2026-10-10 to
  194k on 2026-10-19. On 2026-10-19 the repo had 583 commits from 73 contributors, 311 open PRs,
  2,606 forks and releases v0.1 to v0.8 in twelve days. The project calls itself pre-alpha, "≈38%
  ready for real work".

## What Solstice already has, and what it lacks for this

- **It has the house.** `Wall` is `start`, `end`, `thickness`, `height` and `openings`
  (`packages/schema/src/document.ts:94`), with levels, slabs, roofs, rooms, a linter, a plan drawing,
  the sun and the path tracer.
- **The browser can edit what exists.** `editDocument(mutate)` in `apps/web/src/state/store.ts:202`
  applies every edit, there is a `TransformControls` gizmo, and the Inspector edits numbers. With the
  API running, Save writes the scene's JSON.
- **It lacks the CAD workflow:** no command line, no snapping, no orthographic plan camera to draw
  in, and no undo. The repo has no DXF code (grepped 2026-10-19).

## The options

| | **A. Fork CADCraft** | **B. Use CADCraft beside Solstice (DXF)** | **C. Lift CADCraft crates** | **D. Build the CAD feel in Solstice** |
|---|---|---|---|---|
| What it means | Build house building inside CADCraft's Rust codebase | Draw the plan in CADCraft and import the DXF into a scene | Compile `geom`, `constraints` and `dxf` to WASM, or port them to TS | Add a command line, snaps, an ortho plan camera and undo to Solstice's editor, drawing walls and openings |
| Fits our stack | No. Rust and egui; none of our six TS packages carry over | Yes. Only a file crosses | Partly. Needs a Rust and wasm-bindgen toolchain in an npm repo, or a hand port | Yes |
| Day one | AutoCAD-grade 2D drafting, no 3D and no house | Full 2D drafting, our renderer and sun | 2D intersection, offset and fillet maths, a sketch solver and a DXF parser | What we have today |
| House semantics | None. Walls, openings, levels, roofs, 3D, sun and path tracer all to build in Rust | Only through a layer convention (a `WALLS` line is a wall; door and window blocks are openings) | None | Already there |
| CAD-familiar feel | Highest. It is AutoCAD | High while drafting; switching apps to see the result | None by itself | As good as we build it; CADCraft's `docs/ui-parity.md` and command names are the reference |
| Upstream drag | Severe. 311 open PRs and code growth of 3.4x in nine days mean a fork diverges within days | Low. Only DXF has to stay stable | Low. Pin a commit and copy | None |
| License work | Remove the brand everywhere; MPL-2.0 if DWG stays | None; we only read files | Keep the MIT/Apache notices on what we copy | None (we read their docs, we don't copy code) |
| Breaks these decisions | All of them: WebGL2 and three.js, the semantic document, scene JSON as truth | None, if the DXF is read at scene-build time like a TS builder | None | "No freehand CAD drawing tools", which needs a revisit (see below) |
| Rough size | A new project; Solstice stops | 1–2 briefs: a DXF importer and a layer convention | 1 brief for the toolchain, then the feature that uses it | 3–5 briefs: plan camera, draw-wall command with snaps, openings, undo, command line |

## Which locked decisions each option touches

- **A** reverses most of [decisions.md](../../wiki/decisions.md):
  - "WebGL2, not WebGPU" (`three-gpu-pathtracer` has no Rust counterpart).
  - "Imperative three.js".
  - "Parametric-semantic document, not mesh CSG" (CADCraft's model is lines and blocks).
  - "Scene files are truth" (DXF would be).
- **B** fits the existing decisions. "TypeScript authors, JSON ships" already accepts a repo-time
  source compiled to JSON. A DXF read by a scene builder is one more such source. The lossy part:
  DXF has no levels, roofs or materials, so the builder supplies them, and CADCraft drops entities it
  does not model on save.
- **C** fits, but is only worth doing if D turns out to need a constraint solver. Solstice walls are
  segments, and snapping to their ends and midpoints needs no solver.
- **D** collides with one line, in [overview.md](../../wiki/overview.md) and the "No LLM inside the
  application" decision: "The browser's job is to *tweak, light and look* … there are no freehand CAD
  drawing tools." Drawing walls, openings and rooms is still semantic, so "Parametric-semantic
  document" holds. Two things would need writing down as a revisit, with a `log.md` note:
  - **Drawing in the browser:** the browser may draw semantic entities (walls, openings, rooms), but
    never free geometry.
  - **A house drawn in the browser has no TS builder:** its `*.scene.json` is its only source, and
    Save through `apps/api` is how it gets written. Today a scene's TS source overwrites its JSON on
    the next `npm run scenes`.

## Recommendation

**D, with B as a cheap later step.** Don't fork.

- **Why not A:** CADCraft is a 2D drafting program and Solstice is a 3D house and renderer. A fork
  keeps the part we lack (the feel) but throws away everything that makes Solstice what it is: the
  house semantics, the sun, the plan, the path tracer. It also signs us up to rebuild them in Rust
  next to a codebase growing by tens of thousands of lines a week.
- **Why D:** the CAD feel is a set of interaction conventions, not a codebase. Solstice can borrow
  them as a reference, with CADCraft's command list and `docs/ui-parity.md` as the checklist, and
  put them on the semantic document it already has.
- **Why B later:** once D exists, a DXF importer lets a plan drawn in CADCraft, AutoCAD or anything
  else seed a scene. CADCraft's MCP server is also a way for an agent to draft that plan.

## The owner decides

1. **Which option:** A, B, C, D, or D then B.
2. **If D (or B):** whether to revisit "no freehand CAD drawing tools" as "the browser draws
   semantic entities, never free geometry".
3. **If D:** whether a house drawn in the browser lives only as JSON, written by Save through
   `apps/api`.
4. **If A:** whether Solstice is frozen, and whether the fork is ever distributed (that decides the
   brand removal).

## Files you OWN (for this decision brief)

- This brief's outcome note, when it moves to `done/`
- `corpus/wiki/decisions.md` and `corpus/wiki/overview.md`, only to record the revisit the owner
  approves
- `corpus/log.md`, and the follow-up build brief(s)

## Files you must NOT touch

- Any code. This brief builds nothing.

## Acceptance

- The owner has picked an option, and it is written in this brief's outcome.
- Any revisited decision is in `decisions.md` with its date, what it replaced and why, plus a
  `log.md` note.
- The follow-up build brief exists in `briefs/todo/`.

## Outcome (2026-10-21)

The owner chose **D only**: build the CAD habits into Solstice's own editor. No fork, and no DXF
import, not even as a later step. Asked what architects actually use, the answer was Revit and
ArchiCAD, which draw with building parts rather than lines. That is the model Solstice already has,
so the feel copies them: pick a tool, click points in a plan view, type a length or an angle while
drawing. AutoCAD's command line is not copied.

Both revisits this brief asked about were approved and are recorded in
[decisions.md](../../wiki/decisions.md#the-browser-draws-building-parts-never-free-geometry):

- The browser may draw walls, openings, rooms, slabs and roofs. It never draws free geometry.
- A house started in the browser is a `*.scene.json` with no TypeScript builder, created and saved
  through `apps/api`. Drawing in a scene that has a builder is allowed, but the browser warns first,
  because the next `npm run scenes` erases it.

[overview.md](../../wiki/overview.md) no longer says the browser does not originate scenes.

Two facts found while writing the follow-ups changed their shape. The web app opens only the three
scenes bundled at build time (`apps/web/src/scenes.ts`), so a drawn house also needs the scene picker
to read from the API. And `planSvg` throws on a level with no walls and fits its sheet to the walls
on every call, so the plan you draw in is a new surface in world metres, with the 1:100 sheet kept
beside it.

Follow-ups: [75](./75-a-plan-view-to-draw-in.md) (the plan view),
[76](./76-undo-and-redo.md) (undo and redo),
[77](./77-the-wall-tool.md) (the Wall tool),
[78](../todo/78-doors-windows-and-rooms.md) (doors, windows, rooms and floors), and
[79](../todo/79-a-new-house-and-scenes-from-the-api.md) (a new house, and scenes from the API).
Roofs are a later brief.
