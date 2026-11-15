// G-ns 3D game server.
// Players move on their own computer (smooth feel); the server checks their shots and runs
// everything else: health, kills, teams, game modes, bots and the undead.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const S = require('./public/shared.js');
const { MAP, WEAPONS, CLASSES, SUMMON, GUNGAME_ORDER, GUNGAME_KILLS_PER_LEVEL, MODES, collides, moveBody } = S;

const PORT = process.env.PORT || 3000;
const TICK = 30;               // simulation steps per second
const SEND_EVERY = 2;          // send state every 2nd tick (15 per second)
const TARGET_PLAYERS = 20;     // bots fill the game up to this many players
const RESPAWN_TIME = 3;
const MATCH_TIME = Number(process.env.MATCH_TIME) || 5 * 60;
const INTERMISSION = Number(process.env.INTERMISSION) || 10;
const MODE_ROTATION = ['ffa', 'tdm', 'gungame'];
const BOT_NAMES = ['Viper', 'Ghost', 'Rex', 'Nova', 'Blaze', 'Shadow', 'Tank', 'Hawk', 'Jinx', 'Raven', 'Bolt', 'Spike',
  'Frost', 'Ace', 'Duke', 'Echo', 'Fang', 'Gunner', 'Havoc', 'Iron', 'Kilo', 'Lynx', 'Moose', 'Ninja', 'Onyx', 'Pixel'];

const ents = new Map();      // players + bots, by id
const undead = new Map();    // summoned undead, by id
let nextId = 1;
const match = { mode: 'ffa', modeIndex: 0, endsAt: 0, over: false, nextAt: 0, winner: '', teamScore: [0, 0] };
let clock = 0;               // seconds since start (simulation time)

// ---------- helpers ----------
const rand = (a, b) => a + Math.random() * (b - a);
function cleanName(name) {
  const s = String(name || '').replace(/[^\w \-.]/g, '').trim().slice(0, 16);
  return s || 'Player';
}

function rayBox(o, d, b, maxT) {
  let tmin = 0, tmax = maxT;
  const mins = [b.x, b.y, b.z], maxs = [b.x + b.w, b.y + b.h, b.z + b.d];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < mins[i] || o[i] > maxs[i]) return Infinity;
    } else {
      let t1 = (mins[i] - o[i]) / d[i], t2 = (maxs[i] - o[i]) / d[i];
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}
function lineBlocked(a, b) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(d[0], d[1], d[2]);
  if (len < 1e-6) return false;
  const n = [d[0] / len, d[1] / len, d[2] / len];
  const lim = len - 0.4;
  for (const box of MAP.boxes) if (box.kind !== 'ground' && rayBox(a, n, box, lim) < lim) return true;
  return false;
}
const eyeOf = e => [e.x, e.y + (e.crouch ? 1.1 : 1.6), e.z];
const chestOf = e => [e.x, e.y + (e.crouch ? 0.8 : 1.2), e.z];
const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

const ownerOf = e => (e.isUndead ? e.owner : e.id);
function isEnemy(a, b) {
  if (ownerOf(a) === ownerOf(b)) return false;
  if (match.mode === 'tdm') return a.team !== b.team;
  return true;
}
const fighters = () => [...ents.values()].filter(e => e.joined);

// ---------- navigation grid for bots and undead ----------
const NAV_STEP = 2, NAV_MIN = -38, NAV_N = Math.floor((38 - NAV_MIN) / NAV_STEP) + 1;
const navFree = new Uint8Array(NAV_N * NAV_N);
const nodeXZ = i => [NAV_MIN + (i % NAV_N) * NAV_STEP, NAV_MIN + Math.floor(i / NAV_N) * NAV_STEP];
for (let i = 0; i < navFree.length; i++) {
  const [x, z] = nodeXZ(i);
  navFree[i] = collides(x, 0.02, z, 0.5, 1.7) ? 0 : 1;
}
const freeNodes = [...navFree.keys()].filter(i => navFree[i]);
function nearestNode(x, z) {
  const cx = Math.round((x - NAV_MIN) / NAV_STEP), cz = Math.round((z - NAV_MIN) / NAV_STEP);
  for (let r = 0; r < 6; r++) {
    let best = -1, bd = Infinity;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const gx = cx + dx, gz = cz + dz;
      if (gx < 0 || gz < 0 || gx >= NAV_N || gz >= NAV_N) continue;
      const i = gz * NAV_N + gx;
      if (!navFree[i]) continue;
      const [nx, nz] = nodeXZ(i);
      const d = Math.hypot(nx - x, nz - z);
      if (d < bd) { bd = d; best = i; }
    }
    if (best >= 0) return best;
  }
  return freeNodes[0];
}
function neighbors(i) {
  const gx = i % NAV_N, gz = Math.floor(i / NAV_N), out = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dz) continue;
    const nx = gx + dx, nz = gz + dz;
    if (nx < 0 || nz < 0 || nx >= NAV_N || nz >= NAV_N) continue;
    const j = nz * NAV_N + nx;
    if (!navFree[j]) continue;
    if (dx && dz && (!navFree[gz * NAV_N + nx] || !navFree[nz * NAV_N + gx])) continue; // no corner cutting
    out.push([j, dx && dz ? 1.414 : 1]);
  }
  return out;
}
function findPath(fx, fz, tx, tz) {
  const start = nearestNode(fx, fz), goal = nearestNode(tx, tz);
  if (start === goal) return [nodeXZ(goal)];
  const [gxw, gzw] = nodeXZ(goal);
  const g = new Map([[start, 0]]), came = new Map();
  const open = [[0, start]];
  let steps = 0;
  while (open.length && steps++ < 2500) {
    // small binary-heap-free open list: pick min (grid is small)
    let mi = 0;
    for (let k = 1; k < open.length; k++) if (open[k][0] < open[mi][0]) mi = k;
    const [, cur] = open.splice(mi, 1)[0];
    if (cur === goal) break;
    for (const [nb, cost] of neighbors(cur)) {
      const ng = g.get(cur) + cost;
      if (ng < (g.has(nb) ? g.get(nb) : Infinity)) {
        g.set(nb, ng); came.set(nb, cur);
        const [nx, nz] = nodeXZ(nb);
        open.push([ng + Math.hypot(nx - gxw, nz - gzw) / NAV_STEP, nb]);
      }
    }
  }
  if (!came.has(goal)) return null;
  const pathNodes = [];
  for (let c = goal; c !== start; c = came.get(c)) pathNodes.push(nodeXZ(c));
  return pathNodes.reverse();
}

// ---------- spawning ----------
function pickSpawn(e) {
  const pool = match.mode === 'tdm' ? MAP.spawns.team[e.team] : MAP.spawns.ffa;
  let best = pool[0], bestScore = -Infinity;
  for (const s of pool) {
    let nearest = 999;
    for (const q of [...ents.values(), ...undead.values()]) {
      if (q.dead || (!q.isUndead && !q.joined) || !isEnemy(e, q)) continue;
      nearest = Math.min(nearest, Math.hypot(q.x - s[0], q.z - s[2]));
    }
    const score = Math.min(nearest, 40) + Math.random() * 8;
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best;
}
function loadout(e) {
  if (match.mode === 'gungame') return [GUNGAME_ORDER[Math.min(e.gunLevel, GUNGAME_ORDER.length - 1)]];
  return CLASSES[e.cls].weapons;
}
function currentWeapon(e) {
  const lo = loadout(e);
  return lo.includes(e.weapon) ? e.weapon : lo[0];
}
function maxHp(e) { return match.mode === 'gungame' ? 100 : CLASSES[e.cls].hp; }

function spawn(e) {
  e.cls = e.nextCls || e.cls;
  const s = pickSpawn(e);
  Object.assign(e, { x: s[0], y: s[1], z: s[2], yaw: s[3] || 0, pitch: 0, vx: 0, vy: 0, vz: 0, onGround: false, crouch: false });
  e.hp = maxHp(e);
  e.dead = false;
  e.spawnSeq++;
  e.weapon = loadout(e)[0];
  e.spawnedAt = clock;
  if (e.bot) Object.assign(e, { target: null, path: null, pathAt: -9, ammo: WEAPONS[e.weapon].mag, reloadUntil: 0, seenAt: -9 });
  send(e, { t: 'spawn', seq: e.spawnSeq, x: e.x, y: e.y, z: e.z, yaw: e.yaw, cls: e.cls, weapons: loadout(e), hp: e.hp });
}

function balanceTeam() {
  const counts = [0, 0];
  for (const q of ents.values()) if (q.joined) counts[q.team]++;
  return counts[0] <= counts[1] ? 0 : 1;
}

function newEntity(bot) {
  const id = nextId++;
  const e = {
    id, bot, ws: null, name: 'Player', team: 0, joined: false, cls: 'rifle', nextCls: null,
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0.35, h: 1.8, onGround: false,
    yaw: 0, pitch: 0, crouch: false, slide: false,
    hp: 100, dead: true, respawnAt: 0, spawnSeq: 0, spawnedAt: 0,
    kills: 0, deaths: 0, lastShot: -9, weapon: 'rifle', gunLevel: 0, levelKills: 0, summonReady: 0,
  };
  ents.set(id, e);
  return e;
}

// ---------- bots ----------
function addBot() {
  const used = new Set([...ents.values()].map(e => e.name));
  const name = BOT_NAMES.find(n => !used.has(n)) || 'Bot' + nextId;
  const e = newEntity(true);
  e.name = name;
  e.cls = Object.keys(CLASSES)[Math.floor(Math.random() * 4)];
  e.team = balanceTeam();
  e.joined = true;
  e.skill = rand(0.55, 0.9);
  spawn(e);
}
function removeBot() {
  // remove the bot on the bigger team (or any bot)
  const counts = [0, 0];
  for (const q of ents.values()) if (q.joined) counts[q.team]++;
  const bigger = counts[0] > counts[1] ? 0 : 1;
  const bots = [...ents.values()].filter(e => e.bot);
  const victim = bots.find(b => b.team === bigger) || bots[0];
  if (victim) { removeUndeadOf(victim.id); ents.delete(victim.id); }
}
function fillBots() {
  let total = fighters().length;
  while (total < TARGET_PLAYERS) { addBot(); total++; }
  while (total > TARGET_PLAYERS && [...ents.values()].some(e => e.bot)) { removeBot(); total--; }
}

function botThink(b, dt) {
  const w = WEAPONS[currentWeapon(b)];
  const cls = CLASSES[b.cls];
  // look for a target 4 times a second
  if (!b.nextScan || clock >= b.nextScan) {
    b.nextScan = clock + 0.25;
    let best = null, bd = Infinity;
    const eye = eyeOf(b);
    const consider = q => {
      if (q.dead || !isEnemy(b, q) || isProtected(q)) return;
      const d = dist3(b, q);
      if (d > 70 || d >= bd) return;
      if (lineBlocked(eye, chestOf(q))) return;
      best = q; bd = d;
    };
    for (const q of ents.values()) if (q.joined) consider(q);
    for (const z of undead.values()) consider(z);
    if (best && best !== b.target) b.seenAt = clock;
    b.target = best;
  }

  let mx = 0, mz = 0, speed = 5.2 * cls.speed;
  const t = b.target && !b.target.dead && (ents.has(b.target.id) || undead.has(b.target.id)) ? b.target : null;
  if (t) {
    const dx = t.x - b.x, dz = t.z - b.z, d = Math.hypot(dx, dz) || 1;
    b.yaw = Math.atan2(-dx, -dz);
    b.pitch = Math.atan2((t.y + 1.2) - (b.y + 1.6), d);
    const want = w.melee || b.weapon === 'shotgun' ? 2 : b.weapon === 'sniper' ? 28 : 13;
    let fwd = d > want + 3 ? 1 : d < want - 3 ? -0.6 : 0;
    if (!b.strafeUntil || clock > b.strafeUntil) { b.strafeDir = Math.random() < 0.5 ? -1 : 1; b.strafeUntil = clock + rand(0.6, 1.8); }
    const side = w.melee ? 0.3 : 0.8;
    // forward (-sin yaw, -cos yaw), right (cos yaw, -sin yaw)
    mx = -Math.sin(b.yaw) * fwd + Math.cos(b.yaw) * b.strafeDir * side;
    mz = -Math.cos(b.yaw) * fwd - Math.sin(b.yaw) * b.strafeDir * side;
    b.path = null;
    // summon undead when a fight starts
    if (b.cls === 'summoner' && match.mode !== 'gungame' && clock >= b.summonReady && d < 40) {
      if (undead.size <= 6 && Math.random() < 0.4) summon(b); else b.summonReady = clock + 8;
    }
    // shoot after a short reaction time
    if (clock - b.seenAt > 0.6 / b.skill) botFire(b, t, d);
  } else {
    // wander toward enemies along the nav grid
    if (!b.path || !b.path.length || clock - b.pathAt > 4) {
      b.pathAt = clock;
      let goal = null;
      if (Math.random() < 0.7) {
        let bd = Infinity;
        for (const q of ents.values()) if (q.joined && !q.dead && isEnemy(b, q)) {
          const d = dist2d(b, q);
          if (d < bd) { bd = d; goal = q; }
        }
      }
      const [gx, gz] = goal ? [goal.x, goal.z] : nodeXZ(freeNodes[Math.floor(Math.random() * freeNodes.length)]);
      b.path = findPath(b.x, b.z, gx, gz);
    }
    if (b.path && b.path.length) {
      const [px, pz] = b.path[0];
      const dx = px - b.x, dz = pz - b.z, d = Math.hypot(dx, dz);
      if (d < 0.8) b.path.shift();
      else { mx = dx / d; mz = dz / d; b.yaw = Math.atan2(-dx, -dz); b.pitch *= 0.9; }
    }
    if (b.ammo < WEAPONS[b.weapon].mag && clock > b.reloadUntil && b.weapon !== 'knife') { b.reloadUntil = clock + WEAPONS[b.weapon].reload; b.ammo = WEAPONS[b.weapon].mag; }
  }
  // bots switch to the knife when an enemy is very close (close combat / summoner)
  if (match.mode !== 'gungame') {
    const lo = loadout(b);
    if (lo.includes('knife')) b.weapon = t && dist3(b, t) < 3 ? 'knife' : lo[0];
    else if (lo.includes('pistol') && b.weapon === 'sniper' && t && dist3(b, t) < 8) b.weapon = 'pistol';
    else if (!t) b.weapon = lo[0];
  }

  const len = Math.hypot(mx, mz);
  const sp = len > 0 ? speed / Math.max(1, len) : 0;
  b.vx = mx * sp; b.vz = mz * sp;
  moveBody(b, dt);
  if (b.blocked && b.onGround) { b.vy = 7; if (!t) b.path = null; }
}

function botFire(b, t, d) {
  const wName = currentWeapon(b);
  const w = WEAPONS[wName];
  if (clock - b.lastShot < w.fireDelay * (w.auto ? 1.3 : 1.6) || clock < b.reloadUntil) return;
  if (w.melee && d > w.range) return;
  if (!w.melee && b.ammo <= 0) { b.reloadUntil = clock + w.reload; b.ammo = w.mag; return; }
  b.lastShot = clock;
  if (!w.melee) b.ammo--;
  const base = { rifle: 0.3, smg: 0.27, shotgun: 0.45, pistol: 0.3, sniper: 0.4, knife: 0.8 }[wName];
  const tSpeed = Math.hypot(t.vx || 0, t.vz || 0);
  const ends = [];
  let total = 0, head = false;
  for (let i = 0; i < w.pellets; i++) {
    let p = base * b.skill * Math.max(0.12, 1 - d / (w.range * 0.9)) * (tSpeed > 3 ? 0.7 : 1);
    if (wName === 'shotgun' && d > 15) p *= 0.4;
    const hit = Math.random() < p;
    const c = chestOf(t);
    if (hit) {
      const isHead = Math.random() < 0.12;
      head = head || isHead;
      total += damageAt(w, d, isHead);
      ends.push([+c[0].toFixed(2), +(c[1] + (isHead ? 0.45 : 0)).toFixed(2), +c[2].toFixed(2)]);
    } else {
      ends.push([+(c[0] + rand(-1.5, 1.5)).toFixed(2), +(c[1] + rand(-0.8, 1)).toFixed(2), +(c[2] + rand(-1.5, 1.5)).toFixed(2)]);
    }
  }
  broadcast({ t: 'shot', id: b.id, w: wName, ends: w.melee ? [] : ends.slice(0, 9) });
  if (total > 0) applyDamage(b, t, Math.round(total), wName, head);
}

function damageAt(w, dist, head) {
  let dmg = w.damage;
  if (dist > w.falloffStart) {
    const k = Math.min(1, (dist - w.falloffStart) / Math.max(1, w.range - w.falloffStart));
    dmg *= 1 - k * 0.6;
  }
  return head ? dmg * w.headMult : dmg;
}

// ---------- the undead ----------
function summon(owner) {
  owner.summonReady = clock + SUMMON.cooldown;
  removeUndeadOf(owner.id);
  for (let i = 0; i < SUMMON.count; i++) {
    let x = owner.x, z = owner.z;
    for (let tries = 0; tries < 12; tries++) {
      const a = rand(0, Math.PI * 2), r = rand(1.5, 3);
      const cx = owner.x + Math.cos(a) * r, cz = owner.z + Math.sin(a) * r;
      if (!collides(cx, owner.y + 0.05, cz, 0.35, 1.8)) { x = cx; z = cz; break; }
    }
    const id = nextId++;
    undead.set(id, {
      id, isUndead: true, owner: owner.id, ownerName: owner.name, team: owner.team, name: 'Undead',
      x, y: owner.y + 0.05, z, vx: 0, vy: 0, vz: 0, r: 0.35, h: 1.8, onGround: false, yaw: owner.yaw,
      hp: SUMMON.hp, dead: false, dieAt: clock + SUMMON.life, lastHit: -9, target: null, path: null, pathAt: -9, rise: clock,
    });
  }
  broadcast({ t: 'summon', id: owner.id });
}
function removeUndeadOf(ownerId) {
  for (const [id, z] of undead) if (z.owner === ownerId) undead.delete(id);
}
function undeadThink(z, dt) {
  if (clock - z.rise < 0.8) { moveBody(z, dt); return; }   // rising out of the ground
  if (!z.nextScan || clock >= z.nextScan) {
    z.nextScan = clock + 0.3;
    let best = null, bd = 45;
    for (const q of ents.values()) {
      if (!q.joined || q.dead || !isEnemy(z, q) || isProtected(q)) continue;
      const d = dist3(z, q);
      if (d < bd) { bd = d; best = q; }
    }
    z.target = best;
  }
  let mx = 0, mz = 0;
  const t = z.target && !z.target.dead && ents.has(z.target.id) ? z.target : null;
  if (t) {
    const d = dist3(z, t);
    const direct = d < 4 || !lineBlocked([z.x, z.y + 0.6, z.z], [t.x, t.y + 0.6, t.z]);
    let dx = t.x - z.x, dz = t.z - z.z;
    if (!direct) {
      if (!z.path || !z.path.length || clock - z.pathAt > 1.5) { z.pathAt = clock; z.path = findPath(z.x, z.z, t.x, t.z); }
      if (z.path && z.path.length) {
        [dx, dz] = [z.path[0][0] - z.x, z.path[0][1] - z.z];
        if (Math.hypot(dx, dz) < 0.8) z.path.shift();
      }
    }
    const len = Math.hypot(dx, dz) || 1;
    if (d > 1.1) { mx = dx / len; mz = dz / len; }
    z.yaw = Math.atan2(-(t.x - z.x), -(t.z - z.z));
    if (d < 1.5 && clock - z.lastHit > SUMMON.hitDelay) {
      z.lastHit = clock;
      broadcast({ t: 'claw', id: z.id });
      applyDamage(z, t, SUMMON.damage, 'undead', false);
    }
  }
  z.vx = mx * SUMMON.speed; z.vz = mz * SUMMON.speed;
  moveBody(z, dt);
  if (z.blocked && z.onGround) z.vy = 6.5;
}

// ---------- damage & kills ----------
const SPAWN_PROTECT = 3;
const isProtected = e => !e.isUndead && clock - e.spawnedAt < SPAWN_PROTECT && e.lastShot < e.spawnedAt;
function applyDamage(attacker, victim, amount, wName, head) {
  if (victim.dead || match.over || isProtected(victim)) return;
  victim.hp -= amount;
  if (!attacker.isUndead && !attacker.bot) send(attacker, { t: 'hit', head, kill: victim.hp <= 0 });
  if (!victim.isUndead) send(victim, { t: 'hurt', from: [attacker.x, attacker.z], amount });
  if (victim.hp > 0) return;
  if (victim.isUndead) {
    undead.delete(victim.id);
    broadcast({ t: 'undeadDie', id: victim.id });
    return;
  }
  // credit the summoner for undead kills
  const killer = attacker.isUndead ? ents.get(attacker.owner) : attacker;
  victim.hp = 0;
  victim.dead = true;
  victim.deaths++;
  victim.respawnAt = clock + RESPAWN_TIME;
  removeUndeadOf(victim.id);
  send(victim, { t: 'died', by: killer ? killer.name : 'Undead', in: RESPAWN_TIME });
  broadcast({ t: 'kill', killer: killer ? killer.name : 'Undead', kt: killer ? killer.team : 0, victim: victim.name, vt: victim.team, w: wName, head });
  if (!killer || killer === victim) return;
  killer.kills++;
  if (match.mode === 'tdm') match.teamScore[killer.team]++;
  if (match.mode === 'gungame' && !attacker.isUndead) {
    killer.levelKills++;
    if (killer.levelKills >= GUNGAME_KILLS_PER_LEVEL) {
      killer.levelKills = 0;
      killer.gunLevel++;
      if (killer.gunLevel < GUNGAME_ORDER.length) {
        killer.weapon = GUNGAME_ORDER[killer.gunLevel];
        if (killer.bot) killer.ammo = WEAPONS[killer.weapon].mag;
        send(killer, { t: 'weapons', weapons: loadout(killer) });
      }
    }
  }
  checkWin(killer);
}

function handleShot(p, msg) {
  if (!p.joined || p.dead || match.over) return;
  const wName = currentWeapon(p);
  const w = WEAPONS[wName];
  if (msg.weapon !== wName) return;
  if (clock - p.lastShot < w.fireDelay * 0.75) return;
  p.lastShot = clock;
  if (Array.isArray(msg.ends)) broadcastExcept(p, { t: 'shot', id: p.id, w: wName, ends: msg.ends.slice(0, 9) });
  if (!Array.isArray(msg.hits)) return;
  const byTarget = new Map();
  for (const h of msg.hits.slice(0, w.pellets)) {
    const target = ents.get(h.id) || undead.get(h.id);
    if (!target || target.dead || (!target.isUndead && !target.joined) || !isEnemy(p, target)) continue;
    const eye = eyeOf(p);
    const d = dist3({ x: eye[0], y: eye[1], z: eye[2] }, { x: target.x, y: target.y + 1, z: target.z });
    if (d > w.range + 4) continue;
    if (lineBlocked(eye, chestOf(target)) && lineBlocked(eye, [target.x, target.y + 1.6, target.z])) continue;
    const prev = byTarget.get(target) || { dmg: 0, head: false };
    prev.dmg += damageAt(w, d, !!h.head);
    prev.head = prev.head || !!h.head;
    byTarget.set(target, prev);
  }
  for (const [target, { dmg, head }] of byTarget) applyDamage(p, target, Math.round(dmg), wName, head);
}

// ---------- match flow ----------
function startMatch(mode) {
  Object.assign(match, { mode, over: false, endsAt: clock + MATCH_TIME, teamScore: [0, 0], winner: '' });
  undead.clear();
  const list = fighters().sort(() => Math.random() - 0.5);
  // humans spread evenly first, then bots
  list.sort((a, b) => a.bot - b.bot);
  list.forEach((e, i) => { e.team = i % 2; });
  for (const e of list) {
    Object.assign(e, { kills: 0, deaths: 0, gunLevel: 0, levelKills: 0, summonReady: 0 });
    spawn(e);
  }
  broadcast({ t: 'match', mode });
}
function endMatch(winner) {
  if (match.over) return;
  Object.assign(match, { over: true, winner, nextAt: clock + INTERMISSION });
  match.modeIndex = (match.modeIndex + 1) % MODE_ROTATION.length;
  broadcast({ t: 'matchEnd', winner, next: MODE_ROTATION[match.modeIndex] });
}
function checkWin(k) {
  if (match.mode === 'tdm') {
    if (match.teamScore[k.team] >= MODES.tdm.scoreLimit) endMatch(k.team === 0 ? 'Red team' : 'Blue team');
  } else if (match.mode === 'gungame') {
    if (k.gunLevel >= GUNGAME_ORDER.length) endMatch(k.name);
  } else if (k.kills >= MODES.ffa.scoreLimit) endMatch(k.name);
}
function timeUpWinner() {
  if (match.mode === 'tdm') {
    const [r, b] = match.teamScore;
    return r === b ? 'Draw' : r > b ? 'Red team' : 'Blue team';
  }
  const list = fighters();
  if (!list.length) return 'Nobody';
  const key = match.mode === 'gungame' ? e => e.gunLevel * 100 + e.levelKills : e => e.kills;
  return list.sort((a, b) => key(b) - key(a))[0].name;
}

// ---------- networking ----------
function send(e, msg) { if (e.ws && e.ws.readyState === 1) e.ws.send(JSON.stringify(msg)); }
function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const e of ents.values()) if (e.ws && e.ws.readyState === 1) e.ws.send(data);
}
function broadcastExcept(ex, msg) {
  const data = JSON.stringify(msg);
  for (const e of ents.values()) if (e !== ex && e.ws && e.ws.readyState === 1) e.ws.send(data);
}
const r2 = v => Math.round(v * 100) / 100;
function snapshot() {
  return JSON.stringify({
    t: 'state',
    mode: match.mode,
    timeLeft: match.over ? 0 : Math.max(0, Math.round(match.endsAt - clock)),
    over: match.over,
    nextIn: match.over ? Math.max(0, Math.ceil(match.nextAt - clock)) : 0,
    winner: match.winner,
    teamScore: match.teamScore,
    players: fighters().map(e => ({
      id: e.id, name: e.name, team: e.team, bot: e.bot ? 1 : 0, cls: e.cls,
      x: r2(e.x), y: r2(e.y), z: r2(e.z), yaw: r2(e.yaw), pitch: r2(e.pitch),
      c: e.crouch ? 1 : 0, s: e.slide ? 1 : 0,
      hp: Math.max(0, Math.round(e.hp)), sp: isProtected(e) ? 1 : 0, mhp: maxHp(e), dead: e.dead, k: e.kills, d: e.deaths,
      w: currentWeapon(e), lvl: e.gunLevel, cd: Math.max(0, Math.ceil(e.summonReady - clock)),
    })),
    undead: [...undead.values()].map(z => ({
      id: z.id, o: z.owner, team: z.team, x: r2(z.x), y: r2(z.y), z: r2(z.z), yaw: r2(z.yaw),
      hp: z.hp, rise: Math.min(1, r2((clock - z.rise) / 0.8)), m: Math.hypot(z.vx, z.vz) > 0.5 ? 1 : 0,
    })),
  });
}

const vendorDir = path.join(__dirname, 'node_modules', 'three', 'build');
const publicDir = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let base = publicDir, rel = urlPath === '/' ? 'index.html' : urlPath;
  if (urlPath.startsWith('/vendor/')) { base = vendorDir; rel = urlPath.slice('/vendor/'.length); }
  const file = path.normalize(path.join(base, rel));
  if (!file.startsWith(base)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
wss.on('connection', ws => {
  const p = newEntity(false);
  p.ws = ws;
  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    switch (msg.t) {
      case 'join':
        if (p.joined) return;
        p.name = cleanName(msg.name);
        if (CLASSES[msg.cls]) p.cls = msg.cls;
        p.team = balanceTeam();
        p.joined = true;
        send(p, { t: 'welcome', id: p.id, mode: match.mode });
        spawn(p);
        fillBots();
        broadcast({ t: 'info', text: `${p.name} joined` });
        break;
      case 'rename': {
        if (!p.joined) return;
        const old = p.name;
        p.name = cleanName(msg.name);
        if (old !== p.name) broadcast({ t: 'info', text: `${old} is now ${p.name}` });
        break;
      }
      case 'class':
        if (CLASSES[msg.cls]) p.nextCls = msg.cls;
        break;
      case 'pos':
        if (!p.joined || p.dead || msg.seq !== p.spawnSeq) return;
        if ([msg.x, msg.y, msg.z, msg.yaw, msg.pitch].every(Number.isFinite)) {
          if (Math.hypot(msg.x - p.x, msg.z - p.z) < 6) {
            p.vx = (msg.x - p.x) * 15; p.vz = (msg.z - p.z) * 15;
            p.x = msg.x; p.y = msg.y; p.z = msg.z;
          }
          p.yaw = msg.yaw; p.pitch = msg.pitch;
          p.crouch = !!msg.c; p.slide = !!msg.s;
        }
        break;
      case 'weapon':
        if (loadout(p).includes(msg.weapon)) p.weapon = msg.weapon;
        break;
      case 'shoot':
        handleShot(p, msg);
        break;
      case 'ability':
        if (p.joined && !p.dead && !match.over && p.cls === 'summoner' && match.mode !== 'gungame' && clock >= p.summonReady) summon(p);
        break;
    }
  });
  ws.on('close', () => {
    ents.delete(p.id);
    removeUndeadOf(p.id);
    if (p.joined) { broadcast({ t: 'info', text: `${p.name} left` }); fillBots(); }
  });
});

// ---------- main loop ----------
let tickCount = 0;
let last = Date.now();
setInterval(() => {
  const nowMs = Date.now();
  const dt = Math.min((nowMs - last) / 1000, 0.1);
  last = nowMs;
  clock += dt;
  const humans = [...ents.values()].some(e => !e.bot && e.joined);

  if (match.over) {
    if (clock >= match.nextAt) startMatch(MODE_ROTATION[match.modeIndex]);
  } else if (clock >= match.endsAt) {
    endMatch(timeUpWinner());
  }
  if (humans && !match.over) {
    for (const e of ents.values()) {
      if (!e.joined) continue;
      if (e.dead) { if (clock >= e.respawnAt) spawn(e); continue; }
      if (e.bot) botThink(e, dt);
    }
    for (const z of undead.values()) {
      if (clock >= z.dieAt || !ents.has(z.owner)) { undead.delete(z.id); broadcast({ t: 'undeadDie', id: z.id }); continue; }
      undeadThink(z, dt);
    }
  }
  // nobody real is playing: remove the bots so the server rests
  if (!humans && [...ents.values()].some(e => e.bot)) {
    for (const e of [...ents.values()]) if (e.bot) ents.delete(e.id);
    undead.clear();
  }
  if (++tickCount % SEND_EVERY === 0) {
    const data = snapshot();
    for (const e of ents.values()) if (e.ws && e.ws.readyState === 1) e.ws.send(data);
  }
}, 1000 / TICK);

startMatch('ffa');
server.listen(PORT, () => console.log(`G-ns server running on http://localhost:${PORT}`));
