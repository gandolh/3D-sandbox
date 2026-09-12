import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { Sky } from "three/addons/objects/Sky.js";
import type { SceneDocument, Shot } from "@solstice/schema";
import {
  generateScene,
  type AssetSource,
  type GeneratedScene,
  type MaterialSource,
} from "@solstice/geometry";
import type { CuboidCollider } from "@solstice/physics";
import { resolveSolar, skyGradient } from "@solstice/solar";
import { minutesToClock } from "@solstice/animation";
// Type-only, so `three-gpu-pathtracer` is not in the first paint.
//
// Everything this module needs from `PathTracer.js` is used solely inside
// `startRender`, and a visitor who only orbits the viewport never reaches it.
// The chunk is still statically built and served from the same directory — this
// changes *when* it loads, not where it comes from, so the static-deploy
// decision is untouched.
import type {
  PathTraceSession,
  RenderProgress,
  RenderSettings,
} from "./PathTracer.js";

type Tracer = typeof import("./PathTracer.js");
import { frameShot, shotCamera } from "./shot.js";

/**
 * The loaded asset library, and how to read it for one document.
 *
 * Two lifetimes deliberately kept apart. The library — geometries, impostor
 * atlases, texture maps keyed by the library's own `<source>/<slug>` names — is
 * downloaded once per session and shared by every scene. The `MaterialSource`
 * is keyed by *the document's* material ids, so it is a view, valid only for
 * the document it was built from.
 */
export interface AssetLibrary {
  assets: AssetSource;
  materialsFor(doc: SceneDocument): MaterialSource;
}

/**
 * What to render. Without a `shot` the request frames whatever the viewport is
 * currently looking at; with one, the shot's camera and solar override win.
 */
export interface RenderRequest extends RenderSettings {
  shot?: Shot;
}

export interface EngineEvents {
  onSelect: (id: string | null) => void;
  /** Fired when the gizmo finishes a drag, in world-space metres. */
  onTranslate: (id: string, dx: number, dz: number) => void;
  onStats: (stats: { triangles: number; instances: number }) => void;
  onRenderProgress: (progress: RenderProgress | null) => void;
  /** The renderer chunk is being fetched — the first Render of a session. */
  onRenderLoading?: () => void;
}

/**
 * Owns the renderer, scene, camera and loop.
 *
 * React never drives this. The scene graph is derived output — a generator
 * compiles the document into meshes — so there is nothing for a reconciler to
 * reconcile, and a render loop that React does not own is one React cannot stall.
 */
export class SandboxEngine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;

  private readonly orbit: OrbitControls;
  private readonly gizmo: TransformControls;
  private readonly sun = new THREE.DirectionalLight(0xffffff, 1);
  private readonly ambient = new THREE.HemisphereLight(0xbfd4ff, 0x6b6252, 0.4);
  private readonly sky = new Sky();
  /** Reused so a background change never allocates during playback. */
  private readonly nightSky = new THREE.Color();
  private readonly selectionBox = new THREE.BoxHelper(new THREE.Object3D(), 0xe8a33d);

  private generated: GeneratedScene | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private frame = 0;
  private disposed = false;
  private selectedId: string | null = null;
  private dragStart: THREE.Vector3 | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private render: PathTraceSession | null = null;
  private lastSolar: ReturnType<typeof resolveSolar> | null = null;
  /** Kept so a shot's solar override can be re-resolved against the site. */
  private lastDocument: SceneDocument | null = null;
  /** The loaded library, once. Until it arrives the generator uses proxies. */
  private library: AssetLibrary | null = null;
  private readonly colliderOverlay = new THREE.Group();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly events: EngineEvents,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
    this.camera.position.set(-16, 9, -15);

    this.orbit = new OrbitControls(this.camera, canvas);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.maxPolarAngle = Math.PI / 2 - 0.02;
    this.orbit.target.set(0, 2, 0);

    this.gizmo = new TransformControls(this.camera, canvas);
    this.gizmo.setMode("translate");
    this.gizmo.showY = false; // walls live on their level; vertical drag is meaningless
    this.gizmo.addEventListener("dragging-changed", (event) => {
      const dragging = (event as unknown as { value: boolean }).value;
      this.orbit.enabled = !dragging;
      if (dragging) {
        this.dragStart = this.gizmo.object?.position.clone() ?? null;
      } else {
        this.commitDrag();
      }
    });

    const helper = this.gizmo.getHelper();
    helper.visible = false;
    this.scene.add(helper);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const shadow = this.sun.shadow.camera;
    shadow.left = -40;
    shadow.right = 40;
    shadow.top = 40;
    shadow.bottom = -40;
    shadow.far = 200;

    this.sky.scale.setScalar(4500);
    this.selectionBox.visible = false;
    this.colliderOverlay.visible = false;
    this.colliderOverlay.name = "collider-overlay";
    this.scene.add(this.sky, this.sun, this.sun.target, this.ambient, this.selectionBox, this.colliderOverlay);

    canvas.addEventListener("pointerdown", this.onPointerDown);
    this.observeResize();
    this.loop();
  }

  /* ── scene graph ────────────────────────────────────────────── */

  setDocument(doc: SceneDocument, options: { includeContext: boolean }): void {
    this.generated?.dispose();
    this.generated?.root.removeFromParent();

    this.lastDocument = doc;
    // `materialsFor` is resolved here, per document, and never cached: material
    // ids belong to the document, not to the library, so a map built for one
    // scene resolves almost nothing in the next. Held once, it bound the
    // library to whichever scene happened to be open when the download
    // finished, and every scene after that rendered untextured.
    const library = this.library;
    this.generated = generateScene(doc, {
      includeContext: options.includeContext,
      ...(library === null ? {} : { assets: library.assets, materials: library.materialsFor(doc) }),
    });
    this.scene.add(this.generated.root);
    this.setSolar(doc);
    this.reattachSelection();

    this.events.onStats({
      triangles: this.generated.stats.triangles,
      instances: this.generated.stats.instances,
    });
  }

  /**
   * Hand the engine its loaded models. Regenerates, because the scene standing
   * on screen was built from proxies.
   *
   * The library is what is shared and what is downloaded once; the per-document
   * view of it is derived on every `setDocument`.
   */
  setAssets(library: AssetLibrary, options: { includeContext: boolean }): void {
    this.library = library;
    if (this.lastDocument !== null) this.setDocument(this.lastDocument, options);
  }

  /** Free the overlay's boxes. Called on every rebuild, and on teardown. */
  private clearColliderOverlay(): void {
    for (const child of [...this.colliderOverlay.children]) {
      this.colliderOverlay.remove(child);
      const mesh = child as THREE.LineSegments;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }

  /**
   * Light the scene at a clock time, without touching the document.
   *
   * This is the playback path, and it exists because the document path cannot
   * be. `setSolar` goes through `editDocument`, which structured-clones the
   * whole document, re-parses it through Zod, re-lints it and bumps `revision`
   * — and the viewport regenerates the entire scene on a revision change. At
   * sixty frames a second that is sixty full scene rebuilds, which is not slow
   * so much as impossible.
   *
   * So playback drives the engine and leaves the document alone; the transport
   * commits the final time once, when it stops.
   */
  setSolarMinutes(minutes: number): void {
    if (this.lastDocument === null) return;
    this.applySolar(
      resolveSolar(this.lastDocument, {
        ...this.lastDocument.solar,
        time: minutesToClock(minutes),
      }),
    );
  }

  setSolar(doc: SceneDocument): void {
    this.applySolar(resolveSolar(doc));
  }

  private applySolar(solved: ReturnType<typeof resolveSolar>): void {
    this.lastSolar = solved;
    const { position, lighting } = solved;
    const direction = position.direction;
    const below = direction.y <= 0;

    aimSun(this.sun, direction, lighting);
    this.ambient.intensity = lighting.ambientIntensity;

    const uniforms = this.sky.material.uniforms;
    uniforms["turbidity"]!.value = lighting.sky.turbidity;
    uniforms["rayleigh"]!.value = lighting.sky.rayleigh;
    uniforms["mieCoefficient"]!.value = 0.005;
    uniforms["mieDirectionalG"]!.value = 0.8;
    // The **true** direction, not the light's clamped one.
    //
    // These were the same vector, and that is the bug: the clamp exists to keep
    // the shadow camera out of a degenerate direction, and it was incidentally
    // lying to the dome. At Bucharest on 2026-06-21 22:30 the sun is at
    // -11.61°, and `Math.max(1, y * 120)` handed the shader an elevation of
    // +0.49° — a full sunset glow on the north-west horizon — while the path
    // tracer's environment, built from the same unclamped direction the render
    // path uses, correctly saw night. Scrub past sunset, see dusk, press
    // Render, get night.
    uniforms["sunPosition"]!.value.set(direction.x, direction.y, direction.z).normalize();

    // Below the horizon three's `Sky` drives its whole result from
    // `sunIntensity(dot(sun, up))`, which is 0 there — so the dome would paint
    // black while the environment map paints a dim blue night. Hide it and
    // paint the environment's own night gradient instead, from the one
    // function both sides read.
    this.sky.visible = !below;
    if (below) {
      const { zenith } = skyGradient(direction.y, lighting.sky.turbidity);
      this.scene.background = this.nightSky.setRGB(
        zenith.r,
        zenith.g,
        zenith.b,
        THREE.LinearSRGBColorSpace,
      );
    } else {
      this.scene.background = null;
    }
  }

  /**
   * Draw the derived colliders as wireframes.
   *
   * Worth seeing rather than trusting: colliders are *derived* from the
   * document, so an opening that is cut in the mesh but not in the collider is
   * exactly the kind of divergence that is invisible until something falls
   * through a wall.
   */
  setColliderOverlay(colliders: readonly CuboidCollider[] | null): void {
    this.clearColliderOverlay();

    if (colliders === null) {
      this.colliderOverlay.visible = false;
      return;
    }

    for (const collider of colliders) {
      const [hx, hy, hz] = collider.halfExtents;
      const box = new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2);
      const lines = new THREE.LineSegments(
        new THREE.EdgesGeometry(box),
        new THREE.LineBasicMaterial({
          color: collider.source === "wall" ? 0xe8a33d : 0x5f9ea0,
          transparent: true,
          opacity: 0.75,
        }),
      );
      box.dispose();
      lines.position.set(...collider.position);
      lines.rotation.y = collider.rotationY;
      lines.name = `collider:${collider.id}`;
      this.colliderOverlay.add(lines);
    }
    this.colliderOverlay.visible = true;
  }

  /* ── selection ──────────────────────────────────────────────── */

  select(id: string | null): void {
    this.selectedId = id;
    this.reattachSelection();
  }

  private reattachSelection(): void {
    const target = this.selectedId === null ? null : this.findMesh(this.selectedId);
    const helper = this.gizmo.getHelper();

    if (target === null) {
      this.gizmo.detach();
      helper.visible = false;
      this.selectionBox.visible = false;
      return;
    }

    this.gizmo.attach(target);
    helper.visible = true;
    this.selectionBox.setFromObject(target);
    this.selectionBox.visible = true;
  }

  private findMesh(id: string): THREE.Object3D | null {
    if (this.generated === null) return null;
    let found: THREE.Object3D | null = null;
    this.generated.subject.traverse((object) => {
      if (found === null && object.name.endsWith(`:${id}`)) found = object;
    });
    return found;
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.gizmo.dragging || this.generated === null) return;

    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hits = this.raycaster.intersectObject(this.generated.subject, true);
    const first = hits[0]?.object;
    const id = first?.name.includes(":") === true ? first.name.split(":")[1]! : null;
    this.events.onSelect(id);
  };

  private commitDrag(): void {
    const object = this.gizmo.object;
    if (object === undefined || this.dragStart === null || this.selectedId === null) return;
    const dx = object.position.x - this.dragStart.x;
    const dz = object.position.z - this.dragStart.z;
    this.dragStart = null;
    if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) return;
    this.events.onTranslate(this.selectedId, dx, dz);
  }

  /* ── path-traced render ─────────────────────────────────────── */

  /**
   * Leave the real-time path entirely and accumulate samples.
   *
   * Resolves with the finished image, or null if it was cancelled. The renderer
   * is restored to the viewport's size either way.
   */
  async startRender(request: RenderRequest): Promise<Blob | null> {
    // Refused rather than queued, and rather than superseding.
    //
    // Superseding was what shipped: `cancelRender()` nulled the session without
    // awaiting it, so the outgoing one stayed parked in its build or its poll
    // and reached its `finally` minutes later — resizing the renderer back to
    // *its* idea of the viewport, re-enabling orbit and popping the gizmo back
    // on screen, all in the middle of the new render. Queuing would be
    // friendlier, but the queue already exists a layer up in `renderQueue`,
    // where it can show progress and write each file as it lands; a second,
    // invisible queue in here would only be able to lose work quietly.
    if (this.render !== null) {
      throw new Error("A render is already running");
    }
    const { shot, ...settings } = request;

    // Fetched before anything else is touched, so a chunk that fails to arrive
    // leaves the viewport exactly as it was — no disabled orbit, no hidden
    // gizmo, no half-built render scene to unwind.
    let tracer: Tracer;
    try {
      this.events.onRenderLoading?.();
      tracer = await import("./PathTracer.js");
    } catch (error) {
      throw new Error(`Could not load the renderer: ${(error as Error).message}`);
    }

    // A shot's solar override is the whole reason `garden-elevation` differs
    // from `sw-threequarter`: it renders at 07:15 whatever the working clock
    // says. The sun, the sky environment and the pixels all have to agree, so
    // it is resolved once here and threaded in rather than read from the
    // viewport's `lastSolar`.
    const solar =
      shot?.solar !== undefined && this.lastDocument !== null
        ? resolveSolar(this.lastDocument, shot.solar)
        : this.lastSolar;

    const renderScene = this.buildRenderScene(solar, tracer);
    // Captured before the session resizes the renderer, and restored by this
    // method rather than by the session: the renderer is the engine's, and only
    // the engine knows whether anyone else has taken it over since.
    const viewportSize = this.renderer.getSize(new THREE.Vector2());
    const camera = shot === undefined ? this.viewportRenderCamera(settings) : shotCamera(shot);
    const session = new tracer.PathTraceSession(this.renderer, renderScene, camera, {
      ...settings,
      // Built from the *resolved* solar, not from the shot, so the overlay
      // reports the time actually being rendered rather than the time asked for.
      label: [
        shot?.name ?? "Viewport",
        `${settings.width} × ${settings.height}`,
        solar === null ? null : solar.solar.time,
      ]
        .filter((part): part is string => part !== null)
        .join(" · "),
    });
    this.render = session;
    this.orbit.enabled = false;
    this.gizmo.getHelper().visible = false;
    this.selectionBox.visible = false;

    try {
      await session.start((progress) => this.events.onRenderProgress(progress));
      await new Promise<void>((resolve) => {
        const poll = (): void => {
          if (this.render !== session || session.complete) return resolve();
          setTimeout(poll, 120);
        };
        poll();
      });
      return this.render === session ? await session.toBlob() : null;
    } finally {
      // Ownership is released *first*, before anything that can throw.
      //
      // Disposal used to come first, and when it threw — it did, reaching into
      // the tracer's internals — `this.render` stayed set, so the frame loop
      // went on calling `step()` on a half-disposed session at full rate,
      // forever. The tab pegged a core and stopped answering. Whatever else
      // fails in here, the engine must first stop believing a render is live.
      const owned = this.render === session || this.render === null;
      if (owned) this.render = null;

      session.dispose();
      // Only the clone's instance buffers, and nothing else.
      //
      // `InstancedMesh.copy` allocates a fresh `Float32Array` for
      // `instanceMatrix`, which the renderer uploads as its own VBO;
      // `Scene.clear()` only detaches children and frees none of it, so
      // Greenhollow leaked six instance buffers per render. `InstancedMesh
      // .dispose()` releases exactly those and leaves geometry and material
      // alone — which matters, because the clone shares both with the live
      // scene and disposing them would blank the viewport.
      renderScene.traverse((object) => {
        const instanced = object as THREE.InstancedMesh;
        if (instanced.isInstancedMesh === true) instanced.dispose();
      });
      renderScene.clear();

      // A session that has been superseded or torn down must not put shared
      // state back: the renderer is no longer its to restore.
      if (owned) {
        this.renderer.setSize(viewportSize.x, viewportSize.y, false);
        this.orbit.enabled = true;
        this.reattachSelection();
        this.events.onRenderProgress(null);
      }
    }
  }

  /**
   * A scene containing only what the path tracer can sample.
   *
   * The viewport's `Sky` mesh, hemisphere light, transform gizmo and selection
   * box all live in `this.scene` and none of them survive a path trace — the sky
   * shader in particular fails inside a colour lookup rather than being skipped.
   * The sky still lights the render, but as a pre-filtered environment map
   * rather than as geometry.
   */
  private buildRenderScene(
    solved: ReturnType<typeof resolveSolar> | null,
    tracer: Tracer,
  ): THREE.Scene {
    const renderScene = new THREE.Scene();
    if (this.generated !== null) renderScene.add(this.generated.root.clone());

    const sun = this.sun.clone();
    sun.target = this.sun.target.clone();
    renderScene.add(sun, sun.target);

    const { position, lighting } = solved ?? { position: null, lighting: null };
    if (position !== null && lighting !== null) {
      // The clone still carries the viewport's sun direction and colour. A shot
      // with its own time needs both moved, or the sky says 07:15 while the
      // shadows say 17:42.
      aimSun(sun, position.direction, lighting);
    }
    const environment =
      position === null || lighting === null
        ? null
        : tracer.buildSkyEnvironment(position.direction, lighting.color, lighting.sky.turbidity);
    if (environment !== null) {
      renderScene.environment = environment;
      renderScene.background = environment;
    }
    return renderScene;
  }

  /**
   * Move the viewport to a shot, so what you see is what you will render.
   *
   * The FOV is recomputed for the *viewport's* aspect, not the shot's: the
   * window is whatever shape the user made it, and matching the shot's framing
   * horizontally is the closest honest preview available.
   */
  frameShot(shot: Shot): void {
    this.orbit.target.copy(frameShot(this.camera, shot));
    this.orbit.update();
  }

  /**
   * The viewport's framing, at the output's aspect ratio.
   *
   * A clone, because the live camera must survive the render untouched — the
   * user should find the viewport exactly where they left it.
   */
  private viewportRenderCamera(settings: RenderSettings): THREE.PerspectiveCamera {
    const camera = this.camera.clone();
    camera.aspect = settings.width / settings.height;
    camera.updateProjectionMatrix();
    return camera;
  }

  cancelRender(): void {
    this.render?.cancel();
    this.render = null;
  }

  get isRendering(): boolean {
    return this.render !== null;
  }

  /* ── loop ───────────────────────────────────────────────────── */

  private observeResize(): void {
    const parent = this.canvas.parentElement;
    if (parent === null) return;
    this.resizeObserver = new ResizeObserver(() => {
      const { clientWidth: w, clientHeight: h } = parent;
      if (w === 0 || h === 0) return;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    });
    this.resizeObserver.observe(parent);
  }

  private readonly loop = (): void => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);

    // A render owns the frame while it lasts. The real-time path is not
    // "paused" behind a flag — it simply does not run, which is what makes
    // cancelling it a matter of dropping the session.
    if (this.render !== null) {
      const progress = this.render.step();
      this.events.onRenderProgress(progress);
      return;
    }

    this.orbit.update();
    if (this.selectionBox.visible && this.gizmo.object !== undefined) {
      this.selectionBox.setFromObject(this.gizmo.object);
    }
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.resizeObserver?.disconnect();
    this.cancelRender();
    this.generated?.dispose();
    this.gizmo.detach();
    this.gizmo.dispose();
    this.orbit.dispose();

    // Everything below this line the engine allocated itself and used to leave
    // behind. With Vite HMR that is a fresh set per edit, and the browser caps
    // WebGL contexts at about sixteen — after which the viewport goes black
    // with no error, which is indistinguishable from the black-render bug.
    this.sky.geometry.dispose();
    (this.sky.material as THREE.Material).dispose();
    this.selectionBox.geometry.dispose();
    (this.selectionBox.material as THREE.Material).dispose();
    // A 2048×2048 depth target, and `DirectionalLight.dispose()` does not touch
    // it.
    this.sun.shadow.dispose();
    this.clearColliderOverlay();

    this.renderer.dispose();

    /**
     * Give the context back — but only if the canvas is going with us.
     *
     * `renderer.dispose()` in three 0.185 releases the renderer's own resources
     * and never the context, and a browser allows only about sixteen. But
     * `forceContextLoss()` is **permanent for that canvas**: nothing can ever
     * get a context from it again.
     *
     * The canvas belongs to React, not to the engine, and React keeps the same
     * node across a Fast Refresh — so calling this unconditionally meant the
     * next engine's `new WebGLRenderer({ canvas })` failed outright and the
     * viewport threw on every HMR update. (Measured, not reasoned: it took the
     * app down on the first edit after this was added.) A reused canvas reuses
     * its context anyway, so there is nothing to reclaim in that case.
     *
     * Deferred a turn because React runs this cleanup *before* it detaches the
     * node, so "is it still in the document" is only answerable afterwards.
     */
    const canvas = this.canvas;
    const renderer = this.renderer;
    setTimeout(() => {
      if (!canvas.isConnected) renderer.forceContextLoss();
    }, 0);
  }
}

/**
 * Point the scene's one directional light at the origin from the sun's
 * direction — and turn it off when the sun is not up.
 *
 * The clamp is doing exactly one job: a `DirectionalLight` at or under `y = 0`
 * has a degenerate shadow camera and casts nothing useful, so its position is
 * lifted to keep the frustum sane. That is a guard on the *light*, and it must
 * not reach the sky dome, which wants the truth. Above the horizon the lift is
 * harmless — 0.3° becomes 0.48° — and below it the honest guard is `visible =
 * false`, not a light hoisted into a sky it has set behind.
 *
 * Shared by the viewport and by the render scene so the two cannot drift, which
 * is how they came to disagree in the first place.
 */
export function aimSun(
  sun: THREE.DirectionalLight,
  direction: { x: number; y: number; z: number },
  lighting: { color: string; intensity: number },
): void {
  const distance = 120;
  sun.position.set(direction.x * distance, Math.max(1, direction.y * distance), direction.z * distance);
  sun.target.position.set(0, 0, 0);
  sun.color.set(lighting.color);
  sun.intensity = lighting.intensity;
  // `intensity` is already 0 below the horizon, so this is not what makes the
  // scene dark — it stops the renderer rendering a shadow map every frame for
  // a light contributing nothing.
  sun.visible = direction.y > 0;
}
