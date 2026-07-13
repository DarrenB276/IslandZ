// ================= Item database =================
// Every item definition. Sizes are tetris grid cells (w x h).

let UID = 1;

export const ITEMS = {};
function def(d) { ITEMS[d.id] = d; return d; }

// ---------- Firearms ----------
// ammo: ammo item id, mag: magazine size, dmg per bullet, rpm, auto, spread (rad),
// pellets (shotguns), zoom (aim fov), noise (zombie aggro radius, m)
def({ id: 'akm', name: 'AKM', icon: '𝗔𝗞', w: 5, h: 2, cat: 'weapon', long: true,
  ammo: 'ammo_762x39', mag: 30, dmg: 38, rpm: 600, auto: true, spread: 0.022, zoom: 50, noise: 90,
  desc: '7.62x39 assault rifle. Hits hard.' });
def({ id: 'm4a1', name: 'M4A1', icon: '𝗠𝟰', w: 5, h: 2, cat: 'weapon', long: true,
  ammo: 'ammo_556', mag: 30, dmg: 32, rpm: 720, auto: true, spread: 0.016, zoom: 50, noise: 85,
  desc: '5.56 carbine. Fast and stable.' });
def({ id: 'vs98', name: 'VS98 Sniper', icon: '𝗩𝗦', w: 6, h: 2, cat: 'weapon', long: true, scoped: true,
  ammo: 'ammo_762x54', mag: 10, dmg: 88, rpm: 75, auto: false, spread: 0.002, zoom: 12, noise: 130,
  desc: '7.62x54 marksman rifle with scope.' });
def({ id: 'remington', name: 'Remington 870', icon: '𝗥𝗠', w: 5, h: 2, cat: 'weapon', long: true,
  ammo: 'ammo_12ga', mag: 7, dmg: 13, pellets: 8, rpm: 55, auto: false, spread: 0.05, zoom: 55, noise: 100,
  desc: 'Pump-action 12ga shotgun.' });
def({ id: 'vaiga', name: 'Vaiga', icon: '𝗩𝗚', w: 5, h: 2, cat: 'weapon', long: true,
  ammo: 'ammo_12ga', mag: 8, dmg: 11, pellets: 8, rpm: 170, auto: false, spread: 0.06, zoom: 55, noise: 100,
  desc: 'Semi-auto 12ga mag-fed shotgun.' });
def({ id: 'mp5', name: 'MP5-K', icon: '𝗠𝗣', w: 4, h: 2, cat: 'weapon', long: false,
  ammo: 'ammo_9mm', mag: 30, dmg: 21, rpm: 820, auto: true, spread: 0.03, zoom: 55, noise: 70,
  desc: '9mm submachine gun.' });

// ---------- Melee ----------
def({ id: 'machete', name: 'Machete', icon: '🔪', w: 1, h: 4, cat: 'melee', dmg: 42, rate: 1.0, range: 1.9,
  desc: 'Long blade. Wide, heavy swings.' });
def({ id: 'cleaver', name: 'Cleaver', icon: '🔪', w: 1, h: 2, cat: 'melee', dmg: 33, rate: 1.25, range: 1.5,
  desc: 'Butcher\'s cleaver.' });
def({ id: 'kitchen_knife', name: 'Kitchen Knife', icon: '🔪', w: 1, h: 2, cat: 'melee', dmg: 22, rate: 1.6, range: 1.4,
  desc: 'Better than nothing.' });
def({ id: 'combat_knife', name: 'Combat Knife', icon: '🗡', w: 1, h: 2, cat: 'melee', dmg: 30, rate: 1.7, range: 1.5,
  desc: 'Fast military blade.' });

// ---------- Ammo ----------
def({ id: 'ammo_762x39', name: '7.62x39mm', icon: '▮', w: 1, h: 1, cat: 'ammo', stack: 30, desc: 'Rifle rounds.' });
def({ id: 'ammo_556', name: '5.56x45mm', icon: '▮', w: 1, h: 1, cat: 'ammo', stack: 30, desc: 'Rifle rounds.' });
def({ id: 'ammo_762x54', name: '7.62x54mmR', icon: '▮', w: 1, h: 1, cat: 'ammo', stack: 20, desc: 'Sniper rounds.' });
def({ id: 'ammo_12ga', name: '12ga Shells', icon: '▮', w: 1, h: 1, cat: 'ammo', stack: 12, desc: 'Buckshot shells.' });
def({ id: 'ammo_9mm', name: '9x19mm', icon: '▮', w: 1, h: 1, cat: 'ammo', stack: 30, desc: 'Pistol rounds.' });

// ---------- Food ----------  energy/water restored (0-100 scale), sick = cholera risk
def({ id: 'beans', name: 'Canned Beans', icon: '🥫', w: 1, h: 1, cat: 'food', energy: 35, water: 6, desc: 'A classic.' });
def({ id: 'tuna', name: 'Canned Tuna', icon: '🥫', w: 1, h: 1, cat: 'food', energy: 28, water: 4, desc: 'Salty fish.' });
def({ id: 'spaghetti', name: 'Canned Spaghetti', icon: '🥫', w: 1, h: 1, cat: 'food', energy: 40, water: 5, desc: 'Cold, but filling.' });
def({ id: 'rice', name: 'Rice Bag', icon: '🍚', w: 2, h: 2, cat: 'food', energy: 70, water: -5, uses: 3, desc: 'Dry rice. Multiple servings.' });
def({ id: 'apple', name: 'Apple', icon: '🍎', w: 1, h: 1, cat: 'food', energy: 12, water: 8, desc: 'Fresh fruit.' });
def({ id: 'chips', name: 'Potato Chips', icon: '🍟', w: 2, h: 1, cat: 'food', energy: 22, water: -6, desc: 'Crunchy. Thirsty work.' });
def({ id: 'rotten_fruit', name: 'Rotten Fruit', icon: '🍏', w: 1, h: 1, cat: 'food', energy: 8, water: 4, sick: 0.45,
  desc: 'Smells wrong. Risk of cholera.' });

// ---------- Drink ----------
def({ id: 'water_bottle', name: 'Water Bottle', icon: '💧', w: 1, h: 2, cat: 'drink', water: 45, uses: 2, desc: 'Clean water.' });
def({ id: 'canteen', name: 'Canteen', icon: '🫗', w: 1, h: 2, cat: 'drink', water: 60, uses: 3, desc: 'Military canteen.' });
def({ id: 'soda', name: 'Pipsi Soda', icon: '🥤', w: 1, h: 1, cat: 'drink', water: 25, energy: 8, desc: 'Warm and flat.' });
def({ id: 'pond_water', name: 'Murky Water', icon: '🫙', w: 1, h: 2, cat: 'drink', water: 40, sick: 0.5,
  desc: 'Unboiled pond water. Cholera risk.' });

// ---------- Medical ----------  effect handled in player.useMedical
def({ id: 'bandage', name: 'Bandage', icon: '🩹', w: 1, h: 1, cat: 'medical', effect: 'bandage', desc: 'Stops bleeding.' });
def({ id: 'rags', name: 'Rags', icon: '🧻', w: 1, h: 1, cat: 'medical', effect: 'rags', uses: 2,
  desc: 'Stops bleeding. Infection risk if dirty.' });
def({ id: 'disinfectant', name: 'Disinfectant', icon: '🧴', w: 1, h: 2, cat: 'medical', effect: 'disinfect', uses: 3,
  desc: 'Cleans wounds. Prevents infection.' });
def({ id: 'tetracycline', name: 'Tetracycline', icon: '💊', w: 1, h: 1, cat: 'medical', effect: 'antibiotic',
  desc: 'Antibiotics. Cures infection & fever.' });
def({ id: 'charcoal', name: 'Charcoal Tabs', icon: '⬛', w: 1, h: 1, cat: 'medical', effect: 'charcoal',
  desc: 'Cures cholera.' });
def({ id: 'saline', name: 'Saline Bag IV', icon: '🩸', w: 2, h: 2, cat: 'medical', effect: 'saline',
  desc: 'Restores blood volume fast.' });
def({ id: 'adrenaline', name: 'Adrenaline Injector', icon: '💉', w: 1, h: 1, cat: 'medical', effect: 'adrenaline',
  desc: 'Unlimited stamina for 30s.' });
def({ id: 'painkillers', name: 'Painkillers', icon: '💊', w: 1, h: 1, cat: 'medical', effect: 'painkiller',
  desc: 'Steadies aim, dulls pain.' });

// ---------- Utilities ----------
def({ id: 'rope', name: 'Rope', icon: '🪢', w: 2, h: 2, cat: 'utility', desc: 'Sturdy rope.' });
def({ id: 'duct_tape', name: 'Duct Tape', icon: '⭕', w: 1, h: 1, cat: 'utility', desc: 'Fixes everything.' });
def({ id: 'matches', name: 'Matches', icon: '🔥', w: 1, h: 1, cat: 'utility', desc: 'Dry matches.' });
def({ id: 'compass', name: 'Compass', icon: '🧭', w: 1, h: 1, cat: 'utility', desc: 'Points north.' });
def({ id: 'flare', name: 'Road Flare', icon: '🧨', w: 1, h: 2, cat: 'utility', desc: 'Burns bright red.' });

// ---------- Clothing ----------
// slot: head|mask|top|vest|gloves|belt|pants  · cap: [cols, rows] container · armor: dmg reduction 0-1
// color: applied to the character model
def({ id: 'tshirt', name: 'T-Shirt', icon: '👕', w: 2, h: 2, cat: 'clothing', slot: 'top', cap: [2, 2], warmth: 1, color: 0x8a8f96 });
def({ id: 'hoodie', name: 'Hoodie', icon: '👕', w: 2, h: 2, cat: 'clothing', slot: 'top', cap: [3, 2], warmth: 2, color: 0x4a5a48 });
def({ id: 'field_jacket', name: 'Field Jacket', icon: '🧥', w: 2, h: 3, cat: 'clothing', slot: 'top', cap: [4, 2], warmth: 3, color: 0x5c6648 });
def({ id: 'raincoat', name: 'Raincoat', icon: '🧥', w: 2, h: 2, cat: 'clothing', slot: 'top', cap: [2, 2], warmth: 2, color: 0xb8b23a });
def({ id: 'jeans', name: 'Jeans', icon: '👖', w: 2, h: 2, cat: 'clothing', slot: 'pants', cap: [2, 2], warmth: 1, color: 0x3d4c66 });
def({ id: 'cargo_pants', name: 'Cargo Pants', icon: '👖', w: 2, h: 2, cat: 'clothing', slot: 'pants', cap: [3, 2], warmth: 2, color: 0x55584a });
def({ id: 'hunter_pants', name: 'Hunter Pants', icon: '👖', w: 2, h: 2, cat: 'clothing', slot: 'pants', cap: [3, 2], warmth: 3, color: 0x4a4438 });
def({ id: 'cap', name: 'Baseball Cap', icon: '🧢', w: 1, h: 1, cat: 'clothing', slot: 'head', warmth: 1, color: 0x8a3232, hat: 'cap' });
def({ id: 'boonie', name: 'Boonie Hat', icon: '👒', w: 1, h: 1, cat: 'clothing', slot: 'head', warmth: 1, color: 0x5c6648, hat: 'boonie' });
def({ id: 'helmet', name: 'Combat Helmet', icon: '🪖', w: 2, h: 2, cat: 'clothing', slot: 'head', armor: 0.4, warmth: 1, color: 0x4a4f42, hat: 'helmet' });
def({ id: 'moto_helmet', name: 'Moto Helmet', icon: '⛑', w: 2, h: 2, cat: 'clothing', slot: 'head', armor: 0.3, warmth: 1, color: 0x24292e, hat: 'moto' });
def({ id: 'surgical_mask', name: 'Surgical Mask', icon: '😷', w: 1, h: 1, cat: 'clothing', slot: 'mask', color: 0x9fd0d8 });
def({ id: 'bandana', name: 'Bandana', icon: '🟥', w: 1, h: 1, cat: 'clothing', slot: 'mask', color: 0x8a3232 });
def({ id: 'gas_mask', name: 'Gas Mask', icon: '🎭', w: 2, h: 2, cat: 'clothing', slot: 'mask', color: 0x33362e });
def({ id: 'work_gloves', name: 'Working Gloves', icon: '🧤', w: 1, h: 1, cat: 'clothing', slot: 'gloves', warmth: 1, color: 0x7a6648 });
def({ id: 'tac_gloves', name: 'Tactical Gloves', icon: '🧤', w: 1, h: 1, cat: 'clothing', slot: 'gloves', warmth: 1, color: 0x2e3230 });
def({ id: 'belt', name: 'Leather Belt', icon: '➰', w: 2, h: 1, cat: 'clothing', slot: 'belt', cap: [2, 1], color: 0x4a3524 });
def({ id: 'mil_belt', name: 'Military Belt', icon: '➰', w: 2, h: 1, cat: 'clothing', slot: 'belt', cap: [3, 1], color: 0x3c4034 });
def({ id: 'press_vest', name: 'Press Vest', icon: '🦺', w: 3, h: 3, cat: 'clothing', slot: 'vest', cap: [3, 2], armor: 0.25, color: 0x2a4a8a });
def({ id: 'plate_carrier', name: 'Plate Carrier', icon: '🦺', w: 3, h: 3, cat: 'clothing', slot: 'vest', cap: [2, 2], armor: 0.5, color: 0x2e3128 });
def({ id: 'highcap_vest', name: 'High Cap Vest', icon: '🦺', w: 3, h: 3, cat: 'clothing', slot: 'vest', cap: [4, 3], armor: 0.1, color: 0x3c3a30 });

// ================= instances =================
export function makeItem(id, qty) {
  const d = ITEMS[id];
  if (!d) throw new Error('unknown item ' + id);
  const inst = { uid: UID++, def: d, x: -1, y: -1, rot: 0 };
  if (d.stack) inst.qty = qty ?? d.stack;
  if (d.uses) inst.usesLeft = d.uses;
  if (d.cat === 'weapon') inst.loaded = qty ?? Math.floor(d.mag * (0.3 + Math.random() * 0.7));
  return inst;
}

export function itemW(inst) { return inst.rot ? inst.def.h : inst.def.w; }
export function itemH(inst) { return inst.rot ? inst.def.w : inst.def.h; }

// ================= loot tables =================
const T = (entries) => entries; // [id, weight]
export const LOOT_TABLES = {
  residential: T([
    ['beans', 8], ['tuna', 7], ['spaghetti', 6], ['soda', 6], ['water_bottle', 6], ['chips', 4],
    ['apple', 4], ['rotten_fruit', 3], ['rice', 2], ['kitchen_knife', 5], ['cleaver', 3], ['machete', 2],
    ['tshirt', 4], ['hoodie', 3], ['jeans', 4], ['cap', 3], ['bandana', 2], ['work_gloves', 3],
    ['belt', 3], ['raincoat', 2], ['rags', 5], ['bandage', 3], ['matches', 3], ['duct_tape', 3],
    ['rope', 2], ['painkillers', 2], ['pond_water', 2], ['mp5', 1], ['ammo_9mm', 2], ['flare', 2],
  ]),
  military: T([
    ['akm', 4], ['m4a1', 4], ['vs98', 2], ['vaiga', 3], ['mp5', 3],
    ['ammo_762x39', 8], ['ammo_556', 8], ['ammo_762x54', 4], ['ammo_12ga', 6], ['ammo_9mm', 6],
    ['helmet', 3], ['plate_carrier', 2], ['highcap_vest', 3], ['press_vest', 2], ['tac_gloves', 3],
    ['mil_belt', 3], ['field_jacket', 4], ['cargo_pants', 4], ['hunter_pants', 3], ['boonie', 2],
    ['gas_mask', 2], ['combat_knife', 4], ['canteen', 3], ['adrenaline', 2], ['compass', 2],
  ]),
  hunting: T([
    ['remington', 4], ['vs98', 2], ['ammo_12ga', 8], ['ammo_762x54', 5], ['hunter_pants', 4],
    ['boonie', 3], ['machete', 3], ['combat_knife', 2], ['canteen', 3], ['rice', 3], ['matches', 4],
    ['rope', 3], ['field_jacket', 2], ['moto_helmet', 1],
  ]),
  medical: T([
    ['bandage', 8], ['rags', 5], ['disinfectant', 5], ['tetracycline', 4], ['charcoal', 4],
    ['saline', 3], ['adrenaline', 3], ['painkillers', 5], ['surgical_mask', 4], ['water_bottle', 3],
  ]),
};

export function rollLoot(tableName) {
  const table = LOOT_TABLES[tableName];
  let total = 0;
  for (const [, w] of table) total += w;
  let r = Math.random() * total;
  for (const [id, w] of table) {
    r -= w;
    if (r <= 0) {
      const d = ITEMS[id];
      if (d.stack) return makeItem(id, Math.ceil(d.stack * (0.3 + Math.random() * 0.7)));
      return makeItem(id);
    }
  }
  return makeItem(table[0][0]);
}
