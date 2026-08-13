// ================= IslandZ Model Editor =================
// Standalone box/primitive modeler for game items, weapons and equipment.
// Detects every registered item, lets you build/edit low-poly models, place
// weapon points (muzzle/grips/sight/attachments), and export JSON / GLB / OBJ.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { ITEMS } from '../items.js';
import { createWeaponMesh } from '../character.js';

// ---------- palette ----------
const PALETTE = [
  0x2a2a2c, 0x3a3d40, 0x6e4a2a, 0x44513a, 0x8f9aa3, 0x707a82, 0x1c1c1e, 0xffffff, 0xd8a583,
  0x8a8f96, 0x4a5a48, 0x5c6648, 0x3d4c66, 0x8a3232, 0x9fd0d8, 0x2e3128, 0xff3322, 0x88c0d8,
];

// ================= scene =================
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f1315);
const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
camera.position.set(1.1, 0.8, 1.4);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.target.set(0, 0.05, 0);

scene.add(new THREE.HemisphereLight(0xcfe5ee, 0x30302a, 1.0));
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(2, 3, 2); key.castShadow = true; scene.add(key);
scene.add(new THREE.GridHelper(2, 20, 0x445, 0x243));
scene.add(new THREE.AxesHelper(0.3));

const model = new THREE.Group();      // editable parts
const points = new THREE.Group();     // weapon markers
scene.add(model, points);

const gizmo = new TransformControls(camera, renderer.domElement);
gizmo.setSize(0.7);
gizmo.addEventListener('dragging-changed', (e) => { orbit.enabled = !e.value; });
gizmo.addEventListener('objectChange', () => { syncFieldsFromMesh(); });
scene.add(gizmo);

function resize() {
  const r = canvas.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(document.getElementById('viewport'));

// ================= state =================
let selected = null;      // selected part mesh
let currentItemId = null;

// ================= item library =================
const itemListEl = document.getElementById('item-list');
document.getElementById('item-count').textContent = `(${Object.keys(ITEMS).length})`;
function renderItemList(filter = '') {
  itemListEl.innerHTML = '';
  const f = filter.toLowerCase();
  for (const id of Object.keys(ITEMS)) {
    const d = ITEMS[id];
    if (f && !d.name.toLowerCase().includes(f) && !id.includes(f) && !d.cat.includes(f)) continue;
    const row = document.createElement('div');
    row.className = 'item-row' + (id === currentItemId ? ' on' : '');
    row.innerHTML = `<span class="ic">${d.icon}</span><span>${d.name}</span><span class="cat">${d.cat}</span>`;
    row.onclick = () => selectItem(id);
    itemListEl.appendChild(row);
  }
}
document.getElementById('item-search').addEventListener('input', (e) => renderItemList(e.target.value));

function selectItem(id) {
  currentItemId = id;
  document.getElementById('model-name').textContent = ITEMS[id].name;
  document.getElementById('load-game').style.display =
    isGun(id) ? '' : 'none';
  clearModel();
  if (isGun(id)) loadGameModel();      // guns come with their existing geometry
  else addPart('box', [0.3, 0.3, 0.3], [0, 0.15, 0], 0x8a8f96);
  renderItemList(document.getElementById('item-search').value);
  frameModel();
}
function isGun(id) {
  return ['akm', 'm4a1', 'ax50', 'remington', 'vaiga', 'mp5', 'm249'].includes(id);
}

// ================= parts =================
function makeGeo(shape, size) {
  if (shape === 'cyl') return new THREE.CylinderGeometry(size[0] / 2, size[0] / 2, size[1], 16);
  return new THREE.BoxGeometry(size[0], size[1], size[2]);
}
function addPart(shape, size, pos, color, rot) {
  const mesh = new THREE.Mesh(makeGeo(shape, size), new THREE.MeshLambertMaterial({ color }));
  mesh.castShadow = true;
  mesh.position.fromArray(pos);
  if (rot) mesh.rotation.fromArray(rot);
  mesh.userData = { shape, size: size.slice(), color };
  model.add(mesh);
  selectPart(mesh);
  renderPartList();
  return mesh;
}
function selectPart(mesh) {
  selected = mesh;
  if (mesh) gizmo.attach(mesh); else gizmo.detach();
  document.getElementById('part-props').classList.toggle('hidden', !mesh);
  renderPartList();
  if (mesh) buildPropFields();
}
function renderPartList() {
  const el = document.getElementById('part-list');
  el.innerHTML = '';
  model.children.forEach((m, i) => {
    const row = document.createElement('div');
    row.className = 'part-row' + (m === selected ? ' on' : '');
    const c = '#' + m.userData.color.toString(16).padStart(6, '0');
    row.innerHTML = `<span class="swatch" style="background:${c}"></span><span>${m.userData.shape} ${i + 1}</span><span class="del">✕</span>`;
    row.onclick = (e) => { if (!e.target.classList.contains('del')) selectPart(m); };
    row.querySelector('.del').onclick = () => { model.remove(m); if (selected === m) selectPart(null); renderPartList(); };
    el.appendChild(row);
  });
}

// numeric property fields
function buildPropFields() {
  const grid = document.getElementById('prop-grid');
  grid.innerHTML = '';
  const rows = [
    ['Pos', 'position', ['x', 'y', 'z'], 0.01],
    ['Size', 'size', ['x', 'y', 'z'], 0.01],
    ['Rot°', 'rotation', ['x', 'y', 'z'], 1],
  ];
  for (const [label, kind, axes, step] of rows) {
    const l = document.createElement('div'); l.className = 'lbl'; l.textContent = label; grid.appendChild(l);
    axes.forEach((ax, ai) => {
      const inp = document.createElement('input');
      inp.type = 'number'; inp.step = step; inp.dataset.kind = kind; inp.dataset.ai = ai;
      inp.oninput = () => applyField(kind, ai, parseFloat(inp.value) || 0);
      grid.appendChild(inp);
    });
  }
  syncFieldsFromMesh();
}
function applyField(kind, ai, v) {
  if (!selected) return;
  if (kind === 'position') selected.position.setComponent(ai, v);
  else if (kind === 'rotation') selected.rotation.setFromVector3(
    new THREE.Vector3(selected.rotation.x, selected.rotation.y, selected.rotation.z).setComponent(ai, v * Math.PI / 180));
  else if (kind === 'size') {
    selected.userData.size[ai] = v;
    selected.geometry.dispose();
    selected.geometry = makeGeo(selected.userData.shape, selected.userData.size);
  }
}
function syncFieldsFromMesh() {
  if (!selected) return;
  document.querySelectorAll('#prop-grid input').forEach((inp) => {
    const ai = +inp.dataset.ai;
    if (document.activeElement === inp) return;
    if (inp.dataset.kind === 'position') inp.value = selected.position.getComponent(ai).toFixed(3);
    else if (inp.dataset.kind === 'rotation') inp.value = (selected.rotation.toArray()[ai] * 180 / Math.PI).toFixed(0);
    else inp.value = selected.userData.size[ai].toFixed(3);
  });
}

// ================= palette / color =================
const palEl = document.getElementById('palette');
for (const c of PALETTE) {
  const sw = document.createElement('div'); sw.className = 'sw';
  sw.style.background = '#' + c.toString(16).padStart(6, '0');
  sw.onclick = () => setColor(c);
  palEl.appendChild(sw);
}
document.getElementById('color-picker').oninput = (e) => setColor(parseInt(e.target.value.slice(1), 16));
function setColor(c) {
  if (!selected) return;
  selected.material.color.setHex(c);
  selected.userData.color = c;
  renderPartList();
}

// ================= weapon points =================
function addPoint(name, pos) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffcc33 }));
  m.position.fromArray(pos ?? [0, 0.1, -0.2]);
  m.userData = { name: name ?? 'point' };
  points.add(m);
  renderPointList();
  return m;
}
function renderPointList() {
  const el = document.getElementById('point-list');
  el.innerHTML = '';
  points.children.forEach((m) => {
    const row = document.createElement('div');
    row.className = 'point-row';
    row.innerHTML = `<input class="pname" value="${m.userData.name}"><span class="del">✕</span>`;
    row.querySelector('.pname').oninput = (e) => { m.userData.name = e.target.value; };
    row.onclick = (e) => { if (e.target.classList.contains('pname')) return;
      if (e.target.classList.contains('del')) { points.remove(m); renderPointList(); }
      else { selected = null; gizmo.attach(m); } };
    el.appendChild(row);
  });
}

// ================= load game weapon geometry =================
function loadGameModel() {
  const g = createWeaponMesh(currentItemId, { optic: null, under: null, mag: null, muzzle: null });
  g.updateWorldMatrix(true, true);
  g.traverse((o) => {
    if (!o.isMesh || !o.geometry?.parameters) return;
    const p = o.geometry.parameters;
    let shape, size;
    if (p.radiusTop != null) { shape = 'cyl'; size = [p.radiusTop * 2, p.height, p.radiusTop * 2]; }
    else { shape = 'box'; size = [p.width, p.height, p.depth]; }
    addPart(shape, size, o.position.toArray(), o.material.color.getHex(), o.rotation.toArray().slice(0, 3));
  });
  // named points from the game weapon's userData
  const ud = g.userData;
  if (ud.muzzleLocal) addPoint('muzzle', ud.muzzleLocal.toArray());
  if (ud.gripR) addPoint('gripR', ud.gripR.toArray());
  if (ud.gripL) addPoint('gripL', ud.gripL.toArray());
  if (ud.aimLocal) addPoint('aim', ud.aimLocal.toArray());
  selectPart(model.children[0] ?? null);
}

// ================= model helpers =================
function clearModel() {
  [...model.children].forEach((m) => { m.geometry.dispose(); model.remove(m); });
  [...points.children].forEach((m) => points.remove(m));
  gizmo.detach();
  selected = null;
  renderPartList(); renderPointList();
  document.getElementById('part-props').classList.add('hidden');
}
function frameModel() {
  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3());
  orbit.target.copy(c);
  const r = box.getSize(new THREE.Vector3()).length();
  camera.position.copy(c).add(new THREE.Vector3(r * 0.8, r * 0.6, r * 0.9));
}

// ================= exports =================
function download(name, data, type) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
  toast('Exported ' + name);
}
function modelJSON() {
  return {
    id: currentItemId,
    name: currentItemId ? ITEMS[currentItemId].name : 'model',
    parts: model.children.map((m) => ({
      shape: m.userData.shape,
      size: m.userData.size.map((n) => +n.toFixed(4)),
      pos: m.position.toArray().map((n) => +n.toFixed(4)),
      rot: m.rotation.toArray().slice(0, 3).map((n) => +n.toFixed(4)),
      color: '#' + m.userData.color.toString(16).padStart(6, '0'),
    })),
    points: Object.fromEntries(points.children.map((m) => [m.userData.name, m.position.toArray().map((n) => +n.toFixed(4))])),
  };
}
document.getElementById('exp-json').onclick = () => {
  if (!currentItemId) return toast('Pick an item first');
  download((currentItemId || 'model') + '.model.json', JSON.stringify(modelJSON(), null, 2), 'application/json');
};
document.getElementById('exp-obj').onclick = () => {
  if (!model.children.length) return toast('Nothing to export');
  download((currentItemId || 'model') + '.obj', new OBJExporter().parse(model), 'text/plain');
};
document.getElementById('exp-glb').onclick = () => {
  if (!model.children.length) return toast('Nothing to export');
  new GLTFExporter().parse(model, (res) => {
    download((currentItemId || 'model') + '.glb', res, 'model/gltf-binary');
  }, (err) => toast('GLB export failed'), { binary: true });
};

// import a previously exported model JSON to keep editing it
document.getElementById('imp-json').onclick = () => document.getElementById('imp-file').click();
document.getElementById('imp-file').onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const m = JSON.parse(rd.result);
      if (m.id && ITEMS[m.id]) { currentItemId = m.id; document.getElementById('model-name').textContent = ITEMS[m.id].name; }
      clearModel();
      for (const p of m.parts || []) addPart(p.shape, p.size, p.pos, parseInt(String(p.color).replace('#', ''), 16), p.rot);
      for (const [name, pos] of Object.entries(m.points || {})) addPoint(name, pos);
      selectPart(model.children[0] ?? null);
      frameModel();
      toast('Imported ' + (m.name || file.name));
    } catch (err) { toast('Invalid model JSON'); }
  };
  rd.readAsText(file);
  e.target.value = '';
};

// ================= toolbar ================
document.querySelectorAll('.gizmo-modes button').forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll('.gizmo-modes button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    gizmo.setMode(b.dataset.mode);
  };
});
document.getElementById('add-box').onclick = () => addPart('box', [0.1, 0.1, 0.1], [0, 0.1, 0], currentColor());
document.getElementById('add-cyl').onclick = () => addPart('cyl', [0.08, 0.15, 0.08], [0, 0.1, 0], currentColor());
document.getElementById('dup-part').onclick = () => {
  if (!selected) return;
  const u = selected.userData;
  const m = addPart(u.shape, u.size.slice(), selected.position.toArray(), u.color, selected.rotation.toArray().slice(0, 3));
  m.position.x += 0.05;
};
document.getElementById('del-part').onclick = () => {
  if (!selected) return; model.remove(selected); selectPart(null); renderPartList();
};
document.getElementById('add-point').onclick = () => addPoint('attach' + (points.children.length + 1));
document.getElementById('clear-model').onclick = () => clearModel();
document.getElementById('load-game').onclick = () => { if (isGun(currentItemId)) { clearModel(); loadGameModel(); frameModel(); } };
function currentColor() { return selected ? selected.userData.color : 0x8a8f96; }

// click-to-select in the viewport
const ray = new THREE.Raycaster();
canvas.addEventListener('pointerdown', (e) => {
  if (gizmo.dragging) return;
  const r = canvas.getBoundingClientRect();
  const nd = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(nd, camera);
  const hit = ray.intersectObjects(model.children, false)[0];
  if (hit) selectPart(hit.object);
});

function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 1600);
}

// ================= loop =================
function loop() {
  requestAnimationFrame(loop);
  orbit.update();
  renderer.render(scene, camera);
  document.getElementById('vp-info').textContent =
    `${model.children.length} parts · ${points.children.length} points`;
}
resize();
renderItemList();
selectItem('akm');
loop();
