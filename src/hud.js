// ================= HUD: degrading stat icons, status effects, quickslots, weapon info =================
import { ITEMS } from './items.js';

const SVG = {
  bleed: '<svg viewBox="0 0 24 24"><path d="M12 2s7 8.1 7 13a7 7 0 0 1-14 0c0-4.9 7-13 7-13z"/></svg>',
  virus: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M19.1 4.9l-2.8 2.8M7.7 16.3l-2.8 2.8" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
  fever: '<svg viewBox="0 0 24 24"><path d="M13 3a2 2 0 0 0-4 0v9.4a4.5 4.5 0 1 0 4 0V3z"/><path d="M17 4l2-2M19 8l3-1M17 8l1.5 1.5" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>',
  infect: '<svg viewBox="0 0 24 24"><path d="M4 14l4-6 3 4 3-7 3 5 3 2-2 6H6l-2-4z"/><circle cx="9" cy="17" r="1" fill="#000" opacity=".4"/></svg>',
  adren: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>',
};

// stat icon paths (shared between the dim silhouette and the clipped fill layer)
export const STAT_PATHS = {
  hp: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3z"/>',
  blood: '<path d="M12 2s7 8.1 7 13a7 7 0 0 1-14 0c0-4.9 7-13 7-13z"/>',
  food: '<path d="M15.5 2c2.5 0 6.5 4 6.5 6.5 0 1.9-1.6 3.5-3.5 3.5-.9 0-1.8-.4-2.4-1L9.9 17.2a2.5 2.5 0 1 1-3.1-3.1L13 7.9c-.6-.6-1-1.5-1-2.4C12 3.6 13.6 2 15.5 2zM5 18a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>',
  water: '<path d="M10 2h4v3h1v3.2c1.8 1 3 2.9 3 5V19a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-5.8c0-2.1 1.2-4 3-5V5h1V2z"/>',
  temp: '<path d="M13 3a2 2 0 0 0-4 0v9.4a4.5 4.5 0 1 0 4 0V3zm-2 16a2.5 2.5 0 0 1-1-4.8V5h2v9.2a2.5 2.5 0 0 1-1 4.8z"/>',
};

export class HUD {
  constructor(G) {
    this.G = G;
    this.buildStats();
    this.el = {
      stamina: document.getElementById('stamina-bar'),
      status: document.getElementById('status-icons'),
      wname: document.getElementById('weapon-name'),
      wammo: document.getElementById('weapon-ammo'),
      hitmarker: document.getElementById('hitmarker'),
      damage: document.getElementById('damage-flash'),
      bloodOverlay: document.getElementById('blood-overlay'),
      crosshair: document.getElementById('crosshair'),
      scope: document.getElementById('scope-overlay'),
      reloadBtn: document.getElementById('btn-reload'),
      quickslots: document.getElementById('quickslots'),
    };
    this.statusCache = '';
    this.quickCache = '';
    this.tick = 0;
    this.compassCheck = 0;
    this.hasCompass = false;
    this.buildCompass();
    this.drawScopeReticle();
  }

  // crisp mil-dot reticle for magnified scopes (drawn once)
  drawScopeReticle() {
    const c = document.getElementById('scope-reticle');
    if (!c) return;
    const x = c.getContext('2d'), s = c.width, h = s / 2;
    x.clearRect(0, 0, s, s);
    x.strokeStyle = 'rgba(10,12,10,0.95)'; x.fillStyle = 'rgba(10,12,10,0.95)';
    x.lineWidth = s * 0.004;
    x.beginPath(); x.moveTo(0, h); x.lineTo(s, h); x.moveTo(h, 0); x.lineTo(h, s); x.stroke();
    x.lineWidth = s * 0.02; const post = s * 0.32;
    x.beginPath();
    x.moveTo(0, h); x.lineTo(post, h); x.moveTo(s, h); x.lineTo(s - post, h);
    x.moveTo(h, s); x.lineTo(h, s - post); x.moveTo(h, 0); x.lineTo(h, post); x.stroke();
    const step = s * 0.05, dot = s * 0.0075;
    for (let i = 1; i <= 4; i++) for (const [dx, dy] of [[i, 0], [-i, 0], [0, i], [0, -i]]) {
      x.beginPath(); x.arc(h + dx * step, h + dy * step, dot, 0, Math.PI * 2); x.fill();
    }
  }

  // ---------- compass ----------
  buildCompass() {
    this.compassBar = document.getElementById('compass-bar');
    this.compassStrip = document.getElementById('compass-strip');
    this.ppd = 2.6; // pixels per degree
    const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    let html = '';
    for (let cyc = 0; cyc < 3; cyc++) {
      for (let a = 0; a < 360; a += 15) {
        const x = (cyc * 360 + a) * this.ppd;
        if (a % 45 === 0) html += `<span style="left:${x}px">${labels[a / 45]}</span>`;
        else html += `<i style="left:${x}px"></i>`;
      }
    }
    this.compassStrip.innerHTML = html;
  }

  // fire button turns into a USE button (with a progress ring) while holding a consumable
  updateUseButton() {
    const p = this.G.player;
    const fire = document.getElementById('btn-fire');
    if (!fire) return;
    const held = p.heldConsumable;
    fire.classList.toggle('use-mode', !!held);
    const active = !!p.usingItem;
    fire.classList.toggle('use-active', active);
    if (active) document.getElementById('use-ring').style.setProperty('--p', (p.useProgress || 0).toFixed(3));
  }

  updateCompass() {
    if (!this.hasCompass) { this.compassBar.classList.remove('on'); return; }
    this.compassBar.classList.add('on');
    const yaw = this.G.controls.camYaw;
    const heading = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
    const center = this.compassBar.clientWidth / 2;
    this.compassStrip.style.transform =
      `translateX(${center - (heading + 360) * this.ppd}px)`;
  }

  buildStats() {
    const col = document.getElementById('stats-col');
    col.innerHTML = '';
    this.stats = {};
    for (const key of ['hp', 'blood', 'food', 'water', 'temp']) {
      const el = document.createElement('div');
      el.className = 'stat';
      el.innerHTML =
        `<svg class="stat-bg" viewBox="0 0 24 24">${STAT_PATHS[key]}</svg>` +
        `<svg class="stat-fill" viewBox="0 0 24 24">${STAT_PATHS[key]}</svg>`;
      col.appendChild(el);
      this.stats[key] = { el, fill: el.querySelector('.stat-fill') };
    }
  }

  // fill an icon from the bottom to pct (0..1)
  setFill(key, pct, crit) {
    const s = this.stats[key];
    const cut = Math.round((1 - Math.max(0, Math.min(1, pct))) * 100);
    s.fill.style.clipPath = `inset(${cut}% 0 0 0)`;
    s.el.classList.toggle('crit', !!crit);
  }

  update(dt) {
    this.updateCompass(); // every frame: heading must track the camera smoothly
    this.updateUseButton();
    this.tick -= dt;
    if (this.tick > 0) return;
    this.tick = 0.2;
    const p = this.G.player;

    // scan for a carried compass occasionally
    this.compassCheck -= 0.2;
    if (this.compassCheck <= 0) {
      this.compassCheck = 1;
      this.hasCompass = p.containers().some((c) => c.grid.items.some((it) => it.def.id === 'compass'));
    }

    this.setFill('hp', p.hp / 100, p.hp <= 20);
    this.setFill('blood', p.blood / 5000, p.blood <= 2200);
    this.setFill('food', p.food / 100, p.food <= 10);
    this.setFill('water', p.water / 100, p.water <= 10);

    // temperature: color-coded, always fully filled
    const t = p.temp;
    const tEl = this.stats.temp.el;
    this.stats.temp.fill.style.clipPath = 'inset(0 0 0 0)';
    tEl.className = 'stat ' + (
      t <= 35 ? 'temp-freezing' : t <= 35.9 ? 'temp-cold' :
      t >= 38.4 ? 'temp-hot' : t >= 37.3 ? 'temp-warm' : '');

    const stamPct = Math.round(p.stamina) + '%';
    this.el.stamina.style.width = stamPct;
    this.el.stamina.classList.toggle('low', p.stamina < 25);

    // status effect icons
    const parts = [];
    if (p.wounds > 0) parts.push(`<div class="status-icon bleed" title="Bleeding">${SVG.bleed}</div>`);
    if (p.cholera) parts.push(`<div class="status-icon sick" title="Cholera">${SVG.virus}</div>`);
    if (p.infection) parts.push(`<div class="status-icon sick" title="Wound infection">${SVG.infect}</div>`);
    if (p.fever) parts.push(`<div class="status-icon fever" title="Fever">${SVG.fever}</div>`);
    if (p.adrenaline > 0) parts.push(`<div class="status-icon adren" title="Adrenaline">${SVG.adren}</div>`);
    const html = parts.join('');
    if (html !== this.statusCache) {
      this.statusCache = html;
      this.el.status.innerHTML = html;
    }

    // low blood screen effect
    const bloodK = Math.max(0, Math.min(1, (4000 - p.blood) / 3000));
    this.el.bloodOverlay.style.opacity = bloodK * 0.9;

    // scope overlay
    const w = p.weapon;
    const scoped = !!(w && w.def.cat === 'weapon' && p.weaponScoped(w) && this.G.controls.aim);
    this.el.scope.classList.toggle('on', scoped);
    // functional in-mesh scopes (AX50) render live glass + mil-dot; hide the flat cross overlay
    const opticId = w && w.attachments?.optic;
    const meshScope = scoped && opticId && ITEMS[opticId]?.scopeMesh;
    this.el.scope.classList.toggle('mildot', !!meshScope);
    this.el.crosshair.classList.toggle('hide', scoped || !w || w.def.cat !== 'weapon');

    this.renderQuickslots();
  }

  // ---------- quickslots ----------
  quickState() {
    const p = this.G.player;
    const n = this.G.settings?.quickCount() ?? 5;
    const out = [];
    for (let i = 0; i < n; i++) {
      const uid = p.quickslots[i];
      const found = uid ? p.findItemByUid(uid) : null;
      out.push(found ? { inst: found.inst, held: p.equipment.hands === found.inst } : null);
    }
    return out;
  }

  renderQuickslots(force) {
    const slots = this.quickState();
    const sig = slots.map((s, i) => s ? `${i}:${s.inst.uid}:${s.held ? 1 : 0}` : `${i}:-`).join('|');
    if (!force && sig === this.quickCache) return;
    this.quickCache = sig;
    this.el.quickslots.innerHTML = '';
    slots.forEach((s, i) => {
      const el = document.createElement('div');
      el.className = 'qslot' + (s?.held ? ' held' : '');
      el.innerHTML = `<span class="q-num">${i + 1}</span>` +
        (s ? `<span class="q-icon">${s.inst.def.icon}</span><span class="q-label">${s.inst.def.name}</span>` : '');
      el.addEventListener('pointerdown', (e) => {
        if (document.body.classList.contains('hud-editing')) return;
        e.preventDefault(); e.stopPropagation();
        this.G.player.quickUse(i);
      });
      this.el.quickslots.appendChild(el);
    });
  }

  refreshWeapon() {
    const p = this.G.player;
    const w = p.weapon;
    if (!w) {
      this.el.wname.textContent = 'Fists';
      this.el.wammo.textContent = '';
    } else if (w.def.cat === 'melee') {
      this.el.wname.textContent = w.def.name;
      this.el.wammo.textContent = '';
    } else {
      this.el.wname.textContent = w.def.name;
      const mode = p.reloading > 0 ? 'RELOADING' : w.def.auto ? 'AUTO' : w.def.pellets ? (w.def.id === 'remington' ? 'PUMP' : 'SEMI') : w.def.scoped ? 'BOLT' : 'SEMI';
      this.el.wammo.innerHTML = `${w.loaded ?? 0}/${p.weaponMag(w)}<span class="mode">${mode}</span>`;
    }
    this.el.reloadBtn.classList.remove('flash');
    this.renderQuickslots(true);
  }

  hitmarker(kill) {
    const el = this.el.hitmarker;
    el.classList.remove('fade');
    el.classList.toggle('kill', !!kill);
    el.classList.add('show');
    clearTimeout(this._hm);
    this._hm = setTimeout(() => { el.classList.remove('show'); el.classList.add('fade'); }, 60);
  }

  damageFlash() {
    const el = this.el.damage;
    el.classList.remove('fade');
    el.classList.add('show');
    clearTimeout(this._df);
    this._df = setTimeout(() => { el.classList.remove('show'); el.classList.add('fade'); }, 90);
  }

  flashReload() {
    this.el.reloadBtn.classList.add('flash');
    clearTimeout(this._fr);
    this._fr = setTimeout(() => this.el.reloadBtn.classList.remove('flash'), 1600);
  }

  toast(msg) {
    let el = document.getElementById('hud-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hud-toast';
      el.style.cssText = 'position:absolute;left:50%;top:18%;transform:translateX(-50%);' +
        'background:rgba(10,14,12,.85);color:#eef3ea;padding:8px 16px;border-radius:8px;' +
        'font-size:clamp(12px,2.4vmin,15px);z-index:25;pointer-events:none;transition:opacity .3s';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = 1;
    clearTimeout(this._toast);
    this._toast = setTimeout(() => { el.style.opacity = 0; }, 1400);
  }
}
