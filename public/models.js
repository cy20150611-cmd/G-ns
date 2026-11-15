// 3D models: guns, first-person arms, and animated characters for players, bots, infected and undead.
// Gun models: put a .glb file named after the gun (rifle.glb, smg.glb, shotgun.glb, sniper.glb, lmg.glb,
// dmr.glb, pistol.glb, revolver.glb, knife.glb) in public/models/guns/ and it replaces the built-in one.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const mat = (color, rough = 0.7, metal = 0.1) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
const M = {
  metal: mat(0x3a3e45, 0.5, 0.25),
  metal2: mat(0x52575f, 0.55, 0.2),
  wood: mat(0x6b4526, 0.8, 0),
  tan: mat(0x8a7a5a, 0.8, 0.05),
  olive: mat(0x4f5a3a, 0.8, 0.05),
  glove: mat(0x1d1f22, 0.9, 0),
  pants: mat(0x2e3238, 0.9, 0),
  boot: mat(0x1a1714, 0.9, 0),
  vest: mat(0x3b4232, 0.9, 0),
  helmet: mat(0x3e4636, 0.7, 0.1),
  eye: mat(0x111111, 0.5, 0),
  blade: mat(0xc9ced6, 0.25, 0.9),
  lens: new THREE.MeshStandardMaterial({ color: 0x113355, roughness: 0.1, metalness: 0.8 }),
};

function box(w, h, d, material, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  if (parent) parent.add(m);
  return m;
}
function cyl(r, len, material, x, y, z, parent, r2 = r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, len, 12), material);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

// ---------- optional .glb gun models ----------
const GUN_LENGTH = { rifle: 0.85, smg: 0.6, shotgun: 0.95, sniper: 1.2, lmg: 1.0, dmr: 1.0, pistol: 0.22, revolver: 0.3, knife: 0.3 };
const templates = {};
export async function loadGunModels() {
  let files = [];
  try { files = await (await fetch('/api/models')).json(); } catch { return; }
  const loader = new GLTFLoader();
  await Promise.all(files.map(f => new Promise(res => {
    const name = f.replace(/\.(glb|gltf)$/i, '').toLowerCase();
    if (!GUN_LENGTH[name]) return res();
    loader.load(`/models/guns/${f}`, gltf => {
      const obj = gltf.scene;
      // scale the model to a realistic length and center it around the grip
      const b = new THREE.Box3().setFromObject(obj);
      const size = b.getSize(new THREE.Vector3());
      const longest = Math.max(size.x, size.y, size.z) || 1;
      const s = GUN_LENGTH[name] / longest;
      obj.scale.setScalar(s);
      // point the longest side along -z (forward)
      if (size.x === longest) obj.rotation.y = Math.PI / 2;
      else if (size.y === longest) obj.rotation.x = -Math.PI / 2;
      const b2 = new THREE.Box3().setFromObject(obj);
      const c = b2.getCenter(new THREE.Vector3());
      obj.position.sub(c);
      obj.position.z -= GUN_LENGTH[name] * 0.25;
      obj.traverse(o => { if (o.isMesh) o.castShadow = true; });
      const wrap = new THREE.Group();
      wrap.add(obj);
      templates[name] = { group: wrap, muzzleZ: -GUN_LENGTH[name] * 0.75 };
      res();
    }, undefined, () => res());
  })));
}
export const loadedModels = () => Object.keys(templates);

// Gun points toward -z. Origin is at the grip. A child named "muzzle" marks the barrel tip.
export function buildGun(type) {
  if (templates[type]) {
    const g = templates[type].group.clone(true);
    const muzzle = new THREE.Object3D();
    muzzle.name = 'muzzle';
    muzzle.position.set(0, 0.03, templates[type].muzzleZ);
    g.add(muzzle);
    return g;
  }
  const g = new THREE.Group();
  let muzzleZ = -0.6;
  switch (type) {
    case 'rifle':
      box(0.07, 0.1, 0.5, M.metal, 0, 0.02, -0.12, g);
      box(0.075, 0.07, 0.25, M.tan, 0, 0.0, -0.32, g);
      cyl(0.016, 0.22, M.metal, 0, 0.03, -0.55, g);
      box(0.05, 0.16, 0.08, M.metal2, 0, -0.1, -0.12, g).rotation.x = 0.25;
      box(0.045, 0.12, 0.06, M.metal, 0, -0.07, 0.04, g).rotation.x = -0.3;
      box(0.06, 0.09, 0.24, M.tan, 0, 0.0, 0.24, g);
      box(0.03, 0.04, 0.08, M.metal, 0, 0.09, -0.08, g);
      muzzleZ = -0.67; break;
    case 'smg':
      box(0.07, 0.1, 0.36, M.metal, 0, 0.02, -0.08, g);
      cyl(0.018, 0.14, M.metal2, 0, 0.03, -0.32, g);
      box(0.045, 0.2, 0.06, M.metal2, 0, -0.13, -0.06, g);
      box(0.045, 0.11, 0.06, M.metal, 0, -0.06, 0.06, g).rotation.x = -0.3;
      box(0.03, 0.05, 0.2, M.metal, 0, 0.0, 0.2, g);
      box(0.025, 0.035, 0.06, M.metal, 0, 0.085, -0.05, g);
      muzzleZ = -0.4; break;
    case 'shotgun':
      box(0.07, 0.09, 0.32, M.metal, 0, 0.02, -0.05, g);
      cyl(0.022, 0.55, M.metal, 0, 0.04, -0.45, g);
      cyl(0.026, 0.22, M.wood, 0, -0.02, -0.38, g);
      box(0.045, 0.11, 0.06, M.wood, 0, -0.06, 0.08, g).rotation.x = -0.35;
      box(0.065, 0.1, 0.28, M.wood, 0, -0.01, 0.26, g);
      box(0.02, 0.025, 0.03, M.metal2, 0, 0.075, -0.68, g);
      muzzleZ = -0.73; break;
    case 'lmg':
      box(0.09, 0.12, 0.55, M.metal, 0, 0.02, -0.1, g);
      cyl(0.022, 0.4, M.metal, 0, 0.03, -0.55, g);
      box(0.08, 0.1, 0.12, M.olive, 0, -0.11, -0.12, g);           // ammo box
      box(0.02, 0.1, 0.02, M.metal2, 0.02, -0.08, -0.6, g).rotation.z = 0.4;   // bipod
      box(0.02, 0.1, 0.02, M.metal2, -0.02, -0.08, -0.6, g).rotation.z = -0.4;
      box(0.045, 0.12, 0.06, M.metal, 0, -0.07, 0.06, g).rotation.x = -0.3;
      box(0.07, 0.1, 0.26, M.olive, 0, 0.0, 0.28, g);
      box(0.04, 0.05, 0.16, M.metal2, 0, 0.1, -0.12, g);
      muzzleZ = -0.76; break;
    case 'dmr':
      box(0.07, 0.09, 0.5, M.olive, 0, 0.02, -0.1, g);
      cyl(0.016, 0.4, M.metal, 0, 0.03, -0.55, g);
      cyl(0.026, 0.24, M.metal2, 0, 0.1, -0.08, g);
      box(0.045, 0.14, 0.07, M.metal2, 0, -0.1, -0.08, g);
      box(0.045, 0.12, 0.06, M.metal, 0, -0.07, 0.06, g).rotation.x = -0.3;
      box(0.065, 0.11, 0.3, M.olive, 0, -0.01, 0.28, g);
      muzzleZ = -0.76; break;
    case 'pistol':
      box(0.04, 0.06, 0.22, M.metal, 0, 0.05, -0.06, g);
      box(0.038, 0.13, 0.05, M.metal2, 0, -0.03, 0.02, g).rotation.x = -0.2;
      box(0.015, 0.02, 0.02, M.metal2, 0, 0.09, -0.15, g);
      muzzleZ = -0.18; break;
    case 'revolver':
      cyl(0.016, 0.24, M.metal2, 0, 0.06, -0.14, g);
      cyl(0.034, 0.06, M.metal, 0, 0.045, -0.02, g);
      box(0.03, 0.05, 0.1, M.metal2, 0, 0.04, 0.0, g);
      box(0.038, 0.13, 0.05, M.wood, 0, -0.04, 0.05, g).rotation.x = -0.35;
      muzzleZ = -0.27; break;
    case 'knife':
      box(0.03, 0.035, 0.1, M.metal, 0, 0, 0.0, g);
      box(0.06, 0.05, 0.015, M.metal2, 0, 0.0, -0.055, g);
      box(0.008, 0.035, 0.2, M.blade, 0, 0.005, -0.16, g).rotation.x = 0.03;
      muzzleZ = -0.27; break;
    case 'sniper':
      box(0.07, 0.09, 0.45, M.metal, 0, 0.02, -0.08, g);
      cyl(0.017, 0.65, M.metal, 0, 0.03, -0.62, g);
      cyl(0.032, 0.32, M.metal2, 0, 0.11, -0.1, g);
      cyl(0.028, 0.01, M.lens, 0, 0.11, -0.265, g);
      box(0.02, 0.04, 0.02, M.metal, 0, 0.07, -0.18, g);
      box(0.02, 0.04, 0.02, M.metal, 0, 0.07, -0.02, g);
      box(0.05, 0.08, 0.07, M.metal2, 0, -0.07, -0.1, g);
      box(0.045, 0.12, 0.06, M.wood, 0, -0.06, 0.08, g).rotation.x = -0.3;
      box(0.065, 0.11, 0.32, M.wood, 0, -0.01, 0.3, g);
      muzzleZ = -0.96; break;
    case 'claws':
      muzzleZ = -0.3; break;
  }
  const muzzle = new THREE.Object3D();
  muzzle.name = 'muzzle';
  muzzle.position.set(0, 0.03, muzzleZ);
  g.add(muzzle);
  return g;
}
export const SIGHT_HEIGHT = { rifle: 0.11, smg: 0.1, shotgun: 0.085, pistol: 0.1, sniper: 0.11, knife: 0.05, lmg: 0.13, dmr: 0.1, revolver: 0.09, claws: 0.05 };
const ALL_GUNS = ['rifle', 'smg', 'shotgun', 'sniper', 'lmg', 'dmr', 'pistol', 'revolver', 'knife', 'claws'];

// ---------- first-person view: arms + gun ----------
export class ViewModel {
  constructor(sleeveColor) {
    this.root = new THREE.Group();
    this.holder = new THREE.Group();
    this.root.add(this.holder);
    this.sleeve = mat(sleeveColor, 0.9, 0);
    this.guns = {};
    for (const t of ALL_GUNS) {
      const gun = buildGun(t);
      gun.traverse(o => { o.castShadow = false; });
      gun.visible = false;
      this.holder.add(gun);
      this.guns[t] = gun;
    }
    this.rArm = new THREE.Group();
    box(0.09, 0.09, 0.45, this.sleeve, 0.04, -0.06, 0.28, this.rArm);
    this.rHand = box(0.07, 0.08, 0.1, M.glove, 0, -0.05, 0.03, this.rArm);
    this.holder.add(this.rArm);
    this.lArm = new THREE.Group();
    box(0.09, 0.09, 0.5, this.sleeve, -0.12, -0.1, 0.12, this.lArm).rotation.y = -0.45;
    this.lHand = box(0.07, 0.07, 0.1, M.glove, 0, -0.04, -0.12, this.lArm);
    this.holder.add(this.lArm);
    // infected claws: two green hands
    this.claws = new THREE.Group();
    const skin = mat(0x7d9a5c, 0.95, 0);
    for (const s of [-1, 1]) {
      const a = new THREE.Group();
      box(0.09, 0.09, 0.5, skin, 0, 0, 0.2, a);
      for (let f = -1; f <= 1; f++) box(0.015, 0.015, 0.09, M.eye, f * 0.025, -0.02, -0.08, a);
      a.position.set(s * 0.12, -0.02, -0.05);
      a.rotation.y = -s * 0.15;
      this.claws.add(a);
    }
    this.claws.visible = false;
    this.holder.add(this.claws);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.flash = new THREE.Group();
    const p1 = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), flashMat);
    const p2 = p1.clone(); p2.rotation.y = Math.PI / 2;
    const p3 = p1.clone(); p3.rotation.x = Math.PI / 2;
    this.flash.add(p1, p2, p3);
    this.flash.visible = false;
    this.holder.add(this.flash);
    this.current = null;
    this.setWeapon('rifle');
  }
  setSleeve(color) { this.sleeve.color.set(color); }
  setWeapon(t) {
    if (this.current) this.guns[this.current].visible = false;
    this.current = t;
    this.guns[t].visible = true;
    const claws = t === 'claws';
    this.claws.visible = claws;
    this.rArm.visible = !claws;
    const pistol = t === 'pistol' || t === 'revolver';
    const front = { rifle: -0.32, smg: -0.25, shotgun: -0.38, pistol: 0.02, revolver: 0.02, sniper: -0.3, lmg: -0.38, dmr: -0.34, knife: 0, claws: 0 }[t];
    this.lArm.visible = t !== 'knife' && !claws;
    this.lArm.position.set(pistol ? -0.01 : 0, pistol ? -0.04 : -0.02, front);
    this.lArm.rotation.set(0, pistol ? 0.2 : 0, 0);
    this.flash.position.copy(this.guns[t].getObjectByName('muzzle').position);
  }
}

// ---------- third-person characters ----------
const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0xa1665e];
const UNDEAD = { skin: mat(0x7d9a5c, 0.95, 0), rags: mat(0x3a3530, 1, 0), eye: new THREE.MeshBasicMaterial({ color: 0x9dff4a }) };

function nameSprite(text, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,.8)';
  ctx.strokeText(text, 128, 32);
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(1.4, 0.35, 1);
  return s;
}

export class Avatar {
  // kind: 'soldier' | 'undead' (summoned / horde) | 'infected' (a player who got infected)
  constructor(id, kind = 'soldier') {
    this.id = id;
    this.kind = kind;
    const zombie = kind !== 'soldier';
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.shirt = zombie ? mat(0x3a3530, 1, 0) : mat(0x888888, 0.9, 0);
    const skin = zombie ? UNDEAD.skin : mat(SKIN[id % SKIN.length], 0.8, 0);

    this.hips = new THREE.Group();
    this.hips.position.y = 0.95;
    this.body.add(this.hips);
    const leg = side => {
      const thigh = new THREE.Group();
      thigh.position.x = side * 0.12;
      box(0.17, 0.46, 0.19, M.pants, 0, -0.23, 0, thigh);
      const knee = new THREE.Group();
      knee.position.y = -0.46;
      thigh.add(knee);
      box(0.15, 0.44, 0.17, M.pants, 0, -0.22, 0, knee);
      box(0.16, 0.09, 0.28, M.boot, 0, -0.45, -0.05, knee);
      this.hips.add(thigh);
      return { thigh, knee };
    };
    this.legL = leg(-1);
    this.legR = leg(1);

    this.spine = new THREE.Group();
    this.hips.add(this.spine);
    box(0.46, 0.6, 0.26, this.shirt, 0, 0.3, 0, this.spine);
    box(0.48, 0.08, 0.28, M.boot, 0, 0.02, 0, this.spine);
    if (!zombie) {
      box(0.5, 0.42, 0.3, M.vest, 0, 0.36, 0, this.spine);
      box(0.34, 0.36, 0.14, M.olive, 0, 0.34, 0.2, this.spine);     // backpack
      box(0.12, 0.1, 0.05, M.olive, -0.12, 0.25, -0.17, this.spine); // pouches
      box(0.12, 0.1, 0.05, M.olive, 0.12, 0.25, -0.17, this.spine);
    } else {
      box(0.3, 0.2, 0.27, skin, 0.08, 0.15, -0.01, this.spine);
    }
    this.head = new THREE.Group();
    this.head.position.y = 0.66;
    this.spine.add(this.head);
    box(0.12, 0.08, 0.12, skin, 0, 0.02, 0, this.head);
    box(0.27, 0.3, 0.27, skin, 0, 0.2, 0, this.head);
    box(0.06, 0.05, 0.05, skin, 0, 0.18, -0.15, this.head);           // nose
    if (!zombie) {
      box(0.31, 0.13, 0.31, M.helmet, 0, 0.36, 0.01, this.head);
      box(0.33, 0.03, 0.34, M.helmet, 0, 0.3, 0, this.head);
    }
    const eyeMat = zombie ? UNDEAD.eye : M.eye;
    box(0.05, 0.035, 0.02, eyeMat, -0.065, 0.23, -0.136, this.head);
    box(0.05, 0.035, 0.02, eyeMat, 0.065, 0.23, -0.136, this.head);
    if (zombie) box(0.12, 0.03, 0.02, M.eye, 0, 0.11, -0.136, this.head);

    const arm = (side, upperRot, foreRot, yaw) => {
      const sh = new THREE.Group();
      sh.position.set(side * 0.3, 0.52, 0);
      sh.rotation.set(upperRot, yaw, 0);
      box(0.13, 0.32, 0.14, this.shirt, 0, -0.15, 0, sh);
      const el = new THREE.Group();
      el.position.y = -0.3;
      el.rotation.x = foreRot;
      sh.add(el);
      box(0.11, 0.28, 0.12, zombie ? skin : this.shirt, 0, -0.13, 0, el);
      box(0.1, 0.1, 0.11, zombie ? skin : M.glove, 0, -0.3, 0, el);
      this.spine.add(sh);
      return { sh, el, base: [upperRot, foreRot, yaw] };
    };
    if (zombie) { this.armR = arm(1, 1.45, 0.1, 0.05); this.armL = arm(-1, 1.35, 0.15, -0.05); }
    else { this.armR = arm(1, 0.9, 0.7, 0.15); this.armL = arm(-1, 1.25, 0.35, -0.55); }

    this.gunHolder = new THREE.Group();
    this.gunHolder.position.set(0.1, 0.36, -0.42);
    this.spine.add(this.gunHolder);
    this.guns = {};
    this.weapon = null;

    this.tag = null; this.tagText = '';
    this.walkPhase = Math.random() * 6;
    this.deadT = 0; this.fallSide = 0;
    this.display = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.yaw = 0; this.bodyYaw = 0; this.pitch = 0;
    this.crouchAmt = 0; this.slideAmt = 0; this.airAmt = 0; this.leanAmt = 0;
    this.flinch = 0; this.lastHp = null; this.attackT = 0;
    this.velF = 0; this.velS = 0;
    this.first = true;
    this.time = Math.random() * 10;
  }

  setWeapon(t) {
    if (this.weapon === t) return;
    if (this.weapon) this.guns[this.weapon].visible = false;
    if (!this.guns[t]) { this.guns[t] = buildGun(t); this.gunHolder.add(this.guns[t]); }
    this.guns[t].visible = true;
    this.weapon = t;
  }
  setLook(name, shirtColor, tagColor) {
    this.shirt.color.set(shirtColor);
    const key = name + tagColor;
    if (key !== this.tagText) {
      if (this.tag) { this.root.remove(this.tag); this.tag.material.map.dispose(); this.tag.material.dispose(); }
      this.tag = nameSprite(name, tagColor);
      this.tag.position.y = 2.15;
      this.root.add(this.tag);
      this.tagText = key;
    }
  }
  get muzzleWorld() {
    const v = new THREE.Vector3();
    const gun = this.guns[this.weapon];
    if (gun) gun.getObjectByName('muzzle').getWorldPosition(v);
    else { this.root.getWorldPosition(v); v.y += 1.4; }
    return v;
  }
  attack() { this.attackT = 0.35; }

  update(dt, s) {
    this.time += dt;
    this.target.set(s.x, s.y, s.z);
    if (this.first || this.display.distanceTo(this.target) > 5) { this.display.copy(this.target); this.first = false; this.deadT = 0; }
    const before = this.display.clone();
    const k = 1 - Math.exp(-dt * 14);
    this.display.lerp(this.target, k);
    let dy = s.yaw - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * k;
    this.pitch += (s.pitch - this.pitch) * k;
    this.root.position.copy(this.display);

    // the body turns a little behind the head, like a real person
    let by = this.yaw - this.bodyYaw;
    by = Math.atan2(Math.sin(by), Math.cos(by));
    this.bodyYaw += by * Math.min(1, dt * 8);
    this.root.rotation.y = this.bodyYaw;
    this.head.rotation.y = Math.atan2(Math.sin(this.yaw - this.bodyYaw), Math.cos(this.yaw - this.bodyYaw)) * 0.8;

    // movement relative to where the body faces (forward / sideways)
    const vx = (this.display.x - before.x) / Math.max(dt, 1e-4), vz = (this.display.z - before.z) / Math.max(dt, 1e-4);
    const fx = -Math.sin(this.bodyYaw), fz = -Math.cos(this.bodyYaw);
    const f = vx * fx + vz * fz, sd = vx * -fz + vz * fx;
    this.velF += (f - this.velF) * Math.min(1, dt * 10);
    this.velS += (sd - this.velS) * Math.min(1, dt * 10);
    const speed = Math.hypot(this.velF, this.velS);

    this.crouchAmt += ((s.c ? 1 : 0) - this.crouchAmt) * Math.min(1, dt * 12);
    this.slideAmt += ((s.s ? 1 : 0) - this.slideAmt) * Math.min(1, dt * 12);
    this.airAmt += ((s.j ? 1 : 0) - this.airAmt) * Math.min(1, dt * 10);
    if (this.kind === 'soldier' && s.w) this.setWeapon(s.w);

    // flinch when hit
    if (this.lastHp !== null && s.hp !== undefined && s.hp < this.lastHp && !s.dead) this.flinch = 1;
    this.lastHp = s.hp;
    this.flinch = Math.max(0, this.flinch - dt * 5);

    // death: fall backwards or to a side
    if (s.dead) {
      if (this.deadT === 0) this.fallSide = (Math.random() - 0.5) * 1.2;
      this.deadT = Math.min(1, this.deadT + dt * 2.5);
    } else this.deadT = 0;
    if (this.tag) this.tag.visible = !s.dead;
    const fall = this.deadT * this.deadT;
    this.body.rotation.x = fall * Math.PI / 2 * 0.95;
    this.body.rotation.z = fall * this.fallSide;

    // legs: walk / run cycle with strafing, crouch, slide and jump poses
    const moving = Math.min(1, speed / 4.5) * (1 - this.slideAmt) * (1 - this.airAmt);
    const run = Math.min(1, Math.max(0, (speed - 5) / 3));
    this.walkPhase += dt * (3.5 + speed * 1.25) * (moving > 0.05 ? 1 : 0);
    const ph = this.walkPhase;
    const dirF = speed > 0.3 ? this.velF / speed : 1, dirS = speed > 0.3 ? this.velS / speed : 0;
    const stride = (0.65 + run * 0.35) * moving;
    const swing = Math.sin(ph) * stride;
    const cr = this.crouchAmt * (1 - this.slideAmt), sl = this.slideAmt, air = this.airAmt;
    const kneeL = Math.max(0, -Math.sin(ph)) * (0.9 + run * 0.6) * moving;
    const kneeR = Math.max(0, Math.sin(ph)) * (0.9 + run * 0.6) * moving;
    this.legL.thigh.rotation.x = swing * dirF + cr * 1.2 + sl * 1.45 + air * 0.7;
    this.legR.thigh.rotation.x = -swing * dirF + cr * 1.2 + sl * 1.3 + air * 0.1;
    this.legL.thigh.rotation.z = -swing * dirS * 0.5;
    this.legR.thigh.rotation.z = swing * dirS * 0.5;
    this.legL.knee.rotation.x = -kneeL - cr * 1.9 - sl * 0.3 - air * 1.2;
    this.legR.knee.rotation.x = -kneeR - cr * 1.9 - sl * 0.2 - air * 0.5;
    const bob = Math.abs(Math.cos(ph)) * (0.03 + run * 0.04) * moving;
    const breathe = Math.sin(this.time * 2.2) * 0.008;
    this.hips.position.y = 0.95 - cr * 0.4 - sl * 0.6 + bob + breathe;

    // upper body: aim pitch, lean forward when running, sway side to side, flinch
    const zombie = this.kind !== 'soldier';
    this.leanAmt += ((run * 0.25 + (zombie ? 0.25 : 0)) * Math.max(0, dirF) - this.leanAmt) * Math.min(1, dt * 6);
    this.spine.rotation.x = (zombie ? 0 : this.pitch * 0.55) - sl * 0.35 - this.leanAmt * 0.6 - this.flinch * 0.25 + breathe * 2;
    this.spine.rotation.z = Math.sin(ph) * 0.05 * moving - dirS * 0.08 * moving;
    this.spine.rotation.y = -Math.sin(ph) * 0.08 * moving;
    this.head.rotation.x = (zombie ? -0.2 + Math.sin(this.time * 3) * 0.08 : this.pitch * 0.45) + this.leanAmt * 0.6;

    // arms: zombies reach and swipe, soldiers bounce the gun a bit
    this.attackT = Math.max(0, this.attackT - dt);
    const atk = Math.sin((this.attackT / 0.35) * Math.PI);
    const ar = this.armR, al = this.armL;
    if (zombie) {
      ar.sh.rotation.x = ar.base[0] + Math.sin(this.time * 4) * 0.08 + atk * 0.8;
      al.sh.rotation.x = al.base[0] + Math.cos(this.time * 4) * 0.08 + atk * 0.6;
    } else {
      ar.sh.rotation.x = ar.base[0] + Math.sin(ph * 2) * 0.03 * moving;
      al.sh.rotation.x = al.base[0] + Math.sin(ph * 2) * 0.03 * moving;
      this.gunHolder.position.y = 0.36 + Math.sin(ph * 2) * 0.01 * moving;
    }
  }
}
