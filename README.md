# IslandZ

A high-quality **low-poly, mobile-first DayZ-style survival game** built with [Three.js](https://threejs.org). No build step, no external assets — everything (models, animation, sound) is generated procedurally at runtime.

![genre](https://img.shields.io/badge/genre-survival-6a8a3a) ![engine](https://img.shields.io/badge/engine-three.js-049EF4) ![platform](https://img.shields.io/badge/platform-mobile%20%2B%20desktop-555)

## Play

Any static file server works (Three.js is vendored in `vendor/`, so it runs offline):

```bash
npm start            # http-server on :8080
# or
python3 -m http.server 8080
```

Open `http://localhost:8080` — on a phone, add the device's LAN address instead and play in landscape.

## Controls

| Mobile | Desktop | Action |
|---|---|---|
| Left thumb (virtual stick) | WASD | Move — stick deflection walks/jogs |
| Right side drag | Mouse (click canvas for pointer lock) | Look |
| 🏃 button | Shift | Sprint |
| Fire button | Left mouse | Shoot / melee |
| Aim button | Right mouse | Aim (scope on VS98) |
| ↺ button | R | Reload |
| ↑ button | Space | Jump / **climb** low obstacles |
| Crouch / prone buttons | C / Z | Stances |
| Bag icon | Tab or I | Tetris inventory |
| ⇄ icon | X | Swap hands ↔ shoulder weapon |
| TAKE prompt | F | Pick up nearby item |

## Features

**Tetris inventory** — DayZ-style grid storage. Every equipped clothing piece (top, pants, vest, belt) contributes its own pocket grid. Items occupy `w×h` cells, can be **rotated while dragging**, dragged between containers, equipped by dropping on equipment slots, and dropped to the ground (vicinity panel shows nearby loot). Tap an item for context actions (eat / drink / use / equip / drop).

**Weapons** — AKM, M4A1, VS98 sniper (scoped), Remington 870 pump, Vaiga semi-auto shotgun, MP5-K, plus Machete, Cleaver, Kitchen Knife, Combat Knife and bare fists. Real magazine/ammo economy (5 ammo types found as stacks), fire modes, spread affected by stance/movement/aiming, recoil, tracers, muzzle flash, headshot multipliers. Gunshots aggro zombies by noise radius.

**Zombies** — DayZ-style infected with *sight-based* detection (vision cone + line-of-sight blocked by walls and terrain obstacles, not a plain radius), plus short-range hearing of footsteps. AI states: **idle**, **random wander**, and **aggro** (sprint on sight, shamble on memory, lose you after breaking line of sight). Attacks can cause bleeding and wound infection.

**Player** — idle / walk / jog / run / crouch / prone / jump / **climb** with procedural animation on a low-poly rig. Stamina-gated sprinting, jumping and climbing.

**Stats** — Health, Blood level, Hunger, Thirst, Stamina, Temperature — with DayZ-style colour-graded HUD icons.

**Medical / sickness** — bleeding wounds (bandage or rags), **cholera** from bad food/water (charcoal tabs), **wound infection** (tetracycline, prevent with disinfectant), **fever** (raises temperature, drains food & water faster, tires you quickly), saline IV to restore blood, painkillers, and the **adrenaline injector** (30s of unlimited stamina). Active conditions show as status icons.

**Clothing** — tops, pants, headgear (incl. armoured helmets), masks, gloves, belts and vests (incl. plate carrier armour); clothing is visible on the character model.

**World** — procedural low-poly island: town with lootable houses, medical clinic, military camp, hunting cabins, forests, pond, roads. Loot tables per zone.

**Mobile HUD** — adaptive layout (`vmin`/`clamp()` + safe-area insets), floating joystick, touch-look, contextual pickup prompt, hit markers, damage/blood-loss screen effects, sniper scope overlay.

## Code map

```
index.html         HUD + inventory DOM skeleton
styles.css         all UI (responsive, safe-area aware)
vendor/three.module.js
src/
  main.js          bootstrap, camera, game loop
  world.js         terrain, town, colliders, LOS, loot, FX
  character.js     low-poly humanoid rig + procedural animation + weapon meshes
  player.js        movement, stances, stats, sickness, shooting, melee
  zombies.js       sight-based AI (idle / wander / aggro)
  inventory.js     tetris grid model + drag & drop UI
  items.js         item database + loot tables
  controls.js      touch joystick / buttons + desktop keyboard & mouse
  hud.js           stat icons, status effects, weapon info
  audio.js         procedural WebAudio SFX
```
