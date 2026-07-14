// ================= Player: movement, stats, effects, combat, equipment =================
import * as THREE from 'three';
import { createHumanoid, animateHumanoid, createWeaponMesh, attachWeapon,
  setClothingColors, setHeadgear, setMask, setVest, setBackpack } from './character.js';
import { makeItem, ITEMS, attachmentFits } from './items.js';
import { SFX } from './audio.js';

const SPEEDS = { prone: 0.7, crouch: 1.4, walk: 1.8, jog: 3.4, run: 5.6 };

export class Player {
  constructor(G) {
    this.G = G;
    this.rig = createHumanoid({ shirt: 0x8a8f96, pants: 0x3d4c66 });
    G.scene.add(this.rig.group);

    this.pos = G.world.playerSpawn.clone();
    this.pos.y = G.world.groundHeight(this.pos.x, this.pos.z);
    this.yaw = 0;
    this.vy = 0;
    this.grounded = true;
    this.stance = 'stand';           // stand | crouch | prone
    this.moveState = 'idle';         // idle walk jog run crouch prone jump climb
    this.speed = 0;
    this.climbT = -1;                // >=0 while climbing
    this.dead = false;
    this.deadT = 0;
    this.deathCause = '';

    // ---- stats ----
    this.hp = 100;
    this.blood = 5000;
    this.food = 85;
    this.water = 85;
    this.stamina = 100;
    this.temp = 36.6;

    // ---- effects ----
    this.wounds = 0;                 // bleeding cuts
    this.woundDirty = false;
    this.woundTimer = 0;
    this.cholera = false;
    this.infection = false;
    this.fever = false;
    this.feverTimer = 0;
    this.adrenaline = 0;             // seconds left
    this.painkiller = 0;

    // ---- equipment ----
    this.equipment = { head: null, mask: null, top: null, vest: null, gloves: null,
      belt: null, pants: null, back: null, hands: null, shoulder: null };
    this.quickslots = new Array(10).fill(null); // item uids

    // ---- weapon state ----
    this.fireCooldown = 0;
    this.reloading = 0;
    this.attackT = null;             // melee swing progress
    this.attackApplied = false;
    this.triggerHeld = false;
    this.recoil = 0;

    // starting clothes
    this.equip(makeItem('tshirt'), true);
    this.equip(makeItem('jeans'), true);
    this.applyLook();
  }

  // ================= equipment =================
  containers() {
    const out = [];
    for (const slot of ['back', 'vest', 'top', 'pants', 'belt']) {
      const it = this.equipment[slot];
      if (it && it.def.cap) {
        if (!it.grid) it.grid = { cols: it.def.cap[0], rows: it.def.cap[1], items: [] };
        out.push({ label: it.def.name, slotName: slot, owner: it, grid: it.grid });
      }
    }
    return out;
  }

  equip(inst, silent) {
    const d = inst.def;
    let slot = null;
    if (d.cat === 'clothing') slot = d.slot;
    else if (d.cat === 'weapon' || d.cat === 'melee') slot = 'hands';
    if (!slot) return null;
    const prev = this.equipment[slot];
    this.equipment[slot] = inst;
    this.applyLook();
    if (!silent) SFX.equip();
    return prev ?? null;
  }

  unequip(slot) {
    const it = this.equipment[slot];
    this.equipment[slot] = null;
    this.applyLook();
    return it;
  }

  armorFor(part) {
    let a = 0;
    if (part === 'head' && this.equipment.head?.def.armor) a = this.equipment.head.def.armor;
    if (part === 'torso' && this.equipment.vest?.def.armor) a = this.equipment.vest.def.armor;
    return a;
  }

  applyLook() {
    const e = this.equipment;
    setClothingColors(this.rig, {
      top: e.top?.def.color ?? 0xc8b8a0,      // skin-ish undershirt if topless
      pants: e.pants?.def.color ?? 0x777069,
      gloves: e.gloves?.def.color,
    });
    setHeadgear(this.rig, e.head?.def);
    setMask(this.rig, e.mask?.def);
    setVest(this.rig, e.vest?.def);
    setBackpack(this.rig, e.back?.def);
    const w = e.hands;
    if (w) attachWeapon(this.rig, createWeaponMesh(w.def.id, w.attachments), w.def.cat === 'weapon');
    else attachWeapon(this.rig, null, false);
    this.G.hud?.refreshWeapon();
    this.G.onWeaponVisualChanged?.();
  }

  get weapon() { return this.equipment.hands; }

  // ---- attachment-aware weapon stats ----
  weaponMag(w) {
    const magId = w.attachments?.mag;
    return Math.round(w.def.mag * (magId ? ITEMS[magId].magMul : 1));
  }
  weaponZoom(w) {
    const o = w.attachments?.optic;
    return o ? ITEMS[o].zoom : w.def.zoom;
  }
  weaponScoped(w) {
    const o = w.attachments?.optic;
    return !!(w.def.scoped || (o && ITEMS[o].scoped));
  }

  // attach an attachment item to a weapon (the item instance is consumed)
  attachTo(weapon, attInst) {
    if (!attachmentFits(attInst.def, weapon.def)) return false;
    if (!weapon.attachments) weapon.attachments = { optic: null, under: null, mag: null };
    const slot = attInst.def.atype;
    const prev = weapon.attachments[slot];
    weapon.attachments[slot] = attInst.def.id;
    if (prev) this.G.inventory.stashOrDrop(makeItem(prev));
    if (this.equipment.hands === weapon) this.applyLook();
    SFX.equip();
    return true;
  }

  detachFrom(weapon, slot) {
    const id = weapon.attachments?.[slot];
    if (!id) return;
    weapon.attachments[slot] = null;
    this.G.inventory.stashOrDrop(makeItem(id));
    if (this.equipment.hands === weapon) this.applyLook();
    SFX.equip();
  }

  // find an item anywhere on the character (pockets, hands, shoulder, worn)
  findItemByUid(uid) {
    for (const c of this.containers()) {
      for (const it of c.grid.items) if (it.uid === uid) return { inst: it, grid: c.grid };
    }
    for (const [slot, it] of Object.entries(this.equipment)) {
      if (it && it.uid === uid) return { inst: it, slot };
    }
    return null;
  }

  // ---- quickslots ----
  assignQuickslot(i, inst) {
    // one slot per item: clear duplicates first
    for (let k = 0; k < this.quickslots.length; k++) {
      if (this.quickslots[k] === inst.uid) this.quickslots[k] = null;
    }
    this.quickslots[i] = inst.uid;
    this.G.hud.renderQuickslots(true);
  }

  quickUse(i) {
    if (this.dead) return;
    const uid = this.quickslots[i];
    if (!uid) return;
    const found = this.findItemByUid(uid);
    if (!found) { this.quickslots[i] = null; this.G.hud.renderQuickslots(true); return; }
    const { inst, grid, slot } = found;
    const d = inst.def;
    const inv = this.G.inventory;

    const takeOut = () => {
      if (grid) { const k = grid.items.indexOf(inst); if (k >= 0) grid.items.splice(k, 1); }
      else if (slot) this.equipment[slot] = null;
    };

    if (d.cat === 'weapon' || d.cat === 'melee') {
      if (this.equipment.hands === inst) {
        // tapping the held weapon lowers it
        this.equipment.hands = null;
        if (d.long && !this.equipment.shoulder) this.equipment.shoulder = inst;
        else if (!inv.autoStash(inst)) inv.dropAtFeet(inst);
        this.applyLook();
      } else {
        takeOut();
        const prev = this.equip(inst);
        if (prev) inv.stashOrDrop(prev);
      }
    } else if (d.cat === 'food' || d.cat === 'drink') {
      const gone = this.consume(inst);
      if (gone) { takeOut(); this.quickslots[i] = null; }
    } else if (d.cat === 'medical') {
      const gone = this.useMedical(inst);
      if (gone) { takeOut(); this.quickslots[i] = null; }
    } else if (d.cat === 'clothing') {
      takeOut();
      const prev = this.equip(inst);
      if (prev) inv.stashOrDrop(prev);
    } else return;

    this.G.hud.refreshWeapon();
    if (inv.isOpen) inv.render();
  }

  swapWeapon() {
    if (this.reloading > 0 || this.climbT >= 0) return;
    const h = this.equipment.hands, s = this.equipment.shoulder;
    // long guns only on shoulder; knives swap too if shoulder empty
    if (h && !h.def.long && s) return; // can't shoulder a knife while occupied
    this.equipment.hands = s;
    this.equipment.shoulder = h;
    this.applyLook();
    SFX.equip();
  }

  // ================= combat =================
  pullTrigger() {
    if (this.dead || this.climbT >= 0 || this.reloading > 0) return;
    const w = this.weapon;
    if (w && w.def.cat === 'weapon') this.tryShoot();
    else this.tryMelee();
  }

  tryShoot() {
    const w = this.weapon;
    if (this.fireCooldown > 0) return;
    if (!w.def.auto && this.triggerHeld) return;   // semi: need release
    this.triggerHeld = true;
    if ((w.loaded ?? 0) <= 0) { SFX.dryFire(); this.fireCooldown = 0.3; return; }
    w.loaded--;
    this.fireCooldown = 60 / w.def.rpm;

    const G = this.G;
    const kind = w.def.pellets ? 'shotgun' : (w.def.scoped ? 'sniper' : 'rifle');
    SFX.shot(kind);
    G.zombies.alertAt(this.pos, w.def.noise);

    // muzzle world position
    const muzzle = this.pos.clone();
    muzzle.y += this.stance === 'prone' ? 0.45 : this.stance === 'crouch' ? 1.1 : 1.45;
    G.world.addFlash(muzzle.clone().add(new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).multiplyScalar(0.8)));

    // fire direction from camera
    const dir = new THREE.Vector3();
    G.camera.getWorldDirection(dir);
    const shots = w.def.pellets ?? 1;
    let spread = w.def.spread * (G.controls.aim ? 1 : 2.6);
    const under = w.attachments?.under ? ITEMS[w.attachments.under] : null;
    if (under?.spreadMul) spread *= under.spreadMul;
    if (under?.hipSpreadMul && !G.controls.aim) spread *= under.hipSpreadMul;
    if (this.stance === 'crouch') spread *= 0.75;
    if (this.stance === 'prone') spread *= 0.55;
    if (this.speed > 0.5) spread *= 1.6;
    if (this.painkiller > 0) spread *= 0.7;

    for (let i = 0; i < shots; i++) {
      const d = dir.clone();
      d.x += (Math.random() - 0.5) * spread * 2;
      d.y += (Math.random() - 0.5) * spread * 2;
      d.z += (Math.random() - 0.5) * spread * 2;
      d.normalize();
      this.fireRay(muzzle, d, w.def.dmg);
    }
    this.recoil = Math.min(0.6, this.recoil + (kind === 'shotgun' ? 0.3 : kind === 'sniper' ? 0.45 : 0.09));
    G.hud.refreshWeapon();
  }

  fireRay(origin, dir, dmg) {
    const G = this.G;
    const RANGE = 240;
    let bestT = RANGE, bestZ = null, bestHead = false;

    for (const z of G.zombies.list) {
      if (z.dead) continue;
      // head + chest spheres
      for (const [off, r, isHead] of [[1.55, 0.22, true], [1.05, 0.38, false]]) {
        const c = new THREE.Vector3(z.pos.x, z.pos.y + off, z.pos.z);
        const oc = c.sub(origin);
        const t = oc.dot(dir);
        if (t < 0 || t > bestT) continue;
        const perp2 = oc.lengthSq() - t * t;
        if (perp2 < r * r) { bestT = t; bestZ = z; bestHead = isHead; }
      }
    }
    // wall check: does the shot hit a wall before the zombie / max range?
    const end = origin.clone().addScaledVector(dir, bestT);
    if (G.world.losBlocked(origin.x, origin.z, end.x, end.z)) {
      // approximate: find blocked point by stepping
      let lo = 0, hi = bestT;
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        const p = origin.clone().addScaledVector(dir, mid);
        if (G.world.losBlocked(origin.x, origin.z, p.x, p.z)) hi = mid; else lo = mid;
      }
      bestT = lo;
      bestZ = null;
    }
    const hitPoint = origin.clone().addScaledVector(dir, bestT);
    if (hitPoint.y < G.world.groundHeightSimple(hitPoint.x, hitPoint.z)) {
      // hit terrain — shorten (cheap fix, fine visually)
      hitPoint.y = G.world.groundHeightSimple(hitPoint.x, hitPoint.z);
      bestZ = null;
    }
    G.world.addTracer(origin.clone().addScaledVector(dir, 0.9), hitPoint);
    if (bestZ) {
      G.world.addBloodPuff(hitPoint);
      const mult = bestHead ? 2.6 : 1;
      G.zombies.damage(bestZ, dmg * mult, this.pos);
      G.hud.hitmarker(bestZ.hp <= 0);
      SFX.hitFlesh();
    }
  }

  tryMelee() {
    if (this.attackT !== null || this.fireCooldown > 0) return;
    const w = this.weapon;
    const rate = w?.def.rate ?? 2.0;
    this.attackT = 0;
    this.attackApplied = false;
    this.attackDur = 1 / rate * 0.6;
    this.fireCooldown = 1 / rate;
    SFX.melee();
    this.G.zombies.alertAt(this.pos, 6);
  }

  applyMeleeHit() {
    const G = this.G;
    const w = this.weapon;
    const dmg = w?.def.dmg ?? 9;
    const range = w?.def.range ?? 1.3;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    let best = null, bestD = range + 0.4;
    for (const z of G.zombies.list) {
      if (z.dead) continue;
      const to = new THREE.Vector3(z.pos.x - this.pos.x, 0, z.pos.z - this.pos.z);
      const d = to.length();
      if (d > bestD) continue;
      to.normalize();
      if (to.dot(fwd) > 0.45) { best = z; bestD = d; }
    }
    if (best) {
      G.world.addBloodPuff(new THREE.Vector3(best.pos.x, best.pos.y + 1.2, best.pos.z));
      G.zombies.damage(best, dmg, this.pos);
      G.hud.hitmarker(best.hp <= 0);
      SFX.hitFlesh();
    }
  }

  reload() {
    const w = this.weapon;
    if (!w || w.def.cat !== 'weapon' || this.reloading > 0 || this.dead) return;
    const need = this.weaponMag(w) - (w.loaded ?? 0);
    if (need <= 0) return;
    // find ammo across containers
    let available = 0;
    const stacks = [];
    for (const c of this.containers()) {
      for (const it of c.grid.items) {
        if (it.def.id === w.def.ammo) { stacks.push({ it, grid: c.grid }); available += it.qty; }
      }
    }
    if (available <= 0) { SFX.dryFire(); this.G.hud.flashReload(); return; }
    this.reloading = w.def.pellets && !w.def.auto ? 3.2 : 2.4;
    this.reloadTake = Math.min(need, available);
    this.reloadStacks = stacks;
    SFX.reload();
    this.G.hud.refreshWeapon();
  }

  finishReload() {
    const w = this.weapon;
    if (!w) return;
    let take = this.reloadTake;
    for (const { it, grid } of this.reloadStacks) {
      if (take <= 0) break;
      const use = Math.min(take, it.qty);
      it.qty -= use;
      take -= use;
      if (it.qty <= 0) {
        const i = grid.items.indexOf(it);
        if (i >= 0) grid.items.splice(i, 1);
      }
    }
    w.loaded = (w.loaded ?? 0) + this.reloadTake - take;
    this.G.hud.refreshWeapon();
    if (this.G.inventory.isOpen) this.G.inventory.render();
  }

  // ================= consumption / medical =================
  consume(inst) {
    const d = inst.def;
    if (d.cat === 'food') { this.food = Math.min(100, this.food + d.energy); this.water = Math.min(100, Math.max(0, this.water + (d.water ?? 0))); SFX.eat(); }
    else if (d.cat === 'drink') { this.water = Math.min(100, this.water + d.water); this.food = Math.min(100, this.food + (d.energy ?? 0)); SFX.drink(); }
    if (d.sick && Math.random() < d.sick && !this.cholera) {
      this.cholera = true;
      this.feverTimer = 90; // fever develops later
    }
    if (inst.usesLeft != null) { inst.usesLeft--; return inst.usesLeft <= 0; }
    return true; // consumed entirely
  }

  useMedical(inst) {
    const d = inst.def;
    switch (d.effect) {
      case 'bandage':
        if (this.wounds <= 0) return false;
        this.wounds = 0; this.woundTimer = 0; SFX.bandage(); break;
      case 'rags':
        if (this.wounds <= 0) return false;
        this.wounds = 0; this.woundTimer = 0;
        if (Math.random() < 0.3) this.woundDirty = true;
        SFX.bandage(); break;
      case 'disinfect':
        this.woundDirty = false; SFX.bandage(); break;
      case 'antibiotic':
        this.infection = false; this.fever = false; this.woundDirty = false; SFX.eat(); break;
      case 'charcoal':
        this.cholera = false; if (!this.infection) this.fever = false; SFX.eat(); break;
      case 'saline':
        this.blood = Math.min(5000, this.blood + 2500); SFX.inject(); break;
      case 'adrenaline':
        this.adrenaline = 30; this.stamina = 100; SFX.inject(); break;
      case 'painkiller':
        this.painkiller = 120; SFX.eat(); break;
      default: return false;
    }
    if (inst.usesLeft != null) { inst.usesLeft--; return inst.usesLeft <= 0; }
    return true;
  }

  damage(amount, { bleedChance = 0, infectChance = 0, part = 'torso' } = {}) {
    if (this.dead || this.G.dev?.god) return;
    const reduced = amount * (1 - this.armorFor(part));
    this.hp -= reduced;
    this.blood -= reduced * 8;
    if (Math.random() < bleedChance) { this.wounds++; this.woundTimer = 0; }
    if (this.wounds > 0 && Math.random() < infectChance) this.woundDirty = true;
    SFX.hurt();
    this.G.hud.damageFlash();
    if (this.hp <= 0) this.die('Beaten to death');
    else if (this.blood <= 0) this.die('Bled out');
  }

  die(cause) {
    if (this.dead) return;
    this.dead = true;
    this.deadT = 0;
    this.deathCause = cause;
    this.G.onPlayerDeath(cause);
  }

  // visibility multiplier for zombie sight range
  visibility() {
    let v = this.stance === 'prone' ? 0.35 : this.stance === 'crouch' ? 0.6 : 1;
    if (this.speed > 4) v *= 1.6;
    else if (this.speed > 2) v *= 1.2;
    else if (this.speed < 0.2) v *= 0.8;
    return v;
  }

  cycleStance(target) {
    if (this.climbT >= 0) return;
    if (target === 'crouch') this.stance = this.stance === 'crouch' ? 'stand' : 'crouch';
    else if (target === 'prone') this.stance = this.stance === 'prone' ? 'stand' : 'prone';
  }

  jump() {
    if (this.dead || this.climbT >= 0) return;
    if (this.stance !== 'stand') { this.stance = 'stand'; return; }
    if (!this.grounded) return;
    // climb check first
    const c = this.G.world.climbableAt(this.pos.x, this.pos.z, this.yaw, this.pos.y);
    if (c && this.stamina > 5) {
      this.climbT = 0;
      this.climbFrom = this.pos.clone();
      this.climbTo = new THREE.Vector3(c.x, c.top, c.z);
      this.stamina = Math.max(0, this.stamina - 10);
      return;
    }
    if (this.stamina > 12) {
      this.vy = 6.2;
      this.grounded = false;
      this.stamina -= 12;
    }
  }

  // ================= per-frame =================
  update(dt) {
    const G = this.G;
    if (this.dead) {
      this.deadT += dt;
      animateHumanoid(this.rig, dt, { dead: true, deadT: this.deadT });
      return;
    }

    // ----- climbing -----
    if (this.climbT >= 0) {
      this.climbT += dt / 0.85;
      const t = Math.min(1, this.climbT);
      this.pos.lerpVectors(this.climbFrom, this.climbTo, t);
      this.pos.y = this.climbFrom.y + (this.climbTo.y - this.climbFrom.y) * Math.min(1, t * 1.4);
      if (this.climbT >= 1) { this.climbT = -1; this.grounded = true; }
      this.moveState = 'climb';
      this.speed = 0;
    } else {
      this.updateMovement(dt);
    }

    // ----- melee swing -----
    if (this.attackT !== null) {
      this.attackT += dt / this.attackDur;
      if (this.attackT > 0.55 && !this.attackApplied) { this.attackApplied = true; this.applyMeleeHit(); }
      if (this.attackT >= 1) this.attackT = null;
    }

    // ----- weapon timing -----
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) { this.reloading = 0; this.finishReload(); }
    }
    if (G.controls.firing) this.pullTrigger();
    else this.triggerHeld = false;
    this.recoil = Math.max(0, this.recoil - dt * 2.2);

    // weapon flashlight follows darkness
    const fl = this.rig.weaponMesh?.userData?.flashlight;
    if (fl) {
      const on = (G.world.daylight ?? 1) < 0.4;
      fl.intensity = on ? 5 : 0;
      if (this.rig.weaponMesh.userData.flashLens) {
        this.rig.weaponMesh.userData.flashLens.material.emissive?.setHex?.(on ? 0xfff2cc : 0x000000);
      }
    }

    this.updateStats(dt);

    // ----- rig -----
    this.rig.group.position.copy(this.pos);
    this.rig.group.rotation.y = this.yaw;
    animateHumanoid(this.rig, dt, {
      stance: this.stance,
      speed: this.speed,
      aiming: G.controls.aim,
      jumping: !this.grounded,
      climbing: this.climbT >= 0 ? this.climbT : null,
      attackT: this.attackT,
    });
  }

  updateMovement(dt) {
    const G = this.G, c = G.controls;
    const m = c.move, mag = c.mag;
    let target = 0;
    let anim = 'idle';

    if (mag > 0.05) {
      if (this.stance === 'prone') { target = SPEEDS.prone; anim = 'prone'; }
      else if (this.stance === 'crouch') { target = SPEEDS.crouch; anim = 'crouch'; }
      else if (c.sprint && this.stamina > 1 && mag > 0.4) { target = SPEEDS.run; anim = 'run'; }
      else if (mag > 0.45) { target = SPEEDS.jog; anim = 'jog'; }
      else { target = SPEEDS.walk; anim = 'walk'; }
      if (this.adrenaline > 0) target *= 1.15;
      if (this.fever) target *= 0.9;
      if (G.dev?.speed) target *= 3;

      // desired world direction relative to camera yaw
      const wishYaw = Math.atan2(-m.x, m.y) + c.camYaw;
      const dx = -Math.sin(wishYaw), dz = -Math.cos(wishYaw);
      this.speed = THREE.MathUtils.lerp(this.speed, target * Math.max(0.55, mag), Math.min(1, dt * 8));
      let nx = this.pos.x + dx * this.speed * dt;
      let nz = this.pos.z + dz * this.speed * dt;
      const fixed = G.world.collide(nx, nz, 0.35, this.pos.y);
      // can't swim: stop at the waterline
      if (G.world.groundHeightSimple(fixed.x, fixed.z) > -0.25) {
        this.pos.x = fixed.x; this.pos.z = fixed.z;
      }

      // face movement direction (or camera when aiming / in first person)
      const face = (c.aim || G.view === 'fpp') ? c.camYaw : wishYaw;
      let d = face - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, dt * 10);
    } else {
      this.speed = THREE.MathUtils.lerp(this.speed, 0, Math.min(1, dt * 10));
      if (c.aim || G.view === 'fpp') {
        let d = c.camYaw - this.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.yaw += d * Math.min(1, dt * 10);
      }
    }
    this.moveState = this.grounded ? anim : 'jump';

    // gravity / ground
    const ground = G.world.groundHeight(this.pos.x, this.pos.z, this.pos.y);
    if (!this.grounded) {
      this.vy -= 18 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= ground) { this.pos.y = ground; this.grounded = true; this.vy = 0; }
    } else {
      this.pos.y = THREE.MathUtils.lerp(this.pos.y, ground, Math.min(1, dt * 12));
      if (ground < this.pos.y - 0.4) this.grounded = false; // walked off an edge
    }
  }

  updateStats(dt) {
    if (this.G.dev?.god) {
      this.hp = 100; this.blood = 5000; this.food = 100; this.water = 100;
      this.stamina = 100; this.wounds = 0;
      this.cholera = false; this.infection = false; this.fever = false; this.woundDirty = false;
      return;
    }
    const sick = this.cholera || this.infection;
    const running = this.speed > 4;
    const drainMul = (sick ? 1.8 : 1) * (running ? 1.9 : this.speed > 2 ? 1.3 : 1);

    this.food = Math.max(0, this.food - 0.055 * drainMul * dt * (this.temp < 35.5 ? 1.5 : 1));
    this.water = Math.max(0, this.water - 0.085 * drainMul * dt * (this.fever ? 1.4 : 1));

    // stamina
    const maxStam = sick ? 70 : 100;
    if (this.adrenaline > 0) {
      this.adrenaline -= dt;
      this.stamina = maxStam;
    } else if (running && this.speed > 0.5) {
      this.stamina = Math.max(0, this.stamina - 9 * dt);
      if (this.stamina <= 0.5) this.G.controls.setSprint(false);
    } else {
      const regen = 11 * (sick ? 0.5 : 1) * (this.food > 20 ? 1 : 0.5);
      this.stamina = Math.min(maxStam, this.stamina + regen * dt);
    }
    this.painkiller = Math.max(0, this.painkiller - dt);

    // bleeding
    if (this.wounds > 0) {
      this.blood -= 14 * this.wounds * dt;
      this.woundTimer += dt;
      if (this.woundTimer > 50 && !this.woundDirty && Math.random() < dt * 0.02) this.woundDirty = true;
    }
    // infection develops from a dirty wound
    if (this.woundDirty && !this.infection && Math.random() < dt * 0.012) {
      this.infection = true;
      this.feverTimer = 60;
    }
    // fever onset
    if ((this.infection || this.cholera) && !this.fever) {
      this.feverTimer -= dt;
      if (this.feverTimer <= 0) this.fever = true;
    }
    if (!this.infection && !this.cholera) this.fever = false;

    // temperature
    let targetTemp = 36.6;
    if (this.fever) targetTemp = 39.6;
    else if (running) targetTemp = 37.3;
    else if (this.food < 15) targetTemp = 35.2;
    this.temp = THREE.MathUtils.lerp(this.temp, targetTemp, Math.min(1, dt * 0.02));

    // blood & health regen / drain
    if (this.blood < 5000 && this.food > 40 && this.water > 40 && this.wounds === 0) this.blood += 5 * dt;
    this.blood = Math.min(5000, this.blood);
    if (this.hp < 100 && this.blood > 4200 && this.food > 30 && this.water > 30 && !this.fever) this.hp += 1.1 * dt;
    if (this.food <= 0 || this.water <= 0) this.hp -= 1.1 * dt;
    if (this.infection) this.hp -= 0.35 * dt;
    if (this.blood < 2200) this.hp -= 0.5 * dt;
    this.hp = Math.min(100, this.hp);

    if (this.blood <= 0) this.die('Bled out');
    else if (this.hp <= 0) {
      this.die(this.food <= 0 ? 'Starved' : this.water <= 0 ? 'Died of dehydration' :
        this.infection ? 'Succumbed to infection' : 'Died of wounds');
    }
  }
}
