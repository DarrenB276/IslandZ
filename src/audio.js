// ================= Procedural WebAudio SFX =================
let ctx = null;
let master = null;
let masterVolume = 0.5;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = masterVolume;
  master.connect(ctx.destination);
}

export function setMasterVolume(v) {
  masterVolume = v;
  if (master) master.gain.value = v;
}

function noiseBuffer(dur) {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function envGain(t0, peak, dur) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  g.connect(master);
  return g;
}

function burst(dur, peak, filterFreq, filterType = 'lowpass') {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(dur);
  const f = ctx.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = filterFreq;
  src.connect(f);
  f.connect(envGain(t0, peak, dur));
  src.start(t0);
}

function tone(freq, dur, peak, type = 'sine', slideTo) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  o.connect(envGain(t0, peak, dur));
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export const SFX = {
  shot(kind) {
    if (!ctx) return;
    if (kind === 'shotgun') { burst(0.28, 0.9, 900); burst(0.14, 0.6, 2600, 'bandpass'); }
    else if (kind === 'sniper') { burst(0.4, 0.95, 700); tone(120, 0.3, 0.4, 'triangle', 40); }
    else { burst(0.14, 0.8, 1800); tone(180, 0.08, 0.3, 'square', 60); }
  },
  dryFire() { tone(1200, 0.04, 0.15, 'square'); },
  reload() { tone(700, 0.05, 0.2, 'square'); setTimeout(() => tone(500, 0.06, 0.2, 'square'), 140); },
  melee() { burst(0.09, 0.35, 1200, 'bandpass'); },
  hitFlesh() { burst(0.1, 0.5, 500); tone(160, 0.09, 0.3, 'triangle', 70); },
  zombieGrowl() {
    if (!ctx) return;
    const f = 80 + Math.random() * 60;
    tone(f, 0.5, 0.3, 'sawtooth', f * 0.6);
    burst(0.4, 0.15, 400);
  },
  zombieHit() { tone(90, 0.25, 0.45, 'sawtooth', 50); burst(0.15, 0.4, 600); },
  eat() { burst(0.12, 0.25, 900, 'bandpass'); setTimeout(() => burst(0.1, 0.2, 800, 'bandpass'), 180); },
  drink() { tone(400, 0.12, 0.2, 'sine', 600); setTimeout(() => tone(350, 0.12, 0.18, 'sine', 550), 200); },
  bandage() { burst(0.25, 0.2, 2000, 'highpass'); },
  inject() { tone(900, 0.06, 0.2, 'sine', 1400); },
  pickup() { tone(500, 0.07, 0.2, 'sine', 700); },
  equip() { burst(0.08, 0.25, 1500, 'bandpass'); },
  hurt() { tone(220, 0.15, 0.4, 'triangle', 110); },
  click() { tone(800, 0.03, 0.12, 'square'); },
  heartbeat() { tone(55, 0.12, 0.5, 'sine', 40); setTimeout(() => tone(50, 0.1, 0.35, 'sine', 38), 220); },
};
