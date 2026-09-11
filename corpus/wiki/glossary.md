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
