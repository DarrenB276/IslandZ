// ================= Tetris inventory: grid model + touch drag & drop UI =================
import { itemW, itemH, ITEMS, attachmentFits } from './items.js';
import { itemIcon } from './models.js';
import { SFX } from './audio.js';
import { STAT_PATHS } from './hud.js';

// icon markup: rendered 3D thumbnail if the item has a mesh, else the emoji
export function iconHTML(def) {
  const url = itemIcon(def.id);
  return url ? `<img src="${url}" alt="" style="width:88%;height:88%;object-fit:contain">` : def.icon;
}

const hex = (c) => '#' + (c ?? 0x777777).toString(16).padStart(6, '0');

// bounding rect clipped by scrollable ancestors — parts scrolled out of view must not catch drops
function visibleRect(el) {
  const r = el.getBoundingClientRect();
  let left = r.left, right = r.right, top = r.top, bottom = r.bottom;
  let n = el.parentElement;
  while (n && n !== document.body) {
    const st = getComputedStyle(n);
    if (/(auto|scroll|hidden)/.test(st.overflowY + st.overflowX)) {
      const pr = n.getBoundingClientRect();
      left = Math.max(left, pr.left); right = Math.min(right, pr.right);
      top = Math.max(top, pr.top); bottom = Math.min(bottom, pr.bottom);
    }
    n = n.parentElement;
  }
  return { left, right, top, bottom };
}
const inRect = (r, x, y) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

const SLOT_ORDER = [
  ['head', 'HEAD'], ['mask', 'MASK'], ['top', 'TOP'], ['vest', 'VEST'],
  ['gloves', 'GLOVES'], ['belt', 'BELT'], ['pants', 'PANTS'], ['feet', 'FEET'], ['back', 'BACK'],
  ['hands', 'HANDS'], ['shoulder', 'SHOULDER'],
];

export function gridOf(inst) {
  if (!inst.def.cap) return null;
  if (!inst.grid) inst.grid = { cols: inst.def.cap[0], rows: inst.def.cap[1], items: [] };
  return inst.grid;
}

// ---------- grid placement helpers ----------
export function canPlace(grid, inst, x, y, rot) {
  const w = rot ? inst.def.h : inst.def.w;
  const h = rot ? inst.def.w : inst.def.h;
  if (x < 0 || y < 0 || x + w > grid.cols || y + h > grid.rows) return false;
  for (const it of grid.items) {
    if (it === inst) continue;
    const iw = itemW(it), ih = itemH(it);
    if (x < it.x + iw && x + w > it.x && y < it.y + ih && y + h > it.y) return false;
  }
  return true;
}

export function placeAuto(grid, inst) {
  for (const rot of [0, 1]) {
    if (rot && inst.def.w === inst.def.h) continue;
    const w = rot ? inst.def.h : inst.def.w;
    const h = rot ? inst.def.w : inst.def.h;
    for (let y = 0; y + h <= grid.rows; y++) {
      for (let x = 0; x + w <= grid.cols; x++) {
        if (canPlace(grid, inst, x, y, rot)) {
          inst.x = x; inst.y = y; inst.rot = rot;
          grid.items.push(inst);
          return true;
        }
      }
    }
  }
  return false;
}

export function removeFromGrid(grid, inst) {
  const i = grid.items.indexOf(inst);
  if (i >= 0) grid.items.splice(i, 1);
}

export class Inventory {
  constructor(G) {
    this.G = G;
    this.isOpen = false;
    this.el = document.getElementById('inventory');
    this.equipEl = document.getElementById('equip-slots');
    this.containersEl = document.getElementById('inv-containers');
    this.vicinityEl = document.getElementById('vicinity-grid');
    this.ghost = document.getElementById('drag-ghost');
    this.rotateBtn = document.getElementById('btn-rotate');
    this.sheet = document.getElementById('action-sheet');
    this.drag = null;
    this.cell = 44;
    this.grids = [];        // rendered grids this frame: {gridEl, grid, ownerInst?}
    this.openedAt = 0;

    // pointerdown (not click): a synthesized click right after opening must not close it
    document.getElementById('inv-close').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.close();
    });
    this.rotateBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (this.drag) { this.drag.rot = this.drag.rot ? 0 : 1; this.updateGhost(); SFX.click(); }
    });
    window.addEventListener('pointermove', (e) => this.onDragMove(e));
    window.addEventListener('pointerup', (e) => this.onDragEnd(e));
    window.addEventListener('pointercancel', (e) => this.onDragEnd(e));
  }

  open() {
    this.isOpen = true;
    this.openedAt = performance.now();
    this.el.classList.add('open');
    const cs = getComputedStyle(document.documentElement).getPropertyValue('--cell');
    this.cell = parseFloat(cs) || 44;
    // resolve clamp() to px via a probe
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;width:var(--cell);visibility:hidden';
    document.body.appendChild(probe);
    this.cell = probe.getBoundingClientRect().width || 44;
    probe.remove();
    this.render();
  }

  close() {
    // ignore closes fired by the same tap that opened the panel (ghost click on ✕)
    if (performance.now() - this.openedAt < 400) return;
    this.isOpen = false;
    this.el.classList.remove('open');
    this.closeSheet();
    this.cancelDrag();
    this.G.onInventoryClosed?.();
  }

  toggle() { this.isOpen ? this.close() : this.open(); }

  // ---------- auto-stash (pickups) ----------
  autoStash(inst) {
    for (const c of this.G.player.containers()) {
      if (placeAuto(c.grid, inst)) return true;
    }
    // no room in bags: equip directly if the matching slot is free
    const d = inst.def;
    if (d.cat === 'clothing' && !this.G.player.equipment[d.slot]) { this.G.player.equip(inst); return true; }
    if ((d.cat === 'weapon' || d.cat === 'melee') && !this.G.player.equipment.hands) { this.G.player.equip(inst); return true; }
    if (d.cat === 'weapon' && d.long && !this.G.player.equipment.shoulder) { this.G.player.equipment.shoulder = inst; return true; }
    return false;
  }

  // ================= rendering =================
  render() {
    if (!this.isOpen) return;
    this.grids = [];
    this.renderEquipment();
    this.renderContainers();
    this.renderVicinity();
    this.renderQuickslots();
    this.renderDoll();
  }

  // ---------- paper doll + stats ----------
  renderDoll() {
    const p = this.G.player;
    const e = p.equipment;
    const skin = '#d8a583';
    const top = e.top ? hex(e.top.def.color) : '#c8b8a0';
    const pants = e.pants ? hex(e.pants.def.color) : '#777069';
    document.getElementById('paper-doll').innerHTML = `
      <svg viewBox="0 0 100 172">
        ${e.back ? `<rect x="26" y="34" width="48" height="34" rx="6" fill="${hex(e.back.def.color)}" opacity="0.9"/>` : ''}
        <rect x="38" y="4" width="24" height="24" rx="5" fill="${skin}"/>
        ${e.mask ? `<rect x="40" y="17" width="20" height="9" rx="3" fill="${hex(e.mask.def.color)}"/>` : ''}
        ${e.head ? `<rect x="35" y="0" width="30" height="10" rx="4" fill="${hex(e.head.def.color)}"/>`
          : `<rect x="37" y="1" width="26" height="6" rx="3" fill="#3a2a1c"/>`}
        <rect x="13" y="32" width="13" height="30" rx="5" fill="${top}"/>
        <rect x="74" y="32" width="13" height="30" rx="5" fill="${top}"/>
        <rect x="14" y="62" width="11" height="22" rx="4" fill="${top}"/>
        <rect x="75" y="62" width="11" height="22" rx="4" fill="${top}"/>
        <rect x="15" y="84" width="10" height="9" rx="3" fill="${e.gloves ? hex(e.gloves.def.color) : skin}"/>
        <rect x="75" y="84" width="10" height="9" rx="3" fill="${e.gloves ? hex(e.gloves.def.color) : skin}"/>
        <rect x="29" y="30" width="42" height="54" rx="6" fill="${top}"/>
        ${e.vest ? `<rect x="27" y="33" width="46" height="32" rx="6" fill="${hex(e.vest.def.color)}"/>` : ''}
        ${e.belt ? `<rect x="29" y="82" width="42" height="6" rx="2" fill="${hex(e.belt.def.color)}"/>` : ''}
        <rect x="31" y="88" width="17" height="42" rx="5" fill="${pants}"/>
        <rect x="52" y="88" width="17" height="42" rx="5" fill="${pants}"/>
        <rect x="32" y="130" width="15" height="36" rx="5" fill="${pants}"/>
        <rect x="53" y="130" width="15" height="36" rx="5" fill="${pants}"/>
        <rect x="30" y="163" width="19" height="9" rx="3" fill="${e.feet ? hex(e.feet.def.color) : '#33302a'}"/>
        <rect x="51" y="163" width="19" height="9" rx="3" fill="${e.feet ? hex(e.feet.def.color) : '#33302a'}"/>
      </svg>`;

    const stat = (key, val, warn, bad, suffix = '%') => {
      const cls = val <= bad ? 'bad' : val <= warn ? 'warn' : '';
      return `<div class="doll-stat ${cls}">
        <svg viewBox="0 0 24 24">${STAT_PATHS[key]}</svg>
        <span class="ds-val">${Math.round(val)}${suffix}</span></div>`;
    };
    document.getElementById('doll-stats-l').innerHTML =
      stat('hp', p.hp, 55, 25) + stat('blood', p.blood / 50, 75, 45);
    const t = p.temp;
    const tCls = (t <= 35 || t >= 38.4) ? 'bad' : (t <= 35.9 || t >= 37.4) ? 'warn' : '';
    document.getElementById('doll-stats-r').innerHTML =
      stat('food', p.food, 45, 20) + stat('water', p.water, 45, 20) +
      `<div class="doll-stat ${tCls}"><svg viewBox="0 0 24 24">${STAT_PATHS.temp}</svg>
        <span class="ds-val">${t.toFixed(1)}°</span></div>`;
  }

  // quickslot bar inside the inventory: drag an item onto a slot to assign it
  renderQuickslots() {
    const wrap = document.getElementById('inv-quickslots');
    wrap.innerHTML = '';
    this.qslotEls = [];
    const slots = this.G.hud.quickState();
    slots.forEach((s, i) => {
      const el = document.createElement('div');
      el.className = 'qslot';
      el.innerHTML = `<span class="q-num">${i + 1}</span>` +
        (s ? `<span class="q-icon">${s.inst.def.icon}</span><span class="q-label">${s.inst.def.name}</span>` : '');
      if (s) {
        el.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          this.G.player.quickslots[i] = null; // tap a filled slot to unassign
          this.render();
          this.G.hud.renderQuickslots(true);
          SFX.click();
        });
      }
      wrap.appendChild(el);
      this.qslotEls.push(el);
    });
  }

  // build a DOM grid for any container and register it for drag hit-testing
  buildGrid(grid, ownerInst) {
    const gridEl = document.createElement('div');
    gridEl.className = 'grid';
    gridEl.style.width = grid.cols * this.cell + 'px';
    gridEl.style.height = grid.rows * this.cell + 'px';
    for (const inst of grid.items) {
      const tile = this.itemTile(inst, 'inv-item');
      tile.style.left = inst.x * this.cell + 1 + 'px';
      tile.style.top = inst.y * this.cell + 1 + 'px';
      tile.style.width = itemW(inst) * this.cell - 2 + 'px';
      tile.style.height = itemH(inst) * this.cell - 2 + 'px';
      tile.addEventListener('pointerdown', (e) => this.startDrag(e, inst, { type: 'grid', grid }));
      gridEl.appendChild(tile);
    }
    this.grids.push({ gridEl, grid, ownerInst });
    return gridEl;
  }

  itemTile(inst, cls) {
    const el = document.createElement('div');
    el.className = `${cls} cat-${inst.def.cat}`;
    const icon = document.createElement('div');
    icon.className = 'item-icon';
    icon.innerHTML = iconHTML(inst.def);
    const label = document.createElement('div');
    label.className = 'item-label';
    label.textContent = inst.def.name;
    el.append(icon, label);
    let qty = null;
    if (inst.qty != null) qty = inst.qty;
    else if (inst.usesLeft != null) qty = '×' + inst.usesLeft;
    else if (inst.def.cat === 'weapon') qty = (inst.loaded ?? 0) + '/' + inst.def.mag;
    if (qty != null) {
      const q = document.createElement('div');
      q.className = 'item-qty';
      q.textContent = qty;
      el.appendChild(q);
    }
    return el;
  }

  renderEquipment() {
    this.equipEl.innerHTML = '';
    const handsWrap = document.getElementById('hands-wrap');
    handsWrap.innerHTML = '';
    const eq = this.G.player.equipment;
    for (const [slot, label] of SLOT_ORDER) {
      const cell = document.createElement('div');
      cell.className = 'equip-slot' + (eq[slot] ? ' filled' : '');
      cell.dataset.slot = slot;
      const name = document.createElement('div');
      name.className = 'slot-name';
      name.textContent = label;
      cell.appendChild(name);
      const inst = eq[slot];
      if (inst) {
        const icon = document.createElement('div');
        icon.className = 'item-icon';
        icon.innerHTML = iconHTML(inst.def);
        const lbl = document.createElement('div');
        lbl.className = 'item-label';
        lbl.textContent = inst.def.name;
        cell.append(icon, lbl);
        cell.addEventListener('pointerdown', (e) => this.startDrag(e, inst, { type: 'slot', slot }));
      }
      // hands slot lives under the paper doll; the rest go to the right column
      (slot === 'hands' ? handsWrap : this.equipEl).appendChild(cell);
    }
    this.renderHandsAttachments();
  }

  // attachments row under HANDS — the held weapon's optic / underbarrel / muzzle / mag
  renderHandsAttachments() {
    const el = document.getElementById('hands-attachments');
    el.innerHTML = '';
    const w = this.G.player.equipment.hands;
    if (!w || w.def.cat !== 'weapon' || !w.attachments) return;
    const label = document.createElement('div');
    label.className = 'inv-section-title';
    label.textContent = 'ATTACHMENTS';
    el.appendChild(label);
    const row = document.createElement('div');
    row.className = 'attach-row';
    for (const slot of ['optic', 'under', 'muzzle', 'mag']) {
      const aid = w.attachments[slot];
      const c = document.createElement('div');
      c.className = 'attach-slot' + (aid ? ' filled' : '');
      c.title = slot;
      if (aid) {
        c.innerHTML = `<span class="item-icon">${iconHTML(ITEMS[aid])}</span>`;
        c.addEventListener('pointerdown', (e) => { e.preventDefault(); this.G.player.detachFrom(w, slot); this.render(); });
      }
      row.appendChild(c);
    }
    el.appendChild(row);
  }

  renderContainers() {
    this.containersEl.innerHTML = '';
    const containers = this.G.player.containers();
    if (!containers.length) {
      const empty = document.createElement('div');
      empty.className = 'inv-section-title';
      empty.textContent = 'NO STORAGE — EQUIP CLOTHING WITH POCKETS';
      this.containersEl.appendChild(empty);
      return;
    }
    for (const c of containers) {
      const block = document.createElement('div');
      block.className = 'container-block';
      const head = document.createElement('div');
      head.className = 'container-head';
      const used = c.grid.items.reduce((n, it) => n + it.def.w * it.def.h, 0);
      head.innerHTML = `<span>${c.label}</span><span>${used}/${c.grid.cols * c.grid.rows}</span>`;
      block.append(head, this.buildGrid(c.grid, c.owner));
      this.containersEl.appendChild(block);
    }
  }

  renderVicinity() {
    this.vicinityEl.innerHTML = '';
    const near = this.G.world.itemsNear(this.G.player.pos, 3);
    for (const { gi } of near.slice(0, 12)) {
      const tile = this.itemTile(gi.inst, 'vic-item');
      tile.classList.add('cat-' + gi.inst.def.cat);
      tile.addEventListener('pointerdown', (e) => this.startDrag(e, gi.inst, { type: 'ground', gi }));
      this.vicinityEl.appendChild(tile);

      // ground containers (backpacks, vests, clothes with pockets) expose their own grid,
      // DayZ style — you can loot them or stash into them without picking them up
      const grid = gridOf(gi.inst);
      if (grid) {
        const block = document.createElement('div');
        block.className = 'container-block vic-container';
        const head = document.createElement('div');
        head.className = 'container-head';
        const used = grid.items.reduce((n, it) => n + it.def.w * it.def.h, 0);
        head.innerHTML = `<span>▼ ${gi.inst.def.name} (ground)</span><span>${used}/${grid.cols * grid.rows}</span>`;
        block.append(head, this.buildGrid(grid, gi.inst));
        this.vicinityEl.appendChild(block);
      }
    }
  }

  // ================= drag & drop =================
  startDrag(e, inst, src) {
    e.preventDefault();
    e.stopPropagation();
    this.closeSheet();
    this.drag = {
      inst, src, rot: inst.rot,
      startX: e.clientX, startY: e.clientY,
      moved: false, pointerId: e.pointerId,
      srcEl: e.currentTarget,
    };
  }

  updateGhost() {
    const d = this.drag;
    if (!d || !d.moved) return;
    const w = (d.rot ? d.inst.def.h : d.inst.def.w) * this.cell;
    const h = (d.rot ? d.inst.def.w : d.inst.def.h) * this.cell;
    this.ghost.style.width = w + 'px';
    this.ghost.style.height = h + 'px';
    this.ghost.style.left = d.lastX - w / 2 + 'px';
    this.ghost.style.top = d.lastY - h / 2 + 'px';
    this.highlightTarget(d.lastX, d.lastY);
  }

  onDragMove(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
    if (!d.moved && dist > 10) {
      // drag actually started
      d.moved = true;
      this.ghost.className = 'on cat-' + d.inst.def.cat;
      this.ghost.innerHTML = '';
      const icon = document.createElement('div');
      icon.className = 'item-icon';
      icon.textContent = d.inst.def.icon;
      const lbl = document.createElement('div');
      lbl.className = 'item-label';
      lbl.textContent = d.inst.def.name;
      this.ghost.append(icon, lbl);
      if (d.inst.def.w !== d.inst.def.h) this.rotateBtn.classList.add('on');
      d.srcEl?.classList.add('dragging-src');
    }
    if (d.moved) {
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      this.updateGhost();
    }
  }

  clearHighlights() {
    document.querySelectorAll('.cell-hl').forEach((n) => n.remove());
    document.querySelectorAll('.equip-slot.drop-ok, .equip-slot.drop-bad, .qslot.drop-ok')
      .forEach((n) => n.classList.remove('drop-ok', 'drop-bad'));
    document.getElementById('inv-vicinity').classList.remove('drop-ok');
    this.ghost.classList.remove('bad');
  }

  // find what is under the pointer; returns {kind, ...}
  hitTest(px, py) {
    for (const entry of this.grids) {
      if (!inRect(visibleRect(entry.gridEl), px, py)) continue;
      const r = entry.gridEl.getBoundingClientRect();
      {
        const d = this.drag;
        // attachment hovering over a weapon tile → attach instead of place
        if (d.inst.def.cat === 'attachment') {
          const ux = (px - r.left) / this.cell, uy = (py - r.top) / this.cell;
          const target = entry.grid.items.find((it) => it !== d.inst &&
            ux >= it.x && ux < it.x + itemW(it) && uy >= it.y && uy < it.y + itemH(it));
          if (target && target.def.cat === 'weapon') {
            return { kind: 'attach', weapon: target, ok: attachmentFits(d.inst.def, target.def) };
          }
        }
        const w = d.rot ? d.inst.def.h : d.inst.def.w;
        const h = d.rot ? d.inst.def.w : d.inst.def.h;
        let cx = Math.round((px - r.left) / this.cell - w / 2);
        let cy = Math.round((py - r.top) / this.cell - h / 2);
        cx = Math.max(0, Math.min(entry.grid.cols - w, cx));
        cy = Math.max(0, Math.min(entry.grid.rows - h, cy));
        return { kind: 'grid', grid: entry.grid, gridEl: entry.gridEl, x: cx, y: cy };
      }
    }
    for (const slotEl of this.el.querySelectorAll('.equip-slot')) {
      if (inRect(visibleRect(slotEl), px, py)) {
        return { kind: 'slot', slot: slotEl.dataset.slot, slotEl };
      }
    }
    for (let i = 0; i < (this.qslotEls?.length ?? 0); i++) {
      if (inRect(visibleRect(this.qslotEls[i]), px, py)) {
        return { kind: 'quick', index: i, el: this.qslotEls[i] };
      }
    }
    const vic = document.getElementById('inv-vicinity');
    if (inRect(visibleRect(vic), px, py)) return { kind: 'vicinity' };
    return null;
  }

  slotAccepts(slot, inst) {
    const d = inst.def;
    if (d.cat === 'clothing') return d.slot === slot;
    if (d.cat === 'weapon') return slot === 'hands' || (slot === 'shoulder' && d.long);
    if (d.cat === 'melee') return slot === 'hands';
    return false;
  }

  highlightTarget(px, py) {
    this.clearHighlights();
    const hit = this.hitTest(px, py);
    const d = this.drag;
    if (!hit || !d) return;
    if (hit.kind === 'grid') {
      const ok = canPlace(hit.grid, d.inst, hit.x, hit.y, d.rot) &&
        !this.wouldContainSelf(hit.grid, d.inst);
      const hl = document.createElement('div');
      hl.className = 'cell-hl' + (ok ? '' : ' bad');
      const w = d.rot ? d.inst.def.h : d.inst.def.w;
      const h = d.rot ? d.inst.def.w : d.inst.def.h;
      hl.style.left = hit.x * this.cell + 'px';
      hl.style.top = hit.y * this.cell + 'px';
      hl.style.width = w * this.cell + 'px';
      hl.style.height = h * this.cell + 'px';
      hit.gridEl.appendChild(hl);
      this.ghost.classList.toggle('bad', !ok);
    } else if (hit.kind === 'slot') {
      const ok = this.slotAccepts(hit.slot, d.inst);
      hit.slotEl.classList.add(ok ? 'drop-ok' : 'drop-bad');
      this.ghost.classList.toggle('bad', !ok);
    } else if (hit.kind === 'quick') {
      const ok = d.src.type !== 'ground';
      hit.el.classList.toggle('drop-ok', ok);
      this.ghost.classList.toggle('bad', !ok);
    } else if (hit.kind === 'attach') {
      this.ghost.classList.toggle('bad', !hit.ok);
    } else if (hit.kind === 'vicinity') {
      document.getElementById('inv-vicinity').classList.add('drop-ok');
    }
  }

  // an item of clothing can't be stored inside its own pockets
  wouldContainSelf(grid, inst) {
    return inst.grid === grid;
  }

  removeFromSource(d) {
    const p = this.G.player;
    if (d.src.type === 'grid') removeFromGrid(d.src.grid, d.inst);
    else if (d.src.type === 'slot') p.unequip(d.src.slot);
    else if (d.src.type === 'ground') this.G.world.removeGroundItem(d.src.gi);
  }

  restoreToSource(d) {
    const p = this.G.player;
    if (d.src.type === 'grid') d.src.grid.items.push(d.inst);
    else if (d.src.type === 'slot') p.equipment[d.src.slot] = d.inst, p.applyLook();
    else if (d.src.type === 'ground') this.G.world.spawnGroundItem(d.inst, d.src.gi.x, d.src.gi.z);
  }

  onDragEnd(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    this.ghost.classList.remove('on');
    this.rotateBtn.classList.remove('on');
    this.clearHighlights();
    d.srcEl?.classList.remove('dragging-src');

    if (!d.moved) { this.drag = null; this.openSheet(d.inst, d.src); return; }

    // hitTest reads this.drag, so clear it only after
    const hit = this.hitTest(e.clientX, e.clientY);
    this.drag = null;
    const p = this.G.player;
    let done = false;
    if (hit) {
      if (hit.kind === 'grid' && canPlace(hit.grid, d.inst, hit.x, hit.y, d.rot) &&
        !this.wouldContainSelf(hit.grid, d.inst)) {
        this.removeFromSource(d);
        d.inst.x = hit.x; d.inst.y = hit.y; d.inst.rot = d.rot;
        hit.grid.items.push(d.inst);
        done = true;
      } else if (hit.kind === 'attach') {
        if (hit.ok) {
          this.removeFromSource(d);
          p.attachTo(hit.weapon, d.inst);
          done = true;
        } else this.G.hud.toast("Doesn't fit this weapon");
      } else if (hit.kind === 'slot' && d.inst.def.cat === 'attachment' &&
        (hit.slot === 'hands' || hit.slot === 'shoulder') && p.equipment[hit.slot]?.def.cat === 'weapon') {
        // drop an attachment onto an equipped weapon
        if (attachmentFits(d.inst.def, p.equipment[hit.slot].def)) {
          this.removeFromSource(d);
          p.attachTo(p.equipment[hit.slot], d.inst);
          done = true;
        } else this.G.hud.toast("Doesn't fit this weapon");
      } else if (hit.kind === 'slot' && this.slotAccepts(hit.slot, d.inst)) {
        this.removeFromSource(d);
        if (hit.slot === 'shoulder') {
          const prev = p.equipment.shoulder;
          p.equipment.shoulder = d.inst;
          if (prev) this.stashOrDrop(prev);
        } else {
          const prev = p.equip(d.inst);
          if (prev) this.stashOrDrop(prev);
        }
        done = true;
      } else if (hit.kind === 'quick') {
        // assign to quickslot: item stays where it is, the slot just references it
        if (d.src.type !== 'ground') {
          p.assignQuickslot(hit.index, d.inst);
          done = true;
        } else this.G.hud.toast('Take the item first to assign it');
      } else if (hit.kind === 'vicinity') {
        if (d.src.type !== 'ground') {
          this.removeFromSource(d);
          this.dropAtFeet(d.inst);
          done = true;
        } else done = true; // ground → ground: no-op
      }
    }
    if (!done) SFX.click();
    else SFX.pickup();
    this.render();
    this.G.hud.refreshWeapon();
  }

  cancelDrag() {
    if (this.drag) {
      this.drag = null;
      this.ghost.classList.remove('on');
      this.rotateBtn.classList.remove('on');
      this.clearHighlights();
    }
  }

  stashOrDrop(inst) {
    if (!this.autoStash(inst)) this.dropAtFeet(inst);
  }

  dropAtFeet(inst) {
    const p = this.G.player;
    const a = Math.random() * Math.PI * 2;
    this.G.world.spawnGroundItem(inst, p.pos.x + Math.cos(a) * 0.8, p.pos.z + Math.sin(a) * 0.8);
  }

  // ================= action sheet =================
  openSheet(inst, src) {
    const d = inst.def;
    const p = this.G.player;
    const btns = [];
    const add = (label, cls, fn) => btns.push({ label, cls, fn });

    const consumeAndCleanup = (useFn) => {
      const gone = useFn(inst);
      if (gone) {
        if (src.type === 'grid') removeFromGrid(src.grid, inst);
        else if (src.type === 'ground') this.G.world.removeGroundItem(src.gi);
        else if (src.type === 'slot') p.unequip(src.slot);
      }
    };

    if (d.cat === 'food') add('Eat', '', () => consumeAndCleanup((i) => p.consume(i)));
    if (d.cat === 'drink') add('Drink', '', () => consumeAndCleanup((i) => p.consume(i)));
    if (d.cat === 'medical') add('Use', '', () => consumeAndCleanup((i) => p.useMedical(i)));
    if (d.usable === 'map') add('Read Map', '', () => { this.close(); this.G.showMap?.(); });
    if (d.cat === 'weapon' && inst.attachments) {
      for (const [aslot, aid] of Object.entries(inst.attachments)) {
        if (aid) add(`Remove ${ITEMS[aid].name}`, '', () => p.detachFrom(inst, aslot));
      }
    }
    if ((d.cat === 'clothing' || d.cat === 'weapon' || d.cat === 'melee') && src.type !== 'slot') {
      add('Equip', '', () => {
        this.takeFrom(src, inst);
        const prev = p.equip(inst);
        if (prev) this.stashOrDrop(prev);
      });
    }
    if (d.cat === 'weapon' && d.long && src.type !== 'slot' && !p.equipment.shoulder) {
      add('Put on shoulder', '', () => {
        this.takeFrom(src, inst);
        p.equipment.shoulder = inst;
      });
    }
    if (src.type === 'slot') {
      add('Unequip', '', () => {
        p.unequip(src.slot);
        this.stashOrDrop(inst);
      });
    }
    if (src.type === 'ground') {
      add('Take', '', () => {
        if (this.autoStash(inst)) this.G.world.removeGroundItem(src.gi);
        else this.G.hud.toast('No room');
      });
    }
    if (src.type !== 'ground') {
      add('Drop', 'danger', () => {
        this.takeFrom(src, inst);
        this.dropAtFeet(inst);
      });
    }

    this.sheet.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'sheet-title';
    title.innerHTML = `${d.icon} ${d.name}<span class="sheet-sub">${d.desc ?? ''}</span>`;
    this.sheet.appendChild(title);
    for (const b of btns) {
      const el = document.createElement('button');
      el.className = b.cls;
      el.textContent = b.label;
      el.addEventListener('click', () => { b.fn(); this.closeSheet(); this.render(); this.G.hud.refreshWeapon(); });
      this.sheet.appendChild(el);
    }
    const cancel = document.createElement('button');
    cancel.className = 'cancel';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => this.closeSheet());
    this.sheet.appendChild(cancel);
    this.sheet.classList.add('open');
  }

  takeFrom(src, inst) {
    if (src.type === 'grid') removeFromGrid(src.grid, inst);
    else if (src.type === 'ground') this.G.world.removeGroundItem(src.gi);
    else if (src.type === 'slot') this.G.player.unequip(src.slot);
  }

  closeSheet() { this.sheet.classList.remove('open'); }
}
