// ================= IslandZ — bootstrap & game loop =================
import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';
import { Zombies } from './zombies.js';
import { Controls } from './controls.js';
import { Inventory } from './inventory.js';
import { HUD } from './hud.js';
import { initAudio } from './audio.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);

// central game context shared by all systems
const G = { scene, camera, renderer, world: null, player: null, zombies: null,
  controls: null, inventory: null, hud: null, onPlayerDeath: null };

window.G = G; // debug handle
G.world = new World(scene);
G.controls = new Controls();
G.player = new Player(G);
G.zombies = new Zombies(G);
G.hud = new HUD(G);
G.inventory = new Inventory(G);
G.hud.refreshWeapon();

// ================= camera =================
const camState = { dist: 3.6, shoulder: 0.55, fov: 70 };
function updateCamera(dt) {
  const p = G.player, c = G.controls;
  const aiming = c.aim && !p.dead;
  const w = p.weapon;
  const targetFov = aiming ? (w && w.def.cat === 'weapon' ? w.def.zoom : 58) : 70;
  camState.fov = THREE.MathUtils.lerp(camState.fov, targetFov, Math.min(1, dt * 9));
  camera.fov = camState.fov;
  camera.updateProjectionMatrix();

  const targetDist = aiming ? 1.9 : 3.6;
  camState.dist = THREE.MathUtils.lerp(camState.dist, targetDist, Math.min(1, dt * 8));

  const headY = p.stance === 'prone' ? 0.6 : p.stance === 'crouch' ? 1.15 : 1.55;
  const pivot = new THREE.Vector3(p.pos.x, p.pos.y + headY, p.pos.z);

  // recoil kick
  const pitch = c.camPitch - p.recoil * 0.5;
  const yaw = c.camYaw;

  // over-shoulder offset (in camera space)
  const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  pivot.addScaledVector(side, aiming ? camState.shoulder : 0.25);

  const off = new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch),
  ).multiplyScalar(camState.dist);
  const pos = pivot.clone().add(off);

  // keep camera above terrain
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
G.controls.on('inventory', () => {
  G.inventory.toggle();
  document.getElementById('hud').classList.toggle('hidden', G.inventory.isOpen);
  G.controls.enabled = !G.inventory.isOpen && started && !G.player.dead;
});
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
  // try fullscreen + landscape on mobile
  if (navigator.maxTouchPoints > 0) {
    document.documentElement.requestFullscreen?.().then(() => {
      screen.orientation?.lock?.('landscape').catch(() => {});
    }).catch(() => {});
  }
});

// ================= resize =================
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
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
      G.zombies.update(dt, elapsed);
    } else {
      // world keeps breathing while bag is open, but player stands still
      G.player.speed = 0;
      G.zombies.update(dt, elapsed);
    }
    G.world.update(dt, elapsed, G.player.pos);
    updateCamera(dt);
    updateInteractPrompt(dt);
    G.hud.update(dt);
  } else {
    // menu idle: slow orbit around town
    const a = elapsed * 0.05;
    camera.position.set(Math.cos(a) * 45, 16, Math.sin(a) * 45);
    camera.lookAt(0, 2, 0);
    G.world.update(dt, elapsed, camera.position);
  }
  renderer.render(scene, camera);
}
loop();
