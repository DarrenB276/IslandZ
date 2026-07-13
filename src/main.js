// ================= IslandZ — bootstrap & game loop =================
import * as THREE from 'three';
import { EffectComposer } from '../vendor/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/examples/jsm/postprocessing/OutputPass.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Zombies } from './zombies.js';
import { Controls } from './controls.js';
import { Inventory } from './inventory.js';
import { HUD } from './hud.js';
import { DevMode } from './dev.js';
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
  controls: null, inventory: null, hud: null, dev: null, view: 'tpp',
  onPlayerDeath: null, onInventoryClosed: null, setPost: null };
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

// auto-disable post FX if the device can't keep up
let fpsAcc = 0, fpsN = 0, fpsGraceT = 0;

// ================= first-person viewmodel =================
const viewmodel = new THREE.Group();
camera.add(viewmodel);
scene.add(camera);
let viewmodelUid = -1;
function refreshViewmodel() {
  const w = G.player.weapon;
  const uid = w ? w.uid : 0;
  if (uid === viewmodelUid) return;
  viewmodelUid = uid;
  viewmodel.clear();
  if (!w) return;
  const mesh = createWeaponMesh(w.def.id);
  if (w.def.cat === 'weapon') {
    mesh.position.set(0.26, -0.24, -0.55);
    mesh.rotation.set(0, 0, 0);
  } else {
    mesh.position.set(0.3, -0.34, -0.5);
    mesh.rotation.set(0.5, 0, -0.25);
  }
  // viewmodel must not catch the sun-shadow camera
  mesh.traverse((o) => { o.castShadow = false; });
  viewmodel.add(mesh);
}

// ================= camera =================
const camState = { dist: 3.6, shoulder: 0.55, fov: 70 };
const EYE = { stand: 1.58, crouch: 1.14, prone: 0.5 };

function updateCamera(dt) {
  const p = G.player, c = G.controls;
  const aiming = c.aim && !p.dead;
  const w = p.weapon;
  const fpp = G.view === 'fpp' && !p.dead;

  const targetFov = aiming ? (w && w.def.cat === 'weapon' ? w.def.zoom : 58) : 70;
  camState.fov = THREE.MathUtils.lerp(camState.fov, targetFov, Math.min(1, dt * 9));
  camera.fov = camState.fov;
  camera.updateProjectionMatrix();

  const pitch = c.camPitch - p.recoil * 0.5;
  const yaw = c.camYaw;
  const fwd = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));

  p.rig.group.visible = !fpp;
  viewmodel.visible = fpp && !(w && w.def.scoped && aiming);

  if (fpp) {
    const eyeY = p.pos.y + (EYE[p.stance] ?? 1.58) + (p.climbT >= 0 ? 0.2 : 0);
    camera.position.set(p.pos.x, eyeY, p.pos.z);
    camera.lookAt(camera.position.clone().add(fwd));
    // weapon sway/bob
    const bob = Math.sin(performance.now() * 0.008) * Math.min(1, p.speed / 3) * 0.012;
    viewmodel.position.set(aiming ? -0.12 : 0, bob + (aiming ? 0.045 : 0), p.recoil * 0.12);
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
G.controls.on('jump', () => G.player.jump());
G.controls.on('reload', () => G.player.reload());
G.controls.on('crouch', () => G.player.cycleStance('crouch'));
G.controls.on('prone', () => G.player.cycleStance('prone'));
G.controls.on('swap', () => G.player.swapWeapon());
G.controls.on('view', () => {
  G.view = G.view === 'tpp' ? 'fpp' : 'tpp';
  document.getElementById('btn-view').classList.toggle('active', G.view === 'fpp');
  G.hud.toast(G.view === 'fpp' ? 'First person' : 'Third person');
});
G.controls.on('inventory', () => {
  G.inventory.toggle();
  syncOverlays();
});
G.onInventoryClosed = () => syncOverlays();
function syncOverlays() {
  document.getElementById('hud').classList.toggle('hidden', G.inventory.isOpen);
  G.controls.enabled = !G.inventory.isOpen && started && !G.player.dead;
}
G.controls.on('interact', () => {
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
  if (started) {
    G.controls.poll();
    if (!G.inventory.isOpen) {
      G.player.update(dt);
    } else {
      G.player.speed = 0;
    }
    G.zombies.update(dt, elapsed);
    G.world.update(dt, elapsed, G.player.pos);
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
        if (fpsAcc / fpsN > 1 / 26) { postEnabled = false; G.dev.post = false; G.hud.toast('Post FX off (performance)'); }
        fpsAcc = 0; fpsN = 0;
      }
    }
  } else {
    const a = elapsed * 0.05;
    camera.position.set(Math.cos(a) * 45, 16, Math.sin(a) * 45);
    camera.lookAt(0, 2, 0);
    G.world.update(dt, elapsed, camera.position);
  }
  if (postEnabled) composer.render();
  else renderer.render(scene, camera);
}
loop();
