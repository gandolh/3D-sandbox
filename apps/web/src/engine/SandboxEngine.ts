import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { Sky } from "three/addons/objects/Sky.js";
import type { SceneDocument } from "@solstice/schema";
import { generateScene, type GeneratedScene } from "@solstice/geometry";
import type { CuboidCollider } from "@solstice/physics";
import { resolveSolar } from "@solstice/solar";
import {
  PathTraceSession,
  buildSkyEnvironment,
  type RenderProgress,
  type RenderSettings,
} from "./PathTracer.js";

export interface EngineEvents {
  onSelect: (id: string | null) => void;
  /** Fired when the gizmo finishes a drag, in world-space metres. */
  onTranslate: (id: string, dx: number, dz: number) => void;
  onStats: (stats: { triangles: number; instances: number }) => void;
  onRenderProgress: (progress: RenderProgress | null) => void;
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

    this.generated = generateScene(doc, { includeContext: options.includeContext });
    this.scene.add(this.generated.root);
    this.setSolar(doc);
    this.reattachSelection();

    this.events.onStats({
      triangles: this.generated.stats.triangles,
      instances: this.generated.stats.instances,
    });
  }

  setSolar(doc: SceneDocument): void {
    const solved = resolveSolar(doc);
    this.lastSolar = solved;
    const { position, lighting } = solved;
    const distance = 120;
    this.sun.position.set(
      position.direction.x * distance,
      Math.max(1, position.direction.y * distance),
      position.direction.z * distance,
    );
    this.sun.target.position.set(0, 0, 0);
    this.sun.color.set(lighting.color);
    this.sun.intensity = lighting.intensity;
    this.ambient.intensity = lighting.ambientIntensity;

    const uniforms = this.sky.material.uniforms;
    uniforms["turbidity"]!.value = lighting.sky.turbidity;
    uniforms["rayleigh"]!.value = lighting.sky.rayleigh;
    uniforms["mieCoefficient"]!.value = 0.005;
    uniforms["mieDirectionalG"]!.value = 0.8;
    uniforms["sunPosition"]!.value.copy(this.sun.position).normalize();
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
    for (const child of [...this.colliderOverlay.children]) {
      this.colliderOverlay.remove(child);
      const mesh = child as THREE.LineSegments;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }

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
  async startRender(settings: RenderSettings): Promise<Blob | null> {
    this.cancelRender();
    const renderScene = this.buildRenderScene();
    const session = new PathTraceSession(this.renderer, renderScene, this.camera, settings);
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
      session.dispose();
      renderScene.clear();
      if (this.render === session) this.render = null;
      this.orbit.enabled = true;
      this.reattachSelection();
      this.events.onRenderProgress(null);
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
  private buildRenderScene(): THREE.Scene {
    const renderScene = new THREE.Scene();
    if (this.generated !== null) renderScene.add(this.generated.root.clone());

    const sun = this.sun.clone();
    sun.target = this.sun.target.clone();
    renderScene.add(sun, sun.target);

    const { position, lighting } = this.lastSolar ?? { position: null, lighting: null };
    const environment =
      position === null || lighting === null
        ? null
        : buildSkyEnvironment(position.direction, lighting.color, lighting.sky.turbidity);
    if (environment !== null) {
      renderScene.environment = environment;
      renderScene.background = environment;
    }
    return renderScene;
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
    this.renderer.dispose();
  }
}
