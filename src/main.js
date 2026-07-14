// ================= IslandZ — bootstrap & game loop =================
import * as THREE from 'three';
import { EffectComposer } from '../vendor/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/examples/jsm/postprocessing/OutputPass.js';
import { World, terrainHeight, SEA_LEVEL } from './world.js';
import { Player } from './player.js';
import { Zombies } from './zombies.js';
import { Controls } from './controls.js';
import { Inventory } from './inventory.js';
import { HUD } from './hud.js';
import { DevMode } from './dev.js';
import { Settings } from './settings.js';
import { createWeaponMesh } from './character.js';
import { initAudio } from './audio.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 700);

// central game context shared by all systems
const G = { scene, camera, renderer, world: null, player: null, zombies: null,
  controls: null, inventory: null, hud: null, dev: null, settings: null, view: 'tpp',
  paused: false, onPlayerDeath: null, onInventoryClosed: null, setPost: null };
window.G = G; // debug handle

G.world = new World(scene);
G.controls = new Controls();
G.player = new Player(G);
G.zombies = new Zombies(G);
G.hud = new HUD(G);
G.inventory = new Inventory(G);
G.dev = new DevMode(G);
G.hud.refreshWeapon();

// ================= post-processing (mobile-friendly: half-res bloom) =================
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.45, 0.6, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());
let postEnabled = true;
G.setPost = (v) => { postEnabled = v; };
G.settings = new Settings(G);

// auto-disable post FX if the device can't keep up
let fpsAcc = 0, fpsN = 0, fpsGraceT = 0;

// ================= first-person viewmodel =================
const viewmodel = new THREE.Group();
camera.add(viewmodel);
scene.add(camera);
let viewmodelSig = '';
let vmMesh = null;
function refreshViewmodel() {
  const w = G.player.weapon;
  const sig = w ? `${w.uid}:${w.attachments ? Object.values(w.attachments).join(',') : ''}` : '';
  if (sig === viewmodelSig) return;
  viewmodelSig = sig;
  viewmodel.clear();
  vmMesh = null;
  if (!w) return;
  vmMesh = createWeaponMesh(w.def.id, w.attachments);
  vmMesh.traverse((o) => { o.castShadow = false; }); // don't catch the sun-shadow camera
  viewmodel.add(vmMesh);
}
G.onWeaponVisualChanged = () => { viewmodelSig = '~'; }; // force rebuild next frame

// FPP weapon poses: idle tactical hold / hip-fire / ADS
const VM_POSES = {
  idle: { pos: [0.27, -0.3, -0.46], rot: [0.32, 0.32, 0.06] },   // low ready, angled in
  hip: { pos: [0.24, -0.24, -0.52], rot: [0.02, 0.05, 0] },
  ads: { pos: [0, -0.155, -0.4], rot: [0, 0, 0] },
  melee: { pos: [0.3, -0.34, -0.5], rot: [0.5, 0, -0.25] },
};
let lastFireInput = -10;

function updateViewmodelPose(dt) {
  if (!vmMesh) return;
  const p = G.player, c = G.controls;
  const w = p.weapon;
  let pose = VM_POSES.melee;
  if (w && w.def.cat === 'weapon') {
    const now = performance.now() / 1000;
    if (c.firing) lastFireInput = now;
    if (c.aim) pose = VM_POSES.ads;
    else if (now - lastFireInput < 1.4 || p.reloading > 0) pose = VM_POSES.hip;
    else pose = VM_POSES.idle;
  }
  const k = Math.min(1, dt * 10);
  vmMesh.position.lerp(new THREE.Vector3(...pose.pos), k);
  vmMesh.rotation.x = THREE.MathUtils.lerp(vmMesh.rotation.x, pose.rot[0], k);
  vmMesh.rotation.y = THREE.MathUtils.lerp(vmMesh.rotation.y, pose.rot[1], k);
  vmMesh.rotation.z = THREE.MathUtils.lerp(vmMesh.rotation.z, pose.rot[2], k);
  // flashlight on the viewmodel follows darkness too
  const fl = vmMesh.userData.flashlight;
  if (fl) fl.intensity = (G.world.daylight ?? 1) < 0.4 ? 5 : 0;
}

// ================= camera =================
const camState = { dist: 3.6, shoulder: 0.55, fov: 70 };
const EYE = { stand: 1.58, crouch: 1.14, prone: 0.5 };

function updateCamera(dt) {
  const p = G.player, c = G.controls;
  const aiming = c.aim && !p.dead;
  const w = p.weapon;
  const fpp = G.view === 'fpp' && !p.dead;

  const targetFov = aiming ? (w && w.def.cat === 'weapon' ? p.weaponZoom(w) : 58) : 70;
  camState.fov = THREE.MathUtils.lerp(camState.fov, targetFov, Math.min(1, dt * 9));
  camera.fov = camState.fov;
  camera.updateProjectionMatrix();

  const pitch = c.camPitch - p.recoil * 0.5;
  const yaw = c.camYaw;
  const fwd = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));

  p.rig.group.visible = !fpp;
  viewmodel.visible = fpp && !(w && w.def.cat === 'weapon' && p.weaponScoped(w) && aiming);

  if (fpp) {
    const eyeY = p.pos.y + (EYE[p.stance] ?? 1.58) + (p.climbT >= 0 ? 0.2 : 0);
    camera.position.set(p.pos.x, eyeY, p.pos.z);
    camera.lookAt(camera.position.clone().add(fwd));
    updateViewmodelPose(dt);
    // sway/bob layered on top of the pose
    const bob = Math.sin(performance.now() * 0.008) * Math.min(1, p.speed / 3) * 0.012;
    viewmodel.position.set(0, bob, p.recoil * 0.12);
    return;
  }

  const targetDist = aiming ? 1.9 : 3.6;
  camState.dist = THREE.MathUtils.lerp(camState.dist, targetDist, Math.min(1, dt * 8));

  const headY = p.stance === 'prone' ? 0.6 : p.stance === 'crouch' ? 1.15 : 1.55;
  const pivot = new THREE.Vector3(p.pos.x, p.pos.y + headY, p.pos.z);

  // over-shoulder offset
  const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  pivot.addScaledVector(side, aiming ? camState.shoulder : 0.25);

  const off = new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch),
  ).multiplyScalar(camState.dist);
  const pos = pivot.clone().add(off);

  const minY = G.world.groundHeightSimple(pos.x, pos.z) + 0.35;
  if (pos.y < minY) pos.y = minY;

  camera.position.copy(pos);
  camera.lookAt(pivot.x - Math.sin(yaw) * 4, pivot.y - Math.tan(pitch) * 4, pivot.z - Math.cos(yaw) * 4);
}

// ================= control events =================
G.controls.on('jump', () => { if (!G.paused) G.player.jump(); });
G.controls.on('reload', () => { if (!G.paused) G.player.reload(); });
G.controls.on('crouch', () => { if (!G.paused) G.player.cycleStance('crouch'); });
G.controls.on('prone', () => { if (!G.paused) G.player.cycleStance('prone'); });
G.controls.on('swap', () => { if (!G.paused) G.player.swapWeapon(); });
G.controls.on('quick', (i) => { if (!G.paused && !G.inventory.isOpen && started) G.player.quickUse(i); });
G.controls.on('menu', () => { if (started && !G.inventory.isOpen) G.settings.toggle(); });
G.controls.on('view', () => {
  if (G.paused) return;
  G.view = G.view === 'tpp' ? 'fpp' : 'tpp';
  document.getElementById('btn-view').classList.toggle('active', G.view === 'fpp');
  G.hud.toast(G.view === 'fpp' ? 'First person' : 'Third person');
});
G.controls.on('inventory', () => {
  if (G.paused) return;
  G.inventory.toggle();
  syncOverlays();
});
G.onInventoryClosed = () => syncOverlays();
function syncOverlays() {
  document.getElementById('hud').classList.toggle('hidden', G.inventory.isOpen);
  G.controls.enabled = !G.inventory.isOpen && started && !G.player.dead;
}
G.controls.on('interact', () => {
  if (G.paused) return;
  const near = G.world.itemsNear(G.player.pos, 2.2);
  if (!near.length) return;
  const { gi } = near[0];
  if (G.inventory.autoStash(gi.inst)) {
    G.world.removeGroundItem(gi);
    G.hud.toast('Picked up ' + gi.inst.def.name);
  } else {
    G.hud.toast('No room for ' + gi.inst.def.name);
  }
});

// ================= island map overlay =================
let mapDrawn = false;
function drawMapBase() {
  const cv = document.getElementById('map-canvas');
  const ctx = cv.getContext('2d');
  const S = cv.width, EXT = 230; // world units from center shown
  const toPx = (v) => (v / EXT + 1) * S / 2;
  for (let py = 0; py < S; py += 2) {
    for (let px = 0; px < S; px += 2) {
      const x = (px / S * 2 - 1) * EXT, z = (py / S * 2 - 1) * EXT;
      const h = terrainHeight(x, z);
      let col;
      if (h < SEA_LEVEL) col = h < SEA_LEVEL - 3 ? '#39687f' : '#4d84a0';
      else if (h < 0.75) col = '#cbb98a';
      else if (h > 2.6) col = '#8a8468';
      else col = '#7d945c';
      ctx.fillStyle = col;
      ctx.fillRect(px, py, 2, 2);
    }
  }
  // roads
  ctx.fillStyle = '#5c5a52';
  ctx.fillRect(toPx(-3.5), toPx(-60), toPx(3.5) - toPx(-3.5), toPx(60) - toPx(-60));
  ctx.fillRect(toPx(-50), toPx(-3.5), toPx(50) - toPx(-50), toPx(3.5) - toPx(-3.5));
  // pond
  ctx.fillStyle = '#4d84a0';
  ctx.beginPath();
  ctx.arc(toPx(46), toPx(-30), (9 / EXT) * S / 2, 0, Math.PI * 2);
  ctx.fill();
  // buildings
  for (const b of G.world.buildings) {
    ctx.fillStyle = b.table === 'medical' ? '#c04840' : '#3d3a34';
    ctx.fillRect(toPx(b.x) - 3, toPx(b.z) - 3, 6, 6);
  }
  // military tents
  ctx.fillStyle = '#4a563e';
  ctx.fillRect(toPx(-70) - 5, toPx(-90) - 4, 24, 8);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = '#2e2a22';
  ctx.fillText('N ↑', 12, 22);
}

G.showMap = () => {
  if (!mapDrawn) { drawMapBase(); mapDrawn = true; }
  const cv = document.getElementById('map-canvas');
  const ctx = cv.getContext('2d');
  if (mapDrawn) {
    // redraw base + player marker fresh each open
    drawMapBase();
    const EXT = 230, S = cv.width;
    const toPx = (v) => (v / EXT + 1) * S / 2;
    const p = G.player.pos;
    ctx.fillStyle = '#d83a2e';
    ctx.beginPath();
    ctx.arc(toPx(p.x), toPx(p.z), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  document.getElementById('map-overlay').classList.add('open');
  G.paused = true;
  G.controls.enabled = false;
};
document.getElementById('map-close').addEventListener('click', () => {
  document.getElementById('map-overlay').classList.remove('open');
  G.paused = false;
  G.controls.enabled = !G.inventory.isOpen && started && !G.player.dead;
});

// ================= death / respawn =================
G.onPlayerDeath = (cause) => {
  document.getElementById('death-cause').textContent = cause;
  G.view = 'tpp'; // watch your own corpse, DayZ style
  setTimeout(() => {
    document.getElementById('death-screen').classList.add('show');
    G.controls.enabled = false;
  }, 1600);
};

document.getElementById('btn-respawn').addEventListener('click', () => {
  location.reload();
});

// ================= start =================
let started = false;
document.getElementById('btn-start').addEventListener('click', () => {
  initAudio();
  started = true;
  document.getElementById('start-screen').classList.add('hidden');
  G.controls.enabled = true;
  if (navigator.maxTouchPoints > 0) {
    document.documentElement.requestFullscreen?.().then(() => {
      screen.orientation?.lock?.('landscape').catch(() => {});
    }).catch(() => {});
  }
});

// ================= resize =================
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.setSize(window.innerWidth / 2, window.innerHeight / 2);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ================= interact prompt =================
let promptTick = 0;
function updateInteractPrompt(dt) {
  promptTick -= dt;
  if (promptTick > 0) return;
  promptTick = 0.25;
  if (G.inventory.isOpen || G.player.dead || !started) { G.controls.setInteract(null); return; }
  const near = G.world.itemsNear(G.player.pos, 2.2);
  G.controls.setInteract(near.length ? near[0].gi.inst.def.name : null);
}

// ================= main loop =================
const clock = new THREE.Clock();
let elapsed = 0;

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;
  if (started && G.paused) {
    // menu open: freeze the world, keep rendering
  } else if (started) {
    G.controls.poll();
    if (!G.inventory.isOpen) {
      G.player.update(dt);
    } else {
      G.player.speed = 0;
    }
    G.zombies.update(dt, elapsed);
    G.world.update(dt, elapsed, G.player.pos, camera.position);
    updateCamera(dt);
    updateInteractPrompt(dt);
    G.hud.update(dt);
    G.dev.update();
    refreshViewmodel();

    // auto-disable bloom if fps is poor for a sustained period
    fpsGraceT += dt;
    if (fpsGraceT > 6 && postEnabled) {
      fpsAcc += dt; fpsN++;
      if (fpsN >= 90) {
        if (fpsAcc / fpsN > 1 / 26) {
          postEnabled = false;
          G.settings.data.post = false;
          G.settings.save();
          G.hud.toast('Post FX off (performance)');
        }
        fpsAcc = 0; fpsN = 0;
      }
    }
  } else {
    const a = elapsed * 0.05;
    camera.position.set(Math.cos(a) * 45, 16, Math.sin(a) * 45);
    camera.lookAt(0, 2, 0);
    G.world.update(dt, elapsed, camera.position, camera.position);
  }
  if (postEnabled) composer.render();
  else renderer.render(scene, camera);
}
loop();
