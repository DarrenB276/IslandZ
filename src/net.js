// ================= Multiplayer scaffolding =================
// The game is single-player today. This module defines the state-sync boundary a
// future server plugs into, so multiplayer can be added without touching gameplay code:
//
//   1. host a WebSocket relay (or WebRTC mesh) that broadcasts snapshots
//   2. new Net(G).connect(url) — snapshots start flowing both ways
//   3. remote players render through the same createHumanoid/animateHumanoid rigs
//
// Everything that matters for sync already lives in plain data:
//   - player state → snapshotPlayer() below
//   - items are instances with stable uids (items.js)
//   - the world is deterministic from code (no random seed needed yet — spawn
//     placement should move to a shared seed when multiplayer lands)

const SNAPSHOT_RATE = 10; // Hz, target for state broadcast

export function snapshotPlayer(p) {
  return {
    x: +p.pos.x.toFixed(2), y: +p.pos.y.toFixed(2), z: +p.pos.z.toFixed(2),
    yaw: +p.yaw.toFixed(3),
    stance: p.stance,
    speed: +p.speed.toFixed(2),
    hp: Math.round(p.hp),
    dead: p.dead,
    weapon: p.equipment.hands?.def.id ?? null,
    aiming: !!p.G.controls.aim,
    look: {
      top: p.equipment.top?.def.id ?? null,
      pants: p.equipment.pants?.def.id ?? null,
      head: p.equipment.head?.def.id ?? null,
      vest: p.equipment.vest?.def.id ?? null,
      back: p.equipment.back?.def.id ?? null,
    },
  };
}

export class Net {
  constructor(G) {
    this.G = G;
    this.ws = null;
    this.connected = false;
    this.remotePlayers = new Map(); // id -> { snapshot, rig }
    this.sendAcc = 0;
  }

  connect(url) {
    this.ws = new WebSocket(url);
    this.ws.onopen = () => { this.connected = true; };
    this.ws.onclose = () => { this.connected = false; };
    this.ws.onmessage = (ev) => this.onMessage(JSON.parse(ev.data));
  }

  onMessage(msg) {
    // expected server messages: { type:'state', id, player } | { type:'leave', id }
    if (msg.type === 'state') this.remotePlayers.set(msg.id, { snapshot: msg.player, rig: this.remotePlayers.get(msg.id)?.rig ?? null });
    else if (msg.type === 'leave') this.remotePlayers.delete(msg.id);
  }

  update(dt) {
    if (!this.connected) return;
    this.sendAcc += dt;
    if (this.sendAcc >= 1 / SNAPSHOT_RATE) {
      this.sendAcc = 0;
      this.ws.send(JSON.stringify({ type: 'state', player: snapshotPlayer(this.G.player) }));
    }
    // TODO when a server exists: interpolate this.remotePlayers snapshots onto rigs
  }
}
