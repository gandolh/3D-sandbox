import { hexToRgb, type SunVector, skyRadianceMap } from "@solstice/solar";
import * as THREE from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { DenoiseMaterial, WebGLPathTracer } from "three-gpu-pathtracer";
import { GenerateMeshBVHWorker } from "three-mesh-bvh/worker";

export interface RenderSettings {
  width: number;
  height: number;
  samples: number;
  bounces?: number;
  /**
   * Run the denoise pass over the accumulation before it reaches the canvas.
   *
   * An edge-aware blur, not a trained denoiser, and it is judged on what it
   * destroys as much as on what it smooths — see the measurements in the wiki.
   */
  denoise?: boolean;
  /** What is being rendered, for the overlay. See `RenderProgress.label`. */
  label?: string;
  /**
   * Where this render sits in a queue of them, 1-based.
   *
   * Optional, and absent for a single render rather than defaulting to 1-of-1:
   * an overlay that says "shot 1 of 1" on every ordinary render is noise.
   */
  queue?: { index: number; total: number };
}

export interface RenderProgress {
  phase: "building" | "rendering" | "done" | "cancelled";
  /**
   * What this render is of — shot name, output size and the clock it is being
   * lit by. The clock is the load-bearing part: a shot's solar override is
   * otherwise invisible until the image comes out, and "it looks about right"
   * is not a way to tell whether 07:15 was applied.
   */
  label?: string;
  /** BVH build progress, 0–1. Only meaningful while `phase` is `building`. */
  build: number;
  samples: number;
  targetSamples: number;
  /** Position in a multi-shot queue, 1-based. Absent for a single render. */
  queue?: { index: number; total: number };
  elapsedMs: number;
}

/**
 * One path-traced render.
 *
 * Deliberately a session object rather than a mode on the engine: a render has a
 * beginning, a middle you can watch, and an end, and it owns a renderer resized
 * to the shot's declared output. Wiring that into the real-time loop as a flag
 * is how you end up unable to cancel it.
 */
export class PathTraceSession {
  private readonly tracer: WebGLPathTracer;
  private readonly bvhWorker: GenerateMeshBVHWorker;
  private readonly startedAt = performance.now();
  private cancelled = false;
  private building = true;
  private buildProgress = 0;
  private captured: Promise<Blob | null> | null = null;
  private denoise: DenoiseMaterial | null = null;
  private denoiseQuad: FullScreenQuad | null = null;

  private readonly renderer: THREE.WebGLRenderer;
  /**
   * A scene built for rendering, not the viewport's.
   *
   * The path tracer samples geometry, materials and lights it understands. The
   * viewport also holds a `Sky` shader mesh, a hemisphere light, a transform
   * gizmo and a selection box — none of which it can sample, and one of which
   * fails deep inside a colour lookup rather than politely skipping.
   */
  private readonly scene: THREE.Scene;
  /**
   * The camera to render from — purpose-built for this shot, never the
   * viewport's. A render must not move where the user left the viewport, and
   * the two have different aspect ratios by definition: the shot's is fixed
   * by its declared output size, the viewport's by the browser window.
   */
  private readonly camera: THREE.PerspectiveCamera;
  private readonly settings: RenderSettings;

  // Fields and assignments rather than parameter properties: those need code
  // generated for the assignment, which `erasableSyntaxOnly` forbids repo-wide
  // so that any file here can be run straight from source by Node.
  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    settings: RenderSettings,
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.settings = settings;
    this.tracer = new WebGLPathTracer(renderer);
    // `setSceneAsync` refuses to run without one, and the point of the async
    // path is that a large BVH build does not freeze the interface. The worker
    // is constructed with `new Worker(new URL(...), { type: 'module' })`
    // upstream, which Vite bundles natively — no worker plugin needed.
    if (settings.denoise === true) {
      // The tracer normally blits its accumulation target to the canvas with a
      // plain quad. Swapping that blit for the denoise pass puts the filter on
      // the *presented* image — which is also what `toBlob` reads, so the saved
      // PNG matches the screen instead of quietly being the noisy version.
      this.denoise = new DenoiseMaterial();
      this.denoiseQuad = new FullScreenQuad(this.denoise);
      const material = this.denoise;
      const quad = this.denoiseQuad;
      this.tracer.renderToCanvasCallback = (target, renderer) => {
        material.map = target.texture;
        const previous = renderer.autoClear;
        renderer.autoClear = false;
        quad.render(renderer);
        renderer.autoClear = previous;
      };
    }

    this.bvhWorker = new GenerateMeshBVHWorker();
    this.tracer.setBVHWorker(this.bvhWorker);
    this.tracer.renderScale = 1;
    this.tracer.bounces = settings.bounces ?? 5;
    this.tracer.minSamples = 1;
    this.tracer.dynamicLowRes = true;
    this.tracer.renderToCanvas = true;
  }

  /**
   * Build the BVH and start accumulating.
   *
   * The renderer is resized to the shot's declared output first: a Shot is the
   * reproducible unit, and a render that quietly used the window size instead
   * would not be reproducible at all.
   */
  async start(onProgress: (progress: RenderProgress) => void): Promise<void> {
    this.renderer.setSize(this.settings.width, this.settings.height, false);

    await this.tracer.setSceneAsync(this.scene, this.camera, {
      onProgress: (value) => {
        this.buildProgress = value;
        onProgress(this.report());
      },
    });

    this.building = false;
    onProgress(this.report());
  }

  /** One sample. Called from the engine's loop so there is only ever one. */
  step(): RenderProgress {
    if (!this.cancelled && !this.building && this.tracer.samples < this.settings.samples) {
      this.tracer.renderSample();
      // Grab the image the instant the last sample lands, in this same tick.
      //
      // The renderer is built without `preserveDrawingBuffer`, so the drawing
      // buffer is cleared before the next compositing step — and a `toBlob`
      // issued a frame later reads an empty buffer and yields a **fully black
      // PNG**. That is not hypothetical: it is what the first render this
      // project ever completed produced, 44 KB of RGB(0,0,0) at 1920 × 1080,
      // after fourteen minutes, while the screen showed the correct image.
      //
      // Capturing here costs nothing on the 60 fps viewport path, which
      // `preserveDrawingBuffer: true` would tax on every frame forever for a
      // read that happens once per render.
      if (this.tracer.samples >= this.settings.samples) this.capture();
    }
    return this.report();
  }

  /** Snapshot the canvas now. `toBlob` samples the buffer at call time. */
  private capture(): void {
    if (this.captured !== null) return;
    this.captured = new Promise((resolve) => {
      this.renderer.domElement.toBlob((blob) => resolve(blob), "image/png");
    });
  }

  get complete(): boolean {
    return this.cancelled || (!this.building && this.tracer.samples >= this.settings.samples);
  }

  cancel(): void {
    this.cancelled = true;
  }

  /**
   * The accumulated image, snapshotted when the last sample landed.
   *
   * Not captured here: by the time anything awaits this, the drawing buffer has
   * been composited and cleared, and what comes back is black.
   */
  async toBlob(): Promise<Blob | null> {
    if (this.captured === null) this.capture();
    return this.captured;
  }

  /**
   * Free everything this session allocated on the GPU.
   *
   * Note what is **not** here: the renderer's size. Restoring it belongs to
   * whoever owns the renderer, and a session that has been superseded no longer
   * does — its idea of "previous" is the live session's current size, so
   * putting it back would shrink the canvas mid-accumulation. `SandboxEngine`
   * decides; see `startRender`.
   */
  dispose(): void {
    this.denoiseQuad?.dispose();
    this.denoise?.dispose();
    this.tracer.dispose();
    try {
      this.disposeTracerInternals();
    } catch (error) {
      // Reaching into a library's privates must never be able to fail a
      // render's teardown. The cost of this going wrong is the leak we already
      // had; the cost of it throwing was the whole engine.
      console.warn("Could not free the path tracer's internals", error);
    }
    this.bvhWorker.dispose();
    this.scene.environment?.dispose();
  }

  /**
   * Free what `WebGLPathTracer.dispose()` leaves on the GPU.
   *
   * Upstream (`three-gpu-pathtracer/src/core/WebGLPathTracer.js:496`) disposes
   * `_quad`, `_quad.material` and `_pathTracer` — and that is all. Two things
   * survive it, both large:
   *
   * - **The path-tracing materials.** `PathTracingRenderer.dispose()` frees its
   *   render targets and quads but never `this.material`, whose uniforms hold
   *   the entire BVH as data textures, every triangle's attributes as a
   *   `DataArrayTexture`, and one 1024×1024 RGBA layer **per scene texture**.
   * - **`_lowResPathTracer`**, a whole second `PathTracingRenderer` — four
   *   float targets, a sobol target, two quads and a second material. Nothing
   *   upstream disposes it, and `dynamicLowRes` is on, so it is sized and used.
   *
   * Run a four-shot queue without this and each shot builds a fresh BVH and a
   * fresh texture array over the same scene while none of the previous ones are
   * freed. VRAM climbs monotonically and the later shots thrash.
   *
   * Written against internals on purpose, and defensively: every access is
   * optional, so an upstream rename degrades to the leak we already had rather
   * than throwing. Delete this whole method if upstream ever disposes its own.
   */
  private disposeTracerInternals(): void {
    interface InternalRenderer {
      dispose?: () => void;
      material?: THREE.ShaderMaterial;
    }
    const tracer = this.tracer as unknown as {
      _pathTracer?: InternalRenderer;
      _lowResPathTracer?: InternalRenderer;
    };

    for (const internal of [tracer._pathTracer, tracer._lowResPathTracer]) {
      if (internal?.material === undefined) continue;
      disposeUniformValues(internal.material);
      internal.material.dispose();
    }
    // `_pathTracer` is disposed upstream; this one is not.
    tracer._lowResPathTracer?.dispose?.();
  }

  private report(): RenderProgress {
    return {
      phase: this.cancelled
        ? "cancelled"
        : this.building
          ? "building"
          : this.tracer.samples >= this.settings.samples
            ? "done"
            : "rendering",
      build: this.buildProgress,
      samples: this.tracer.samples,
      targetSamples: this.settings.samples,
      ...(this.settings.label === undefined ? {} : { label: this.settings.label }),
      ...(this.settings.queue === undefined ? {} : { queue: this.settings.queue }),
      elapsedMs: performance.now() - this.startedAt,
    };
  }
}

/**
 * Free every GPU resource a material holds in its uniforms.
 *
 * `Material.dispose()` releases the compiled program and nothing a uniform
 * points at — which for a path-tracing material is nearly all of its cost: the
 * BVH as data textures, every triangle's attributes as a `DataArrayTexture`,
 * and one 1024×1024 RGBA layer per scene texture.
 *
 * The uniforms are **walked rather than named**. Every disposable one is a
 * fresh instance per material — no module singletons, checked — so this cannot
 * free something another render still depends on, and it keeps working when
 * upstream adds a uniform we have never heard of.
 *
 * Exported for the test, which is the only place the claim "upstream frees none
 * of these" can be checked without a GL context.
 */
export function disposeUniformValues(material: THREE.ShaderMaterial): number {
  let freed = 0;
  for (const uniform of Object.values(material.uniforms)) {
    const value: unknown = uniform.value;
    if (
      typeof value === "object" &&
      value !== null &&
      "dispose" in value &&
      typeof (value as { dispose: unknown }).dispose === "function"
    ) {
      (value as { dispose: () => void }).dispose();
      freed++;
    }
  }
  return freed;
}

/**
 * Image-based lighting from the sky, as an equirectangular `DataTexture`.
 *
 * The path tracer reads environment *pixels* — a PMREM render target has none,
 * and handing it one fails inside `EquirectHdrInfoUniform` with an error that
 * names nothing useful. `@solstice/solar` computes the radiance; this only wraps
 * it, so the maths stays testable without a GPU.
 */
export function buildSkyEnvironment(
  sunDirection: SunVector,
  sunColorHex: string,
  turbidity: number,
): THREE.DataTexture {
  const { width, height, data } = skyRadianceMap({
    sunDirection,
    sunColor: hexToRgb(sunColorHex),
    turbidity,
  });

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
