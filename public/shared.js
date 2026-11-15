// Shared between the server (Node) and the browser: guns, gun sets, maps, game modes, physics.
(function (root) {
  const MAX_HP = 500;

  // ---------- guns ----------
  const WEAPONS = {
    rifle:    { name: 'Assault Rifle', slot: 1, damage: 60,  fireDelay: 0.1,   auto: true,  mag: 30,  reload: 2.0, spread: 0.012, pellets: 1, range: 120, falloffStart: 40,  headMult: 1.6, recoil: 0.012, zoom: 1.4, speed: 1 },
    smg:      { name: 'SMG',           slot: 1, damage: 42,  fireDelay: 0.065, auto: true,  mag: 35,  reload: 1.6, spread: 0.025, pellets: 1, range: 60,  falloffStart: 15,  headMult: 1.5, recoil: 0.008, zoom: 1.25, speed: 1.05 },
    shotgun:  { name: 'Shotgun',       slot: 1, damage: 36,  fireDelay: 0.85,  auto: false, mag: 6,   reload: 2.4, spread: 0.07,  pellets: 9, range: 30,  falloffStart: 8,   headMult: 1.3, recoil: 0.05, zoom: 1.15, speed: 1 },
    sniper:   { name: 'Sniper',        slot: 1, damage: 260, fireDelay: 1.3,   auto: false, mag: 5,   reload: 2.6, spread: 0.001, pellets: 1, range: 250, falloffStart: 200, headMult: 2.0, recoil: 0.07, zoom: 4, speed: 0.92 },
    lmg:      { name: 'LMG',           slot: 1, damage: 50,  fireDelay: 0.085, auto: true,  mag: 100, reload: 4.0, spread: 0.022, pellets: 1, range: 100, falloffStart: 35,  headMult: 1.5, recoil: 0.01, zoom: 1.3, speed: 0.85 },
    dmr:      { name: 'DMR',           slot: 1, damage: 120, fireDelay: 0.3,   auto: false, mag: 10,  reload: 2.2, spread: 0.004, pellets: 1, range: 160, falloffStart: 80,  headMult: 1.8, recoil: 0.03, zoom: 2.2, speed: 0.97 },
    pistol:   { name: 'Pistol',        slot: 2, damage: 80,  fireDelay: 0.22,  auto: false, mag: 12,  reload: 1.3, spread: 0.01,  pellets: 1, range: 60,  falloffStart: 20,  headMult: 1.8, recoil: 0.02, zoom: 1.3, speed: 1.05 },
    revolver: { name: 'Revolver',      slot: 2, damage: 140, fireDelay: 0.5,   auto: false, mag: 6,   reload: 2.2, spread: 0.008, pellets: 1, range: 70,  falloffStart: 25,  headMult: 2.0, recoil: 0.05, zoom: 1.3, speed: 1.05 },
    knife:    { name: 'Knife',         slot: 2, melee: true, damage: 150, fireDelay: 0.45, auto: false, mag: Infinity, reload: 0, spread: 0, pellets: 1, range: 2.6, falloffStart: 99, headMult: 1.3, recoil: 0, zoom: 1, speed: 1.12 },
    claws:    { name: 'Claws',         slot: 0, melee: true, damage: 170, fireDelay: 0.5,  auto: false, mag: Infinity, reload: 0, spread: 0, pellets: 1, range: 2.8, falloffStart: 99, headMult: 1, recoil: 0, zoom: 1, speed: 1.15 },
  };
  const PRIMARIES = ['rifle', 'smg', 'shotgun', 'sniper', 'lmg', 'dmr'];
  const SECONDARIES = ['pistol', 'revolver', 'knife'];

  // specials: the Q button
  const SPECIALS = {
    medkit: { name: 'Medkit',        cooldown: 20, desc: 'Heal 250 HP.' },
    dash:   { name: 'Dash',          cooldown: 6,  desc: 'Burst forward really fast.' },
    summon: { name: 'Summon Undead', cooldown: 25, desc: 'Raise 3 undead that hunt enemies.' },
  };
  const SUMMON = { count: 3, life: 25, hp: 150, damage: 45, hitDelay: 1.0, speed: 4.3 };

  const COLORS = ['#ff4d4d', '#ff9f1a', '#ffd60a', '#3ddc84', '#00c2ff', '#4d7cff', '#b04dff', '#ff4dc4', '#ffffff', '#3a3a3a'];

  const DEFAULT_SETS = [
    { name: 'Assault',     primary: 'rifle',   secondary: 'pistol',   special: 'medkit', color: '#4d7cff' },
    { name: 'Rusher',      primary: 'shotgun', secondary: 'knife',    special: 'dash',   color: '#ff9f1a' },
    { name: 'Sniper',      primary: 'sniper',  secondary: 'pistol',   special: 'dash',   color: '#3ddc84' },
    { name: 'Necromancer', primary: 'smg',     secondary: 'knife',    special: 'summon', color: '#b04dff' },
    { name: 'Tank',        primary: 'lmg',     secondary: 'revolver', special: 'medkit', color: '#ff4d4d' },
    { name: 'Marksman',    primary: 'dmr',     secondary: 'revolver', special: 'dash',   color: '#00c2ff' },
  ];
  function cleanSet(s) {
    s = s || {};
    const name = String(s.name || '').replace(/[^\w \-.!?']/g, '').trim().slice(0, 24) || 'My Set';
    return {
      name,
      primary: PRIMARIES.includes(s.primary) ? s.primary : 'rifle',
      secondary: SECONDARIES.includes(s.secondary) ? s.secondary : 'pistol',
      special: SPECIALS[s.special] ? s.special : 'medkit',
      color: COLORS.includes(s.color) ? s.color : COLORS[0],
    };
  }

  // ---------- game modes ----------
  const MODES = {
    ffa:       { name: 'Free For All',    short: 'FFA',        teams: false, limit: 20, desc: 'Everyone vs everyone. First to 20 kills.' },
    tdm:       { name: 'Team Deathmatch', short: 'TDM',        teams: true,  limit: 40, desc: 'Red vs Blue. First team to 40 kills.' },
    koth:      { name: 'King of the Hill', short: 'KOTH',      teams: true,  limit: 100, desc: 'Stand in the glowing zone to score. First team to 100.' },
    gungame:   { name: 'Gun Game',        short: 'GUN GAME',   teams: false, desc: 'Every kill gives you the next gun. Win with the knife!' },
    infection: { name: 'Infection',       short: 'INFECTION',  teams: true,  time: 180, desc: 'One player starts infected. Get killed and you join them. Survive 3 minutes!' },
    horde:     { name: 'Undead Horde',    short: 'HORDE',      teams: false, coop: true, time: 600, desc: 'Team up against waves of undead. Survive 10 waves!' },
    oneshot:   { name: 'One Shot',        short: 'ONE SHOT',   teams: false, limit: 15, desc: 'Revolver with 1 bullet. Every hit kills. Kills give you a bullet.' },
    snipers:   { name: 'Snipers Only',    short: 'SNIPERS',    teams: false, limit: 20, desc: 'Everyone gets a sniper and a knife.' },
    knives:    { name: 'Knife Fight',     short: 'KNIVES',     teams: false, limit: 15, desc: 'Knives only. Get close!' },
  };
  const GUNGAME_ORDER = ['smg', 'rifle', 'lmg', 'shotgun', 'dmr', 'revolver', 'sniper', 'knife'];
  const GUNGAME_KILLS_PER_LEVEL = 1;
  const HORDE_WAVES = 10;

  // ---------- maps ----------
  function buildMap(theme, fn) {
    const boxes = [];
    const B = (cx, cz, w, d, h, y0 = 0, c = '#8a8f98', kind = 'concrete') => boxes.push({ x: cx - w / 2, y: y0, z: cz - d / 2, w, h, d, c, kind });
    const h = {
      box: B,
      crate: (x, z, s = 1.4, y0 = 0, c = '#9a7448') => B(x, z, s, s, s, y0, c, 'crate'),
      container: (x, z, alongX, c) => alongX ? B(x, z, 6, 2.5, 2.6, 0, c, 'metal') : B(x, z, 2.5, 6, 2.6, 0, c, 'metal'),
      lowWall: (x, z, w, d, c = '#7d8288') => B(x, z, w, d, 1.1, 0, c, 'concrete'),
      neon: (x, z, w, d, hh, y0, c) => B(x, z, w, d, hh, y0, c, 'neon'),
      // hollow building: doors = which sides have a door ('n','s','e','w')
      house(cx, cz, w, d, hh, c, doors = 'ns', kind = 'brick', roof = true) {
        const T = 0.4, door = 2.4, top = 2.6;
        const side = (horiz, fixed, len, hasDoor) => {
          const put = (center, l) => horiz ? B(center, fixed, l, T, hh, 0, c, kind) : B(fixed, center, T, l, hh, 0, c, kind);
          const mid = horiz ? cx : cz;
          if (!hasDoor) return put(mid, len);
          const seg = (len - door) / 2;
          put(mid - door / 2 - seg / 2, seg);
          put(mid + door / 2 + seg / 2, seg);
          if (horiz) B(mid, fixed, door, T, hh - top, top, c, kind); else B(fixed, mid, T, door, hh - top, top, c, kind);
        };
        side(true, cz - d / 2, w, doors.includes('n'));
        side(true, cz + d / 2, w, doors.includes('s'));
        side(false, cx - w / 2, d, doors.includes('w'));
        side(false, cx + w / 2, d, doors.includes('e'));
        if (roof) B(cx, cz, w + 0.4, d + 0.4, 0.3, hh, theme.roof || c, kind);
      },
      // stairs going up toward -z (dir=-1) or +z (dir=1), starting at (x, z)
      stairs(x, z, steps, dir, c, w = 1.6) {
        for (let i = 0; i < steps; i++) B(x, z + dir * i * 0.6, w, 0.6, (i + 1) * 0.5, 0, c, 'concrete');
      },
    };
    boxes.push({ x: -45, y: -1, z: -45, w: 90, h: 1, d: 90, c: theme.ground, kind: 'ground' });
    const wc = theme.wall || '#6e737a';
    B(0, -40.5, 82, 1, 6, 0, wc, theme.wallKind || 'brick');
    B(0, 40.5, 82, 1, 6, 0, wc, theme.wallKind || 'brick');
    B(-40.5, 0, 1, 82, 6, 0, wc, theme.wallKind || 'brick');
    B(40.5, 0, 1, 82, 6, 0, wc, theme.wallKind || 'brick');
    const extra = fn(h) || {};
    return { theme, boxes, hill: extra.hill || [0, 0, 5] };
  }

  const MAPS = {
    yard: { name: 'Yard', desc: 'Containers, towers and a center building.', ...buildMap(
      { sky: ['#3d6fb0', '#8fb8de', '#d9e4ea'], fog: '#c4d3dd', ground: '#5d6b4f', sun: '#fff1dc', sunI: 2.4, hemi: 1.1 },
      h => {
        h.house(0, 0, 14, 14, 4, '#b8ab93', 'nsew', 'brick', false);
        h.crate(-3.5, -3.5); h.crate(-3.5, -3.5, 1.4, 1.4); h.crate(3.5, 3.5); h.crate(2.1, 3.5);
        for (const s of [-1, 1]) {
          const tx = s * 27;
          h.box(tx, 0, 5, 5, 4, 0, '#8d8a84');
          h.stairs(tx, 7.0, 8, -1, '#9b978f');
          h.box(tx, -2.35, 5, 0.3, 1, 4, '#8d8a84');
          h.box(tx - s * 2.35, 0, 0.3, 5, 1, 4, '#8d8a84');
          const z = s * 31;
          h.lowWall(-8, z, 6, 0.6); h.lowWall(8, z, 6, 0.6);
          h.box(-14, z + s * 3, 0.6, 8, 3, 0, '#a0a4aa'); h.box(14, z + s * 3, 0.6, 8, 3, 0, '#a0a4aa');
          h.crate(-4, z - s * 2); h.crate(4, z - s * 2);
        }
        h.container(-18, -16, true, '#2f6d8c'); h.container(18, 16, true, '#8c3b2f');
        h.container(-18, 16, false, '#3f7a3a'); h.container(18, -16, false, '#c08a2a');
        h.box(18, -16, 2.5, 6, 2.6, 2.6, '#7a4f8c', 'metal');
        h.crate(-10, -10); h.crate(10, 10); h.crate(-10, 10); h.crate(10, -10);
        h.crate(-24, -26); h.crate(24, 26); h.crate(-30, 14); h.crate(30, -14);
        h.lowWall(-22, 0, 0.6, 5); h.lowWall(22, 0, 0.6, 5); h.lowWall(0, -18, 6, 0.6); h.lowWall(0, 18, 6, 0.6);
        return { hill: [0, 0, 5] };
      }) },

    desert: { name: 'Desert Town', desc: 'Sandy streets and houses you can run through.', ...buildMap(
      { sky: ['#e07b39', '#f6c36b', '#fbe7c0'], fog: '#f3d9a8', ground: '#d9b77e', sun: '#ffe2b0', sunI: 2.8, hemi: 1.0, wall: '#c99a62', roof: '#a8784a' },
      h => {
        const sand = '#d8a86a', clay = '#c98b55', light = '#e6c08a';
        h.house(-20, -20, 10, 8, 3.6, sand, 'nsew', 'concrete');
        h.house(20, -20, 8, 10, 3.6, clay, 'nsew', 'concrete');
        h.house(-20, 20, 8, 10, 3.6, clay, 'nsew', 'concrete');
        h.house(20, 20, 10, 8, 3.6, sand, 'nsew', 'concrete');
        h.house(0, -30, 12, 6, 3.6, light, 'ns', 'concrete');
        h.house(0, 30, 12, 6, 3.6, light, 'ns', 'concrete');
        // market in the middle (hill)
        for (const [x, z] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) {
          h.box(x, z, 0.3, 0.3, 2.6, 0, '#7a5530', 'crate');
          h.box(x, z, 3.4, 3.4, 0.15, 2.6, ['#ff4d4d', '#ffd60a', '#00c2ff', '#3ddc84'][(x > 0) + 2 * (z > 0)], 'concrete');
          h.crate(x, z, 1.1, 0, '#a07040');
        }
        h.box(-32, 0, 4, 4, 5, 0, light); h.stairs(-32, 7.7, 10, -1, sand);
        h.box(32, 0, 4, 4, 5, 0, light); h.stairs(32, -7.7, 10, 1, sand);
        h.box(-32, -1.85, 4, 0.3, 1, 5, light); h.box(32, 1.85, 4, 0.3, 1, 5, light);
        h.lowWall(-12, 0, 0.6, 6, clay); h.lowWall(12, 0, 0.6, 6, clay);
        h.lowWall(0, -14, 8, 0.6, clay); h.lowWall(0, 14, 8, 0.6, clay);
        h.crate(-30, -32); h.crate(30, 32); h.crate(-12, 30); h.crate(12, -30); h.crate(-27, 12); h.crate(27, -12);
        h.box(-10, -24, 2, 2, 1.2, 0, '#8a6a4a', 'concrete'); h.box(10, 24, 2, 2, 1.2, 0, '#8a6a4a', 'concrete');
        return { hill: [0, 0, 6] };
      }) },

    neon: { name: 'Neon City', desc: 'Glowing streets at night. Very colorful!', ...buildMap(
      { sky: ['#12002e', '#3b0a6b', '#ff4dc4'], fog: '#2a0b45', ground: '#2a2640', sun: '#d9c8ff', sunI: 1.6, hemi: 1.8, wall: '#3a3458', wallKind: 'metal', night: true },
      h => {
        const dark = '#4a4478', dark2 = '#5a5488';
        const neonCols = ['#ff2bd6', '#00f0ff', '#ffe600', '#39ff14', '#ff6b00', '#7b5cff'];
        let k = 0;
        // city blocks with glowing stripes
        for (const [x, z, w, d, hh] of [[-22, -22, 10, 10, 7], [22, -22, 10, 10, 9], [-22, 22, 10, 10, 9], [22, 22, 10, 10, 7], [-22, 0, 6, 8, 5], [22, 0, 6, 8, 5]]) {
          h.box(x, z, w, d, hh, 0, dark, 'metal');
          const c = neonCols[k++ % neonCols.length];
          h.neon(x, z, w + 0.1, d + 0.1, 0.25, hh * 0.45, c);
          h.neon(x, z, w + 0.1, d + 0.1, 0.25, hh - 0.4, neonCols[(k + 2) % neonCols.length]);
        }
        // raised walkway across the middle
        h.box(0, -8, 16, 3, 3, 0, dark2, 'metal');
        h.neon(0, -6.4, 16, 0.2, 0.2, 3, '#00f0ff');
        h.box(0, 8, 16, 3, 3, 0, dark2, 'metal');
        h.neon(0, 6.4, 16, 0.2, 0.2, 3, '#ff2bd6');
        // glowing cover
        for (const [x, z] of [[0, 0], [-10, 2], [10, -2], [-14, 30], [14, -30], [0, 28], [0, -28], [-32, 12], [32, -12]]) {
          h.box(x, z, 1.6, 1.6, 1.4, 0, dark2, 'metal');
          h.neon(x, z, 1.7, 1.7, 0.12, 1.4, neonCols[k++ % neonCols.length]);
        }
        h.container(-8, 30, true, '#ff2bd6'); h.container(8, -30, true, '#00f0ff');
        h.container(-32, -8, false, '#ffe600'); h.container(32, 8, false, '#39ff14');
        return { hill: [0, 0, 4.5] };
      }) },

    snow: { name: 'Snow Forts', desc: 'Two forts in the snow with a frozen middle.', ...buildMap(
      { sky: ['#7fa6c9', '#c8dcec', '#f1f6fa'], fog: '#e3edf5', ground: '#eef3f7', sun: '#ffffff', sunI: 2.2, hemi: 1.3, wall: '#9fb4c6', roof: '#7d8fa0' },
      h => {
        const ice = '#bfe3f2', stone = '#8d9aa6', wood = '#6b4a2b', pine = '#2f6b4a';
        for (const s of [-1, 1]) {
          const z = s * 28;
          // fort walls with a gap in the middle
          h.box(-9, z - s * 6, 10, 1, 3, 0, stone); h.box(9, z - s * 6, 10, 1, 3, 0, stone);
          h.box(-14, z, 1, 12, 3, 0, stone); h.box(14, z, 1, 12, 3, 0, stone);
          h.box(-14, z - s * 6, 2, 2, 5, 0, stone); h.box(14, z - s * 6, 2, 2, 5, 0, stone);
          h.house(0, z + s * 3, 8, 5, 3.4, '#a7b3bd', s < 0 ? 's' : 'n', 'brick');
          h.crate(-6, z, 1.4, 0, wood); h.crate(6, z, 1.4, 0, wood);
        }
        // frozen middle with ice blocks
        for (const [x, z, w, d, hh] of [[0, 0, 4, 1, 1.2], [-8, 4, 1, 4, 1.4], [8, -4, 1, 4, 1.4], [-16, -6, 3, 3, 2], [16, 6, 3, 3, 2], [-4, -10, 2, 2, 1.2], [4, 10, 2, 2, 1.2]]) {
          h.box(x, z, w, d, hh, 0, ice, 'ice');
        }
        // pine trees
        for (const [x, z] of [[-30, -10], [-33, 4], [-27, 14], [30, 10], [33, -4], [27, -14], [-22, 0], [22, 0], [-34, -30], [34, 30]]) {
          h.box(x, z, 0.5, 0.5, 1.2, 0, wood, 'crate');
          h.box(x, z, 2.6, 2.6, 1.4, 1.2, pine, 'leaf');
          h.box(x, z, 1.8, 1.8, 1.2, 2.6, pine, 'leaf');
          h.box(x, z, 1, 1, 1, 3.8, pine, 'leaf');
        }
        return { hill: [0, 0, 5] };
      }) },
  };
  // side stairs up to the neon walkways
  (function fixNeon() {
    const m = MAPS.neon;
    for (const zc of [-8, 8]) for (const sx of [-1, 1]) {
      for (let i = 0; i < 6; i++) m.boxes.push({ x: sx * (8 + 0.3 + (5 - i) * 0.6) - 0.3, y: 0, z: zc - 1.5, w: 0.6, h: (i + 1) * 0.5, d: 3, c: '#5a5488', kind: 'concrete' });
    }
  })();

  // ---------- shared physics ----------
  const GRAVITY = 22, STEP = 0.55;
  function collides(boxes, x, y, z, r, h) {
    for (const b of boxes) {
      if (x + r > b.x && x - r < b.x + b.w && z + r > b.z && z - r < b.z + b.d &&
          y + h > b.y + 1e-4 && y < b.y + b.h - 1e-4) return b;
    }
    return null;
  }
  function floorUnder(boxes, x, z, r, fromY, maxY) {
    let top = fromY;
    for (const b of boxes) {
      if (x + r > b.x && x - r < b.x + b.w && z + r > b.z && z - r < b.z + b.d) {
        const t = b.y + b.h;
        if (t > top && t <= maxY + 1e-4) top = t;
      }
    }
    return top;
  }
  function moveBody(b, dt, boxes) {
    b.vy -= GRAVITY * dt;
    const grounded = b.onGround;
    b.blocked = false;
    for (let axis = 0; axis < 2; axis++) {
      const v = axis === 0 ? b.vx : b.vz;
      if (!v) continue;
      const nx = axis === 0 ? b.x + v * dt : b.x;
      const nz = axis === 1 ? b.z + v * dt : b.z;
      if (!collides(boxes, nx, b.y, nz, b.r, b.h)) { b.x = nx; b.z = nz; continue; }
      if (grounded && !collides(boxes, nx, b.y + STEP, nz, b.r, b.h)) {
        b.x = nx; b.z = nz;
        b.y = floorUnder(boxes, nx, nz, b.r, b.y, b.y + STEP);
        continue;
      }
      if (axis === 0) b.vx = 0; else b.vz = 0;
      b.blocked = true;
    }
    b.onGround = false;
    const ny = b.y + b.vy * dt;
    const hit = collides(boxes, b.x, ny, b.z, b.r, b.h);
    if (!hit) { b.y = ny; return; }
    if (b.vy < 0) { b.y = floorUnder(boxes, b.x, b.z, b.r, -50, b.y + 0.05); b.onGround = true; }
    else b.y = hit.y - b.h - 1e-3;
    b.vy = 0;
  }

  const api = { MAX_HP, WEAPONS, PRIMARIES, SECONDARIES, SPECIALS, SUMMON, COLORS, DEFAULT_SETS, cleanSet,
    MODES, GUNGAME_ORDER, GUNGAME_KILLS_PER_LEVEL, HORDE_WAVES, MAPS, collides, moveBody, GRAVITY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GNS = api;
})(typeof window !== 'undefined' ? window : globalThis);
