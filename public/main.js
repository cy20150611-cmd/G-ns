// G-ns 3D client: rendering, first-person controls, shooting, HUD and networking.
import * as THREE from 'three';
import { texture, skyTexture } from './textures.js';
import { ViewModel, Avatar, SIGHT_HEIGHT } from './models.js';
import * as SFX from './audio.js';

const { MAP, WEAPONS, CLASSES, MODES, GUNGAME_ORDER, collides, moveBody } = window.GNS;
const $ = id => document.getElementById(id);
const TEAM_COLORS = ['#c0392b', '#2e6fd8'];
const TEAM_TAG = ['#ff7b6e', '#7fb2ff'];
const FFA_SHIRTS = ['#7a8b5a', '#8b5a5a', '#5a6f8b', '#8b7a4a', '#6a5a8b', '#4a8b7a', '#8b6a3a', '#5a5a5a'];

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
scene.background = skyTexture();
scene.fog = new THREE.Fog(0xc4d3dd, 45, 150);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 400);
camera.rotation.order = 'YXZ';

scene.add(new THREE.HemisphereLight(0xdcecff, 0x4a4434, 1.1));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
sun.position.set(30, 55, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 140 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun);

// first-person weapon is drawn in its own pass so it never sticks into walls
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

// ---------- map ----------
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
const materials = new Map();
for (const b of MAP.boxes) {
  const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, cz = b.z + b.d / 2;
  if (b.kind === 'crate') {
    // one crate picture per face
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i));
  } else {
    worldUV(geo, cx, cy, cz, b.kind === 'ground' ? 6 : 2.5);
  }
  const key = b.kind + b.c;
  if (!materials.has(key)) {
    materials.set(key, new THREE.MeshStandardMaterial({
      map: texture(b.kind, b.c), roughness: b.kind === 'metal' ? 0.55 : 0.92, metalness: b.kind === 'metal' ? 0.35 : 0,
    }));
  }
  const m = new THREE.Mesh(geo, materials.get(key));
  m.position.set(cx, cy, cz);
  m.receiveShadow = true;
  m.castShadow = b.kind !== 'ground';
  scene.add(m);
}

// ---------- local player ----------
const me = {
  id: null, joined: false, alive: false, seq: 0, team: 0, cls: 'rifle', weapons: ['rifle', 'pistol'], weapon: 'rifle',
  x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0.35, h: 1.8, onGround: false,
  yaw: 0, pitch: 0, crouch: false, slideT: 0, eyeH: 1.62,
  hp: 100, mhp: 100, ammo: {}, reloadUntil: 0, lastShot: -9, diedAt: 0, killer: '', respawnIn: 3,
};
let selectedClass = 'rifle';
try { selectedClass = localStorage.getItem('gns-class') || 'rifle'; } catch {}
if (!CLASSES[selectedClass]) selectedClass = 'rifle';

const keys = new Set();
let fireHeld = false, firePressed = false, adsHeld = false;
let playing = false;            // menu hidden
let adsT = 0, bobPhase = 0, kick = 0, swayX = 0, swayY = 0, switchT = 0, landDip = 0, stabT = 0;
let fov = 75;
let snap = null;
let matchBanner = { until: 0, title: '', text: '' };
const avatars = new Map();
const undeadAvatars = new Map();
const nowS = () => performance.now() / 1000;

// ---------- networking ----------
const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
const send = m => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
ws.onclose = () => { $('msg').textContent = 'Disconnected from server. Refresh the page (F5).'; showMenu(); };
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  switch (m.t) {
    case 'state': onState(m); break;
    case 'welcome': me.id = m.id; me.joined = true; break;
    case 'spawn': onSpawn(m); break;
    case 'weapons': setWeapons(m.weapons); break;
    case 'shot': onRemoteShot(m); break;
    case 'hit': onHit(m); break;
    case 'hurt': onHurt(m); break;
    case 'died':
      me.alive = false; me.diedAt = nowS(); me.killer = m.by; me.respawnIn = m.in;
      break;
    case 'kill': addFeed(m); break;
    case 'info': addFeedText(m.text); break;
    case 'match':
      showBanner(MODES[m.mode].name, MODES[m.mode].desc + (m.mode === 'tdm' ? '' : ''));
      break;
    case 'matchEnd': break;
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
};

function onSpawn(m) {
  Object.assign(me, { x: m.x, y: m.y, z: m.z, yaw: m.yaw, pitch: 0, vx: 0, vy: 0, vz: 0, seq: m.seq, alive: true, cls: m.cls, hp: m.hp, mhp: m.hp, slideT: 0, crouch: false, h: 1.8 });
  me.ammo = {};
  for (const w of Object.keys(WEAPONS)) me.ammo[w] = WEAPONS[w].mag;
  me.reloadUntil = 0;
  setWeapons(m.weapons);
}

function setWeapons(list) {
  me.weapons = list;
  if (!list.includes(me.weapon)) switchWeapon(list[0], true);
  else renderWeaponList();
  if (snap && snap.mode === 'gungame') me.ammo[me.weapon] = WEAPONS[me.weapon].mag;
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

function onState(m) {
  const prevMode = snap && snap.mode;
  snap = m;
  const mine = m.players.find(p => p.id === me.id);
  if (mine) {
    me.hp = mine.hp; me.mhp = mine.mhp; me.team = mine.team;
    if (mine.dead && me.alive) me.alive = false;
    if (m.mode === 'gungame' && mine.w !== me.weapon && me.alive) setWeapons([mine.w]);
  }
  viewModel.setSleeve(m.mode === 'tdm' ? TEAM_COLORS[me.team] : '#55606e');
  if (prevMode && prevMode !== m.mode) renderWeaponList();
  updateMenuMode();

  const seen = new Set();
  for (const p of m.players) {
    if (p.id === me.id) continue;
    seen.add(p.id);
    let av = avatars.get(p.id);
    if (!av) { av = new Avatar(p.id); av.root.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(av.root); avatars.set(p.id, av); }
    av.state = p;
    const shirt = m.mode === 'tdm' ? TEAM_COLORS[p.team] : FFA_SHIRTS[p.id % FFA_SHIRTS.length];
    const tag = m.mode === 'tdm' ? TEAM_TAG[p.team] : '#ffffff';
    av.setLook(p.name, shirt, tag);
  }
  for (const [id, av] of avatars) if (!seen.has(id)) { scene.remove(av.root); avatars.delete(id); }

  const useen = new Set();
  for (const z of m.undead) {
    useen.add(z.id);
    let av = undeadAvatars.get(z.id);
    if (!av) { av = new Avatar(z.id, true); scene.add(av.root); undeadAvatars.set(z.id, av); }
    const friendly = z.o === me.id || (m.mode === 'tdm' && z.team === me.team);
    av.state = { x: z.x, y: z.y, z: z.z, yaw: z.yaw, pitch: 0, c: 0, s: 0, dead: false, rise: z.rise, o: z.o, team: z.team };
    av.setLook(friendly ? 'Your undead' : 'Undead', '#3a3530', friendly ? '#9dff4a' : '#ff6b5a');
  }
  for (const [id, av] of undeadAvatars) if (!useen.has(id)) { scene.remove(av.root); undeadAvatars.delete(id); }
}

// ---------- input ----------
const typing = e => e.target instanceof HTMLInputElement;
addEventListener('keydown', e => {
  if (typing(e)) { if (e.code === 'Enter') $('play').click(); return; }
  keys.add(e.code);
  if (e.code === 'Tab') { e.preventDefault(); }
  if (!playing) return;
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (e.code === 'Digit1' && me.weapons[0]) switchWeapon(me.weapons[0]);
  if (e.code === 'Digit2' && me.weapons[1]) switchWeapon(me.weapons[1]);
  if (e.code === 'KeyR') startReload();
  if (e.code === 'KeyQ') send({ t: 'ability' });
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
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => {
  if (!playing || me.weapons.length < 2) return;
  const i = me.weapons.indexOf(me.weapon);
  switchWeapon(me.weapons[(i + (e.deltaY > 0 ? 1 : -1) + me.weapons.length) % me.weapons.length]);
});
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas || !me.alive) return;
  if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;   // ignore the jump when the mouse gets captured
  const sens = 0.0022 * (fov / 75);
  me.yaw -= e.movementX * sens;
  me.pitch = Math.max(-1.5, Math.min(1.5, me.pitch - e.movementY * sens));
  swayX = Math.max(-0.04, Math.min(0.04, swayX - e.movementX * 0.0002));
  swayY = Math.max(-0.04, Math.min(0.04, swayY + e.movementY * 0.0002));
});
function lockPointer() {
  try {
    const r = canvas.requestPointerLock();
    if (r && r.catch) r.catch(() => {});
  } catch {}
}
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && playing) showMenu();
});

// ---------- menu ----------
const nameInput = $('name');
try { nameInput.value = localStorage.getItem('gns-name') || ''; } catch {}
function renderClasses() {
  $('classes').innerHTML = Object.entries(CLASSES).map(([k, c]) =>
    `<button data-cls="${k}" class="${k === selectedClass ? 'on' : ''}">${c.name}<small>${c.desc}</small></button>`).join('');
}
renderClasses();
$('classes').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  selectedClass = b.dataset.cls;
  try { localStorage.setItem('gns-class', selectedClass); } catch {}
  renderClasses();
  if (me.joined) {
    send({ t: 'class', cls: selectedClass });
    $('msg').textContent = snap && snap.mode === 'gungame' ? 'Classes are used after Gun Game ends.' : 'Your new class starts when you respawn.';
  }
});
$('play').addEventListener('click', () => {
  SFX.initAudio();
  const name = nameInput.value.trim();
  try { localStorage.setItem('gns-name', name); } catch {}
  if (!me.joined) {
    if (ws.readyState !== 1) { $('msg').textContent = 'Still connecting… try again in a second.'; return; }
    send({ t: 'join', name, cls: selectedClass });
  }
  hideMenu();
  lockPointer();
});
$('rename').addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name) { $('msg').textContent = 'Type a name first.'; return; }
  try { localStorage.setItem('gns-name', name); } catch {}
  send({ t: 'rename', name });
  $('msg').textContent = `Name changed to ${name}!`;
});
function showMenu() {
  playing = false;
  fireHeld = adsHeld = false;
  keys.clear();
  $('menu').classList.remove('hidden');
  $('hud').classList.add('hidden');
  if (me.joined) { $('play').textContent = 'RESUME'; $('rename').classList.remove('hidden'); }
}
function hideMenu() {
  playing = true;
  $('menu').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('msg').textContent = '';
}
let lastModeInfo = '';
function updateMenuMode() {
  if (!snap) return;
  const humans = snap.players.filter(p => !p.bot).length;
  const t = `Now playing: <b>${MODES[snap.mode].name}</b> · ${humans} real player${humans === 1 ? '' : 's'} online<br>${MODES[snap.mode].desc}`;
  if (t !== lastModeInfo) { $('modeinfo').innerHTML = t; lastModeInfo = t; }
}

// ---------- movement ----------
function tryUncrouch() {
  if (!collides(me.x, me.y, me.z, me.r, 1.8)) { me.crouch = false; me.h = 1.8; }
}
function trySlide() {
  if (!me.alive || !me.onGround || me.slideT > 0) return;
  const sp = Math.hypot(me.vx, me.vz);
  if (sp < 6.5) return;
  me.slideT = 0.8;
  const boost = 12.5 / sp;
  me.vx *= boost; me.vz *= boost;
}
function updateMovement(dt) {
  const k = c => keys.has(c);
  const cls = snap && snap.mode === 'gungame' ? { speed: 1 } : CLASSES[me.cls];
  const fx = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
  const sx = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
  const wantCrouch = k('KeyC');
  const ads = adsHeld && !WEAPONS[me.weapon].melee;
  const sprinting = (k('ShiftLeft') || k('ShiftRight')) && fx > 0 && !ads && !me.crouch;
  me.sprinting = sprinting && me.slideT <= 0;

  if (wantCrouch || me.slideT > 0) { me.crouch = true; me.h = 1.2; }
  else if (me.crouch) tryUncrouch();

  const fwdX = -Math.sin(me.yaw), fwdZ = -Math.cos(me.yaw);
  const rightX = Math.cos(me.yaw), rightZ = -Math.sin(me.yaw);
  let wx = fwdX * fx + rightX * sx, wz = fwdZ * fx + rightZ * sx;
  const wl = Math.hypot(wx, wz);
  if (wl > 0) { wx /= wl; wz /= wl; }

  if (me.slideT > 0) {
    me.slideT -= dt;
    const f = Math.exp(-dt * 1.5);
    me.vx *= f; me.vz *= f;
    if (Math.hypot(me.vx, me.vz) < 3.5) me.slideT = 0;
  } else {
    const speed = (me.crouch ? 2.8 : ads ? 3.4 : me.sprinting ? 8.6 : 5.6) * cls.speed;
    const rate = me.onGround ? 14 : 2.5;
    const a = Math.min(1, rate * dt);
    // keep extra speed in the air (from slides / jumps) instead of braking hard
    if (me.onGround || wl > 0) {
      me.vx += (wx * speed - me.vx) * a;
      me.vz += (wz * speed - me.vz) * a;
    }
  }
  if (k('Space') && me.onGround) {
    me.vy = 7.6;
    if (me.slideT > 0) { me.slideT = 0; me.vx *= 1.05; me.vz *= 1.05; }   // slide-jump keeps your speed
  }
  const wasGround = me.onGround, fallSpeed = me.vy;
  const steps = Math.ceil(dt / (1 / 120));
  for (let i = 0; i < steps; i++) moveBody(me, dt / steps);
  if (!wasGround && me.onGround && fallSpeed < -7) landDip = Math.min(0.15, -fallSpeed * 0.012);
  if (me.y < -20) { me.y = 1; }
}

// ---------- shooting ----------
const tmpV = new THREE.Vector3();
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
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const h = b * b - cc;
  if (h < 0) return Infinity;
  const t = -b - Math.sqrt(h);
  return t >= 0 ? t : Infinity;
}
function targets() {
  const list = [];
  if (!snap) return list;
  const tdm = snap.mode === 'tdm';
  for (const [id, av] of avatars) {
    const s = av.state;
    if (!s || s.dead || (tdm && s.team === me.team)) continue;
    list.push({ id, pos: av.display, crouch: s.c || s.s });
  }
  for (const [id, av] of undeadAvatars) {
    const s = av.state;
    if (!s || s.o === me.id || (tdm && s.team === me.team) || s.rise < 1) continue;
    list.push({ id, pos: av.display, crouch: false });
  }
  return list;
}
function castRay(o, d, range, inflate) {
  let best = range, hit = null, wall = false;
  for (const b of MAP.boxes) {
    const t = rayBoxT(o, d, b, best);
    if (t < best) { best = t; wall = true; }
  }
  for (const t of targets()) {
    const p = t.pos, top = t.crouch ? 1.25 : 1.85;
    const head = [p.x, p.y + top - 0.22, p.z];
    let th = raySphereT(o, d, head, 0.2 + inflate);
    const body = { x: p.x - 0.3, y: p.y, z: p.z - 0.3, w: 0.6, h: top - 0.42, d: 0.6 };
    let tb = rayBoxT(o, d, body, best, inflate);
    if (th < best && th <= tb) { best = th; hit = { id: t.id, head: true }; wall = false; }
    else if (tb < best) { best = tb; hit = { id: t.id, head: false }; wall = false; }
  }
  return { t: best, hit, wall: wall && best < range };
}

function startReload() {
  const w = WEAPONS[me.weapon];
  if (w.melee || me.reloadUntil > 0 || me.ammo[me.weapon] >= w.mag || !me.alive) return;
  me.reloadUntil = nowS() + w.reload;
  SFX.playReload();
}

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
    if (adsT < 0.5) spread += me.weapon === 'sniper' ? 0.06 : 0.01;
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
    kick = Math.min(0.12, kick + (me.weapon === 'sniper' || me.weapon === 'shotgun' ? 0.09 : 0.03));
    me.pitch = Math.min(1.5, me.pitch + w.recoil * (adsT > 0.5 ? 0.6 : 1));
    me.yaw += (Math.random() - 0.5) * w.recoil * 0.5;
    if (me.ammo[me.weapon] === 0) setTimeout(startReload, 200);
  }
}
let flashUntil = 0;
const flashLight = new THREE.PointLight(0xffc670, 0, 8);
scene.add(flashLight);

// ---------- effects ----------
const fx = [];
const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.85 });
const tracerGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 4);
tracerGeo.translate(0, 0.5, 0);
tracerGeo.rotateX(Math.PI / 2);   // now points along +z from 0 to 1
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
  const from = av.muzzleWorld;
  for (const e of m.ends) tracer(from, new THREE.Vector3(e[0], e[1], e[2]));
  const d = Math.hypot(av.display.x - me.x, av.display.z - me.z);
  if (m.w !== 'knife') SFX.playShot(m.w, 1 / (1 + d / 10));
}
let hitTimer = 0;
function onHit(m) {
  const hm = $('hitmarker');
  hm.className = m.head ? 'head' : '';
  hm.style.opacity = 1;
  hitTimer = m.kill ? 0.35 : 0.15;
  if (m.kill) SFX.playKill(); else SFX.playHit(m.head);
}
let hurtT = 0;
function onHurt() { hurtT = 0.5; SFX.playHurt(); }

// ---------- HUD ----------
function addFeed(m) {
  const tdm = snap && snap.mode === 'tdm';
  const col = t => (tdm ? TEAM_TAG[t] : '#fff');
  const wn = m.w === 'undead' ? '☠ undead' : WEAPONS[m.w] ? WEAPONS[m.w].name : m.w;
  addFeedHtml(`<span style="color:${col(m.kt)}">${esc(m.killer)}</span><span class="w">[${wn}${m.head ? ' · headshot' : ''}]</span><span style="color:${col(m.vt)}">${esc(m.victim)}</span>`);
}
function addFeedText(t) { addFeedHtml(`<span style="color:#aaa">${esc(t)}</span>`); }
function addFeedHtml(h) {
  const d = document.createElement('div');
  d.innerHTML = h;
  $('feed').prepend(d);
  while ($('feed').children.length > 6) $('feed').lastChild.remove();
  setTimeout(() => d.remove(), 6000);
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function showBanner(title, text) { matchBanner = { until: nowS() + 4, title, text }; }
function renderWeaponList() {
  $('weapons').innerHTML = me.weapons.map((w, i) => `<div class="${w === me.weapon ? 'on' : ''}">${i + 1} ${WEAPONS[w].name}</div>`).join('');
}
const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const cache = {};
function setHTML(id, html) { if (cache[id] !== html) { $(id).innerHTML = html; cache[id] = html; } }

function updateHud(dt) {
  if (!snap) return;
  const w = WEAPONS[me.weapon];
  // top bar
  let top = `<span class="mode">${MODES[snap.mode].short}</span><span>${fmtTime(snap.timeLeft)}</span>`;
  const ranked = [...snap.players].sort((a, b) => snap.mode === 'gungame' ? b.lvl - a.lvl || b.k - a.k : b.k - a.k);
  const mine = snap.players.find(p => p.id === me.id);
  if (snap.mode === 'tdm') top += `<span class="red">RED ${snap.teamScore[0]}</span>–<span class="blue">${snap.teamScore[1]} BLUE</span><span class="${me.team ? 'blue' : 'red'}">(you: ${me.team ? 'Blue' : 'Red'})</span>`;
  else if (ranked[0]) top += `<span>Leader: ${esc(ranked[0].name)} ${snap.mode === 'gungame' ? 'gun ' + (ranked[0].lvl + 1) : ranked[0].k}</span>${mine ? `<span>You: ${snap.mode === 'gungame' ? 'gun ' + (mine.lvl + 1) + '/' + GUNGAME_ORDER.length : mine.k}</span>` : ''}`;
  setHTML('topbar', top);

  // health / ammo
  const hpPct = Math.max(0, me.hp / me.mhp * 100);
  $('hpfill').style.width = hpPct + '%';
  $('hpfill').style.background = hpPct > 40 ? '#3ccf5a' : '#e74c3c';
  setHTML('hptext', `${Math.max(0, me.hp)} HP · ${snap.mode === 'gungame' ? 'Gun Game' : CLASSES[me.cls].name}`);
  setHTML('ammo', w.melee ? '∞' : `${me.ammo[me.weapon]}<small> / ${w.mag}</small>`);
  setHTML('wname', w.name);
  setHTML('reloading', me.reloadUntil > 0 ? 'RELOADING…' : !w.melee && me.ammo[me.weapon] === 0 ? 'PRESS R TO RELOAD' : '');
  setHTML('ggbar', snap.mode === 'gungame' && mine ? `GUN ${mine.lvl + 1} / ${GUNGAME_ORDER.length}` : '');
  const summoner = me.cls === 'summoner' && snap.mode !== 'gungame';
  setHTML('ability', summoner && mine ? (mine.cd > 0 ? `<span style="color:#999">[Q] Summon undead: ${mine.cd}s</span>` : `<span style="color:#9dff4a">[Q] Summon undead: READY</span>`) : '');

  // crosshair
  const scoped = me.weapon === 'sniper' && adsT > 0.85;
  $('scope').classList.toggle('hidden', !scoped);
  const ch = $('crosshair');
  ch.style.display = scoped || (adsT > 0.6 && !w.melee) ? 'none' : '';
  const gap = 5 + (w.spread + Math.min(1, Math.hypot(me.vx, me.vz) / 8.6) * 0.025 + (me.onGround ? 0 : 0.04)) * 380;
  const L = 8, T = 2;
  const parts = ch.children;
  const set = (el, x, y, wd, ht) => { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = wd + 'px'; el.style.height = ht + 'px'; };
  set(parts[0], -gap - L, -T / 2, L, T); set(parts[1], gap, -T / 2, L, T);
  set(parts[2], -T / 2, -gap - L, T, L); set(parts[3], -T / 2, gap, T, L);

  hitTimer -= dt;
  if (hitTimer <= 0) $('hitmarker').style.opacity = 0;
  hurtT = Math.max(0, hurtT - dt);
  $('vignette').style.opacity = Math.max(hurtT, hpPct < 35 && me.alive ? 0.35 : 0);

  // center messages
  let center = '';
  if (snap.over) {
    center = `<h2>🏆 ${esc(snap.winner)} wins!</h2><p>Next: ${MODES[nextMode(snap.mode)].name} in ${snap.nextIn}…</p>`;
  } else if (!me.alive && me.joined && me.diedAt) {
    const left = Math.max(0, Math.ceil(me.respawnIn - (nowS() - me.diedAt)));
    center = `<h2>You were killed by ${esc(me.killer)}</h2><p>Respawning in ${left}…</p>`;
  } else if (nowS() < matchBanner.until) {
    center = `<h2>${esc(matchBanner.title)}</h2><p>${esc(matchBanner.text)}</p>`;
  }
  setHTML('center', center);

  // scoreboard
  const sb = $('scoreboard');
  if (keys.has('Tab')) {
    sb.classList.remove('hidden');
    const row = p => `<tr class="${p.id === me.id ? 'me' : ''}"><td style="color:${snap.mode === 'tdm' ? TEAM_TAG[p.team] : '#fff'}">${esc(p.name)}${p.bot ? ' <small style="color:#777">BOT</small>' : ''}</td><td>${snap.mode === 'gungame' ? 'Gun ' + (p.lvl + 1) : CLASSES[p.cls].name}</td><td>${p.k}</td><td>${p.d}</td></tr>`;
    setHTML('scoreboard', `<h3>${MODES[snap.mode].name}</h3><table><tr><th>Player</th><th>${snap.mode === 'gungame' ? 'Level' : 'Class'}</th><th>Kills</th><th>Deaths</th></tr>${ranked.map(row).join('')}</table>`);
  } else sb.classList.add('hidden');
}
const ROT = ['ffa', 'tdm', 'gungame'];
const nextMode = m => ROT[(ROT.indexOf(m) + 1) % ROT.length];

// ---------- main loop ----------
let last = performance.now(), sendAcc = 0;
function frame(nowMs) {
  const dt = Math.min((nowMs - last) / 1000, 0.05);
  last = nowMs;
  const t = nowS();

  if (me.alive && playing) updateMovement(dt);
  else if (me.alive) { me.vx = me.vz = 0; const s = Math.ceil(dt / (1 / 120)); for (let i = 0; i < s; i++) moveBody(me, dt / s); }

  // reload finishing
  if (me.reloadUntil > 0 && t >= me.reloadUntil) { me.ammo[me.weapon] = WEAPONS[me.weapon].mag; me.reloadUntil = 0; }
  if (fireHeld || firePressed) tryFire();
  if (!fireHeld) firePressed = false;

  // camera
  const w = WEAPONS[me.weapon];
  const ads = adsHeld && me.alive && playing && !w.melee && me.reloadUntil === 0;
  adsT += ((ads ? 1 : 0) - adsT) * Math.min(1, dt * 14);
  const targetEye = me.alive ? (me.crouch ? 1.12 : 1.62) : 0.35;
  me.eyeH += (targetEye - me.eyeH) * Math.min(1, dt * (me.alive ? 12 : 3));
  const speed = Math.hypot(me.vx, me.vz);
  if (me.onGround && speed > 0.5 && me.slideT <= 0) bobPhase += dt * speed * 1.15;
  const bobAmt = me.onGround && me.slideT <= 0 ? Math.min(1, speed / 6) * (1 - adsT * 0.8) : 0;
  landDip *= Math.exp(-dt * 10);
  camera.position.set(me.x, me.y + me.eyeH + Math.sin(bobPhase * 2) * 0.035 * bobAmt - landDip, me.z);
  const roll = me.slideT > 0 ? 0.07 : !me.alive && me.joined ? 0.4 : 0;
  camera.rotation.set(me.pitch, me.yaw, roll);
  const targetFov = 75 / (adsT > 0.01 ? 1 + (w.zoom - 1) * adsT : 1) + (me.sprinting && speed > 6 ? 7 : 0) + (me.slideT > 0 ? 10 : 0);
  fov += (targetFov - fov) * Math.min(1, dt * 10);
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }

  // first-person weapon pose
  kick *= Math.exp(-dt * 12);
  swayX *= Math.exp(-dt * 8); swayY *= Math.exp(-dt * 8);
  switchT = Math.max(0, switchT - dt);
  stabT = Math.max(0, stabT - dt);
  const knife = me.weapon === 'knife';
  const hip = knife ? [0.24, -0.24, -0.4] : [0.17, -0.19, -0.48];
  const aim = [0, -(SIGHT_HEIGHT[me.weapon] || 0.1), -0.3];
  const h = viewModel.holder;
  const sprintPose = me.sprinting && speed > 6 ? 1 : 0;
  h.position.set(
    hip[0] + (aim[0] - hip[0]) * adsT + swayX + Math.cos(bobPhase) * 0.012 * bobAmt - sprintPose * 0.04,
    hip[1] + (aim[1] - hip[1]) * adsT + swayY + Math.abs(Math.sin(bobPhase)) * 0.012 * bobAmt - switchT * 0.6 - sprintPose * 0.03,
    hip[2] + (aim[2] - hip[2]) * adsT + kick * 0.6 - Math.sin(stabT / 0.25 * Math.PI) * 0.25,
  );
  const reloadP = me.reloadUntil > 0 ? 1 - (me.reloadUntil - t) / w.reload : 0;
  h.rotation.set(kick * 1.2 - Math.sin(reloadP * Math.PI) * 0.7, sprintPose * 0.6 + (knife ? 0.3 : 0), sprintPose * 0.3 + Math.sin(reloadP * Math.PI) * 0.4);
  viewModel.root.visible = me.alive && !(me.weapon === 'sniper' && adsT > 0.85);
  if (t > flashUntil) { viewModel.flash.visible = false; flashLight.intensity = 0; }
  vmCamera.fov = 70 - adsT * 12;
  vmCamera.updateProjectionMatrix();

  // other players & undead
  for (const av of avatars.values()) if (av.state) av.update(dt, av.state);
  for (const av of undeadAvatars.values()) {
    if (!av.state) continue;
    av.update(dt, av.state);
    av.root.position.y -= (1 - av.state.rise) * 1.7;
  }
  updateFx(dt);

  // send my position 20 times a second
  sendAcc += dt;
  if (sendAcc >= 0.05 && me.alive && me.joined) {
    sendAcc = 0;
    send({ t: 'pos', seq: me.seq, x: +me.x.toFixed(3), y: +me.y.toFixed(3), z: +me.z.toFixed(3), yaw: +me.yaw.toFixed(3), pitch: +me.pitch.toFixed(3), c: me.crouch ? 1 : 0, s: me.slideT > 0 ? 1 : 0 });
  }

  updateHud(dt);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.render(vmScene, vmCamera);
  requestAnimationFrame(frame);
}

// menu-screen camera before joining: slow fly-around
camera.position.set(0, 12, 30);
me.yaw = 0; me.pitch = -0.3; me.y = 10; me.z = 30;
renderWeaponList();
requestAnimationFrame(frame);
window.__gns = { me, get snap() { return snap; }, avatars, undeadAvatars, camera };
