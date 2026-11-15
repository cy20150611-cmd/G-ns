// Procedural textures (drawn in code, so no image files are needed).
import * as THREE from 'three';

const cache = new Map();

function noise(ctx, size, amount, alpha = 0.08) {
  for (let i = 0; i < amount; i++) {
    const v = Math.random() < 0.5 ? 0 : 255;
    ctx.fillStyle = `rgba(${v},${v},${v},${Math.random() * alpha})`;
    const s = Math.random() * 3 + 1;
    ctx.fillRect(Math.random() * size, Math.random() * size, s, s);
  }
}

export function texture(kind, color) {
  const key = kind + color;
  if (cache.has(key)) return cache.get(key);
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);

  if (kind === 'ground') {
    noise(ctx, size, 5000, 0.12);
    for (let i = 0; i < 60; i++) { // grass tufts / dirt patches
      ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '40,60,30' : '90,80,60'},${Math.random() * 0.25})`;
      ctx.beginPath();
      ctx.arc(Math.random() * size, Math.random() * size, Math.random() * 18 + 4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 'brick') {
    noise(ctx, size, 2000, 0.1);
    ctx.strokeStyle = 'rgba(0,0,0,.25)';
    ctx.lineWidth = 3;
    const bh = 32, bw = 64;
    for (let y = 0; y < size; y += bh) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
      const off = (y / bh) % 2 ? bw / 2 : 0;
      for (let x = off; x < size + bw; x += bw) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + bh); ctx.stroke();
      }
    }
  } else if (kind === 'crate') {
    noise(ctx, size, 1500, 0.12);
    ctx.strokeStyle = 'rgba(60,35,10,.6)';
    for (let y = 0; y < size; y += 32) { ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke(); }
    ctx.lineWidth = 14; ctx.strokeRect(7, 7, size - 14, size - 14);
    ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(10, 10); ctx.lineTo(size - 10, size - 10); ctx.stroke();
  } else if (kind === 'metal') {
    for (let x = 0; x < size; x += 16) {
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x, 0, 6, size);
      ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(x + 6, 0, 3, size);
    }
    noise(ctx, size, 1500, 0.1);
  } else { // concrete
    noise(ctx, size, 6000, 0.09);
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size - 2, size - 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

export function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#3d6fb0');
  g.addColorStop(0.5, '#8fb8de');
  g.addColorStop(1, '#d9e4ea');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
