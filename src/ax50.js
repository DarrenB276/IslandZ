// ================= AX50 modular rifle mesh (ported from the AX50 builder) =================
// Built in builder space (X = muzzle/forward, Y = up), then wrapped in a group rotated so the
// barrel points -Z (game convention). Parts are toggled by the attachment set:
//   attachments.optic === 'ax50_scope' → scope + rings + live reticle glass
//   attachments.mag   === 'ax50_mag'   → magazine
//   attachments.under === 'ax50_bipod' → bipod
import * as THREE from 'three';

const MAT = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: false });
const M = {
  steel: MAT(0x14161a), knurl: MAT(0x0c0d0f), chassis: MAT(0x2e333a), bolt: MAT(0x40464e),
  rail: MAT(0x0e0f11), skin: MAT(0x4a4f3e), polymer: MAT(0x1b1d20), rubber: MAT(0x101113),
  scope: MAT(0x17191d), glass: new THREE.MeshLambertMaterial({ color: 0x26506b }),
};
function cyl(rF, rR, len, m, seg = 18) {
  const g = new THREE.CylinderGeometry(rF, rR, len, seg); g.rotateZ(-Math.PI / 2); // axis → +X
  return new THREE.Mesh(g, m);
}
function cylY(r1, r2, len, m, seg = 14) { return new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, seg), m); }
function box(w, h, d, m) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }
function P(mesh, x, y, z) { mesh.position.set(x, y, z); return mesh; }

const SCOPE_Y = 0.105;

// mil-dot reticle canvas → texture
function reticleTexture(size = 512) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'), h = size / 2;
  x.clearRect(0, 0, size, size);
  x.strokeStyle = '#000'; x.fillStyle = '#000';
  x.lineWidth = size * 0.0035;
  x.beginPath(); x.moveTo(0, h); x.lineTo(size, h); x.moveTo(h, 0); x.lineTo(h, size); x.stroke();
  x.lineWidth = size * 0.022; const post = size * 0.30;
  x.beginPath();
  x.moveTo(0, h); x.lineTo(post, h); x.moveTo(size, h); x.lineTo(size - post, h);
  x.moveTo(h, size); x.lineTo(h, size - post); x.moveTo(h, 0); x.lineTo(h, post); x.stroke();
  const step = size * 0.045, dot = size * 0.006;
  for (let i = 1; i <= 4; i++) for (const [dx, dy] of [[i, 0], [-i, 0], [0, i], [0, -i]]) {
    x.beginPath(); x.arc(h + dx * step, h + dy * step, dot, 0, Math.PI * 2); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}

export function createAX50(attachments = {}) {
  const inner = new THREE.Group();             // builder space (X forward)
  const add = (mesh) => { inner.add(mesh); return mesh; };
  const hasScope = attachments.optic === 'ax50_scope';
  const hasMag = attachments.mag === 'ax50_mag';
  const hasBipod = attachments.under === 'ax50_bipod';

  // ---- barrel + muzzle brake ----
  add(P(cyl(0.0145, 0.0175, 0.60, M.steel, 20), 0.44, 0, 0));
  add(P(cyl(0.019, 0.021, 0.05, M.steel, 16), 0.165, 0, 0));
  add(P(cyl(0.011, 0.011, 0.024, M.knurl, 12), 0.752, 0, 0));
  add(P(cyl(0.017, 0.019, 0.135, M.steel, 16), 0.828, 0, 0));
  for (let i = 0; i < 3; i++) add(P(box(0.014, 0.072, 0.052, M.steel), 0.795 + i * 0.038, 0, 0));
  add(P(cyl(0.02, 0.021, 0.016, M.steel, 16), 0.9, 0, 0));

  // ---- receiver + bolt ----
  add(P(box(0.30, 0.075, 0.06, M.chassis), 0, 0.01, 0));
  add(P(box(0.09, 0.032, 0.006, M.knurl), 0.03, 0.012, 0.0305));
  add(P(cyl(0.02, 0.021, 0.05, M.chassis, 14), -0.165, 0.015, 0));
  add(P(box(0.05, 0.02, 0.064, M.steel), 0.13, 0.012, 0));
  add(P(cyl(0.011, 0.011, 0.16, M.bolt, 12), -0.155, 0.015, 0));
  const handle = cylY(0.006, 0.006, 0.075, M.bolt, 10); handle.rotation.x = 2.1; handle.position.set(-0.11, -0.003, 0.043); add(handle);
  add(P(new THREE.Mesh(new THREE.SphereGeometry(0.0125, 12, 8), M.bolt), -0.11, -0.022, 0.076));

  // ---- picatinny rail ----
  add(P(box(0.42, 0.008, 0.038, M.rail), 0.04, 0.0515, 0));
  for (let i = 0; i < 21; i += 2) add(P(box(0.006, 0.006, 0.038, M.rail), -0.16 + i * 0.02, 0.0585, 0));

  // ---- chassis / handguard + trigger group ----
  add(P(box(0.38, 0.02, 0.058, M.skin), 0.33, -0.032, 0));
  add(P(box(0.38, 0.045, 0.008, M.skin), 0.33, -0.012, 0.0255));
  add(P(box(0.38, 0.045, 0.008, M.skin), 0.33, -0.012, -0.0255));
  add(P(box(0.30, 0.05, 0.055, M.chassis), -0.01, -0.055, 0));
  add(P(box(0.008, 0.05, 0.008, M.chassis), -0.03, -0.105, 0));
  add(P(box(0.008, 0.05, 0.008, M.chassis), -0.12, -0.105, 0));
  add(P(box(0.10, 0.008, 0.008, M.chassis), -0.075, -0.134, 0));
  const trig = P(box(0.008, 0.035, 0.006, M.steel), -0.065, -0.10, 0); trig.rotation.z = 0.18; add(trig);

  // ---- pistol grip ----
  const grip = P(box(0.032, 0.115, 0.04, M.polymer), -0.152, -0.135, 0); grip.rotation.z = -0.22; add(grip);
  add(P(box(0.04, 0.014, 0.044, M.polymer), -0.166, -0.192, 0));

  // ---- buttstock ----
  add(P(box(0.035, 0.09, 0.052, M.chassis), -0.185, -0.005, 0));
  add(P(box(0.30, 0.03, 0.045, M.skin), -0.35, 0.02, 0));
  add(P(box(0.27, 0.02, 0.03, M.skin), -0.345, -0.062, 0));
  add(P(box(0.03, 0.16, 0.045, M.chassis), -0.50, -0.02, 0));
  add(P(box(0.02, 0.175, 0.052, M.rubber), -0.527, -0.02, 0));
  add(P(box(0.14, 0.026, 0.042, M.polymer), -0.355, 0.058, 0));

  // ---- iron sights (always present; used when no scope) ----
  const ironRear = P(box(0.01, 0.024, 0.03, M.steel), -0.05, 0.07, 0);
  const ironFront = P(box(0.008, 0.03, 0.008, M.steel), 0.5, 0.07, 0);
  add(ironRear); add(ironFront);

  const ud = { partsX: true };

  // ---- magazine (attachment) ----
  if (hasMag) {
    const body = P(box(0.108, 0.10, 0.036, M.polymer), 0.05, -0.128, 0); body.rotation.z = 0.06; add(body);
    add(P(box(0.122, 0.014, 0.042, M.polymer), 0.046, -0.182, 0));
    add(P(box(0.108, 0.008, 0.037, M.knurl), 0.052, -0.085, 0));
  }

  // ---- bipod (attachment) ----
  if (hasBipod) {
    add(P(box(0.05, 0.022, 0.05, M.polymer), 0.44, -0.048, 0));
    for (const s of [1, -1]) {
      const lg = new THREE.CylinderGeometry(0.006, 0.005, 0.32, 8); lg.translate(0, -0.16, 0);
      const leg = new THREE.Group();
      leg.add(new THREE.Mesh(lg, M.steel));
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), M.rubber); foot.position.y = -0.315; leg.add(foot);
      leg.position.set(0.44, -0.058, 0.022 * s); leg.rotation.set(-0.42 * s, 0, 0.28); add(leg);
    }
  }

  // ---- scope (attachment) with live reticle glass ----
  if (hasScope) {
    ironRear.visible = false; ironFront.visible = false;
    for (const [x, tag] of [[-0.045, 'r'], [0.125, 'f']]) {
      add(P(box(0.026, 0.03, 0.036, M.rail), x, 0.0765, 0));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.0045, 8, 18), M.rail);
      ring.rotation.y = Math.PI / 2; ring.position.set(x, 0.105, 0); add(ring);
    }
    add(P(cyl(0.017, 0.017, 0.20, M.scope, 20), 0.04, SCOPE_Y, 0));
    add(P(cyl(0.030, 0.017, 0.09, M.scope, 20), 0.185, SCOPE_Y, 0));
    add(P(cyl(0.030, 0.030, 0.06, M.scope, 20), 0.26, SCOPE_Y, 0));
    add(P(cyl(0.017, 0.023, 0.04, M.scope, 20), -0.08, SCOPE_Y, 0));
    add(P(cyl(0.023, 0.023, 0.06, M.scope, 20), -0.13, SCOPE_Y, 0));
    add(P(cylY(0.014, 0.015, 0.034, M.knurl, 12), 0.0, SCOPE_Y + 0.036, 0));
    // objective lens (front)
    const obj = new THREE.Mesh(new THREE.CircleGeometry(0.027, 20), M.glass);
    obj.geometry.rotateY(Math.PI / 2); obj.position.set(0.2905, SCOPE_Y, 0); add(obj);

    // live ocular render-target + reticle plane (the "functional glass")
    const rt = new THREE.WebGLRenderTarget(384, 384);
    const ocular = new THREE.Mesh(new THREE.CircleGeometry(0.0195, 20),
      new THREE.MeshBasicMaterial({ map: rt.texture }));
    ocular.geometry.rotateY(-Math.PI / 2); ocular.position.set(-0.1595, SCOPE_Y, 0); add(ocular);
    const reticle = new THREE.Mesh(new THREE.CircleGeometry(0.0195, 20),
      new THREE.MeshBasicMaterial({ map: reticleTexture(512), transparent: true }));
    reticle.geometry.rotateY(-Math.PI / 2); reticle.position.set(-0.1601, SCOPE_Y, 0); add(reticle);

    ud.scope = { rt, ocular, reticle, scopeY: SCOPE_Y };
  }

  // wrap and rotate so the muzzle points -Z (game convention: forward = -Z)
  const g = new THREE.Group();
  inner.rotation.y = Math.PI / 2;   // +X → -Z
  g.add(inner);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // ---- game attach points (in the rotated group's local space) ----
  const toGame = (x, y, z) => new THREE.Vector3(-z, y, -x); // apply the same +Y 90° rotation
  g.userData.muzzleLocal = toGame(0.9, 0, 0);
  g.userData.gripR = toGame(-0.12, -0.11, 0);
  g.userData.gripL = toGame(0.28, -0.03, 0);
  // aim point: through the scope ocular if present, else the iron rear sight
  g.userData.aimLocal = hasScope ? toGame(-0.1601, SCOPE_Y, 0) : toGame(-0.05, 0.09, 0);
  g.userData.hasScope = hasScope;
  g.userData.ax50 = ud;
  if (ud.scope) {
    // expose the ocular/reticle in game space for the render loop
    g.userData.scope = ud.scope;
  }
  return g;
}
