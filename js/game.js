(function () {
  'use strict';

  const V3 = THREE.Vector3;
  const { clamp, lerp, randFloat: rand } = THREE.MathUtils;
  const $ = (id) => document.getElementById(id);
  const Y_AXIS = new V3(0, 1, 0);
  const smooth = (k) => k * k * (3 - 2 * k);

  // ---------- Tuning ----------
  const PLAYER = { speed: 6, sprint: 9.5, jump: 8, gravity: 18, radius: 0.4, maxHp: 200 };
  const HEAL = { banana: 40, medkit: 70 };
  const ARROW = { speed: 75, gravity: 6, cooldown: 0.45, damage: 1, bossDamage: 0.5 };
  // Hitscan firearms; bullets barely hurt bosses, like arrows.
  const GUNS = {
    ak: { name: 'AK-47', cooldown: 0.1, damage: 1, bossDamage: 0.2, spread: 0.012, start: 120, box: 30, sound: 'rifle' },
    pistol: { name: 'Smith & Wesson', cooldown: 0.32, damage: 2, bossDamage: 0.5, spread: 0.003, start: 36, box: 12, sound: 'pistol' },
  };
  const AMMO_DROP = 0.3;
  // Tab and the mouse wheel step through this order, skipping weapons without ammo.
  const WEAPON_ORDER = ['bow', 'ak', 'pistol', 'rpg'];
  const ROCKET = { speed: 45, cooldown: 1.6, damage: 25, splash: 4.5, startAmmo: 5, bagAmmo: 4 };
  const MONKEY = { hp: 1, speed: 5.2, damage: 7, attackCd: 1.0, reach: 1.3 };
  const BEASTS = {
    wolf: { hp: 1, speed: 7.2, lungeSpeed: 15, lungeRange: 7, damage: 11, attackCd: 1.2, reach: 1.5, pitch: 1, drop: 0.3 },
    lion: { hp: 2, speed: 6.6, lungeSpeed: 14, lungeRange: 9, damage: 16, attackCd: 1.3, reach: 2.0, pitch: 0.6, drop: 0.4 },
    tiger: { hp: 2, speed: 8.2, lungeSpeed: 18, lungeRange: 10, damage: 13, attackCd: 1.1, reach: 1.9, pitch: 0.75, drop: 0.4 },
  };
  const KONG = { hp: 100, height: 5.4, speed: 4.2, slamDamage: 35, slamRadius: 6, rockDamage: 20 };
  const TREX = { hp: 150, speed: 4.5, chargeSpeed: 17, biteDamage: 30, biteRange: 6, chargeDamage: 35 };
  const DRAGON = {
    hp: 100, flyHeight: 13, orbitR: 30, orbitSpeed: 0.3, flyTime: 12, groundTime: 9,
    fireballSpeed: 24, fireballDamage: 15, breathDamage: 6, breathRange: 13,
  };
  // Rival footballers slide-tackle the player; a tomato in the face sends them running off.
  const FOOTBALLER = { hp: 1, speed: 6.2, tackleRange: 5, tackleSpeed: 12, damage: 8, tackleCd: [1.5, 2.5], fleeTime: 3 };
  const TOMATO = { speed: 24, gravity: 9.8, cooldown: 0.35 };

  // Walkable level: forest path → King Kong's clearing → second path → T-Rex lair →
  // third path (Fenerbahçe, then Beşiktaş players) → final clearing with the two dragons → exit gate.
  const C1 = { x0: -14, x1: 14, z0: -306, z1: 3 };
  const ARENA = { x: 0, z: -350, r: 47 };
  const C2 = { x0: -14, x1: 14, z0: -570, z1: -392 };
  const LAIR = { x: 0, z: -615, r: 50 };
  const C3 = { x0: -14, x1: 14, z0: -937, z1: -660 };
  const FINAL = { x: 0, z: -985, r: 52 };
  const REGIONS = [C1, ARENA, C2, LAIR, C3, FINAL];
  const BARRIER_Z = [-150, -300, -398, -562, -667, -795, -930];
  const GATE_Z = -1039;

  const WAVES = {
    monkeys: { types: ['monkey'], total: 12, maxAlive: 4, zMin: -147, zMax: -2, interval: [0.8, 1.8], next: 'wolves' },
    wolves: { types: ['wolf'], total: 6, maxAlive: 3, zMin: -297, zMax: -153, interval: [1.0, 2.2], next: 'toArena' },
    cats: { types: ['lion', 'tiger'], total: 8, maxAlive: 3, zMin: -559, zMax: -401, interval: [1.2, 2.4], next: 'toLair' },
    fb: { types: ['fb'], total: 8, maxAlive: 4, zMin: -792, zMax: -670, interval: [0.8, 1.6], next: 'bjk', weapon: 'tomato' },
    bjk: { types: ['bjk'], total: 8, maxAlive: 4, zMin: -927, zMax: -798, interval: [0.8, 1.6], next: 'toFinal', weapon: 'tomato' },
  };
  const BOSS_FIGHTS = {
    kong: { area: ARENA, trees: () => arenaTrees, minions: ['monkey', 'wolf'], interval: 7, maxAlive: 3, next: 'cats' },
    trex: { area: LAIR, trees: () => lairTrees, minions: ['wolf', 'monkey'], interval: 10, maxAlive: 2, next: 'fb' },
    dragons: { area: FINAL, trees: () => finalTrees, minions: ['monkey', 'wolf'], interval: 10, maxAlive: 2, next: 'escape' },
  };
  // open: how many log piles start open; the phase's own pile then opens with an animation.
  const CHECKPOINTS = [
    { name: 'Maymunlar', z: -3, phase: 'monkeys', open: 0 },
    { name: 'Kurtlar', z: -156, phase: 'wolves', open: 1 },
    { name: 'King Kong', z: -302, phase: 'toArena', open: 2 },
    { name: 'Aslanlar ve kaplanlar', z: -385, phase: 'cats', open: 2 },
    { name: 'T-Rex', z: -566, phase: 'toLair', open: 4 },
    { name: 'Fenerbahçe', z: -650, phase: 'fb', open: 4 },
    { name: 'Beşiktaş', z: -797, phase: 'bjk', open: 5 },
    { name: 'Ejderhalar', z: -932, phase: 'toFinal', open: 6 },
  ];

  // ---------- Save data (browser localStorage) ----------
  const SAVE_KEY = 'osimhenOrman.v1';
  const save = { checkpoint: 0, wins: 0, bestTime: 0, settings: { sound: true, sens: 1 } };

  function loadSave() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (d) {
        Object.assign(save, d);
        save.settings = Object.assign({ sound: true, sens: 1 }, d.settings);
        save.checkpoint = clamp(save.checkpoint | 0, 0, CHECKPOINTS.length - 1);
      }
    } catch (e) { /* storage unavailable: play with defaults */ }
  }

  function writeSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
  }

  // ---------- Renderer, camera, forest scene ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  $('game').appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 700);
  camera.rotation.order = 'YXZ';

  const scene = new THREE.Scene();
  const FOG = 0xb4c8a8;
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.Fog(FOG, 30, 150);
  scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x4a5a2a, 0.85));
  const sun = new THREE.DirectionalLight(0xfff0d0, 0.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 160 });
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);

  const stadium = Stadium.create();
  let stadiumActive = false;

  // ---------- Ground ----------
  function repeatTexture(size, repeatX, repeatY, draw) {
    const t = Models.textTexture(size, size, draw);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    t.anisotropy = maxAniso;
    return t;
  }

  function speckle(g, s, base, n, hue, sat, light) {
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < n; i++) {
      g.fillStyle = `hsl(${hue[0] + Math.random() * hue[1]},${sat}%,${light[0] + Math.random() * light[1]}%)`;
      g.fillRect(Math.random() * s, Math.random() * s, 2, 3);
    }
  }

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 1500),
    new THREE.MeshLambertMaterial({ map: repeatTexture(256, 150, 375, (g, s) => speckle(g, s, '#4b7430', 7000, [70, 40], 40, [18, 22])) })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -500;
  ground.receiveShadow = true;
  scene.add(ground);

  const groundOverlay = (geo, map) => {
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };

  function windingPath(zStart, zEnd) {
    const len = zStart - zEnd;
    const geo = new THREE.PlaneGeometry(5, len, 2, Math.ceil(len / 4));
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, (zStart + zEnd) / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + Math.sin(p.getZ(i) * 0.045) * 3.5);
    const tex = repeatTexture(256, 1.5, len / 3.5, (g, s) => speckle(g, s, '#7a6243', 5000, [25, 15], 35, [25, 25]));
    groundOverlay(geo, tex);
  }
  windingPath(5, -307);
  windingPath(-393, -567);
  windingPath(-661, -936);

  function clearing(area, texture) {
    const geo = new THREE.CircleGeometry(area.r + 2, 64);
    geo.rotateX(-Math.PI / 2);
    geo.translate(area.x, 0, area.z);
    groundOverlay(geo, texture);
  }
  clearing(ARENA, repeatTexture(256, 24, 24, (g, s) => speckle(g, s, '#6b6a3a', 6000, [35, 40], 35, [20, 25])));
  clearing(LAIR, repeatTexture(256, 26, 26, (g, s) => speckle(g, s, '#3e3631', 7000, [10, 25], 25, [10, 22])));
  clearing(FINAL, repeatTexture(256, 26, 26, (g, s) => speckle(g, s, '#55703a', 6000, [60, 40], 35, [22, 22])));

  // ---------- Trees (instanced) ----------
  function seeded(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = seeded(45);
  const rr = (a, b) => a + rng() * (b - a);

  const trees = [];
  const treeGrid = new Map();
  const CELL = 8;
  const cellKey = (cx, cz) => (cx + 1000) * 4096 + (cz + 1000);

  function addTree(x, z, s, kind) {
    const t = { x, z, s, kind, r: 0.32 * s, h: (kind === 'pine' ? 9 : 6.5) * s };
    trees.push(t);
    const k = cellKey(Math.floor(x / CELL), Math.floor(z / CELL));
    if (!treeGrid.has(k)) treeGrid.set(k, []);
    treeGrid.get(k).push(t);
    return t;
  }

  const nearBuf = [];
  function treesInBox(x0, z0, x1, z1) {
    nearBuf.length = 0;
    const cx0 = Math.floor(Math.min(x0, x1) / CELL), cx1 = Math.floor(Math.max(x0, x1) / CELL);
    const cz0 = Math.floor(Math.min(z0, z1) / CELL), cz1 = Math.floor(Math.max(z0, z1) / CELL);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cz = cz0; cz <= cz1; cz++) {
        const list = treeGrid.get(cellKey(cx, cz));
        if (list) for (const t of list) nearBuf.push(t);
      }
    }
    return nearBuf;
  }

  function inRegion(reg, x, z, margin) {
    if (reg.r) return Math.hypot(x - reg.x, z - reg.z) < reg.r + margin;
    return x > reg.x0 - margin && x < reg.x1 + margin && z > reg.z0 - margin && z < reg.z1 + margin;
  }

  function inPlayArea(x, z, margin) {
    if (REGIONS.some((reg) => inRegion(reg, x, z, margin))) return true;
    return Math.abs(x) < 5 + margin && z < GATE_Z + 2 && z > GATE_Z - 14;
  }

  for (let i = 0; i < 6500; i++) {
    const x = rr(-120, 120), z = rr(-1140, 55);
    if (inPlayArea(x, z, 1.2)) continue;
    addTree(x, z, rr(0.8, 1.5), rng() < 0.25 ? 'pine' : 'oak');
  }
  for (const [z0, z1, avoid] of [[-12, -295, BARRIER_Z[0]], [-405, -555, null], [-675, -925, BARRIER_Z[5]]]) {
    for (let i = 0; i < 30; i++) {
      const x = rr(-11, 11), z = rr(z1, z0);
      if ((avoid && Math.abs(z - avoid) < 7) || Math.abs(x) < 2.5) continue;
      addTree(x, z, rr(0.9, 1.3), 'oak');
    }
  }

  // Big trees around each boss clearing; RPG-7 and rocket bags hang from their branches.
  function bigTreeRing(area) {
    const ring = [];
    for (const deg of [5, 35, 62, 118, 145, 175, 205, 235, 305, 335]) {
      const a = THREE.MathUtils.degToRad(deg + rr(-6, 6));
      const r = rr(30, 40);
      const t = addTree(area.x + Math.cos(a) * r, area.z + Math.sin(a) * r, 1.7, 'oak');
      const toCenter = new V3(area.x - t.x, 0, area.z - t.z).normalize();
      t.hang = new V3(t.x, 3.5, t.z).addScaledVector(toCenter, 2.3);
      ring.push(t);
    }
    return ring;
  }
  const arenaTrees = bigTreeRing(ARENA);
  const lairTrees = bigTreeRing(LAIR);
  const finalTrees = bigTreeRing(FINAL);

  {
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 1, 7);
    trunkGeo.translate(0, 0.5, 0);
    const oakGeo = new THREE.IcosahedronGeometry(1, 1);
    const pineGeo = new THREE.ConeGeometry(1, 1, 8);
    pineGeo.translate(0, 0.5, 0);
    const oaks = trees.filter((t) => t.kind === 'oak'), pines = trees.filter((t) => t.kind === 'pine');
    const trunks = new THREE.InstancedMesh(trunkGeo, Models.mat(0xffffff), trees.length);
    const oakMesh = new THREE.InstancedMesh(oakGeo, Models.mat(0xffffff, { flatShading: true }), oaks.length * 2);
    const pineMesh = new THREE.InstancedMesh(pineGeo, Models.mat(0xffffff, { flatShading: true }), pines.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new V3(), sc = new V3(), col = new THREE.Color();
    trees.forEach((t, i) => {
      const trunkH = t.kind === 'pine' ? t.h * 0.45 : t.h * 0.62;
      m.compose(p.set(t.x, 0, t.z), q.identity(), sc.set(t.s, trunkH, t.s));
      trunks.setMatrixAt(i, m);
      trunks.setColorAt(i, col.setHSL(0.07, 0.35, rr(0.18, 0.28)));
    });
    oaks.forEach((t, i) => {
      q.setFromAxisAngle(Y_AXIS, rng() * 6.28);
      m.compose(p.set(t.x, t.h * 0.78, t.z), q, sc.set(2.7 * t.s, 2.2 * t.s, 2.7 * t.s));
      oakMesh.setMatrixAt(i * 2, m);
      oakMesh.setColorAt(i * 2, col.setHSL(rr(0.22, 0.3), rr(0.4, 0.55), rr(0.22, 0.32)));
      m.compose(p.set(t.x + rr(-1, 1) * t.s, t.h * 0.95, t.z + rr(-1, 1) * t.s), q, sc.set(1.9 * t.s, 1.7 * t.s, 1.9 * t.s));
      oakMesh.setMatrixAt(i * 2 + 1, m);
      oakMesh.setColorAt(i * 2 + 1, col.setHSL(rr(0.22, 0.3), rr(0.4, 0.55), rr(0.25, 0.35)));
    });
    pines.forEach((t, i) => {
      m.compose(p.set(t.x, t.h * 0.3, t.z), q.identity(), sc.set(2.1 * t.s, t.h * 0.75, 2.1 * t.s));
      pineMesh.setMatrixAt(i, m);
      pineMesh.setColorAt(i, col.setHSL(rr(0.3, 0.36), rr(0.35, 0.5), rr(0.16, 0.24)));
    });
    for (const im of [trunks, oakMesh, pineMesh]) {
      im.castShadow = true;
      im.receiveShadow = true;
      scene.add(im);
    }
    const bark = Models.mat(0x4f3520);
    for (const t of [...arenaTrees, ...lairTrees, ...finalTrees]) {
      const dx = t.hang.x - t.x, dz = t.hang.z - t.z;
      const len = Math.hypot(dx, dz) + 0.4;
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, len, 6), bark);
      branch.position.set(t.x + dx / 2, t.hang.y + 0.15, t.z + dz / 2);
      branch.quaternion.setFromUnitVectors(Y_AXIS, new V3(dx, 0.35, dz).normalize());
      branch.castShadow = true;
      scene.add(branch);
    }
  }

  // Bushes for ground detail, boulders around the T-Rex lair (no collision)
  {
    const bushGeo = new THREE.IcosahedronGeometry(1, 0);
    const bushes = new THREE.InstancedMesh(bushGeo, Models.mat(0xffffff, { flatShading: true }), 1100);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new V3(), sc = new V3(), col = new THREE.Color();
    const onPath = (z) => z > -306 || (z < -393 && z > -567) || (z < -661 && z > -936);
    let n = 0;
    for (let i = 0; i < 5000 && n < 1100; i++) {
      const x = rr(-40, 40), z = rr(-1060, 20);
      if (inPlayArea(x, z, -1) && rng() < 0.85) continue;
      if (Math.abs(x) < 4 && onPath(z)) continue;
      const s = rr(0.4, 1.0);
      q.setFromAxisAngle(Y_AXIS, rng() * 6.28);
      m.compose(p.set(x, s * 0.35, z), q, sc.set(s * 1.3, s * 0.8, s * 1.3));
      bushes.setMatrixAt(n, m);
      bushes.setColorAt(n, col.setHSL(rr(0.2, 0.32), 0.45, rr(0.2, 0.3)));
      n++;
    }
    bushes.count = n;
    bushes.castShadow = true;
    scene.add(bushes);

    const boulderGeo = new THREE.DodecahedronGeometry(1, 0);
    const boulderMat = Models.mat(0x5d5650, { flatShading: true });
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + rr(-0.1, 0.1);
      if (Math.abs(Math.sin(a)) > 0.95) continue;
      const r = rr(52, 60), s = rr(1.5, 3.2);
      const b = new THREE.Mesh(boulderGeo, boulderMat);
      b.position.set(LAIR.x + Math.cos(a) * r, s * 0.5, LAIR.z + Math.sin(a) * r);
      b.scale.set(s, s * rr(0.6, 1), s);
      b.rotation.set(rng() * 3, rng() * 3, 0);
      b.castShadow = b.receiveShadow = true;
      scene.add(b);
    }
  }

  // ---------- Barriers (fallen logs) and the exit gate ----------
  function makeBarrier(z) {
    const g = new THREE.Group();
    g.position.z = z;
    scene.add(g);
    const bark = Models.mat(0x5b3d22);
    const logGeo = new THREE.CylinderGeometry(0.7, 0.78, 33, 12);
    for (const [y, dz] of [[0.72, 0.65], [0.72, -0.65], [1.9, 0]]) {
      const log = new THREE.Mesh(logGeo, bark);
      log.rotation.z = Math.PI / 2;
      log.position.set(rr(-0.5, 0.5), y, dz);
      log.castShadow = log.receiveShadow = true;
      g.add(log);
    }
    for (let i = 0; i < 6; i++) {
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, rr(1.2, 2.2), 5), bark);
      br.position.set(rr(-12, 12), 2.5, rr(-0.5, 0.5));
      br.rotation.set(rr(-0.4, 0.4), 0, rr(-0.6, 0.6));
      g.add(br);
    }
    return {
      z, open: false, anim: 0,
      set(open) {
        this.open = open;
        this.anim = open ? 1 : 0;
        g.position.y = -this.anim * 3.2;
        g.visible = this.anim < 1;
      },
      openUp() {
        if (this.open) return;
        this.open = true;
        Sound.creak();
        emit('dust', new V3(0, 0.5, z), 30, { speed: 6, up: 2, spread: 10, size: 0.35, life: 1.2 });
      },
      update(dt) {
        if (this.open && this.anim < 1) {
          this.anim = Math.min(1, this.anim + dt / 1.6);
          g.position.y = -this.anim * 3.2;
          g.visible = this.anim < 1;
        }
      },
    };
  }

  function makeGate() {
    const g = new THREE.Group();
    g.position.set(0, 0, GATE_Z);
    scene.add(g);
    const stone = Models.mat(0x8c8b80, { flatShading: true }), wood = Models.mat(0x6b4423), iron = Models.mat(0x2e2e2e);
    const solid = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
      return m;
    };
    solid(new THREE.BoxGeometry(1.4, 7.6, 1.4), stone, -3.7, 3.8, 0);
    solid(new THREE.BoxGeometry(1.4, 7.6, 1.4), stone, 3.7, 3.8, 0);
    solid(new THREE.BoxGeometry(9, 1.2, 1.6), stone, 0, 7.8, 0);
    solid(new THREE.BoxGeometry(10, 4, 1), stone, -9.4, 2, 0);
    solid(new THREE.BoxGeometry(10, 4, 1), stone, 9.4, 2, 0);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 1),
      new THREE.MeshBasicMaterial({
        map: Models.textTexture(512, 128, (c, w, h) => {
          c.fillStyle = '#5a0a14'; c.fillRect(0, 0, w, h);
          c.strokeStyle = '#f7b500'; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10);
          c.fillStyle = '#f7b500'; c.font = 'bold 84px Arial Black, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText('ÇIKIŞ', w / 2, h / 2 + 4);
        }),
      })
    );
    sign.position.set(0, 7.8, 0.81);
    g.add(sign);
    const doors = [];
    for (const s of [-1, 1]) {
      const hinge = new THREE.Group();
      hinge.position.set(3 * s, 0, 0);
      g.add(hinge);
      const door = new THREE.Mesh(new THREE.BoxGeometry(3, 6.2, 0.25), wood);
      door.position.set(-1.5 * s, 3.1, 0);
      door.castShadow = true;
      hinge.add(door);
      for (const y of [1.2, 3.1, 5]) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.18, 0.3), iron);
        band.position.set(-1.5 * s, y, 0);
        hinge.add(band);
      }
      doors.push(hinge);
    }
    const portal = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 7), new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false }));
    portal.position.set(0, 3.5, -2.5);
    g.add(portal);
    return {
      isOpen: false, anim: 0,
      set(open) {
        this.isOpen = open;
        this.anim = open ? 1 : 0;
        this.apply();
      },
      open() {
        this.isOpen = true;
        Sound.creak();
      },
      apply() {
        const e = smooth(this.anim);
        doors[0].rotation.y = 1.75 * e;
        doors[1].rotation.y = -1.75 * e;
      },
      update(dt) {
        if (this.isOpen && this.anim < 1) {
          this.anim = Math.min(1, this.anim + dt / 2.2);
          this.apply();
        }
      },
    };
  }

  const barriers = BARRIER_Z.map(makeBarrier);
  const gate = makeGate();

  // ---------- Particles and transient effects ----------
  const particleGeo = new THREE.IcosahedronGeometry(1, 0);
  const PMAT = {
    fire: new THREE.MeshBasicMaterial({ color: 0xffa62b }),
    flame: new THREE.MeshBasicMaterial({ color: 0xff5a1a }),
    spark: new THREE.MeshBasicMaterial({ color: 0xffe45c }),
    smoke: Models.mat(0x8f8f8f),
    dark: Models.mat(0x3a3a3a),
    dust: Models.mat(0x8c7556),
    rock: Models.mat(0x77736c, { flatShading: true }),
    poof: Models.mat(0xe6e6e6),
    tomato: Models.mat(0xd0180f),
    leaf: Models.mat(0x4f8a34),
  };
  const particles = [], particlePool = [];

  function emit(kind, pos, count, o = {}) {
    const { speed = 4, up = 2, life = 0.8, size = 0.15, gravity = 9.8, grow = false, spread = 0.2, push = null } = o;
    for (let i = 0; i < count && particles.length < 600; i++) {
      const m = particlePool.pop() || new THREE.Mesh(particleGeo);
      m.material = PMAT[kind];
      m.position.set(pos.x + rand(-spread, spread), pos.y + rand(-spread, spread) * 0.5, pos.z + rand(-spread, spread));
      m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
      const vel = new V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(speed * rand(0.3, 1));
      vel.y += up;
      if (push) vel.add(push);
      scene.add(m);
      particles.push({ m, vel, life: life * rand(0.6, 1.4), age: 0, size, gravity, grow });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        scene.remove(p.m);
        particlePool.push(p.m);
        particles.splice(i, 1);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.m.position.addScaledVector(p.vel, dt);
      if (p.m.position.y < 0.05 && p.gravity > 0) {
        p.m.position.y = 0.05;
        p.vel.multiplyScalar(0.4);
      }
      const k = p.age / p.life;
      p.m.scale.setScalar(Math.max(0.001, p.grow ? p.size * (0.5 + 1.5 * k) : p.size * (1 - k)));
    }
  }

  const effects = [];
  const unitSphere = new THREE.SphereGeometry(1, 16, 12);
  const unitRing = new THREE.RingGeometry(0.85, 1, 48);
  unitRing.rotateX(-Math.PI / 2);

  function addEffect(geo, color, pos, dur, update) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    m.position.copy(pos);
    scene.add(m);
    effects.push({ m, t: 0, dur, update });
  }

  function updateEffects(dt) {
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      e.t += dt;
      const k = e.t / e.dur;
      if (k >= 1) {
        scene.remove(e.m);
        e.m.material.dispose();
        if (e.ownGeometry) e.m.geometry.dispose();
        effects.splice(i, 1);
      } else e.update(e.m, k);
    }
  }

  function shockRing(pos, radius, color) {
    addEffect(unitRing, color, pos, 0.6, (m, k) => {
      m.scale.setScalar(0.5 + radius * k);
      m.material.opacity = 0.8 * (1 - k);
    });
  }

  function fireBurst(p, size) {
    addEffect(unitSphere, 0xffb347, p, 0.45, (m, k) => {
      m.scale.setScalar(0.4 + size * k);
      m.material.opacity = 0.95 * (1 - k);
    });
    emit('fire', p, 20, { speed: 2 * size, up: 3, size: 0.3, life: 0.5, gravity: 2 });
    emit('smoke', p, 10, { speed: 3, up: 2.5, size: 0.6, life: 1.4, gravity: -0.6, grow: true, spread: 0.6 });
  }

  // ---------- Player ----------
  const player = {
    rig: Models.player(),
    pos: new V3(), vel: new V3(), onGround: true,
    hp: PLAYER.maxHp, weapon: 'bow', hasRpg: false, rockets: 0, ammo: { ak: 0, pistol: 0 },
    cooldown: 0, runPhase: 0, invuln: 0,
  };
  player.rig.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(player.rig.root);

  let yaw = 0, pitch = -0.1, shakeAmt = 0, hurtT = 0;
  const keys = {};
  let mouseDown = false;

  function damagePlayer(d, from) {
    if (gameState !== 'play' || player.invuln > 0) return;
    player.hp = Math.max(0, player.hp - d);
    player.invuln = 0.25;
    hurtT = 0.6;
    shake(0.3);
    Sound.hurt();
    if (from) {
      const dx = player.pos.x - from.x, dz = player.pos.z - from.z, l = Math.hypot(dx, dz) || 1;
      player.vel.x += (dx / l) * 6;
      player.vel.z += (dz / l) * 6;
    }
    if (player.hp <= 0) die();
  }

  function shake(a) { shakeAmt = Math.max(shakeAmt, a); }

  function collideTrees(p, radius) {
    for (const t of treesInBox(p.x - 3, p.z - 3, p.x + 3, p.z + 3)) {
      const dx = p.x - t.x, dz = p.z - t.z, min = radius + t.r;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-8) {
        const d = Math.sqrt(d2);
        p.x = t.x + (dx / d) * min;
        p.z = t.z + (dz / d) * min;
      }
    }
  }

  // Keeps p inside the walkable regions, south of the first closed log pile.
  function clampToLevel(p, radius) {
    const closed = barriers.find((b) => !b.open);
    if (closed && p.z < closed.z + 1.6) p.z = closed.z + 1.6;
    if (gate.isOpen && gate.anim > 0.6 && Math.abs(p.x) < 2.6 && p.z < GATE_Z + 4) {
      p.x = clamp(p.x, -2.6 + radius, 2.6 - radius);
      p.z = Math.max(p.z, GATE_Z - 8);
      return;
    }
    let bx = p.x, bz = p.z, best = Infinity;
    for (const reg of REGIONS) {
      let qx, qz;
      if (reg.r) {
        const dx = p.x - reg.x, dz = p.z - reg.z, d = Math.hypot(dx, dz), lim = reg.r - radius;
        if (d <= lim) return;
        qx = reg.x + (dx / d) * lim;
        qz = reg.z + (dz / d) * lim;
      } else {
        qx = clamp(p.x, reg.x0 + radius, reg.x1 - radius);
        qz = clamp(p.z, reg.z0 + radius, reg.z1 - radius);
        if (qx === p.x && qz === p.z) return;
      }
      const d2 = (qx - p.x) ** 2 + (qz - p.z) ** 2;
      if (d2 < best) { best = d2; bx = qx; bz = qz; }
    }
    p.x = bx;
    p.z = bz;
  }

  function updatePlayer(dt) {
    const fwd = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    const side = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    let mx = -sy * fwd + cy * side, mz = -cy * fwd - sy * side;
    const ml = Math.hypot(mx, mz);
    if (ml > 0) { mx /= ml; mz /= ml; }
    const speed = keys.ShiftLeft || keys.ShiftRight ? PLAYER.sprint : PLAYER.speed;
    const k = Math.min(1, dt * (player.onGround ? 12 : 3));
    player.vel.x += (mx * speed - player.vel.x) * k;
    player.vel.z += (mz * speed - player.vel.z) * k;
    if (keys.Space && player.onGround) {
      player.vel.y = PLAYER.jump;
      player.onGround = false;
    }
    player.vel.y -= PLAYER.gravity * dt;
    player.pos.addScaledVector(player.vel, dt);
    if (player.pos.y <= 0) {
      player.pos.y = 0;
      player.vel.y = 0;
      player.onGround = true;
    }
    collideTrees(player.pos, PLAYER.radius);
    clampToLevel(player.pos, PLAYER.radius);

    const rig = player.rig;
    rig.root.position.copy(player.pos);
    rig.root.rotation.y = yaw;
    const sp = Math.hypot(player.vel.x, player.vel.z);
    player.runPhase += sp * dt * 1.7;
    const amp = player.onGround ? Math.min(1, sp / 4) : 0.3;
    rig.legs[0].rotation.x = Math.sin(player.runPhase) * 0.9 * amp;
    rig.legs[1].rotation.x = -Math.sin(player.runPhase) * 0.9 * amp;
    rig.root.position.y += Math.abs(Math.sin(player.runPhase)) * 0.06 * amp;

    player.cooldown -= dt;
    player.invuln -= dt;
    if (player.weapon === 'bow') rig.bow.userData.setDraw(clamp(1 - player.cooldown / ARROW.cooldown, 0, 1));
    if (mouseDown && player.cooldown <= 0) fire();

    const promptEl = $('prompt');
    const text = promptText();
    promptEl.classList.toggle('show', !!text);
    if (text) promptEl.textContent = text;
  }

  function waveLeft(name) {
    return WAVES[name].total - (phase === name ? phaseKills : 0);
  }

  const BARRIER_HINTS = [
    () => `Kütükler kapalı! Önce bütün maymunları yen — kalan: ${waveLeft('monkeys')}`,
    () => `Kütükler kapalı! Önce bütün kurtları yen — kalan: ${waveLeft('wolves')}`,
    () => "Kütükler kapalı! Önce King Kong'u yen",
    () => `Kütükler kapalı! Önce bütün aslan ve kaplanları yen — kalan: ${waveLeft('cats')}`,
    () => "Kütükler kapalı! Önce T-Rex'i yen",
    () => `Kütükler kapalı! Önce bütün Fenerbahçelileri kaçır — kalan: ${waveLeft('fb')}`,
    () => `Kütükler kapalı! Önce bütün Beşiktaşlıları kaçır — kalan: ${waveLeft('bjk')}`,
  ];

  // Explains what the player can do here: take the hanging item, or why a log pile / the gate is still closed.
  function promptText() {
    if (hanging && Math.hypot(player.pos.x - hanging.pos.x, player.pos.z - hanging.pos.z) < 2.8) {
      return hanging.kind === 'rpg' ? "E — RPG-7'yi al" : 'E — Roketleri al';
    }
    const i = barriers.findIndex((b) => !b.open);
    if (i >= 0 && player.pos.z < barriers[i].z + 6) return BARRIER_HINTS[i]();
    if (!gate.isOpen && player.pos.z < GATE_Z + 8 && Math.abs(player.pos.x) < 8) return 'Kapı kapalı! Önce iki ejderhayı da yen';
    return '';
  }

  // ---------- Aiming and hit tests ----------
  const hit = { t: Infinity, kind: null, obj: null, point: new V3() };
  const segAB = new V3(), segF = new V3();

  function segSphereT(a, ab, len2, c, r) {
    segF.subVectors(a, c);
    const b = 2 * segF.dot(ab);
    const cc = segF.lengthSq() - r * r;
    if (cc < 0) return 0;
    const disc = b * b - 4 * len2 * cc;
    if (disc < 0) return -1;
    const t = (-b - Math.sqrt(disc)) / (2 * len2);
    return t >= 0 && t <= 1 ? t : -1;
  }

  function segCircleT(a, ab, cx, cz, r) {
    const fx = a.x - cx, fz = a.z - cz;
    const A = ab.x * ab.x + ab.z * ab.z;
    if (A < 1e-9) return -1;
    const B = 2 * (fx * ab.x + fz * ab.z);
    const C = fx * fx + fz * fz - r * r;
    if (C < 0) return 0;
    const disc = B * B - 4 * A * C;
    if (disc < 0) return -1;
    const t = (-B - Math.sqrt(disc)) / (2 * A);
    return t >= 0 && t <= 1 ? t : -1;
  }

  function livingBosses() {
    return bosses.filter((b) => b.state !== 'dead');
  }

  function firstHit(a, b) {
    hit.t = Infinity;
    hit.kind = null;
    hit.obj = null;
    segAB.subVectors(b, a);
    const len2 = segAB.lengthSq();
    const consider = (t, kind, obj) => {
      if (t >= 0 && t < hit.t) { hit.t = t; hit.kind = kind; hit.obj = obj; }
    };
    if (b.y <= 0 && a.y > 0) consider(a.y / (a.y - b.y), 'ground', null);
    for (const e of enemies) {
      if (e.state === 'dead' || e.state === 'flee') continue;
      for (const s of e.sph) consider(segSphereT(a, segAB, len2, s.c, s.r), 'enemy', e);
    }
    for (const boss of livingBosses()) {
      for (const s of boss.sph) consider(segSphereT(a, segAB, len2, s.c, s.r), 'boss', boss);
    }
    for (const t of treesInBox(a.x, a.z, b.x, b.z)) {
      const tt = segCircleT(a, segAB, t.x, t.z, t.r + 0.05);
      if (tt >= 0 && a.y + segAB.y * tt < t.h * 0.7) consider(tt, 'tree', t);
    }
    if (!hit.kind) return null;
    hit.point.copy(a).addScaledVector(segAB, hit.t);
    return hit;
  }

  const aimPoint = new V3();
  function computeAimPoint() {
    const dir = camera.getWorldDirection(new V3());
    const a = camera.position.clone().addScaledVector(dir, 3.8);
    const b = camera.position.clone().addScaledVector(dir, 160);
    const h = firstHit(a, b);
    return aimPoint.copy(h ? h.point : b);
  }

  // ---------- Weapons ----------
  const arrows = [], stuckArrows = [], rockets = [], rocks = [], fireballs = [], tomatoes = [];
  let bossImmuneNoticeT = 0;

  function noticeBossImmune(boss, what) {
    if (bossImmuneNoticeT > 0) return;
    toast(`${what} ${boss.title} işlemiyor!`, player.hasRpg ? 'RPG-7 kullan — [Tab] ile geç' : "Ağaçlarda asılı RPG-7'yi bul!", 2.2);
    bossImmuneNoticeT = 8;
  }

  function orientArrow(mesh, vel) {
    mesh.lookAt(segF.copy(mesh.position).add(vel));
  }

  function stick(mesh, parent) {
    if (parent) parent.attach(mesh);
    stuckArrows.push(mesh);
    if (stuckArrows.length > 70) stuckArrows.shift().removeFromParent();
  }

  function fire() {
    if (player.weapon === 'rpg') {
      if (player.rockets <= 0) {
        toast('Roket yok!', hanging ? 'Ağaçlarda yeni roketler var' : '', 1.5);
        player.cooldown = 0.6;
        return;
      }
      fireRocket(computeAimPoint());
      player.cooldown = ROCKET.cooldown;
    } else if (GUNS[player.weapon]) {
      fireGun(player.weapon);
    } else if (player.weapon === 'tomato') {
      throwTomato(computeAimPoint());
      player.cooldown = TOMATO.cooldown;
    } else {
      fireArrow(computeAimPoint());
      player.cooldown = ARROW.cooldown;
    }
  }

  const muzzlePos = new V3();
  function fireGun(id) {
    const gun = GUNS[id];
    player.ammo[id]--;
    player.cooldown = gun.cooldown;
    const dir = camera.getWorldDirection(new V3());
    dir.x += rand(-gun.spread, gun.spread);
    dir.y += rand(-gun.spread, gun.spread);
    dir.z += rand(-gun.spread, gun.spread);
    dir.normalize();
    const a = camera.position.clone().addScaledVector(dir, 3.8);
    const b = camera.position.clone().addScaledVector(dir, 160);
    const h = firstHit(a, b);
    const end = h ? h.point.clone() : b;
    player.rig.muzzle(id, muzzlePos);
    tracer(muzzlePos, end);
    addEffect(unitSphere, 0xffd060, muzzlePos, 0.06, (m, k) => {
      m.scale.setScalar(0.08 + 0.12 * k);
      m.material.opacity = 1 - k;
    });
    Sound[gun.sound]();
    shake(id === 'pistol' ? 0.12 : 0.05);
    if (h) {
      if (h.kind === 'enemy') {
        hitEnemy(h.obj, gun.damage, dir);
        emit('spark', end, 4, { speed: 3, up: 1, size: 0.05, life: 0.3 });
      } else if (h.kind === 'boss') {
        h.obj.hurt(gun.bossDamage, false);
        emit('spark', end, 4, { speed: 3, up: 1, size: 0.05, life: 0.3 });
        noticeBossImmune(h.obj, 'Mermiler');
      } else emit(h.kind === 'tree' ? 'leaf' : 'dust', end, 4, { speed: 2, up: 1.5, size: 0.06, life: 0.5 });
    }
    if (player.ammo[id] === 0) {
      toast(`${gun.name} mermisi bitti!`, 'Hayvanlardan düşen mermi kutularını topla', 2);
      nextWeapon();
    }
  }

  function throwTomato(target) {
    const start = player.rig.holders.tomato.getWorldPosition(new V3());
    const d = target.clone().sub(start);
    const t = Math.max(0.05, d.length() / TOMATO.speed);
    const vel = d.divideScalar(t);
    vel.y += 0.5 * TOMATO.gravity * t;
    const mesh = Models.tomato();
    mesh.position.copy(start);
    scene.add(mesh);
    tomatoes.push({ mesh, pos: start, vel, life: 0 });
    Sound.throwRock();
  }

  const groundSplatGeo = new THREE.CircleGeometry(0.35, 12);
  groundSplatGeo.rotateX(-Math.PI / 2);
  function updateTomatoes(dt) {
    for (let i = tomatoes.length - 1; i >= 0; i--) {
      const tm = tomatoes[i];
      tm.life += dt;
      prevPos.copy(tm.pos);
      tm.vel.y -= TOMATO.gravity * dt;
      tm.pos.addScaledVector(tm.vel, dt);
      tm.mesh.position.copy(tm.pos);
      tm.mesh.rotation.x += dt * 12;
      const h = firstHit(prevPos, tm.pos);
      if (!h && tm.life < 3) continue;
      if (h) {
        Sound.splat();
        emit('tomato', h.point, 10, { speed: 3, up: 2, size: 0.07, life: 0.6 });
        if (h.kind === 'enemy') hitEnemy(h.obj, 1, null);
        else if (h.kind === 'ground') {
          addEffect(groundSplatGeo, 0xc8150f, new V3(h.point.x, 0.03, h.point.z), 6, (m, k) => {
            m.material.opacity = k < 0.7 ? 0.9 : 0.9 * (1 - k) / 0.3;
          });
        }
      }
      tm.mesh.removeFromParent();
      tomatoes.splice(i, 1);
    }
  }

  function tracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, fog: false }));
    scene.add(line);
    effects.push({ m: line, t: 0, dur: 0.07, ownGeometry: true, update: (m, k) => { m.material.opacity = 1 - k; } });
  }

  function fireArrow(target) {
    const start = player.rig.bowHolder.getWorldPosition(new V3());
    const d = target.clone().sub(start);
    const t = Math.max(0.05, d.length() / ARROW.speed);
    const vel = d.divideScalar(t);
    vel.y += 0.5 * ARROW.gravity * t;
    const mesh = Models.arrow();
    mesh.position.copy(start);
    orientArrow(mesh, vel);
    scene.add(mesh);
    arrows.push({ mesh, pos: start, vel, life: 0 });
    Sound.twang();
  }

  const prevPos = new V3();
  function updateArrows(dt) {
    for (let i = arrows.length - 1; i >= 0; i--) {
      const a = arrows[i];
      a.life += dt;
      prevPos.copy(a.pos);
      a.vel.y -= ARROW.gravity * dt;
      a.pos.addScaledVector(a.vel, dt);
      const h = firstHit(prevPos, a.pos);
      if (h) {
        const dir = a.vel.clone().normalize();
        a.mesh.position.copy(h.point).addScaledVector(dir, 0.15);
        orientArrow(a.mesh, a.vel);
        arrows.splice(i, 1);
        if (h.kind === 'enemy') {
          hitEnemy(h.obj, ARROW.damage, dir);
          stick(a.mesh, h.obj.root);
          Sound.thunk();
        } else if (h.kind === 'boss') {
          const boss = h.obj;
          boss.hurt(ARROW.bossDamage, false);
          stick(a.mesh, boss.root);
          Sound.thunk();
          noticeBossImmune(boss, 'Oklar');
        } else {
          stick(a.mesh, null);
          Sound.wood();
          if (h.kind === 'tree') emit('leaf', h.point, 3, { speed: 2, up: 1, size: 0.06, life: 0.8 });
        }
        continue;
      }
      a.mesh.position.copy(a.pos);
      orientArrow(a.mesh, a.vel);
      if (a.life > 3) {
        a.mesh.removeFromParent();
        arrows.splice(i, 1);
      }
    }
  }

  function fireRocket(target) {
    const start = player.rig.rpgHolder.getWorldPosition(new V3());
    const dir = target.clone().sub(start).normalize();
    start.addScaledVector(dir, 1.0);
    const mesh = Models.rocket();
    mesh.position.copy(start);
    mesh.lookAt(start.clone().sub(dir));
    scene.add(mesh);
    rockets.push({ mesh, pos: start, vel: dir.multiplyScalar(ROCKET.speed), life: 0, smokeT: 0 });
    player.rockets--;
    if (player.rockets === 0) nextWeapon();
    Sound.launch();
    shake(0.2);
    emit('smoke', player.rig.rpgHolder.getWorldPosition(new V3()).addScaledVector(dir, -2.2), 10, { speed: 2, up: 0.5, gravity: -0.5, size: 0.35, life: 0.9, grow: true });
    const fight = BOSS_FIGHTS[phase];
    if (player.rockets === 0 && fight && livingBosses().length && !hanging) {
      hangItem('ammo', fight.trees());
      setTimeout(() => toast('Roketler bitti!', 'Ağaçlardan birinde yeni roketler asılı', 3), 900);
    }
  }

  function updateRockets(dt) {
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.life += dt;
      prevPos.copy(r.pos);
      r.pos.addScaledVector(r.vel, dt);
      const h = firstHit(prevPos, r.pos);
      if (h || r.life > 3) {
        explode(h ? h.point.clone() : r.pos.clone(), h);
        r.mesh.removeFromParent();
        rockets.splice(i, 1);
        continue;
      }
      r.mesh.position.copy(r.pos);
      r.smokeT -= dt;
      if (r.smokeT <= 0) {
        r.smokeT = 0.02;
        emit('smoke', r.pos, 1, { speed: 0.4, up: 0.3, gravity: -0.3, size: 0.18, life: 0.7, grow: true, spread: 0.05 });
      }
    }
  }

  function explode(p, h) {
    Sound.explosion();
    shake(clamp(1.2 - p.distanceTo(player.pos) / 40, 0.15, 1));
    fireBurst(p, 4);
    emit('fire', p, 10, { speed: 9, up: 3, size: 0.3, life: 0.5, gravity: 2 });
    emit('spark', p, 14, { speed: 14, up: 4, size: 0.08, life: 0.6 });
    emit('dust', p, 14, { speed: 7, up: 5, size: 0.18, life: 1.0 });
    if (p.y < 0.5) shockRing(new V3(p.x, 0.08, p.z), 5, 0xffd27a);

    for (const boss of livingBosses()) {
      if (h && h.obj === boss) boss.hurt(ROCKET.damage, true);
      else {
        const core = boss.sph[0];
        const d = p.distanceTo(core.c) - core.r;
        if (d < ROCKET.splash) boss.hurt(ROCKET.damage * 0.6 * (1 - Math.max(0, d) / ROCKET.splash), true);
      }
    }
    for (const e of enemies) {
      if (e.state !== 'dead' && e.pos.distanceTo(p) < ROCKET.splash + 0.5) hitEnemy(e, 10, e.pos.clone().sub(p).setY(0).normalize());
    }
    if (p.distanceTo(player.pos) < 3.5) damagePlayer(15, p);
  }

  // ---------- Enemies: monkeys, four-legged beasts and rival footballers ----------
  const enemies = [];
  const MONKEY_SPHERES = [[0, 0.75, 0, 0.42], [0, 1.2, -0.08, 0.27]];
  const BEAST_SPHERES = [[0, 0.74, 0.15, 0.42], [0, 0.8, -0.45, 0.36], [0, 0.98, -0.75, 0.25]];
  const FOOTBALLER_SPHERES = [[0, 1.05, 0, 0.36], [0, 1.72, 0, 0.2]];
  const isFootballer = (type) => type === 'fb' || type === 'bjk';

  function spawnEnemy(type, x, z, fromTree, counts) {
    const isMonkey = type === 'monkey', footy = isFootballer(type);
    const m = isMonkey ? Models.monkey() : footy ? Models.footballer(type) : Models.beast(type);
    const scale = isMonkey ? 1 : m.scale;
    const stats = isMonkey ? MONKEY : footy ? FOOTBALLER : BEASTS[type];
    m.root.position.set(x, fromTree ? 6.5 : 0, z);
    scene.add(m.root);
    const e = {
      type, m, root: m.root, pos: m.root.position, scale, stats, footy,
      state: fromTree ? 'fall' : 'chase', vy: 0, yaw: 0,
      cd: footy ? rand(...FOOTBALLER.tackleCd) : 0.6, lungeCd: rand(0.5, 1.5), lungeT: 0, lungeDir: new V3(), bit: false,
      t: Math.random() * 10, flash: 0, deadT: 0, fleeT: 0, getupT: 0, counts,
      sph: (isMonkey ? MONKEY_SPHERES : footy ? FOOTBALLER_SPHERES : BEAST_SPHERES).map(([ox, oy, oz, r]) => ({ off: new V3(ox, oy, oz).multiplyScalar(scale), c: new V3(), r: r * scale })),
    };
    e.hp = e.stats.hp;
    e.yaw = Math.atan2(-(player.pos.x - x), -(player.pos.z - z));
    updateSpheres(e);
    enemies.push(e);
    if (isMonkey) Sound.screech();
    else if (!footy) Sound.growl(e.stats.pitch);
    return e;
  }

  function updateSpheres(e) {
    for (const s of e.sph) s.c.copy(s.off).applyAxisAngle(Y_AXIS, e.yaw).add(e.pos);
  }

  function hitEnemy(e, dmg, dir) {
    if (e.state === 'dead' || e.state === 'flee') return;
    if (e.footy) {
      splatFootballer(e);
      return;
    }
    e.hp -= dmg;
    e.flash = 0.15;
    if (dir) e.pos.addScaledVector(dir.clone().setY(0), 0.35);
    if (e.hp <= 0) killEnemy(e);
    else if (e.type !== 'monkey') Sound.growl(e.stats.pitch);
  }

  // A tomato in the face: the player covers their face and runs off the pitch.
  const splatGeo = new THREE.SphereGeometry(0.13, 10, 8);
  const splatMat = Models.mat(0xd0180f);
  function splatFootballer(e) {
    e.state = 'flee';
    e.fleeT = 0;
    const blob = new THREE.Mesh(splatGeo, splatMat);
    blob.position.set(0, 0.2, -0.12);
    blob.scale.set(1.2, 1, 0.45);
    e.m.head.add(blob);
    Sound.ouch();
    if (e.counts) phaseKills++;
    if (Math.random() < 0.25) dropPickup('banana', e.pos.x, e.pos.z);
  }

  function killEnemy(e) {
    e.state = 'dead';
    e.deadT = 0;
    e.pos.y = 0;
    if (e.type === 'monkey') Sound.monkeyDie();
    else Sound.beastDie(e.stats.pitch);
    if (e.counts) phaseKills++;
    if (e.type === 'monkey') {
      if (Math.random() < 0.4) dropPickup('banana', e.pos.x, e.pos.z);
    } else if (Math.random() < e.stats.drop) dropPickup('medkit', e.pos.x, e.pos.z);
    if (Math.random() < AMMO_DROP) dropPickup('ammo', e.pos.x + 0.8, e.pos.z);
  }

  function removeEnemy(e, poof) {
    if (poof) emit('poof', e.pos.clone().setY(0.7), 12, { speed: 3, up: 1.5, size: 0.25, gravity: -0.5, life: 0.7, grow: true });
    e.root.removeFromParent();
    enemies.splice(enemies.indexOf(e), 1);
  }

  function updateEnemy(e, dt) {
    e.t += dt;
    if (e.flash > 0) e.flash -= dt;
    for (const fm of e.m.flashMats) fm.emissive.setHex(e.flash > 0 ? 0x990000 : 0);

    if (e.state === 'dead') {
      e.deadT += dt;
      e.m.body.rotation.z = Math.min(1, e.deadT / 0.3) * 1.5;
      e.m.body.position.y = Math.min(1, e.deadT / 0.3) * 0.25;
      if (e.deadT > 2.2) e.pos.y -= dt * 0.8;
      if (e.deadT > 3.2) removeEnemy(e, true);
      return;
    }

    if (e.footy) {
      updateFootballer(e, dt);
      return;
    }

    const s = e.stats;
    const dx = player.pos.x - e.pos.x, dz = player.pos.z - e.pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    let speed = 0;
    e.cd -= dt;
    e.lungeCd -= dt;

    if (e.state === 'fall') {
      e.vy -= 22 * dt;
      e.pos.y += e.vy * dt;
      if (e.pos.y <= 0) {
        e.pos.y = 0;
        e.state = 'chase';
        emit('leaf', e.pos.clone().setY(0.3), 6, { speed: 2, up: 2, size: 0.07 });
      }
    } else if (e.type === 'monkey') {
      if (dist > s.reach) speed = s.speed;
      else if (e.cd <= 0) {
        damagePlayer(s.damage, e.pos);
        e.cd = s.attackCd;
        Sound.screech();
      }
    } else if (e.state === 'lunge') {
      e.lungeT -= dt;
      e.pos.addScaledVector(e.lungeDir, s.lungeSpeed * dt);
      if (!e.bit && dist < s.reach + 0.3) {
        damagePlayer(s.damage, e.pos);
        e.bit = true;
      }
      if (e.lungeT <= 0) e.state = 'chase';
    } else if (dist < s.lungeRange && dist > 2.2 && e.lungeCd <= 0) {
      e.state = 'lunge';
      e.lungeT = 0.35;
      e.lungeDir.set(dx / dist, 0, dz / dist);
      e.bit = false;
      e.lungeCd = rand(1.8, 2.6);
      Sound.growl(s.pitch);
    } else if (dist > s.reach) speed = s.speed;
    else if (e.cd <= 0) {
      damagePlayer(s.damage, e.pos);
      e.cd = s.attackCd;
    }

    if (speed > 0) {
      const wobble = e.type === 'monkey' ? Math.sin(e.t * 5) * 0.45 : 0;
      const nx = dx / dist, nz = dz / dist;
      e.pos.x += (nx - nz * wobble) * speed * dt;
      e.pos.z += (nz + nx * wobble) * speed * dt;
    }
    e.yaw = e.state === 'lunge' ? Math.atan2(-e.lungeDir.x, -e.lungeDir.z) : Math.atan2(-dx, -dz);
    e.root.rotation.y = e.yaw;

    for (const o of enemies) {
      if (o === e || o.state === 'dead') continue;
      const ox = e.pos.x - o.pos.x, oz = e.pos.z - o.pos.z, d = Math.hypot(ox, oz);
      const min = 0.5 * (e.scale + o.scale);
      if (d < min && d > 1e-4) {
        e.pos.x += (ox / d) * (min - d) * 0.5;
        e.pos.z += (oz / d) * (min - d) * 0.5;
      }
    }
    if (e.state !== 'fall') {
      collideTrees(e.pos, 0.45 * e.scale);
      clampToLevel(e.pos, 0.45 * e.scale);
    }
    updateSpheres(e);
    animateEnemy(e, speed > 0 || e.state === 'lunge', dist);
  }

  // Footballers run at the player and slide-tackle; once hit by a tomato they flee and leave.
  function updateFootballer(e, dt) {
    const s = FOOTBALLER, m = e.m;
    const dx = player.pos.x - e.pos.x, dz = player.pos.z - e.pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    let mx = 0, mz = 0, speed = 0;
    e.cd -= dt;
    m.body.rotation.x = 0;

    if (e.state === 'flee') {
      e.fleeT += dt;
      mx = -dx / dist;
      mz = -dz / dist;
      speed = s.speed * 1.3;
      if (e.fleeT > s.fleeTime) {
        removeEnemy(e, true);
        return;
      }
    } else if (e.state === 'tackle') {
      e.lungeT -= dt;
      e.pos.addScaledVector(e.lungeDir, s.tackleSpeed * dt);
      m.body.rotation.x = 1.1;
      if (!e.bit && dist < 1.6) {
        e.bit = true;
        damagePlayer(s.damage, e.pos);
        Sound.thunk();
      }
      if (e.lungeT <= 0) {
        e.state = 'getup';
        e.getupT = 0.6;
      }
    } else if (e.state === 'getup') {
      e.getupT -= dt;
      m.body.rotation.x = 1.1 * Math.max(0, e.getupT / 0.6);
      if (e.getupT <= 0) e.state = 'chase';
    } else if (dist < s.tackleRange && dist > 1.5 && e.cd <= 0) {
      e.state = 'tackle';
      e.lungeT = 0.45;
      e.lungeDir.set(dx / dist, 0, dz / dist);
      e.bit = false;
      e.cd = rand(...s.tackleCd);
    } else if (dist > 1.2) {
      mx = dx / dist;
      mz = dz / dist;
      speed = s.speed;
    }

    if (speed > 0) {
      e.pos.x += mx * speed * dt;
      e.pos.z += mz * speed * dt;
      e.yaw = Math.atan2(-mx, -mz);
    } else if (e.state === 'tackle') e.yaw = Math.atan2(-e.lungeDir.x, -e.lungeDir.z);
    e.root.rotation.y = e.yaw;

    const p = e.t * 12, a = speed > 0 ? 0.9 : 0;
    m.legs[0].rotation.x = Math.sin(p) * a;
    m.legs[1].rotation.x = -Math.sin(p) * a;
    if (e.state === 'flee') {
      m.arms[0].rotation.set(2.7, 0, 0.5);
      m.arms[1].rotation.set(2.7, 0, -0.5);
    } else {
      m.arms[0].rotation.set(-Math.sin(p) * a, 0, 0);
      m.arms[1].rotation.set(Math.sin(p) * a, 0, 0);
    }

    for (const o of enemies) {
      if (o === e || o.state === 'dead') continue;
      const ox = e.pos.x - o.pos.x, oz = e.pos.z - o.pos.z, d = Math.hypot(ox, oz);
      if (d < 0.9 && d > 1e-4) {
        e.pos.x += (ox / d) * (0.9 - d) * 0.5;
        e.pos.z += (oz / d) * (0.9 - d) * 0.5;
      }
    }
    collideTrees(e.pos, 0.4);
    clampToLevel(e.pos, 0.4);
    updateSpheres(e);
  }

  function animateEnemy(e, moving, dist) {
    const m = e.m;
    if (e.type === 'monkey') {
      const p = e.t * 13;
      if (e.state === 'fall') {
        m.arms[0].rotation.x = m.arms[1].rotation.x = Math.PI * 0.9;
        return;
      }
      const attacking = dist < MONKEY.reach + 0.3;
      m.legs[0].rotation.x = moving ? Math.sin(p) * 0.9 : 0;
      m.legs[1].rotation.x = moving ? -Math.sin(p) * 0.9 : 0;
      m.arms[0].rotation.x = attacking ? 2.2 + Math.sin(e.t * 16) * 0.6 : -Math.sin(p) * 1.1;
      m.arms[1].rotation.x = attacking ? 2.2 - Math.sin(e.t * 16) * 0.6 : Math.sin(p) * 1.1;
      m.body.position.y = moving ? Math.abs(Math.sin(p)) * 0.18 : 0;
    } else {
      const p = e.t * (e.state === 'lunge' ? 22 : 15) / e.scale;
      const a = moving ? 0.7 : 0;
      m.legs[0].rotation.x = Math.sin(p) * a;
      m.legs[1].rotation.x = Math.sin(p + 0.4) * a;
      m.legs[2].rotation.x = Math.sin(p + Math.PI) * a;
      m.legs[3].rotation.x = Math.sin(p + Math.PI + 0.4) * a;
      m.body.position.y = moving ? Math.abs(Math.sin(p)) * 0.08 : 0;
      m.head.rotation.x = e.state === 'lunge' ? -0.3 : 0;
      m.tail.rotation.x = 2.3 + Math.sin(e.t * 9) * 0.2;
    }
  }

  // ---------- Pickups ----------
  const pickups = [];
  function dropPickup(kind, x, z) {
    const mesh = { banana: Models.banana, medkit: Models.medkit, ammo: Models.ammoBox }[kind]();
    mesh.position.set(x, 0.45, z);
    scene.add(mesh);
    pickups.push({ kind, mesh, t: 0 });
  }

  function updatePickups(dt) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.t += dt;
      p.mesh.rotation.y += dt * 2;
      p.mesh.position.y = 0.45 + Math.sin(p.t * 3) * 0.1;
      const d = Math.hypot(player.pos.x - p.mesh.position.x, player.pos.z - p.mesh.position.z);
      if (d < 1.3 && p.kind === 'ammo') {
        player.ammo.ak += GUNS.ak.box;
        player.ammo.pistol += GUNS.pistol.box;
        Sound.pickup();
        toast(`+${GUNS.ak.box} AK-47 · +${GUNS.pistol.box} Smith & Wesson mermisi`, '', 1.4);
      } else if (d < 1.3 && p.kind !== 'ammo' && player.hp < PLAYER.maxHp) {
        player.hp = Math.min(PLAYER.maxHp, player.hp + HEAL[p.kind]);
        Sound.eat();
        toast(`+${HEAL[p.kind]} can${p.kind === 'banana' ? ' 🍌' : ''}`, '', 1.0);
      } else if (p.t < 40) continue;
      p.mesh.removeFromParent();
      pickups.splice(i, 1);
    }
  }

  // The RPG-7 (or a rocket bag) hangs from a branch of one of the big trees around a boss clearing.
  let hanging = null, lastHangTree = null;

  function hangItem(kind, treeRing) {
    if (hanging) hanging.group.removeFromParent();
    const choices = treeRing.filter((t) => t !== lastHangTree);
    const tree = choices[Math.floor(Math.random() * choices.length)];
    lastHangTree = tree;
    const g = new THREE.Group();
    g.position.copy(tree.hang);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 4), Models.mat(0xcbb38a));
    rope.position.y = -0.35;
    g.add(rope);
    const item = kind === 'rpg' ? Models.rpg() : Models.rocketBag();
    if (kind === 'rpg') {
      item.rotation.x = Math.PI / 2;
      item.position.y = -1.0;
    } else item.position.y = -0.95;
    g.add(item);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(g);
    hanging = { kind, group: g, pos: tree.hang, t: 0 };
  }

  function takeHanging() {
    if (!hanging || Math.hypot(player.pos.x - hanging.pos.x, player.pos.z - hanging.pos.z) >= 2.8) return;
    if (hanging.kind === 'rpg') {
      player.hasRpg = true;
      player.rockets = Math.max(player.rockets, ROCKET.startAmmo);
      toast('RPG-7 senin!', 'Şimdi vur! Silah değiştirmek için [Tab]', 3);
    } else {
      player.rockets += ROCKET.bagAmmo;
      toast(`+${ROCKET.bagAmmo} roket`, '', 1.6);
    }
    setWeapon('rpg');
    Sound.pickup();
    hanging.group.removeFromParent();
    hanging = null;
  }

  function weaponReady(w) {
    if (w === 'rpg') return player.hasRpg && player.rockets > 0;
    return w === 'bow' || player.ammo[w] > 0;
  }

  // The derby waves only allow tomatoes.
  function weaponLocked() {
    return !!(WAVES[phase] && WAVES[phase].weapon);
  }

  function nextWeapon() {
    if (weaponLocked()) return;
    const i = WEAPON_ORDER.indexOf(player.weapon);
    for (let k = 1; k < WEAPON_ORDER.length; k++) {
      const w = WEAPON_ORDER[(i + k) % WEAPON_ORDER.length];
      if (weaponReady(w)) {
        setWeapon(w);
        return;
      }
    }
  }

  function setWeapon(w) {
    if (w === 'rpg' && !player.hasRpg) return;
    if (GUNS[w] && !weaponReady(w)) return;
    player.weapon = w;
    player.rig.pose(w);
    $('crosshair').classList.toggle('rpg', w === 'rpg');
  }

  // ---------- Bosses ----------
  // A boss has: title, name, phase, hp, maxHp, state, root, sph (sph[0] is the core used for splash),
  // hurt(dmg, heavy) and update(dt).
  const bosses = [];
  let kong = null;

  function setState(b, s) {
    b.state = s;
    b.stateT = 0;
  }

  function bossDown(b, title) {
    setState(b, 'dead');
    bossDeadT = 0;
    for (const e of enemies.slice()) if (e.state !== 'dead') removeEnemy(e, true);
    toast(title, '', 2.5);
  }

  function faceToward(b, tx, tz, dt, rate) {
    const target = Math.atan2(-tx, -tz);
    const diff = Math.atan2(Math.sin(target - b.yaw), Math.cos(target - b.yaw));
    b.yaw += diff * Math.min(1, dt * rate);
    b.root.rotation.y = b.yaw;
  }

  function clampInto(p, area, margin) {
    const dx = p.x - area.x, dz = p.z - area.z, d = Math.hypot(dx, dz), lim = area.r - margin;
    if (d > lim) {
      p.x = area.x + (dx / d) * lim;
      p.z = area.z + (dz / d) * lim;
    }
  }

  // ----- King Kong -----
  function spawnKong() {
    const m = Models.gorilla();
    const S = KONG.height / Models.GORILLA_HEIGHT;
    m.root.scale.setScalar(S);
    m.root.rotation.order = 'YXZ';
    m.root.position.set(ARENA.x, 0, ARENA.z - 28);
    m.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(m.root);
    kong = {
      title: "King Kong'a", name: 'KING KONG', phase: 'kong', update: updateKong, m, root: m.root, pos: m.root.position,
      hp: KONG.hp, maxHp: KONG.hp, state: 'intro', stateT: 0, t: 0, yaw: 0, flash: 0,
      throwCd: 4, beatCd: 12, slamCenter: new V3(),
      sph: [[0, 1.05, 0, 0.58], [0, 0.3, 0, 0.42], [0, 1.7, -0.12, 0.3]].map(([x, y, z, r]) => ({ off: new V3(x, y, z).multiplyScalar(S), c: new V3(), r: r * S })),
      hurt(d, heavy) {
        if (this.state === 'dead') return;
        this.hp = Math.max(0, this.hp - d);
        this.flash = heavy ? 0.3 : 0.08;
        if (this.hp <= 0) {
          bossDown(this, 'King Kong yıkılıyor!');
          Sound.roar();
        } else if (heavy) {
          setState(this, 'stagger');
          Sound.roar();
        }
      },
    };
    updateSpheres(kong);
    bosses.push(kong);
    Sound.roar();
    setTimeout(() => Sound.chestBeat(), 600);
  }

  function updateKong(dt) {
    const b = kong, m = b.m;
    b.t += dt;
    b.stateT += dt;
    if (b.flash > 0) b.flash -= dt;
    for (const fm of m.flashMats) fm.emissive.setHex(b.flash > 0 ? 0x880000 : 0);
    const dx = player.pos.x - b.pos.x, dz = player.pos.z - b.pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const armX = (l, r, k = 10) => {
      m.arms[0].rotation.x += (l - m.arms[0].rotation.x) * Math.min(1, dt * k);
      m.arms[1].rotation.x += (r - m.arms[1].rotation.x) * Math.min(1, dt * k);
    };
    m.arms[0].rotation.z = m.arms[1].rotation.z = 0;
    m.mouth.scale.y = 1;
    m.torso.rotation.x = 0;

    switch (b.state) {
      case 'intro':
      case 'beat': {
        faceToward(b, dx, dz, dt, 3);
        const s = Math.sin(b.t * 18);
        m.arms[0].rotation.set(1.6 + s * 0.35, 0, 0.55);
        m.arms[1].rotation.set(1.6 - s * 0.35, 0, -0.55);
        m.mouth.scale.y = 3;
        if (b.stateT > (b.state === 'intro' ? 3 : 1.7)) {
          setState(b, 'chase');
          b.beatCd = rand(10, 14);
        }
        break;
      }
      case 'chase': {
        faceToward(b, dx, dz, dt, 4);
        if (dist > 4.5) {
          b.pos.x += (dx / dist) * KONG.speed * dt;
          b.pos.z += (dz / dist) * KONG.speed * dt;
        }
        const p = b.t * 4;
        m.legs[0].rotation.x = Math.sin(p) * 0.45;
        m.legs[1].rotation.x = -Math.sin(p) * 0.45;
        armX(0.35 - Math.sin(p) * 0.4, 0.35 + Math.sin(p) * 0.4);
        b.pos.y = Math.abs(Math.sin(p)) * 0.12;
        b.throwCd -= dt;
        b.beatCd -= dt;
        if (dist < 5.5) {
          setState(b, 'slamWind');
          Sound.growl();
        } else if (dist > 12 && b.throwCd <= 0) setState(b, 'throwWind');
        else if (b.beatCd <= 0) {
          setState(b, 'beat');
          Sound.roar();
          Sound.chestBeat();
        }
        break;
      }
      case 'slamWind':
        faceToward(b, dx, dz, dt, 2);
        armX(Math.PI * 0.95, Math.PI * 0.95, 6);
        m.mouth.scale.y = 2.5;
        if (b.stateT > 0.9) kongSlam();
        break;
      case 'throwWind':
        faceToward(b, dx, dz, dt, 5);
        armX(0.3, -2.5, 8);
        if (b.stateT > 0.8) kongThrow();
        break;
      case 'recover':
        armX(0.55, 0.55, 14);
        if (b.stateT > 0.9) setState(b, 'chase');
        break;
      case 'stagger':
        m.torso.rotation.x = 0.3 * Math.sin(Math.min(1, b.stateT / 0.7) * Math.PI);
        m.mouth.scale.y = 3;
        armX(1.2, 1.2, 8);
        if (b.stateT > 0.7) setState(b, 'chase');
        break;
      case 'dead': {
        const k = Math.min(1, b.stateT / 1.8);
        b.root.rotation.x = k * k * 1.45;
        b.pos.y = 0;
        if (b.stateT > 1.8 && !b.landed) {
          b.landed = true;
          Sound.slam();
          shake(0.9);
          emit('dust', b.pos.clone().setY(0.3), 40, { speed: 8, up: 3, spread: 3, size: 0.4, life: 1.4 });
        }
        break;
      }
    }
    if (b.state !== 'dead') {
      clampInto(b.pos, ARENA, 3);
      updateSpheres(b);
    }
  }

  function kongSlam() {
    const b = kong;
    const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw);
    b.slamCenter.set(b.pos.x + fx * 3, 0.1, b.pos.z + fz * 3);
    Sound.slam();
    shake(0.9);
    shockRing(b.slamCenter, KONG.slamRadius, 0xe8d3a8);
    emit('dust', b.slamCenter, 30, { speed: 9, up: 3, spread: 1.5, size: 0.35, life: 1.0 });
    emit('rock', b.slamCenter, 10, { speed: 6, up: 6, size: 0.18, life: 1.2 });
    const d = Math.hypot(player.pos.x - b.slamCenter.x, player.pos.z - b.slamCenter.z);
    if (d < KONG.slamRadius && player.pos.y < 0.6) {
      damagePlayer(KONG.slamDamage, b.slamCenter);
      player.vel.y = 5;
      player.onGround = false;
    }
    setState(b, 'recover');
  }

  const rockGeo = new THREE.DodecahedronGeometry(0.6, 0);
  function kongThrow() {
    const b = kong;
    const hand = b.m.arms[1].localToWorld(new V3(0, -1.04, 0));
    const target = player.pos.clone().add(new V3(player.vel.x * 0.5, 1, player.vel.z * 0.5));
    const T = clamp(hand.distanceTo(target) / 20, 0.8, 2.2);
    const g = 9.81;
    const vel = new V3((target.x - hand.x) / T, (target.y - hand.y + 0.5 * g * T * T) / T, (target.z - hand.z) / T);
    const mesh = new THREE.Mesh(rockGeo, PMAT.rock);
    mesh.position.copy(hand);
    mesh.castShadow = true;
    scene.add(mesh);
    rocks.push({ mesh, vel, spin: new V3(rand(-5, 5), rand(-5, 5), 0) });
    Sound.throwRock();
    setState(b, 'recover');
  }

  function updateRocks(dt) {
    for (let i = rocks.length - 1; i >= 0; i--) {
      const r = rocks[i];
      r.vel.y -= 9.81 * dt;
      r.mesh.position.addScaledVector(r.vel, dt);
      r.mesh.rotation.x += r.spin.x * dt;
      r.mesh.rotation.y += r.spin.y * dt;
      const p = r.mesh.position;
      const dPlayer = Math.hypot(p.x - player.pos.x, p.y - (player.pos.y + 1), p.z - player.pos.z);
      if (dPlayer < 1.3 || p.y < 0.5) {
        if (dPlayer < 1.3) damagePlayer(KONG.rockDamage, p);
        else if (Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < 2.2) damagePlayer(KONG.rockDamage / 2, p);
        Sound.thunk();
        emit('rock', p, 10, { speed: 5, up: 3, size: 0.2, life: 1.0 });
        emit('dust', p, 8, { speed: 3, up: 1, size: 0.3, life: 0.8 });
        r.mesh.removeFromParent();
        rocks.splice(i, 1);
      }
    }
  }

  // ----- T-Rex: chases, bites up close and charges from afar -----
  function spawnTrex() {
    const m = Models.trex();
    m.root.rotation.order = 'YXZ';
    m.root.position.set(LAIR.x, 0, LAIR.z - 30);
    m.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(m.root);
    const rex = {
      title: "T-Rex'e", name: 'T-REX', phase: 'trex', update: updateTrex, m, root: m.root, pos: m.root.position,
      hp: TREX.hp, maxHp: TREX.hp, state: 'intro', stateT: 0, t: 0, yaw: 0, flash: 0,
      chargeCd: 5, roarCd: 12, chargeDir: new V3(), bitThis: false,
      sph: [[0, 3.7, 0, 2.2], [0, 5.2, -4.0, 1.1], [0, 1.6, 0.3, 1.2], [0, 3.4, 3.8, 1.0]].map(([x, y, z, r]) => ({ off: new V3(x, y, z), c: new V3(), r })),
      hurt(d, heavy) {
        if (this.state === 'dead') return;
        this.hp = Math.max(0, this.hp - d);
        this.flash = heavy ? 0.3 : 0.08;
        if (this.hp <= 0) {
          bossDown(this, 'T-Rex yıkılıyor!');
          Sound.roar(0.8);
        } else if (heavy && this.state !== 'charge') {
          setState(this, 'stagger');
          Sound.roar(0.8);
        }
      },
    };
    updateSpheres(rex);
    bosses.push(rex);
    Sound.roar(0.8);
  }

  function updateTrex(dt) {
    const b = this, m = b.m;
    b.t += dt;
    b.stateT += dt;
    if (b.flash > 0) b.flash -= dt;
    for (const fm of m.flashMats) fm.emissive.setHex(b.flash > 0 ? 0x880000 : 0);
    const dx = player.pos.x - b.pos.x, dz = player.pos.z - b.pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const walk = (rate, amp) => {
      const p = b.t * rate;
      m.legs[0].rotation.x = Math.sin(p) * amp;
      m.legs[1].rotation.x = -Math.sin(p) * amp;
      m.body.position.y = Math.abs(Math.sin(p)) * 0.15;
    };
    const jaw = (open, k = 10) => { m.jaw.rotation.x += (open - m.jaw.rotation.x) * Math.min(1, dt * k); };
    m.tail.forEach((s, i) => { s.rotation.y = Math.sin(b.t * 2.5 - i * 0.5) * 0.12; });
    m.head.rotation.x = 0;
    m.body.rotation.x = 0;

    switch (b.state) {
      case 'intro':
      case 'roar':
        faceToward(b, dx, dz, dt, 3);
        m.head.rotation.x = 0.35;
        jaw(0.7);
        if (b.stateT > 2.2) {
          setState(b, 'chase');
          b.roarCd = rand(11, 15);
        }
        break;
      case 'chase':
        faceToward(b, dx, dz, dt, 3);
        jaw(0.1);
        if (dist > TREX.biteRange - 1) {
          b.pos.x += (dx / dist) * TREX.speed * dt;
          b.pos.z += (dz / dist) * TREX.speed * dt;
          walk(4, 0.5);
        }
        b.chargeCd -= dt;
        b.roarCd -= dt;
        if (dist < TREX.biteRange) setState(b, 'bite');
        else if (dist > 14 && b.chargeCd <= 0) {
          setState(b, 'chargeWind');
          Sound.roar(0.8);
        } else if (b.roarCd <= 0) {
          setState(b, 'roar');
          Sound.roar(0.8);
        }
        break;
      case 'bite':
        faceToward(b, dx, dz, dt, 4);
        if (b.stateT < 0.5) {
          m.head.rotation.x = 0.4;
          jaw(0.8);
        } else {
          m.head.rotation.x = -0.25;
          jaw(0, 25);
          if (!b.bitThis && dist < TREX.biteRange + 1) {
            b.bitThis = true;
            damagePlayer(TREX.biteDamage, b.pos);
            Sound.thunk();
          }
        }
        if (b.stateT > 1.1) {
          b.bitThis = false;
          setState(b, 'chase');
        }
        break;
      case 'chargeWind':
        faceToward(b, dx, dz, dt, 5);
        m.head.rotation.x = -0.2;
        jaw(0.5);
        walk(10, 0.15);
        if (b.stateT > 0.9) {
          b.chargeDir.set(dx / dist, 0, dz / dist);
          b.bitThis = false;
          setState(b, 'charge');
        }
        break;
      case 'charge': {
        b.pos.addScaledVector(b.chargeDir, TREX.chargeSpeed * dt);
        m.head.rotation.x = -0.3;
        jaw(0.6);
        walk(9, 0.7);
        if (!b.bitThis && dist < 3.5) {
          b.bitThis = true;
          damagePlayer(TREX.chargeDamage, b.pos);
        }
        const edge = Math.hypot(b.pos.x - LAIR.x, b.pos.z - LAIR.z) > LAIR.r - 6;
        if (b.stateT > 1.6 || edge) {
          setState(b, 'recover');
          b.chargeCd = rand(5, 8);
          if (edge) {
            Sound.slam();
            shake(0.5);
          }
        }
        break;
      }
      case 'recover':
        jaw(0.2);
        if (b.stateT > 1.0) setState(b, 'chase');
        break;
      case 'stagger':
        m.body.rotation.x = 0.15 * Math.sin(Math.min(1, b.stateT / 0.6) * Math.PI);
        jaw(0.8);
        if (b.stateT > 0.6) setState(b, 'chase');
        break;
      case 'dead': {
        const k = Math.min(1, b.stateT / 1.6);
        b.root.rotation.z = k * k * 1.45;
        jaw(0.8);
        if (k >= 1 && !b.landed) {
          b.landed = true;
          Sound.slam();
          shake(1);
          emit('dust', b.pos.clone().setY(0.3), 50, { speed: 10, up: 3, spread: 4, size: 0.45, life: 1.5 });
        }
        break;
      }
    }
    if (b.state !== 'dead') {
      clampInto(b.pos, LAIR, 5);
      updateSpheres(b);
    }
  }

  // ----- Dragons: circle the final clearing spitting fireballs, then land to breathe fire -----
  const DRAGON_RIDERS = {
    fb: { name: 'SARI-LACİVERT EJDERHA', orbitA: -Math.PI / 2, flyTime: DRAGON.flyTime, pitch: 1.4 },
    bjk: { name: 'SİYAH-BEYAZ EJDERHA', orbitA: Math.PI / 2, flyTime: DRAGON.flyTime + 8, pitch: 1.1 },
  };

  function spawnDragon(palette) {
    const o = DRAGON_RIDERS[palette];
    const m = Models.dragon(palette);
    m.root.rotation.order = 'YXZ';
    m.root.position.set(FINAL.x + Math.cos(o.orbitA) * 60, 28, FINAL.z + Math.sin(o.orbitA) * 60);
    m.root.traverse((x) => { if (x.isMesh) x.castShadow = true; });
    scene.add(m.root);
    const d = {
      title: 'Ejderhaya', name: o.name, phase: 'dragons', update: updateDragon, m, root: m.root, pos: m.root.position,
      hp: DRAGON.hp, maxHp: DRAGON.hp, state: 'intro', stateT: 0, t: 0, yaw: 0, flash: 0, vy: 0,
      orbitA: o.orbitA, flyTime: o.flyTime, pitch: o.pitch, fireCd: 3, breathCd: 1, breathTick: 0, groundT: 0, jawT: 0,
      landFrom: new V3(), landTo: new V3(),
      sph: [[0, 2.4, 0, 1.8], [0, 3.6, -2.8, 0.8], [0, 4.4, -3.7, 0.9], [0, 2.3, 2.9, 0.8]].map(([x, y, z, r]) => ({ off: new V3(x, y, z), c: new V3(), r })),
      hurt(dmg, heavy) {
        if (this.state === 'dead') return;
        this.hp = Math.max(0, this.hp - dmg);
        this.flash = heavy ? 0.3 : 0.08;
        if (this.hp <= 0) {
          bossDown(this, `${o.name} düşüyor!`);
          this.vy = 0;
          Sound.roar(this.pitch);
        } else if (heavy) {
          Sound.roar(this.pitch);
          if (this.state === 'ground' || this.state === 'breath') setState(this, 'stagger');
        }
      },
    };
    updateSpheres(d);
    bosses.push(d);
    Sound.roar(o.pitch);
  }

  function dragonFireball(d) {
    const from = d.m.mouth.getWorldPosition(new V3());
    const target = player.pos.clone().add(new V3(player.vel.x * 0.6, 1, player.vel.z * 0.6));
    const vel = target.sub(from).normalize().multiplyScalar(DRAGON.fireballSpeed);
    const mesh = new THREE.Mesh(unitSphere, PMAT.flame);
    mesh.scale.setScalar(0.5);
    mesh.position.copy(from);
    scene.add(mesh);
    fireballs.push({ mesh, vel, life: 0, trailT: 0 });
    d.jawT = 0.35;
    Sound.fireball();
  }

  function updateFireballs(dt) {
    for (let i = fireballs.length - 1; i >= 0; i--) {
      const f = fireballs[i];
      f.life += dt;
      f.mesh.position.addScaledVector(f.vel, dt);
      const p = f.mesh.position;
      f.trailT -= dt;
      if (f.trailT <= 0) {
        f.trailT = 0.03;
        emit('fire', p, 2, { speed: 1, up: 0.5, gravity: -1, size: 0.25, life: 0.4, spread: 0.2 });
      }
      const dPlayer = Math.hypot(p.x - player.pos.x, p.y - (player.pos.y + 1), p.z - player.pos.z);
      if (dPlayer < 1.4 || p.y < 0.3 || f.life > 4) {
        if (dPlayer < 1.4) damagePlayer(DRAGON.fireballDamage, p);
        else if (p.y < 0.3 && Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < 2.5) damagePlayer(8, p);
        if (f.life <= 4) {
          fireBurst(p, 2.2);
          Sound.thunk();
        }
        f.mesh.removeFromParent();
        fireballs.splice(i, 1);
      }
    }
  }

  const mouthPos = new V3(), breathDir = new V3();
  function updateDragon(dt) {
    const d = this, m = d.m;
    d.t += dt;
    d.stateT += dt;
    if (d.flash > 0) d.flash -= dt;
    for (const fm of m.flashMats) fm.emissive.setHex(d.flash > 0 ? 0x880000 : 0);
    const dx = player.pos.x - d.pos.x, dz = player.pos.z - d.pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const flap = (speed, amp, lift = 0) => {
      const a = Math.sin(d.t * speed) * amp + lift;
      m.wings[1].rotation.z = a;
      m.wings[0].rotation.z = -a;
    };
    const fold = () => {
      m.wings[1].rotation.z += (0.55 - m.wings[1].rotation.z) * Math.min(1, dt * 4);
      m.wings[0].rotation.z = -m.wings[1].rotation.z;
    };
    m.tail.forEach((s, i) => { s.rotation.y = Math.sin(d.t * 2 - i * 0.6) * 0.18; });
    d.jawT -= dt;
    m.jaw.rotation.x = d.jawT > 0 ? 0.5 : 0;
    m.body.rotation.x = 0;
    if (d.state !== 'dead') m.root.rotation.z = 0;

    switch (d.state) {
      case 'intro':
      case 'fly': {
        d.orbitA += dt * DRAGON.orbitSpeed;
        const tx = FINAL.x + Math.cos(d.orbitA) * DRAGON.orbitR, tz = FINAL.z + Math.sin(d.orbitA) * DRAGON.orbitR;
        const ty = DRAGON.flyHeight + Math.sin(d.t * 0.8) * 1.5;
        const k = Math.min(1, dt * (d.state === 'intro' ? 0.8 : 1.5));
        d.pos.x += (tx - d.pos.x) * k;
        d.pos.y += (ty - d.pos.y) * k;
        d.pos.z += (tz - d.pos.z) * k;
        faceToward(d, -Math.sin(d.orbitA), Math.cos(d.orbitA), dt, 3);
        m.root.rotation.z = -0.25;
        flap(4.5, 0.75);
        if (d.state === 'intro') {
          if (d.stateT > 4) setState(d, 'fly');
          break;
        }
        d.fireCd -= dt;
        if (d.fireCd <= 0) {
          dragonFireball(d);
          d.fireCd = rand(2.2, 3.6);
        }
        if (d.stateT > d.flyTime) {
          setState(d, 'land');
          d.flyTime = DRAGON.flyTime;
          d.landFrom.copy(d.pos);
          const awayX = d.pos.x - player.pos.x, awayZ = d.pos.z - player.pos.z, l = Math.hypot(awayX, awayZ) || 1;
          d.landTo.set(player.pos.x + (awayX / l) * 14, 0, player.pos.z + (awayZ / l) * 14);
          clampInto(d.landTo, FINAL, 8);
          Sound.flap();
        }
        break;
      }
      case 'land': {
        const k = Math.min(1, d.stateT / 2.2), e = smooth(k);
        d.pos.set(lerp(d.landFrom.x, d.landTo.x, e), lerp(d.landFrom.y, 0, e), lerp(d.landFrom.z, d.landTo.z, e));
        faceToward(d, dx, dz, dt, 3);
        flap(6, 0.8 * (1 - k) + 0.3);
        if (k >= 1) {
          setState(d, 'ground');
          d.groundT = 0;
          Sound.slam();
          shake(0.7);
          emit('dust', d.pos.clone().setY(0.3), 30, { speed: 8, up: 2, spread: 3, size: 0.4, life: 1.2 });
        }
        break;
      }
      case 'ground':
      case 'breath': {
        d.groundT += dt;
        fold();
        faceToward(d, dx, dz, dt, d.state === 'breath' ? 1.2 : 2.5);
        if (d.state === 'ground') {
          if (dist > 11) {
            d.pos.x += (dx / dist) * 3 * dt;
            d.pos.z += (dz / dist) * 3 * dt;
            const p = d.t * 5;
            m.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(p + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.35; });
          }
          d.breathCd -= dt;
          if (d.breathCd <= 0 && dist < DRAGON.breathRange + 3) {
            setState(d, 'breath');
            Sound.breath();
          } else if (d.groundT > DRAGON.groundTime) {
            setState(d, 'takeoff');
            Sound.flap();
          }
        } else {
          m.jaw.rotation.x = 0.6;
          m.mouth.getWorldPosition(mouthPos);
          breathDir.set(-Math.sin(d.yaw), -0.25, -Math.cos(d.yaw));
          emit('flame', mouthPos, 3, { speed: 2, up: 0, gravity: -1, size: 0.35, life: 0.7, spread: 0.2, push: breathDir.clone().multiplyScalar(17) });
          emit('fire', mouthPos, 2, { speed: 2, up: 0, gravity: -1, size: 0.25, life: 0.6, spread: 0.2, push: breathDir.clone().multiplyScalar(15) });
          d.breathTick -= dt;
          if (d.breathTick <= 0) {
            d.breathTick = 0.25;
            const px = player.pos.x - mouthPos.x, pz = player.pos.z - mouthPos.z, pd = Math.hypot(px, pz) || 0.001;
            const cos = (px * breathDir.x + pz * breathDir.z) / (pd * Math.hypot(breathDir.x, breathDir.z));
            if (pd < DRAGON.breathRange && cos > Math.cos(0.45)) damagePlayer(DRAGON.breathDamage, mouthPos);
          }
          if (d.stateT > 1.6) {
            setState(d, 'ground');
            d.breathCd = rand(2.5, 4);
          }
        }
        break;
      }
      case 'stagger':
        d.groundT += dt;
        m.body.rotation.x = 0.25 * Math.sin(Math.min(1, d.stateT / 0.6) * Math.PI);
        m.jaw.rotation.x = 0.6;
        if (d.stateT > 0.6) setState(d, 'ground');
        break;
      case 'takeoff': {
        const k = Math.min(1, d.stateT / 1.6);
        d.pos.y = DRAGON.flyHeight * smooth(k);
        flap(7, 0.8);
        if (k >= 1) {
          d.orbitA = Math.atan2(d.pos.z - FINAL.z, d.pos.x - FINAL.x);
          setState(d, 'fly');
        }
        break;
      }
      case 'dead':
        m.jaw.rotation.x = 0.6;
        if (d.pos.y > 0) {
          d.vy -= 15 * dt;
          d.pos.y = Math.max(0, d.pos.y + d.vy * dt);
          flap(9, 0.5);
        } else {
          m.root.rotation.z += (1.3 - m.root.rotation.z) * Math.min(1, dt * 3);
          if (!d.landed) {
            d.landed = true;
            Sound.slam();
            shake(1);
            emit('dust', d.pos.clone().setY(0.3), 50, { speed: 10, up: 3, spread: 4, size: 0.45, life: 1.5 });
          }
        }
        break;
    }
    if (d.state !== 'dead') {
      clampInto(d.pos, FINAL, 6);
      updateSpheres(d);
    }
  }

  // ---------- Phases ----------
  let gameState = 'menu'; // menu | play | paused | dead | finale | won
  // monkeys | wolves | toArena | kong | cats | toLair | trex | fb | bjk | toFinal | dragons | escape
  let phase = 'monkeys';
  let phaseKills = 0, phaseSpawned = 0, spawnTimer = 0, minionTimer = 0, bossDeadT = 0, rpgHintT = 0, runTime = 0, runFrom = 0;

  function reachCheckpoint(i) {
    save.checkpoint = Math.max(save.checkpoint, i);
    writeSave();
  }

  function setPhase(p) {
    phase = p;
    phaseKills = 0;
    phaseSpawned = 0;
    spawnTimer = 1.5;
    // Hand the player the right weapon: the wave's weapon (bow by default), RPG-7 for boss fights.
    if (WAVES[p]) setWeapon(WAVES[p].weapon || 'bow');
    else if (BOSS_FIGHTS[p] && weaponReady('rpg')) setWeapon('rpg');
    else if (player.weapon === 'tomato') setWeapon('bow');
    switch (p) {
      case 'monkeys':
        toast('Vahşi maymunlar!', 'Hepsini okla vur — yol ancak o zaman açılır', 3.5);
        break;
      case 'wolves':
        barriers[0].openUp();
        reachCheckpoint(1);
        Sound.howl();
        toast('Kurtlar geliyor!', 'Devrik ağaçlar kalktı — ilerle', 3);
        break;
      case 'toArena':
        barriers[1].openUp();
        toast('Yol açıldı!', 'Ormanın derinliklerine ilerle...', 3);
        break;
      case 'kong':
        spawnKong();
        if (!player.hasRpg) hangItem('rpg', arenaTrees);
        reachCheckpoint(2);
        minionTimer = BOSS_FIGHTS.kong.interval;
        rpgHintT = 0;
        toast('KING KONG!', "Oklar ona işlemez — ağaçlarda asılı RPG-7'yi bul!", 4);
        break;
      case 'cats':
        barriers[2].openUp();
        reachCheckpoint(3);
        Sound.roar(0.7);
        toast('Aslanlar ve kaplanlar!', 'King Kong\'un ardındaki yol açıldı — hepsini yen', 3.5);
        break;
      case 'toLair':
        barriers[3].openUp();
        toast('Yol açıldı!', "T-Rex'in yuvasına ilerle...", 3);
        break;
      case 'trex':
        spawnTrex();
        hangItem(player.hasRpg ? 'ammo' : 'rpg', lairTrees);
        reachCheckpoint(4);
        minionTimer = BOSS_FIGHTS.trex.interval;
        toast('T-REX!', 'Derisine ok ve mermi işlemez — RPG-7 ile vur! Ağaçlarda roket var', 4);
        break;
      case 'fb':
        barriers[4].openUp();
        reachCheckpoint(5);
        Sound.whistle();
        toast('Fenerbahçe futbolcuları geliyor!', 'Domates at — yiyen sahadan kaçar!', 3.5);
        break;
      case 'bjk':
        barriers[5].openUp();
        reachCheckpoint(6);
        Sound.whistle();
        toast('Beşiktaş futbolcuları geliyor!', 'Domatesleri hazırla!', 3.5);
        break;
      case 'toFinal':
        barriers[6].openUp();
        toast('Yol açıldı!', 'Son meydana ilerle...', 3);
        break;
      case 'dragons':
        spawnDragon('fb');
        spawnDragon('bjk');
        hangItem(player.hasRpg ? 'ammo' : 'rpg', finalTrees);
        reachCheckpoint(7);
        minionTimer = BOSS_FIGHTS.dragons.interval;
        toast('İKİ EJDERHA!', 'Sarı-lacivert ve siyah-beyaz ejderhalar — RPG-7 ile vur! Ağaçlarda roket var', 4.5);
        break;
      case 'escape':
        gate.open();
        toast('Ejderhalar yenildi!', 'Ormanın son kapısı açıldı — çık!', 4);
        break;
    }
    buildBossBars();
  }

  function spawnAhead(type, zMin, zMax) {
    let z = player.pos.z - rand(14, 38);
    if (z < zMin) z = player.pos.z + rand(12, 22);
    z = clamp(z, zMin, zMax);
    const x = type === 'monkey' || isFootballer(type) ? rand(-12, 12) : (Math.random() < 0.5 ? -1 : 1) * (C1.x1 - 1);
    spawnEnemy(type, x, z, type === 'monkey', true);
    phaseSpawned++;
  }

  function aliveCount(minionsOnly) {
    let n = 0;
    for (const e of enemies) if (e.state !== 'dead' && (!minionsOnly || !e.counts)) n++;
    return n;
  }

  function updatePhase(dt) {
    spawnTimer -= dt;
    const wave = WAVES[phase];
    if (wave) {
      if (spawnTimer <= 0 && phaseSpawned < wave.total && aliveCount() < wave.maxAlive) {
        spawnAhead(wave.types[phaseSpawned % wave.types.length], wave.zMin, wave.zMax);
        spawnTimer = rand(wave.interval[0], wave.interval[1]);
      }
      if (phaseKills >= wave.total) setPhase(wave.next);
      return;
    }
    if (phase === 'toArena') {
      if (player.pos.z < -312) setPhase('kong');
    } else if (phase === 'toLair') {
      if (player.pos.z < -575) setPhase('trex');
    } else if (phase === 'toFinal') {
      if (player.pos.z < -945) setPhase('dragons');
    } else if (phase === 'escape') {
      if (player.pos.z < GATE_Z - 1.5) startFinale();
    } else {
      const fight = BOSS_FIGHTS[phase];
      if (phaseBosses().every((b) => b.state === 'dead')) {
        bossDeadT += dt;
        if (bossDeadT > 3) setPhase(fight.next);
        return;
      }
      minionTimer -= dt;
      if (minionTimer <= 0 && aliveCount(true) < fight.maxAlive) {
        minionTimer = fight.interval;
        const area = fight.area;
        let a = Math.random() * Math.PI * 2;
        if (Math.hypot(area.x + Math.cos(a) * (area.r - 4) - player.pos.x, area.z + Math.sin(a) * (area.r - 4) - player.pos.z) < 15) a += Math.PI;
        const type = fight.minions[Math.floor(Math.random() * fight.minions.length)];
        spawnEnemy(type, area.x + Math.cos(a) * (area.r - 4), area.z + Math.sin(a) * (area.r - 4), false, false);
      }
      if (phase === 'kong' && !player.hasRpg) {
        rpgHintT += dt;
        if (rpgHintT > 50) {
          rpgHintT = -999;
          toast('İpucu', 'Büyük ağaçların dallarına bak!', 3);
        }
      }
    }
  }

  // ---------- HUD ----------
  let toastT = 0;
  function toast(title, sub, time = 2.5) {
    const el = $('toast');
    el.innerHTML = title + (sub ? `<small>${sub}</small>` : '');
    el.classList.add('show');
    toastT = time;
  }

  function objectiveText() {
    switch (phase) {
      case 'monkeys': return `🐒 Maymunlar: ${phaseKills} / ${WAVES.monkeys.total}`;
      case 'wolves': return `🐺 Kurtlar: ${phaseKills} / ${WAVES.wolves.total}`;
      case 'toArena': return '🌲 Ormanın derinliklerine ilerle';
      case 'kong': return player.hasRpg ? "🦍 King Kong'u RPG-7 ile vur!" : "🔎 Ağaçlarda asılı RPG-7'yi bul!";
      case 'cats': return `🦁 Aslan ve kaplanlar: ${phaseKills} / ${WAVES.cats.total}`;
      case 'toLair': return "🦖 T-Rex'in yuvasına ilerle";
      case 'trex': return bossObjective("🦖 T-Rex'i RPG-7 ile vur!");
      case 'fb': return `🍅 Kaçan Fenerbahçeliler: ${phaseKills} / ${WAVES.fb.total}`;
      case 'bjk': return `🍅 Kaçan Beşiktaşlılar: ${phaseKills} / ${WAVES.bjk.total}`;
      case 'toFinal': return '⚔️ Son meydana ilerle';
      case 'dragons': return bossObjective('🐉 İki ejderhayı da RPG-7 ile vur!');
      default: return '🚪 Kapıdan çık!';
    }
  }

  function bossObjective(text) {
    if (!player.hasRpg) return "🔎 Ağaçlarda asılı RPG-7'yi bul!";
    return player.rockets > 0 ? text : '🔎 Ağaçlarda roket ara!';
  }

  function phaseBosses() {
    return bosses.filter((b) => b.phase === phase);
  }

  // One health bar per boss of the current fight.
  function buildBossBars() {
    $('bosses').innerHTML = phaseBosses()
      .map((b) => `<div class="boss-bar"><div class="label">${b.name}</div><div class="bar"><div class="fill"></div></div></div>`)
      .join('');
  }

  function weaponLabel() {
    const w = player.weapon;
    if (w === 'rpg') return `🚀 RPG-7 × ${player.rockets}`;
    if (GUNS[w]) return `🔫 ${GUNS[w].name} × ${player.ammo[w]}`;
    if (w === 'tomato') return '🍅 Domates × ∞';
    return '🏹 Yay × ∞';
  }

  function updateHud(dt) {
    $('hp-fill').style.width = `${(player.hp / PLAYER.maxHp) * 100}%`;
    const lowHp = player.hp < PLAYER.maxHp * 0.3;
    $('hp').classList.toggle('low', lowHp);
    $('objective').textContent = objectiveText();
    const fills = $('bosses').querySelectorAll('.fill');
    phaseBosses().forEach((b, i) => { if (fills[i]) fills[i].style.width = `${(b.hp / b.maxHp) * 100}%`; });
    $('weapon').innerHTML = weaponLabel() + `<small>${weaponLocked() ? 'bu maçta sadece domates' : '[Tab] sonraki silah'}</small>`;
    if (toastT > 0) {
      toastT -= dt;
      if (toastT <= 0) $('toast').classList.remove('show');
    }
    hurtT = Math.max(0, hurtT - dt);
    $('hurt').style.opacity = Math.min(1, hurtT * 1.6 + (lowHp ? 0.25 : 0));
    bossImmuneNoticeT -= dt;
  }

  // ---------- Camera ----------
  const camFwd = new V3(), camPivot = new V3();
  function updateCamera() {
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const sy = Math.sin(yaw), cy = Math.cos(yaw);
    camFwd.set(-sy * cp, sp, -cy * cp);
    camPivot.set(player.pos.x + cy * 0.75, player.pos.y + 1.65, player.pos.z - sy * 0.75);
    camera.position.copy(camPivot).addScaledVector(camFwd, -3.6);
    camera.position.y = Math.max(camera.position.y, 0.4);
    camera.lookAt(camPivot.x + camFwd.x * 20, camPivot.y + camFwd.y * 20, camPivot.z + camFwd.z * 20);
    if (shakeAmt > 0) {
      camera.position.x += (Math.random() - 0.5) * shakeAmt * 0.5;
      camera.position.y += (Math.random() - 0.5) * shakeAmt * 0.5;
    }
  }

  // ---------- Game flow ----------
  function clearList(list) {
    for (const o of list) (o.mesh || o.root || o).removeFromParent();
    list.length = 0;
  }

  function resetWorld() {
    clearList(enemies);
    clearList(arrows);
    clearList(stuckArrows);
    clearList(rockets);
    clearList(rocks);
    clearList(fireballs);
    clearList(tomatoes);
    clearList(pickups);
    for (const p of particles) {
      scene.remove(p.m);
      particlePool.push(p.m);
    }
    particles.length = 0;
    for (const b of bosses) b.root.removeFromParent();
    bosses.length = 0;
    kong = null;
    if (hanging) hanging.group.removeFromParent();
    hanging = null;
    lastHangTree = null;
  }

  function startRun(checkpoint) {
    resetWorld();
    leaveStadium();
    const cp = CHECKPOINTS[checkpoint];
    const armed = checkpoint >= 3;
    Object.assign(player, { hp: PLAYER.maxHp, hasRpg: armed, rockets: armed ? ROCKET.startAmmo : 0, cooldown: 0.3, invuln: 0, onGround: true });
    player.ammo = { ak: GUNS.ak.start, pistol: GUNS.pistol.start };
    player.vel.set(0, 0, 0);
    setWeapon('bow');
    barriers.forEach((b, i) => b.set(i < cp.open));
    gate.set(false);
    player.pos.set(0, 0, cp.z);
    yaw = 0;
    pitch = -0.1;
    runTime = 0;
    runFrom = checkpoint;
    setPhase(cp.phase);
    for (const id of ['menu', 'pause', 'dead', 'win']) $(id).classList.add('hidden');
    $('hud').classList.remove('hidden');
    $('fade').style.opacity = 0;
    gameState = 'play';
    lockPointer();
  }

  function die() {
    gameState = 'dead';
    mouseDown = false;
    $('prompt').classList.remove('show');
    $('dead-text').textContent = `Kaldığın yerden devam edeceksin: ${CHECKPOINTS[save.checkpoint].name}`;
    $('dead').classList.remove('hidden');
    document.exitPointerLock();
  }

  function pause() {
    if (gameState !== 'play') return;
    gameState = 'paused';
    mouseDown = false;
    for (const k in keys) keys[k] = false;
    $('pause').classList.remove('hidden');
  }

  function resume() {
    $('pause').classList.add('hidden');
    gameState = 'play';
    lockPointer();
  }

  function showMenu() {
    resetWorld();
    leaveStadium();
    gameState = 'menu';
    for (const id of ['pause', 'dead', 'win', 'hud']) $(id).classList.add('hidden');
    $('menu').classList.remove('hidden');
    $('fade').style.opacity = 0;
    barriers.forEach((b) => b.set(false));
    gate.set(false);
    player.pos.set(0, 0, -3);
    player.rig.root.position.copy(player.pos);
    player.rig.root.rotation.set(0, 0, 0);
    setWeapon('bow');
    refreshMenu();
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function refreshMenu() {
    const cont = $('btn-continue');
    cont.classList.toggle('hidden', save.checkpoint === 0);
    cont.textContent = `Devam et: ${CHECKPOINTS[save.checkpoint].name}`;
    $('opt-sound').checked = save.settings.sound;
    $('opt-sens').value = save.settings.sens;
    const lines = [`Kazanılan oyun: <b>${save.wins}</b>`];
    if (save.bestTime) lines.push(`En hızlı kurtuluş: <b>${fmtTime(save.bestTime)}</b>`);
    $('stats').innerHTML = lines.join('<br>');
  }

  function fmtTime(s) {
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  }

  // ---------- Finale: RAMS Park ----------
  let finaleT = 0;
  function startFinale() {
    gameState = 'finale';
    finaleT = 0;
    mouseDown = false;
    $('prompt').classList.remove('show');
    save.wins++;
    if (runFrom === 0 && (!save.bestTime || runTime < save.bestTime)) save.bestTime = runTime;
    save.checkpoint = 0;
    writeSave();
    $('win-text').innerHTML = `Bu bölümün süresi: <b>${fmtTime(runTime)}</b> · Toplam zafer: <b>${save.wins}</b>`;
  }

  function leaveStadium() {
    Sound.musicStop();
    if (!stadiumActive) return;
    stadiumActive = false;
    scene.add(player.rig.root);
    player.rig.root.scale.setScalar(1);
  }

  function updateFinale(dt) {
    finaleT += dt;
    const fade = $('fade');
    if (!stadiumActive) {
      player.pos.z -= dt * 5;
      player.rig.root.position.copy(player.pos);
      updateCamera();
      fade.style.opacity = Math.min(1, finaleT / 0.9);
      if (finaleT > 1.0) {
        stadiumActive = true;
        $('hud').classList.add('hidden');
        stadium.enter(player.rig);
        Sound.musicStart();
        finaleT = 0;
      }
      return;
    }
    fade.style.opacity = Math.max(0, 1 - finaleT / 1.2);
    stadium.update(dt, camera);
    if (gameState === 'finale' && finaleT > 6) {
      gameState = 'won';
      $('win').classList.remove('hidden');
      document.exitPointerLock();
    }
  }

  // ---------- Menu backdrop ----------
  let menuT = 0;
  function updateMenu(dt) {
    menuT += dt;
    const a = menuT * 0.25;
    camera.position.set(Math.sin(a) * 4.5, 2.1 + Math.sin(menuT * 0.4) * 0.3, -3 + Math.cos(a) * 4.5);
    camera.lookAt(0, 1.3, -3);
    player.rig.legs[0].rotation.x = player.rig.legs[1].rotation.x = 0;
    player.rig.bow.userData.setDraw(0.5 + Math.sin(menuT * 1.5) * 0.5);
  }

  // ---------- Main loop ----------
  function updatePlay(dt) {
    runTime += dt;
    updatePlayer(dt);
    updatePhase(dt);
    for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i]) updateEnemy(enemies[i], dt);
    for (const b of bosses) b.update(dt);
    updateArrows(dt);
    updateRockets(dt);
    updateRocks(dt);
    updateFireballs(dt);
    updateTomatoes(dt);
    updatePickups(dt);
    if (hanging) {
      hanging.t += dt;
      hanging.group.rotation.z = Math.sin(hanging.t * 1.3) * 0.08;
    }
    for (const b of barriers) b.update(dt);
    gate.update(dt);
    updateCamera();
    updateHud(dt);
  }

  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (gameState === 'play') updatePlay(dt);
    else if (gameState === 'menu') updateMenu(dt);
    else if (gameState === 'finale' || gameState === 'won') updateFinale(dt);
    if (gameState !== 'paused') {
      updateParticles(dt);
      updateEffects(dt);
      shakeAmt = Math.max(0, shakeAmt - dt * 1.8);
    }
    sun.position.set(player.pos.x + 25, 45, player.pos.z + 15);
    sun.target.position.set(player.pos.x, 0, player.pos.z - 10);
    renderer.render(stadiumActive ? stadium.scene : scene, camera);
  }

  // ---------- Input ----------
  function lockPointer() {
    try {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* pointer lock unavailable */ }
  }

  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== canvas && gameState === 'play') pause();
  });

  canvas.addEventListener('mousedown', (e) => {
    Sound.ensure();
    if (gameState !== 'play') return;
    if (document.pointerLockElement !== canvas) lockPointer();
    if (e.button === 0) mouseDown = true;
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('mousemove', (e) => {
    // Without pointer lock (e.g. an embedded preview) the mouse still steers while it moves over the page.
    if (gameState !== 'play') return;
    const s = 0.0022 * save.settings.sens;
    yaw -= e.movementX * s;
    pitch = clamp(pitch - e.movementY * s, -1.0, 0.75);
  });

  window.addEventListener('wheel', () => {
    if (gameState === 'play') nextWeapon();
  });

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault();
    if (gameState === 'play') {
      const digit = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
      if (e.code === 'KeyE') takeHanging();
      else if (e.code === 'Tab' && !e.repeat) nextWeapon();
      else if (digit >= 0 && !weaponLocked()) setWeapon(WEAPON_ORDER[digit]);
      else if (e.code === 'KeyP') {
        document.exitPointerLock();
        pause();
      }
    } else if (e.code === 'Enter') {
      const overlay = ['menu', 'pause', 'dead', 'win'].map($).find((el) => !el.classList.contains('hidden'));
      if (overlay) overlay.querySelector('button:not(.hidden)').click();
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
    mouseDown = false;
  });

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  function onButton(id, fn) {
    $(id).addEventListener('click', (e) => {
      Sound.ensure();
      e.currentTarget.blur();
      fn();
    });
  }
  onButton('btn-new', () => {
    save.checkpoint = 0;
    writeSave();
    startRun(0);
  });
  onButton('btn-continue', () => startRun(save.checkpoint));
  onButton('btn-resume', resume);
  onButton('btn-quit', showMenu);
  onButton('btn-retry', () => startRun(save.checkpoint));
  onButton('btn-dead-menu', showMenu);
  onButton('btn-again', () => startRun(0));
  onButton('btn-win-menu', showMenu);
  $('opt-sound').addEventListener('change', (e) => {
    save.settings.sound = e.target.checked;
    Sound.setEnabled(save.settings.sound);
    writeSave();
  });
  $('opt-sens').addEventListener('input', (e) => {
    save.settings.sens = parseFloat(e.target.value);
    writeSave();
  });

  // ---------- Boot ----------
  loadSave();
  Sound.setEnabled(save.settings.sound);
  showMenu();
  frame();
})();
