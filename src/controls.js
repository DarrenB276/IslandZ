// ================= Touch + keyboard/mouse controls =================

export class Controls {
  constructor() {
    this.move = { x: 0, y: 0 };     // joystick vector, y = forward
    this.mag = 0;
    this.camYaw = Math.PI;
    this.camPitch = 0.18;
    this.sprint = false;
    this.aim = false;
    this.firing = false;
    this.enabled = false;
    this.handlers = {};             // fire, jump, reload, crouch, prone, interact, inventory, swap, aim

    this.lookId = null;
    this.moveId = null;
    this.lookLast = { x: 0, y: 0 };
    this.keys = {};

    this.joyZone = document.getElementById('joystick-zone');
    this.joyBase = document.getElementById('joystick-base');
    this.joyKnob = document.getElementById('joystick-knob');
    this.baseRect = null;

    this.bindTouch();
    this.bindButtons();
    this.bindKeyboard();
  }

  on(name, fn) { this.handlers[name] = fn; }
  emit(name, arg) { if (this.handlers[name]) this.handlers[name](arg); }

  // ---------- touch ----------
  bindTouch() {
    const opts = { passive: false };

    this.joyZone.addEventListener('pointerdown', (e) => {
      if (!this.enabled || this.moveId !== null) return;
      this.moveId = e.pointerId;
      this.joyZone.setPointerCapture(e.pointerId);
      // reposition base under finger
      const zr = this.joyZone.getBoundingClientRect();
      const br = this.joyBase.getBoundingClientRect();
      let bx = e.clientX - br.width / 2, by = e.clientY - br.height / 2;
      bx = Math.max(zr.left, Math.min(zr.right - br.width, bx));
      by = Math.max(zr.top, Math.min(zr.bottom - br.height, by));
      this.joyBase.style.left = (bx - zr.left) + 'px';
      this.joyBase.style.top = (by - zr.top) + 'px';
      this.joyBase.style.bottom = 'auto';
      this.joyBase.classList.add('live');
      this.baseRect = { cx: bx + br.width / 2, cy: by + br.height / 2, r: br.width / 2 };
      this.updateJoy(e.clientX, e.clientY);
      e.preventDefault();
    }, opts);

    this.joyZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.moveId) return;
      this.updateJoy(e.clientX, e.clientY);
      e.preventDefault();
    }, opts);

    const endMove = (e) => {
      if (e.pointerId !== this.moveId) return;
      this.moveId = null;
      this.move.x = 0; this.move.y = 0; this.mag = 0;
      this.joyKnob.style.left = '29%'; this.joyKnob.style.top = '29%';
      this.joyBase.classList.remove('live');
    };
    this.joyZone.addEventListener('pointerup', endMove);
    this.joyZone.addEventListener('pointercancel', endMove);

    // look: any touch on the canvas right side (canvas is behind HUD buttons)
    const canvas = document.getElementById('game');
    canvas.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      if (e.pointerType === 'mouse') return; // mouse uses pointer lock
      if (e.clientX < window.innerWidth * 0.42) return;
      if (this.lookId !== null) return;
      this.lookId = e.pointerId;
      this.lookLast.x = e.clientX; this.lookLast.y = e.clientY;
      e.preventDefault();
    }, opts);
    window.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookId) return;
      const dx = e.clientX - this.lookLast.x, dy = e.clientY - this.lookLast.y;
      this.lookLast.x = e.clientX; this.lookLast.y = e.clientY;
      const sens = (this.aim ? 0.0035 : 0.006) * (600 / Math.min(window.innerWidth, 900));
      this.camYaw -= dx * sens * (window.innerWidth > 700 ? 1 : 1.4);
      this.camPitch += dy * sens;
      this.clampPitch();
    }, opts);
    const endLook = (e) => { if (e.pointerId === this.lookId) this.lookId = null; };
    window.addEventListener('pointerup', endLook);
    window.addEventListener('pointercancel', endLook);
  }

  updateJoy(px, py) {
    const { cx, cy, r } = this.baseRect;
    let dx = (px - cx) / r, dy = (py - cy) / r;
    const d = Math.hypot(dx, dy);
    if (d > 1) { dx /= d; dy /= d; }
    this.move.x = dx;
    this.move.y = -dy;
    this.mag = Math.min(1, d);
    this.joyKnob.style.left = (29 + dx * 29) + '%';
    this.joyKnob.style.top = (29 + dy * 29) + '%';
  }

  clampPitch() {
    this.camPitch = Math.max(-0.5, Math.min(1.25, this.camPitch));
  }

  // ---------- buttons ----------
  bindButtons() {
    const press = (id, down, up) => {
      const el = document.getElementById(id);
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); down(el); }, { passive: false });
      if (up) {
        el.addEventListener('pointerup', () => up(el));
        el.addEventListener('pointercancel', () => up(el));
        el.addEventListener('pointerleave', () => up(el));
      }
    };
    press('btn-fire', () => { this.firing = true; this.emit('fire', true); },
      () => { this.firing = false; this.emit('fire', false); });
    press('btn-aim', (el) => { this.aim = !this.aim; el.classList.toggle('active', this.aim); this.emit('aim', this.aim); });
    press('btn-jump', () => this.emit('jump'));
    press('btn-reload', () => this.emit('reload'));
    press('btn-crouch', () => this.emit('crouch'));
    press('btn-prone', () => this.emit('prone'));
    press('btn-sprint', (el) => { this.sprint = !this.sprint; el.classList.toggle('active', this.sprint); });
    press('btn-inventory', () => this.emit('inventory'));
    press('btn-swap', () => this.emit('swap'));
    press('btn-interact', () => this.emit('interact'));
  }

  setAim(v) {
    this.aim = v;
    document.getElementById('btn-aim').classList.toggle('active', v);
  }
  setSprint(v) {
    this.sprint = v;
    document.getElementById('btn-sprint').classList.toggle('active', v);
  }

  // ---------- keyboard / mouse (desktop testing) ----------
  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      switch (e.code) {
        case 'Space': this.emit('jump'); e.preventDefault(); break;
        case 'KeyR': this.emit('reload'); break;
        case 'KeyC': this.emit('crouch'); break;
        case 'KeyZ': this.emit('prone'); break;
        case 'KeyF': this.emit('interact'); break;
        case 'Tab': case 'KeyI': this.emit('inventory'); e.preventDefault(); break;
        case 'KeyX': this.emit('swap'); break;
      }
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    const canvas = document.getElementById('game');
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (document.pointerLockElement !== canvas) { canvas.requestPointerLock?.(); return; }
      if (e.button === 0) { this.firing = true; this.emit('fire', true); }
      if (e.button === 2) { this.setAim(!this.aim); this.emit('aim', this.aim); }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0 && this.firing) { this.firing = false; this.emit('fire', false); }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas) return;
      const sens = this.aim ? 0.0012 : 0.0022;
      this.camYaw -= e.movementX * sens;
      this.camPitch += e.movementY * sens;
      this.clampPitch();
    });
  }

  // keyboard movement folded into move vector each frame
  poll() {
    if (this.moveId === null) {
      let x = 0, y = 0;
      if (this.keys['KeyW'] || this.keys['ArrowUp']) y += 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) y -= 1;
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;
      const d = Math.hypot(x, y);
      if (d > 0) {
        this.move.x = x / d; this.move.y = y / d;
        this.mag = this.keys['ShiftLeft'] || this.keys['ShiftRight'] ? 1 : 0.65;
        if (this.keys['ShiftLeft']) this.sprint = true;
      } else if (!this.touchActive) {
        this.move.x = 0; this.move.y = 0; this.mag = 0;
        if (this.sprint && !document.getElementById('btn-sprint').classList.contains('active')) this.sprint = false;
      }
    }
  }

  setInteract(label) {
    const btn = document.getElementById('btn-interact');
    if (label) {
      document.getElementById('interact-label').textContent = label;
      btn.classList.add('show');
    } else btn.classList.remove('show');
  }
}
