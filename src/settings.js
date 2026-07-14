// ================= Game options: pause menu, settings, HUD customization =================
import { setMasterVolume, SFX } from './audio.js';

const STORE_KEY = 'islandz-settings-v1';
const DEFAULTS = { post: true, sens: 1.0, volume: 0.5, quick: 5, hud: {} };

// HUD elements the player may customize. drag: false = scale/opacity only
const HUD_ELEMENTS = [
  { id: 'btn-fire', drag: true }, { id: 'btn-aim', drag: true }, { id: 'btn-jump', drag: true },
  { id: 'btn-reload', drag: true }, { id: 'btn-crouch', drag: true }, { id: 'btn-prone', drag: true },
  { id: 'btn-sprint', drag: true }, { id: 'quickslots', drag: true }, { id: 'stats-col', drag: true },
  { id: 'weapon-info', drag: true }, { id: 'joystick-base', drag: false },
];

export class Settings {
  constructor(G) {
    this.G = G;
    this.data = this.load();
    this.editing = false;
    this.selected = null;

    this.pauseEl = document.getElementById('pause-menu');
    this.panelEl = document.getElementById('settings-panel');
    this.editBar = document.getElementById('hud-edit-bar');

    // ---- pause menu ----
    document.getElementById('pm-resume').addEventListener('click', () => this.closeAll());
    document.getElementById('pm-settings').addEventListener('click', () => {
      this.pauseEl.classList.remove('open');
      this.openSettings();
    });
    document.getElementById('pm-exit').addEventListener('click', () => location.reload());

    // ---- settings controls ----
    document.getElementById('settings-back').addEventListener('click', () => {
      this.panelEl.classList.remove('open');
      this.pauseEl.classList.add('open');
    });
    this.postRow = document.getElementById('set-post');
    this.postRow.addEventListener('click', () => {
      this.data.post = !this.data.post;
      this.apply(); this.save(); this.syncUI();
      SFX.click();
    });
    this.bindSlider('set-sens', 'sens', (v) => v.toFixed(2) + '×');
    this.bindSlider('set-volume', 'volume', (v) => Math.round(v * 100) + '%');
    this.bindSlider('set-quick', 'quick', (v) => String(Math.round(v)));

    // ---- HUD edit mode ----
    document.getElementById('set-hud-edit').addEventListener('click', () => this.enterEdit());
    document.getElementById('set-hud-reset').addEventListener('click', () => {
      this.data.hud = {};
      this.apply(); this.save();
      this.G.hud.toast('HUD layout reset');
    });
    document.getElementById('he-done').addEventListener('click', () => this.exitEdit());
    document.getElementById('he-reset').addEventListener('click', () => {
      if (this.selected) {
        delete this.data.hud[this.selected];
        this.apply(); this.save(); this.syncEditSliders();
      } else {
        this.data.hud = {};
        this.apply(); this.save();
      }
    });
    document.getElementById('he-scale').addEventListener('input', (e) => {
      if (!this.selected) return;
      this.conf(this.selected).scale = parseFloat(e.target.value);
      this.apply(); this.save();
    });
    document.getElementById('he-opacity').addEventListener('input', (e) => {
      if (!this.selected) return;
      this.conf(this.selected).opacity = parseFloat(e.target.value);
      this.apply(); this.save();
    });
    this.bindEditPointers();
    this.apply();
    this.syncUI();
  }

  // ---------- persistence ----------
  load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw), hud: { ...(JSON.parse(raw).hud ?? {}) } };
    } catch { /* corrupted storage: fall through to defaults */ }
    return { ...DEFAULTS, hud: {} };
  }

  save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(this.data)); } catch { /* private mode */ }
  }

  conf(id) {
    if (!this.data.hud[id]) this.data.hud[id] = {};
    return this.data.hud[id];
  }

  // largest quickslot count this screen can fit (5 guaranteed, 10 on wide screens)
  maxQuick() {
    const free = window.innerWidth - 540; // space between joystick zone and right controls
    return Math.max(5, Math.min(10, Math.floor(free / 48)));
  }

  quickCount() { return Math.min(Math.round(this.data.quick), this.maxQuick()); }

  // ---------- apply ----------
  apply() {
    this.G.setPost?.(this.data.post);
    if (this.G.dev) this.G.dev.post = this.data.post;
    this.G.controls.sensMul = this.data.sens;
    setMasterVolume(this.data.volume);
    // HUD transforms
    for (const { id } of HUD_ELEMENTS) {
      const el = document.getElementById(id);
      if (!el) continue;
      const c = this.data.hud[id] ?? {};
      el.style.translate = `${c.x ?? 0}px ${c.y ?? 0}px`;
      el.style.scale = String(c.scale ?? 1);
      el.style.opacity = c.opacity ?? '';
    }
    this.G.hud.renderQuickslots(true);
  }

  bindSlider(elId, key, fmt) {
    const el = document.getElementById(elId);
    const valEl = document.getElementById(elId + '-val');
    el.addEventListener('input', () => {
      this.data[key] = parseFloat(el.value);
      valEl.textContent = fmt(this.data[key]);
      if (key === 'quick') this.updateQuickNote();
      this.apply(); this.save();
    });
  }

  syncUI() {
    this.postRow.classList.toggle('on', this.data.post);
    for (const [elId, key, fmt] of [
      ['set-sens', 'sens', (v) => v.toFixed(2) + '×'],
      ['set-volume', 'volume', (v) => Math.round(v * 100) + '%'],
      ['set-quick', 'quick', (v) => String(Math.round(v))],
    ]) {
      document.getElementById(elId).value = this.data[key];
      document.getElementById(elId + '-val').textContent = fmt(this.data[key]);
    }
    document.getElementById('set-quick').max = this.maxQuick();
    this.updateQuickNote();
  }

  updateQuickNote() {
    const max = this.maxQuick();
    const el = document.getElementById('set-quick-note');
    el.textContent = max < 10
      ? `This screen fits up to ${max} slots — up to 10 on larger screens.`
      : 'Up to 10 slots on this screen.';
  }

  // ---------- pause / settings flow ----------
  get anyOpen() {
    return this.pauseEl.classList.contains('open') || this.panelEl.classList.contains('open') || this.editing;
  }

  openPause() {
    this.pauseEl.classList.add('open');
    this.G.paused = true;
    this.G.controls.enabled = false;
  }

  openSettings() {
    this.syncUI();
    this.panelEl.classList.add('open');
    this.G.paused = true;
  }

  closeAll() {
    this.pauseEl.classList.remove('open');
    this.panelEl.classList.remove('open');
    if (this.editing) this.exitEdit(true);
    this.G.paused = false;
    this.G.controls.enabled = !this.G.inventory.isOpen && !this.G.player.dead;
  }

  toggle() {
    if (this.anyOpen) this.closeAll();
    else this.openPause();
  }

  // ---------- HUD edit mode ----------
  enterEdit() {
    this.panelEl.classList.remove('open');
    this.editing = true;
    this.selected = null;
    document.body.classList.add('hud-editing');
    document.getElementById('hud').classList.remove('hidden');
    this.editBar.classList.add('open');
    document.getElementById('he-sliders').classList.remove('on');
    for (const { id } of HUD_ELEMENTS) document.getElementById(id)?.classList.add('hud-customizable');
    // make the resting joystick base obvious
    document.getElementById('joystick-base').classList.add('live');
  }

  exitEdit(silent) {
    this.editing = false;
    document.body.classList.remove('hud-editing');
    this.editBar.classList.remove('open');
    for (const { id } of HUD_ELEMENTS) {
      const el = document.getElementById(id);
      el?.classList.remove('hud-customizable', 'he-selected');
    }
    document.getElementById('joystick-base').classList.remove('live');
    this.save();
    if (!silent) { this.openSettings(); }
  }

  select(id) {
    this.selected = id;
    for (const { id: eid } of HUD_ELEMENTS) {
      document.getElementById(eid)?.classList.toggle('he-selected', eid === id);
    }
    document.getElementById('he-sliders').classList.add('on');
    this.syncEditSliders();
  }

  syncEditSliders() {
    const c = this.data.hud[this.selected] ?? {};
    document.getElementById('he-scale').value = c.scale ?? 1;
    document.getElementById('he-opacity').value = c.opacity ?? 1;
  }

  bindEditPointers() {
    let dragging = null; // {id, startX, startY, baseX, baseY, moved}
    window.addEventListener('pointerdown', (e) => {
      if (!this.editing) return;
      const hit = HUD_ELEMENTS.find(({ id }) => document.getElementById(id)?.contains(e.target));
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      this.select(hit.id);
      if (!hit.drag) return;
      const c = this.conf(hit.id);
      dragging = { id: hit.id, startX: e.clientX, startY: e.clientY, baseX: c.x ?? 0, baseY: c.y ?? 0 };
    }, true);
    window.addEventListener('pointermove', (e) => {
      if (!this.editing || !dragging) return;
      const c = this.conf(dragging.id);
      c.x = dragging.baseX + (e.clientX - dragging.startX);
      c.y = dragging.baseY + (e.clientY - dragging.startY);
      this.apply();
    });
    window.addEventListener('pointerup', () => {
      if (dragging) { this.save(); dragging = null; }
    });
  }
}
