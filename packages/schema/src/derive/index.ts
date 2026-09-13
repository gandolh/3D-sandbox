/**
 * Derived facts about a document.
 *
 * The rule that defines this folder: **a function belongs here when the code
 * that generates something and the code that checks it both need it.** The
 * dependency direction is `geometry → schema` and `physics → schema` with
 * nothing depending on `geometry`, which is right — but it left every such
 * computation with no shared home, so each one was copied into its checker, and
 * a checker holding its own copy of the generator's constant is not checking the
 * generator. It is checking itself.
 *
 * Two constraints keep this from becoming a junk drawer:
 *
 * 1. **No `three`.** Anything that returns a `BufferGeometry`, a `Vector3` or a
 *    material is geometry's job, not this one. These functions take document
 *    entities and return numbers.
 * 2. **Two callers, in different packages.** One caller is not a shared
 *    primitive; it is a function, and it should live beside its caller.
 */
export * from "./constants.js";
export * from "./counts.js";
export * from "./materials.js";
export * from "./random.js";
export * from "./scatter.js";
export * from "./walls.js";
