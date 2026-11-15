// G-ns 3D client: menu, gun sets, maps, first-person controls, shooting, HUD and networking.
import * as THREE from 'three';
import { texture, skyTexture } from './textures.js';
import { ViewModel, Avatar, SIGHT_HEIGHT, loadGunModels, loadedModels } from './models.js';
import * as SFX from './audio.js';

const G = window.GNS;
const { MAX_HP, WEAPONS, PRIMARIES, SECONDARIES, SPECIALS, COLORS, DEFAULT_SETS, cleanSet, MODES, MAPS, GUNGAME_ORDER, HORDE_WAVES, collides, moveBody } = G;
const $ = id => document.getElementById(id);
const TEAM_COLORS = ['#d63a2f', '#2e6fd8'];
const TEAM_TAG = ['#ff7b6e', '#7fb2ff'];
const MODE_STYLE = {
  ffa: ['🔫', '#ff4d4d', '#ff9f1a'], tdm: ['⚔️', '#d63a2f', '#2e6fd8'], koth: ['👑', '#ffb300', '#ff6b00'],
  gungame: ['🎯', '#00b894', '#00c2ff'], infection: ['☣️', '#39a845', '#1b5e20'], horde: ['🧟', '#5b8c3a', '#3a2a5b'],
  oneshot: ['💥', '#ff2bd6', '#7b5cff'], snipers: ['🔭', '#2b6cb0', '#00f0ff'], knives: ['🔪', '#6d6d6d', '#ff4d4d'],
};
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nowS = () => performance.now() / 1000;

// ---------- settings ----------
const settings = Object.assign({ sens: 1, fov: 75, vol: 0.8 }, store.get('gns-settings', {}));
SFX.setVolume(settings.vol);

// load custom .glb gun models first (if any were added)
await Promise.race([loadGunModels(), new Promise(r => setTimeout(r, 4000))]);

// ---------- renderer & scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.05, 400);
camera.rotation.order = 'YXZ';
const hemi = new THREE.HemisphereLight(0xdcecff, 0x4a4434, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
sun.position.set(30, 55, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 140 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun);

const vmScene = new THREE.Scene();
const vmCamera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 10);
vmScene.add(new THREE.HemisphereLight(0xeef4ff, 0x6a6050, 2.2));
const vmSun = new THREE.DirectionalLight(0xffffff, 1.6);
vmSun.position.set(1, 2, 1);
vmScene.add(vmSun);
const viewModel = new ViewModel('#55606e');
vmScene.add(viewModel.root);

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = vmCamera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  vmCamera.updateProjectionMatrix();
});

// ---------- maps ----------
let mapId = null, mapBoxes = MAPS.yard.boxes, mapGroup = null, hillMesh = null;
function worldUV(geo, ox, oy, oz, scale) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + ox, y = pos.getY(i) + oy, z = pos.getZ(i) + oz;
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    let u, v;
    if (nx > 0.5) { u = z; v = y; } else if (ny > 0.5) { u = x; v = z; } else { u = x; v = y; }
    uv.setXY(i, u / scale, v / scale);
  }
}
function buildMap(id) {
  if (mapId === id) return;
  mapId = id;
  const map = MAPS[id];
  mapBoxes = map.boxes;
  if (mapGroup) {
    scene.remove(mapGroup);
    mapGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
  mapGroup = new THREE.Group();
  const th = map.theme;
  scene.background = skyTexture(th.sky);
  scene.fog = new THREE.Fog(th.fog, th.night ? 30 : 45, th.night ? 110 : 150);
  sun.color.set(th.sun);
  sun.intensity = th.sunI;
  hemi.intensity = th.hemi;
  hemi.color.set(th.night ? '#8a7bd6' : '#dcecff');
  hemi.groundColor.set(th.night ? '#2a1640' : '#4a4434');
  renderer.toneMappingExposure = th.night ? 1.25 : 1;
  const mats = new Map();
  for (const b of map.boxes) {
    const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, cz = b.z + b.d / 2;
    if (b.kind !== 'crate' && b.kind !== 'neon') worldUV(geo, cx, cy, cz, b.kind === 'ground' ? 6 : 2.5);
    const key = b.kind + b.c;
    if (!mats.has(key)) {
      let m;
      if (b.kind === 'neon') m = new THREE.MeshStandardMaterial({ color: b.c, emissive: b.c, emissiveIntensity: 2.2, roughness: 0.4 });
      else if (b.kind === 'ice') m = new THREE.MeshStandardMaterial({ map: texture('ice', b.c), roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 });
      else m = new THREE.MeshStandardMaterial({ map: texture(b.kind, b.c), roughness: b.kind === 'metal' ? 0.55 : 0.92, metalness: b.kind === 'metal' ? 0.35 : 0 });
      mats.set(key, m);
    }
    const mesh = new THREE.Mesh(geo, mats.get(key));
    mesh.position.set(cx, cy, cz);
    mesh.receiveShadow = true;
    mesh.castShadow = b.kind !== 'ground' && b.kind !== 'neon';
    mapGroup.add(mesh);
  }
  // neon lights for the neon map
  if (th.night) {
    for (const b of map.boxes.filter(b => b.kind === 'neon').slice(0, 8)) {
      const l = new THREE.PointLight(b.c, 12, 16);
      l.position.set(b.x + b.w / 2, b.y + 1, b.z + b.d / 2);
      mapGroup.add(l);
    }
  }
  // king of the hill zone
  const [hx, hz, hr] = map.hill;
  hillMesh = new THREE.Mesh(new THREE.CylinderGeometry(hr, hr, 2.5, 40, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe600, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
  hillMesh.position.set(hx, 1.25, hz);
  hillMesh.visible = false;
  mapGroup.add(hillMesh);
  scene.add(mapGroup);
}
buildMap('yard');

// ---------- local player ----------
const me = {
  id: null, joined: false, alive: false, seq: 0, team: 0, weapons: ['rifle', 'pistol'], weapon: 'rifle', special: null,
  x: 0, y: 10, z: 30, vx: 0, vy: 0, vz: 0, r: 0.35, h: 1.8, onGround: false,
  yaw: 0, pitch: -0.3, crouch: false, slideT: 0, eyeH: 1.62, dashT: 0, dashReady: 0,
  hp: MAX_HP, mhp: MAX_HP, ammo: {}, reloadUntil: 0, lastShot: -9, diedAt: 0, killer: '', respawnIn: 3, oneshot: false,
};
const keys = new Set();
let fireHeld = false, firePressed = false, adsHeld = false, playing = false;
let adsT = 0, bobPhase = 0, kick = 0, swayX = 0, swayY = 0, switchT = 0, landDip = 0, stabT = 0, strafeTilt = 0, lastStep = 0;
let fov = settings.fov;
let snap = null;
let banner = { until: 0, title: '', text: '' };
let room = null;    // { mode, map } we are in
const avatars = new Map();
const undeadAvatars = new Map();

// ---------- gun sets (saved in this browser) ----------
let mySets = store.get('gns-sets', null);
if (!Array.isArray(mySets) || !mySets.length) mySets = DEFAULT_SETS.map(cleanSet);
mySets = mySets.map(cleanSet);
let equipped = Math.min(store.get('gns-equipped', 0), mySets.length - 1);
const saveSets = () => { store.set('gns-sets', mySets); store.set('gns-equipped', equipped); };
const currentSet = () => mySets[equipped] || mySets[0];

// ---------- networking ----------
let ws = null;
function connect() {
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
  ws.onopen = () => { $('status').textContent = 'Connected ✓ · Bots fill every match to 20 players'; };
  ws.onclose = () => {
    $('status').textContent = 'Disconnected — reconnecting…';
    me.joined = false; me.alive = false; room = null;
    if (playing) showMenu();
    setTimeout(connect, 2000);
  };
  ws.onmessage = ev => onMessage(JSON.parse(ev.data));
}
connect();
const send = m => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };

function onMessage(m) {
  switch (m.t) {
    case 'state': onState(m); break;
    case 'welcome':
      me.id = m.id; me.joined = true; room = { mode: m.mode, map: m.map };
      buildMap(m.map);
      clearAvatars();
      showBanner(MODES[m.mode].name, MODES[m.mode].desc);
      break;
    case 'spawn': onSpawn(m); break;
    case 'weapons': setWeapons(m.weapons); break;
    case 'ammo': me.ammo[m.w] = (me.ammo[m.w] || 0) + m.add; break;
    case 'shot': onRemoteShot(m); break;
    case 'hit': onHit(m); break;
    case 'hurt': hurtT = 0.5; SFX.playHurt(); break;
    case 'healed': SFX.playHeal(); healT = 0.6; break;
    case 'died':
      me.alive = false; me.diedAt = nowS(); me.killer = m.by; me.respawnIn = m.in;
      break;
    case 'kill': addFeed(m); break;
    case 'info': addFeedText(m.text); break;
    case 'match': showBanner(MODES[m.mode].name, MODES[m.mode].desc); break;
    case 'wave': showBanner(`🧟 Wave ${m.wave}`, `${m.count} undead are coming!`); SFX.playWave(); break;
    case 'waveClear': showBanner(`Wave ${m.wave} cleared!`, 'Everyone is back. Get ready…'); break;
    case 'claw': { const av = undeadAvatars.get(m.id); if (av) av.attack(); break; }
    case 'undeadDie': {
      const av = undeadAvatars.get(m.id);
      if (av) { puff(av.display.clone().setY(av.display.y + 1), 0x6a8a4a, 1.6); scene.remove(av.root); undeadAvatars.delete(m.id); }
      break;
    }
    case 'summon': {
      const s = snap && snap.players.find(p => p.id === m.id);
      if (s && m.id !== me.id) addFeedText(`${s.name} raised the undead!`);
      break;
    }
  }
}

function onSpawn(m) {
  Object.assign(me, { x: m.x, y: m.y, z: m.z, yaw: m.yaw, pitch: 0, vx: 0, vy: 0, vz: 0, seq: m.seq, alive: true, hp: m.hp, mhp: m.mhp,
    slideT: 0, crouch: false, h: 1.8, special: m.special, oneshot: !!m.ammo1, dashT: 0 });
  me.ammo = {};
  for (const w of Object.keys(WEAPONS)) me.ammo[w] = WEAPONS[w].mag;
  if (me.oneshot) me.ammo.revolver = 1;
  me.reloadUntil = 0;
  setWeapons(m.weapons, true);
}
function setWeapons(list, force) {
  me.weapons = list;
  if (force || !list.includes(me.weapon)) switchWeapon(list[0], true);
  else renderWeaponList();
}
function switchWeapon(w, force) {
  if (!force && (w === me.weapon || !me.weapons.includes(w))) return;
  me.weapon = w;
  me.reloadUntil = 0;
  switchT = 0.3;
  viewModel.setWeapon(w);
  send({ t: 'weapon', weapon: w });
  renderWeaponList();
}
function clearAvatars() {
  for (const av of avatars.values()) scene.remove(av.root);
  for (const av of undeadAvatars.values()) scene.remove(av.root);
  avatars.clear(); undeadAvatars.clear();
}

function onState(m) {
  snap = m;
  if (m.map !== mapId) buildMap(m.map);
  const mine = m.players.find(p => p.id === me.id);
  const teamMode = MODES[m.mode].teams;
  if (mine) {
    me.hp = mine.hp; me.mhp = mine.mhp; me.team = mine.team; me.cd = mine.cd; me.inf = mine.inf;
    if (mine.dead && me.alive) me.alive = false;
    if (m.mode === 'gungame' && mine.w !== me.weapon && me.alive) setWeapons([mine.w], true);
  }
  viewModel.setSleeve(me.inf ? '#3a3530' : teamMode && m.mode !== 'infection' ? TEAM_COLORS[me.team] : currentSet().color);
  hillMesh.visible = m.mode === 'koth';
  if (hillMesh.visible) hillMesh.material.color.set(m.hillTeam === 0 ? TEAM_COLORS[0] : m.hillTeam === 1 ? TEAM_COLORS[1] : m.hillTeam === 2 ? '#ffffff' : '#ffe600');

  const seen = new Set();
  for (const p of m.players) {
    if (p.id === me.id) continue;
    seen.add(p.id);
    const kind = p.inf ? 'infected' : 'soldier';
    let av = avatars.get(p.id);
    if (av && av.kind !== kind) { scene.remove(av.root); av = null; }
    if (!av) { av = new Avatar(p.id, kind); scene.add(av.root); avatars.set(p.id, av); }
    av.state = p;
    const shirt = p.inf ? '#3a3530' : teamMode && m.mode !== 'infection' ? TEAM_COLORS[p.team] : p.col;
    const tag = p.inf ? '#9dff4a' : teamMode && m.mode !== 'infection' ? TEAM_TAG[p.team] : '#ffffff';
    av.setLook(p.name, shirt, tag);
  }
  for (const [id, av] of avatars) if (!seen.has(id)) { scene.remove(av.root); avatars.delete(id); }

  const useen = new Set();
  for (const z of m.undead) {
    useen.add(z.id);
    let av = undeadAvatars.get(z.id);
    if (!av) { av = new Avatar(z.id, 'undead'); scene.add(av.root); undeadAvatars.set(z.id, av); }
    const friendly = z.o === me.id || ((teamMode || m.mode === 'horde') && z.team === me.team);
    av.state = { x: z.x, y: z.y, z: z.z, yaw: z.yaw, pitch: 0, c: 0, s: 0, j: 0, dead: false, rise: z.rise, o: z.o, team: z.team };
    av.setLook(friendly ? 'Your undead' : 'Undead', '#3a3530', friendly ? '#9dff4a' : '#ff6b5a');
  }
  for (const [id, av] of undeadAvatars) if (!useen.has(id)) { scene.remove(av.root); undeadAvatars.delete(id); }
}

// ---------- input ----------
const typing = e => e.target instanceof HTMLInputElement;
addEventListener('keydown', e => {
  if (typing(e)) { if (e.code === 'Enter' && e.target.id === 'name') $('play').click(); if (e.code === 'Enter' && e.target.id === 'searchBox') $('searchBtn').click(); return; }
  keys.add(e.code);
  if (e.code === 'Tab') e.preventDefault();
  if (!playing) return;
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (e.code === 'Digit1' && me.weapons[0]) switchWeapon(me.weapons[0]);
  if (e.code === 'Digit2' && me.weapons[1]) switchWeapon(me.weapons[1]);
  if (e.code === 'KeyR') startReload();
  if (e.code === 'KeyQ') useSpecial();
  if (e.code === 'KeyC') trySlide();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); fireHeld = false; adsHeld = false; });
canvas.addEventListener('mousedown', e => {
  if (!playing) return;
  if (document.pointerLockElement !== canvas) { lockPointer(); return; }
  if (e.button === 0) { fireHeld = true; firePressed = true; }
  if (e.button === 2) adsHeld = true;
});
addEventListener('mouseup', e => { if (e.button === 0) fireHeld = false; if (e.button === 2) adsHeld = false; });
addEventListener('contextmenu', e => { if (playing) e.preventDefault(); });
addEventListener('wheel', e => {
  if (!playing || me.weapons.length < 2) return;
  const i = me.weapons.indexOf(me.weapon);
  switchWeapon(me.weapons[(i + (e.deltaY > 0 ? 1 : -1) + me.weapons.length) % me.weapons.length]);
});
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas || !me.alive) return;
  if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;
  const sens = 0.0022 * settings.sens * (fov / settings.fov);
  me.yaw -= e.movementX * sens;
  me.pitch = Math.max(-1.5, Math.min(1.5, me.pitch - e.movementY * sens));
  swayX = Math.max(-0.04, Math.min(0.04, swayX - e.movementX * 0.0002));
  swayY = Math.max(-0.04, Math.min(0.04, swayY + e.movementY * 0.0002));
});
function lockPointer() {
  try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch {}
}
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && playing) showMenu();
});

// ---------- movement ----------
function trySlide() {
  if (!me.alive || !me.onGround || me.slideT > 0) return;
  const sp = Math.hypot(me.vx, me.vz);
  if (sp < 6.5) return;
  me.slideT = 0.8;
  const boost = 12.5 / sp;
  me.vx *= boost; me.vz *= boost;
}
function useSpecial() {
  if (!me.alive || !me.special) return;
  if (me.special === 'dash') {
    if (nowS() < me.dashReady) return;
    me.dashReady = nowS() + SPECIALS.dash.cooldown;
    const k = c => keys.has(c);
    const fx = (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0), sx = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0);
    let dx = -Math.sin(me.yaw) * (fx || (sx ? 0 : 1)) + Math.cos(me.yaw) * sx;
    let dz = -Math.cos(me.yaw) * (fx || (sx ? 0 : 1)) - Math.sin(me.yaw) * sx;
    const l = Math.hypot(dx, dz) || 1;
    me.vx = dx / l * 22; me.vz = dz / l * 22;
    me.dashT = 0.22;
    SFX.playDash();
  }
  send({ t: 'ability' });
}
function updateMovement(dt) {
  const k = c => keys.has(c);
  const w = WEAPONS[me.weapon];
  const fx = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
  const sx = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
  const ads = adsHeld && !w.melee;
  me.sprinting = (k('ShiftLeft') || k('ShiftRight')) && fx > 0 && !ads && !me.crouch && me.slideT <= 0;
  if (k('KeyC') || me.slideT > 0) { me.crouch = true; me.h = 1.2; }
  else if (me.crouch && !collides(mapBoxes, me.x, me.y, me.z, me.r, 1.8)) { me.crouch = false; me.h = 1.8; }

  const fwdX = -Math.sin(me.yaw), fwdZ = -Math.cos(me.yaw), rightX = Math.cos(me.yaw), rightZ = -Math.sin(me.yaw);
  let wx = fwdX * fx + rightX * sx, wz = fwdZ * fx + rightZ * sx;
  const wl = Math.hypot(wx, wz);
  if (wl > 0) { wx /= wl; wz /= wl; }

  if (me.dashT > 0) {
    me.dashT -= dt;
  } else if (me.slideT > 0) {
    me.slideT -= dt;
    const f = Math.exp(-dt * 1.5);
    me.vx *= f; me.vz *= f;
    if (Math.hypot(me.vx, me.vz) < 3.5) me.slideT = 0;
  } else {
    const speed = (me.crouch ? 2.8 : ads ? 3.4 : me.sprinting ? 8.6 : 5.6) * w.speed;
    const rate = me.onGround ? 11 : 2.5;      // a little smoother start/stop, like a real person
    const a = Math.min(1, rate * dt);
    if (me.onGround || wl > 0) { me.vx += (wx * speed - me.vx) * a; me.vz += (wz * speed - me.vz) * a; }
  }
  if (k('Space') && me.onGround) {
    me.vy = 7.6;
    if (me.slideT > 0) { me.slideT = 0; me.vx *= 1.05; me.vz *= 1.05; }
  }
  strafeTilt += ((-sx * (me.onGround ? 0.025 : 0.01)) - strafeTilt) * Math.min(1, dt * 8);
  const wasGround = me.onGround, fallSpeed = me.vy;
  const steps = Math.ceil(dt / (1 / 120));
  for (let i = 0; i < steps; i++) moveBody(me, dt / steps, mapBoxes);
  if (!wasGround && me.onGround && fallSpeed < -7) { landDip = Math.min(0.18, -fallSpeed * 0.013); SFX.playStep(1.6); }
  if (me.y < -20) me.y = 1;
}

// ---------- shooting ----------
function rayBoxT(o, d, b, maxT, inflate = 0) {
  let tmin = 0, tmax = maxT;
  const mins = [b.x - inflate, b.y - inflate, b.z - inflate], maxs = [b.x + b.w + inflate, b.y + b.h + inflate, b.z + b.d + inflate];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (o[i] < mins[i] || o[i] > maxs[i]) return Infinity; }
    else {
      let t1 = (mins[i] - o[i]) / d[i], t2 = (maxs[i] - o[i]) / d[i];
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}
function raySphereT(o, d, c, r) {
  const ox = o[0] - c[0], oy = o[1] - c[1], oz = o[2] - c[2];
  const b = ox * d[0] + oy * d[1] + oz * d[2];
  const h = b * b - (ox * ox + oy * oy + oz * oz - r * r);
  if (h < 0) return Infinity;
  const t = -b - Math.sqrt(h);
  return t >= 0 ? t : Infinity;
}
function isEnemyTeam(team) {
  if (!snap) return true;
  return MODES[snap.mode].teams || snap.mode === 'horde' ? team !== me.team : true;
}
function targets() {
  const list = [];
  if (!snap) return list;
  for (const [id, av] of avatars) {
    const s = av.state;
    if (!s || s.dead || !isEnemyTeam(s.team) || snap.mode === 'horde') continue;
    list.push({ id, pos: av.display, crouch: s.c || s.s });
  }
  for (const [id, av] of undeadAvatars) {
    const s = av.state;
    if (!s || s.o === me.id || !isEnemyTeam(s.team) || s.rise < 1) continue;
    list.push({ id, pos: av.display, crouch: false });
  }
  return list;
}
function castRay(o, d, range, inflate) {
  let best = range, hit = null, wall = false;
  for (const b of mapBoxes) {
    const t = rayBoxT(o, d, b, best);
    if (t < best) { best = t; wall = true; }
  }
  for (const t of targets()) {
    const p = t.pos, top = t.crouch ? 1.25 : 1.85;
    const th = raySphereT(o, d, [p.x, p.y + top - 0.22, p.z], 0.2 + inflate);
    const tb = rayBoxT(o, d, { x: p.x - 0.3, y: p.y, z: p.z - 0.3, w: 0.6, h: top - 0.42, d: 0.6 }, best, inflate);
    if (th < best && th <= tb) { best = th; hit = { id: t.id, head: true }; wall = false; }
    else if (tb < best) { best = tb; hit = { id: t.id, head: false }; wall = false; }
  }
  return { t: best, hit, wall: wall && best < range };
}
function startReload() {
  const w = WEAPONS[me.weapon];
  if (w.melee || me.reloadUntil > 0 || me.ammo[me.weapon] >= w.mag || !me.alive) return;
  if (me.oneshot && me.weapon === 'revolver') return;
  me.reloadUntil = nowS() + w.reload;
  SFX.playReload();
}
let flashUntil = 0;
const flashLight = new THREE.PointLight(0xffc670, 0, 8);
scene.add(flashLight);
function tryFire() {
  const w = WEAPONS[me.weapon];
  const t = nowS();
  if (!me.alive || !playing || (snap && snap.over)) return;
  if (!w.auto && !firePressed) return;
  if (t - me.lastShot < w.fireDelay || me.reloadUntil > 0 || switchT > 0.15) return;
  if (!w.melee && me.ammo[me.weapon] <= 0) { if (firePressed) SFX.playEmpty(); startReload(); firePressed = false; return; }
  firePressed = false;
  me.lastShot = t;
  if (!w.melee) me.ammo[me.weapon]--;
  me.slideT = Math.min(me.slideT, 0.3);

  camera.updateMatrixWorld();
  const o = [camera.position.x, camera.position.y, camera.position.z];
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const speed = Math.hypot(me.vx, me.vz);
  let spread = w.spread;
  if (!w.melee) {
    if (adsT < 0.5) spread += me.weapon === 'sniper' ? 0.06 : me.weapon === 'dmr' ? 0.02 : 0.01;
    spread += Math.min(1, speed / 8.6) * 0.025;
    if (!me.onGround) spread += 0.04;
    if (me.crouch && me.slideT <= 0) spread *= 0.7;
    if (adsT > 0.5) spread *= me.weapon === 'shotgun' ? 0.85 : 0.45;
  }
  const hits = [], ends = [];
  const muzzle = camera.position.clone().addScaledVector(right, 0.18).addScaledVector(up, -0.12).addScaledVector(fwd, 0.6);
  for (let i = 0; i < w.pellets; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
    const d = fwd.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
    const res = castRay(o, [d.x, d.y, d.z], w.range, w.melee ? 0.25 : 0);
    const end = camera.position.clone().addScaledVector(d, res.t);
    if (res.hit) { hits.push(res.hit); puff(end, 0xb01818, 0.5); }
    else if (res.wall) puff(end, 0xb8b0a0, 0.6);
    if (!w.melee) { ends.push([+end.x.toFixed(2), +end.y.toFixed(2), +end.z.toFixed(2)]); tracer(muzzle, end); }
  }
  send({ t: 'shoot', weapon: me.weapon, hits, ends });
  if (w.melee) { stabT = 0.25; SFX.playEmpty(); }
  else {
    SFX.playShot(me.weapon, 1);
    viewModel.flash.visible = true;
    viewModel.flash.rotation.z = Math.random() * Math.PI;
    flashUntil = t + 0.05;
    flashLight.position.copy(muzzle);
    flashLight.intensity = 6;
    kick = Math.min(0.12, kick + (['sniper', 'shotgun', 'revolver', 'dmr'].includes(me.weapon) ? 0.09 : 0.03));
    me.pitch = Math.min(1.5, me.pitch + w.recoil * (adsT > 0.5 ? 0.6 : 1));
    me.yaw += (Math.random() - 0.5) * w.recoil * 0.5;
    if (me.ammo[me.weapon] === 0) setTimeout(startReload, 200);
  }
}

// ---------- effects ----------
const fx = [];
const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.85 });
const tracerGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 4);
tracerGeo.translate(0, 0.5, 0);
tracerGeo.rotateX(Math.PI / 2);
function tracer(from, to) {
  const len = from.distanceTo(to);
  if (len < 0.5) return;
  const m = new THREE.Mesh(tracerGeo, tracerMat.clone());
  m.position.copy(from);
  m.lookAt(to);
  m.scale.set(1, 1, len);
  scene.add(m);
  fx.push({ obj: m, life: 0.07, max: 0.07, kind: 'tracer' });
}
const puffTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
function puff(pos, color, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color, transparent: true, depthWrite: false }));
  s.position.copy(pos);
  s.scale.setScalar(size * 0.3);
  scene.add(s);
  fx.push({ obj: s, life: 0.4, max: 0.4, kind: 'puff', size });
}
function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.life -= dt;
    const k = Math.max(0, f.life / f.max);
    f.obj.material.opacity = k * (f.kind === 'tracer' ? 0.85 : 0.8);
    if (f.kind === 'puff') f.obj.scale.setScalar(f.size * (0.3 + (1 - k) * 0.7));
    if (f.life <= 0) { scene.remove(f.obj); f.obj.material.dispose(); fx.splice(i, 1); }
  }
}
function onRemoteShot(m) {
  const av = avatars.get(m.id);
  if (!av) return;
  if (WEAPONS[m.w] && WEAPONS[m.w].melee) { av.attack(); return; }
  const from = av.muzzleWorld;
  for (const e of m.ends) tracer(from, new THREE.Vector3(e[0], e[1], e[2]));
  SFX.playShot(m.w, 1 / (1 + Math.hypot(av.display.x - me.x, av.display.z - me.z) / 10));
}
let hitTimer = 0, hurtT = 0, healT = 0;
function onHit(m) {
  const hm = $('hitmarker');
  hm.className = m.head ? 'head' : '';
  hm.style.opacity = 1;
  hitTimer = m.kill ? 0.35 : 0.15;
  if (m.kill) SFX.playKill(); else SFX.playHit(m.head);
}

// ---------- HUD ----------
function addFeed(m) {
  const teams = snap && (MODES[snap.mode].teams && snap.mode !== 'infection');
  const col = t => (teams ? TEAM_TAG[t] : '#fff');
  const wn = m.w === 'undead' ? '☠ undead' : WEAPONS[m.w] ? WEAPONS[m.w].name : m.w;
  addFeedHtml(`<span style="color:${col(m.kt)}">${esc(m.killer)}</span><span class="w">[${wn}${m.head ? ' · headshot' : ''}]</span><span style="color:${col(m.vt)}">${esc(m.victim)}</span>`);
}
function addFeedText(t) { addFeedHtml(`<span style="color:#ccc">${esc(t)}</span>`); }
function addFeedHtml(h) {
  const d = document.createElement('div');
  d.innerHTML = h;
  $('feed').prepend(d);
  while ($('feed').children.length > 6) $('feed').lastChild.remove();
  setTimeout(() => d.remove(), 6000);
}
function showBanner(title, text) { banner = { until: nowS() + 4, title, text }; }
function renderWeaponList() {
  $('weapons').innerHTML = me.weapons.map((w, i) => `<div class="${w === me.weapon ? 'on' : ''}">${i + 1} ${WEAPONS[w].name}</div>`).join('');
}
const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const cache = {};
function setHTML(id, html) { if (cache[id] !== html) { $(id).innerHTML = html; cache[id] = html; } }

function updateHud(dt) {
  if (!snap) return;
  const w = WEAPONS[me.weapon];
  const mode = snap.mode;
  const mine = snap.players.find(p => p.id === me.id);
  const ranked = [...snap.players].sort((a, b) => mode === 'gungame' ? b.lvl - a.lvl || b.k - a.k : b.k - a.k);
  let top = `<span class="mode">${MODE_STYLE[mode][0]} ${MODES[mode].short}</span><span>${fmtTime(snap.timeLeft)}</span>`;
  if (mode === 'tdm' || mode === 'koth') {
    top += `<span class="red">RED ${snap.teamScore[0]}</span>–<span class="blue">${snap.teamScore[1]} BLUE</span><span class="${me.team ? 'blue' : 'red'}">(you: ${me.team ? 'Blue' : 'Red'})</span>`;
    if (mode === 'koth') top += `<span>Hill: ${['<span class="red">Red</span>', '<span class="blue">Blue</span>', 'Fighting!', 'Empty'][snap.hillTeam === -1 ? 3 : snap.hillTeam]}</span>`;
  } else if (mode === 'infection') {
    const inf = snap.players.filter(p => p.inf).length;
    top += `<span>Survivors ${snap.players.length - inf}</span><span class="green">Infected ${inf}</span><span class="${me.inf ? 'green' : ''}">(you: ${me.inf ? 'INFECTED' : 'survivor'})</span>`;
  } else if (mode === 'horde') {
    top += `<span class="green">Wave ${snap.wave}/${HORDE_WAVES}</span><span>${snap.waveIn ? 'Next wave in ' + snap.waveIn : snap.horde + ' undead left'}</span>`;
  } else if (ranked[0]) {
    const sc = p => mode === 'gungame' ? 'gun ' + (p.lvl + 1) + '/' + GUNGAME_ORDER.length : p.k;
    top += `<span>Leader: ${esc(ranked[0].name)} ${sc(ranked[0])}</span>${mine ? `<span>You: ${sc(mine)}</span>` : ''}`;
  }
  setHTML('topbar', top);

  const hpPct = Math.max(0, me.hp / me.mhp * 100);
  $('hpfill').style.width = hpPct + '%';
  $('hpfill').style.background = healT > 0 ? '#9dff4a' : hpPct > 40 ? 'linear-gradient(90deg,#3ddc84,#9dff4a)' : 'linear-gradient(90deg,#ff2b2b,#ff7b00)';
  healT = Math.max(0, healT - dt);
  setHTML('hptext', `${Math.max(0, me.hp)} / ${me.mhp} HP${mine && mine.sp ? ' · 🛡 protected' : ''}`);
  setHTML('ammo', w.melee ? '∞' : `${me.ammo[me.weapon]}<small> / ${me.oneshot && me.weapon === 'revolver' ? '∞' : w.mag}</small>`);
  setHTML('wname', w.name);
  setHTML('reloading', me.reloadUntil > 0 ? 'RELOADING…' : !w.melee && me.ammo[me.weapon] === 0 ? (me.oneshot ? 'NO BULLETS — USE THE KNIFE!' : 'PRESS R TO RELOAD') : '');
  setHTML('ggbar', mode === 'gungame' && mine ? `GUN ${mine.lvl + 1} / ${GUNGAME_ORDER.length}` : '');
  let ab = '';
  if (me.special && mine) {
    const cd = me.special === 'dash' ? Math.max(0, Math.ceil(me.dashReady - nowS())) : mine.cd;
    ab = cd > 0 ? `<span style="color:#aaa">[Q] ${SPECIALS[me.special].name}: ${cd}s</span>` : `<span style="color:#9dff4a">[Q] ${SPECIALS[me.special].name}: READY</span>`;
  }
  setHTML('ability', ab);

  const scoped = me.weapon === 'sniper' && adsT > 0.85;
  $('scope').classList.toggle('hidden', !scoped);
  const ch = $('crosshair');
  ch.style.display = scoped || (adsT > 0.6 && !w.melee) ? 'none' : '';
  const gap = 5 + (w.spread + Math.min(1, Math.hypot(me.vx, me.vz) / 8.6) * 0.025 + (me.onGround ? 0 : 0.04)) * 380;
  const L = 8, T = 2, parts = ch.children;
  const set = (el, x, y, wd, ht) => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = wd + 'px'; el.style.height = ht + 'px'; };
  set(parts[0], -gap - L, -T / 2, L, T); set(parts[1], gap, -T / 2, L, T);
  set(parts[2], -T / 2, -gap - L, T, L); set(parts[3], -T / 2, gap, T, L);

  hitTimer -= dt;
  if (hitTimer <= 0) $('hitmarker').style.opacity = 0;
  hurtT = Math.max(0, hurtT - dt);
  $('vignette').style.opacity = Math.max(hurtT, hpPct < 30 && me.alive ? 0.35 : 0);

  let center = '';
  if (snap.over) center = `<h2>🏆 ${esc(snap.winner)} wins!</h2><p>Next match in ${snap.nextIn}…</p>`;
  else if (!me.alive && me.joined && me.diedAt) {
    if (me.respawnIn < 0) center = `<h2>💀 You're down</h2><p>${mode === 'horde' ? 'You come back when this wave is cleared.' : esc(me.killer)}</p>`;
    else center = `<h2>Killed by ${esc(me.killer)}</h2><p>Respawning in ${Math.max(0, Math.ceil(me.respawnIn - (nowS() - me.diedAt)))}…</p>`;
  } else if (nowS() < banner.until) center = `<h2>${esc(banner.title)}</h2><p>${esc(banner.text)}</p>`;
  setHTML('center', center);

  const sb = $('scoreboard');
  if (keys.has('Tab')) {
    sb.classList.remove('hidden');
    const teams = MODES[mode].teams && mode !== 'infection';
    const row = p => `<tr class="${p.id === me.id ? 'me' : ''}"><td style="color:${p.inf ? '#9dff4a' : teams ? TEAM_TAG[p.team] : p.col}">${esc(p.name)}${p.bot ? ' <small style="color:#888">BOT</small>' : ''}</td><td>${mode === 'gungame' ? 'Gun ' + (p.lvl + 1) : p.inf ? 'Infected' : esc(p.set)}</td><td>${p.k}</td><td>${p.d}</td></tr>`;
    setHTML('scoreboard', `<h3>${MODE_STYLE[mode][0]} ${MODES[mode].name} · ${MAPS[snap.map].name}</h3><table><tr><th>Player</th><th>${mode === 'gungame' ? 'Level' : 'Gun set'}</th><th>Kills</th><th>Deaths</th></tr>${ranked.map(row).join('')}</table>`);
  } else sb.classList.add('hidden');
}

// ---------- menu ----------
let selMode = store.get('gns-mode', 'ffa'), selMap = store.get('gns-map', 'yard');
if (!MODES[selMode]) selMode = 'ffa';
if (!MAPS[selMap]) selMap = 'yard';
$('name').value = store.get('gns-name', '');
let roomCounts = {};

document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('hidden', t.id !== 'tab-' + b.dataset.tab));
}));

function renderModes() {
  $('modes').innerHTML = Object.entries(MODES).map(([k, m]) => {
    const [e, c1, c2] = MODE_STYLE[k];
    const n = Object.entries(roomCounts).filter(([key]) => key.startsWith(k + ':')).reduce((a, [, v]) => a + v, 0);
    return `<button class="pick ${k === selMode ? 'on' : ''}" data-mode="${k}" style="background:linear-gradient(135deg,${c1},${c2})">
      ${n ? `<span class="count">${n} playing</span>` : ''}<span class="emoji">${e}</span>${m.name}<small>${m.desc}</small></button>`;
  }).join('');
}
function renderMaps() {
  $('maps').innerHTML = Object.entries(MAPS).map(([k, m]) => {
    const n = roomCounts[`${selMode}:${k}`] || 0;
    return `<button class="pick ${k === selMap ? 'on' : ''}" data-map="${k}" style="background:linear-gradient(180deg,${m.theme.sky[0]},${m.theme.sky[1]} 55%,${m.theme.ground})">
      ${n ? `<span class="count">${n} playing</span>` : ''}${m.name}<small>${m.desc}</small></button>`;
  }).join('');
}
$('modes').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (!b) return; selMode = b.dataset.mode; store.set('gns-mode', selMode); renderModes(); renderMaps(); updatePlayButton(); });
$('maps').addEventListener('click', e => { const b = e.target.closest('[data-map]'); if (!b) return; selMap = b.dataset.map; store.set('gns-map', selMap); renderMaps(); updatePlayButton(); if (!me.joined) { buildMap(selMap); } });
async function refreshRooms() {
  try {
    const list = await (await fetch('/api/rooms')).json();
    roomCounts = {};
    for (const r of list) roomCounts[`${r.mode}:${r.map}`] = r.humans;
    renderModes(); renderMaps();
  } catch {}
}
setInterval(() => { if (!playing) refreshRooms(); }, 5000);

const setLine = s => `${WEAPONS[s.primary].name} + ${WEAPONS[s.secondary].name} · ${SPECIALS[s.special].name}`;
function renderEquipped() {
  const s = currentSet();
  $('equipped').innerHTML = `<span class="dot" style="background:${s.color}"></span><div class="info"><b>${esc(s.name)}</b><span>${setLine(s)}</span></div><button class="btn small" id="changeSet">Change</button>`;
  $('changeSet').onclick = () => document.querySelector('#tabs [data-tab="sets"]').click();
}
function updatePlayButton() {
  const inRoom = me.joined && room;
  const same = inRoom && room.mode === selMode && room.map === selMap;
  $('play').textContent = !inRoom ? 'PLAY ▶' : same ? 'RESUME ▶' : `SWITCH TO ${MODES[selMode].short} ▶`;
  $('rename').classList.toggle('hidden', !inRoom);
  $('leave').classList.toggle('hidden', !inRoom);
}
$('play').addEventListener('click', () => {
  SFX.initAudio();
  const name = $('name').value.trim();
  store.set('gns-name', name);
  if (!ws || ws.readyState !== 1) { $('msg').textContent = 'Still connecting… try again in a second.'; return; }
  const same = me.joined && room && room.mode === selMode && room.map === selMap;
  if (!same) {
    me.joined = false; me.alive = false;
    send({ t: 'join', name, mode: selMode, map: selMap, set: currentSet() });
  }
  startMusicIfSaved();
  hideMenu();
  lockPointer();
});
$('rename').addEventListener('click', () => {
  const name = $('name').value.trim();
  if (!name) { $('msg').textContent = 'Type a name first.'; return; }
  store.set('gns-name', name);
  send({ t: 'rename', name });
  $('msg').textContent = `Name changed to ${name}!`;
});
$('leave').addEventListener('click', () => { location.reload(); });
function showMenu() {
  playing = false;
  fireHeld = adsHeld = false;
  keys.clear();
  $('menu').classList.remove('hidden');
  $('hud').classList.add('hidden');
  updatePlayButton();
  refreshRooms();
}
function hideMenu() {
  playing = true;
  $('menu').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('msg').textContent = '';
}

// ----- gun set builder -----
const draft = { name: '', primary: 'rifle', secondary: 'pistol', special: 'medkit', color: COLORS[4] };
function chips(id, list, key, label) {
  $(id).innerHTML = list.map(v => key === 'color'
    ? `<button class="swatch ${draft.color === v ? 'on' : ''}" data-v="${v}" style="background:${v}"></button>`
    : `<button class="chip ${draft[key] === v ? 'on' : ''}" data-v="${v}">${label(v)}</button>`).join('');
  $(id).onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; draft[key] = b.dataset.v; renderBuilder(); };
}
function renderBuilder() {
  chips('pPrimary', PRIMARIES, 'primary', v => WEAPONS[v].name);
  chips('pSecondary', SECONDARIES, 'secondary', v => WEAPONS[v].name);
  chips('pSpecial', Object.keys(SPECIALS), 'special', v => `${SPECIALS[v].name}`);
  chips('pColor', COLORS, 'color');
}
function renderMySets() {
  $('mySets').innerHTML = mySets.map((s, i) => `<div class="setrow ${i === equipped ? 'on' : ''}">
    <span class="dot" style="background:${s.color}"></span><div class="info"><b>${esc(s.name)}</b><span>${setLine(s)}</span></div>
    <button class="btn small go" data-eq="${i}">${i === equipped ? 'Equipped' : 'Equip'}</button>
    <button class="btn small" data-edit="${i}">Edit</button>
    <button class="btn small red" data-del="${i}">✕</button></div>`).join('');
}
$('mySets').addEventListener('click', e => {
  const t = e.target;
  if (t.dataset.eq !== undefined) equipSet(+t.dataset.eq);
  if (t.dataset.edit !== undefined) { Object.assign(draft, mySets[+t.dataset.edit]); $('setName').value = draft.name; renderBuilder(); $('setMsg').textContent = 'Editing — save to add it as a new set.'; }
  if (t.dataset.del !== undefined) {
    if (mySets.length <= 1) { $('setMsg').textContent = 'You need at least one set.'; return; }
    const i = +t.dataset.del;
    mySets.splice(i, 1);
    if (equipped >= mySets.length || equipped === i) equipped = 0;
    saveSets(); renderMySets(); renderEquipped();
  }
});
function equipSet(i) {
  equipped = i;
  saveSets(); renderMySets(); renderEquipped();
  if (me.joined) { send({ t: 'set', set: currentSet() }); $('setMsg').textContent = 'Equipped! It starts when you respawn.'; }
  else $('setMsg').textContent = `Equipped "${currentSet().name}"!`;
}
$('saveSet').addEventListener('click', async () => {
  draft.name = $('setName').value.trim() || `${WEAPONS[draft.primary].name} set`;
  const set = cleanSet(draft);
  mySets.push(set);
  equipped = mySets.length - 1;
  saveSets(); renderMySets(); renderEquipped();
  if (me.joined) send({ t: 'set', set });
  $('setMsg').textContent = `Saved and equipped "${set.name}"!`;
  if ($('share').checked) {
    try {
      const r = await fetch('/api/sets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ set, author: $('name').value || 'Player' }) });
      $('setMsg').textContent += r.ok ? ' Shared — others can search for it.' : ' (Sharing failed, try later.)';
    } catch { $('setMsg').textContent += ' (Sharing failed.)'; }
  }
});
$('newSet').addEventListener('click', () => { Object.assign(draft, { name: '', primary: 'rifle', secondary: 'pistol', special: 'medkit', color: COLORS[4] }); $('setName').value = ''; renderBuilder(); $('setMsg').textContent = ''; });
let lastResults = [];
$('searchBtn').addEventListener('click', async () => {
  $('results').innerHTML = 'Searching…';
  try {
    lastResults = await (await fetch('/api/sets?q=' + encodeURIComponent($('searchBox').value))).json();
    $('results').innerHTML = lastResults.length ? lastResults.map((s, i) => `<div class="setrow"><span class="dot" style="background:${s.color}"></span>
      <div class="info"><b>${esc(s.name)}</b><span>${setLine(s)} · by ${esc(s.author)}</span></div>
      <button class="btn small go" data-add="${i}">+ Add & equip</button></div>`).join('') : '<div style="opacity:.8">No sets found. Build one and share it!</div>';
  } catch { $('results').textContent = 'Search failed. Try again.'; }
});
$('results').addEventListener('click', e => {
  const i = e.target.dataset.add;
  if (i === undefined) return;
  mySets.push(cleanSet(lastResults[+i]));
  equipSet(mySets.length - 1);
  $('setMsg').textContent = `Added "${lastResults[+i].name}" to your sets!`;
  document.querySelector('#tabs [data-tab="sets"]').click();
});

// ----- settings -----
function renderSettings() {
  $('sens').value = settings.sens; $('sensV').textContent = (+settings.sens).toFixed(2);
  $('fovS').value = settings.fov; $('fovV').textContent = settings.fov;
  $('vol').value = settings.vol; $('volV').textContent = Math.round(settings.vol * 100) + '%';
  const lm = loadedModels();
  $('modelsInfo').textContent = lm.length ? lm.join(', ') : 'None yet — put .glb files in public/models/guns/ (rifle.glb, sniper.glb, …).';
}
for (const [id, key] of [['sens', 'sens'], ['fovS', 'fov'], ['vol', 'vol']]) {
  $(id).addEventListener('input', () => {
    settings[key] = +$(id).value;
    store.set('gns-settings', settings);
    SFX.setVolume(settings.vol);
    renderSettings();
  });
}

// ----- music (YouTube) -----
function ytId(link) {
  const m = String(link).match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/);
  return m ? m[1] : (/^[\w-]{11}$/.test(link) ? link : null);
}
let musicOn = false;
function playMusic(link) {
  const id = ytId(link);
  if (!id) { $('ytMsg').textContent = "That doesn't look like a YouTube link."; return false; }
  store.set('gns-music', link);
  const box = $('ytbox');
  box.innerHTML = `<iframe src="https://www.youtube.com/embed/${id}?autoplay=1&loop=1&playlist=${id}" allow="autoplay; encrypted-media" title="Music"></iframe>`;
  box.classList.remove('hidden');
  box.classList.toggle('mini', !$('ytShow').checked);
  musicOn = true;
  $('ytMsg').textContent = '🎵 Playing! It keeps playing during the game.';
  return true;
}
function startMusicIfSaved() { const l = store.get('gns-music', ''); if (l && !musicOn) playMusic(l); }
$('ytLink').value = store.get('gns-music', '');
$('ytPlay').addEventListener('click', () => playMusic($('ytLink').value.trim()));
$('ytStop').addEventListener('click', () => { $('ytbox').innerHTML = ''; $('ytbox').classList.add('hidden'); musicOn = false; $('ytMsg').textContent = 'Stopped.'; });
$('ytShow').addEventListener('change', () => $('ytbox').classList.toggle('mini', !$('ytShow').checked));

renderModes(); renderMaps(); renderEquipped(); renderBuilder(); renderMySets(); renderSettings(); updatePlayButton(); refreshRooms();

// ---------- main loop ----------
let last = performance.now(), sendAcc = 0, menuSpin = 0;
function frame(nowMs) {
  const dt = Math.min((nowMs - last) / 1000, 0.05);
  last = nowMs;
  const t = nowS();

  if (me.alive && playing) updateMovement(dt);
  else if (me.alive) { me.vx = me.vz = 0; const s = Math.ceil(dt / (1 / 120)); for (let i = 0; i < s; i++) moveBody(me, dt / s, mapBoxes); }
  if (me.reloadUntil > 0 && t >= me.reloadUntil) { me.ammo[me.weapon] = WEAPONS[me.weapon].mag; me.reloadUntil = 0; }
  if (fireHeld || firePressed) tryFire();
  if (!fireHeld) firePressed = false;

  const w = WEAPONS[me.weapon];
  const ads = adsHeld && me.alive && playing && !w.melee && me.reloadUntil === 0;
  adsT += ((ads ? 1 : 0) - adsT) * Math.min(1, dt * 14);
  const speed = Math.hypot(me.vx, me.vz);
  if (!me.joined) {
    // menu: slow camera flight around the map
    menuSpin += dt * 0.06;
    camera.position.set(Math.sin(menuSpin) * 34, 14, Math.cos(menuSpin) * 34);
    camera.rotation.set(-0.32, menuSpin, 0);
  } else {
    const targetEye = me.alive ? (me.crouch ? 1.12 : 1.62) : 0.35;
    me.eyeH += (targetEye - me.eyeH) * Math.min(1, dt * (me.alive ? 12 : 3));
    const prevPhase = bobPhase;
    if (me.onGround && speed > 0.5 && me.slideT <= 0) bobPhase += dt * speed * 1.15;
    if (Math.floor(prevPhase / Math.PI) !== Math.floor(bobPhase / Math.PI) && me.onGround) SFX.playStep(me.sprinting ? 1.2 : me.crouch ? 0.4 : 0.8);
    const bobAmt = me.onGround && me.slideT <= 0 ? Math.min(1, speed / 6) * (1 - adsT * 0.8) : 0;
    landDip *= Math.exp(-dt * 10);
    camera.position.set(me.x + Math.cos(bobPhase) * 0.02 * bobAmt * Math.cos(me.yaw), me.y + me.eyeH + Math.sin(bobPhase * 2) * 0.04 * bobAmt - landDip, me.z - Math.cos(bobPhase) * 0.02 * bobAmt * Math.sin(me.yaw));
    const roll = me.slideT > 0 ? 0.07 : !me.alive ? 0.4 : strafeTilt;
    camera.rotation.set(me.pitch, me.yaw, roll);
  }
  const targetFov = settings.fov / (adsT > 0.01 ? 1 + (w.zoom - 1) * adsT : 1) + (me.sprinting && speed > 6 ? 7 : 0) + (me.slideT > 0 || me.dashT > 0 ? 10 : 0);
  fov += (targetFov - fov) * Math.min(1, dt * 10);
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }

  // first-person weapon pose
  const bobAmt = me.onGround && me.slideT <= 0 ? Math.min(1, speed / 6) * (1 - adsT * 0.8) : 0;
  kick *= Math.exp(-dt * 12);
  swayX *= Math.exp(-dt * 8); swayY *= Math.exp(-dt * 8);
  switchT = Math.max(0, switchT - dt);
  stabT = Math.max(0, stabT - dt);
  const melee = w.melee;
  const hip = melee ? [0.24, -0.24, -0.4] : [0.17, -0.19, -0.48];
  const aim = [0, -(SIGHT_HEIGHT[me.weapon] || 0.1), -0.3];
  const h = viewModel.holder;
  const sprintPose = me.sprinting && speed > 6 ? 1 : 0;
  h.position.set(
    hip[0] + (aim[0] - hip[0]) * adsT + swayX + Math.cos(bobPhase) * 0.012 * bobAmt - sprintPose * 0.04,
    hip[1] + (aim[1] - hip[1]) * adsT + swayY + Math.abs(Math.sin(bobPhase)) * 0.012 * bobAmt - switchT * 0.6 - sprintPose * 0.03 + (me.onGround ? 0 : 0.02),
    hip[2] + (aim[2] - hip[2]) * adsT + kick * 0.6 - Math.sin(stabT / 0.25 * Math.PI) * 0.25,
  );
  const reloadP = me.reloadUntil > 0 ? 1 - (me.reloadUntil - t) / w.reload : 0;
  h.rotation.set(kick * 1.2 - Math.sin(reloadP * Math.PI) * 0.7, sprintPose * 0.6 + (me.weapon === 'knife' ? 0.3 : 0), sprintPose * 0.3 + Math.sin(reloadP * Math.PI) * 0.4);
  viewModel.root.visible = me.alive && me.joined && !(me.weapon === 'sniper' && adsT > 0.85);
  if (t > flashUntil) { viewModel.flash.visible = false; flashLight.intensity = 0; }
  vmCamera.fov = 70 - adsT * 12;
  vmCamera.updateProjectionMatrix();

  for (const av of avatars.values()) if (av.state) av.update(dt, av.state);
  for (const av of undeadAvatars.values()) {
    if (!av.state) continue;
    av.update(dt, av.state);
    av.root.position.y -= (1 - av.state.rise) * 1.7;
  }
  if (hillMesh && hillMesh.visible) hillMesh.material.opacity = 0.18 + Math.sin(t * 3) * 0.06;
  updateFx(dt);

  sendAcc += dt;
  if (sendAcc >= 0.05 && me.alive && me.joined) {
    sendAcc = 0;
    send({ t: 'pos', seq: me.seq, x: +me.x.toFixed(3), y: +me.y.toFixed(3), z: +me.z.toFixed(3), yaw: +me.yaw.toFixed(3), pitch: +me.pitch.toFixed(3), c: me.crouch ? 1 : 0, s: me.slideT > 0 ? 1 : 0, a: me.onGround ? 0 : 1 });
  }
  if (playing) updateHud(dt);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  if (me.joined) renderer.render(vmScene, vmCamera);
  requestAnimationFrame(frame);
}
renderWeaponList();
requestAnimationFrame(frame);
window.__gns = { me, get snap() { return snap; }, avatars, undeadAvatars, camera };
