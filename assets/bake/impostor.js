/**
 * Render one glTF to a billboard atlas.
 *
 * Runs in a real browser because it needs a real GPU — see the corpus page on
 * running under WSL, which is also why this is driven headed rather than
 * headless. Node has no GL, and the whole point is to turn a 17 M-triangle mesh
 * into a few hundred kilobytes, which means actually rasterising it.
 *
 * The atlas is a single row of `angles` views, each `cell` pixels square, shot
 * from a ring around the subject at a fixed elevation. One row rather than an
 * octahedral map: scatter instances are seen from roughly eye level across a
 * field, so the elevation axis buys very little and doubles the bake.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const params = new URLSearchParams(location.search);
const asset = params.get("asset") ?? "";
const angles = Number(params.get("angles") ?? 16);
const cell = Number(params.get("cell") ?? 512);

const log = (message) => {
  document.getElementById("log").textContent = message;
  console.log(`[bake] ${message}`);
};

async function bake() {
  log(`loading ${asset}…`);
  const gltf = await new GLTFLoader().loadAsync(`/assets-src/${asset}`);

  const subject = gltf.scene;
  subject.updateWorldMatrix(true, true);

  // Leaves arrive as alpha-blended cards. Blending is order-dependent and the
  // atlas has no fixed order, so they come out as grey mush; alpha *test* is
  // both correct here and what the impostor itself will use downstream.
  let triangles = 0;
  subject.traverse((child) => {
    if (child.isMesh !== true) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (material === undefined || material === null) continue;
      if (material.transparent === true || material.alphaMap !== null) {
        material.transparent = false;
        material.alphaTest = 0.5;
      }
      material.side = THREE.DoubleSide;
    }
    const position = child.geometry?.getAttribute("position");
    if (position !== undefined) {
      triangles += (child.geometry.index === null ? position.count : child.geometry.index.count) / 3;
    }
  });

  const box = new THREE.Box3().setFromObject(subject);
  const size = new THREE.Vector3();
  const centre = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(centre);

  log(`${Math.round(triangles).toLocaleString()} triangles · ${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} m`);

  const scene = new THREE.Scene();
  scene.add(subject);
  // Flat, shadowless light. An impostor carries its own baked shading into every
  // scene it appears in, so anything directional here would be a sun stuck at
  // one angle while the real sun moves.
  scene.add(new THREE.AmbientLight(0xffffff, 1.6));
  const fill = new THREE.HemisphereLight(0xffffff, 0x6b7a5a, 1.4);
  scene.add(fill);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(cell, cell, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Orthographic: a billboard has no perspective of its own, and a perspective
  // bake would bake in the distortion of whatever distance it was shot from.
  const half = Math.max(size.x, size.y, size.z) / 2;
  const camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.01, half * 10);

  const atlas = document.getElementById("atlas");
  atlas.width = cell * angles;
  atlas.height = cell;
  const ctx = atlas.getContext("2d");

  const radius = half * 4;
  for (let i = 0; i < angles; i++) {
    const theta = (i / angles) * Math.PI * 2;
    camera.position.set(
      centre.x + Math.sin(theta) * radius,
      centre.y,
      centre.z + Math.cos(theta) * radius,
    );
    camera.lookAt(centre);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    ctx.drawImage(renderer.domElement, i * cell, 0);
    log(`baked ${i + 1}/${angles}`);
    await new Promise((r) => requestAnimationFrame(r));
  }

  const blob = await new Promise((resolve) => atlas.toBlob(resolve, "image/png"));
  const form = new FormData();
  form.append("asset", asset);
  form.append(
    "meta",
    JSON.stringify({
      angles,
      cell,
      size: [size.x, size.y, size.z],
      sourceTriangles: Math.round(triangles),
    }),
  );
  form.append("atlas", blob, "atlas.png");

  const response = await fetch("/bake", { method: "POST", body: form });
  log(response.ok ? `DONE ${Math.round(blob.size / 1024)} KB` : `FAILED ${response.status}`);
  window.__bakeDone = response.ok;
}

bake().catch((error) => {
  log(`ERROR ${String(error)}`);
  window.__bakeDone = false;
});
