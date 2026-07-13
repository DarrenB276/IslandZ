// ================= Tetris inventory: grid model + touch drag & drop UI =================
import { itemW, itemH } from './items.js';
import { SFX } from './audio.js';

const SLOT_ORDER = [
  ['head', 'HEAD'], ['mask', 'MASK'], ['top', 'TOP'], ['vest', 'VEST'],
  ['gloves', 'GLOVES'], ['belt', 'BELT'], ['pants', 'PANTS'], ['back', 'BACK'],
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
    icon.textContent = inst.def.icon;
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
        icon.textContent = inst.def.icon;
        const lbl = document.createElement('div');
        lbl.className = 'item-label';
        lbl.textContent = inst.def.name;
        cell.append(icon, lbl);
        cell.addEventListener('pointerdown', (e) => this.startDrag(e, inst, { type: 'slot', slot }));
      }
      this.equipEl.appendChild(cell);
    }
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
    document.querySelectorAll('.equip-slot.drop-ok, .equip-slot.drop-bad')
      .forEach((n) => n.classList.remove('drop-ok', 'drop-bad'));
    document.getElementById('inv-vicinity').classList.remove('drop-ok');
    this.ghost.classList.remove('bad');
  }

  // find what is under the pointer; returns {kind, ...}
  hitTest(px, py) {
    for (const entry of this.grids) {
      const r = entry.gridEl.getBoundingClientRect();
      if (px >= r.left && px <= r.right && py >= r.top && py <= r.bottom) {
        const d = this.drag;
        const w = d.rot ? d.inst.def.h : d.inst.def.w;
        const h = d.rot ? d.inst.def.w : d.inst.def.h;
        let cx = Math.round((px - r.left) / this.cell - w / 2);
        let cy = Math.round((py - r.top) / this.cell - h / 2);
        cx = Math.max(0, Math.min(entry.grid.cols - w, cx));
        cy = Math.max(0, Math.min(entry.grid.rows - h, cy));
        return { kind: 'grid', grid: entry.grid, gridEl: entry.gridEl, x: cx, y: cy };
      }
    }
    for (const slotEl of this.equipEl.querySelectorAll('.equip-slot')) {
      const r = slotEl.getBoundingClientRect();
      if (px >= r.left && px <= r.right && py >= r.top && py <= r.bottom) {
        return { kind: 'slot', slot: slotEl.dataset.slot, slotEl };
      }
    }
    const vic = document.getElementById('inv-vicinity');
    const vr = vic.getBoundingClientRect();
    if (px >= vr.left && px <= vr.right && py >= vr.top && py <= vr.bottom) return { kind: 'vicinity' };
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
    this.drag = null;
    this.ghost.classList.remove('on');
    this.rotateBtn.classList.remove('on');
    this.clearHighlights();
    d.srcEl?.classList.remove('dragging-src');

    if (!d.moved) { this.openSheet(d.inst, d.src); return; }

    const hit = this.hitTest(e.clientX, e.clientY);
    const p = this.G.player;
    let done = false;
    if (hit) {
      if (hit.kind === 'grid' && canPlace(hit.grid, d.inst, hit.x, hit.y, d.rot) &&
        !this.wouldContainSelf(hit.grid, d.inst)) {
        this.removeFromSource(d);
        d.inst.x = hit.x; d.inst.y = hit.y; d.inst.rot = d.rot;
        hit.grid.items.push(d.inst);
        done = true;
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
