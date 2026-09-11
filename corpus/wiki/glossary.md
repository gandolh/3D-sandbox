---
summary: Canonical vocabulary — the terms Solstice uses in a specific way, and the synonyms they displace.
updated: 2026-09-11
---

# Glossary

**Scene document**:
The parametric JSON description of one site — the only source of truth for a
scene. Geometry is derived from it and never stored alongside it.
_Avoid_: scene file, model, project, save file

**Subject**:
The fidelity tier holding fully-detailed, parametric, editable geometry — the
house and its immediate site. Authored entity by entity.
_Avoid_: foreground, main model, hero geometry

**Context**:
The fidelity tier holding ambient surroundings — forest, neighbouring building
masses, street. Declared as scatter rules rather than individual entities, and
realised through instancing at reduced detail.
_Avoid_: background, environment, surroundings

**Solar time**:
A date, a clock time and a site latitude/longitude, resolving to a sun altitude
and azimuth. Drives the sun vector, the sky, and the matched HDRI.
_Avoid_: time of day, daylight, sun settings

**Animation time**:
The timeline playhead, in seconds, over which scene properties are keyframed —
including the solar scalar, which is how a sun-path study becomes one tween.
_Avoid_: timeline, playback, time

**Shot**:
A named, saved combination of camera pose, solar time, HDRI and render settings.
Stored in the scene document, so a render is reproducible without being stored.
_Avoid_: view, camera, bookmark, preset

**Linter**:
The semantic and referential validation pass that runs after Zod parsing. Zod
checks shape; the linter checks meaning.
_Avoid_: validator, checker

**Opening**:
A void cut into a wall — a door or a window. Positioned along its host wall by
offset, never by world coordinates.
_Avoid_: hole, window, door, aperture, void

**Run**:
A linear feature carried along a path — a hedge, a fence, a colonnade, or a
pergola. All four are one profile extruded or repeated along a polyline; they
differ only in what stands on it. Deliberately *not* a `Wall`: a wall is a
building element that lives inside a level and is judged against the roof above
it, and a hedge has neither.
_Avoid_: linear feature, border, fence (a fence is one kind of run), landscape wall

**Structure**:
A connected group of walls — walls that share an endpoint. What distinguishes
the house from the garage on the same level, without the document having to say
so. Roofs are judged against the structure they mostly sit over, which is why a
roof never names the walls it covers.
_Avoid_: building, mass (a `BuildingMass` is a context-tier thing entirely)

**Planting height**:
A scatter field's nominal instance height in metres, before `scaleRange`. A real
property of what is planted — a rose bed and an apple orchard differ by it — not
a rendering hint, and the thing that lets proxy geometry be the right size
before the asset manifest exists.
_Avoid_: proxy size, tree height

**Manifest**:
The generated index of assets actually present in `assets-src/`. Not
hand-maintained — scanning the files is what keeps it honest — and it is what
arms the `asset-resolves` lint rule. A scene may only name assets in it.
_Avoid_: asset list, asset registry, catalogue
