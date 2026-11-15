// G-ns browser client
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreboardEl = document.getElementById('scoreboard');
const feedEl = document.getElementById('feed');
const statusEl = document.getElementById('status');

let ws = null;
let myId = null;
let map = null;
let radius = 18;
let maxHp = 100;
let serverPlayers = [];
let serverBullets = [];
const display = new Map();   // id -> smoothed {x, y}

const keys = { up: false, down: false, left: false, right: false };
let mouse = { x: 0, y: 0, down: false };
let camera = { x: 0, y: 0 };

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ---- Join ----
document.getElementById('name').value = (() => {
  try { return localStorage.getItem('gns-name') || ''; } catch { return ''; }
})();

document.getElementById('joinForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  try { localStorage.setItem('gns-name', name); } catch {}
  document.getElementById('join').style.display = 'none';
  connect(name);
});

function connect(name) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  statusEl.textContent = 'Connecting…';
  ws.onopen = () => {
    statusEl.textContent = '';
    ws.send(JSON.stringify({ t: 'join', name }));
  };
  ws.onclose = () => { statusEl.textContent = 'Disconnected. Refresh to rejoin.'; };
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.t === 'welcome') {
      myId = msg.id; map = msg.map; radius = msg.radius; maxHp = msg.maxHp;
    } else if (msg.t === 'state') {
      serverPlayers = msg.players;
      serverBullets = msg.bullets;
      renderScoreboard();
    } else if (msg.t === 'kill') {
      addFeed(`<b>${esc(msg.killer)}</b> ✖ ${esc(msg.victim)}`);
    } else if (msg.t === 'info') {
      addFeed(esc(msg.text));
    }
  };
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function addFeed(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  feedEl.prepend(d);
  while (feedEl.children.length > 5) feedEl.lastChild.remove();
  setTimeout(() => d.remove(), 5000);
}

function renderScoreboard() {
  const sorted = [...serverPlayers].sort((a, b) => b.score - a.score || a.deaths - b.deaths);
  scoreboardEl.innerHTML = '<div><b>Player</b><b>K / D</b></div>' + sorted.map(p =>
    `<div class="${p.id === myId ? 'me' : ''}"><span style="color:${p.color}">${esc(p.name)}</span><span>${p.score} / ${p.deaths}</span></div>`
  ).join('');
}

// ---- Input ----
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
};
const typing = e => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
window.addEventListener('keydown', e => {
  if (typing(e) || !KEYMAP[e.code]) return;
  keys[KEYMAP[e.code]] = true;
  e.preventDefault();
});
window.addEventListener('keyup', e => { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false; });
canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', e => { if (e.button === 0) mouse.down = true; });
window.addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; });
window.addEventListener('blur', () => { Object.keys(keys).forEach(k => keys[k] = false); mouse.down = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

function me() { return serverPlayers.find(p => p.id === myId); }

function aimAngle() {
  const m = me();
  if (!m) return 0;
  const d = display.get(m.id) || m;
  return Math.atan2(mouse.y - (d.y - camera.y), mouse.x - (d.x - camera.x));
}

setInterval(() => {
  if (!ws || ws.readyState !== 1 || myId == null) return;
  ws.send(JSON.stringify({ t: 'input', ...keys, shoot: mouse.down, angle: aimAngle() }));
}, 1000 / 30);

// ---- Rendering ----
let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;

  // smooth positions toward the latest server state
  const seen = new Set();
  for (const p of serverPlayers) {
    seen.add(p.id);
    const d = display.get(p.id);
    if (!d || Math.hypot(d.x - p.x, d.y - p.y) > 200) display.set(p.id, { x: p.x, y: p.y });
    else {
      const k = Math.min(1, dt * 18);
      d.x += (p.x - d.x) * k;
      d.y += (p.y - d.y) * k;
    }
  }
  for (const id of display.keys()) if (!seen.has(id)) display.delete(id);

  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function draw() {
  ctx.fillStyle = '#0d0e11';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!map) return;

  const m = me();
  if (m) {
    const d = display.get(m.id) || m;
    camera.x = d.x - canvas.width / 2;
    camera.y = d.y - canvas.height / 2;
  }

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  // floor + grid
  ctx.fillStyle = '#1a1c22';
  ctx.fillRect(0, 0, map.width, map.height);
  ctx.strokeStyle = '#22252d';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= map.width; x += 50) { ctx.moveTo(x, 0); ctx.lineTo(x, map.height); }
  for (let y = 0; y <= map.height; y += 50) { ctx.moveTo(0, y); ctx.lineTo(map.width, y); }
  ctx.stroke();

  // walls
  for (const w of map.walls) {
    ctx.fillStyle = '#3a3f4b';
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeStyle = '#525866';
    ctx.strokeRect(w.x + .5, w.y + .5, w.w - 1, w.h - 1);
  }

  // bullets
  ctx.fillStyle = '#ffe680';
  for (const b of serverBullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // players
  for (const p of serverPlayers) {
    if (p.dead) continue;
    const d = display.get(p.id) || p;
    const a = p.id === myId ? aimAngle() : p.a;

    // gun
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(a);
    ctx.fillStyle = '#ccc';
    ctx.fillRect(radius - 4, -4, 18, 8);
    ctx.restore();

    // body
    ctx.beginPath();
    ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.lineWidth = p.id === myId ? 3 : 2;
    ctx.strokeStyle = p.id === myId ? '#fff' : '#000';
    ctx.stroke();

    // name + hp bar
    ctx.fillStyle = '#fff';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, d.x, d.y - radius - 14);
    ctx.fillStyle = '#400';
    ctx.fillRect(d.x - 20, d.y - radius - 10, 40, 5);
    ctx.fillStyle = p.hp > 40 ? '#3c3' : '#e33';
    ctx.fillRect(d.x - 20, d.y - radius - 10, 40 * (p.hp / maxHp), 5);
  }

  ctx.restore();

  // death overlay
  if (m && m.dead) {
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.fillText('You died', canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(`Respawning in ${Math.ceil(m.respawnIn)}…`, canvas.width / 2, canvas.height / 2 + 24);
  }

  // own HP
  if (m && !m.dead) {
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(10, canvas.height - 40, 220, 30);
    ctx.fillStyle = m.hp > 40 ? '#3c3' : '#e33';
    ctx.fillRect(15, canvas.height - 35, 210 * (m.hp / maxHp), 20);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`HP ${m.hp}`, 20, canvas.height - 20);
  }
}
