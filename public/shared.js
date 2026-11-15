// Shared between the server (Node) and the browser: map, weapons, game modes.
(function (root) {
  const boxes = [];
  // box centered on (cx, cz), standing on y0
  function box(cx, cz, w, d, h, y0 = 0, c = '#8a8f98', kind = 'concrete') {
    boxes.push({ x: cx - w / 2, y: y0, z: cz - d / 2, w, h, d, c, kind });
  }
  const crate = (x, z, s = 1.4, y0 = 0) => box(x, z, s, s, s, y0, '#9a7448', 'crate');
  const container = (x, z, alongX, c) => alongX ? box(x, z, 6, 2.5, 2.6, 0, c, 'metal') : box(x, z, 2.5, 6, 2.6, 0, c, 'metal');
  const lowWall = (x, z, w, d) => box(x, z, w, d, 1.1, 0, '#7d8288', 'concrete');

  // ground
  boxes.push({ x: -45, y: -1, z: -45, w: 90, h: 1, d: 90, c: '#5d6b4f', kind: 'ground' });

  // outer walls
  box(0, -40.5, 82, 1, 5, 0, '#6e737a', 'brick');
  box(0, 40.5, 82, 1, 5, 0, '#6e737a', 'brick');
  box(-40.5, 0, 1, 82, 5, 0, '#6e737a', 'brick');
  box(40.5, 0, 1, 82, 5, 0, '#6e737a', 'brick');

  // central building (14x14, 4 high, doors in the middle of each side)
  const H = 4, T = 0.6, half = 7, seg = 5.5;
  for (const s of [-1, 1]) {
    box(-half + seg / 2, s * half, seg, T, H, 0, '#b8ab93', 'brick');
    box(half - seg / 2, s * half, seg, T, H, 0, '#b8ab93', 'brick');
    box(s * half, -half + seg / 2, T, seg, H, 0, '#b8ab93', 'brick');
    box(s * half, half - seg / 2, T, seg, H, 0, '#b8ab93', 'brick');
    // lintels above the doors
    box(0, s * half, 3, T, 1, 3, '#b8ab93', 'brick');
    box(s * half, 0, T, 3, 1, 3, '#b8ab93', 'brick');
  }
  crate(-3.5, -3.5); crate(-3.5, -3.5, 1.4, 1.4); crate(3.5, 3.5); crate(2.1, 3.5);
  lowWall(0, 0, 3, 0.5);

  // two sniper towers with stairs (east / west)
  for (const s of [-1, 1]) {
    const tx = s * 27;
    box(tx, 0, 5, 5, 4, 0, '#8d8a84', 'concrete');
    // stairs climbing toward the tower along z
    for (let i = 0; i < 8; i++) {
      box(tx, 2.5 + 0.3 + (7 - i) * 0.6, 1.6, 0.6, (i + 1) * 0.5, 0, '#9b978f', 'concrete');
    }
    // parapets on top
    box(tx, -2.35, 5, 0.3, 1, 4, '#8d8a84', 'concrete');
    box(tx - s * 2.35, 0, 0.3, 5, 1, 4, '#8d8a84', 'concrete');
  }

  // team bases (red north at -z, blue south at +z)
  for (const s of [-1, 1]) {
    const z = s * 31;
    lowWall(-8, z, 6, 0.6); lowWall(8, z, 6, 0.6);
    box(-14, z + s * 3, 0.6, 8, 3, 0, '#a0a4aa', 'concrete');
    box(14, z + s * 3, 0.6, 8, 3, 0, '#a0a4aa', 'concrete');
    crate(-4, z - s * 2); crate(4, z - s * 2); crate(0, z + s * 1.5, 1.4);
  }

  // shipping containers in the lanes
  container(-18, -16, true, '#2f6d8c');
  container(18, 16, true, '#8c3b2f');
  container(-18, 16, false, '#3f7a3a');
  container(18, -16, false, '#c08a2a');
  box(18, -16, 2.5, 6, 2.6, 2.6, '#7a4f8c', 'metal');  // stacked container

  // scattered cover
  crate(-10, -10); crate(10, 10); crate(-10, 10); crate(10, -10);
  crate(-24, -26); crate(24, 26); crate(-30, 14); crate(30, -14);
  crate(-30, 14, 1.4, 1.4);
  lowWall(-22, 0, 0.6, 5); lowWall(22, 0, 0.6, 5);
  lowWall(0, -18, 6, 0.6); lowWall(0, 18, 6, 0.6);
  lowWall(-33, -6, 0.6, 4); lowWall(33, 6, 0.6, 4);

  const spawns = {
    // [x, y, z, yaw]  (yaw 0 = looking toward -z)
    team: [
      [[-6, 0, -36, Math.PI], [0, 0, -36, Math.PI], [6, 0, -36, Math.PI], [-11, 0, -34, Math.PI], [11, 0, -34, Math.PI], [-2, 0, -26, Math.PI], [2, 0, -26, Math.PI]],
      [[-6, 0, 36, 0], [0, 0, 36, 0], [6, 0, 36, 0], [-11, 0, 34, 0], [11, 0, 34, 0], [-2, 0, 26, 0], [2, 0, 26, 0]],
    ],
    ffa: [
      [-35, 0, -35, Math.PI * 0.75], [35, 0, -35, -Math.PI * 0.75], [-35, 0, 35, Math.PI * 0.25], [35, 0, 35, -Math.PI * 0.25],
      [0, 0, -36, Math.PI], [0, 0, 36, 0], [-36, 0, 0, Math.PI / 2], [36, 0, 0, -Math.PI / 2],
      [0, 0, -5, 0], [-14, 0, -24, Math.PI], [14, 0, 24, 0], [-27, 4, 0, Math.PI / 2], [27, 4, 0, -Math.PI / 2],
      [-28, 0, 24, 0], [28, 0, -24, Math.PI],
    ],
  };

  const MAP = { size: 80, boxes, spawns };

  const WEAPONS = {
    rifle:   { name: 'Assault Rifle', damage: 24, fireDelay: 0.1,   auto: true,  mag: 30, reload: 2.0, spread: 0.012, pellets: 1, range: 120, falloffStart: 40,  headMult: 1.6, recoil: 0.012, zoom: 1.4 },
    smg:     { name: 'SMG',           damage: 17, fireDelay: 0.065, auto: true,  mag: 35, reload: 1.6, spread: 0.025, pellets: 1, range: 60,  falloffStart: 15,  headMult: 1.5, recoil: 0.008, zoom: 1.25 },
    shotgun: { name: 'Shotgun',       damage: 14, fireDelay: 0.85,  auto: false, mag: 6,  reload: 2.4, spread: 0.07,  pellets: 9, range: 30,  falloffStart: 8,   headMult: 1.3, recoil: 0.05,  zoom: 1.15 },
    pistol:  { name: 'Pistol',        damage: 32, fireDelay: 0.22,  auto: false, mag: 12, reload: 1.3, spread: 0.01,  pellets: 1, range: 60,  falloffStart: 20,  headMult: 1.8, recoil: 0.02,  zoom: 1.3 },
    sniper:  { name: 'Sniper',        damage: 95, fireDelay: 1.3,   auto: false, mag: 5,  reload: 2.6, spread: 0.001, pellets: 1, range: 250, falloffStart: 200, headMult: 2.0, recoil: 0.07,  zoom: 4 },
  };
  WEAPONS.knife = { name: 'Knife', melee: true, damage: 55, fireDelay: 0.45, auto: false, mag: Infinity, reload: 0, spread: 0, pellets: 1, range: 2.6, falloffStart: 99, headMult: 1.3, recoil: 0, zoom: 1 };
  const WEAPON_KEYS = ['rifle', 'smg', 'shotgun', 'pistol', 'sniper', 'knife'];

  // The 4 classes ("sets") players can pick
  const CLASSES = {
    rifle:    { name: 'Rifleman',        weapons: ['rifle', 'pistol'],  hp: 100, speed: 1.0,  desc: 'Assault rifle + pistol. Good at every range.' },
    close:    { name: 'Close Combat',    weapons: ['shotgun', 'knife'], hp: 125, speed: 1.12, desc: 'Shotgun + knife. More health, runs faster.' },
    sniper:   { name: 'Sniper',          weapons: ['sniper', 'pistol'], hp: 90,  speed: 1.0,  desc: 'Sniper rifle + pistol. One headshot = one kill.' },
    summoner: { name: 'Undead Summoner', weapons: ['smg', 'knife'],     hp: 100, speed: 1.0,  desc: 'SMG + knife. Press Q to raise 3 undead that hunt enemies.', ability: true },
  };
  const SUMMON = { count: 3, cooldown: 20, life: 25, hp: 50, damage: 12, hitDelay: 1.0, speed: 4.3 };

  const GUNGAME_ORDER = ['smg', 'rifle', 'shotgun', 'pistol', 'sniper', 'knife'];
  const GUNGAME_KILLS_PER_LEVEL = 2;

  const MODES = {
    ffa: { name: 'Free For All', short: 'FFA', scoreLimit: 25, desc: 'Everyone vs everyone. First to 25 kills wins.' },
    tdm: { name: 'Team Deathmatch', short: 'TDM', scoreLimit: 50, desc: 'Red vs Blue. First team to 50 kills wins.' },
    gungame: { name: 'Gun Game', short: 'GUN GAME', scoreLimit: 0, desc: `Get ${GUNGAME_KILLS_PER_LEVEL} kills to get the next gun. Win with a knife kill at the end!` },
  };

  // ---------- shared physics (players, bots and undead all move with this) ----------
  const GRAVITY = 22, STEP = 0.55;
  function collides(x, y, z, r, h) {
    for (const b of boxes) {
      if (x + r > b.x && x - r < b.x + b.w && z + r > b.z && z - r < b.z + b.d &&
          y + h > b.y + 1e-4 && y < b.y + b.h - 1e-4) return b;
    }
    return null;
  }
  function floorUnder(x, z, r, fromY, maxY) {
    let top = fromY;
    for (const b of boxes) {
      if (x + r > b.x && x - r < b.x + b.w && z + r > b.z && z - r < b.z + b.d) {
        const t = b.y + b.h;
        if (t > top && t <= maxY + 1e-4) top = t;
      }
    }
    return top;
  }
  // body: {x,y,z,vx,vy,vz,r,h,onGround}
  function moveBody(b, dt) {
    b.vy -= GRAVITY * dt;
    const grounded = b.onGround;
    b.blocked = false;
    for (let axis = 0; axis < 2; axis++) {
      const v = axis === 0 ? b.vx : b.vz;
      if (!v) continue;
      const nx = axis === 0 ? b.x + v * dt : b.x;
      const nz = axis === 1 ? b.z + v * dt : b.z;
      if (!collides(nx, b.y, nz, b.r, b.h)) { b.x = nx; b.z = nz; continue; }
      if (grounded && !collides(nx, b.y + STEP, nz, b.r, b.h)) {
        b.x = nx; b.z = nz;
        b.y = floorUnder(nx, nz, b.r, b.y, b.y + STEP);
        continue;
      }
      if (axis === 0) b.vx = 0; else b.vz = 0;
      b.blocked = true;
    }
    b.onGround = false;
    const ny = b.y + b.vy * dt;
    let hit = collides(b.x, ny, b.z, b.r, b.h);
    if (!hit) { b.y = ny; return; }
    if (b.vy < 0) {
      b.y = floorUnder(b.x, b.z, b.r, -50, b.y + 0.05);
      b.onGround = true;
    } else {
      b.y = hit.y - b.h - 1e-3;
    }
    b.vy = 0;
  }

  const api = { MAP, WEAPONS, WEAPON_KEYS, CLASSES, SUMMON, GUNGAME_ORDER, GUNGAME_KILLS_PER_LEVEL, MODES, collides, moveBody, GRAVITY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GNS = api;
})(typeof window !== 'undefined' ? window : globalThis);
