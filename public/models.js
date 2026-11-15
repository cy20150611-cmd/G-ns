// 3D models built from simple shapes: guns, first-person arms, and player characters.
import * as THREE from 'three';

const mat = (color, rough = 0.7, metal = 0.1) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
const M = {
  metal: mat(0x26282c, 0.45, 0.6),
  metal2: mat(0x3d4046, 0.5, 0.5),
  wood: mat(0x6b4526, 0.8, 0),
  tan: mat(0x8a7a5a, 0.8, 0.05),
  glove: mat(0x1d1f22, 0.9, 0),
  pants: mat(0x2e3238, 0.9, 0),
  boot: mat(0x1a1714, 0.9, 0),
  vest: mat(0x3b4232, 0.9, 0),
  helmet: mat(0x3e4636, 0.7, 0.1),
  eye: mat(0x111111, 0.5, 0),
  lens: new THREE.MeshStandardMaterial({ color: 0x113355, roughness: 0.1, metalness: 0.8 }),
};

function box(w, h, d, material, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  if (parent) parent.add(m);
  return m;
}
function cyl(r, len, material, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), material);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

// Gun points toward -z. Origin is at the grip. A child named "muzzle" marks the barrel tip.
export function buildGun(type) {
  const g = new THREE.Group();
  let muzzleZ = -0.6;
  if (type === 'rifle') {
    box(0.07, 0.1, 0.5, M.metal, 0, 0.02, -0.12, g);           // receiver
    box(0.075, 0.07, 0.25, M.tan, 0, 0.0, -0.32, g);           // handguard
    cyl(0.016, 0.22, M.metal, 0, 0.03, -0.55, g);               // barrel
    box(0.05, 0.16, 0.08, M.metal2, 0, -0.1, -0.12, g).rotation.x = 0.25; // mag
    box(0.045, 0.12, 0.06, M.metal, 0, -0.07, 0.04, g).rotation.x = -0.3; // grip
    box(0.06, 0.09, 0.24, M.tan, 0, 0.0, 0.24, g);              // stock
    box(0.03, 0.04, 0.08, M.metal, 0, 0.09, -0.08, g);          // sight
    muzzleZ = -0.67;
  } else if (type === 'smg') {
    box(0.07, 0.1, 0.36, M.metal, 0, 0.02, -0.08, g);
    cyl(0.018, 0.14, M.metal2, 0, 0.03, -0.32, g);
    box(0.045, 0.2, 0.06, M.metal2, 0, -0.13, -0.06, g);       // long mag
    box(0.045, 0.11, 0.06, M.metal, 0, -0.06, 0.06, g).rotation.x = -0.3;
    box(0.03, 0.05, 0.2, M.metal, 0, 0.0, 0.2, g);              // wire stock
    box(0.025, 0.035, 0.06, M.metal, 0, 0.085, -0.05, g);
    muzzleZ = -0.4;
  } else if (type === 'shotgun') {
    box(0.07, 0.09, 0.32, M.metal, 0, 0.02, -0.05, g);
    cyl(0.022, 0.55, M.metal, 0, 0.04, -0.45, g);               // barrel
    cyl(0.026, 0.22, M.wood, 0, -0.02, -0.38, g);               // pump
    box(0.045, 0.11, 0.06, M.wood, 0, -0.06, 0.08, g).rotation.x = -0.35;
    box(0.065, 0.1, 0.28, M.wood, 0, -0.01, 0.26, g);
    box(0.02, 0.025, 0.03, M.metal2, 0, 0.075, -0.68, g);
    muzzleZ = -0.73;
  } else if (type === 'pistol') {
    box(0.04, 0.06, 0.22, M.metal, 0, 0.05, -0.06, g);          // slide
    box(0.038, 0.13, 0.05, M.metal2, 0, -0.03, 0.02, g).rotation.x = -0.2;
    box(0.015, 0.02, 0.02, M.metal2, 0, 0.09, -0.15, g);
    muzzleZ = -0.18;
  } else if (type === 'sniper') {
    box(0.07, 0.09, 0.45, M.metal, 0, 0.02, -0.08, g);
    cyl(0.017, 0.65, M.metal, 0, 0.03, -0.62, g);
    cyl(0.032, 0.32, M.metal2, 0, 0.11, -0.1, g);               // scope
    cyl(0.028, 0.01, M.lens, 0, 0.11, -0.265, g);
    box(0.02, 0.04, 0.02, M.metal, 0, 0.07, -0.18, g);
    box(0.02, 0.04, 0.02, M.metal, 0, 0.07, -0.02, g);
    box(0.05, 0.08, 0.07, M.metal2, 0, -0.07, -0.1, g);
    box(0.045, 0.12, 0.06, M.wood, 0, -0.06, 0.08, g).rotation.x = -0.3;
    box(0.065, 0.11, 0.32, M.wood, 0, -0.01, 0.3, g);
    muzzleZ = -0.96;
  }
  const muzzle = new THREE.Object3D();
  muzzle.name = 'muzzle';
  muzzle.position.set(0, 0.03, muzzleZ);
  g.add(muzzle);
  return g;
}

// Height of the iron sight / scope above the gun origin, used for aiming down sights.
export const SIGHT_HEIGHT = { rifle: 0.11, smg: 0.1, shotgun: 0.085, pistol: 0.1, sniper: 0.11 };

// ---------- First-person view: arms + gun ----------
export class ViewModel {
  constructor(sleeveColor) {
    this.root = new THREE.Group();
    this.holder = new THREE.Group();   // moved for bob / recoil / ADS
    this.root.add(this.holder);
    this.sleeve = mat(sleeveColor, 0.9, 0);
    this.guns = {};
    for (const t of ['rifle', 'smg', 'shotgun', 'pistol', 'sniper']) {
      const gun = buildGun(t);
      gun.traverse(o => { o.castShadow = false; });
      gun.visible = false;
      this.holder.add(gun);
      this.guns[t] = gun;
    }
    // right arm (holds the grip)
    this.rArm = new THREE.Group();
    box(0.09, 0.09, 0.45, this.sleeve, 0.04, -0.06, 0.28, this.rArm);
    box(0.07, 0.08, 0.1, M.glove, 0, -0.05, 0.03, this.rArm);
    this.rArm.position.set(0, 0, 0);
    this.holder.add(this.rArm);
    // left arm (holds the front)
    this.lArm = new THREE.Group();
    box(0.09, 0.09, 0.5, this.sleeve, -0.12, -0.1, 0.12, this.lArm).rotation.y = -0.45;
    box(0.07, 0.07, 0.1, M.glove, 0, -0.04, -0.12, this.lArm);
    this.holder.add(this.lArm);

    // muzzle flash
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
    const gun = this.guns[t];
    gun.visible = true;
    const pistol = t === 'pistol';
    // left hand position along the gun
    const front = { rifle: -0.32, smg: -0.25, shotgun: -0.38, pistol: 0.02, sniper: -0.3 }[t];
    this.lArm.position.set(pistol ? -0.01 : 0, pistol ? -0.04 : -0.02, front);
    this.lArm.rotation.set(0, pistol ? 0.2 : 0, 0);
    const muzzle = gun.getObjectByName('muzzle');
    this.flash.position.copy(muzzle.position);
  }

  get muzzleObject() { return this.guns[this.current].getObjectByName('muzzle'); }
}

// ---------- Third-person character for other players ----------
const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0xa1665e];

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
  constructor(id) {
    this.id = id;
    this.root = new THREE.Group();
    this.body = new THREE.Group();     // lowered for crouch, rotated when dead
    this.root.add(this.body);
    this.shirt = mat(0x888888, 0.9, 0);
    const skin = mat(SKIN[id % SKIN.length], 0.8, 0);

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
    box(0.46, 0.6, 0.26, this.shirt, 0, 0.3, 0, this.spine);         // torso
    box(0.5, 0.42, 0.3, M.vest, 0, 0.36, 0, this.spine);             // vest
    box(0.48, 0.08, 0.28, M.boot, 0, 0.02, 0, this.spine);           // belt

    this.head = new THREE.Group();
    this.head.position.y = 0.66;
    this.spine.add(this.head);
    box(0.12, 0.08, 0.12, skin, 0, 0.02, 0, this.head);              // neck
    box(0.27, 0.3, 0.27, skin, 0, 0.2, 0, this.head);                // head
    box(0.31, 0.13, 0.31, M.helmet, 0, 0.36, 0.01, this.head);       // helmet
    box(0.33, 0.03, 0.34, M.helmet, 0, 0.3, 0, this.head);
    box(0.05, 0.035, 0.02, M.eye, -0.065, 0.23, -0.136, this.head);
    box(0.05, 0.035, 0.02, M.eye, 0.065, 0.23, -0.136, this.head);

    const arm = (side, upperRot, foreRot, yaw) => {
      const sh = new THREE.Group();
      sh.position.set(side * 0.3, 0.52, 0);
      sh.rotation.set(upperRot, yaw, 0);
      box(0.13, 0.32, 0.14, this.shirt, 0, -0.15, 0, sh);
      const el = new THREE.Group();
      el.position.y = -0.3;
      el.rotation.x = foreRot;
      sh.add(el);
      box(0.11, 0.28, 0.12, this.shirt, 0, -0.13, 0, el);
      box(0.1, 0.1, 0.11, M.glove, 0, -0.3, 0, el);
      this.spine.add(sh);
      return sh;
    };
    this.armR = arm(1, 0.9, 0.7, 0.15);
    this.armL = arm(-1, 1.25, 0.35, -0.55);

    this.gunHolder = new THREE.Group();
    this.gunHolder.position.set(0.1, 0.36, -0.42);
    this.spine.add(this.gunHolder);
    this.guns = {};
    this.weapon = null;

    this.tag = null;
    this.tagText = '';
    this.walkPhase = 0;
    this.deadT = 0;
    this.display = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.yaw = 0; this.targetYaw = 0;
    this.pitch = 0;
    this.crouchAmt = 0;
    this.slideAmt = 0;
    this.first = true;
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
    else this.root.getWorldPosition(v).y += 1.4;
    return v;
  }

  update(dt, s) {
    this.target.set(s.x, s.y, s.z);
    if (this.first || this.display.distanceTo(this.target) > 5) { this.display.copy(this.target); this.first = false; }
    const before = this.display.clone();
    const k = 1 - Math.exp(-dt * 14);
    this.display.lerp(this.target, k);
    // shortest-path yaw interpolation
    let dy = s.yaw - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * k;
    this.pitch += (s.pitch - this.pitch) * k;
    this.root.position.copy(this.display);
    this.root.rotation.y = this.yaw;

    const speed = Math.hypot(this.display.x - before.x, this.display.z - before.z) / Math.max(dt, 1e-4);
    this.crouchAmt += ((s.c ? 1 : 0) - this.crouchAmt) * Math.min(1, dt * 12);
    this.slideAmt += ((s.s ? 1 : 0) - this.slideAmt) * Math.min(1, dt * 12);
    this.setWeapon(s.w);

    // death fall
    if (s.dead) {
      this.deadT = Math.min(1, this.deadT + dt * 2.5);
      if (this.tag) this.tag.visible = false;
    } else {
      this.deadT = 0;
      if (this.tag) this.tag.visible = true;
    }
    const fall = this.deadT * this.deadT;
    this.body.rotation.x = fall * Math.PI / 2 * 0.95;
    this.root.visible = !(s.dead && this.deadT >= 1 && this.hideDead);

    // legs
    const moving = Math.min(1, speed / 5) * (1 - this.slideAmt);
    this.walkPhase += dt * (4 + speed * 1.3) * (moving > 0.05 ? 1 : 0);
    const sw = Math.sin(this.walkPhase) * 0.75 * moving;
    const cr = this.crouchAmt * (1 - this.slideAmt);
    const sl = this.slideAmt;
    this.legL.thigh.rotation.x = sw + cr * 1.2 + sl * 1.45;
    this.legR.thigh.rotation.x = -sw + cr * 1.2 + sl * 1.3;
    this.legL.knee.rotation.x = -(Math.max(0, -Math.sin(this.walkPhase)) * 0.9 * moving) - cr * 1.9 - sl * 0.3;
    this.legR.knee.rotation.x = -(Math.max(0, Math.sin(this.walkPhase)) * 0.9 * moving) - cr * 1.9 - sl * 0.2;
    this.hips.position.y = 0.95 - cr * 0.4 - sl * 0.6 + Math.abs(Math.cos(this.walkPhase)) * 0.03 * moving;

    // upper body follows aim
    this.spine.rotation.x = this.pitch * 0.55 - sl * 0.35;
    this.head.rotation.x = this.pitch * 0.45;
  }
}
