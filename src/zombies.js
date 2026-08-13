// ================= Zombies: sight-based detection, idle / wander / aggro AI =================
import * as THREE from 'three';
import { createHumanoid, animateHumanoid } from './character.js';
import { rollLoot } from './items.js';
import { SFX } from './audio.js';

const ZOMBIE_SKINS = [0x9aa578, 0x8f9c6e, 0xa8a082, 0x93a08a];
const ZOMBIE_CLOTHES = [0x5a544a, 0x4a4a52, 0x6a5a4a, 0x445044, 0x5c4a5a, 0x3e4a55];

const SIGHT_RANGE = 28;        // base sight distance, scaled by player visibility
const SIGHT_FOV = Math.cos(THREE.MathUtils.degToRad(55)); // ~110° cone
const HEAR_WALK = 5, HEAR_RUN = 14;
const LOSE_RANGE = 42;
const ATTACK_RANGE = 1.5;

export class Zombies {
  constructor(G) {
    this.G = G;
    this.list = [];
    this.losTimer = 0;
    for (const s of G.world.zombieSpawns) this.spawn(s.x, s.z);
  }

  spawn(x, z) {
    const skin = ZOMBIE_SKINS[Math.floor(Math.random() * ZOMBIE_SKINS.length)];
    const rig = createHumanoid({
      skin,
      shirt: ZOMBIE_CLOTHES[Math.floor(Math.random() * ZOMBIE_CLOTHES.length)],
      pants: ZOMBIE_CLOTHES[Math.floor(Math.random() * ZOMBIE_CLOTHES.length)],
      hair: 0x2a241c,
    });
    const y = this.G.world.groundHeightSimple(x, z);
    rig.group.position.set(x, y, z);
    this.G.scene.add(rig.group);
    const z0 = {
      rig,
      pos: new THREE.Vector3(x, y, z),
      home: new THREE.Vector3(x, y, z),
      yaw: Math.random() * Math.PI * 2,
      hp: 100,
      state: 'idle',            // idle | wander | aggro
      stateT: Math.random() * 4,
      target: null,             // wander destination
      speed: 0,
      attackT: null,
      attackApplied: false,
      lastSeen: 0,              // seconds since last saw player (while aggro)
      growlT: Math.random() * 8,
      dead: false,
      deadT: 0,
    };
    this.list.push(z0);
    return z0;
  }

  // gunshots / noise alert zombies within radius
  alertAt(pos, radius) {
    for (const z of this.list) {
      if (z.dead) continue;
      const d = Math.hypot(z.pos.x - pos.x, z.pos.z - pos.z);
      if (d < radius) {
        if (z.state !== 'aggro') {
          // they heard it: walk towards the sound, aggro if close
          if (d < radius * 0.5) this.setAggro(z);
          else { z.state = 'wander'; z.target = pos.clone(); z.stateT = 10; }
        }
        z.lastSeen = 0;
      }
    }
  }

  setAggro(z) {
    if (z.state !== 'aggro') {
      z.state = 'aggro';
      z.lastSeen = 0;
      SFX.zombieGrowl();
    }
  }

  damage(z, amount, fromPos) {
    if (z.dead) return;
    z.hp -= amount;
    this.setAggro(z);
    // pain stagger: brief speed cut
    z.speed *= 0.3;
    if (z.hp <= 0) this.kill(z);
    else if (fromPos) {
      // face the shooter
      z.yaw = Math.atan2(-(fromPos.x - z.pos.x), -(fromPos.z - z.pos.z));
    }
  }

  kill(z) {
    z.dead = true;
    z.deadT = 0;
    SFX.zombieHit();
    // small chance of dropped loot
    if (Math.random() < 0.35) {
      const table = Math.random() < 0.75 ? 'residential' : 'medical';
      this.G.world.spawnGroundItem(rollLoot(table), z.pos.x + 0.5, z.pos.z + 0.5);
    }
  }

  canSee(z, player) {
    const dx = player.pos.x - z.pos.x, dz = player.pos.z - z.pos.z;
    const dist = Math.hypot(dx, dz);
    // zombies see much shorter at night
    const range = SIGHT_RANGE * player.visibility() * (0.45 + 0.55 * (this.G.world.daylight ?? 1));
    if (dist > range) return false;
    // vision cone check (zombies have eyes, not radar)
    const fx = -Math.sin(z.yaw), fz = -Math.cos(z.yaw);
    const dot = (dx * fx + dz * fz) / (dist || 1);
    if (dist > 2.2 && dot < SIGHT_FOV) return false;
    // obstacles block sight
    if (this.G.world.losBlocked(z.pos.x, z.pos.z, player.pos.x, player.pos.z)) return false;
    return true;
  }

  canHear(z, player) {
    if (player.speed < 1.2) return false;
    const dist = Math.hypot(player.pos.x - z.pos.x, player.pos.z - z.pos.z);
    return dist < (player.speed > 4 ? HEAR_RUN : player.speed > 2 ? HEAR_WALK * 1.6 : HEAR_WALK);
  }

  update(dt, t) {
    const G = this.G;
    const player = G.player;
    this.losTimer -= dt;
    const doSense = this.losTimer <= 0;
    if (doSense) this.losTimer = 0.18; // sense ~5x/sec, cheap

    for (const z of this.list) {
      if (z.dead) {
        z.deadT += dt;
        animateHumanoid(z.rig, dt, { dead: true, deadT: z.deadT, zombie: true });
        continue;
      }
      const distToPlayer = Math.hypot(player.pos.x - z.pos.x, player.pos.z - z.pos.z);
      // skip far-away zombies almost entirely
      if (distToPlayer > 90) { z.rig.group.visible = distToPlayer < 160; continue; }
      z.rig.group.visible = true;

      // ---------- perception ----------
      if (doSense && !player.dead) {
        if (z.state === 'aggro') {
          if (this.canSee(z, player) || distToPlayer < 3) z.lastSeen = 0;
        } else if (this.canSee(z, player) || this.canHear(z, player)) {
          this.setAggro(z);
        }
      }

      // ---------- state machine ----------
      let targetSpeed = 0;
      let moveYaw = z.yaw;

      if (z.state === 'aggro') {
        z.lastSeen += dt;
        if (player.dead || z.lastSeen > 8 || distToPlayer > LOSE_RANGE) {
          z.state = 'wander';
          z.target = null;
          z.stateT = 4;
        } else {
          moveYaw = Math.atan2(-(player.pos.x - z.pos.x), -(player.pos.z - z.pos.z));
          if (distToPlayer > ATTACK_RANGE) {
            targetSpeed = z.lastSeen < 1.5 ? 4.6 : 2.4; // sprint on sight, shamble on memory
          }
          // attack
          if (distToPlayer < ATTACK_RANGE + 0.2 && z.attackT === null) {
            z.attackT = 0;
            z.attackApplied = false;
          }
          z.growlT -= dt;
          if (z.growlT < 0 && distToPlayer < 24) { SFX.zombieGrowl(); z.growlT = 4 + Math.random() * 6; }
        }
      } else if (z.state === 'wander') {
        z.stateT -= dt;
        if (!z.target) {
          const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 14;
          z.target = new THREE.Vector3(z.home.x + Math.cos(a) * r, 0, z.home.z + Math.sin(a) * r);
        }
        const dx = z.target.x - z.pos.x, dz = z.target.z - z.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 1 || z.stateT <= 0) {
          z.state = 'idle';
          z.stateT = 3 + Math.random() * 7;
          z.target = null;
        } else {
          moveYaw = Math.atan2(-dx, -dz);
          targetSpeed = 0.9;
        }
      } else { // idle
        z.stateT -= dt;
        if (z.stateT <= 0) {
          z.state = 'wander';
          z.stateT = 8 + Math.random() * 10;
          z.target = null;
        }
        // idle twitch: slow random turn
        z.yaw += Math.sin(t * 0.3 + z.growlT * 7) * dt * 0.15;
      }

      // ---------- attack swing ----------
      if (z.attackT !== null) {
        z.attackT += dt / 0.75;
        targetSpeed = 0;
        if (z.attackT > 0.45 && !z.attackApplied) {
          z.attackApplied = true;
          if (distToPlayer < ATTACK_RANGE + 0.5 && !player.dead) {
            const part = Math.random() < 0.2 ? 'head' : 'torso';
            player.damage(7 + Math.random() * 9, { bleedChance: 0.3, infectChance: 0.12, part });
          }
        }
        if (z.attackT >= 1) z.attackT = null;
      }

      // ---------- movement ----------
      let yd = moveYaw - z.yaw;
      while (yd > Math.PI) yd -= Math.PI * 2;
      while (yd < -Math.PI) yd += Math.PI * 2;
      z.yaw += yd * Math.min(1, dt * (z.state === 'aggro' ? 7 : 3));

      z.speed = THREE.MathUtils.lerp(z.speed, targetSpeed, Math.min(1, dt * 5));
      if (z.speed > 0.05) {
        const nx = z.pos.x - Math.sin(z.yaw) * z.speed * dt;
        const nz = z.pos.z - Math.cos(z.yaw) * z.speed * dt;
        const fixed = G.world.collide(nx, nz, 0.32, z.pos.y);
        z.pos.x = fixed.x; z.pos.z = fixed.z;
      }
      z.pos.y = G.world.groundHeightSimple(z.pos.x, z.pos.z);

      // simple zombie-zombie separation
      for (const o of this.list) {
        if (o === z || o.dead) continue;
        const dx = z.pos.x - o.pos.x, dz = z.pos.z - o.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.7 && d > 0.001) {
          z.pos.x += dx / d * (0.7 - d) * 0.5;
          z.pos.z += dz / d * (0.7 - d) * 0.5;
        }
      }

      z.rig.group.position.copy(z.pos);
      z.rig.group.rotation.y = z.yaw;
      animateHumanoid(z.rig, dt, {
        stance: 'stand',
        speed: z.speed,
        zombie: true,
        aggro: z.state === 'aggro' && z.speed > 1.5,
        attackT: z.attackT,
      });
    }
  }

  countAlive() { return this.list.filter((z) => !z.dead).length; }
}
