// ================= Item 3D meshes: GLB loader + rendered icon thumbnails =================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ITEMS } from './items.js';
import { createWeaponMesh } from './character.js';

const loader = new GLTFLoader();
const meshCache = new Map();   // id -> THREE.Group (template)
const iconCache = new Map();   // id -> dataURL

function loadGLB(url) {
  return new Promise((resolve, reject) => loader.load(url, (g) => resolve(g.scene), undefined, reject));
}

// normalize a loaded model: center it and scale so its largest dimension ~= target
function normalize(group, target = 0.5) {
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = target / (Math.max(size.x, size.y, size.z) || 1);
  const wrap = new THREE.Group();
  group.position.sub(center);
  wrap.add(group);
  wrap.scale.setScalar(s);
  return wrap;
}

// ---------- icon thumbnail renderer (offscreen) ----------
let iconRenderer = null, iconScene = null, iconCam = null;
function initIconRenderer() {
  if (iconRenderer) return;
  iconRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  iconRenderer.setSize(72, 72);
  iconScene = new THREE.Scene();
  iconScene.add(new THREE.HemisphereLight(0xffffff, 0x556655, 1.4));
  const dl = new THREE.DirectionalLight(0xffffff, 1.4); dl.position.set(1, 2, 2); iconScene.add(dl);
  iconCam = new THREE.PerspectiveCamera(35, 1, 0.01, 10);
  iconCam.position.set(0.55, 0.5, 0.7);
  iconCam.lookAt(0, 0, 0);
}
function renderIcon(template, framed) {
  initIconRenderer();
  const m = framed ? frameForIcon(template.clone()) : template.clone();
  iconScene.add(m);
  iconRenderer.render(iconScene, iconCam);
  const url = iconRenderer.domElement.toDataURL('image/png');
  iconScene.remove(m);
  return url;
}
// center + scale an arbitrary mesh to fit the icon frame, angled for a nice 3/4 view
function frameForIcon(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  obj.position.sub(center);
  const wrap = new THREE.Group();
  wrap.add(obj);
  wrap.scale.setScalar(0.62 / (Math.max(size.x, size.y, size.z) || 1));
  wrap.rotation.set(0.35, -0.7, 0);
  return wrap;
}

// ---------- public API ----------
export async function preloadModels() {
  for (const id of Object.keys(ITEMS)) {
    const d = ITEMS[id];
    if (d.mesh) {
      try {
        const scene = await loadGLB(`models/${d.mesh}.glb`);
        const tmpl = normalize(scene, d.meshSize ?? 0.5);
        meshCache.set(id, tmpl);
        iconCache.set(id, renderIcon(tmpl));
      } catch (e) { console.warn('model load failed for', id, e); }
    } else if (d.cat === 'weapon' || d.cat === 'melee') {
      // procedural weapon/melee mesh → rendered icon (mesh as icon, DayZ-style)
      try {
        const mesh = createWeaponMesh(id, { optic: null, under: null, mag: id === 'ax50' ? 'ax50_mag' : null, muzzle: null });
        weaponMeshCache.set(id, mesh);
        iconCache.set(id, renderIcon(mesh, true));
      } catch (e) { console.warn('weapon icon failed for', id, e); }
    }
  }
}

const weaponMeshCache = new Map();
export function weaponTemplate(id) { return weaponMeshCache.get(id) || null; }

export function itemMesh(id) {
  const t = meshCache.get(id);
  return t ? t.clone() : null;
}
export function itemIcon(id) { return iconCache.get(id) || null; }
export function hasMesh(id) { return meshCache.has(id); }
