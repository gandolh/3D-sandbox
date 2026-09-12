import { describe, expect, it, vi } from "vitest";
import type * as THREE from "three";
import * as pathtracer from "three-gpu-pathtracer";
import { WebGLPathTracer } from "three-gpu-pathtracer";
import { disposeUniformValues } from "../src/engine/PathTracer.js";

/**
 * What the path tracer leaves on the GPU, measured rather than read.
 *
 * The claim these tests pin is narrow and load-bearing: **`WebGLPathTracer
 * .dispose()` frees a small fraction of what a session allocates**, so a
 * four-shot queue builds four BVHs and four texture arrays over the same scene
 * and frees none of the first three. VRAM climbs until the later shots thrash
 * or the tab loses its context.
 *
 * No GL context is needed for any of this: a `PhysicalPathTracingMaterial`'s
 * uniforms are constructed CPU-side, and the dispose calls are what is being
 * counted, not their effect on the GPU.
 */

/**
 * The package's `index.d.ts` is hand-written and does not declare this class,
 * though `src/index.js` exports it and the engine's tracer instantiates two of
 * them. Reached through the namespace rather than by name for that reason.
 */
const PhysicalPathTracingMaterial = (
  pathtracer as unknown as { PhysicalPathTracingMaterial: new () => THREE.ShaderMaterial }
).PhysicalPathTracingMaterial;

type Disposable = { dispose: () => void };

const disposableUniforms = (material: THREE.ShaderMaterial): Disposable[] =>
  Object.values(material.uniforms)
    .map((uniform) => uniform.value as unknown)
    .filter(
      (value): value is Disposable =>
        typeof value === "object" &&
        value !== null &&
        "dispose" in value &&
        typeof (value as { dispose: unknown }).dispose === "function",
    );

describe("the path tracer's teardown", () => {
  it("holds GPU resources in uniforms that Material.dispose() does not free", () => {
    const material = new PhysicalPathTracingMaterial();
    const disposables = disposableUniforms(material);

    // Nine, at the pinned version: the BVH, the attribute array, the material
    // index attribute, the materials texture, the scene texture array, the IES
    // profiles, the environment map info, and two sampling textures.
    expect(disposables.length).toBe(9);

    const spies = disposables.map((value) => vi.spyOn(value, "dispose"));
    material.dispose();
    // The measurement that justifies the workaround: upstream's own dispose
    // frees the compiled program and *none* of these.
    expect(spies.filter((spy) => spy.mock.calls.length > 0)).toHaveLength(0);

    expect(disposeUniformValues(material)).toBe(9);
    expect(spies.every((spy) => spy.mock.calls.length === 1)).toBe(true);
  });

  it("still needs us to dispose the low-res tracer", () => {
    // A whole second `PathTracingRenderer` — four float targets, a sobol
    // target, two quads and a second material — created in the constructor,
    // sized and used because `dynamicLowRes` is on, and never disposed.
    //
    // Reading the source is the only way to assert this without a GL context.
    // **When this test fails, upstream has fixed it**: delete
    // `disposeTracerInternals`, not the assertion.
    const source = WebGLPathTracer.prototype.dispose.toString();
    expect(source).toContain("_pathTracer");
    expect(source).not.toContain("_lowResPathTracer");
  });

  it("frees nothing that is shared between materials", () => {
    // The walk is safe only because each material owns its uniform values. If
    // upstream ever hoists one to a module singleton, disposing it here would
    // break the *next* render rather than this one — the worst kind of bug to
    // find later.
    const a = new PhysicalPathTracingMaterial();
    const b = new PhysicalPathTracingMaterial();
    for (const key of Object.keys(a.uniforms)) {
      const valueA = a.uniforms[key]?.value as unknown;
      if (
        typeof valueA !== "object" ||
        valueA === null ||
        typeof (valueA as { dispose?: unknown }).dispose !== "function"
      ) {
        continue;
      }
      expect([key, valueA === (b.uniforms[key]?.value as unknown)]).toEqual([key, false]);
    }
  });
});
