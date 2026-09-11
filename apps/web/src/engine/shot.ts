import * as THREE from "three";
import type { Shot } from "@solstice/schema";

/**
 * Full-frame film dimensions, in millimetres.
 *
 * The document declares a **35 mm-equivalent** focal length, which is only
 * meaningful against this gauge.
 */
export const FILM_WIDTH_MM = 36;

/**
 * Vertical field of view, in degrees, for a 35 mm-equivalent focal length.
 *
 * The film *height* is derived from the aspect ratio rather than fixed at 24 mm.
 * A render is a crop of the image circle, not a squeeze of the full-frame
 * rectangle: a 16:9 shot exposes 36 × 20.25 mm, so it sees less vertically than
 * the 3:2 still it is quoted against. Fixing the height at 24 mm would widen
 * every 16:9 render by about four degrees — plausible-looking, and wrong.
 */
export function shotFov(focalLength: number, aspect: number): number {
  const filmHeight = FILM_WIDTH_MM / aspect;
  return THREE.MathUtils.radToDeg(2 * Math.atan(filmHeight / (2 * focalLength)));
}

/**
 * A camera framed exactly as the shot declares.
 *
 * Purpose-built rather than borrowed: a render must not disturb where the user
 * left the viewport, and the two cameras have different aspect ratios by
 * definition — the shot's is fixed by its output size, the viewport's by the
 * browser window.
 */
export function shotCamera(shot: Shot): THREE.PerspectiveCamera {
  const aspect = shot.render.width / shot.render.height;
  const camera = new THREE.PerspectiveCamera(
    shotFov(shot.camera.focalLength, aspect),
    aspect,
    0.1,
    2000,
  );
  camera.position.set(...shot.camera.position);
  camera.lookAt(new THREE.Vector3(...shot.camera.target));
  camera.updateProjectionMatrix();
  return camera;
}

/** Move an existing camera to a shot, keeping its own aspect (the viewport's). */
export function frameShot(camera: THREE.PerspectiveCamera, shot: Shot): THREE.Vector3 {
  camera.position.set(...shot.camera.position);
  camera.fov = shotFov(shot.camera.focalLength, camera.aspect);
  camera.updateProjectionMatrix();
  return new THREE.Vector3(...shot.camera.target);
}
