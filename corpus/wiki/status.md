---
summary: Dated snapshot of what is built, what is in flight, and what is next — the living dashboard.
updated: 2026-09-11
---

# Status

_Snapshot: 2026-09-11_

## Where things stand

**It runs.** `apps/web` renders the reference scene in WebGL2 — orbit, select,
edit, relight — in the Darkroom direction, dark and light. Three packages behind
it: `@solstice/schema` (document, validation, linter), `@solstice/geometry`
(document → three.js meshes) and `@solstice/solar` (site + clock → sun position,
sky, lighting). All headlessly testable; **93 tests pass**.

The browser reports the same 11,217 triangles / 284 instances the headless
generator does, which is the cheapest check that tests and app agree.

`apps/api` persists scenes: seven routes, files as truth, a `node:sqlite` index
that is rebuilt by rescanning. `Save` writes through it. **121 tests pass.**

**Render works.** `three-gpu-pathtracer` accumulates samples behind an explicit
Render action, lit by a sky radiance map computed from the sun; the result
downloads.

**The reference scene is a place.** `greenhollow` — a smallholding with a
porch, a vine pergola from the gate to the front door, a garage, hedges, a
walled front with a gate, a kitchen garden, greenhouse, pond and an orchard in
rows — replaced the box-in-a-field as the scene the app loads. Authoring it is
what turned up `Run`, row-planted scatter, per-planting heights and materials,
and the fact that `roof-covers-walls` assumed one building per level.
`villa-carpathia` stays as the regression fixture.

**Physics works** as an authoring aid: colliders derived from the semantic
document with openings cut out of walls, drop-to-rest that snaps to the surface,
and a collider overlay. **184 tests pass.**

**It has now run on a real GPU** — 3.2 samples/sec at 511×759 (538 samples in
168 s), against 0.22 samples in 74 s on SwiftShader, roughly a thousandfold. The
GPU is reachable from WSL2, but only through X11: see
[running-on-a-gpu.md](running-on-a-gpu.md) for why headless falls back to
software and what flags avoid it.

**It has a home.** A `solstice` stack now exists in the `vps-deploy` estate
(static, `/solstice`, dry-run clean but never executed) and a kit on the
`showcase` shelf. The **client deploys and the API does not** — it is an
unauthenticated writer over the scene files, and authoring is a repo-time
activity by design. `SOLSTICE_API_BASE` empty is what makes `Save` download
rather than post into a 404. See [log.md](../log.md).


**Placements are real.** A dev-only Vite middleware serves `assets-src/`, the
generator loads glTF through an injectable `AssetSource` (so it still runs
headlessly with nothing downloaded), and placements collide with each other —
drop a bowl over a table and it rests on the table. **207 tests pass.**

**Time runs.** Solar time is a scalar you can keyframe, and a track over it is a
sun-path study — the distinction the glossary drew from the start, now real.

**Surfaces are real.** Materials load PBR maps from Poly Haven and ambientCG,
projected in world metres (`Material.textureScale`) so a texture tiles the same
on a 6 m wall as on a 0.9 m pier. The pergola's vine is 1,816 tilted leaf
clusters rather than a slab, so light comes through it in patches.

**Context vegetation is real.** `tree_small_02` bakes to a 3.9 MB angle atlas and
scatters as crossed alpha-tested quads — 2,062,487 triangles per tree down to
four, path-traced with correct alpha shadows. Crossed quads rather than
camera-facing billboards because a path tracer has no "the camera" to face.
`pine_tree_01` and `fir_tree_01` are unbaked, so villa's forest is one species.

## Next

**Briefs 01–18 are done**, bar the deferred half of 18. The 2026-09-11 audit
against the original brief produced five more; all are closed:

- **[14 — animation time](../briefs/done/14-animation-time.md) — done.** A
  sun-path study plays over `greenhollow`; `packages/animation` evaluates tracks
  headlessly and anime.js drives the clock. Playback drives the **engine**, never
  the document — an edit per frame would regenerate the scene per frame.
- **[15 — finish a render](../briefs/done/15-finish-a-render.md) — done.** The
  first render that ever completed came out **fully black**: no
  `preserveDrawingBuffer`, so `toBlob` read a cleared buffer a frame too late.
  Captured in-tick now.
- **[16 — denoise](../briefs/done/16-denoiser.md) — done, and the answer was
  *no*.** Measured, `DenoiseMaterial` moves the image away from converged: this
  scene is nearly all high-frequency material and an edge-aware blur has little
  it can safely touch. Ships off by default.
- **[17 — repo honesty pass](../briefs/done/17-repo-honesty-pass.md) — done.**
  `xatlas-web` removed, a README written, the overview and architecture pages
  corrected, and `apps/web` tested where it holds logic.
- **[18 — finish the vegetation](../briefs/done/18-vegetation-finishing.md) —
  half done.** The vine's clusters are crossed quads now and read from below;
  the two tree bakes are deferred for machine time, not for any unknown.

**The format generalises, and three bugs were hiding behind that.**
[Elmsgate](../briefs/done/21-a-town-house.md) is a two-storey mid-terrace on a
6.5 m lot — party walls, a railed forecourt, a walled yard. It needed no new
entity type, and `Subject.levels` holding two things worked first time, which is
the question it was built to answer. What it found was older code:

- **Every gable roof with a ridge along X had its slopes wound inside out** —
  normals pointing into the building. Greenhollow's house and garage both
  declare `ridgeBearing: 90` and have been wrong in every render of the
  reference scene. Fixed in `subject/roofs.ts` and `context/masses.ts`, pinned
  by a test over all four bearings.
- **`Run` built every fence as two rows of posts**, which is right for a pergola
  and wrong for a railing. The linter had been warning about the symptom.
- **`BuildingMass` could not declare a ridge bearing**, so a row of terraced
  neighbours could never line up with the house they abut.

A scene picker in the toolbar switches between all three scenes, which is also
the first time `villa-carpathia` has been openable. **255 tests pass.**

**The deploy is not this repo's work.** It lives in the `vps-deploy` estate and
is operated there by hand — `node cli.ts solstice pre-deploy` then `deploy`, with
one sudo line on the box for the Caddyfile, which is estate-wide and rewrites
routes for all 18 stacks. Nothing in `apps/` or `packages/` is waiting on it.

**The format generalises, and three bugs were hiding behind that.**
[Elmsgate](../briefs/done/21-a-town-house.md) is a two-storey mid-terrace on a
6.5 m lot — party walls, a railed forecourt, a walled yard. It needed no new
entity type, and `Subject.levels` holding two things worked first time, which is
the question it was built to answer. What it found was older code:

- **Every gable roof with a ridge along X had its slopes wound inside out** —
  normals pointing into the building. Greenhollow's house and garage both
  declare `ridgeBearing: 90` and have been wrong in every render of the
  reference scene. Fixed in `subject/roofs.ts` and `context/masses.ts`, pinned
  by a test over all four bearings.
- **`Run` built every fence as two rows of posts**, which is right for a pergola
  and wrong for a railing. The linter had been warning about the symptom.
- **`BuildingMass` could not declare a ridge bearing**, so a row of terraced
  neighbours could never line up with the house they abut.

A scene picker in the toolbar switches between all three scenes, which is also
the first time `villa-carpathia` has been openable. **255 tests pass.**

**The deploy is written, dry-run clean, and still not executed** — and now for a
known reason rather than an untested one. `/var/www` on the box is root-owned
and `/etc/caddy/Caddyfile` needs sudo with a password, so the two steps a human
has to run are:

```
node cli.ts solstice pre-deploy    # then the sudo line it prints, on the box
node cli.ts solstice deploy
```

The generated Caddyfile is **estate-wide**: installing it rewrites the routes
for all 18 stacks, which is a larger action than deploying Solstice and is the
right thing to keep in a person's hand. SSH to the box works
(`~/.ssh/hetzner_vps`); only the privileged half is blocked.

**A shot list renders unattended.** [19](../briefs/done/19-render-the-whole-shot-list.md)
queues every declared shot in document order and quotes the cost before it
starts — greenhollow's four is 2,400 samples, about 58 minutes. Running it found
that Chromium gates automatic downloads after the first one from a page,
non-deterministically and silently, so a four-shot queue reported four successes
and left one file. Renders are written through a directory the user picks on the
button's own click; `<a download>` remains the fallback for the single-render
case that always worked. **239 tests pass.**

Rendering an animation *track* as a frame sequence stays unbuilt on purpose: at
0.69 samples/s for a 1920 × 1080 / 600-sample shot, seconds of motion is hours
of GPU.

Schema migrations stay in [open-questions.md](open-questions.md), correctly
deferred until a field first changes meaning.

## Briefs

| # | Brief | State |
|---|---|---|
| 01 | [Scene document schema and linter](../briefs/done/01-schema-and-linter.md) | done |
| 02 | [Geometry generator](../briefs/done/02-geometry-generator.md) | done |
| 03 | [Solar time](../briefs/done/03-solar.md) | done |
| 04 | [Viewport and app shell](../briefs/done/04-viewport-shell.md) | done |
| 05 | [Fastify persistence API](../briefs/done/05-persistence-api.md) | done |
| 06 | [Path-traced render](../briefs/done/06-path-traced-render.md) | done |
| 07 | [Physics as an authoring aid](../briefs/done/07-physics-authoring.md) | done |
| 08 | [Shots render what they declare](../briefs/done/08-shots-render-what-they-declare.md) | done |
| 09 | [The homestead scene](../briefs/done/09-the-homestead-scene.md) | done |
| 10 | [Asset manifest and models](../briefs/done/10-asset-manifest-and-models.md) | done |
| 11 | [Textures and foliage](../briefs/done/11-textures-and-foliage.md) | done |
| 12 | [Render convergence](../briefs/done/12-render-convergence.md) | done |
| 13 | [Vegetation impostors](../briefs/done/13-vegetation-impostors.md) | done |
| 14 | [Animation time](../briefs/done/14-animation-time.md) | done |
| 15 | [Finish a render](../briefs/done/15-finish-a-render.md) | done |
| 16 | [Denoiser](../briefs/done/16-denoiser.md) | done |
| 17 | [Repo honesty pass](../briefs/done/17-repo-honesty-pass.md) | done |
| 18 | [Finish the vegetation](../briefs/done/18-vegetation-finishing.md) | done (tree bakes deferred) |
| 19 | [Render the whole shot list](../briefs/done/19-render-the-whole-shot-list.md) | done |
| 20 | [A scene picker](../briefs/done/20-scene-picker.md) | done |
| 21 | [Elmsgate, a two-storey town house](../briefs/done/21-a-town-house.md) | done |
