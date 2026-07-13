// ================= World: terrain, town, props, colliders, ground items, FX =================
import * as THREE from 'three';
import { rollLoot, makeItem } from './items.js';

const SIZE = 440;

// deterministic-ish gentle terrain
export function terrainHeight(x, z) {
  let h = 1.8 * Math.sin(x * 0.021) * Math.cos(z * 0.017)
    + 1.1 * Math.sin(x * 0.043 + 1.7) * Math.cos(z * 0.037 + 0.4)
    + 0.5 * Math.sin(x * 0.09 + 4.1) * Math.sin(z * 0.11 + 2.2);
  // flatten the town plateau
  const d = Math.hypot(x, z);
  const flat = THREE.MathUtils.smoothstep(d, 26, 60);
  return h * flat;
}

const CAT_COLORS = {
  weapon: 0x4a5560, melee: 0x6e5a44, ammo: 0x8a7d3a, food: 0x6f8a3a,
  drink: 0x3a7a8a, medical: 0xa04848, clothing: 0x5a6e5a, utility: 0x6a5f7a,
};

const emojiTexCache = new Map();
function emojiSprite(icon) {
  let tex = emojiTexCache.get(icon);
  if (!tex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    ctx.font = '48px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, 32, 36);
    tex = new THREE.CanvasTexture(c);
    emojiTexCache.set(icon, tex);
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sp.scale.setScalar(0.5);
  return sp;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];   // {type:'circle',x,z,r} | {type:'box',minX,maxX,minZ,maxZ,top?,climb?}
    this.groundItems = [];
    this.tracers = [];
    this.flashes = [];
    this.lootSpots = [];
    this.zombieSpawns = [];
    this.playerSpawn = new THREE.Vector3(70, 0, 85);

    this.buildSky();
    this.buildTerrain();
    this.buildTown();
    this.buildForest();
    this.spawnLoot();
  }

  // ---------- environment ----------
  buildSky() {
    this.scene.background = new THREE.Color(0x9fb8c8);
    this.scene.fog = new THREE.Fog(0x9fb8c8, 60, 260);
    const hemi = new THREE.HemisphereLight(0xcfe5ee, 0x4a5a40, 0.85);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d8, 1.5);
    sun.position.set(60, 90, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -55; sun.shadow.camera.right = 55;
    sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55;
    sun.shadow.camera.far = 300;
    sun.shadow.bias = -0.0008;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
  }

  buildTerrain() {
    const seg = 110;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = [];
    const grass = new THREE.Color(0x5f7a3d), grass2 = new THREE.Color(0x6d8a46),
      dirt = new THREE.Color(0x7a6a4a);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, h);
      const n = Math.sin(x * 0.31 + z * 0.17) * Math.sin(x * 0.05 - z * 0.11);
      const c = h > 2.2 ? dirt.clone().lerp(grass, 0.5) : (n > 0.25 ? grass2 : grass);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    // roads through town
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x55534d });
    for (const [w, d, rot] of [[7, 120, 0], [7, 100, Math.PI / 2]]) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
      r.rotation.x = -Math.PI / 2;
      r.rotation.z = rot;
      r.position.y = 0.04;
      r.receiveShadow = true;
      this.scene.add(r);
    }
    // pond
    const pond = new THREE.Mesh(new THREE.CircleGeometry(9, 14),
      new THREE.MeshLambertMaterial({ color: 0x39697a }));
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(46, 0.06, -30);
    this.scene.add(pond);
    this.pond = { x: 46, z: -30, r: 9 };
  }

  // ---------- structures ----------
  addBoxCollider(minX, maxX, minZ, maxZ, top, climb) {
    this.colliders.push({ type: 'box', minX, maxX, minZ, maxZ, top, climb });
  }

  wall(x, z, w, d, h, color, yBase = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, yBase + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.scene.add(m);
    this.addBoxCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    return m;
  }

  house(cx, cz, w, d, color, roofColor, lootTable, rot = 0) {
    const g = new THREE.Group();
    g.position.set(cx, terrainHeight(cx, cz), cz);
    g.rotation.y = rot;
    this.scene.add(g);
    const H = 2.7, T = 0.22;
    const mat = new THREE.MeshLambertMaterial({ color });
    const mk = (bw, bh, bd, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
      m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
      // world-space collider (only supports rot multiples of 90°)
      const cos = Math.round(Math.cos(rot)), sin = Math.round(Math.sin(rot));
      const wx = cx + x * cos + z * sin, wz = cz - x * sin + z * cos;
      const ww = Math.abs(bw * cos) + Math.abs(bd * sin), wd = Math.abs(bw * sin) + Math.abs(bd * cos);
      this.addBoxCollider(wx - ww / 2, wx + ww / 2, wz - wd / 2, wz + wd / 2);
      return m;
    };
    // floor (no collider)
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d),
      new THREE.MeshLambertMaterial({ color: 0x6a5a44 }));
    floor.position.y = 0.06;
    floor.receiveShadow = true;
    g.add(floor);
    // back + side walls
    mk(w, H, T, 0, H / 2, -d / 2);
    mk(T, H, d, -w / 2, H / 2, 0);
    mk(T, H, d, w / 2, H / 2, 0);
    // front wall with door gap
    const doorW = 1.5, seg = (w - doorW) / 2;
    mk(seg, H, T, -(doorW / 2 + seg / 2), H / 2, d / 2);
    mk(seg, H, T, doorW / 2 + seg / 2, H / 2, d / 2);
    mk(doorW, 0.7, T, 0, H - 0.35, d / 2); // lintel above door
    // gable roof: two slabs
    const roofMat = new THREE.MeshLambertMaterial({ color: roofColor });
    const slope = Math.atan2(1.1, w / 2);
    const slabLen = Math.hypot(1.1, w / 2) + 0.3;
    for (const side of [-1, 1]) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(slabLen, 0.1, d + 0.5), roofMat);
      slab.position.set(side * w / 4, H + 0.52, 0);
      slab.rotation.z = -side * slope;
      slab.castShadow = true;
      g.add(slab);
    }
    // loot spots inside
    const cos = Math.round(Math.cos(rot)), sin = Math.round(Math.sin(rot));
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const lx = (Math.random() - 0.5) * (w - 1.4), lz = (Math.random() - 0.5) * (d - 1.4);
      this.lootSpots.push({ x: cx + lx * cos + lz * sin, z: cz - lx * sin + lz * cos, table: lootTable });
    }
    this.zombieSpawns.push({ x: cx + (Math.random() - 0.5) * 14, z: cz + d / 2 + 3 + Math.random() * 6 });
  }

  crate(x, z, s = 1, color = 0x5a6a3c) {
    const h = 0.9 * s;
    const y = terrainHeight(x, z);
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.4 * s, h, 1.4 * s), new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, y + h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    this.scene.add(m);
    this.addBoxCollider(x - 0.7 * s, x + 0.7 * s, z - 0.7 * s, z + 0.7 * s, y + h, true);
  }

  buildTown() {
    const R = 0x7a4438, Rr = 0x5a4a3c;
    // residential row
    this.house(-16, 14, 8, 7, 0xa89880, R, 'residential');
    this.house(16, 16, 9, 7, 0x8f9a8a, Rr, 'residential');
    this.house(-15, -16, 8, 8, 0x9a8a78, R, 'residential', Math.PI);
    this.house(18, -14, 8, 7, 0xa8a090, Rr, 'residential', Math.PI);
    this.house(-30, 2, 7, 8, 0x93a08c, R, 'residential', Math.PI / 2);
    this.house(30, -2, 7, 8, 0xa09078, Rr, 'residential', -Math.PI / 2);
    // medical clinic
    this.house(0, 30, 10, 8, 0xc8ccc8, 0x8a3a34, 'medical');
    // hunting cabin, out in the woods
    this.house(-88, -70, 7, 6, 0x6e5a40, 0x4a3c30, 'hunting');
    this.house(95, 60, 7, 6, 0x6e5a40, 0x4a3c30, 'hunting');

    // military camp NW
    const mx = -60, mz = -55;
    for (let i = 0; i < 3; i++) {
      const tx = mx + i * 9, tz = mz;
      const tent = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 6, 3, 1),
        new THREE.MeshLambertMaterial({ color: 0x4a563e, flatShading: true }));
      tent.rotation.z = Math.PI / 2;
      tent.rotation.y = Math.PI / 2;
      tent.position.set(tx, terrainHeight(tx, tz) + 1.15, tz);
      tent.castShadow = true;
      this.scene.add(tent);
      this.addBoxCollider(tx - 1.9, tx + 1.9, tz - 2.9, tz + 2.9);
      for (let j = 0; j < 3; j++) {
        this.lootSpots.push({ x: tx + (Math.random() - 0.5) * 2, z: tz + 3.6 + Math.random() * 2, table: 'military' });
      }
      this.zombieSpawns.push({ x: tx + 4, z: tz + 8 });
    }
    this.crate(mx + 4, mz + 8, 1, 0x4a563e);
    this.crate(mx + 12, mz + 7, 1.2, 0x4a563e);
    this.lootSpots.push({ x: mx + 5.5, z: mz + 8, table: 'military' });
    this.lootSpots.push({ x: mx + 13.5, z: mz + 7, table: 'military' });

    // scattered town props: crates & low walls (climbable)
    this.crate(6, 6, 1, 0x6a5a44);
    this.crate(-7, -5, 1.1, 0x74644c);
    this.crate(24, 6, 0.9);
    const lw = this.wall(0, -8, 8, 0.4, 1.1, 0x8a8478);
    this.colliders[this.colliders.length - 1].top = terrainHeight(0, -8) + 1.1;
    this.colliders[this.colliders.length - 1].climb = true;
    lw.receiveShadow = true;

    // town zombie spawns
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 30;
      this.zombieSpawns.push({ x: Math.cos(a) * r, z: Math.sin(a) * r });
    }
    // loot spot near pond (murky water)
    this.lootSpots.push({ x: this.pond.x + 10, z: this.pond.z, table: 'residential' });
  }

  buildForest() {
    const pineGeo = new THREE.ConeGeometry(1.6, 4.4, 6);
    const pineMat = new THREE.MeshLambertMaterial({ color: 0x3d5a33, flatShading: true });
    const pineMat2 = new THREE.MeshLambertMaterial({ color: 0x48663a, flatShading: true });
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.3, 1.6, 5);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a4632 });
    const blobGeo = new THREE.IcosahedronGeometry(1.7, 0);
    const blobMat = new THREE.MeshLambertMaterial({ color: 0x5c7a3a, flatShading: true });
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x7d7f78, flatShading: true });

    for (let i = 0; i < 260; i++) {
      const x = (Math.random() - 0.5) * (SIZE - 30);
      const z = (Math.random() - 0.5) * (SIZE - 30);
      if (Math.hypot(x, z) < 42) continue;                       // keep town clear
      if (Math.hypot(x - 46, z + 30) < 13) continue;             // pond
      if (Math.hypot(x + 60, z + 55) < 18) continue;             // military camp
      if (Math.hypot(x + 88, z + 70) < 8 || Math.hypot(x - 95, z - 60) < 8) continue; // cabins
      const y = terrainHeight(x, z);
      const s = 0.7 + Math.random() * 0.9;
      const kind = Math.random();
      if (kind < 0.62) {
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(x, y + 0.8 * s, z);
        trunk.scale.setScalar(s);
        const top = new THREE.Mesh(pineGeo, Math.random() < 0.5 ? pineMat : pineMat2);
        top.position.set(x, y + (1.6 + 2.2) * s, z);
        top.scale.setScalar(s);
        top.castShadow = true;
        this.scene.add(trunk, top);
        this.colliders.push({ type: 'circle', x, z, r: 0.35 * s });
      } else if (kind < 0.85) {
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(x, y + 0.8 * s, z);
        trunk.scale.set(s * 1.2, s * 1.3, s * 1.2);
        const blob = new THREE.Mesh(blobGeo, blobMat);
        blob.position.set(x, y + 2.6 * s, z);
        blob.scale.setScalar(s);
        blob.castShadow = true;
        this.scene.add(trunk, blob);
        this.colliders.push({ type: 'circle', x, z, r: 0.4 * s });
      } else {
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.position.set(x, y + 0.3 * s, z);
        rock.scale.set(s, s * 0.7, s);
        rock.rotation.y = Math.random() * 3;
        rock.castShadow = true; rock.receiveShadow = true;
        this.scene.add(rock);
        this.colliders.push({ type: 'circle', x, z, r: 0.8 * s });
      }
      // rural zombies, sparse
      if (i % 34 === 0) this.zombieSpawns.push({ x: x + 3, z: z + 3 });
    }
  }

  spawnLoot() {
    for (const spot of this.lootSpots) {
      if (Math.random() < 0.8) this.spawnGroundItem(rollLoot(spot.table), spot.x, spot.z);
    }
    // guaranteed starter gear near spawn
    const sp = this.playerSpawn;
    this.spawnGroundItem(makeItem('mp5'), sp.x + 2, sp.z + 1.5);
    this.spawnGroundItem(makeItem('ammo_9mm'), sp.x + 2.8, sp.z + 1.2);
    this.spawnGroundItem(makeItem('water_bottle'), sp.x + 1.5, sp.z + 2.6);
    this.spawnGroundItem(makeItem('beans'), sp.x + 3.2, sp.z + 2.2);
    this.spawnGroundItem(makeItem('machete'), sp.x + 1, sp.z + 3.4);
  }

  // ---------- ground items ----------
  spawnGroundItem(inst, x, z) {
    const y = this.groundHeightSimple(x, z);
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.34),
      new THREE.MeshLambertMaterial({ color: CAT_COLORS[inst.def.cat] ?? 0x777777 }));
    base.position.y = 0.08;
    base.castShadow = true;
    g.add(base);
    const sp = emojiSprite(inst.def.icon);
    sp.position.y = 0.45;
    g.add(sp);
    g.position.set(x, y, z);
    this.scene.add(g);
    const gi = { inst, mesh: g, x, z, y, bob: Math.random() * 6 };
    this.groundItems.push(gi);
    return gi;
  }

  removeGroundItem(gi) {
    const i = this.groundItems.indexOf(gi);
    if (i >= 0) this.groundItems.splice(i, 1);
    this.scene.remove(gi.mesh);
  }

  itemsNear(pos, r) {
    const out = [];
    for (const gi of this.groundItems) {
      const d = Math.hypot(gi.x - pos.x, gi.z - pos.z);
      if (d < r) out.push({ gi, d });
    }
    out.sort((a, b) => a.d - b.d);
    return out;
  }

  // ---------- physics helpers ----------
  groundHeightSimple(x, z) { return terrainHeight(x, z); }

  // ground height including standable box tops (only if currently above them)
  groundHeight(x, z, curY = 999) {
    let h = terrainHeight(x, z);
    for (const c of this.colliders) {
      if (c.type === 'box' && c.top != null &&
        x > c.minX - 0.2 && x < c.maxX + 0.2 && z > c.minZ - 0.2 && z < c.maxZ + 0.2 &&
        curY > c.top - 0.35 && c.top > h) h = c.top;
    }
    return h;
  }

  // push a 2D position out of colliders. Returns corrected {x,z}
  collide(x, z, r, y = 0) {
    for (const c of this.colliders) {
      if (c.type === 'circle') {
        const dx = x - c.x, dz = z - c.z;
        const d = Math.hypot(dx, dz), min = c.r + r;
        if (d < min && d > 0.0001) { x = c.x + dx / d * min; z = c.z + dz / d * min; }
      } else {
        if (c.top != null && y > c.top - 0.3) continue; // standing on top of it
        const nx = Math.max(c.minX, Math.min(c.maxX, x));
        const nz = Math.max(c.minZ, Math.min(c.maxZ, z));
        const dx = x - nx, dz = z - nz;
        const d = Math.hypot(dx, dz);
        if (d < r) {
          if (d > 0.0001) { x = nx + dx / d * r; z = nz + dz / d * r; }
          else {
            // inside the box: push out the nearest face
            const pl = x - c.minX, pr = c.maxX - x, pt = z - c.minZ, pb = c.maxZ - z;
            const m = Math.min(pl, pr, pt, pb);
            if (m === pl) x = c.minX - r; else if (m === pr) x = c.maxX + r;
            else if (m === pt) z = c.minZ - r; else z = c.maxZ + r;
          }
        }
      }
    }
    const half = SIZE / 2 - 4;
    x = Math.max(-half, Math.min(half, x));
    z = Math.max(-half, Math.min(half, z));
    return { x, z };
  }

  // 2D line-of-sight between two points (ignores height, checks walls & trunks)
  losBlocked(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) return false;
    for (const c of this.colliders) {
      if (c.type === 'circle') {
        if (c.r < 0.5) continue; // thin trunks don't block sight
        const t = Math.max(0, Math.min(1, ((c.x - ax) * dx + (c.z - az) * dz) / (len * len)));
        const px = ax + t * dx, pz = az + t * dz;
        if (Math.hypot(px - c.x, pz - c.z) < c.r) return true;
      } else {
        if (c.climb) continue; // low objects don't block sight
        // segment vs AABB (slab test)
        let tmin = 0, tmax = 1;
        if (Math.abs(dx) < 1e-6) { if (ax < c.minX || ax > c.maxX) continue; }
        else {
          let t1 = (c.minX - ax) / dx, t2 = (c.maxX - ax) / dx;
          if (t1 > t2) [t1, t2] = [t2, t1];
          tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        }
        if (Math.abs(dz) < 1e-6) { if (az < c.minZ || az > c.maxZ) continue; }
        else {
          let t1 = (c.minZ - az) / dz, t2 = (c.maxZ - az) / dz;
          if (t1 > t2) [t1, t2] = [t2, t1];
          tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        }
        if (tmin <= tmax) return true;
      }
    }
    return false;
  }

  // low climbable box directly ahead → its top height, or null
  climbableAt(x, z, yaw, y) {
    const fx = x - Math.sin(yaw) * 0.9, fz = z - Math.cos(yaw) * 0.9;
    for (const c of this.colliders) {
      if (c.type !== 'box' || !c.climb || c.top == null) continue;
      if (fx > c.minX - 0.3 && fx < c.maxX + 0.3 && fz > c.minZ - 0.3 && fz < c.maxZ + 0.3) {
        if (c.top - y > 0.4 && c.top - y < 1.7) return { top: c.top, x: fx, z: fz };
      }
    }
    return null;
  }

  // ---------- combat FX ----------
  addTracer(a, b) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0xffe9a0, transparent: true, opacity: 0.9,
    }));
    this.scene.add(line);
    this.tracers.push({ line, ttl: 0.07 });
  }

  addFlash(pos) {
    const light = new THREE.PointLight(0xffcc66, 6, 7);
    light.position.copy(pos);
    this.scene.add(light);
    this.flashes.push({ light, ttl: 0.05 });
  }

  addBloodPuff(pos) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x8a1a10, transparent: true, opacity: 0.85 }));
    sp.position.copy(pos);
    sp.scale.setScalar(0.25);
    this.scene.add(sp);
    this.flashes.push({ sprite: sp, ttl: 0.3, grow: 2.2 });
  }

  update(dt, t, playerPos) {
    // sun shadow follows player
    this.sun.position.set(playerPos.x + 60, 90, playerPos.z + 40);
    this.sun.target.position.set(playerPos.x, 0, playerPos.z);
    // item bobbing (only near player to save cycles)
    for (const gi of this.groundItems) {
      if (Math.abs(gi.x - playerPos.x) < 30 && Math.abs(gi.z - playerPos.z) < 30) {
        gi.mesh.children[1].position.y = 0.45 + Math.sin(t * 2 + gi.bob) * 0.05;
        gi.mesh.rotation.y = t * 0.5 + gi.bob;
      }
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.ttl -= dt;
      if (tr.ttl <= 0) { this.scene.remove(tr.line); tr.line.geometry.dispose(); this.tracers.splice(i, 1); }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.ttl -= dt;
      if (f.sprite && f.grow) { f.sprite.scale.multiplyScalar(1 + dt * f.grow * 6); f.sprite.material.opacity = f.ttl / 0.3; }
      if (f.ttl <= 0) {
        if (f.light) this.scene.remove(f.light);
        if (f.sprite) this.scene.remove(f.sprite);
        this.flashes.splice(i, 1);
      }
    }
  }
}
