// ================= HUD: stat icons, status effects, weapon info, screen FX =================

const SVG = {
  bleed: '<svg viewBox="0 0 24 24"><path d="M12 2s7 8.1 7 13a7 7 0 0 1-14 0c0-4.9 7-13 7-13z"/></svg>',
  virus: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M19.1 4.9l-2.8 2.8M7.7 16.3l-2.8 2.8" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
  fever: '<svg viewBox="0 0 24 24"><path d="M13 3a2 2 0 0 0-4 0v9.4a4.5 4.5 0 1 0 4 0V3z"/><path d="M17 4l2-2M19 8l3-1M17 8l1.5 1.5" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>',
  infect: '<svg viewBox="0 0 24 24"><path d="M4 14l4-6 3 4 3-7 3 5 3 2-2 6H6l-2-4z"/><circle cx="9" cy="17" r="1" fill="#000" opacity=".4"/></svg>',
  adren: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>',
};

export class HUD {
  constructor(G) {
    this.G = G;
    this.el = {
      hp: document.getElementById('stat-hp'),
      blood: document.getElementById('stat-blood'),
      food: document.getElementById('stat-food'),
      water: document.getElementById('stat-water'),
      temp: document.getElementById('stat-temp'),
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
    };
    this.statusCache = '';
    this.tick = 0;
  }

  grade(v, warn, bad, crit) {
    return v <= crit ? 'crit' : v <= bad ? 'bad' : v <= warn ? 'warn' : '';
  }

  update(dt) {
    this.tick -= dt;
    if (this.tick > 0) return;
    this.tick = 0.2;
    const p = this.G.player;

    this.el.hp.className = 'stat ' + this.grade(p.hp, 70, 45, 20);
    this.el.blood.className = 'stat ' + this.grade(p.blood, 4200, 3200, 2200);
    this.el.food.className = 'stat ' + this.grade(p.food, 45, 25, 10);
    this.el.water.className = 'stat ' + this.grade(p.water, 45, 25, 10);
    const t = p.temp;
    this.el.temp.className = 'stat ' + (t >= 38.5 || t <= 35 ? 'crit' : t >= 37.8 || t <= 35.8 ? 'bad' : '');

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
    const scoped = !!(w && w.def.scoped && this.G.controls.aim);
    this.el.scope.classList.toggle('on', scoped);
    this.el.crosshair.classList.toggle('hide', scoped || !w || w.def.cat !== 'weapon');
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
      this.el.wammo.innerHTML = `${w.loaded ?? 0}/${w.def.mag}<span class="mode">${mode}</span>`;
    }
    this.el.reloadBtn.classList.remove('flash');
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
