// Gun and hit sounds made with the Web Audio API (no sound files needed).
let ctx = null;
let noiseBuf = null;
let master = 0.8;
export function setVolume(v) { master = v; }

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ctx = null; }
}

const PROFILES = {
  rifle:   { freq: 1400, dur: 0.12, vol: 0.5, boom: 90 },
  lmg:     { freq: 1200, dur: 0.14, vol: 0.55, boom: 80 },
  dmr:     { freq: 1000, dur: 0.25, vol: 0.7, boom: 70 },
  revolver:{ freq: 900,  dur: 0.3,  vol: 0.75, boom: 75 },
  smg:     { freq: 1900, dur: 0.08, vol: 0.4, boom: 120 },
  shotgun: { freq: 800,  dur: 0.3,  vol: 0.8, boom: 60 },
  pistol:  { freq: 2200, dur: 0.1,  vol: 0.45, boom: 140 },
  sniper:  { freq: 700,  dur: 0.5,  vol: 0.9, boom: 50 },
};

export function playShot(weapon, volume = 1) {
  if (!ctx || volume <= 0.01) return;
  const p = PROFILES[weapon] || PROFILES.rifle;
  const t = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = p.vol * volume * 0.6 * master;
  out.connect(ctx.destination);

  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(p.freq * 2, t);
  filt.frequency.exponentialRampToValueAtTime(200, t + p.dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + p.dur);
  src.connect(filt).connect(g).connect(out);
  src.start(t);
  src.stop(t + p.dur + 0.05);

  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(p.boom * 2, t);
  osc.frequency.exponentialRampToValueAtTime(p.boom * 0.5, t + p.dur);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.8, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + p.dur);
  osc.connect(og).connect(out);
  osc.start(t);
  osc.stop(t + p.dur + 0.05);
}

function beep(freq, dur, vol, type = 'square') {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol * master, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur);
}

export const playHit = head => beep(head ? 1600 : 1100, 0.06, 0.12);
export const playKill = () => { beep(900, 0.08, 0.15); setTimeout(() => beep(1400, 0.12, 0.15), 70); };
export const playHurt = () => beep(160, 0.15, 0.2, 'sawtooth');
export const playReload = () => { beep(500, 0.04, 0.08); setTimeout(() => beep(700, 0.04, 0.08), 250); };
export const playEmpty = () => beep(300, 0.03, 0.08);

export function playStep(volume = 1) {
  if (!ctx || master <= 0) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 420 + Math.random() * 200;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.18 * volume * master, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t, Math.random() * 0.5);
  src.stop(t + 0.1);
}
export const playDash = () => { beep(300, 0.12, 0.12, 'sawtooth'); setTimeout(() => beep(600, 0.1, 0.08, 'sawtooth'), 40); };
export const playHeal = () => { beep(600, 0.1, 0.1, 'sine'); setTimeout(() => beep(900, 0.15, 0.1, 'sine'), 90); };
export const playWave = () => { beep(220, 0.3, 0.15, 'sawtooth'); setTimeout(() => beep(165, 0.5, 0.15, 'sawtooth'), 250); };
