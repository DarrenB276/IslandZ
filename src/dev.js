// ================= Dev mode: god / speed / item spawner / time control =================
// Enable:  tap the "INVENTORY" title 5 times quickly, or open the game with ?dev=1
// Disable: the red button at the bottom of the dev panel (or 5 taps on the title again)
import { ITEMS, makeItem } from './items.js';
import { SFX } from './audio.js';

export class DevMode {
  constructor(G) {
    this.G = G;
    this.enabled = false;
    this.god = false;
    this.speed = false;
    this.panel = document.getElementById('dev-panel');
    this.badge = document.getElementById('dev-badge');
    this.taps = [];

    // secret activation: 5 quick taps on the inventory title
    document.querySelector('.inv-title').addEventListener('pointerdown', () => {
      const now = performance.now();
      this.taps = this.taps.filter((t) => now - t < 2500);
      this.taps.push(now);
      if (this.taps.length >= 5) {
        this.taps = [];
        this.enabled ? this.disable() : this.enable();
      }
    });
    if (new URLSearchParams(location.search).get('dev') === '1') this.enable(true);

    document.getElementById('dev-close').addEventListener('click', () => this.panel.classList.remove('open'));
    document.getElementById('dev-disable').addEventListener('click', () => this.disable());
    // quick-access DEV button inside the inventory header
    document.getElementById('inv-dev-btn').addEventListener('click', () => this.openPanel());

    const slider = document.getElementById('dev-time');
    slider.addEventListener('input', () => {
      this.G.world.timeOfDay = parseFloat(slider.value);
      this.updateTimeLabel();
    });

    this.buildToggles();
    this.buildItemList();
    if (this.enabled) this.sync();
  }

  enable(silent) {
    this.enabled = true;
    this.badge.classList.add('on');
    this.panel.classList.add('open');
    document.getElementById('inv-dev-btn').classList.add('on');
    this.sync();
    if (!silent) { SFX.pickup(); this.G.hud.toast('DEV MODE ON — red button in the panel turns it off'); }
  }

  disable() {
    this.enabled = false;
    this.god = false;
    this.speed = false;
    this.badge.classList.remove('on');
    this.panel.classList.remove('open');
    document.getElementById('inv-dev-btn').classList.remove('on');
    this.G.hud.toast('Dev mode off');
  }

  openPanel() { if (this.enabled) this.panel.classList.add('open'); }

  buildToggles() {
    const defs = [
      ['God Mode', () => this.god, (v) => { this.god = v; }],
      ['Speed ×3', () => this.speed, (v) => { this.speed = v; }],
      ['Infinite Stamina', () => this.G.player.adrenaline > 1e5, (v) => { this.G.player.adrenaline = v ? 1e9 : 0; }],
      ['Pause Time', () => this.G.world.timePaused, (v) => { this.G.world.timePaused = v; }],
    ];
    const wrap = document.getElementById('dev-toggles');
    wrap.innerHTML = '';
    this.toggleEls = [];
    for (const [label, get, set] of defs) {
      const el = document.createElement('div');
      el.className = 'dev-toggle';
      el.innerHTML = `<span>${label}</span><span class="pill"></span>`;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        set(!get());
        el.classList.toggle('on', get());
        SFX.click();
      });
      wrap.appendChild(el);
      this.toggleEls.push([el, get]);
    }
  }

  sync() {
    for (const [el, get] of this.toggleEls ?? []) el.classList.toggle('on', get());
    const slider = document.getElementById('dev-time');
    slider.value = this.G.world.timeOfDay.toFixed(2);
    this.updateTimeLabel();
  }

  updateTimeLabel() {
    const t = this.G.world.timeOfDay;
    const h = Math.floor(t), m = Math.floor((t - h) * 60);
    document.getElementById('dev-time-label').textContent =
      `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  buildItemList() {
    const wrap = document.getElementById('dev-items');
    wrap.innerHTML = '';
    for (const id of Object.keys(ITEMS)) {
      const d = ITEMS[id];
      const btn = document.createElement('button');
      btn.innerHTML = `<span class="item-icon">${d.icon}</span><span>${d.name}</span>`;
      btn.addEventListener('click', () => {
        const inst = makeItem(id);
        if (d.cat === 'weapon') inst.loaded = d.mag;
        if (this.G.inventory.autoStash(inst)) this.G.hud.toast(`Spawned ${d.name} → inventory`);
        else {
          const p = this.G.player;
          this.G.world.spawnGroundItem(inst, p.pos.x + 1, p.pos.z + 1);
          this.G.hud.toast(`Spawned ${d.name} on the ground`);
        }
        SFX.pickup();
        if (this.G.inventory.isOpen) this.G.inventory.render();
      });
      wrap.appendChild(btn);
    }
  }

  update() {
    if (this.enabled && this.panel.classList.contains('open') && !this.G.world.timePaused) {
      this.updateTimeLabel();
      const slider = document.getElementById('dev-time');
      if (document.activeElement !== slider) slider.value = this.G.world.timeOfDay.toFixed(2);
    }
  }
}
