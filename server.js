// G-ns game server: serves the client and runs the authoritative simulation.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const TICK_RATE = 60;          // simulation steps per second
const SEND_RATE = 30;          // state broadcasts per second

// ---- World config ----
const MAP = {
  width: 2000,
  height: 1400,
  walls: [
    // outer border
    { x: 0, y: 0, w: 2000, h: 20 },
    { x: 0, y: 1380, w: 2000, h: 20 },
    { x: 0, y: 0, w: 20, h: 1400 },
    { x: 1980, y: 0, w: 20, h: 1400 },
    // cover
    { x: 300, y: 250, w: 220, h: 40 },
    { x: 300, y: 250, w: 40, h: 200 },
    { x: 1480, y: 250, w: 220, h: 40 },
    { x: 1660, y: 250, w: 40, h: 200 },
    { x: 300, y: 1110, w: 220, h: 40 },
    { x: 300, y: 950, w: 40, h: 200 },
    { x: 1480, y: 1110, w: 220, h: 40 },
    { x: 1660, y: 950, w: 40, h: 200 },
    { x: 900, y: 600, w: 200, h: 200 },
    { x: 700, y: 300, w: 40, h: 180 },
    { x: 1260, y: 920, w: 40, h: 180 },
    { x: 980, y: 120, w: 40, h: 260 },
    { x: 980, y: 1020, w: 40, h: 260 },
    { x: 560, y: 680, w: 180, h: 40 },
    { x: 1260, y: 680, w: 180, h: 40 },
  ],
};

const PLAYER_RADIUS = 18;
const PLAYER_SPEED = 260;       // px/s
const MAX_HP = 100;
const BULLET_SPEED = 900;
const BULLET_LIFE = 1.0;        // seconds
const BULLET_DAMAGE = 20;
const FIRE_COOLDOWN = 0.15;     // seconds
const RESPAWN_TIME = 3;         // seconds
const COLORS = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4',
  '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', '#008080', '#e6beff'];

// ---- State ----
const players = new Map();      // id -> player
let bullets = [];
let nextId = 1;
let nextBulletId = 1;

// ---- Helpers ----
function circleRectHit(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

function pointInWall(x, y) {
  return MAP.walls.some(w => x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h);
}

function collidesWall(x, y, r) {
  return MAP.walls.some(w => circleRectHit(x, y, r, w));
}

function randomSpawn() {
  for (let i = 0; i < 200; i++) {
    const x = 60 + Math.random() * (MAP.width - 120);
    const y = 60 + Math.random() * (MAP.height - 120);
    if (collidesWall(x, y, PLAYER_RADIUS + 10)) continue;
    // keep some distance from living players
    let tooClose = false;
    for (const p of players.values()) {
      if (!p.dead && Math.hypot(p.x - x, p.y - y) < 250) { tooClose = true; break; }
    }
    if (!tooClose) return { x, y };
  }
  return { x: MAP.width / 2, y: 100 };
}

function cleanName(name) {
  const s = String(name || '').replace(/[^\w \-]/g, '').trim().slice(0, 16);
  return s || 'Player';
}

function spawn(p) {
  const pos = randomSpawn();
  p.x = pos.x;
  p.y = pos.y;
  p.hp = MAX_HP;
  p.dead = false;
}

// ---- Simulation ----
function update(dt) {
  const now = Date.now() / 1000;

  for (const p of players.values()) {
    if (p.dead) {
      if (now >= p.respawnAt) spawn(p);
      continue;
    }
    const inp = p.input;
    let mx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    let my = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; }

    // move each axis separately so players slide along walls
    const nx = p.x + mx * PLAYER_SPEED * dt;
    if (!collidesWall(nx, p.y, PLAYER_RADIUS)) p.x = nx;
    const ny = p.y + my * PLAYER_SPEED * dt;
    if (!collidesWall(p.x, ny, PLAYER_RADIUS)) p.y = ny;

    p.angle = inp.angle;

    if (inp.shoot && now - p.lastShot >= FIRE_COOLDOWN) {
      p.lastShot = now;
      const spread = (Math.random() - 0.5) * 0.06;
      const a = p.angle + spread;
      const bx = p.x + Math.cos(a) * (PLAYER_RADIUS + 6);
      const by = p.y + Math.sin(a) * (PLAYER_RADIUS + 6);
      if (!pointInWall(bx, by)) {
        bullets.push({
          id: nextBulletId++, owner: p.id, x: bx, y: by,
          vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED, life: BULLET_LIFE,
        });
      }
    }
  }

  const alive = [];
  for (const b of bullets) {
    // sub-step so fast bullets don't tunnel through thin walls / players
    const steps = 3;
    let hit = false;
    for (let s = 0; s < steps && !hit; s++) {
      b.x += (b.vx * dt) / steps;
      b.y += (b.vy * dt) / steps;
      if (pointInWall(b.x, b.y)) { hit = true; break; }
      for (const p of players.values()) {
        if (p.dead || p.id === b.owner) continue;
        if (Math.hypot(p.x - b.x, p.y - b.y) < PLAYER_RADIUS) {
          hit = true;
          p.hp -= BULLET_DAMAGE;
          if (p.hp <= 0) {
            p.hp = 0;
            p.dead = true;
            p.deaths++;
            p.respawnAt = now + RESPAWN_TIME;
            const killer = players.get(b.owner);
            if (killer) killer.score++;
            broadcast({ t: 'kill', killer: killer ? killer.name : '?', victim: p.name });
          }
          break;
        }
      }
    }
    b.life -= dt;
    if (!hit && b.life > 0) alive.push(b);
  }
  bullets = alive;
}

// ---- Networking ----
function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const p of players.values()) {
    if (p.ws.readyState === 1) p.ws.send(data);
  }
}

function snapshot() {
  return {
    t: 'state',
    players: [...players.values()].filter(p => p.joined).map(p => ({
      id: p.id, name: p.name, color: p.color,
      x: Math.round(p.x), y: Math.round(p.y), a: +p.angle.toFixed(3),
      hp: p.hp, dead: p.dead, score: p.score, deaths: p.deaths,
      respawnIn: p.dead ? Math.max(0, p.respawnAt - Date.now() / 1000) : 0,
    })),
    bullets: bullets.map(b => ({ id: b.id, x: Math.round(b.x), y: Math.round(b.y) })),
  };
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  const file = path.normalize(path.join(__dirname, 'public', urlPath === '/' ? 'index.html' : urlPath));
  if (!file.startsWith(path.join(__dirname, 'public'))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
  const id = nextId++;
  const p = {
    id, ws, name: 'Player', color: COLORS[id % COLORS.length], joined: false,
    x: 0, y: 0, angle: 0, hp: MAX_HP, dead: true, respawnAt: 0,
    score: 0, deaths: 0, lastShot: 0,
    input: { up: false, down: false, left: false, right: false, angle: 0, shoot: false },
  };
  players.set(id, p);

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.t === 'join' && !p.joined) {
      p.name = cleanName(msg.name);
      p.joined = true;
      spawn(p);
      ws.send(JSON.stringify({ t: 'welcome', id, map: MAP, radius: PLAYER_RADIUS, maxHp: MAX_HP }));
      broadcast({ t: 'info', text: `${p.name} joined` });
    } else if (msg.t === 'input' && p.joined) {
      p.input = {
        up: !!msg.up, down: !!msg.down, left: !!msg.left, right: !!msg.right,
        shoot: !!msg.shoot, angle: Number.isFinite(msg.angle) ? msg.angle : p.input.angle,
      };
    }
  });

  ws.on('close', () => {
    players.delete(id);
    if (p.joined) broadcast({ t: 'info', text: `${p.name} left` });
  });
});

let last = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  update(dt);
}, 1000 / TICK_RATE);

setInterval(() => broadcast(snapshot()), 1000 / SEND_RATE);

server.listen(PORT, () => console.log(`G-ns server running on http://localhost:${PORT}`));
