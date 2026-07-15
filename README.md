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
| 👁 icon | V | Toggle first / third person |
| ☰ icon (top-left) | Esc | Pause menu: Resume / Settings / Exit |
| Quickslot bar | 1-0 | Use / equip the assigned item |
| TAKE prompt | F | Pick up nearby item |

## Game options

The ☰ button (top-left) pauses the game and opens **Resume / Settings / Exit**. Settings has:

- **Post processing** (bloom) on/off
- **Look sensitivity** and **master volume** sliders
- **Quickslot count** — 5 by default, up to 10 if the screen is wide enough
- **Customize HUD** — drag any control to reposition it, tap to select, then resize and change
  opacity with sliders. Layout persists in your browser; one-tap reset available.

## Quickslots

Drag an item from a pocket grid onto the quickslot bar at the bottom of the inventory to assign it
(the item stays in its pocket — the slot is a shortcut). Tap a slot in-game to equip the weapon,
eat/drink the food, or use the medical item. Tapping the slot of the weapon you're holding lowers it.
Tap a filled slot inside the inventory to unassign.

## Dev mode

Tap the **INVENTORY title 5 times quickly** (or open the game with `?dev=1`) to toggle dev mode.
The panel offers **god mode, ×3 speed, infinite stamina, time-of-day slider / pause**,
and a **spawn list of every registered item**. The red button at the bottom of the panel (or another
5 taps on the title) disables it.

## Features

**Tetris inventory** — DayZ-style, laid out over a **see-through background** so you can watch your surroundings: ground/vicinity on the left, a **paper doll** of your character (showing equipped clothing colours) in the centre with **live stats (%)** on either side and the HANDS slot beneath, equipment slots and storage grids on the right, quickslot bar at the bottom. Items occupy `w×h` cells, rotate while dragging, drag between containers/slots/ground. Ground containers expose their grids in place. Tap an item for context actions.

**Camera** — third person or first person, toggle any time. FPP has proper weapon handling: **idle tactical low-ready**, **hip-fire**, and **ADS** poses that blend as you fight, plus scope overlays on magnified optics.

**Character model** — jointed low-poly rig with a **neck, elbows, knees, ankles and feet**: bent-knee crouches, striding knee lift, supporting-hand weapon holds, elbow-extending punches and zombie lunges. Feet are **ground-aware** — the ankles tilt to the terrain slope so the character plants on hills instead of floating. A **FEET equipment slot** takes sneakers and boots (leather / combat / rubber), all visible on the model and paper doll. In **first person** you see your own legs and boots when you look down (DayZ-style), with the weapon rendered as a viewmodel.

**Day/night cycle** — 20-minute full day with dawn/dusk palettes, sun & moon, and darkness that actually matters: zombies see about half as far at night. Post-processing (half-res bloom + light-shaft god rays, ACES tone mapping) is tuned for mobile and auto-disables if the device can't hold frame rate.

**Weapons** — AKM, M4A1, VS98 sniper (scoped), Remington 870 pump, Vaiga semi-auto shotgun, MP5-K, **M249 SAW** (100-round belt), plus Machete, Cleaver, Kitchen Knife, Combat Knife and bare fists. Real magazine/ammo economy (5 ammo types found as stacks), fire modes, spread affected by stance/movement/aiming, recoil, tracers, muzzle flash, headshot multipliers. Gunshots aggro zombies by noise radius.

**Attachments** — drag an attachment onto a weapon (in a grid or the HANDS slot) to mount it; remove it from the weapon's tap menu. Optics: **RDS**, **ACOG 4x**, **PSO-1** (AKM/VS98), **12x Hunting Scope** — they change aim zoom and add scope overlays. Underbarrel: **Foregrip** (tighter spread), **Tac Flashlight** (real light that switches on in darkness), **Laser** (much tighter hip fire). Muzzle: **suppressors** (muffle the report and hide the muzzle flash — zombies hear you from far less). Magazines: **Extended Mag** (+60%) and **Drum Magazine** (×2.5). Attachments render on both the world weapon model and the first-person viewmodel, and a suppressor lengthens the visible barrel.

**Ballistics** — bullets leave the actual **barrel muzzle** and fly toward the crosshair, so you can shoot **up and down** freely (over cover, at rooftops, down slopes). Suppressed shots drop the noise radius.

**The island** — a large island (four chunks) with sand beaches, inland lakes, several towns, a medical clinic, two military camps, and hunting lodges spread coast-to-coast. The **animated ocean** has stacked wave octaves, fresnel sky reflection, sharp sun glint, depth shading and **foam on the crests and shoreline**. You spawn on the **south or east coast** with your gear washed up beside you. Deep water makes you **swim** (dedicated stroke animation, head above the surface, no shooting). The **Map** item opens a hand-drawn island map with your position; a **Compass** shows a heading bar at the top of the screen.

**Zombies** — DayZ-style infected with *sight-based* detection (vision cone + line-of-sight blocked by walls and terrain obstacles, not a plain radius), plus short-range hearing of footsteps. AI states: **idle**, **random wander**, and **aggro** (sprint on sight, shamble on memory, lose you after breaking line of sight). Attacks can cause bleeding and wound infection.

**Player** — idle / walk / jog / run / crouch / prone / jump / **climb** with procedural animation on a low-poly rig. Stamina-gated sprinting, jumping and climbing.

**Stats** — Health, Blood level, Hunger, Thirst, Stamina, Temperature. Stat icons **drain visually** — the icon empties from the top as the stat drops (75% filled, 50% filled, …) and pulses red when critical. Temperature is colour-coded instead: freezing / cold / normal / warm / hot.

**Medical / sickness** — bleeding wounds (bandage or rags), **cholera** from bad food/water (charcoal tabs), **wound infection** (tetracycline, prevent with disinfectant), **fever** (raises temperature, drains food & water faster, tires you quickly), saline IV to restore blood, painkillers, and the **adrenaline injector** (30s of unlimited stamina). Active conditions show as status icons.

**Clothing** — tops, pants, headgear (incl. armoured helmets), masks, gloves, belts and vests (incl. plate carrier armour); clothing is visible on the character model.

**World** — procedural low-poly island: town with lootable houses, medical clinic, military camp, hunting cabins, forests, pond, roads. Loot tables per zone.

**Mobile HUD** — adaptive layout (`vmin`/`clamp()` + safe-area insets), floating joystick, touch-look, contextual pickup prompt, hit markers, damage/blood-loss screen effects, sniper scope overlay.

## Model Editor

A standalone BlockBench-style editor ships at **`editor.html`** (link on the start screen). It:

- **detects every registered item** (weapons, attachments, clothing, food, medical, …) in a searchable library;
- loads a weapon's **actual in-game geometry** as editable box/cylinder parts (or starts blank for other items);
- lets you **add / duplicate / delete parts**, transform them with a move/rotate/scale gizmo or numeric fields, and recolour them from a palette or picker;
- edits **weapon points** — muzzle, left/right grips, sight/aim, and custom attachment points — shown as draggable markers;
- **exports** to **GLB** (`.glb`, opens in Blender → one-click FBX), **OBJ**, and a native **game JSON** that re-imports for continued editing.

> Note: reliable FBX can't be hand-written in the browser, so the editor exports glTF/OBJ/JSON instead — glTF is the standard interchange and Blender imports it directly. Freeform sculpt/extrude/cut, UV paint-texturing, and a full animation timeline are planned follow-ups.

## Multiplayer status

The game is single-player today, prepared for multiplayer: `src/net.js` defines the
state-sync boundary (player snapshots at 10 Hz over WebSocket, remote players rendered
through the same rig/animation system). What's still needed: a relay server, a shared
world seed, and snapshot interpolation — gameplay code won't need to change.

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
