// ================= Low-poly humanoid rig + procedural animation =================
import * as THREE from 'three';

const MAT = (color) => new THREE.MeshLambertMaterial({ color });

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), MAT(color));
  m.castShadow = true;
  return m;
}

// Limb group with pivot at the top; the mesh hangs below it.
function limb(w, len, d, color) {
  const g = new THREE.Group();
  const m = box(w, len, d, color);
  m.position.y = -len / 2;
  g.add(m);
  g.userData.mesh = m;
  return g;
}

export function createHumanoid(opts = {}) {
  const skin = opts.skin ?? 0xd8a583;
  const shirt = opts.shirt ?? 0x6b7280;
  const pants = opts.pants ?? 0x4b5563;
  const hair = opts.hair ?? 0x3a2a1c;

  const root = new THREE.Group();       // at feet level
  const body = new THREE.Group();       // lean/prone pivot at hips
  root.add(body);

  const hips = new THREE.Group();
  hips.position.y = 0.92;
  body.add(hips);

  const torso = box(0.42, 0.52, 0.24, shirt);
  torso.position.y = 0.26 + 0.02;
  hips.add(torso);

  const vestMesh = box(0.48, 0.4, 0.3, 0x2e3128);
  vestMesh.position.y = 0.3;
  vestMesh.visible = false;
  hips.add(vestMesh);

  // NOTE: the model's visual front is -Z (matches movement math and three.js convention)
  const headG = new THREE.Group();
  headG.position.y = 0.58;
  hips.add(headG);
  const head = box(0.24, 0.26, 0.24, skin);
  head.position.y = 0.15;
  headG.add(head);
  const hairMesh = box(0.26, 0.09, 0.26, hair);
  hairMesh.position.y = 0.28;
  headG.add(hairMesh);
  // eyes on the front face
  const eyeMat = new THREE.MeshLambertMaterial({ color: opts.eye ?? 0x1c1c22 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.045, 0.015), eyeMat);
    eye.position.set(side * 0.06, 0.17, -0.125);
    headG.add(eye);
  }

  // headgear variants
  const hatCap = new THREE.Group();
  { const b = box(0.27, 0.08, 0.27, 0xffffff); b.position.y = 0.3; hatCap.add(b);
    const brim = box(0.2, 0.03, 0.16, 0xffffff); brim.position.set(0, 0.27, -0.2); hatCap.add(brim); }
  const hatBoonie = new THREE.Group();
  { const b = box(0.24, 0.1, 0.24, 0xffffff); b.position.y = 0.31; hatBoonie.add(b);
    const brim = box(0.36, 0.025, 0.36, 0xffffff); brim.position.y = 0.27; hatBoonie.add(brim); }
  const hatHelmet = new THREE.Group();
  { const b = box(0.3, 0.16, 0.3, 0xffffff); b.position.y = 0.28; hatHelmet.add(b); }
  const hatMoto = new THREE.Group();
  { const b = box(0.3, 0.28, 0.3, 0xffffff); b.position.y = 0.18; hatMoto.add(b);
    const visor = box(0.24, 0.08, 0.02, 0x88aabb); visor.position.set(0, 0.2, -0.16); hatMoto.add(visor); }
  const maskMesh = box(0.2, 0.12, 0.05, 0xffffff);
  maskMesh.position.set(0, 0.1, -0.135);
  headG.add(maskMesh);
  maskMesh.visible = false;
  for (const h of [hatCap, hatBoonie, hatHelmet, hatMoto]) { h.visible = false; headG.add(h); }

  // backpack sits on the back (+Z)
  const backpackMesh = box(0.36, 0.42, 0.18, 0x6a5a40);
  backpackMesh.position.set(0, 0.28, 0.22);
  backpackMesh.visible = false;
  hips.add(backpackMesh);

  // arms — pivot at shoulder
  const armL = limb(0.13, 0.52, 0.13, shirt);
  armL.position.set(-0.28, 0.5, 0);
  hips.add(armL);
  const armR = limb(0.13, 0.52, 0.13, shirt);
  armR.position.set(0.28, 0.5, 0);
  hips.add(armR);
  const handL = box(0.11, 0.1, 0.11, skin); handL.position.y = -0.56; armL.add(handL);
  const handR = box(0.11, 0.1, 0.11, skin); handR.position.y = -0.56; armR.add(handR);

  // legs — pivot at hip
  const legL = limb(0.16, 0.88, 0.16, pants);
  legL.position.set(-0.12, 0, 0);
  hips.add(legL);
  const legR = limb(0.16, 0.88, 0.16, pants);
  legR.position.set(0.12, 0, 0);
  hips.add(legR);

  // weapon mount on right hand
  const weaponMount = new THREE.Group();
  weaponMount.position.y = -0.56;
  armR.add(weaponMount);

  const rig = {
    group: root, body, hips, torso, headG, head, armL, armR, legL, legR, weaponMount,
    vestMesh, maskMesh, backpackMesh,
    hats: { cap: hatCap, boonie: hatBoonie, helmet: hatHelmet, moto: hatMoto },
    hairMesh, handL, handR,
    phase: Math.random() * 10, weaponMesh: null, meleePose: false, gunPose: false,
  };
  return rig;
}

export function setBackpack(rig, def) {
  rig.backpackMesh.visible = !!def;
  if (def) rig.backpackMesh.material.color.setHex(def.color ?? 0x6a5a40);
}

export function setClothingColors(rig, { top, pants, gloves }) {
  rig.torso.material.color.setHex(top ?? 0x6b7280);
  rig.armL.userData.mesh.material.color.setHex(top ?? 0x6b7280);
  rig.armR.userData.mesh.material.color.setHex(top ?? 0x6b7280);
  rig.legL.userData.mesh.material.color.setHex(pants ?? 0x4b5563);
  rig.legR.userData.mesh.material.color.setHex(pants ?? 0x4b5563);
  const skin = 0xd8a583;
  rig.handL.material.color.setHex(gloves ?? skin);
  rig.handR.material.color.setHex(gloves ?? skin);
}

export function setHeadgear(rig, def) {
  for (const h of Object.values(rig.hats)) h.visible = false;
  rig.hairMesh.visible = true;
  if (def && def.hat) {
    const hat = rig.hats[def.hat];
    if (hat) {
      hat.visible = true;
      rig.hairMesh.visible = def.hat === 'cap';
      hat.traverse((o) => { if (o.isMesh && o.material.color.getHex() !== 0x88aabb) o.material = MAT(def.color); });
    }
  }
}

export function setMask(rig, def) {
  rig.maskMesh.visible = !!def;
  if (def) rig.maskMesh.material.color.setHex(def.color);
}

export function setVest(rig, def) {
  rig.vestMesh.visible = !!def;
  if (def) rig.vestMesh.material.color.setHex(def.color);
}

export function attachWeapon(rig, mesh, isGun) {
  if (rig.weaponMesh) rig.weaponMount.remove(rig.weaponMesh);
  rig.weaponMesh = mesh || null;
  rig.gunPose = !!mesh && isGun;
  rig.meleePose = !!mesh && !isGun;
  if (mesh) rig.weaponMount.add(mesh);
}

// ================= weapon meshes =================
export function createWeaponMesh(id) {
  const g = new THREE.Group();
  const add = (w, h, d, color, x, y, z) => {
    const m = box(w, h, d, color);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  const dark = 0x2a2a2c, wood = 0x6e4a2a, metal = 0x3a3d40, green = 0x44513a;
  switch (id) {
    case 'akm':
      add(0.06, 0.07, 0.62, metal, 0, 0, -0.1);          // receiver+barrel
      add(0.05, 0.05, 0.3, dark, 0, 0.005, -0.5);        // barrel
      add(0.07, 0.09, 0.22, wood, 0, -0.01, 0.28);       // stock
      add(0.05, 0.16, 0.07, metal, 0, -0.1, -0.05);      // mag (curved-ish)
      add(0.06, 0.06, 0.14, wood, 0, -0.05, -0.28);      // handguard
      break;
    case 'm4a1':
      add(0.06, 0.07, 0.58, dark, 0, 0, -0.08);
      add(0.05, 0.05, 0.26, metal, 0, 0.005, -0.46);
      add(0.07, 0.08, 0.18, dark, 0, 0, 0.26);
      add(0.05, 0.14, 0.06, dark, 0, -0.09, -0.02);
      add(0.04, 0.04, 0.2, dark, 0, 0.06, -0.15);        // rail/sight
      break;
    case 'vs98':
      add(0.055, 0.07, 0.8, wood, 0, 0, -0.05);
      add(0.04, 0.04, 0.4, metal, 0, 0.01, -0.62);
      add(0.07, 0.09, 0.24, wood, 0, -0.02, 0.34);
      add(0.05, 0.1, 0.05, metal, 0, -0.08, 0.02);
      add(0.05, 0.06, 0.2, dark, 0, 0.085, 0.02);        // scope
      break;
    case 'remington':
      add(0.06, 0.07, 0.55, metal, 0, 0, -0.08);
      add(0.05, 0.05, 0.32, dark, 0, -0.03, -0.42);      // tube+barrel
      add(0.07, 0.09, 0.22, wood, 0, -0.01, 0.28);
      add(0.06, 0.06, 0.14, wood, 0, -0.055, -0.3);      // pump
      break;
    case 'vaiga':
      add(0.065, 0.075, 0.58, metal, 0, 0, -0.08);
      add(0.055, 0.055, 0.26, dark, 0, 0, -0.46);
      add(0.07, 0.09, 0.2, dark, 0, -0.01, 0.27);
      add(0.06, 0.17, 0.09, dark, 0, -0.1, -0.04);       // drum-ish mag
      break;
    case 'mp5':
      add(0.055, 0.07, 0.36, dark, 0, 0, -0.04);
      add(0.04, 0.04, 0.14, metal, 0, 0.005, -0.28);
      add(0.045, 0.16, 0.055, dark, 0, -0.1, -0.04);
      add(0.05, 0.05, 0.1, dark, 0, 0, 0.16);            // folded stock
      break;
    case 'machete':
      add(0.03, 0.42, 0.09, 0x8f9aa3, 0, -0.3, 0);
      add(0.04, 0.14, 0.05, dark, 0, -0.02, 0);
      break;
    case 'cleaver':
      add(0.025, 0.2, 0.14, 0x9aa5ad, 0, -0.2, 0);
      add(0.035, 0.12, 0.04, wood, 0, -0.02, 0);
      break;
    case 'kitchen_knife':
      add(0.02, 0.2, 0.05, 0xaab4bc, 0, -0.2, 0);
      add(0.03, 0.1, 0.035, dark, 0, -0.02, 0);
      break;
    case 'combat_knife':
      add(0.025, 0.22, 0.05, 0x707a82, 0, -0.21, 0);
      add(0.035, 0.11, 0.04, green, 0, -0.02, 0);
      break;
    default:
      add(0.05, 0.05, 0.3, dark, 0, 0, 0);
  }
  return g;
}

// ================= procedural animation =================
// Model faces -Z. Positive limb rotation.x swings the limb FORWARD (toward -Z);
// forward torso lean / prone tilt are NEGATIVE rotations about X.
// params: { stance:'stand'|'crouch'|'prone', speed (m/s), aiming, attackT (0..1 melee swing),
//           jumping, climbing (0..1), zombie, dead, deadT }
const L = THREE.MathUtils.lerp;

export function animateHumanoid(rig, dt, p) {
  const speed = p.speed || 0;
  const moving = speed > 0.15;
  rig.phase += dt * (2.2 + speed * 2.4);
  const t = rig.phase;
  const s = (x) => Math.sin(x);

  // targets
  let hipY = 0.92, bodyRotX = 0, torsoLean = 0; // torsoLean > 0 = lean forward
  let armLX = 0, armRX = 0, armLZ = 0.06, armRZ = -0.06;
  let legLX = 0, legRX = 0;
  let headX = 0; // > 0 tilts face upward

  if (p.dead) {
    const k = Math.min(1, (p.deadT ?? 1) * 2.2);
    rig.body.rotation.x = L(rig.body.rotation.x, -Math.PI / 2 * 0.98, k * 0.2);
    rig.hips.position.y = L(rig.hips.position.y, 0.24, k * 0.2);
    return;
  }

  const swing = moving ? Math.min(1, speed / 2.2) * (0.5 + Math.min(1, speed / 5) * 0.55) : 0;

  if (p.climbing != null && p.climbing >= 0) {
    // climbing a ledge: arms reach forward/up, legs push
    const c = p.climbing;
    armLX = 2.4 + s(c * 10) * 0.3;
    armRX = 2.4 - s(c * 10) * 0.3;
    legLX = 0.9 + s(c * 12) * 0.5;
    legRX = 0.9 - s(c * 12) * 0.5;
    bodyRotX = -0.25;
  } else if (p.stance === 'prone') {
    bodyRotX = -Math.PI / 2 * 0.94; // chest down, head toward -Z
    hipY = 0.34;
    if (moving) {
      armLX = 2.6 + s(t) * 0.6;
      armRX = 2.6 - s(t) * 0.6;
      legLX = s(t) * 0.45;
      legRX = -s(t) * 0.45;
    } else {
      armLX = 2.5; armRX = 2.5;
    }
    headX = 1.15; // raise head to look forward while lying down
  } else {
    const crouch = p.stance === 'crouch';
    hipY = crouch ? 0.62 : 0.92;
    torsoLean = crouch ? 0.42 : (speed > 4 ? 0.22 : speed > 2 ? 0.1 : 0);
    if (p.jumping) {
      legLX = 0.7; legRX = -0.35;
      armLX = 0.5; armRX = 0.5;
    } else if (moving) {
      legLX = s(t) * swing;
      legRX = -s(t) * swing;
      armLX = -s(t) * swing * 0.8;
      armRX = s(t) * swing * 0.8;
    } else {
      // idle breathing
      armLX = s(t * 0.5) * 0.04;
      armRX = -s(t * 0.5) * 0.04;
      torsoLean += s(t * 0.5) * 0.015;
    }
    if (crouch) { legLX += 0.9; legRX += 0.9; } // knees forward
  }

  // zombie posture: hunched forward, arms dangle or reach
  if (p.zombie) {
    torsoLean += 0.35;
    headX += 0.15 + s(t * 0.7) * 0.08;
    if (p.aggro) {
      armLX = 1.9 + s(t) * 0.35;
      armRX = 1.9 - s(t) * 0.35;
      armLZ = 0.25; armRZ = -0.25;
    } else if (!moving) {
      armLX = 0.2 + s(t * 0.4) * 0.1;
      armRX = 0.25 - s(t * 0.45) * 0.1;
    }
    if (p.attackT != null) {
      const a = p.attackT;
      const reach = a < 0.4 ? a / 0.4 : 1 - (a - 0.4) / 0.6;
      armLX = 1.2 + reach * 1.2;
      armRX = 1.2 + reach * 1.2;
      torsoLean += reach * 0.3;
    }
  }

  // weapon poses override arms
  if (rig.gunPose && !p.zombie && p.stance !== 'prone' && p.climbing == null) {
    if (p.aiming) {
      armRX = 1.5; armRZ = -0.12;
      armLX = 1.35; armLZ = 0.5;
    } else {
      armRX = 0.9; armRZ = -0.1;
      armLX = 0.75; armLZ = 0.45;
      if (moving && speed > 4) { armRX = 0.5; armLX = 0.4; } // lower gun while sprinting
    }
  } else if (rig.gunPose && p.stance === 'prone') {
    armRX = 2.55; armLX = 2.45; armLZ = 0.3;
  }
  if (rig.meleePose && !p.zombie) {
    armRX = Math.max(armRX, 0.35);
    if (p.attackT != null) {
      const a = p.attackT;
      const wind = a < 0.3 ? a / 0.3 : 0;
      const strike = a >= 0.3 ? (a - 0.3) / 0.7 : 0;
      armRX = 0.4 + wind * 1.6 - strike * 2.2; // wind up overhead, chop down/forward
      armRZ = -0.15 - strike * 0.2;
      torsoLean += strike * 0.25;
    }
  } else if (!rig.meleePose && !rig.gunPose && p.attackT != null && !p.zombie) {
    // fists
    const a = p.attackT;
    const punch = a < 0.5 ? a / 0.5 : 1 - (a - 0.5) / 0.5;
    armRX = 0.3 + punch * 1.4;
  }

  // apply with smoothing (lean forward = negative X rotation)
  const k = Math.min(1, dt * 14);
  rig.hips.position.y = L(rig.hips.position.y, hipY, k);
  rig.body.rotation.x = L(rig.body.rotation.x, bodyRotX, k);
  rig.torso.rotation.x = L(rig.torso.rotation.x, -torsoLean * 0.4, k);
  rig.hips.rotation.x = L(rig.hips.rotation.x, -torsoLean * 0.5, k);
  rig.headG.rotation.x = L(rig.headG.rotation.x, headX + torsoLean * 0.5, k);
  rig.armL.rotation.x = L(rig.armL.rotation.x, armLX, k);
  rig.armR.rotation.x = L(rig.armR.rotation.x, armRX, k);
  rig.armL.rotation.z = L(rig.armL.rotation.z, armLZ, k);
  rig.armR.rotation.z = L(rig.armR.rotation.z, armRZ, k);
  rig.legL.rotation.x = L(rig.legL.rotation.x, legLX, k);
  rig.legR.rotation.x = L(rig.legR.rotation.x, legRX, k);

  // orient held weapon: barrel down the arm axis, sights up
  if (rig.weaponMesh) {
    if (rig.gunPose) {
      const wr = p.stance === 'prone' ? -2.5 : p.aiming ? -1.62 : -1.5;
      rig.weaponMesh.rotation.set(wr, 0, 0);
      rig.weaponMesh.position.set(-0.06, -0.05, 0.02);
    } else {
      rig.weaponMesh.rotation.set(0, 0, 0);
      rig.weaponMesh.position.set(0, -0.05, 0);
    }
  }
}
