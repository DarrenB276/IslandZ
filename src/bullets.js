// ================= Ballistic projectiles: travel time, drop, per-hit resolution =================
import * as THREE from 'three';

const GRAV = 9.8;

export class Bullets {
  constructor(G) {
    this.G = G;
    this.list = [];
  }

  // origin/dir in world space; opts: { dmg, vel (m/s), drop (0-1 gravity scale) }
  spawn(origin, dir, opts) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0xffe9a0, transparent: true, opacity: 0.9 }));
    line.frustumCulled = false;
    this.G.scene.add(line);
    this.list.push({
      pos: origin.clone(),
      vel: dir.clone().multiplyScalar(opts.vel),
      dmg: opts.dmg,
      drop: opts.drop ?? 1,
      ttl: 2.2,
      line,
      pa: line.geometry.attributes.position,
    });
  }

  update(dt) {
    const G = this.G;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      b.ttl -= dt;
      const from = b.pos.clone();
      b.vel.y -= GRAV * b.drop * dt;
      const step = b.vel.clone().multiplyScalar(dt);
      const dist = step.length();
      b.pos.add(step);

      let hit = null, hitT = dist, hitZ = null, head = false;
      const dir = step.clone().normalize();

      // zombies along this segment (head + chest spheres)
      for (const z of G.zombies.list) {
        if (z.dead) continue;
        if (Math.abs(z.pos.x - from.x) > 60 && Math.abs(z.pos.z - from.z) > 60) continue;
        for (const [off, r, isHead] of [[1.55, 0.24, true], [1.05, 0.4, false]]) {
          const c = new THREE.Vector3(z.pos.x, z.pos.y + off, z.pos.z).sub(from);
          const t = c.dot(dir);
          if (t < 0 || t > hitT) continue;
          if (c.lengthSq() - t * t < r * r) { hitT = t; hitZ = z; head = isHead; hit = from.clone().addScaledVector(dir, t); }
        }
      }
      // walls
      if (G.world.losBlocked(from.x, from.z, b.pos.x, b.pos.z)) {
        let lo = 0, hi = dist;
        for (let k = 0; k < 7; k++) {
          const mid = (lo + hi) / 2;
          const p = from.clone().addScaledVector(dir, mid);
          if (G.world.losBlocked(from.x, from.z, p.x, p.z)) hi = mid; else lo = mid;
        }
        if (lo < hitT) { hitT = lo; hitZ = null; hit = from.clone().addScaledVector(dir, lo); }
      }
      // terrain
      if (b.pos.y < G.world.groundHeightSimple(b.pos.x, b.pos.z)) {
        const gh = G.world.groundHeightSimple(b.pos.x, b.pos.z);
        if (from.y >= G.world.groundHeightSimple(from.x, from.z)) {
          hit = b.pos.clone(); hit.y = gh; hitZ = null;
        }
      }

      if (hitZ) {
        G.world.addBloodPuff(hit);
        G.zombies.damage(hitZ, b.dmg * (head ? 2.6 : 1), G.player.pos);
        G.hud.hitmarker(hitZ.hp <= 0);
        this.remove(i, b, hit);
        continue;
      }
      if (hit) { this.remove(i, b, hit); continue; }
      if (b.ttl <= 0) { this.remove(i, b); continue; }

      // draw a short tracer streak behind the bullet
      const tail = b.pos.clone().addScaledVector(dir, -Math.min(6, dist * 4 + 2));
      b.pa.setXYZ(0, tail.x, tail.y, tail.z);
      b.pa.setXYZ(1, b.pos.x, b.pos.y, b.pos.z);
      b.pa.needsUpdate = true;
    }
  }

  remove(i, b, impact) {
    if (impact) this.G.world.addBloodPuff ? null : null;
    this.G.scene.remove(b.line);
    b.line.geometry.dispose();
    this.list.splice(i, 1);
  }
}
