// G-ns 3D game server.
// Movement runs on each player's computer (smooth feel); the server checks shots,
// owns health, kills, scores, teams and game modes, and sends everyone the world state.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { MAP, WEAPONS, GUNGAME_ORDER, GUNGAME_KILLS_PER_LEVEL, MODES } = require('./public/shared.js');

const PORT = process.env.PORT || 3000;
const SEND_RATE = 20;
const MAX_HP = 100;
const RESPAWN_TIME = 3;
const MATCH_TIME = 5 * 60;     // seconds
const INTERMISSION = 10;       // seconds between matches
const MODE_ROTATION = ['ffa', 'tdm', 'gungame'];

const players = new Map();
let nextId = 1;

const match = { mode: 'ffa', modeIndex: 0, endsAt: 0, over: false, nextAt: 0, winner: '', teamScore: [0, 0] };

// ---------- helpers ----------
const now = () => Date.now() / 1000;

function cleanName(name) {
  const s = String(name || '').replace(/[^\w \-.]/g, '').trim().slice(0, 16);
  return s || 'Player';
}

function rayBox(o, d, b, maxT) {
  // slab test, box = {x,y,z,w,h,d} with x,y,z = min corner
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
  const len = Math.hypot(...d);
  if (len < 1e-6) return false;
  const n = d.map(v => v / len);
  // small tolerance at the end so hits on players touching walls still count
  return MAP.boxes.some(box => rayBox(a, n, box, len - 0.4) < len - 0.4);
}

function enemies(p, q) {
  if (p.id === q.id) return false;
  if (match.mode === 'tdm') return p.team !== q.team;
  return true;
}

function pickSpawn(p) {
  let pool = MAP.spawns.ffa;
  if (match.mode === 'tdm') pool = MAP.spawns.team[p.team];
  let best = pool[0], bestScore = -Infinity;
  for (const s of pool) {
    let nearest = 999;
    for (const q of players.values()) {
      if (q.dead || !q.joined || !enemies(p, q)) continue;
      nearest = Math.min(nearest, Math.hypot(q.x - s[0], q.z - s[2]));
    }
    const score = nearest + Math.random() * 6;
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best;
}

function currentWeapon(p) {
  if (match.mode === 'gungame') {
    return GUNGAME_ORDER[Math.min(p.gunLevel, GUNGAME_ORDER.length - 1)];
  }
  return p.weapon;
}

function spawn(p) {
  const s = pickSpawn(p);
  p.x = s[0]; p.y = s[1]; p.z = s[2];
  p.yaw = s[3] || 0; p.pitch = 0;
  p.hp = MAX_HP;
  p.dead = false;
  p.spawnSeq++;
  send(p, { t: 'spawn', seq: p.spawnSeq, x: p.x, y: p.y, z: p.z, yaw: p.yaw, weapon: currentWeapon(p) });
}

function balanceTeam() {
  const counts = [0, 0];
  for (const q of players.values()) if (q.joined) counts[q.team]++;
  return counts[0] <= counts[1] ? 0 : 1;
}

// ---------- match flow ----------
function startMatch(mode) {
  match.mode = mode;
  match.over = false;
  match.endsAt = now() + MATCH_TIME;
  match.teamScore = [0, 0];
  match.winner = '';
  // reassign balanced teams
  const list = [...players.values()].filter(p => p.joined).sort(() => Math.random() - 0.5);
  list.forEach((p, i) => { p.team = i % 2; });
  for (const p of list) {
    p.kills = 0; p.deaths = 0; p.gunLevel = 0; p.levelKills = 0;
    spawn(p);
  }
  broadcast({ t: 'match', mode, endsAt: match.endsAt });
}

function endMatch(winner) {
  if (match.over) return;
  match.over = true;
  match.winner = winner;
  match.nextAt = now() + INTERMISSION;
  match.modeIndex = (match.modeIndex + 1) % MODE_ROTATION.length;
  broadcast({ t: 'matchEnd', winner, next: MODE_ROTATION[match.modeIndex], nextAt: match.nextAt });
}

function checkWin(killer) {
  const mode = MODES[match.mode];
  if (match.mode === 'tdm') {
    if (match.teamScore[killer.team] >= mode.scoreLimit) endMatch(killer.team === 0 ? 'Red team' : 'Blue team');
  } else if (match.mode === 'gungame') {
    if (killer.gunLevel >= GUNGAME_ORDER.length) endMatch(killer.name);
  } else if (killer.kills >= mode.scoreLimit) {
    endMatch(killer.name);
  }
}

function timeUpWinner() {
  if (match.mode === 'tdm') {
    const [r, b] = match.teamScore;
    return r === b ? 'Draw' : r > b ? 'Red team' : 'Blue team';
  }
  const list = [...players.values()].filter(p => p.joined);
  if (!list.length) return 'Nobody';
  const key = match.mode === 'gungame' ? p => p.gunLevel * 100 + p.levelKills : p => p.kills;
  list.sort((a, b) => key(b) - key(a));
  return list[0].name;
}

// ---------- combat ----------
function handleShot(p, msg) {
  if (!p.joined || p.dead || match.over) return;
  const wName = currentWeapon(p);
  const w = WEAPONS[wName];
  if (msg.weapon !== wName) return;
  const t = now();
  if (t - p.lastShot < w.fireDelay * 0.8) return;   // small tolerance for network jitter
  p.lastShot = t;

  // let others see the tracer + hear the shot
  if (Array.isArray(msg.ends)) {
    broadcastExcept(p, { t: 'shot', id: p.id, w: wName, ends: msg.ends.slice(0, 12) });
  }

  if (!Array.isArray(msg.hits)) return;
  const dmgByTarget = new Map();
  for (const h of msg.hits.slice(0, w.pellets)) {
    const target = players.get(h.id);
    if (!target || target.dead || !target.joined || !enemies(p, target)) continue;
    const eye = [p.x, p.y + (p.crouch ? 1.1 : 1.6), p.z];
    const tc = [target.x, target.y + 1.0, target.z];
    const dist = Math.hypot(eye[0] - tc[0], eye[1] - tc[1], eye[2] - tc[2]);
    if (dist > w.range + 4) continue;
    if (lineBlocked(eye, tc) && lineBlocked(eye, [target.x, target.y + 1.6, target.z])) continue;
    let dmg = w.damage;
    if (dist > w.falloffStart) {
      const k = Math.min(1, (dist - w.falloffStart) / Math.max(1, w.range - w.falloffStart));
      dmg *= 1 - k * 0.6;
    }
    if (h.head) dmg *= w.headMult;
    const prev = dmgByTarget.get(target) || { dmg: 0, head: false };
    prev.dmg += dmg; prev.head = prev.head || !!h.head;
    dmgByTarget.set(target, prev);
  }

  for (const [target, { dmg, head }] of dmgByTarget) {
    const amount = Math.round(dmg);
    target.hp -= amount;
    send(p, { t: 'hit', head, kill: target.hp <= 0 });
    send(target, { t: 'hurt', from: [p.x, p.z], amount });
    if (target.hp <= 0) kill(p, target, wName, head);
  }
}

function kill(killer, victim, wName, head) {
  victim.hp = 0;
  victim.dead = true;
  victim.deaths++;
  victim.respawnAt = now() + RESPAWN_TIME;
  killer.kills++;
  if (match.mode === 'tdm') match.teamScore[killer.team]++;
  if (match.mode === 'gungame') {
    killer.levelKills++;
    if (killer.levelKills >= GUNGAME_KILLS_PER_LEVEL) {
      killer.levelKills = 0;
      killer.gunLevel++;
      if (killer.gunLevel < GUNGAME_ORDER.length) send(killer, { t: 'weapon', weapon: currentWeapon(killer) });
    }
  }
  send(victim, { t: 'died', by: killer.name, respawnAt: victim.respawnAt });
  broadcast({ t: 'kill', killer: killer.name, kt: killer.team, victim: victim.name, vt: victim.team, w: wName, head });
  checkWin(killer);
}

// ---------- networking ----------
function send(p, msg) {
  if (p.ws.readyState === 1) p.ws.send(JSON.stringify(msg));
}
function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const p of players.values()) if (p.ws.readyState === 1) p.ws.send(data);
}
function broadcastExcept(ex, msg) {
  const data = JSON.stringify(msg);
  for (const p of players.values()) if (p !== ex && p.ws.readyState === 1) p.ws.send(data);
}

function snapshot() {
  return {
    t: 'state',
    mode: match.mode,
    timeLeft: match.over ? 0 : Math.max(0, Math.round(match.endsAt - now())),
    over: match.over,
    nextIn: match.over ? Math.max(0, Math.ceil(match.nextAt - now())) : 0,
    winner: match.winner,
    teamScore: match.teamScore,
    players: [...players.values()].filter(p => p.joined).map(p => ({
      id: p.id, name: p.name, team: p.team,
      x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2),
      yaw: +p.yaw.toFixed(3), pitch: +p.pitch.toFixed(3),
      c: p.crouch ? 1 : 0, s: p.slide ? 1 : 0,
      hp: p.hp, dead: p.dead, k: p.kills, d: p.deaths,
      w: currentWeapon(p), lvl: p.gunLevel,
    })),
  };
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
  const id = nextId++;
  const p = {
    id, ws, name: 'Player', team: 0, joined: false,
    x: 0, y: 0, z: 0, yaw: 0, pitch: 0, crouch: false, slide: false,
    hp: MAX_HP, dead: true, respawnAt: 0, spawnSeq: 0,
    kills: 0, deaths: 0, lastShot: 0, weapon: 'rifle', gunLevel: 0, levelKills: 0,
  };
  players.set(id, p);

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    switch (msg.t) {
      case 'join':
        if (p.joined) return;
        p.name = cleanName(msg.name);
        p.team = balanceTeam();
        p.joined = true;
        send(p, { t: 'welcome', id, maxHp: MAX_HP, mode: match.mode, endsAt: match.endsAt });
        spawn(p);
        broadcast({ t: 'info', text: `${p.name} joined` });
        break;
      case 'rename': {
        if (!p.joined) return;
        const old = p.name;
        p.name = cleanName(msg.name);
        if (old !== p.name) broadcast({ t: 'info', text: `${old} is now ${p.name}` });
        break;
      }
      case 'pos':
        if (!p.joined || p.dead) return;
        if (msg.seq !== p.spawnSeq) return; // ignore positions from before a respawn
        if ([msg.x, msg.y, msg.z, msg.yaw, msg.pitch].every(Number.isFinite)) {
          // light sanity check against teleport hacks
          if (Math.hypot(msg.x - p.x, msg.z - p.z) < 6) {
            p.x = msg.x; p.y = msg.y; p.z = msg.z;
          }
          p.yaw = msg.yaw; p.pitch = msg.pitch;
          p.crouch = !!msg.c; p.slide = !!msg.s;
        }
        break;
      case 'weapon':
        if (WEAPONS[msg.weapon] && match.mode !== 'gungame') p.weapon = msg.weapon;
        break;
      case 'shoot':
        handleShot(p, msg);
        break;
    }
  });

  ws.on('close', () => {
    players.delete(id);
    if (p.joined) broadcast({ t: 'info', text: `${p.name} left` });
  });
});

setInterval(() => {
  const t = now();
  if (match.over) {
    if (t >= match.nextAt) startMatch(MODE_ROTATION[match.modeIndex]);
  } else if (t >= match.endsAt) {
    endMatch(timeUpWinner());
  }
  for (const p of players.values()) {
    if (p.joined && p.dead && !match.over && t >= p.respawnAt) spawn(p);
  }
  broadcast(snapshot());
}, 1000 / SEND_RATE);

startMatch('ffa');
server.listen(PORT, () => console.log(`G-ns server running on http://localhost:${PORT}`));
