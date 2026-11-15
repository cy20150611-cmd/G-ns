// G-ns game server.
// Each game mode + map is its own room. Players move on their own computer (smooth feel);
// the server checks shots and runs health, kills, teams, modes, bots and the undead.
// It also stores the gun sets players build so everyone can search them.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const S = require('./public/shared.js');
const { MAX_HP, WEAPONS, PRIMARIES, SECONDARIES, SPECIALS, SUMMON, DEFAULT_SETS, cleanSet,
  MODES, GUNGAME_ORDER, GUNGAME_KILLS_PER_LEVEL, HORDE_WAVES, MAPS, collides, moveBody } = S;

const PORT = process.env.PORT || 3000;
const TICK = 30;
const SEND_EVERY = 2;
const RESPAWN_TIME = 3;
const SPAWN_PROTECT = 3;
const MATCH_TIME = Number(process.env.MATCH_TIME) || 5 * 60;
const INTERMISSION = Number(process.env.INTERMISSION) || 10;
const ROOM_IDLE_CLOSE = 60;
const BOT_NAMES = ['Viper', 'Ghost', 'Rex', 'Nova', 'Blaze', 'Shadow', 'Tank', 'Hawk', 'Jinx', 'Raven', 'Bolt', 'Spike',
  'Frost', 'Ace', 'Duke', 'Echo', 'Fang', 'Gunner', 'Havoc', 'Iron', 'Kilo', 'Lynx', 'Moose', 'Ninja', 'Onyx', 'Pixel'];

const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const r2 = v => Math.round(v * 100) / 100;
function cleanName(name) {
  const s = String(name || '').replace(/[^\w \-.]/g, '').trim().slice(0, 16);
  return s || 'Player';
}

// ---------- geometry ----------
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
const eyeOf = e => [e.x, e.y + (e.crouch ? 1.1 : 1.6), e.z];
const chestOf = e => [e.x, e.y + (e.crouch ? 0.8 : 1.2), e.z];
const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// ---------- navigation grid (one per map) ----------
const navCache = {};
function getNav(mapId) {
  if (navCache[mapId]) return navCache[mapId];
  const boxes = MAPS[mapId].boxes;
  const STEP = 2, MIN = -38, N = Math.floor((38 - MIN) / STEP) + 1;
  const free = new Uint8Array(N * N);
  const nodeXZ = i => [MIN + (i % N) * STEP, MIN + Math.floor(i / N) * STEP];
  for (let i = 0; i < free.length; i++) {
    const [x, z] = nodeXZ(i);
    free[i] = collides(boxes, x, 0.02, z, 0.5, 1.7) ? 0 : 1;
  }
  const freeNodes = [...free.keys()].filter(i => free[i]);
  // spawn points: open spots (not hugging walls)
  const open = freeNodes.filter(i => { const [x, z] = nodeXZ(i); return !collides(boxes, x, 0.02, z, 1.2, 1.8); });
  const toSpawn = i => { const [x, z] = nodeXZ(i); return [x, 0, z, Math.atan2(x, z)]; };
  const spawns = {
    ffa: open.filter((_, k) => k % 3 === 0).map(toSpawn),
    team: [open.filter(i => nodeXZ(i)[1] < -26).map(toSpawn), open.filter(i => nodeXZ(i)[1] > 26).map(toSpawn)],
  };
  function nearestNode(x, z) {
    const cx = Math.round((x - MIN) / STEP), cz = Math.round((z - MIN) / STEP);
    for (let r = 0; r < 6; r++) {
      let best = -1, bd = Infinity;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const gx = cx + dx, gz = cz + dz;
        if (gx < 0 || gz < 0 || gx >= N || gz >= N) continue;
        const i = gz * N + gx;
        if (!free[i]) continue;
        const [nx, nz] = nodeXZ(i);
        const d = Math.hypot(nx - x, nz - z);
        if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0) return best;
    }
    return freeNodes[0];
  }
  function neighbors(i) {
    const gx = i % N, gz = Math.floor(i / N), out = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = gx + dx, nz = gz + dz;
      if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
      const j = nz * N + nx;
      if (!free[j]) continue;
      if (dx && dz && (!free[gz * N + nx] || !free[nz * N + gx])) continue;
      out.push([j, dx && dz ? 1.414 : 1]);
    }
    return out;
  }
  function findPath(fx, fz, tx, tz) {
    const start = nearestNode(fx, fz), goal = nearestNode(tx, tz);
    if (start === goal) return [nodeXZ(goal)];
    const [gxw, gzw] = nodeXZ(goal);
    const g = new Map([[start, 0]]), came = new Map();
    const openList = [[0, start]];
    let steps = 0;
    while (openList.length && steps++ < 2500) {
      let mi = 0;
      for (let k = 1; k < openList.length; k++) if (openList[k][0] < openList[mi][0]) mi = k;
      const [, cur] = openList.splice(mi, 1)[0];
      if (cur === goal) break;
      for (const [nb, cost] of neighbors(cur)) {
        const ng = g.get(cur) + cost;
        if (ng < (g.has(nb) ? g.get(nb) : Infinity)) {
          g.set(nb, ng); came.set(nb, cur);
          const [nx, nz] = nodeXZ(nb);
          openList.push([ng + Math.hypot(nx - gxw, nz - gzw) / STEP, nb]);
        }
      }
    }
    if (!came.has(goal)) return null;
    const out = [];
    for (let c = goal; c !== start; c = came.get(c)) out.push(nodeXZ(c));
    return out.reverse();
  }
  return (navCache[mapId] = { freeNodes, nodeXZ, findPath, spawns });
}

// ---------- rooms ----------
const rooms = new Map();
let nextId = 1;

class Room {
  constructor(mode, mapId) {
    this.key = `${mode}:${mapId}`;
    this.mode = mode;
    this.mapId = mapId;
    this.map = MAPS[mapId];
    this.boxes = this.map.boxes;
    this.wallBoxes = this.boxes.filter(b => b.kind !== 'ground');
    this.nav = getNav(mapId);
    this.ents = new Map();
    this.undead = new Map();
    this.clock = 0;
    this.tickCount = 0;
    this.emptySince = 0;
    this.match = { over: false, endsAt: 0, nextAt: 0, winner: '', teamScore: [0, 0], wave: 0, waveState: 'wait', waveAt: 0, infectAt: 0, hillTeam: -1 };
    this.startMatch();
  }

  get humans() { return [...this.ents.values()].filter(e => !e.bot && e.joined); }
  fighters() { return [...this.ents.values()].filter(e => e.joined); }
  get modeInfo() { return MODES[this.mode]; }
  get teamMode() { return !!this.modeInfo.teams; }

  lineBlocked(a, b) {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const len = Math.hypot(d[0], d[1], d[2]);
    if (len < 1e-6) return false;
    const n = [d[0] / len, d[1] / len, d[2] / len];
    const lim = len - 0.4;
    for (const box of this.wallBoxes) if (rayBox(a, n, box, lim) < lim) return true;
    return false;
  }

  isEnemy(a, b) {
    const oa = a.isUndead ? a.owner : a.id, ob = b.isUndead ? b.owner : b.id;
    if (oa === ob) return false;
    if (this.teamMode || this.mode === 'horde') return a.team !== b.team;
    return true;
  }
  isProtected(e) { return !e.isUndead && this.clock - e.spawnedAt < SPAWN_PROTECT && e.lastShot < e.spawnedAt; }
  infected(e) { return this.mode === 'infection' && e.team === 1; }

  loadout(e) {
    switch (this.mode) {
      case 'gungame': return [GUNGAME_ORDER[Math.min(e.gunLevel, GUNGAME_ORDER.length - 1)]];
      case 'oneshot': return ['revolver', 'knife'];
      case 'snipers': return ['sniper', 'knife'];
      case 'knives': return ['knife'];
      case 'infection': if (e.team === 1) return ['claws']; break;
    }
    return [e.set.primary, e.set.secondary];
  }
  specialOf(e) {
    if (['gungame', 'oneshot', 'snipers', 'knives'].includes(this.mode) || this.infected(e)) return null;
    return e.set.special;
  }
  currentWeapon(e) { const lo = this.loadout(e); return lo.includes(e.weapon) ? e.weapon : lo[0]; }
  maxHp(e) { return this.infected(e) ? 350 : MAX_HP; }
  startAmmo(w) { return this.mode === 'oneshot' && w === 'revolver' ? 1 : WEAPONS[w].mag; }

  // ----- spawning -----
  pickSpawn(e) {
    let pool = this.nav.spawns.ffa;
    if (this.teamMode && this.mode !== 'infection') pool = this.nav.spawns.team[e.team];
    if (!pool.length) pool = this.nav.spawns.ffa;
    let best = pool[0], bestScore = -Infinity;
    const threats = [...this.ents.values(), ...this.undead.values()].filter(q => !q.dead && (q.isUndead || q.joined) && this.isEnemy(e, q));
    for (let k = 0; k < 24; k++) {
      const s = pick(pool);
      let nearest = 999;
      for (const q of threats) nearest = Math.min(nearest, Math.hypot(q.x - s[0], q.z - s[2]));
      const score = Math.min(nearest, 40) + Math.random() * 6;
      if (score > bestScore) { bestScore = score; best = s; }
    }
    return best;
  }
  spawn(e) {
    if (e.nextSet) { e.set = e.nextSet; e.nextSet = null; }
    const s = this.pickSpawn(e);
    Object.assign(e, { x: s[0], y: s[1], z: s[2], yaw: s[3], pitch: 0, vx: 0, vy: 0, vz: 0, onGround: false, crouch: false });
    e.hp = this.maxHp(e);
    e.dead = false;
    e.spawnSeq++;
    e.weapon = this.loadout(e)[0];
    e.spawnedAt = this.clock;
    if (e.bot) Object.assign(e, { target: null, path: null, pathAt: -9, ammo: this.startAmmo(e.weapon), reloadUntil: 0, seenAt: -9 });
    this.send(e, { t: 'spawn', seq: e.spawnSeq, x: e.x, y: e.y, z: e.z, yaw: e.yaw, weapons: this.loadout(e), special: this.specialOf(e), hp: e.hp, mhp: this.maxHp(e), ammo1: this.mode === 'oneshot' });
  }
  balanceTeam() {
    if (this.mode === 'infection') return 0;
    const c = [0, 0];
    for (const q of this.ents.values()) if (q.joined) c[q.team]++;
    return c[0] <= c[1] ? 0 : 1;
  }
  newEntity(bot, ws) {
    const e = {
      id: nextId++, bot, ws, name: 'Player', team: 0, joined: false, set: cleanSet(DEFAULT_SETS[0]), nextSet: null,
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0.35, h: 1.8, onGround: false, yaw: 0, pitch: 0, crouch: false, slide: false,
      hp: MAX_HP, dead: true, respawnAt: 0, spawnSeq: 0, spawnedAt: 0, kills: 0, deaths: 0, lastShot: -9, weapon: 'rifle',
      gunLevel: 0, abilityReady: 0,
    };
    this.ents.set(e.id, e);
    return e;
  }

  // ----- bots -----
  targetPlayers() { return this.mode === 'horde' ? 6 : 20; }
  addBot() {
    const used = new Set([...this.ents.values()].map(e => e.name));
    const e = this.newEntity(true, null);
    e.name = BOT_NAMES.find(n => !used.has(n)) || 'Bot' + e.id;
    e.set = Math.random() < 0.6 ? cleanSet(pick(DEFAULT_SETS))
      : cleanSet({ name: 'Bot', primary: pick(PRIMARIES), secondary: pick(SECONDARIES), special: pick(Object.keys(SPECIALS)), color: pick(S.COLORS) });
    e.team = this.balanceTeam();
    e.joined = true;
    e.skill = rand(0.55, 0.9);
    if (this.mode === 'horde' && this.match.waveState === 'fight') { e.dead = true; e.respawnAt = Infinity; }
    else this.spawn(e);
  }
  removeBot() {
    const c = [0, 0];
    for (const q of this.ents.values()) if (q.joined) c[q.team]++;
    const bigger = c[0] > c[1] ? 0 : 1;
    const bots = [...this.ents.values()].filter(e => e.bot);
    const v = bots.find(b => b.team === bigger) || bots[0];
    if (v) { this.removeUndeadOf(v.id); this.ents.delete(v.id); }
  }
  fillBots() {
    let total = this.fighters().length;
    const want = this.targetPlayers();
    while (total < want) { this.addBot(); total++; }
    while (total > want && [...this.ents.values()].some(e => e.bot)) { this.removeBot(); total--; }
  }

  botThink(b, dt) {
    const wName = this.currentWeapon(b);
    const w = WEAPONS[wName];
    const C = this.clock;
    if (!b.nextScan || C >= b.nextScan) {
      b.nextScan = C + 0.25;
      let best = null, bd = Infinity;
      const eye = eyeOf(b);
      const consider = q => {
        if (q.dead || !this.isEnemy(b, q) || this.isProtected(q)) return;
        const d = dist3(b, q);
        if (d > 70 || d >= bd) return;
        if (this.lineBlocked(eye, chestOf(q))) return;
        best = q; bd = d;
      };
      for (const q of this.ents.values()) if (q.joined) consider(q);
      for (const z of this.undead.values()) consider(z);
      if (best && best !== b.target) b.seenAt = C;
      b.target = best;
    }
    let mx = 0, mz = 0;
    const speed = 5.2 * w.speed;
    const t = b.target && !b.target.dead && (this.ents.has(b.target.id) || this.undead.has(b.target.id)) ? b.target : null;
    const special = this.specialOf(b);
    if (special === 'medkit' && b.hp < 200 && C >= b.abilityReady) this.useAbility(b);
    if (t) {
      const dx = t.x - b.x, dz = t.z - b.z, d = Math.hypot(dx, dz) || 1;
      b.yaw = Math.atan2(-dx, -dz);
      b.pitch = Math.atan2((t.y + 1.2) - (b.y + 1.6), d);
      const want = w.melee || wName === 'shotgun' ? 1.5 : wName === 'sniper' ? 28 : 13;
      const fwd = d > want + 3 ? 1 : d < want - 3 ? -0.6 : 0;
      if (!b.strafeUntil || C > b.strafeUntil) { b.strafeDir = Math.random() < 0.5 ? -1 : 1; b.strafeUntil = C + rand(0.6, 1.8); }
      const side = w.melee ? 0.3 : 0.8;
      mx = -Math.sin(b.yaw) * fwd + Math.cos(b.yaw) * b.strafeDir * side;
      mz = -Math.cos(b.yaw) * fwd - Math.sin(b.yaw) * b.strafeDir * side;
      b.path = null;
      if (special === 'summon' && C >= b.abilityReady && d < 40) {
        if (this.undead.size <= 6 && Math.random() < 0.4) this.useAbility(b); else b.abilityReady = C + 8;
      }
      if (C - b.seenAt > 0.6 / b.skill) this.botFire(b, t, d);
    } else {
      if (!b.path || !b.path.length || C - b.pathAt > 4) {
        b.pathAt = C;
        let gx, gz;
        if (this.mode === 'koth' && Math.random() < 0.8) {
          [gx, gz] = [this.map.hill[0] + rand(-3, 3), this.map.hill[1] + rand(-3, 3)];
        } else {
          let goal = null, bd = Infinity;
          if (Math.random() < 0.7) {
            for (const q of [...this.ents.values(), ...this.undead.values()]) {
              if (q.dead || (!q.isUndead && !q.joined) || !this.isEnemy(b, q)) continue;
              const d = dist2d(b, q);
              if (d < bd) { bd = d; goal = q; }
            }
          }
          [gx, gz] = goal ? [goal.x, goal.z] : this.nav.nodeXZ(pick(this.nav.freeNodes));
        }
        b.path = this.nav.findPath(b.x, b.z, gx, gz);
      }
      if (b.path && b.path.length) {
        const [px, pz] = b.path[0];
        const dx = px - b.x, dz = pz - b.z, d = Math.hypot(dx, dz);
        if (d < 0.8) b.path.shift();
        else { mx = dx / d; mz = dz / d; b.yaw = Math.atan2(-dx, -dz); b.pitch *= 0.9; }
      }
      if (!w.melee && b.ammo < this.startAmmo(wName) && C > b.reloadUntil && this.mode !== 'oneshot') { b.reloadUntil = C + w.reload; b.ammo = w.mag; }
    }
    const lo = this.loadout(b);
    if (lo.length > 1) {
      const close = t && dist3(b, t) < 3;
      if (lo[1] === 'knife') b.weapon = close || (this.mode === 'oneshot' && b.ammo <= 0) ? 'knife' : lo[0];
      else if (lo[0] === 'sniper' && t && dist3(b, t) < 8) b.weapon = lo[1];
      else if (!t) b.weapon = lo[0];
    }
    const len = Math.hypot(mx, mz);
    const sp = len > 0 ? speed / Math.max(1, len) : 0;
    b.vx = mx * sp; b.vz = mz * sp;
    moveBody(b, dt, this.boxes);
    if (b.blocked && b.onGround) { b.vy = 7; if (!t) b.path = null; }
  }

  botFire(b, t, d) {
    const wName = this.currentWeapon(b);
    const w = WEAPONS[wName];
    const C = this.clock;
    if (C - b.lastShot < w.fireDelay * (w.auto ? 1.3 : 1.6) || C < b.reloadUntil) return;
    if (w.melee && d > w.range) return;
    if (!w.melee && b.ammo <= 0) {
      if (this.mode !== 'oneshot') { b.reloadUntil = C + w.reload; b.ammo = w.mag; }
      return;
    }
    b.lastShot = C;
    if (!w.melee) b.ammo--;
    const base = { rifle: 0.3, smg: 0.27, shotgun: 0.45, pistol: 0.3, sniper: 0.4, lmg: 0.26, dmr: 0.35, revolver: 0.3, knife: 0.8, claws: 0.85 }[wName];
    const tSpeed = Math.hypot(t.vx || 0, t.vz || 0);
    const ends = [];
    let total = 0, head = false;
    for (let i = 0; i < w.pellets; i++) {
      let p = base * b.skill * Math.max(0.12, 1 - d / (w.range * 0.9)) * (tSpeed > 3 ? 0.7 : 1);
      if (wName === 'shotgun' && d > 15) p *= 0.4;
      const c = chestOf(t);
      if (Math.random() < p) {
        const isHead = Math.random() < 0.12;
        head = head || isHead;
        total += this.damageAt(w, d, isHead);
        ends.push([r2(c[0]), r2(c[1] + (isHead ? 0.45 : 0)), r2(c[2])]);
      } else {
        ends.push([r2(c[0] + rand(-1.5, 1.5)), r2(c[1] + rand(-0.8, 1)), r2(c[2] + rand(-1.5, 1.5))]);
      }
    }
    this.broadcast({ t: 'shot', id: b.id, w: wName, ends: w.melee ? [] : ends.slice(0, 9) });
    if (total > 0) this.applyDamage(b, t, Math.round(total), wName, head);
  }

  damageAt(w, dist, head) {
    if (this.mode === 'oneshot') return 9999;
    let dmg = w.damage;
    if (dist > w.falloffStart) {
      const k = Math.min(1, (dist - w.falloffStart) / Math.max(1, w.range - w.falloffStart));
      dmg *= 1 - k * 0.6;
    }
    return head ? dmg * w.headMult : dmg;
  }

  // ----- specials -----
  useAbility(e) {
    const sp = this.specialOf(e);
    if (!sp || e.dead || this.match.over || this.clock < e.abilityReady) return;
    e.abilityReady = this.clock + SPECIALS[sp].cooldown;
    if (sp === 'medkit') { e.hp = Math.min(this.maxHp(e), e.hp + 250); this.send(e, { t: 'healed' }); }
    if (sp === 'summon') this.summon(e);
    // dash happens on the player's own computer; the server only tracks the cooldown
  }

  // ----- undead -----
  makeUndead(owner, team, x, y, z, hp, damage) {
    const id = nextId++;
    this.undead.set(id, {
      id, isUndead: true, owner, team, name: 'Undead', x, y, z, vx: 0, vy: 0, vz: 0, r: 0.35, h: 1.8, onGround: false, yaw: 0,
      hp, damage, dead: false, dieAt: owner === -1 ? Infinity : this.clock + SUMMON.life, lastHit: -9, target: null, path: null, pathAt: -9, rise: this.clock,
    });
  }
  summon(o) {
    this.removeUndeadOf(o.id);
    for (let i = 0; i < SUMMON.count; i++) {
      let x = o.x, z = o.z;
      for (let tries = 0; tries < 12; tries++) {
        const a = rand(0, Math.PI * 2), r = rand(1.5, 3);
        const cx = o.x + Math.cos(a) * r, cz = o.z + Math.sin(a) * r;
        if (!collides(this.boxes, cx, o.y + 0.05, cz, 0.35, 1.8)) { x = cx; z = cz; break; }
      }
      this.makeUndead(o.id, o.team, x, o.y + 0.05, z, SUMMON.hp, SUMMON.damage);
    }
    this.broadcast({ t: 'summon', id: o.id });
  }
  removeUndeadOf(ownerId) { for (const [id, z] of this.undead) if (z.owner === ownerId) this.undead.delete(id); }
  undeadThink(z, dt) {
    const C = this.clock;
    if (C - z.rise < 0.8) { moveBody(z, dt, this.boxes); return; }
    if (!z.nextScan || C >= z.nextScan) {
      z.nextScan = C + 0.3;
      let best = null, bd = z.owner === -1 ? 999 : 45;
      for (const q of this.ents.values()) {
        if (!q.joined || q.dead || !this.isEnemy(z, q) || this.isProtected(q)) continue;
        const d = dist3(z, q);
        if (d < bd) { bd = d; best = q; }
      }
      if (!best) for (const q of this.undead.values()) {   // summoned undead also fight horde undead
        if (q === z || !this.isEnemy(z, q)) continue;
        const d = dist3(z, q);
        if (d < bd && d < 25) { bd = d; best = q; }
      }
      z.target = best;
    }
    let mx = 0, mz = 0;
    const t = z.target && !z.target.dead && (this.ents.has(z.target.id) || this.undead.has(z.target.id)) ? z.target : null;
    if (t) {
      const d = dist3(z, t);
      const direct = d < 4 || !this.lineBlocked([z.x, z.y + 0.6, z.z], [t.x, t.y + 0.6, t.z]);
      let dx = t.x - z.x, dz = t.z - z.z;
      if (!direct) {
        if (!z.path || !z.path.length || C - z.pathAt > 1.5) { z.pathAt = C; z.path = this.nav.findPath(z.x, z.z, t.x, t.z); }
        if (z.path && z.path.length) {
          [dx, dz] = [z.path[0][0] - z.x, z.path[0][1] - z.z];
          if (Math.hypot(dx, dz) < 0.8) z.path.shift();
        }
      }
      const len = Math.hypot(dx, dz) || 1;
      if (d > 1.1) { mx = dx / len; mz = dz / len; }
      z.yaw = Math.atan2(-(t.x - z.x), -(t.z - z.z));
      if (d < 1.5 && C - z.lastHit > SUMMON.hitDelay) {
        z.lastHit = C;
        this.broadcast({ t: 'claw', id: z.id });
        this.applyDamage(z, t, z.damage, 'undead', false);
      }
    }
    z.vx = mx * SUMMON.speed; z.vz = mz * SUMMON.speed;
    moveBody(z, dt, this.boxes);
    if (z.blocked && z.onGround) z.vy = 6.5;
  }

  // ----- damage -----
  applyDamage(attacker, victim, amount, wName, head) {
    if (victim.dead || this.match.over || this.isProtected(victim)) return;
    victim.hp -= amount;
    const shooter = attacker.isUndead ? null : attacker;
    if (shooter && !shooter.bot) this.send(shooter, { t: 'hit', head, kill: victim.hp <= 0 });
    if (!victim.isUndead) this.send(victim, { t: 'hurt', from: [attacker.x, attacker.z], amount });
    if (victim.hp > 0) return;
    if (victim.isUndead) {
      this.undead.delete(victim.id);
      this.broadcast({ t: 'undeadDie', id: victim.id });
      if (this.mode === 'horde' && shooter) shooter.kills++;
      return;
    }
    const killer = attacker.isUndead ? this.ents.get(attacker.owner) : attacker;
    victim.hp = 0;
    victim.dead = true;
    victim.deaths++;
    victim.respawnAt = this.mode === 'horde' ? Infinity : this.clock + RESPAWN_TIME;
    this.removeUndeadOf(victim.id);
    const kName = killer ? killer.name : 'Undead';
    this.send(victim, { t: 'died', by: kName, in: this.mode === 'horde' ? -1 : RESPAWN_TIME });
    this.broadcast({ t: 'kill', killer: kName, kt: killer ? killer.team : 1, victim: victim.name, vt: victim.team, w: wName, head });
    if (this.mode === 'infection' && victim.team === 0 && (!killer || killer.team === 1 || attacker.isUndead)) {
      victim.team = 1;
      this.broadcast({ t: 'info', text: `${victim.name} got infected!` });
    }
    if (!killer || killer === victim) { this.checkWin(null); return; }
    killer.kills++;
    if (this.mode === 'tdm') this.match.teamScore[killer.team]++;
    if (this.mode === 'oneshot') {
      if (killer.bot) killer.ammo++; else this.send(killer, { t: 'ammo', w: 'revolver', add: 1 });
    }
    if (this.mode === 'gungame' && !attacker.isUndead) {
      killer.levelKills = (killer.levelKills || 0) + 1;
      if (killer.levelKills >= GUNGAME_KILLS_PER_LEVEL) {
        killer.levelKills = 0;
        killer.gunLevel++;
        if (killer.gunLevel < GUNGAME_ORDER.length) {
          killer.weapon = GUNGAME_ORDER[killer.gunLevel];
          if (killer.bot) killer.ammo = WEAPONS[killer.weapon].mag;
          this.send(killer, { t: 'weapons', weapons: this.loadout(killer) });
        }
      }
    }
    this.checkWin(killer);
  }

  handleShot(p, msg) {
    if (!p.joined || p.dead || this.match.over) return;
    const wName = this.currentWeapon(p);
    const w = WEAPONS[wName];
    if (msg.weapon !== wName) return;
    if (this.clock - p.lastShot < w.fireDelay * 0.75) return;
    p.lastShot = this.clock;
    if (Array.isArray(msg.ends)) this.broadcastExcept(p, { t: 'shot', id: p.id, w: wName, ends: msg.ends.slice(0, 9) });
    if (!Array.isArray(msg.hits)) return;
    const byTarget = new Map();
    for (const h of msg.hits.slice(0, w.pellets)) {
      const target = this.ents.get(h.id) || this.undead.get(h.id);
      if (!target || target.dead || (!target.isUndead && !target.joined) || !this.isEnemy(p, target)) continue;
      const eye = eyeOf(p);
      const d = Math.hypot(eye[0] - target.x, eye[1] - target.y - 1, eye[2] - target.z);
      if (d > w.range + 4) continue;
      if (this.lineBlocked(eye, chestOf(target)) && this.lineBlocked(eye, [target.x, target.y + 1.6, target.z])) continue;
      const prev = byTarget.get(target) || { dmg: 0, head: false };
      prev.dmg += this.damageAt(w, d, !!h.head);
      prev.head = prev.head || !!h.head;
      byTarget.set(target, prev);
    }
    for (const [target, { dmg, head }] of byTarget) this.applyDamage(p, target, Math.round(dmg), wName, head);
  }

  // ----- match flow -----
  startMatch() {
    const time = this.modeInfo.time || MATCH_TIME;
    Object.assign(this.match, { over: false, endsAt: this.clock + time, teamScore: [0, 0], winner: '', wave: 0, waveState: 'wait', waveAt: this.clock + 6, infectAt: this.clock + 8, infectDone: false, hillTeam: -1 });
    this.undead.clear();
    const list = this.fighters().sort(() => Math.random() - 0.5).sort((a, b) => a.bot - b.bot);
    list.forEach((e, i) => { e.team = this.mode === 'infection' || this.mode === 'horde' ? 0 : i % 2; });
    for (const e of list) {
      Object.assign(e, { kills: 0, deaths: 0, gunLevel: 0, levelKills: 0, abilityReady: 0 });
      this.spawn(e);
    }
    this.broadcast({ t: 'match', mode: this.mode });
  }
  endMatch(winner) {
    if (this.match.over) return;
    Object.assign(this.match, { over: true, winner, nextAt: this.clock + INTERMISSION });
    this.broadcast({ t: 'matchEnd', winner });
  }
  checkWin(k) {
    const m = this.match;
    if (m.over) return;
    switch (this.mode) {
      case 'tdm': if (k && m.teamScore[k.team] >= MODES.tdm.limit) this.endMatch(k.team === 0 ? 'Red team' : 'Blue team'); break;
      case 'gungame': if (k && k.gunLevel >= GUNGAME_ORDER.length) this.endMatch(k.name); break;
      case 'infection': {
        const survivors = this.fighters().filter(e => e.team === 0);
        if (m.infectDone && !survivors.length) this.endMatch('The Infected');
        break;
      }
      case 'horde': {
        const alive = this.fighters().filter(e => !e.dead);
        if (!alive.length) this.endMatch(`The Undead (you reached wave ${m.wave})`);
        break;
      }
      case 'koth': break;
      default: if (k && MODES[this.mode].limit && k.kills >= MODES[this.mode].limit) this.endMatch(k.name);
    }
  }
  timeUpWinner() {
    const m = this.match;
    if (this.mode === 'infection') return 'The Survivors';
    if (this.mode === 'horde') return `The Undead (you reached wave ${m.wave})`;
    if (this.teamMode) {
      const [r, b] = m.teamScore.map(Math.floor);
      return r === b ? 'Draw' : r > b ? 'Red team' : 'Blue team';
    }
    const list = this.fighters();
    if (!list.length) return 'Nobody';
    const key = this.mode === 'gungame' ? e => e.gunLevel * 100 + (e.levelKills || 0) : e => e.kills;
    return list.sort((a, b) => key(b) - key(a))[0].name;
  }

  modeTick(dt) {
    const m = this.match, C = this.clock;
    if (this.mode === 'koth') {
      const [hx, hz, hr] = this.map.hill;
      const inside = [0, 0];
      for (const e of this.ents.values()) if (e.joined && !e.dead && Math.hypot(e.x - hx, e.z - hz) < hr && e.y < 3) inside[e.team]++;
      m.hillTeam = inside[0] && !inside[1] ? 0 : inside[1] && !inside[0] ? 1 : inside[0] ? 2 : -1;
      if (m.hillTeam === 0 || m.hillTeam === 1) {
        m.teamScore[m.hillTeam] += dt;
        if (m.teamScore[m.hillTeam] >= MODES.koth.limit) this.endMatch(m.hillTeam === 0 ? 'Red team' : 'Blue team');
      }
    }
    if (this.mode === 'infection' && !m.infectDone && C >= m.infectAt) {
      m.infectDone = true;
      const list = this.fighters();
      if (list.length) {
        const first = pick(list);
        first.team = 1;
        this.removeUndeadOf(first.id);
        this.broadcast({ t: 'info', text: `☣ ${first.name} is the first infected! RUN!` });
        this.spawn(first);
      }
    }
    if (this.mode === 'horde') {
      if (m.waveState === 'wait' && C >= m.waveAt) {
        m.wave++;
        m.waveState = 'fight';
        const count = 4 + m.wave * 3;
        const spots = [...this.nav.spawns.ffa].sort(() => Math.random() - 0.5);
        const fighters = this.fighters().filter(e => !e.dead);
        spots.sort((a, b) => {
          const da = Math.min(...fighters.map(f => Math.hypot(f.x - a[0], f.z - a[2])), 999);
          const db = Math.min(...fighters.map(f => Math.hypot(f.x - b[0], f.z - b[2])), 999);
          return db - da;
        });
        for (let i = 0; i < count; i++) {
          const s = spots[i % Math.max(1, Math.floor(spots.length / 2))];
          this.makeUndead(-1, 1, s[0] + rand(-0.5, 0.5), 0.05, s[2] + rand(-0.5, 0.5), 150 + m.wave * 30, 40 + m.wave * 4);
        }
        this.broadcast({ t: 'wave', wave: m.wave, count });
      } else if (m.waveState === 'fight' && ![...this.undead.values()].some(z => z.owner === -1)) {
        if (m.wave >= HORDE_WAVES) { this.endMatch('Everyone! You survived all 10 waves!'); return; }
        m.waveState = 'wait';
        m.waveAt = C + 8;
        for (const e of this.fighters()) { if (e.dead) this.spawn(e); else e.hp = this.maxHp(e); }
        this.broadcast({ t: 'waveClear', wave: m.wave });
      }
    }
  }

  // ----- networking -----
  send(e, msg) { if (e.ws && e.ws.readyState === 1) e.ws.send(JSON.stringify(msg)); }
  broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const e of this.ents.values()) if (e.ws && e.ws.readyState === 1) e.ws.send(data);
  }
  broadcastExcept(ex, msg) {
    const data = JSON.stringify(msg);
    for (const e of this.ents.values()) if (e !== ex && e.ws && e.ws.readyState === 1) e.ws.send(data);
  }
  snapshot() {
    const m = this.match, C = this.clock;
    return JSON.stringify({
      t: 'state', mode: this.mode, map: this.mapId,
      timeLeft: m.over ? 0 : Math.max(0, Math.round(m.endsAt - C)),
      over: m.over, nextIn: m.over ? Math.max(0, Math.ceil(m.nextAt - C)) : 0, winner: m.winner,
      teamScore: m.teamScore.map(Math.floor), hillTeam: m.hillTeam,
      wave: m.wave, waveIn: this.mode === 'horde' && m.waveState === 'wait' ? Math.max(0, Math.ceil(m.waveAt - C)) : 0,
      horde: this.mode === 'horde' ? [...this.undead.values()].filter(z => z.owner === -1).length : 0,
      players: this.fighters().map(e => ({
        id: e.id, name: e.name, team: e.team, bot: e.bot ? 1 : 0, col: e.set.color, set: e.set.name,
        x: r2(e.x), y: r2(e.y), z: r2(e.z), yaw: r2(e.yaw), pitch: r2(e.pitch),
        c: e.crouch ? 1 : 0, s: e.slide ? 1 : 0, j: (e.bot ? !e.onGround : e.air) ? 1 : 0,
        hp: Math.max(0, Math.round(e.hp)), mhp: this.maxHp(e), sp: this.isProtected(e) ? 1 : 0, dead: e.dead,
        k: e.kills, d: e.deaths, w: this.currentWeapon(e), lvl: e.gunLevel,
        inf: this.infected(e) ? 1 : 0, cd: Math.max(0, Math.ceil(e.abilityReady - C)),
      })),
      undead: [...this.undead.values()].map(z => ({
        id: z.id, o: z.owner, team: z.team, x: r2(z.x), y: r2(z.y), z: r2(z.z), yaw: r2(z.yaw),
        rise: Math.min(1, r2((C - z.rise) / 0.8)),
      })),
    });
  }

  // ----- player join / leave -----
  join(p, msg) {
    p.name = cleanName(msg.name);
    p.set = cleanSet(msg.set);
    p.team = this.balanceTeam();
    p.joined = true;
    this.send(p, { t: 'welcome', id: p.id, mode: this.mode, map: this.mapId });
    if (this.mode === 'horde' && this.match.waveState === 'fight') {
      p.dead = true; p.respawnAt = Infinity;
      this.send(p, { t: 'died', by: 'waiting for the next wave', in: -1 });
    } else this.spawn(p);
    this.fillBots();
    this.broadcast({ t: 'info', text: `${p.name} joined` });
  }
  leave(p) {
    this.ents.delete(p.id);
    this.removeUndeadOf(p.id);
    if (p.joined) { this.broadcast({ t: 'info', text: `${p.name} left` }); this.fillBots(); }
    this.checkWin(null);
  }

  tick(dt) {
    this.clock += dt;
    const C = this.clock, m = this.match;
    const humans = this.humans.length > 0;
    if (!humans) {
      if (!this.emptySince) this.emptySince = C;
      return C - this.emptySince < ROOM_IDLE_CLOSE;   // false = close this room
    }
    this.emptySince = 0;
    if (m.over) {
      if (C >= m.nextAt) this.startMatch();
    } else if (C >= m.endsAt) {
      this.endMatch(this.timeUpWinner());
    } else {
      for (const e of this.ents.values()) {
        if (!e.joined) continue;
        if (e.dead) { if (C >= e.respawnAt) this.spawn(e); continue; }
        if (e.bot) this.botThink(e, dt);
      }
      for (const z of this.undead.values()) {
        if (C >= z.dieAt || (z.owner !== -1 && !this.ents.has(z.owner))) { this.undead.delete(z.id); this.broadcast({ t: 'undeadDie', id: z.id }); continue; }
        this.undeadThink(z, dt);
      }
      this.modeTick(dt);
      if (this.mode === 'infection' || this.mode === 'horde') this.checkWin(null);
    }
    if (++this.tickCount % SEND_EVERY === 0) {
      const data = this.snapshot();
      for (const e of this.ents.values()) if (e.ws && e.ws.readyState === 1) e.ws.send(data);
    }
    return true;
  }
}

function getRoom(mode, map) {
  if (!MODES[mode]) mode = 'ffa';
  if (!MAPS[map]) map = 'yard';
  const key = `${mode}:${map}`;
  if (!rooms.has(key)) rooms.set(key, new Room(mode, map));
  return rooms.get(key);
}

// ---------- saved gun sets (searchable by everyone) ----------
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const SETS_FILE = path.join(DATA_DIR, 'sets.json');
let savedSets = [];
try { savedSets = JSON.parse(fs.readFileSync(SETS_FILE, 'utf8')); } catch { savedSets = []; }
let saveTimer = null;
function saveSetsSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(SETS_FILE, JSON.stringify(savedSets)); } catch (e) { console.error('save sets', e.message); }
  }, 1000);
}
const postLog = new Map();   // ip -> [timestamps]
function rateOk(ip) {
  const now = Date.now();
  const list = (postLog.get(ip) || []).filter(t => now - t < 60000);
  if (list.length >= 15) return false;
  list.push(now);
  postLog.set(ip, list);
  return true;
}

// ---------- HTTP ----------
const vendorDir = path.join(__dirname, 'node_modules', 'three', 'build');
const addonsDir = path.join(__dirname, 'node_modules', 'three', 'examples', 'jsm');
const publicDir = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.bin': 'application/octet-stream' };
function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
  res.end(JSON.stringify(data));
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const urlPath = decodeURIComponent(url.pathname);

  if (urlPath === '/api/rooms') {
    return json(res, 200, [...rooms.values()].map(r => ({ mode: r.mode, map: r.mapId, humans: r.humans.length })).filter(r => r.humans > 0));
  }
  if (urlPath === '/api/models') {
    let files = [];
    try { files = fs.readdirSync(path.join(publicDir, 'models', 'guns')).filter(f => /\.(glb|gltf)$/i.test(f)); } catch {}
    return json(res, 200, files);
  }
  if (urlPath === '/api/sets' && req.method === 'GET') {
    const q = (url.searchParams.get('q') || '').toLowerCase().trim();
    const hits = savedSets.filter(s => !q || s.name.toLowerCase().includes(q) || s.author.toLowerCase().includes(q) ||
      WEAPONS[s.primary].name.toLowerCase().includes(q) || WEAPONS[s.secondary].name.toLowerCase().includes(q));
    return json(res, 200, hits.slice(-60).reverse());
  }
  if (urlPath === '/api/sets' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 2000) req.destroy(); });
    req.on('end', () => {
      if (!rateOk(req.socket.remoteAddress)) return json(res, 429, { error: 'Too many sets, wait a minute.' });
      let data;
      try { data = JSON.parse(body); } catch { return json(res, 400, { error: 'bad data' }); }
      const set = cleanSet(data.set);
      set.author = cleanName(data.author);
      set.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      savedSets.push(set);
      if (savedSets.length > 5000) savedSets.shift();
      saveSetsSoon();
      json(res, 200, set);
    });
    return;
  }

  let base = publicDir, rel = urlPath === '/' ? 'index.html' : urlPath;
  if (urlPath.startsWith('/vendor/addons/')) { base = addonsDir; rel = urlPath.slice('/vendor/addons/'.length); }
  else if (urlPath.startsWith('/vendor/')) { base = vendorDir; rel = urlPath.slice('/vendor/'.length); }
  const file = path.normalize(path.join(base, rel));
  if (!file.startsWith(base)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ---------- WebSocket ----------
const wss = new WebSocketServer({ server });
wss.on('connection', ws => {
  let room = null, p = null;
  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.t === 'join') {
      if (room && p) room.leave(p);
      room = getRoom(msg.mode, msg.map);
      p = room.newEntity(false, ws);
      room.join(p, msg);
      return;
    }
    if (!room || !p || !p.joined) return;
    switch (msg.t) {
      case 'rename': {
        const old = p.name;
        p.name = cleanName(msg.name);
        if (old !== p.name) room.broadcast({ t: 'info', text: `${old} is now ${p.name}` });
        break;
      }
      case 'set': p.nextSet = cleanSet(msg.set); break;
      case 'pos':
        if (p.dead || msg.seq !== p.spawnSeq) return;
        if ([msg.x, msg.y, msg.z, msg.yaw, msg.pitch].every(Number.isFinite)) {
          if (Math.hypot(msg.x - p.x, msg.z - p.z) < 8) {
            p.vx = (msg.x - p.x) * 20; p.vz = (msg.z - p.z) * 20;
            p.x = msg.x; p.y = msg.y; p.z = msg.z;
          }
          p.yaw = msg.yaw; p.pitch = msg.pitch;
          p.crouch = !!msg.c; p.slide = !!msg.s; p.air = !!msg.a;
        }
        break;
      case 'weapon': if (room.loadout(p).includes(msg.weapon)) p.weapon = msg.weapon; break;
      case 'shoot': room.handleShot(p, msg); break;
      case 'ability': room.useAbility(p); break;
    }
  });
  ws.on('close', () => { if (room && p) room.leave(p); });
});

let last = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  for (const [key, room] of rooms) if (!room.tick(dt)) rooms.delete(key);
}, 1000 / TICK);

server.listen(PORT, () => console.log(`G-ns server running on http://localhost:${PORT}`));
