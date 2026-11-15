// Shared between the server (Node) and the browser: guns, gun sets, maps, game modes, physics.
(function (root) {
  const MAX_HP = 500;

  // ---------- weapons (from the G-NS Armory) ----------
  // base stats per weapon type; each gun then gets its own tweaks below
  const TYPES = {
    ar:       { damage: 60,  fireDelay: 0.1,   auto: true,  mag: 30, reload: 2.0, spread: 0.012, pellets: 1, range: 120, falloffStart: 40,  headMult: 1.6, recoil: 0.012, zoom: 1.4,  speed: 1,    len: 0.9 },
    ak:       { damage: 68,  fireDelay: 0.11,  auto: true,  mag: 30, reload: 2.2, spread: 0.016, pellets: 1, range: 115, falloffStart: 38,  headMult: 1.6, recoil: 0.017, zoom: 1.4,  speed: 1,    len: 0.92 },
    battle:   { damage: 82,  fireDelay: 0.125, auto: true,  mag: 20, reload: 2.3, spread: 0.014, pellets: 1, range: 130, falloffStart: 50,  headMult: 1.6, recoil: 0.02,  zoom: 1.5,  speed: 0.97, len: 0.98 },
    sil:      { damage: 56,  fireDelay: 0.08,  auto: true,  mag: 20, reload: 1.9, spread: 0.014, pellets: 1, range: 90,  falloffStart: 30,  headMult: 1.8, recoil: 0.01,  zoom: 1.5,  speed: 1.02, len: 0.88 },
    smg:      { damage: 42,  fireDelay: 0.065, auto: true,  mag: 30, reload: 1.6, spread: 0.025, pellets: 1, range: 60,  falloffStart: 15,  headMult: 1.5, recoil: 0.008, zoom: 1.25, speed: 1.06, len: 0.6 },
    shotgun:  { damage: 36,  fireDelay: 0.85,  auto: false, mag: 6,  reload: 2.4, spread: 0.07,  pellets: 9, range: 30,  falloffStart: 8,   headMult: 1.3, recoil: 0.05,  zoom: 1.15, speed: 1,    len: 1.0 },
    autoshot: { damage: 30,  fireDelay: 0.3,   auto: false, mag: 8,  reload: 2.6, spread: 0.08,  pellets: 9, range: 26,  falloffStart: 7,   headMult: 1.3, recoil: 0.045, zoom: 1.15, speed: 1,    len: 1.0 },
    lmg:      { damage: 52,  fireDelay: 0.085, auto: true,  mag: 100, reload: 4.0, spread: 0.022, pellets: 1, range: 100, falloffStart: 35, headMult: 1.5, recoil: 0.011, zoom: 1.3,  speed: 0.85, len: 1.1 },
    dmr:      { damage: 120, fireDelay: 0.3,   auto: false, mag: 20, reload: 2.4, spread: 0.004, pellets: 1, range: 160, falloffStart: 80,  headMult: 1.8, recoil: 0.03,  zoom: 2.4,  speed: 0.96, len: 1.1, scope: true },
    sniper:   { damage: 260, fireDelay: 1.3,   auto: false, mag: 5,  reload: 2.6, spread: 0.001, pellets: 1, range: 250, falloffStart: 200, headMult: 2.0, recoil: 0.07,  zoom: 4,    speed: 0.92, len: 1.25, scope: true },
    pistol:   { damage: 80,  fireDelay: 0.22,  auto: false, mag: 15, reload: 1.3, spread: 0.01,  pellets: 1, range: 60,  falloffStart: 20,  headMult: 1.8, recoil: 0.02,  zoom: 1.3,  speed: 1.05, len: 0.21 },
    compact:  { damage: 70,  fireDelay: 0.2,   auto: false, mag: 10, reload: 1.2, spread: 0.013, pellets: 1, range: 50,  falloffStart: 15,  headMult: 1.8, recoil: 0.02,  zoom: 1.25, speed: 1.07, len: 0.17 },
    heavy:    { damage: 105, fireDelay: 0.28,  auto: false, mag: 8,  reload: 1.5, spread: 0.011, pellets: 1, range: 60,  falloffStart: 20,  headMult: 1.8, recoil: 0.03,  zoom: 1.3,  speed: 1.04, len: 0.23 },
    machpist: { damage: 55,  fireDelay: 0.055, auto: true,  mag: 33, reload: 1.5, spread: 0.03,  pellets: 1, range: 45,  falloffStart: 12,  headMult: 1.6, recoil: 0.015, zoom: 1.2,  speed: 1.05, len: 0.22 },
    deagle:   { damage: 150, fireDelay: 0.42,  auto: false, mag: 7,  reload: 1.8, spread: 0.01,  pellets: 1, range: 70,  falloffStart: 25,  headMult: 2.0, recoil: 0.06,  zoom: 1.35, speed: 1.03, len: 0.27 },
    revolver: { damage: 140, fireDelay: 0.5,   auto: false, mag: 6,  reload: 2.2, spread: 0.008, pellets: 1, range: 70,  falloffStart: 25,  headMult: 2.0, recoil: 0.05,  zoom: 1.3,  speed: 1.05, len: 0.3 },
    magnum:   { damage: 175, fireDelay: 0.62,  auto: false, mag: 6,  reload: 2.5, spread: 0.008, pellets: 1, range: 75,  falloffStart: 30,  headMult: 2.0, recoil: 0.07,  zoom: 1.35, speed: 1.03, len: 0.33 },
    blade:    { melee: true, damage: 150, fireDelay: 0.45, auto: false, mag: Infinity, reload: 0, spread: 0, pellets: 1, range: 2.6, falloffStart: 99, headMult: 1.3, recoil: 0, zoom: 1, speed: 1.12, len: 0.3 },
  };
  // [id, name, type, tweaks]
  const PRIMARY_LIST = [
    ['hk416', 'HK416', 'ar'], ['ak74', 'AK-74', 'ak'], ['mp5', 'MP5', 'smg'], ['m4', 'Benelli M4', 'autoshot'], ['awm', 'AWM', 'sniper'],
    ['primary5', 'M4A1', 'ar', { fireDelay: 0.09 }], ['primary6', 'AKM', 'ak', { damage: 74, recoil: 0.02 }], ['primary7', 'AK-12', 'ak', { spread: 0.013 }],
    ['primary8', 'AK-103', 'ak', { damage: 72 }], ['primary9', 'AKS-74U', 'ak', { damage: 60, fireDelay: 0.09, range: 70, speed: 1.04, len: 0.7 }],
    ['primary10', 'SCAR-L', 'ar'], ['primary11', 'SCAR-H', 'battle'], ['primary12', 'G36C', 'ar', { len: 0.75, speed: 1.02 }], ['primary13', 'G36K', 'ar'],
    ['primary14', 'AUG A3', 'ar', { spread: 0.01 }], ['primary15', 'FAMAS', 'ar', { fireDelay: 0.067, mag: 25 }], ['primary16', 'L85A2', 'ar', { spread: 0.009 }],
    ['primary17', 'Tavor X95', 'ar', { len: 0.75 }], ['primary18', 'F2000', 'ar', { mag: 30, fireDelay: 0.085 }], ['primary19', 'SIG MCX', 'ar'],
    ['primary20', 'SIG 553', 'ar', { damage: 64 }], ['primary21', 'Bren 2', 'ar', { fireDelay: 0.08 }], ['primary22', 'ACR', 'ar'], ['primary23', 'HK433', 'ar'],
    ['primary24', 'QBZ-95', 'ar', { len: 0.78 }], ['primary25', 'AN-94', 'ak', { fireDelay: 0.08, spread: 0.012 }], ['primary26', 'AS VAL', 'sil'],
    ['primary27', 'VSS Vintorez', 'dmr', { damage: 100, fireDelay: 0.2, mag: 10, zoom: 2 }], ['primary28', 'SR-3M', 'sil', { mag: 30, fireDelay: 0.075 }],
    ['primary29', 'MP7', 'smg', { mag: 40, fireDelay: 0.06 }], ['primary30', 'P90', 'smg', { mag: 50 }], ['primary31', 'UMP45', 'smg', { damage: 52, fireDelay: 0.09, mag: 25 }],
    ['primary32', 'Vector', 'smg', { fireDelay: 0.048, mag: 25, damage: 40 }], ['primary33', 'MPX', 'smg'], ['primary34', 'Scorpion EVO', 'smg', { fireDelay: 0.055 }],
    ['primary35', 'PP-19 Vityaz', 'smg'], ['primary36', 'Uzi', 'smg', { fireDelay: 0.07, mag: 32 }], ['primary37', 'MAC-10', 'smg', { fireDelay: 0.045, spread: 0.035, damage: 38 }],
    ['primary38', 'SPAS-12', 'shotgun', { mag: 8 }], ['primary39', 'Mossberg 590', 'shotgun', { mag: 8 }], ['primary40', 'Remington 870', 'shotgun', { damage: 40 }],
    ['primary41', 'Saiga-12', 'autoshot', { mag: 10, fireDelay: 0.26 }], ['primary42', 'KSG', 'shotgun', { mag: 14, fireDelay: 0.8 }],
    ['primary43', 'M249', 'lmg'], ['primary44', 'M240', 'lmg', { damage: 62, fireDelay: 0.1 }], ['primary45', 'PKM', 'lmg', { damage: 62, fireDelay: 0.095 }],
    ['primary46', 'MG3', 'lmg', { fireDelay: 0.05, mag: 120, spread: 0.028 }], ['primary47', 'RPK-74', 'lmg', { mag: 45, reload: 2.8, speed: 0.92 }],
    ['primary48', 'M110', 'dmr'], ['primary49', 'Barrett M82', 'sniper', { damage: 320, fireDelay: 0.55, mag: 10, speed: 0.85, len: 1.45 }],
  ];
  const SECONDARY_LIST = [
    ['g17', 'Glock 17', 'pistol', { mag: 17 }], ['m1911', 'M1911', 'heavy', { mag: 7 }], ['secondary2', 'Glock 19', 'pistol'], ['secondary3', 'Glock 18', 'machpist'],
    ['secondary4', 'Glock 26', 'compact'], ['secondary5', 'Glock 34', 'pistol', { mag: 17, spread: 0.007 }], ['secondary6', 'Beretta M9', 'pistol'], ['secondary7', 'Beretta 92X', 'pistol'],
    ['secondary8', 'SIG P226', 'pistol'], ['secondary9', 'SIG P229', 'pistol', { mag: 13 }], ['secondary10', 'SIG P320', 'pistol', { mag: 17 }], ['secondary11', 'SIG P365', 'compact'],
    ['secondary12', 'HK USP', 'heavy', { mag: 12, damage: 92 }], ['secondary13', 'HK P30', 'pistol'], ['secondary14', 'HK VP9', 'pistol'], ['secondary15', 'HK Mark 23', 'heavy', { mag: 12 }],
    ['secondary16', 'FN Five-seveN', 'pistol', { mag: 20, damage: 70, fireDelay: 0.18 }], ['secondary17', 'FN 509', 'pistol', { mag: 17 }], ['secondary18', 'FN FNX-45', 'heavy', { mag: 15 }],
    ['secondary19', 'CZ 75', 'pistol', { mag: 16 }], ['secondary20', 'CZ P-07', 'pistol'], ['secondary21', 'CZ P-09', 'pistol', { mag: 19 }], ['secondary22', 'CZ P-10 C', 'pistol'],
    ['secondary23', 'Walther P99', 'pistol'], ['secondary24', 'Walther PPQ', 'pistol'], ['secondary25', 'Walther PDP', 'pistol', { mag: 18 }], ['secondary26', 'Walther PPK', 'compact', { mag: 7, damage: 65 }],
    ['secondary27', 'Browning Hi-Power', 'pistol', { mag: 13 }], ['secondary28', 'Desert Eagle', 'deagle'], ['secondary29', 'Jericho 941', 'pistol', { mag: 16 }], ['secondary30', 'Steyr M9', 'pistol'],
    ['secondary31', 'Springfield XD', 'pistol', { mag: 16 }], ['secondary32', 'Springfield Hellcat', 'compact', { mag: 11 }], ['secondary33', 'Ruger SR9', 'pistol', { mag: 17 }],
    ['secondary34', 'Ruger American', 'pistol', { mag: 17 }], ['secondary35', 'Ruger LCP', 'compact', { mag: 6, damage: 60 }], ['secondary36', 'S&W M&P9', 'pistol', { mag: 17 }],
    ['secondary37', 'S&W Shield', 'compact', { mag: 8 }], ['secondary38', 'S&W Model 29', 'magnum'], ['secondary39', 'S&W Model 686', 'revolver', { mag: 7 }],
    ['secondary40', 'Colt Python', 'magnum', { damage: 160, fireDelay: 0.55 }], ['secondary41', 'Colt King Cobra', 'revolver'], ['secondary42', 'Colt Detective Special', 'revolver', { damage: 120, fireDelay: 0.45, len: 0.24 }],
    ['secondary43', 'Ruger GP100', 'revolver'], ['secondary44', 'Ruger Redhawk', 'magnum'], ['secondary45', 'Chiappa Rhino', 'revolver', { fireDelay: 0.4 }],
    ['secondary46', 'Webley Mk VI', 'revolver', { damage: 130 }], ['secondary47', 'Nagant M1895', 'revolver', { damage: 110, mag: 7 }], ['secondary48', 'Tokarev TT-33', 'pistol', { mag: 8, damage: 85 }],
    ['secondary49', 'Makarov PM', 'compact', { mag: 8, damage: 75 }],
  ];
  const BLADE_LIST = [
    ['kabar', 'KA-BAR', 'blade'], ['fs', 'Fairbairn–Sykes', 'blade', { damage: 140, fireDelay: 0.38 }], ['karambit', 'Karambit', 'blade', { damage: 120, fireDelay: 0.3, range: 2.3, len: 0.22 }],
    ['strongarm', 'Gerber StrongArm', 'blade'], ['m9', 'M9 Bayonet', 'blade', { damage: 155, range: 2.7 }], ['blades5', 'Tanto', 'blade', { damage: 155 }],
    ['blades6', 'Kukri', 'blade', { damage: 190, fireDelay: 0.6, range: 2.8, len: 0.4 }], ['blades7', 'Bowie', 'blade', { damage: 165, fireDelay: 0.5, len: 0.36 }],
    ['blades8', 'Push Dagger', 'blade', { damage: 110, fireDelay: 0.25, range: 2.2, len: 0.16 }], ['blades9', 'Combat Tomahawk', 'blade', { damage: 210, fireDelay: 0.7, range: 3, len: 0.42 }],
  ];
  const WEAPONS = {};
  for (const [id, name, type, tweaks] of [...PRIMARY_LIST, ...SECONDARY_LIST, ...BLADE_LIST]) {
    WEAPONS[id] = Object.assign({ name, type }, TYPES[type], tweaks || {});
  }
  WEAPONS.claws = Object.assign({}, TYPES.blade, { name: 'Claws', type: 'claws', damage: 170, fireDelay: 0.5, range: 2.8, speed: 1.15 });
  const PRIMARIES = PRIMARY_LIST.map(r => r[0]);
  const SECONDARIES = SECONDARY_LIST.map(r => r[0]);
  const BLADES = BLADE_LIST.map(r => r[0]);

  // equipment = the Q button
  const EQUIPMENT = {
    drone:      { name: 'Camera Quadcopter',   cooldown: 30, desc: 'Fly a drone up: see every enemy through walls for 8 seconds.' },
    m67:        { name: 'M67 Grenade',         cooldown: 10, desc: 'Throw a grenade. Big boom after 2 seconds.' },
    equipment2: { name: 'Field Radio',         cooldown: 30, desc: 'Call 3 backup soldiers. They get better guns every time you call them!' },
    equipment3: { name: 'Night Vision',        cooldown: 20, desc: 'See bright green for 15 seconds. Enemies glow.' },
    equipment4: { name: 'Medical Kit',         cooldown: 20, desc: 'Heal 250 HP.' },
    equipment5: { name: 'Rangefinder',         cooldown: 20, desc: 'Your shots do 50% more damage for 8 seconds.' },
    equipment6: { name: 'Tactical Flashlight', cooldown: 15, desc: 'Blind enemies in front of you for 2.5 seconds.' },
    equipment7: { name: 'Ballistic Shield',    cooldown: 20, desc: 'Take 70% less damage for 6 seconds.' },
    equipment8: { name: 'Utility Pack',        cooldown: 25, desc: 'Refill all ammo and heal 150 HP.' },
    equipment9: { name: 'Camera Sensor',       cooldown: 30, desc: 'Drop a sensor: see enemies near it through walls for 40 seconds.' },
  };
  const OPERATORS = {
    woman:      { name: 'Woman · Black kit',  woman: true,  color: '#303438' },
    man:        { name: 'Man · Black kit',    woman: false, color: '#303438' },
    operators2: { name: 'Recon · Woodland',   woman: true,  color: '#45513c', pack: true, goggles: true },
    operators3: { name: 'Scout · Desert',     woman: false, color: '#9c8a65', pack: true },
    operators4: { name: 'Breacher · Urban',   woman: true,  color: '#515b61', pack: true },
    operators5: { name: 'Medic · Alpine',     woman: false, color: '#88928e', pack: true, medic: true },
    operators6: { name: 'Pilot · Navy',       woman: true,  color: '#303e50', pack: true },
    operators7: { name: 'Ranger · Olive',     woman: false, color: '#596044', pack: true },
    operators8: { name: 'Observer · Winter',  woman: true,  color: '#c4c8be', pack: true, goggles: true },
    operators9: { name: 'Sentinel · Coyote',  woman: false, color: '#897454', pack: true },
  };

  // Field Radio backup squad: weapons for each level (1-5)
  const BACKUP = {
    count: 3, life: 30, maxLevel: 5,
    hp: lvl => 250 + lvl * 60,
    leader:    ['g17', 'secondary40', 'secondary28', 'secondary3', 'secondary38'],     // Glock 17 → Python → Desert Eagle → Glock 18 → Model 29
    gunner:    ['secondary49', 'primary36', 'primary5', 'primary7', 'primary43'],      // Makarov → Uzi → M4A1 → AK-12 → M249
    grenadier: ['secondary48', 'secondary48', 'mp5', 'mp5', 'primary41'],             // + grenades that get faster and stronger
    grenadeEvery: [9, 7, 5.5, 4.5, 3.5],
    grenadeDamage: [250, 300, 350, 400, 450],
  };
  const GRENADE = { fuse: 2.1, radius: 7, damage: 400, speed: 17 };
  const SUMMON = { hp: 150, damage: 45, hitDelay: 1.0, speed: 4.3 };   // horde undead

  const COLORS = ['#ff4d4d', '#ff9f1a', '#ffd60a', '#3ddc84', '#00c2ff', '#4d7cff', '#b04dff', '#ff4dc4', '#ffffff', '#3a3a3a'];
  const DEFAULT_SETS = [
    { name: 'Assault',     primary: 'hk416',     secondary: 'g17',         blade: 'kabar',    equipment: 'equipment4', operator: 'man',        color: '#4d7cff' },
    { name: 'Scout Squad', primary: 'primary5',  secondary: 'secondary40', blade: 'blades6',  equipment: 'equipment2', operator: 'operators3', color: '#ff9f1a' },
    { name: 'Sniper',      primary: 'awm',       secondary: 'secondary28', blade: 'karambit', equipment: 'drone',      operator: 'operators2', color: '#3ddc84' },
    { name: 'Breacher',    primary: 'm4',        secondary: 'secondary3',  blade: 'blades9',  equipment: 'm67',        operator: 'operators4', color: '#ff4d4d' },
    { name: 'Heavy',       primary: 'primary43', secondary: 'm1911',       blade: 'blades7',  equipment: 'equipment7', operator: 'operators9', color: '#b04dff' },
    { name: 'Night Ops',   primary: 'primary26', secondary: 'secondary15', blade: 'fs',       equipment: 'equipment3', operator: 'woman',      color: '#3a3a3a' },
  ];
  function cleanSet(s) {
    s = s || {};
    const name = String(s.name || '').replace(/[^\w \-.!?']/g, '').trim().slice(0, 24) || 'My Set';
    return {
      name,
      primary: PRIMARIES.includes(s.primary) ? s.primary : 'hk416',
      secondary: SECONDARIES.includes(s.secondary) ? s.secondary : 'g17',
      blade: BLADES.includes(s.blade) ? s.blade : 'kabar',
      equipment: EQUIPMENT[s.equipment] ? s.equipment : 'equipment4',
      operator: OPERATORS[s.operator] ? s.operator : 'man',
      color: COLORS.includes(s.color) ? s.color : COLORS[0],
    };
  }

  // ---------- game modes ----------
  const MODES = {
    ffa:       { name: 'Free For All',    short: 'FFA',        teams: false, limit: 20, desc: 'Everyone vs everyone. First to 20 kills.' },
    tdm:       { name: 'Team Deathmatch', short: 'TDM',        teams: true,  limit: 40, desc: 'Red vs Blue. First team to 40 kills.' },
    koth:      { name: 'King of the Hill', short: 'KOTH',      teams: true,  limit: 100, desc: 'Stand in the glowing zone to score. First team to 100.' },
    gungame:   { name: 'Gun Game',        short: 'GUN GAME',   teams: false, desc: 'Every kill gives you the next gun. Win with the knife!' },
    infection: { name: 'Infection',       short: 'INFECTION',  teams: true,  time: 450, desc: 'The first infected has 2000 HP, the rest 700. Get killed and you join them. Survive 7:30!' },
    horde:     { name: 'Undead Horde',    short: 'HORDE',      teams: false, coop: true, time: 600, desc: 'Team up against waves of undead. Survive 10 waves!' },
    oneshot:   { name: 'One Shot',        short: 'ONE SHOT',   teams: false, limit: 15, desc: 'Colt Python with 1 bullet. Every hit kills. Kills give you a bullet.' },
    snipers:   { name: 'Snipers Only',    short: 'SNIPERS',    teams: false, limit: 20, desc: 'Everyone gets an AWM and their blade.' },
    knives:    { name: 'Knife Fight',     short: 'KNIVES',     teams: false, limit: 15, desc: 'Blades only — bring your favorite one. Get close!' },
  };
  const GUNGAME_ORDER = ['mp5', 'primary9', 'hk416', 'ak74', 'primary11', 'm4', 'primary43', 'primary48', 'awm', 'secondary28', 'secondary40', 'kabar'];
  const GUNGAME_KILLS_PER_LEVEL = 1;
  const HORDE_WAVES = 10;
  const ONESHOT_GUN = 'secondary40';

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

  const api = { MAX_HP, TYPES, WEAPONS, PRIMARIES, SECONDARIES, BLADES, EQUIPMENT, OPERATORS, BACKUP, GRENADE, SUMMON, COLORS, DEFAULT_SETS, cleanSet,
    MODES, GUNGAME_ORDER, GUNGAME_KILLS_PER_LEVEL, HORDE_WAVES, ONESHOT_GUN, MAPS, collides, moveBody, GRAVITY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GNS = api;
})(typeof window !== 'undefined' ? window : globalThis);
