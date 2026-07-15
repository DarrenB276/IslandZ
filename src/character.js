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

// Two-segment limb: upper pivot group + joint group (elbow/knee) with lower segment.
function jointedLimb(w, upperLen, lowerLen, d, upperColor, lowerColor) {
  const g = limb(w, upperLen, d, upperColor);
  const joint = new THREE.Group();
  joint.position.y = -upperLen - 0.02;
  g.add(joint);
  const lower = box(w * 0.88, lowerLen, d * 0.88, lowerColor);
  lower.position.y = -lowerLen / 2;
  joint.add(lower);
  g.userData.joint = joint;
  g.userData.lower = lower;
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

  // neck between torso and head
  const neck = box(0.13, 0.12, 0.13, skin);
  neck.position.y = 0.55;
  hips.add(neck);

  // NOTE: the model's visual front is -Z (matches movement math and three.js convention)
  const headG = new THREE.Group();
  headG.position.y = 0.62;
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

  // arms — shoulder pivot, elbow joint (upper arm in shirt colour, forearm too, hand skin)
  const armL = jointedLimb(0.13, 0.26, 0.24, 0.13, shirt, shirt);
  armL.position.set(-0.28, 0.5, 0);
  hips.add(armL);
  const armR = jointedLimb(0.13, 0.26, 0.24, 0.13, shirt, shirt);
  armR.position.set(0.28, 0.5, 0);
  hips.add(armR);
  const elbowL = armL.userData.joint, elbowR = armR.userData.joint;
  const handL = box(0.11, 0.1, 0.11, skin); handL.position.y = -0.3; elbowL.add(handL);
  const handR = box(0.11, 0.1, 0.11, skin); handR.position.y = -0.3; elbowR.add(handR);

  // legs — hip pivot, knee joint, ankle + foot
  const legL = jointedLimb(0.16, 0.44, 0.42, 0.16, pants, pants);
  legL.position.set(-0.12, 0, 0);
  hips.add(legL);
  const legR = jointedLimb(0.16, 0.44, 0.42, 0.16, pants, pants);
  legR.position.set(0.12, 0, 0);
  hips.add(legR);
  const kneeL = legL.userData.joint, kneeR = legR.userData.joint;

  // ankle groups sit at the bottom of each shin; foot extends forward (-Z)
  function makeFoot(kneeJoint) {
    const ankle = new THREE.Group();
    ankle.position.y = -0.42;              // bottom of the lower leg
    kneeJoint.add(ankle);
    const foot = box(0.15, 0.09, 0.28, 0x3a2f26);
    foot.position.set(0, -0.02, -0.07);    // heel under ankle, toes forward
    ankle.add(foot);
    ankle.userData.foot = foot;
    return ankle;
  }
  const ankleL = makeFoot(kneeL), ankleR = makeFoot(kneeR);

  // weapon mount at the end of the right forearm
  const weaponMount = new THREE.Group();
  weaponMount.position.y = -0.3;
  elbowR.add(weaponMount);

  const rig = {
    group: root, body, hips, torso, neck, headG, head, armL, armR, legL, legR,
    elbowL, elbowR, kneeL, kneeR, ankleL, ankleR, weaponMount,
    vestMesh, maskMesh, backpackMesh,
    footL: ankleL.userData.foot, footR: ankleR.userData.foot,
    hats: { cap: hatCap, boonie: hatBoonie, helmet: hatHelmet, moto: hatMoto },
    hairMesh, handL, handR,
    phase: Math.random() * 10, weaponMesh: null, meleePose: false, gunPose: false,
    footPlantL: 0, footPlantR: 0,
  };
  return rig;
}

export function setBoots(rig, def) {
  const c = def?.color ?? 0x3a2f26;   // bare feet ~ dark shoe-less
  rig.footL.material.color.setHex(c);
  rig.footR.material.color.setHex(c);
}

// first-person: keep the real torso + legs (so you see your body when you look down), but hide
// the head and the real arms/held-weapon — a camera-attached viewmodel provides the arms + gun,
// which always aim exactly where you look (no glitching when aiming up/down).
export function setFirstPersonBody(rig, on) {
  rig.headG.visible = !on;
  rig.neck.visible = !on;
  rig.torso.visible = true;
  rig.armL.visible = !on;
  rig.armR.visible = !on;
  rig.vestMesh.visible = !!rig.vestMesh.userData.want;
  if (rig.weaponMesh) rig.weaponMesh.visible = !on;
}

// viewmodel arms: two forearms + hands gripping the weapon, in the weapon's local space so they
// track the weapon. gripL/gripR come from the weapon mesh userData.
export function createViewmodelArms(gloveColor, sleeveColor, gripL, gripR) {
  const g = new THREE.Group();
  const skin = gloveColor ?? 0xd8a583;
  const sleeve = sleeveColor ?? 0x6b7280;
  const mkArm = (grip, side) => {
    const arm = new THREE.Group();
    const hand = box(0.1, 0.09, 0.12, skin);
    hand.position.set(grip.x, grip.y, grip.z);
    arm.add(hand);
    const fore = box(0.085, 0.085, 0.3, sleeve);
    fore.position.set(grip.x + side * 0.045, grip.y - 0.06, grip.z + 0.2);
    fore.rotation.set(-0.6, side * 0.18, side * 0.12);
    arm.add(fore);
    return arm;
  };
  g.add(mkArm(gripR, 1));
  g.add(mkArm(gripL, -1));
  g.traverse((o) => { o.castShadow = false; });
  return g;
}

export function setBackpack(rig, def) {
  rig.backpackMesh.visible = !!def;
  if (def) rig.backpackMesh.material.color.setHex(def.color ?? 0x6a5a40);
}

export function setClothingColors(rig, { top, pants, gloves }) {
  rig.torso.material.color.setHex(top ?? 0x6b7280);
  for (const arm of [rig.armL, rig.armR]) {
    arm.userData.mesh.material.color.setHex(top ?? 0x6b7280);
    arm.userData.lower.material.color.setHex(top ?? 0x6b7280);
  }
  for (const leg of [rig.legL, rig.legR]) {
    leg.userData.mesh.material.color.setHex(pants ?? 0x4b5563);
    leg.userData.lower.material.color.setHex(pants ?? 0x4b5563);
  }
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
  rig.vestMesh.userData.want = !!def;
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
export function createWeaponMesh(id, attachments) {
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
    case 'm249':
      add(0.075, 0.095, 0.62, dark, 0, 0, -0.06);        // heavy receiver
      add(0.055, 0.055, 0.3, metal, 0, 0.01, -0.5);      // barrel
      add(0.05, 0.04, 0.12, metal, 0, -0.04, -0.6);      // muzzle
      add(0.08, 0.1, 0.2, green, 0, -0.02, 0.28);        // stock
      add(0.11, 0.13, 0.14, green, 0, -0.12, 0.02);      // belt box
      add(0.02, 0.14, 0.02, metal, -0.03, -0.13, -0.42); // bipod legs
      add(0.02, 0.14, 0.02, metal, 0.03, -0.13, -0.42);
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

  // ---------- attachments ----------
  if (attachments) {
    const topY = 0.075, topZ = -0.1, underY = -0.09, underZ = -0.28;
    const optic = attachments.optic;
    if (optic === 'optic_rds') {
      // open red-dot: a ring housing with an additive dot floating on the glass (DayZ-style),
      // aimed at exactly along the bore so it's a true in-world reticle (no overlay).
      add(0.05, 0.012, 0.06, dark, 0, topY + 0.05, topZ);       // hood top
      add(0.012, 0.05, 0.012, dark, -0.03, topY + 0.03, topZ);  // side posts
      add(0.012, 0.05, 0.012, dark, 0.03, topY + 0.03, topZ);
      const glass = add(0.05, 0.05, 0.004, 0x0a0f0a, 0, topY + 0.03, topZ);
      glass.material.transparent = true; glass.material.opacity = 0.35;
      g.userData.reticle = makeReticle(0xff3322, 'dot');
      g.userData.reticle.position.set(0, topY + 0.03, topZ - 0.002);
      g.add(g.userData.reticle);
      g.userData.aimLocal = new THREE.Vector3(0, topY + 0.03, topZ); // eye lines up here when ADS
    } else if (optic === 'optic_acog') {
      add(0.05, 0.055, 0.14, dark, 0, topY + 0.025, topZ);
      add(0.035, 0.035, 0.01, 0x88c0d8, 0, topY + 0.025, topZ - 0.075);
    } else if (optic === 'optic_pso1') {
      add(0.05, 0.06, 0.2, dark, -0.015, topY + 0.03, topZ + 0.04);
      add(0.04, 0.04, 0.01, 0x88c0d8, -0.015, topY + 0.03, topZ - 0.065);
    } else if (optic === 'optic_hunting') {
      add(0.04, 0.045, 0.24, metal, 0, topY + 0.03, topZ);
      add(0.05, 0.05, 0.02, dark, 0, topY + 0.03, topZ - 0.13);
      add(0.05, 0.05, 0.02, dark, 0, topY + 0.03, topZ + 0.13);
    }
    const under = attachments.under;
    if (under === 'grip_foregrip') {
      add(0.035, 0.1, 0.045, dark, 0, underY - 0.04, underZ);
    } else if (under === 'under_flashlight') {
      const body = add(0.035, 0.035, 0.09, metal, 0.045, underY + 0.03, underZ);
      const spot = new THREE.SpotLight(0xfff2cc, 0, 32, 0.42, 0.45, 1.2);
      spot.position.set(0.045, underY + 0.03, underZ - 0.05);
      spot.target.position.set(0.045, underY + 0.03, underZ - 10);
      g.add(spot, spot.target);
      g.userData.flashlight = spot;
      g.userData.flashLens = add(0.025, 0.025, 0.006, 0xfff6d8, 0.045, underY + 0.03, underZ - 0.048);
    } else if (under === 'under_laser') {
      add(0.03, 0.03, 0.06, dark, 0.042, underY + 0.03, underZ);
      const lgeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0.042, underY + 0.03, underZ - 0.04),
        new THREE.Vector3(0.042, underY + 0.03, underZ - 30),
      ]);
      const laser = new THREE.Line(lgeo, new THREE.LineBasicMaterial({
        color: 0xff2222, transparent: true, opacity: 0.55 }));
      g.add(laser);
      g.userData.laser = laser;
    }
    if (attachments.mag === 'mag_drum') {
      add(0.05, 0.18, 0.18, dark, 0, -0.16, -0.02);      // drum magazine
    } else if (attachments.mag) {
      add(0.055, 0.11, 0.08, dark, 0, -0.18, -0.03);     // extended mag sticks out
    }
    if (attachments.muzzle) {                            // suppressor extends the barrel
      const bb0 = new THREE.Box3().setFromObject(g);
      add(0.05, 0.05, 0.16, 0x1c1c1e, 0, 0.0, bb0.min.z - 0.07);
    }
  }

  // record the barrel-tip (most -Z point) so bullets can leave the muzzle, plus hand grip points
  if (isGunId(id)) {
    const bb = new THREE.Box3().setFromObject(g);
    g.userData.muzzleLocal = new THREE.Vector3(0, (bb.min.y + bb.max.y) / 2 + 0.02, bb.min.z + 0.02);
    g.userData.gripR = new THREE.Vector3(0, -0.055, 0.05);                    // trigger hand
    const foreZ = id === 'vs98' ? -0.32 : id === 'm249' ? -0.34 : -0.26;
    g.userData.gripL = new THREE.Vector3(0, -0.05, foreZ);                    // support hand
    if (!g.userData.aimLocal) g.userData.aimLocal = new THREE.Vector3(0, 0.06, -0.05); // iron sights
  }
  return g;
}

// small billboarded additive reticle for holographic/red-dot optics
function makeReticle(color, kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);
  if (kind === 'dot') {
    const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 10);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.4, 'rgba(255,60,40,1)');
    grd.addColorStop(1, 'rgba(255,60,40,0)');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(32, 32, 10, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
  }));
  sp.scale.setScalar(0.05);
  sp.renderOrder = 999;
  return sp;
}

function isGunId(id) {
  return ['akm', 'm4a1', 'vs98', 'remington', 'vaiga', 'mp5', 'm249'].includes(id);
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
  let elbL = 0.1, elbR = 0.1;                   // elbow bend (0 = straight)
  let legLX = 0, legRX = 0;
  let kneL = 0.06, kneR = 0.06;                 // knee bend
  let headX = 0; // > 0 tilts face upward

  if (p.dead) {
    const k = Math.min(1, (p.deadT ?? 1) * 2.2);
    rig.body.rotation.x = L(rig.body.rotation.x, -Math.PI / 2 * 0.98, k * 0.2);
    rig.hips.position.y = L(rig.hips.position.y, 0.24, k * 0.2);
    return;
  }

  const swing = moving ? Math.min(1, speed / 2.2) * (0.5 + Math.min(1, speed / 5) * 0.55) : 0;
  const slope = p.groundSlope || 0;   // forward ground slope in radians
  let ankL = 0, ankR = 0;             // ankle pitch (foot planting)
  let swimBlend = 0;

  if (p.swimming) {
    // horizontal breaststroke — body flat, arms sweep, legs flutter
    swimBlend = 1;
    rig.phase += dt * 3;
    bodyRotX = -Math.PI / 2 * 0.92;
    hipY = 0.9;
    headX = 1.2;
    armLX = 1.7 + s(t * 1.6) * 1.1;
    armRX = 1.7 - s(t * 1.6) * 1.1;
    armLZ = 0.5 + s(t * 1.6) * 0.4;
    armRZ = -0.5 - s(t * 1.6) * 0.4;
    elbL = 0.5 + Math.max(0, s(t * 1.6)) * 0.6;
    elbR = 0.5 + Math.max(0, -s(t * 1.6)) * 0.6;
    legLX = 0.3 + s(t * 2.4) * 0.4;
    legRX = 0.3 - s(t * 2.4) * 0.4;
    kneL = 0.3 + Math.max(0, s(t * 2.4)) * 0.5;
    kneR = 0.3 + Math.max(0, -s(t * 2.4)) * 0.5;
    ankL = -0.7; ankR = -0.7;
  } else if (p.climbing != null && p.climbing >= 0) {
    // climbing a ledge: arms reach forward/up, legs push
    const c = p.climbing;
    armLX = 2.4 + s(c * 10) * 0.3;
    armRX = 2.4 - s(c * 10) * 0.3;
    elbL = 0.5; elbR = 0.5;
    legLX = 0.9 + s(c * 12) * 0.5;
    legRX = 0.9 - s(c * 12) * 0.5;
    kneL = 1.2; kneR = 1.2;
    bodyRotX = -0.25;
  } else if (p.stance === 'prone') {
    bodyRotX = -Math.PI / 2 * 0.94; // chest down, head toward -Z
    hipY = 0.34;
    if (moving) {
      armLX = 2.6 + s(t) * 0.6;
      armRX = 2.6 - s(t) * 0.6;
      elbL = 0.6 + s(t) * 0.25; elbR = 0.6 - s(t) * 0.25;
      legLX = s(t) * 0.45;
      legRX = -s(t) * 0.45;
      kneL = 0.4 + Math.max(0, s(t)) * 0.5;
      kneR = 0.4 + Math.max(0, -s(t)) * 0.5;
    } else {
      armLX = 2.5; armRX = 2.5;
      elbL = 0.55; elbR = 0.55;
      kneL = 0.25; kneR = 0.25;
    }
    headX = 1.15; // raise head to look forward while lying down
  } else {
    const crouch = p.stance === 'crouch';
    hipY = crouch ? 0.58 : 0.92;
    torsoLean = crouch ? 0.42 : (speed > 4 ? 0.22 : speed > 2 ? 0.1 : 0);
    if (p.jumping) {
      legLX = 0.8; legRX = -0.2;
      kneL = 1.3; kneR = 0.7;
      armLX = 0.5; armRX = 0.5;
      elbL = 0.7; elbR = 0.7;
    } else if (moving) {
      legLX = s(t) * swing;
      legRX = -s(t) * swing;
      // knee bends as the leg swings back and recovers
      kneL = 0.12 + Math.max(0, -s(t - 0.5)) * swing * 1.15;
      kneR = 0.12 + Math.max(0, s(t - 0.5)) * swing * 1.15;
      armLX = -s(t) * swing * 0.8;
      armRX = s(t) * swing * 0.8;
      elbL = 0.25 + Math.max(0, -s(t)) * swing * 0.5;
      elbR = 0.25 + Math.max(0, s(t)) * swing * 0.5;
    } else {
      // idle breathing
      armLX = s(t * 0.5) * 0.04;
      armRX = -s(t * 0.5) * 0.04;
      elbL = 0.14; elbR = 0.14;
      torsoLean += s(t * 0.5) * 0.015;
    }
    if (crouch) { legLX += 1.15; legRX += 1.15; kneL += 1.85; kneR += 1.85; } // deep squat
  }

  // zombie posture: hunched forward, arms dangle or reach
  if (p.zombie) {
    torsoLean += 0.35;
    headX += 0.15 + s(t * 0.7) * 0.08;
    if (p.aggro) {
      armLX = 1.6 + s(t) * 0.35;
      armRX = 1.6 - s(t) * 0.35;
      elbL = 0.45; elbR = 0.45;
      armLZ = 0.25; armRZ = -0.25;
    } else if (!moving) {
      armLX = 0.2 + s(t * 0.4) * 0.1;
      armRX = 0.25 - s(t * 0.45) * 0.1;
      elbL = 0.3; elbR = 0.35;
    }
    if (p.attackT != null) {
      const a = p.attackT;
      const reach = a < 0.4 ? a / 0.4 : 1 - (a - 0.4) / 0.6;
      armLX = 1.2 + reach * 1.1;
      armRX = 1.2 + reach * 1.1;
      elbL = 0.6 - reach * 0.45; elbR = 0.6 - reach * 0.45; // extend on lunge
      torsoLean += reach * 0.3;
    }
  }

  // weapon poses override arms — bent elbows give a proper tactical hold.
  // aimPitch tilts the whole hold up/down with the look direction so the barrel tracks the aim.
  const aimPitch = THREE.MathUtils.clamp(p.camPitch || 0, -0.7, 0.9);
  if (rig.gunPose && !p.zombie && !p.swimming && p.stance !== 'prone' && p.climbing == null) {
    if (p.aiming) {
      // shouldered: weapon raised to eye line, both hands on it, tilts with aimPitch
      armRX = 1.28 - aimPitch; armRZ = -0.16; elbR = 0.58;
      armLX = 1.08 - aimPitch; armLZ = 0.52; elbL = 0.72;
      torsoLean += 0.14;
    } else {
      // high ready: weapon up across the chest (visible in first person, natural in third)
      armRX = 1.0 - aimPitch * 0.6; armRZ = -0.14; elbR = 0.7;
      armLX = 0.85 - aimPitch * 0.6; armLZ = 0.5; elbL = 0.8;
      torsoLean += 0.08;
      if (moving && speed > 4) { armRX = 0.5; armLX = 0.42; elbR = 0.7; elbL = 0.95; } // lower when sprinting
    }
  } else if (rig.gunPose && p.stance === 'prone') {
    armRX = 2.3; armLX = 2.2; armLZ = 0.3;
    elbR = 0.7; elbL = 0.85;
  }
  if (rig.meleePose && !p.zombie && !p.swimming) {
    armRX = Math.max(armRX, 0.3);
    elbR = Math.max(elbR, 0.55);
    if (p.attackT != null) {
      const a = p.attackT;
      const wind = a < 0.3 ? a / 0.3 : 0;
      const strike = a >= 0.3 ? (a - 0.3) / 0.7 : 0;
      armRX = 0.4 + wind * 1.5 - strike * 2.0; // wind up overhead, chop down/forward
      elbR = 0.55 + wind * 0.7 - strike * 1.0;
      armRZ = -0.15 - strike * 0.2;
      torsoLean += strike * 0.25;
    }
  } else if (p.using != null && !p.zombie) {
    // eating/drinking/using: raise the right hand to the mouth with a small bob
    const b = Math.sin(p.using * Math.PI * 6) * 0.12;
    armRX = 2.15 + b; armRZ = -0.35; elbR = 1.5;
    headX = 0.15;
  } else if (!rig.meleePose && !rig.gunPose && p.attackT != null && !p.zombie) {
    // fists: jab extends the elbow
    const a = p.attackT;
    const punch = a < 0.5 ? a / 0.5 : 1 - (a - 0.5) / 0.5;
    armRX = 0.4 + punch * 1.0;
    elbR = 1.1 - punch * 1.0;
    elbL = 0.9;
    armLX = 0.5;
  }

  // feet: cancel most of the leg's pitch so soles stay near the ground surface, add slope
  if (!p.swimming) {
    if (p.stance === 'prone') { ankL = 0.5; ankR = 0.5; }
    else {
      ankL = slope - (legLX - kneL) * 0.55;
      ankR = slope - (legRX - kneR) * 0.55;
      if (p.stance === 'crouch') { ankL += 0.15; ankR += 0.15; }
    }
  }

  // apply with smoothing (lean forward = negative X rotation; knee bend = negative)
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
  rig.elbowL.rotation.x = L(rig.elbowL.rotation.x, Math.max(0, elbL), k);
  rig.elbowR.rotation.x = L(rig.elbowR.rotation.x, Math.max(0, elbR), k);
  rig.legL.rotation.x = L(rig.legL.rotation.x, legLX, k);
  rig.legR.rotation.x = L(rig.legR.rotation.x, legRX, k);
  rig.kneeL.rotation.x = L(rig.kneeL.rotation.x, -Math.max(0, kneL), k);
  rig.kneeR.rotation.x = L(rig.kneeR.rotation.x, -Math.max(0, kneR), k);
  rig.ankleL.rotation.x = L(rig.ankleL.rotation.x, THREE.MathUtils.clamp(ankL, -1.1, 1.1), k);
  rig.ankleR.rotation.x = L(rig.ankleR.rotation.x, THREE.MathUtils.clamp(ankR, -1.1, 1.1), k);

  // orient held weapon: keep the barrel level with the forearm
  if (rig.weaponMesh) {
    if (rig.gunPose) {
      const pitch = rig.armR.rotation.x + rig.elbowR.rotation.x;
      rig.weaponMesh.rotation.set(-pitch - 0.05, 0, 0);
      rig.weaponMesh.position.set(-0.06, -0.05, 0.02);
    } else {
      rig.weaponMesh.rotation.set(0, 0, 0);
      rig.weaponMesh.position.set(0, -0.05, 0);
    }
  }
}
