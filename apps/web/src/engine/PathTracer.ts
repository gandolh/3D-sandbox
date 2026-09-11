import * as THREE from "three";
import { WebGLPathTracer } from "three-gpu-pathtracer";
import { GenerateMeshBVHWorker } from "three-mesh-bvh/worker";
import { hexToRgb, skyRadianceMap, type SunVector } from "@solstice/solar";

export interface RenderSettings {
  width: number;
  height: number;
  samples: number;
  bounces?: number;
  /** What is being rendered, for the overlay. See `RenderProgress.label`. */
  label?: string;
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
  private readonly previousSize = new THREE.Vector2();
  private readonly startedAt = performance.now();
  private cancelled = false;
  private building = true;
  private buildProgress = 0;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    /**
     * A scene built for rendering, not the viewport's.
     *
     * The path tracer samples geometry, materials and lights it understands. The
     * viewport also holds a `Sky` shader mesh, a hemisphere light, a transform
     * gizmo and a selection box — none of which it can sample, and one of which
     * fails deep inside a colour lookup rather than politely skipping.
     */
    private readonly scene: THREE.Scene,
    /**
     * The camera to render from — purpose-built for this shot, never the
     * viewport's. A render must not move where the user left the viewport, and
     * the two have different aspect ratios by definition: the shot's is fixed
     * by its declared output size, the viewport's by the browser window.
     */
    private readonly camera: THREE.PerspectiveCamera,
    private readonly settings: RenderSettings,
  ) {
    this.renderer.getSize(this.previousSize);

    this.tracer = new WebGLPathTracer(renderer);
    // `setSceneAsync` refuses to run without one, and the point of the async
    // path is that a large BVH build does not freeze the interface. The worker
    // is constructed with `new Worker(new URL(...), { type: 'module' })`
    // upstream, which Vite bundles natively — no worker plugin needed.
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
    }
    return this.report();
  }

  get complete(): boolean {
    return this.cancelled || (!this.building && this.tracer.samples >= this.settings.samples);
  }

  cancel(): void {
    this.cancelled = true;
  }

  /** The accumulated image. Read before `dispose`. */
  async toBlob(): Promise<Blob | null> {
    return new Promise((resolve) => {
      this.renderer.domElement.toBlob((blob) => resolve(blob), "image/png");
    });
  }

  /** Restore the renderer to what the viewport had. */
  dispose(): void {
    this.tracer.dispose();
    this.bvhWorker.dispose();
    this.scene.environment?.dispose();
    this.renderer.setSize(this.previousSize.x, this.previousSize.y, false);
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
      elapsedMs: performance.now() - this.startedAt,
    };
  }
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
