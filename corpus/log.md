# Log

## [2026-09-11] decision | Architecture and visual direction settled

Full grilling session before any code existed. Settled: parametric-semantic scene
document, imperative three.js on WebGL2, two fidelity tiers, files-are-truth
persistence, no LLM in the app, Darkroom visual direction. See
[wiki/decisions.md](./wiki/decisions.md) for the locked calls and their reasons,
and the design artifact at
https://claude.ai/code/artifact/e2be0838-6bae-4731-898e-6a1a77609d20
for the three UI directions that were compared.

## [2026-09-11] done | Brief 01 — Scene document schema and linter

Monorepo scaffolded (npm workspaces, exact pins, one lockfile). `packages/schema`
ships the Zod document schema, twelve semantic lint rules, `loadScene`
(parse → lint → throw), and TypeScript authoring helpers. `scenes/` holds the
reference scene `villa-carpathia`, authored in TypeScript and compiled to
canonical JSON by `node scenes/build.ts` — Node 24 strips the types natively, so
no `tsx` and no compile step.

39 tests pass; `npm run check` runs build → typecheck → test → scene build →
corpus lint as one gate.

Two traps worth remembering. Zod 4's `.default({})` hands back the literal value
**without re-parsing it**, so nested defaults never applied and every consumer read
`undefined` — `.prefault({})` is the one that parses. And `corpus/lint.sh` reported
clean while printing a failure, because its link check ran inside a pipe subshell
where the failure flag was lost; it now uses process substitution.

Brief: [01-schema-and-linter.md](./briefs/done/01-schema-and-linter.md).

## [2026-09-11] done | Brief 02 — Geometry generator

`@solstice/geometry` compiles a scene document into three.js objects: wall solids
with openings subtracted via `three-bvh-csg`, extruded slabs, gable and flat
roofs, terrain, and a `context` tier of seeded `InstancedMesh` scatter, extruded
building masses and road ribbons. Returns a `THREE.Group` split by tier, per-tier
triangle statistics, and `dispose()`.

No WebGL context is created anywhere in the package, which is what makes the 22
new tests possible — including a raycast that proves an opening is genuinely cut
(a ray through the hole misses, a ray beside it hits) rather than inferring it
from a triangle count.

The two-tier decision is now measured rather than predicted: **321 subject
triangles against 10 896 of context**, and that is with proxy trees of ~38
triangles. Real Poly Haven models would make those same 284 instances 14–57
million.

Brief: [02-geometry-generator.md](./briefs/done/02-geometry-generator.md).

## [2026-09-11] blocker | Cannot push — no GitHub credentials on this machine

`origin` is `https://github.com/gandolh/3D-sandbox.git`, but there is no `gh` CLI,
no git credential helper, no `GH_TOKEN`/`GITHUB_TOKEN`, and no GitHub SSH key
(`~/.ssh` holds GitLab and VPS keys only; `ssh -T git@github.com` is denied).
Commits accumulate locally on `main`. Resolving this needs a human — a token, a
credential helper, or a deploy key.

## [2026-09-11] done | Brief 03 — Solar time

`@solstice/solar` resolves a site and a wall-clock moment into sun altitude and
azimuth, a scene-space direction vector, day bounds, and a viewport lighting
model. Timezone handling is two-pass so times near a DST transition resolve
correctly, with tests either side of the 2026-03-29 Bucharest boundary.

Two findings. **suncalc 2.0.2 differs from 1.x in both units and convention** —
degrees rather than radians, azimuth north-based clockwise rather than from
south. The remembered 1.x conversion would have put the sun in the wrong quadrant
while still looking plausible; reading the shipped `index.d.ts` caught it.

And **the canonical sun figures moved**: hand-computed 32.3° / 272.3° became
**32.949° / 271.654°** once refraction was accounted for. The artifact, the scene
and the regression test now agree on suncalc's numbers.

Brief: [03-solar.md](./briefs/done/03-solar.md).

## [2026-09-11] done | Brief 04 — Viewport and app shell

`apps/web` renders the reference scene: Vite 8, React 19.3, Tailwind 4,
`@base-ui/react` 1.8.0, and an imperative `SandboxEngine` that owns renderer,
camera, orbit and gizmo. React renders chrome only and never drives the loop.

Verified in a real browser rather than only by build output — and that caught two
bugs the build could not. `extrudePolygon` both mirrored footprints about X and
lifted solids by `base + height` instead of `base`, so every neighbouring building
mass floated a storey above the ground; and context masses had open gable ends you
could see through. Both fixed, with regression tests on the extrusion bounds.

`LintFinding` gained `entities` — the chain of ids enclosing its path, resolved
centrally in `lintScene`. The inspector had been filtering findings by grepping the
entity id out of the prose message, which worked and would have broken silently on
the first reworded error.

Brief: [04-viewport-shell.md](./briefs/done/04-viewport-shell.md).

## [2026-09-11] done | Brief 05 — Fastify persistence API

`apps/api`: seven routes, files as truth, a derived index rebuilt by rescanning.
Every write goes through `loadScene`, so a document with errors returns 422 and
the file on disk is untouched — verified live, not just in tests. Path traversal
is rejected at the id, which is the security boundary because the id becomes a
filename.

Uses Node's built-in `node:sqlite` rather than a native driver — see
[decisions.md](./wiki/decisions.md). Zero native dependencies matters more than a
stable API for a cache that can be deleted at will.

Two defects found and fixed on the way: `loadScene` let Zod's own error escape, so
a malformed payload returned 500 instead of 422; and the API's scene summary
computed scatter counts separately from the lint rule and got them wrong
(2 instead of 284). `estimateScatterInstances` is now one shared function.

Brief: [05-persistence-api.md](./briefs/done/05-persistence-api.md).

## [2026-09-11] done | Brief 06 — Path-traced render

The feature the WebGL2 decision was made for. `three-gpu-pathtracer@0.0.24`
accumulates samples behind an explicit Render action, with BVH build progress, a
sample counter, cancel, and a PNG download at the shot's declared size.

Three failures, all found by running it rather than building it: `setSceneAsync`
needs a BVH worker registered first; the path tracer cannot sample the viewport's
`Sky` shader mesh, hemisphere light or gizmo helpers, so renders get a
purpose-built scene; and `scene.environment` must be an equirectangular texture
with readable pixels, which a PMREM render target is not.

That last one produced `skyRadianceMap` in `@solstice/solar` — a sky dome as
pure arithmetic over a `Float32Array`, testable without a GPU, replaced by a real
HDRI when assets land.

**It has only run on software WebGL** (0.22 samples in 74 s at 960 × 540). That
is an environment limit, not a measurement — but nobody has seen this on real
hardware, and the shot defaults are untested at speed.

Brief: [06-path-traced-render.md](./briefs/done/06-path-traced-render.md).

## [2026-09-11] done | Brief 07 — Physics as an authoring aid

`@solstice/physics` derives rapier colliders from the scene document and answers
two questions while someone is placing things: where would this land, and does it
overlap anything. Nothing it computes is persisted.

**Openings are cut out of wall colliders** — solid spans either side of a door,
a lintel above, a spandrel under a window. One box per wall would have made a
doorway impassable. Because openings are positioned along their wall by offset,
this is arithmetic rather than geometry, which is the semantic document paying
for itself.

Three fixes on the way: ray probes must run after the dropped body is removed, or
they hit it at time-of-impact zero; a floor slab and the ground beneath it are
coplanar so all ray hits are gathered and a named entity beats the terrain; and
rapier lets a settled body sink into what it rests on, so resting positions are
snapped to the probed surface.

Also fixed: the generator produced **nothing at all** for placements. They now get
proxy boxes, and the reference scene has three.

This completes the agreed sequence. All seven briefs done, 163 tests.

Brief: [07-physics-authoring.md](./briefs/done/07-physics-authoring.md).

## 2026-09-11 — The path tracer runs on a real GPU

Answered "can the agent browser use the GPU under WSL2": yes, but only headed.

Chromium enumerates GPUs through `/dev/dri`, which WSL2 does not have — it
exposes `/dev/dxg` instead, which Chromium has no concept of. So headless falls
back to SwiftShader silently, whatever GPU flags are passed. WSLg's X server on
`:0` already has Mesa bound to the `d3d12` driver, so a headed browser with
`--ozone-platform=x11 --use-gl=angle --use-angle=gl` inherits that context.

Measured on `villa-carpathia`: **3.2 samples/sec** against 0.003 on SwiftShader.
A 2,000-sample shot is ~10 minutes, not effectively never.

Wrote [wiki/running-on-a-gpu.md](wiki/running-on-a-gpu.md) and cleared the
warning in [wiki/status.md](wiki/status.md). No code changed — this was an
environment finding, not a defect.

## 2026-09-11 — Grilled the open questions; three briefs, and a rule that never ran

Two findings reframed the whole page.

**`asset-resolves` has never run on a real scene.** It only fires when
`knownAssets` is supplied, and the only callers that supply it are two tests. So
**eight of Greenhollow's thirteen asset slugs do not exist** — verified 404
against `api.polyhaven.com` — committed one change after the corpus note warning
about exactly that failure mode. A written-down rule that is never armed is not a
rule; it is a note.

**Poly Haven has no fruit trees, no roses, no fountain and no vegetable bed.** Of
521 models it offers three usable temperate trees, four shrubs, three planter
boxes and a few benches. An orchard of pines is not an orchard.

Settled: the manifest is generated by scanning and enforced by `check`; honest
substitution beats per-asset licence hunting; a schema version bumps on meaning,
not on addition. Also found that the path tracer already samples `alphaMap` and
`alphaTest`, so foliage cut-outs need no engine work — which is what made the
vine question a texture brief rather than a renderer one.

Briefs [10](briefs/todo/10-asset-manifest-and-models.md),
[11](briefs/todo/11-textures-and-foliage.md) and
[12](briefs/todo/12-render-convergence.md) written. `decisions.md` passed the
200-line cap and split into stack and [scene](wiki/decisions-scene.md) halves.
Hip roofs and stairs parked — nothing is blocked on either.

## [2026-09-11] done | Published to the estate, and on the showcase shelf

Solstice now has a stack in `vps-deploy` (`stacks/solstice.ts`) and a kit on the
`showcase` gallery (kit 12, `/solstice`). Neither has been *run* yet: the deploy
is written and dry-run clean, and the showcase kit says so rather than linking a
page that does not exist.

**The client deploys; the API deliberately does not.** The obvious shape was
`WebServiceStack`, like atrium — a static client plus a containerized Fastify
service. It is the wrong one here, and for a reason that comes straight out of
[wiki/decisions.md](./wiki/decisions.md): scene files are truth, and the API is a
writer over them. Published unauthenticated at `/solstice-api`, `PUT
/api/scenes/greenhollow` from anybody on the internet overwrites the reference
scene. Authoring is a repo-time activity by design, so there is nothing a public
writer would be *for*. If it is ever wanted on the box it needs Ward in front of
it first, and then it is a different stack, not a flag on this one.

Nothing is lost by that. The client bundles the scene it loads and derives
geometry, colliders, sun position and the path-traced render in the browser, so
what ships is the whole editor and the whole renderer.

**One code change, forced by the deploy.** `Save` posted to a hardcoded
`/api/scenes/:id` and fell back to downloading the canonical file when the fetch
*threw*. Behind a Caddy sub-path with no API, that fetch does not throw — it
reaches the estate's 404 handler and returns a perfectly valid HTTP response, so
the fallback would never fire and the user would be told the API refused a save
it never saw. The base is now `__API_BASE__`, injected by `vite define` from
`SOLSTICE_API_BASE` (default `/api`, which is what the dev proxy expects). Empty
means *this build has no API at all*, which is a different thing from an API that
is down, and is checked before the request rather than after it. Verified against
the real sub-path artifact: `No API in this build — downloaded instead`.

Also confirmed end to end that the sub-path build is sound — `SOLSTICE_BASE`
drives `base`, `index.html` references `/solstice/assets/…`, and the built bundle
path-traces Greenhollow on the real GPU from a static file server.

## 2026-09-11 — Briefs 10 to 13: the scene stopped being grey boxes

Four briefs in one run, and the measurements mattered more than the code.

**The asset rule had never run.** `asset-resolves` only fires when `knownAssets`
is supplied and only tests supplied it, so eight of Greenhollow's thirteen slugs
did not exist. Armed in two layers, neither of which can evaluate to "off".

**Poly Haven's trees cannot be scattered.** `pine_tree_01` is 17.4 M triangles
and 905 MB at *every* resolution — resolution only ever described the textures.
So they are baked to angle atlases. Crossed quads rather than camera-facing
billboards, because a path tracer has no "the camera" to face: rays arrive from
every direction at once. That is the design the brief got wrong and reality
corrected.

**UVs had to be fixed before textures could help.** Boxes carry 0–1 UVs across
every face, so the first real texture would have stretched one brick across a
6.4 m wall. World-metre projection plus `Material.textureScale`.

**Loading the maps exposed two authoring lies.** `grass-lawn` pointed at a sand
texture and `plaster-lime` at a brick one; a green hex and a cream hex had hidden
both since the scene was written.

**The 2,000-sample default was worth about 45 minutes a shot.** Measured
convergence puts 300 within 1.8 RMS of 1,500. Budgets are 600. And the study
answered the denoiser question it was deferred behind: yes.

Bugs found only by running it: a placement dropped to the floor landed on its own
collider; the inspector claimed "proxy geometry" while showing a loaded model.
Briefs [10](briefs/done/10-asset-manifest-and-models.md),
[11](briefs/done/11-textures-and-foliage.md),
[12](briefs/done/12-render-convergence.md),
[13](briefs/done/13-vegetation-impostors.md) all closed. 207 tests.

## 2026-09-11 — Audited against the original brief; five briefs queued

Asked whether the goal was met. Mostly yes, and the audit found one real gap and
a handful of untruths.

**Met**: three.js in the browser, a Fastify API that `Save` writes through, every
version exact (only `engines.node` is a range), a parametric editor, physics
derived from the semantic document, solar time, and path-traced renders of a
house with its yard and its surroundings.

**The gap**: *animation time*. The opening request named `animejs`. The glossary
defines animation time. `Timeline.tsx` says the playhead "**is** a sun-path study
— the same tween an animation keyframe would drive". None of it exists:
`animejs` and `motion` are in no `package.json`, the document has no keyframes,
and the only `requestAnimationFrame` in the app is the render loop. The user
deferred a play mode to "later" during the grilling, so it is not a broken
promise — but the code claims to have built it. → [brief 14](briefs/todo/14-animation-time.md)

**Also found**: no render has ever run to completion, so `toBlob` and the
download have never executed (→ 15); `three-gpu-pathtracer` already ships a
`DenoiseMaterial` nobody wired up (→ 16); `xatlas-web` is an unused dependency,
`overview.md` still says the app and API are "not yet built", and there is no
README (→ 17); two trees are unbaked and the vine is thin from underneath (→ 18).

## 2026-09-11 — Briefs 14 to 18: animation, and the render that came out black

**The render that finally finished came out black.** Every render in this
project's life had been cancelled, so `toBlob` had never executed. The renderer
has no `preserveDrawingBuffer`, so the buffer is cleared before the next
compositing step and a `toBlob` issued a frame later reads nothing: 44 KB of
RGB(0,0,0) at 1920 × 1080, after fourteen minutes, with the correct image on
screen throughout. Captured in-tick now. The bake harness had set that flag
explicitly, with a comment; the render path never connected the two.

**Animation time exists.** Tracks of keyframes in the document, evaluated by a
pure `packages/animation`, driven by anime.js. The decision that mattered was
not in the brief: playback cannot go through the document, because `setSolar`
clones it, re-parses it, re-lints it and bumps the revision — and the viewport
regenerates the scene on a revision change. Sixty frames a second is sixty
rebuilds. The playhead drives the engine; the transport commits once, on stop.

**The denoiser made things worse.** Brief 12 predicted it would help, from sound
1/√N reasoning. Measured: RMS *rose* from 13.62 to 13.75 at 150 samples and
11.75 to 12.16 at 400. This scene is nearly all high-frequency material and an
edge-aware blur has little it can safely touch. It ships off. The same kind of
reasoning that produced that prediction produced the 2,000-sample default;
measuring settled both, in opposite directions.

Also: `xatlas-web` removed (imported nowhere), a README written, a duplicate
obsolete `Next` section deleted from status, `running-on-a-gpu.md` split at the
line cap, `apps/web` tested from one file to three, and the vine's clusters made
crossed quads so the canopy reads from underneath.

Deferred on purpose: baking `pine_tree_01` and `fir_tree_01`, at the user's
request to spend less machine time. 231 tests.

## [2026-09-11] done | A shot list you can leave running

Brief 19. `Render all` queues every declared shot in document order and says
what it will cost first — greenhollow's four shots are 2,400 samples, about 58
minutes at the measured 0.69 samples/s. `renderQueue` and `estimateQueue` are
pure and headless; the estimate scales by pixel count, because the rate is
per-pixel work and samples alone would call a 960 × 540 shot as slow as a
1920 × 1080 one.

**The end-to-end rewrote the design.** A two-shot queue reported "Rendered 2 of
2" and left **one PNG**. Chromium gates automatic downloads after the first from
a page and does it non-deterministically: the second sometimes never arrived,
once arrived ninety seconds late, the third onwards never — with no error, no
exception and no console message any of those times. The `<a download>` path had
been correct since brief 06 only because a single render needs exactly one
download; queueing is what exposed it.

Renders now write through a `FileSystemDirectoryHandle` picked on the button's
own click, where a failure throws. Verified at three shots: three files, 148–169
KB, real PNG signatures, three distinct cameras.

Also closed on the same pass:

- **The denoiser question is answered no**, and the reason is now on the record
  rather than left open: a trained denoiser earns its weights by rescuing low
  sample counts, and brief 12 measured 300 samples as within 1.8 RMS of 1,500.
  There is no low-sample regime here for it to rescue.
- **Corpus honesty.** `overview.md` still claimed the app could not animate,
  five briefs after it could. `status.md` claimed `git push` was blocked — it is
  in sync with origin — duplicated four paragraphs verbatim, and stopped its
  brief table at 07 with eighteen written. `lint.sh` passed clean throughout,
  correctly: it checks frontmatter, links, size and paths, and none of those is
  whether a sentence is still true.
- **The deploy could not be executed.** `/var/www` is root-owned and the
  Caddyfile install needs sudo with a password on the box; the dry run is clean
  and the two commands a human must run are in `status.md`. Worth noting the
  Caddyfile is estate-wide — installing it rewrites routes for all 18 stacks,
  which is a larger action than "deploy solstice" and belongs in a human's hand.

## [2026-09-11] done | A second scene, and the three bugs it found

Briefs 20 and 21. The open question after the audit was whether the document
format generalises or is quietly shaped like one smallholding. **It
generalises**: Elmsgate — a two-storey mid-terrace on a 6.5 m lot, party walls
on both boundaries, railed forecourt, walled rear yard — needed no new entity
type, and `Subject.levels` holding two things worked the first time it was
asked to. Every level in the project before it sat at elevation 0.

The value was not in the answer. It was in what looking at the result turned up:

- **Both gable builders wound the ridge-along-X branch backwards**, so the slope
  normals pointed into the building. The other branch is correct and no test had
  ever asserted a direction, so this had been true since the roof builder was
  written — and **Greenhollow's house and garage roofs, which both declare
  `ridgeBearing: 90`, have been inside out in every render of the reference
  scene**. Elmsgate's roof rendering solid black is what forced the chase;
  measuring the normals headlessly is what settled it.
- **`Run` built every fence as two rows of posts.** Right for a pergola or a
  colonnade — you walk through those and `width` is the span — and wrong for a
  railing, whose `width` is a thickness. `run-is-well-formed` had been warning
  "narrower than its own posts" all along, and the honest reading of that
  warning was that the geometry was wrong rather than the number.
- **`BuildingMass` had no ridge bearing** while `Roof` did, so a context
  neighbour always took the long-axis guess — wrong by ninety degrees for a
  terrace, and a row that could never line up.
- **An upper floor's slab z-fights through the facade** when drawn on the wall
  centrelines. A document error, not a generator one: ground slabs never showed
  it because they sit below grade.

A scene picker went in first (brief 20) so the second scene had somewhere to be
opened. It re-parses through Zod on every switch rather than trusting the
bundled JSON, and resets selection, shot and playhead — all ids into a document
that has just gone away. `villa-carpathia` is openable for the first time.

The lesson is the one this project keeps relearning, in a new place: **running it
catches what building it cannot.** Three of these four were invisible to the type
checker, to the linter that was actively warning about one of them, and to 248
passing tests.

## [2026-09-12] audit | What to do better: 26 findings, 14 real, 6 briefs

A five-lens audit — correctness, geometry/render performance, web+bundle
performance, structure/debt, coverage — run in parallel and then vetted by
re-reading or re-measuring every cited line. **26 raw findings, 14 survived.**
Five were dropped as locked decisions or non-issues, including one of my own:
"add a linter for floating promises" earns nothing here, because every
fire-and-forget site is already explicitly `void`-marked and `tsconfig.base.json`
is strict.

The headline is that **two independent lenses found the same live bug**, and it
is the third instance of one class:

- **Roads render black.** `buildRoad` winds its ribbon backwards, so every road
  normal is `(0, −1, 0)` — measured on the shipped build, and visible in the
  viewport as a pure-black road and alley against lit terrain. That blackness
  appears in screenshots taken during briefs 19 and 21 and was read both times as
  "asphalt is dark". The two gable builders had the same bug, found and fixed on
  2026-09-11. All three were invisible for the same reason: **the tests assert
  bounding boxes, and a bounding box is identical whether a surface faces the sky
  or the ground.** Brief 23 fixes the road and puts a shared facing assertion
  across every hand-wound builder.

The most severe finding was new, from the correctness lens:

- **Placement colliders are rotated in degrees and read as radians.**
  `colliders.ts:70` copies `placement.rotationY` — a `Degrees` document field —
  into a collider field that `world.ts` and the overlay both feed to three.js as
  radians, while the mesh path correctly calls `degToRad`. Elmsgate's bench sits
  at 180° and its collider at 180 radians ≡ 233°. `degToRad` is imported into
  that file and never called, and a test asserts the wrong value, pinning it.
  Brief 22.

The rest of the **Now** tier: a physics world cached without regard to asset
sizes, so a drop before models load poisons every drop after it (24); ~2 MB of
Rapier WASM and the whole path tracer in the first paint for features most
visitors never reach (25); 11.2 MB of source maps shipped to production against a
4.3 MB bundle (26); and **three of thirteen lint rules with no test proving they
fire**, plus `unique-ids` silently not covering `subject.runs` despite a doc
comment claiming completeness (27) — the same shape as the never-armed
`asset-resolves` that shipped eight invented slugs.

**Next**, real and recorded but not yet spec'd: sun positioning typed out twice
inside `SandboxEngine` where a comment promises the viewport and the render must
agree; `roof-covers-walls` applying `overhang` as slack in the direction that
lets an *undersized* roof pass; `POST /api/scenes` gating on the derived index and
so clobbering a scene file the index has not seen; the scatter estimate and the
scatter generator disagreeing for row fields, which is the triangle-budget guard
quoting a number the generator never produces; impostor materials never disposed;
`wallBearing` implemented twice with the `@solstice/geometry` copy dead; the
render queue's `startRender` outside its own try/catch; `prepareAsset`'s grounding
untested though `colliders.ts` depends on it in writing.

**Watch:** scatter instances computed twice per unbaked field · `dayBounds`
recomputed every animation frame · two merge helpers disagreeing on what to do
with missing normals · wall-rotation trig duplicated across geometry and physics
with nowhere shared to live · solar tests pinned to suncalc's own output rather
than an external ephemeris · no CI runs `npm run check`.

The pattern across the whole audit is one thing said three ways: **this codebase's
tests assert that output exists and is roughly the right size, not that it is
correct.** Bounding boxes instead of directions, counts instead of associations,
silence on a good document instead of a finding on a bad one.

## [2026-09-12] audit | Rounds 2–4: twelve lenses, twenty-one briefs

Three further audit rounds after the first. Round 2 took the lenses the first
pass skipped — security and resilience, dependencies and tooling, DX, and the
chrome as a product. Round 3 went deep on linter semantics and duplication.
Round 4 covered engine lifecycle, the scene documents, and test quality. Every
cited line was re-read or re-measured before it was believed.

**The single most valuable finder was engine lifecycle**, because scene
switching had shipped the day before and nothing had ever checked it. It found
that **every scene after the first renders with the wrong assets**: `loadAssets`
runs in a mount-only effect, `materialsFor(doc)` builds a map keyed by *that*
document's material ids, and `setAssets` stores it forever. Switch scenes and
only the ids that happen to collide resolve — for Greenhollow → Elmsgate that is
`asphalt-road` and nothing else. The path-traced render inherits the flat
materials, so an hour of GPU produces an untextured image. The same shape applies
to `setAssetSizes`, which is worse: a placement with no known size gets **no
collider at all**, so drop-to-rest falls through to the terrain.

I could not isolate that one in the browser — the asset load had already resolved
before the switch landed, and the differential test failed. It is proven by
construction and recorded as such.

**Security has one finding that is not the locked decision it resembles.**
`cors({ origin: true })` reflects any origin. The "API is unauthenticated on
purpose" decision covers *authentication*; it does not cover switching off the
browser's own same-origin protection. Without CORS a cross-origin `DELETE` fails
at preflight; reflecting the caller's origin permits it. Any page open in any tab
can enumerate and `rm` the scene files the project calls its source of truth.

**Two findings are about promises the code makes and does not keep.**
`writeSceneFile` argues in its own comment that validating before writing is what
makes "files are truth" safe — and then writes with a bare `writeFile`, so a
crash mid-write truncates the document and the next reindex silently drops it.
And `scatter-density-is-sane`, the only guard on document-driven geometry volume,
is `severity: "warning"` — so it cannot refuse a document, and the sampler's own
bound, `target * 40 + 1000`, scales with the number it exists to limit.

**The root cause behind six separate findings got its own brief (37).**
`geometry → schema` and `physics → schema`, and nothing may depend on `geometry`
— so anything the generator *and its checker* both need has nowhere to live and
gets copied. That is how `run-is-well-formed` came to hold a literal `2 * 0.08`
copy of the generator's `POST` constant: the rule is not checking the generator,
it is checking itself. Eight instances tabulated; two have already caused
visible bugs.

**Two findings are about this project's own honesty.** The documented quickstart
cannot work on a fresh clone — every workspace package's only entry is
`./dist/index.js`, `dist/` is gitignored, and `npm install` does not build. And
`scenes/` has no `tsconfig.json` and is absent from the root reference graph, so
1,200 lines of scene authoring — the part a human actually writes by hand — are
type-checked by nothing at all.

Accessibility was audited for the first time: the status line is **3.20:1 on
dark and 2.73:1 on light** against a 4.5:1 floor, nothing anywhere is announced,
severity is colour-only, and the render **Cancel** button sits behind every row
of the scene tree in tab order.

The theme from round 1 held all the way through, and widened. The tests assert
that output exists and is roughly the right size, not that it is correct — and
in one case (`colliders.test.ts:166`) a test asserts the **wrong** value
outright, which is why the degrees-vs-radians bug ships with `check` green.

## [2026-09-12] audit | The maths pass, and one finding that did not survive

The numerical round finished last, after dying twice on a quota limit. It ran the
built package code rather than reasoning about it, and it explicitly **cleared**
several things worth not re-litigating: `suncalc` really does return north-based
clockwise degrees; `skyRadianceMap`'s (u,v)→direction inversion matches three's
`equirectUv` to four decimals; `extrudePolygon` treats clockwise and
counter-clockwise footprints identically; `pointInPolygon` is standard PNPOLY;
and the impostor atlas slice wraparound is correct at 359.9°.

Three real findings came out of it:

- **Impostor quads are the wrong shape.** The baker renders a *square* cell of
  side `max(sx, sy, sz)`; the consumer builds a quad of aspect `max(sx, sz) / sy`.
  For `tree_small_02` that draws every tree at w/h 0.8874 instead of 0.9420 —
  5.8 % too narrow. For an asset that is not tallest in Y it is far worse: a
  `[6, 2, 6]` shrub draws 0.667 m tall instead of 2 m and floats above the
  ground. Latent only because the one baked asset is the forgiving shape.
- **The sun's Y-clamp lies to the sky dome but not to the environment map**, so
  below the horizon the viewport paints a sunset and the render of the same shot
  comes back black. The clamp protects the shadow light from a degenerate
  direction, which is a real need; it should not also be steering the dome.
- **Scatter seeds do not mix in the field id**, so two fields over one polygon
  that both omit `seed` place byte-identical forests. `runs.ts` already hashes
  the entity id for exactly this reason; the scatter tier skipped it. Same
  function also subtracts exclusion areas unclipped, so a straddling exclusion
  under-plants by 14 %.

**And one finding was refuted by checking it.** The pass claimed `boxProjectUv`
gives the +X and −X faces identical UVs, mirroring one of them. My first attempt
to check appeared to confirm the opposite — but that probe was wrong too: a box
corner is shared by three faces, so looking a vertex up by position alone returns
whichever came first. Re-run filtered by face normal, the ±X faces get **opposite**
u directions, and working through the camera basis for each face shows all four
run u left-to-right seen from outside. The projection is correct. Dropped.

That is twice in one day that a finder's quoted arithmetic did not survive
re-running, and once that my own refutation was as flawed as the claim.

Separately recorded in [open-questions.md](wiki/open-questions.md): **the scene's
compass is left-handed.** With +Y up and +Z north, a right-handed frame puts east
at −X, not +X. Everything downstream is internally consistent, so no scene is
wrong on its own terms — but a plan transcribed from paper is built as its mirror
image. That is a decision, not a bug fix, because changing it silently changes
what every existing scene means.

## 2026-09-12 — Two units and two lifetimes

The first two briefs off the audit queue, both live bugs, both the same shape:
**a value that meant one thing being read as another.**

**22 — degrees read as radians.** `deriveColliders` copied `placement.rotationY`
straight into `CuboidCollider.rotationY`. The document stores degrees; both
consumers — `quaternionFromY` and the viewport's overlay — read radians, and so
does the mesh the collider is meant to be shaped like. Elmsgate's bench sat at
180° with a collider at 180 **radians**. The conversion is one call, and
`degToRad` was already imported and never used.

The interesting half was the test. The old one asserted a bare `30`; changing it
to `degToRad(30)` would only have proved the implementation calls the function
the test calls. The new one turns the yaw back into a direction — a quarter turn
must send the box's local +X axis to −Z, under the rotation three applies to the
geometry for the same placement. Verified by taking the conversion back out: it
fails.

**39 — one document's names used for every document.** The material mapping is
the only thing that knows both the document's material ids and the library's
`<source>/<slug>` names, and it was built once, when the download resolved,
against whichever scene was open at that moment. The library and the view of it
had been given the same lifetime. Separating them is most of the fix:
`SandboxEngine` now holds `{ assets, materialsFor }` and resolves the view
inside `setDocument`. `setAssets` lost a parameter as a result — the caller no
longer has a document to pass, so it can no longer pass the wrong one.

`assetSizes` had the same shape and a quieter consequence: filtered to the first
document's placements, and `deriveColliders` skips what it has no size for, so a
later scene's bench got no collider at all. Now the whole library's sizes are
published and the document selects from them.

Confirmed in the browser — Elmsgate's pavement is textured, and `pavement-stone`
is an id Greenhollow does not have.

258 tests, `npm run check` clean.

## 2026-09-12 — The facing guard, and a fourth instance

Brief 23. `buildRoad` wound both triangles of every quad backwards, so every
road in all three scenes rendered pure black — visible in two earlier briefs'
screenshots and read as "asphalt is dark". Confirmed fixed in the viewport at
13:00: lit grey asphalt.

The brief's real subject was the class, not the instance. Three bugs have now
been the same bug, and all three survived a passing suite because **a bounding
box is identical whether a surface faces the sky or the ground**. So the
assertion now lives once, in `packages/geometry/test/normals.ts`, and reads
positions rather than the normal attribute — winding is what goes wrong, and the
normal attribute is downstream of it. Deliberately per-triangle: a signed volume
or a mean normal lets one inverted face hide behind fifty correct ones, which is
exactly how the gable bug survived.

Every hand-wound builder swept. Roads were broken; the two gable paths, the
extruder, the wall solid, all three run kinds and `mergeSimple` were clean and
are now pinned. `proxyTreeGeometry` flags six triangles that are the cylinder's
top cap — an interior face of a non-convex merge, a limit of the convexity
heuristic rather than a bug, and the guard now says where it applies.

**The fourth instance had no inverted triangle in it.** A pergola's climber is
crossed flat quads, on purpose, so foliage reads from any direction — and every
material this package builds is three's default `FrontSide`, which culls a
plane's back. So from under the canopy, which is where the approach shot puts
the viewer, the pergola showed sky through itself. The crossing existed
precisely to prevent that and the culling undid it.

Worth naming, because it widens the class: *a surface facing away from where you
are standing* is the bug. Backwards winding is one way to get there; one-sided
material on a two-sided surface is another. Fixed by cloning that one mesh's
material two-sided, and the test asserts nothing else became so.

263 tests.

## 2026-09-12 — The render path: who owns the GPU, and who frees it

Briefs 40 and 41, done together because they are the same file arguing with
itself about ownership.

**41 — who may start and stop a render.** `startRender` used to open with
`cancelRender()`, which nulled the session without awaiting it, so the outgoing
one reached its `finally` minutes later and resized the renderer, re-enabled
orbit and popped the gizmo back on screen in the middle of the new render. It
now refuses instead: a queue already exists a layer up, where it can show
progress and write each file as it lands, and a second invisible one could only
lose work quietly. Teardown of shared state moved to the engine and is guarded
by ownership — the session frees its own GPU resources and touches nothing it
does not own.

The scene picker, Context, Save and both Render buttons are disabled while a
render runs. `isRendering` finally has a caller, though not the one the brief
expected: it is still false when a second event arrives in the same tick,
because `startRender` runs inside an async block. The store's flag, set
synchronously, is what actually closes that window. Found by trying it in a
browser rather than by reasoning about it.

**40 — what a render leaves behind.** Upstream's `WebGLPathTracer.dispose()`
frees three things and leaves two large ones: both path-tracing materials, whose
uniforms hold the BVH, every triangle's attributes and one 1024² layer per scene
texture; and `_lowResPathTracer`, an entire second renderer that `dynamicLowRes`
keeps alive. Also fixed: the cloned render scene's instance buffers, the
engine's sky, selection box, shadow map and overlay on teardown, an exported
`disposePhysics` with no callers, and an `AbortSignal` that reached only the
first of twenty-odd fetches.

**Two things the brief got wrong, both found by doing it rather than reading
it.** `forceContextLoss()` unconditionally is wrong — it is permanent for that
canvas, React keeps the same canvas across a Fast Refresh, and it took the app
down on the first HMR update. And disposing before releasing ownership turned a
throw into a hang: `this.render` stayed set, the frame loop kept stepping a
half-disposed session at full rate, and the tab pegged a core. Ownership is
released first now, and the walk into library privates is wrapped.

**The measurement the brief asked for could not be taken, and that is recorded
rather than approximated.** This machine has no hardware GL; the path-tracing
shader's compile does not finish. What is measurable without a context is
measured in a test: nine disposable resources per material, **zero** of them
freed by `material.dispose()`, all nine freed by ours, none shared between two
materials — and an assertion on upstream's source that fails the day they fix
it, which is the signal to delete the workaround.

266 tests.

## 2026-09-12 — The fixture catches up, and `overhang` gets a meaning

Brief 42, the last of the audit's live bugs. Villa was written before two
decisions and never brought forward: its five textured materials declared
neither a dominant colour nor a texture scale, so a machine with nothing
downloaded rendered walls, roof, ground and road the same grey — in the scene
whose job is to exercise the whole schema.

The forest grew through all six neighbours. The fix is less about the exclusion
list than about there being **one** list: `NEIGHBOURS` is now read by both
`context.masses` and the scatter's `exclude`, since two hand-copied copies of
six rectangles is how they drifted apart. 284 trees → 260.

The old test asserted the instance count, which could never have caught this —
284 trees with two standing in a neighbour's living room is still 284. That is
the audit's recurring theme in one line, and there is now a test for the
property instead: no instance inside any mass's footprint.

**`overhang` was used three ways in three scenes**, which means it meant
nothing. Settled as *descriptive*: the least the declared footprint oversails
the walls on any side, which is the only reading consistent with `buildRoof`
building straight from the footprint. Making it generative was considered and
rejected for a real reason — one scalar cannot describe a mid-terrace, flush at
the party walls and eaved front and back, so generating from it would make the
schema unable to draw buildings it currently can.

That also exposed `roof-covers-walls` passing `overhang` to `boundsContain` as a
tolerance, loosening containment in the **wrong direction** — it permits a roof
smaller than its walls. Left for brief 27, recorded in the decision.

267 tests.

## 2026-09-12 — Greenhollow's house gets a plan

Brief 46, asked for directly: research what American and European domestic
architecture actually does, and give the house a big living room with a
fireplace, a kitchen, a bathroom and three bedrooms.

It had been four external walls around an empty box. Windows, two doors, no
rooms — every interior view was of a shed.

The two traditions converge, which is the useful finding. The **Banat village
house** organises everything around the *tindă*, an entry hall that reaches
every room and the attic, with a *prispă* down the long flank and the **gable
end to the street**. The **American Foursquare** puts four rooms around a
central core. Different century, different continent, same move: on a squarish
plan the central hall is the shortest circulation that still gives every room
two external walls. Both also put the hearth *inside* — a flue in the envelope
keeps its mass in the house, drafts better for staying warm, and comes out near
the ridge.

**The footprint had to grow, and that is the honest part.** 98 m² cannot hold
that programme: the arithmetic runs out at two bedrooms, and every layout that
fits three leaves a 25 m² living room, which is not "big". So the house went
11 × 10 → 11 × 12, southward — the porch holds the west, the garage the east,
the garden the north. 118.6 m², and the schedule closes to 118.7.

Fenestration follows the plan rather than the elevation: the front door is not
centred on the gable, because the hall is not centred either, and the
living-room windows are spaced about the living room's centre. A front symmetric
about a room it does not contain is the classic tell of a plan drawn
elevation-first.

**One old contradiction surfaced.** `roof-house` declared `ridgeBearing: 90`
under a comment claiming the gables faced the road and the garden. Bearing 90
faces them at the porch and the alley — the drawing had been the opposite of its
own description since it was written. Turning it to `0` is what the comment
meant *and* what the type wants: an eave over the porch, because a gable there
sheds its water down the veranda's open edge. That is the third time this week a
comment and the thing it described disagreed, after the `overhang` field and the
colonnade's missing leg.

No beds, no stove and no fireplace exist in Poly Haven, so the bedrooms and the
firebox are left unfurnished instead of proxied — the pond's absent fountain
decided that precedent. The hearth end gets two chairs and a table facing the
breast, because a masonry mass with nothing addressing it reads as a pier.

270 tests. The chimney test is the one that matters: there is no chimney
primitive, so its height is a literal that has to agree with a roof height
nothing computes for it.

## 2026-09-12 — Closing the audit: the last eleven briefs

`corpus/briefs/todo/` is empty. All 24 audit briefs (22–45) plus 46 are done.
Eleven closed in this stretch, in dependency order — 37 first because five
other briefs referenced its shape, then 45, 30, 43, 44, 27, 38, 24, 25, 35, 34.

**37 was the one that mattered most, and it found a ninth copy the audit
missed.** The dependency direction (`geometry → schema`, `physics → schema`,
nothing depends on `geometry`) is right and stays — but it left every
computation the generator and its checker both need with nowhere to live, so
each was copied into its checker. A checker holding its own copy of the
generator's constant is not checking the generator; it is checking itself.
`packages/schema/src/derive/` is the home, under two rules that keep it from
becoming a junk drawer: no `three` import, two callers in different packages.

Two of the nine had already diverged. The row-field estimate divided net area
by cell area while the generator walked a lattice over the bounds — 133 against
130 for a 40 m square. `run-is-well-formed` compared against a literal
`2 * 0.08` rather than the post the generator draws. The ninth, unlisted:
`apps/web/src/lib/entities.ts` held its own `wallLength` and `wallBearing` and
the Inspector imported *those*, so the panel and the viewport could describe one
wall two ways.

**The guards are the point, not the moves.** They live in `apps/web/test/` —
the only workspace that can import both `geometry` and `physics`, and therefore
the only place a test could ever have seen both copies. That no shared observer
existed is the entire mechanism by which these drifted, and it is why the audit
found them by reading rather than by a red build.

**45 needed a real primitive, not a patch.** Exclusions were subtracted whole:
a hole half outside its field removed the half that was never there, and two
overlapping holes removed their overlap twice. `polygonNetArea` is exact rather
than sampled — slab the plane at every vertex *and every edge crossing*, and
inside a slab the covered length is linear, so its midpoint value times the
width is the integral. Sutherland–Hodgman was the cheap candidate and was
rejected for requiring a convex clip polygon; an L-shaped field is in the tests
for exactly that reason. Seven hand-computed cases, all exact.

The other half of 45: `seed` defaulted to 0 and nothing else reached the RNG, so
two fields over one polygon that both omitted it placed every instance at
identical coordinates. `runs.ts` has hashed a run's id into its seed since it
was written, precisely so two pergolas could not collide; the scatter tier had
skipped it. Every instance in every scene has moved. Only the orchard's *count*
changed, 16 → 15, and it changed to what the generator was always placing.

**30 found a fourth unbounded input the brief did not list, and it was the one
that mattered.** Bounding `density` and bounding coordinates does not bound the
row lattice, because the lattice is built from their *ratio*: 1 000 m of field
at the minimum 0.1 m spacing is 10⁸ cells with every individual number in the
document looking entirely reasonable. `±100 km` is not a plausibility judgement
either — it is the float64 one: `1e15 + 0.001 === 1e15`, so a lattice stepping
by less than an ULP of its own start point never advances and never terminates.

**43 is the clearest case of the audit's central theme.** The baker renders a
square cell of `max(sx, sy, sz)`; the consumer built its quad from the
subject's own aspect, and those agree only when the subject is as wide as it is
tall. Every tree was 5.8 % too narrow, and a `[6, 2, 6]` shrub would have drawn
two thirds of a metre hovering 0.67 m up. **A bounding-box assertion cannot
catch it** — the old geometry's box was also 2 m tall — so the test reads the
**UVs** beside the positions. `v ∈ [⅓, ⅔]` is the assertion no position-only
check could have made.

**44 could not be fixed by handing the dome the truth alone.** Below the horizon
three's `Sky` drives its whole result from `sunIntensity(dot(sun, up))`, which
is 0 there, so the dome would have gone black while the environment painted dim
blue — two disagreements instead of one. `skyGradient` came out of
`skyRadianceMap` so both sides read one function; the viewport cannot afford to
build a 256 × 128 map once a frame while someone scrubs.

**27's deliverable is the `FIRES` map, not the thirteen tests.** One document
per rule, walked by `it.each(RULES)`; removing a key fails with *"no firing
document for X — add one to FIRES"*, and a key for a deleted rule fails too, so
the list cannot stop describing itself in either direction. Verified by removing
one. This project has been burned by exactly this once: `asset-resolves` was
registered and never armed, and eight invented Poly Haven slugs shipped.

Turning `roof-covers-walls`' tolerance round — brief 42's handover — immediately
failed two of Greenhollow's roofs, and **neither was a real finding**: a
footprint authored as `rect(7 - 0.4, …)` is `14.399999999999999` and missed an
exact `>=` by 2 × 10⁻¹⁵ m. The rule allows a millimetre now, with a test for the
float-noise case so nobody tightens it back.

**38 was measured by mutation.** Swapping `AssetLoader`'s key formula to
`${slug}/${source}` — the brief's own example — now turns three tests red.
Before, it turned none. 24 and 43 were checked the same way: revert the fix,
confirm the test goes red, put the fix back.

**25 halved the download twice over.** First paint went **4 264 KB → 1 247 KB**
raw and **1 474 KB → 349 KB** gzipped. Rapier needed a second entry point, not
just a dynamic import: the package index re-exports `world.js`, which imports
Rapier at module scope, and Rapier's module has side effects — so reaching
`deriveColliders` through the root drags the engine in regardless.

**35's brief had a conditional that turned out to be load-bearing.** A tone
quiet enough to read as ornament cannot also be legible body text, so
`--color-subtle` became a text tone (3.20/3.06 → 4.99/4.76 dark, 2.73/2.99 →
4.71/5.15 light) and `--color-faint` kept the old values for the one non-text
use. Guarded by a test that parses `styles.css` and computes the ratios, rather
than by the comment recording them.

**34's fix is a shell helper, so the test is shell.** It lifts the real
`fetch_one` out of the *generated* `download.sh` and runs it against `file://`
URLs, so it exercises the shipped text rather than a copy. Two of its eight
tests read the generated artefacts, because a single direct `curl -o "$target"`
slipping back in would restore the bug quietly for one asset.

ambientCG's sizes were in the API all along — `size` on every zip entry — and
`resolveAmbientCg` hardcoded `bytes: 0`. `totalBytes` was therefore 0, always
`<= HEAVY_BYTES`, so **the heavy-asset split was not running for one entire
source**. And `DOWNLOADS.md` printed "—" for those rows, which reads as *small*
rather than as *unknown* — which is exactly how it went unnoticed.

**255 → 389 tests.** The second theme of the week, now at four instances: a
comment disagreeing with the thing it describes — `overhang` meaning three
things in three scenes, the colonnade's missing south leg, `roof-house`'s
`ridgeBearing: 90`, and the physics cache's claim that keying on the revision
"makes both impossible". Each survived because a confident comment invites
checking against your memory of the design rather than against the code.

One finding captured rather than fixed: a drop reports *"settled on nothing"*
when it settled on a slab (`corpus/todos/drop-reports-settled-on-nothing.md`).

## 2026-09-13 — The yard, the rooms, and a drawing

Three briefs from one request: pave the ground people walk on, give the plan
rooms, and produce a real floor plan. Plus a verification pass over yesterday's
eleven, which found two acceptance criteria that were not actually met.

**The verification pass is the part worth repeating.** Reading the outcome
notes would have said everything was done. Checking the *code* against the
*criteria* found that brief 45's "the same number for every arrangement" held
only for rectangles — an L-shaped row field quoted 130 against 100 placed — and
that brief 27's "a duplicate run id is an error" had been tested with a run
colliding with a *wall*, which passes on the old rule too. Both are now closed,
and 45's fix moved the row placement into `schema/derive` so the estimate walks
the lattice the generator walks rather than approximating it.

**47 — the gate became two gates.** The layout problem was not the paving, it
was that one 4 m opening made the car and the person share an entrance, so
either the drive swung around the vine walk or the walk crossed the drive. The
Banat answer is the *poartă mare* and the *portiță*: a carriage gate and a
pedestrian wicket. The wicket lands on the house's own axis at x = 1.2, which
was already the front door's centreline and the vine's; the carriage gate sits
east at x = 6.0, on the line a drive needs to reach the garage. Neither route
crosses the other at any point between the road and its destination.

Brick where people go, gravel where cars go — and the material argument is not
taste. Banat yards are paved *"with brick and stone, for letting the earth
breathe, and not by cement, which brings dampness to the houses"*: a
permeable-paving argument made long before the phrase existed, and a real
constraint for a house with no damp course. Herringbone because courses at 45°
to travel spread a wheel load instead of letting one paver rock.

The facing guard caught an inversion in `buildPaving` before it was ever looked
at — the first time that file has caught a bug in *new* work.

**48 — rooms found a door that had been walled up since brief 46.** The chimney
stood from x −0.4 to 1.0 on the `DAY` line; `d-living`, the only door into the
living room, spans −0.3 to 0.9 on that same line. A 1.4 m masonry mass was built
across **100 % of the 1.2 m door**. Nothing had caught it because nothing in the
document knew there was a room on either side of that wall — which is exactly
what `Room` is for, and it surfaced while working out the living room's polygon.

The computed schedule also put brief 46's hand-worked "118.6 m²" at 119.7, and
showed a single **12.2 m² "bathroom"** — twice what a bathroom is, in a house
with nowhere to keep food. It is a 7.3 m² bathroom and a 4.4 m² larder now,
split north–south so both keep the east wall and neither loses its window.

Brief 27's arming guard fired on `rooms-are-habitable` the day after it was
built, on a rule it had never seen. That is the difference between a mechanism
that works and one that works in principle.

**49 — a drawing, and it had to be a section.** A camera pointed down gives a
roof; hiding the roof gives wall tops. `packages/drawing` cuts at 1.2 m and
renders SVG with no `three`, no DOM and no GPU — and the payoff is that every
convention can be asserted. At 2.5 m nothing is cut, the doors become dashed
thresholds, and the swing count drops to zero: that test *is* the difference
between a section and a top view.

Two graphic faults that only looking could have found. The ISO weight hierarchy
inverted itself, because at 1:100 a 120 mm partition is 1.2 mm on paper and a
0.7 mm stroke each side leaves no fill — partitions solid black, external walls
grey. And choosing which building to draw by wall connectivity **silently lost
six of ten doors**, because a partition shares a corner with nothing; it is
picked by enclosed area now, then every wall inside it adopted.

**400 → 426 tests.** Three new entities — `Paving`, `Room`, and a drawing
package — and two of them found real bugs in the existing plan within minutes
of existing. That is the argument for making implicit things explicit: not that
the model is tidier, but that a thing with a name can be checked.

## 2026-09-13 — A box does not rest on its middle

The one open todo, closed. `dropToRest` reported *"settled on nothing"* for a
placement that had plainly come to rest, and the cause was one line of intent:
`surfaceBelow` cast a **single ray from the box's centre**. It could only find
what was under the middle, so anything supporting a corner was invisible.

It probes the footprint now — centre plus four corners, inset 20 mm so an edge
ray does not skim past. All five share one origin height, which makes the
smallest time-of-impact the highest surface, which is the thing the box is
resting on.

**Why this was a real bug and not a theoretical one** is worth keeping: a
placement collider carries a `rotationY`, and a rotated box occupies more
ground than its own sides. Greenhollow's armchairs are 0.78 × 0.83 turned 152°,
so their footprint is about **1.08 m** — 38 % wider. Sitting them 1.05 m from
the coffee table looked like clearance and was not.

Which is how the fix earned its keep twice. With the probe working,
`table-hearth` came back as *"settled on chair-hearth-e"* — true, and a layout
fault introduced by brief 48's chimney move. The chairs are 1.45 m apart now.

The diagnosis was worth the detour: the numbers said nothing was under the
table (three colliders, tops at 0.00, 0.45 and one muted), and the trace said
it stopped dead at y = 1.051 with velocity 0. Those two facts could not both be
true of an axis-aligned world, which is what pointed at the rotation.

430 tests.

## 2026-09-13 — Audit: performance, practices, structure

An `improve` survey across five lenses. **18 raw findings, 10 vetted** —
briefs 50–59. The drop rate is the interesting number: this codebase is in good
shape, and most of what was dropped was dropped because it was *already
deliberate*.

**Dropped, and worth recording so nobody re-finds them:** dependency hygiene is
clean (no version drift between workspaces, every pin exact, `npm audit` 0
vulnerabilities); `tsconfig.base.json` is already stricter than most repos carry
(`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
`verbatimModuleSyntax` all on); the build is 3.2 s cold and 0.2 s warm, 430
tests in 1.6 s; `SandboxEngine`'s 676 lines are the cost of a locked decision
and the debt finder declined to report them for want of a concrete failure;
`corpus/lint.sh` correctly propagates failure; `SceneTree`'s per-row
subscription is right.

**The two that matter most were both invisible from the outside.**

`Field` — the numeric input behind *every* editable property — has a prop named
`onCommit` wired to React's `onChange`. It fires on every character. Each
character runs `structuredClone` of the whole document, a full Zod re-parse, a
full re-lint, and a **full scene regeneration**. Measured on Greenhollow: parse
1.1 ms, lint 1.6 ms, generate **98 ms**. Typing a four-digit value is ~0.4 s of
blocked main thread, and the intermediate values are committed as real
documents — typing `150` briefly commits a wall of length 1.

And dragging a placement does nothing at all. The gizmo attaches to anything
selected — `findMesh` matches `endsWith(":" + id)` and placements are named
`placement:<id>` — but `onTranslate` searches only `level.walls`, and
`translatePlacement` does not exist anywhere in the repo. `editDocument` bumps
the revision regardless, so the scene rebuilds from the unchanged document and
the furniture snaps back. The app spends 98 ms precisely undoing the user's
drag.

**The measurement that surprised me** was where scene-generation time actually
goes. Not the CSG, which is the expensive-looking part: all 23 walls with 25
opening cuts come to 25 ms. `pergola-vine` alone is **39 ms** — 40 % of the
whole build, one entity, more than every wall in every building combined.
Removing just its climber takes it to 0.6 ms. `canopy()` allocates two
`PlaneGeometry` per leaf cluster, merges them, translates, and disposes them —
4 260 allocations for 2 130 clusters.

A prototype settled the fix rather than guessing at it: one shared crossed-quad
geometry plus an `InstancedMesh` of 2 130 matrices is **0.5 ms against 49 ms**,
a 98× reduction, for the same 8 520 triangles and the same single draw call.
Strictly better, and it is the pattern `buildScatterMesh` already uses.

**The practices gap is narrow but sharp.** No linter, no formatter, no CI, and
no React testing setup at all — so all eight `.tsx` files have zero tests,
including everything briefs 35 and 36 built for keyboard and screen-reader
access. Brief 24's outcome already said it out loud: *"verified by reading;
there is no React renderer in this project's test setup."* That sentence was
the finding.

Ranked Now → Next rather than by severity: 50, 51, 52 are live and cheap;
53–57 are gates that do not exist; 58 is small waste; 59 — regenerating the
whole scene for a one-entity edit — is the structural one, and is deliberately
last because 51 and 52 remove most of its pain without touching the design.
