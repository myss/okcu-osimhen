(function () {
  'use strict';

  const V3 = THREE.Vector3;
  const { clamp, lerp, randFloat: rand } = THREE.MathUtils;
  const $ = (id) => document.getElementById(id);
  const Y_AXIS = new V3(0, 1, 0);

  // ---------- Tuning ----------
  const PLAYER = { speed: 6, sprint: 9.5, jump: 8, gravity: 18, radius: 0.4, maxHp: 100 };
  const ARROW = { speed: 75, gravity: 6, cooldown: 0.45, damage: 1, bossDamage: 0.5 };
  const ROCKET = { speed: 45, cooldown: 1.6, damage: 25, splash: 4.5, startAmmo: 5, bagAmmo: 3 };
  const MONKEY = { total: 12, maxAlive: 4, hp: 1, speed: 5.2, damage: 7, attackCd: 1.0, reach: 1.3 };
  const WOLF = { total: 10, maxAlive: 4, hp: 2, speed: 7.2, lungeSpeed: 15, damage: 11, attackCd: 1.2, reach: 1.5 };
  const BOSS = { hp: 100, height: 5.4, speed: 4.2, slamDamage: 35, slamRadius: 6, rockDamage: 20 };
  const MINIONS = { maxAlive: 3, interval: 7 };
  const LEVEL = { corridorHalf: 14, barrier1: -150, barrier2: -300, gateZ: -398 };
  const ARENA = { x: 0, z: -350, r: 47 };
  const PHASE_NAMES = ['Maymunlar', 'Kurtlar', 'King Kong'];

  // ---------- Save data (browser localStorage) ----------
  const SAVE_KEY = 'osimhenOrman.v1';
  const save = { checkpoint: 0, wins: 0, bestTime: 0, settings: { sound: true, sens: 1 } };

  function loadSave() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (d) {
        Object.assign(save, d);
        save.settings = Object.assign({ sound: true, sens: 1 }, d.settings);
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
    new THREE.PlaneGeometry(600, 900),
    new THREE.MeshLambertMaterial({ map: repeatTexture(256, 150, 225, (g, s) => speckle(g, s, '#4b7430', 7000, [70, 40], 40, [18, 22])) })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -220;
  ground.receiveShadow = true;
  scene.add(ground);

  const dirtTex = (rx, ry) => repeatTexture(256, rx, ry, (g, s) => speckle(g, s, '#7a6243', 5000, [25, 15], 35, [25, 25]));
  const pathGeo = new THREE.PlaneGeometry(5, 312, 2, 80);
  pathGeo.rotateX(-Math.PI / 2);
  pathGeo.translate(0, 0, -150);
  {
    const p = pathGeo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + Math.sin(p.getZ(i) * 0.045) * 3.5);
  }
  const groundOverlay = (geo, map) => {
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  groundOverlay(pathGeo, dirtTex(1.5, 90));
  const clearing = new THREE.CircleGeometry(ARENA.r + 2, 64);
  clearing.rotateX(-Math.PI / 2);
  clearing.translate(ARENA.x, 0, ARENA.z);
  groundOverlay(clearing, repeatTexture(256, 24, 24, (g, s) => speckle(g, s, '#6b6a3a', 6000, [35, 40], 35, [20, 25])));

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

  function inPlayArea(x, z, margin) {
    if (z > -306 && z < 6 && Math.abs(x) < LEVEL.corridorHalf + margin) return true;
    if (Math.hypot(x - ARENA.x, z - ARENA.z) < ARENA.r + margin) return true;
    return Math.abs(x) < 5 + margin && z < LEVEL.gateZ + 2 && z > LEVEL.gateZ - 14;
  }

  for (let i = 0; i < 3000; i++) {
    const x = rr(-120, 120), z = rr(-490, 55);
    if (inPlayArea(x, z, 1.2)) continue;
    addTree(x, z, rr(0.8, 1.5), rng() < 0.25 ? 'pine' : 'oak');
  }
  for (let i = 0; i < 34; i++) {
    const x = rr(-11, 11), z = rr(-295, -12);
    if (Math.abs(z - LEVEL.barrier1) < 7 || Math.abs(x) < 2.5) continue;
    addTree(x, z, rr(0.9, 1.3), 'oak');
  }

  // Big arena trees: one of them hides the RPG-7 on a branch.
  const bigTrees = [];
  for (const deg of [5, 35, 62, 118, 145, 175, 205, 235, 305, 335]) {
    const a = THREE.MathUtils.degToRad(deg + rr(-6, 6));
    const r = rr(30, 40);
    const t = addTree(ARENA.x + Math.cos(a) * r, ARENA.z + Math.sin(a) * r, 1.7, 'oak');
    const toCenter = new V3(ARENA.x - t.x, 0, ARENA.z - t.z).normalize();
    t.hang = new V3(t.x, 3.5, t.z).addScaledVector(toCenter, 2.3);
    bigTrees.push(t);
  }

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
    for (const t of bigTrees) {
      const dx = t.hang.x - t.x, dz = t.hang.z - t.z;
      const len = Math.hypot(dx, dz) + 0.4;
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, len, 6), bark);
      branch.position.set(t.x + dx / 2, t.hang.y + 0.15, t.z + dz / 2);
      branch.quaternion.setFromUnitVectors(Y_AXIS, new V3(dx, 0.35, dz).normalize());
      branch.castShadow = true;
      scene.add(branch);
    }
  }

  // Bushes for ground detail (no collision)
  {
    const bushGeo = new THREE.IcosahedronGeometry(1, 0);
    const bushes = new THREE.InstancedMesh(bushGeo, Models.mat(0xffffff, { flatShading: true }), 500);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new V3(), sc = new V3(), col = new THREE.Color();
    let n = 0;
    for (let i = 0; i < 2000 && n < 500; i++) {
      const x = rr(-40, 40), z = rr(-420, 20);
      const inside = inPlayArea(x, z, -1);
      if (inside && rng() < 0.85) continue;
      if (Math.abs(x) < 4 && z > -306) continue;
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
    g.position.set(0, 0, LEVEL.gateZ);
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
        const e = this.anim * this.anim * (3 - 2 * this.anim);
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

  const barriers = [makeBarrier(LEVEL.barrier1), makeBarrier(LEVEL.barrier2)];
  const gate = makeGate();

  // ---------- Particles and transient effects ----------
  const particleGeo = new THREE.IcosahedronGeometry(1, 0);
  const PMAT = {
    fire: new THREE.MeshBasicMaterial({ color: 0xffa62b }),
    spark: new THREE.MeshBasicMaterial({ color: 0xffe45c }),
    smoke: Models.mat(0x8f8f8f),
    dark: Models.mat(0x3a3a3a),
    dust: Models.mat(0x8c7556),
    rock: Models.mat(0x77736c, { flatShading: true }),
    poof: Models.mat(0xe6e6e6),
    leaf: Models.mat(0x4f8a34),
  };
  const particles = [], particlePool = [];

  function emit(kind, pos, count, o = {}) {
    const { speed = 4, up = 2, life = 0.8, size = 0.15, gravity = 9.8, grow = false, spread = 0.2 } = o;
    for (let i = 0; i < count && particles.length < 500; i++) {
      const m = particlePool.pop() || new THREE.Mesh(particleGeo);
      m.material = PMAT[kind];
      m.position.set(pos.x + rand(-spread, spread), pos.y + rand(-spread, spread) * 0.5, pos.z + rand(-spread, spread));
      m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
      const vel = new V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(speed * rand(0.3, 1));
      vel.y += up;
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

  // ---------- Player ----------
  const player = {
    rig: Models.player(),
    pos: new V3(), vel: new V3(), onGround: true,
    hp: PLAYER.maxHp, weapon: 'bow', hasRpg: false, rockets: 0,
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

  function clampToLevel(p, radius) {
    if (p.z > 3) p.z = 3;
    if (!barriers[0].open && p.z < LEVEL.barrier1 + 1.6) p.z = LEVEL.barrier1 + 1.6;
    if (!barriers[1].open && p.z < LEVEL.barrier2 + 1.6) p.z = LEVEL.barrier2 + 1.6;
    const dx = p.x - ARENA.x, dz = p.z - ARENA.z, d = Math.hypot(dx, dz);
    const lim = ARENA.r - radius;
    if (p.z > -306) {
      if (d > lim) p.x = clamp(p.x, -LEVEL.corridorHalf + radius, LEVEL.corridorHalf - radius);
    } else if (gate.isOpen && gate.anim > 0.6 && Math.abs(p.x) < 2.6 && p.z < LEVEL.gateZ + 4) {
      p.x = clamp(p.x, -2.6 + radius, 2.6 - radius);
      p.z = Math.max(p.z, LEVEL.gateZ - 8);
    } else if (d > lim) {
      p.x = ARENA.x + (dx / d) * lim;
      p.z = ARENA.z + (dz / d) * lim;
    }
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

  // Explains what the player can do here: take the hanging item, or why a log pile / the gate is still closed.
  function promptText() {
    if (hanging && Math.hypot(player.pos.x - hanging.pos.x, player.pos.z - hanging.pos.z) < 2.8) {
      return hanging.kind === 'rpg' ? "E — RPG-7'yi al" : 'E — Roketleri al';
    }
    if (!barriers[0].open && player.pos.z < LEVEL.barrier1 + 6) {
      return `Kütükler kapalı! Önce bütün maymunları yen — kalan: ${MONKEY.total - phaseKills}`;
    }
    if (!barriers[1].open && player.pos.z < LEVEL.barrier2 + 6) {
      return `Kütükler kapalı! Önce bütün kurtları yen — kalan: ${WOLF.total - phaseKills}`;
    }
    if (!gate.isOpen && player.pos.z < LEVEL.gateZ + 8 && Math.abs(player.pos.x) < 8) {
      return "Kapı kapalı! Önce King Kong'u yen";
    }
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
      if (e.state === 'dead') continue;
      for (const s of e.sph) consider(segSphereT(a, segAB, len2, s.c, s.r), 'enemy', e);
    }
    if (boss && boss.state !== 'dead') {
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
  const arrows = [], stuckArrows = [], rockets = [], rocks = [];
  let arrowBossNoticeT = 0;

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
    } else {
      fireArrow(computeAimPoint());
      player.cooldown = ARROW.cooldown;
    }
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
          damageBoss(ARROW.bossDamage, false);
          stick(a.mesh, boss.root);
          Sound.thunk();
          if (arrowBossNoticeT <= 0) {
            toast("Oklar King Kong'a işlemiyor!", player.hasRpg ? 'RPG-7 kullan — [2] tuşu' : "Ağaçlarda asılı RPG-7'yi bul!", 2.2);
            arrowBossNoticeT = 8;
          }
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
    Sound.launch();
    shake(0.2);
    emit('smoke', player.rig.rpgHolder.getWorldPosition(new V3()).addScaledVector(dir, -2.2), 10, { speed: 2, up: 0.5, gravity: -0.5, size: 0.35, life: 0.9, grow: true });
    if (player.rockets === 0 && boss && boss.state !== 'dead' && !hanging) {
      hangItem('ammo');
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
    addEffect(unitSphere, 0xffb347, p, 0.45, (m, k) => {
      m.scale.setScalar(0.4 + 4 * k);
      m.material.opacity = 0.95 * (1 - k);
    });
    emit('fire', p, 26, { speed: 9, up: 3, size: 0.3, life: 0.5, gravity: 2 });
    emit('spark', p, 14, { speed: 14, up: 4, size: 0.08, life: 0.6 });
    emit('smoke', p, 16, { speed: 3, up: 2.5, size: 0.7, life: 1.6, gravity: -0.6, grow: true, spread: 0.8 });
    emit('dust', p, 14, { speed: 7, up: 5, size: 0.18, life: 1.0 });
    if (p.y < 0.5) shockRing(new V3(p.x, 0.08, p.z), 5, 0xffd27a);

    if (boss && boss.state !== 'dead') {
      if (h && h.kind === 'boss') damageBoss(ROCKET.damage, true);
      else {
        const torso = boss.sph[1];
        const d = p.distanceTo(torso.c) - torso.r;
        if (d < ROCKET.splash) damageBoss(ROCKET.damage * 0.6 * (1 - Math.max(0, d) / ROCKET.splash), true);
      }
    }
    for (const e of enemies) {
      if (e.state !== 'dead' && e.pos.distanceTo(p) < ROCKET.splash + 0.5) hitEnemy(e, 10, e.pos.clone().sub(p).setY(0).normalize());
    }
    if (p.distanceTo(player.pos) < 3.5) damagePlayer(15, p);
  }

  // ---------- Enemies: monkeys and wolves ----------
  const enemies = [];
  const HIT_SPHERES = {
    monkey: [[0, 0.75, 0, 0.42], [0, 1.2, -0.08, 0.27]],
    wolf: [[0, 0.74, 0.15, 0.42], [0, 0.8, -0.45, 0.36], [0, 0.98, -0.75, 0.25]],
  };

  function spawnEnemy(type, x, z, fromTree, counts) {
    const m = type === 'monkey' ? Models.monkey() : Models.wolf();
    m.root.position.set(x, fromTree ? 6.5 : 0, z);
    scene.add(m.root);
    const e = {
      type, m, root: m.root, pos: m.root.position,
      hp: type === 'monkey' ? MONKEY.hp : WOLF.hp,
      state: fromTree ? 'fall' : 'chase', vy: 0, yaw: 0,
      cd: 0.6, lungeCd: rand(0.5, 1.5), lungeT: 0, lungeDir: new V3(), bit: false,
      t: Math.random() * 10, flash: 0, deadT: 0, counts,
      sph: HIT_SPHERES[type].map(([ox, oy, oz, r]) => ({ off: new V3(ox, oy, oz), c: new V3(), r })),
    };
    e.yaw = Math.atan2(-(player.pos.x - x), -(player.pos.z - z));
    updateSpheres(e);
    enemies.push(e);
    if (type === 'monkey') Sound.screech();
    else Sound.growl();
    return e;
  }

  function updateSpheres(e, scale = 1) {
    for (const s of e.sph) s.c.copy(s.off).multiplyScalar(scale).applyAxisAngle(Y_AXIS, e.yaw).add(e.pos);
  }

  function hitEnemy(e, dmg, dir) {
    if (e.state === 'dead') return;
    e.hp -= dmg;
    e.flash = 0.15;
    if (dir) e.pos.addScaledVector(dir.clone().setY(0), 0.35);
    if (e.hp <= 0) killEnemy(e);
    else if (e.type === 'wolf') Sound.growl();
  }

  function killEnemy(e) {
    e.state = 'dead';
    e.deadT = 0;
    e.pos.y = 0;
    if (e.type === 'monkey') Sound.monkeyDie();
    else Sound.wolfDie();
    if (e.counts) phaseKills++;
    const drop = e.type === 'monkey' ? (Math.random() < 0.4 ? 'banana' : null) : (Math.random() < 0.3 ? 'medkit' : null);
    if (drop) dropPickup(drop, e.pos.x, e.pos.z);
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
      if (dist > MONKEY.reach) speed = MONKEY.speed;
      else if (e.cd <= 0) {
        damagePlayer(MONKEY.damage, e.pos);
        e.cd = MONKEY.attackCd;
        Sound.screech();
      }
    } else if (e.state === 'lunge') {
      e.lungeT -= dt;
      e.pos.addScaledVector(e.lungeDir, WOLF.lungeSpeed * dt);
      if (!e.bit && dist < WOLF.reach + 0.3) {
        damagePlayer(WOLF.damage, e.pos);
        e.bit = true;
      }
      if (e.lungeT <= 0) e.state = 'chase';
    } else if (dist < 7 && dist > 2.2 && e.lungeCd <= 0) {
      e.state = 'lunge';
      e.lungeT = 0.35;
      e.lungeDir.set(dx / dist, 0, dz / dist);
      e.bit = false;
      e.lungeCd = rand(1.8, 2.6);
      Sound.growl();
    } else if (dist > WOLF.reach) speed = WOLF.speed;
    else if (e.cd <= 0) {
      damagePlayer(WOLF.damage, e.pos);
      e.cd = WOLF.attackCd;
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
      if (d < 1 && d > 1e-4) {
        e.pos.x += (ox / d) * (1 - d) * 0.5;
        e.pos.z += (oz / d) * (1 - d) * 0.5;
      }
    }
    if (e.state !== 'fall') {
      collideTrees(e.pos, 0.45);
      clampToLevel(e.pos, 0.45);
    }
    updateSpheres(e);
    animateEnemy(e, speed > 0 || e.state === 'lunge', dist);
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
      const p = e.t * (e.state === 'lunge' ? 22 : 15);
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
    const mesh = kind === 'banana' ? Models.banana() : Models.medkit();
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
      if (d < 1.3 && player.hp < PLAYER.maxHp) {
        player.hp = Math.min(PLAYER.maxHp, player.hp + (p.kind === 'banana' ? 20 : 35));
        Sound.eat();
        toast(p.kind === 'banana' ? '+20 can 🍌' : '+35 can', '', 1.0);
      } else if (p.t < 40) continue;
      p.mesh.removeFromParent();
      pickups.splice(i, 1);
    }
  }

  // The RPG-7 (or a rocket bag) hangs from a branch of one of the big arena trees.
  let hanging = null, lastHangTree = null;

  function hangItem(kind) {
    const choices = bigTrees.filter((t) => t !== lastHangTree);
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
      player.rockets = ROCKET.startAmmo;
      toast('RPG-7 senin!', "Şimdi King Kong'u vur! [1] yay · [2] RPG-7", 3);
    } else {
      player.rockets += ROCKET.bagAmmo;
      toast(`+${ROCKET.bagAmmo} roket`, '', 1.6);
    }
    setWeapon('rpg');
    Sound.pickup();
    hanging.group.removeFromParent();
    hanging = null;
  }

  function setWeapon(w) {
    if (w === 'rpg' && !player.hasRpg) return;
    player.weapon = w;
    player.rig.pose(w);
    $('crosshair').classList.toggle('rpg', w === 'rpg');
  }

  // ---------- King Kong ----------
  let boss = null;

  function spawnBoss() {
    const m = Models.gorilla();
    const S = BOSS.height / Models.GORILLA_HEIGHT;
    m.root.scale.setScalar(S);
    m.root.rotation.order = 'YXZ';
    m.root.position.set(ARENA.x, 0, ARENA.z - 28);
    m.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(m.root);
    boss = {
      m, root: m.root, pos: m.root.position, S,
      hp: BOSS.hp, state: 'intro', stateT: 0, t: 0, yaw: 0, flash: 0,
      throwCd: 4, beatCd: 12, slamCenter: new V3(),
      sph: [[0, 0.3, 0, 0.42], [0, 1.05, 0, 0.58], [0, 1.7, -0.12, 0.3]].map(([x, y, z, r]) => ({ off: new V3(x, y, z), c: new V3(), r: r * S })),
    };
    updateSpheres(boss, S);
    Sound.roar();
    setTimeout(() => Sound.chestBeat(), 600);
  }

  function setBossState(s) {
    boss.state = s;
    boss.stateT = 0;
  }

  function damageBoss(d, heavy) {
    if (!boss || boss.state === 'dead') return;
    boss.hp = Math.max(0, boss.hp - d);
    boss.flash = heavy ? 0.3 : 0.08;
    if (boss.hp <= 0) {
      setBossState('dead');
      Sound.roar();
      bossDeadT = 0;
      for (const e of enemies.slice()) if (e.state !== 'dead') removeEnemy(e, true);
      toast('King Kong yıkılıyor!', '', 2.5);
    } else if (heavy) {
      setBossState('stagger');
      Sound.roar();
    }
  }

  function updateBoss(dt) {
    const b = boss, m = b.m;
    b.t += dt;
    b.stateT += dt;
    if (b.flash > 0) b.flash -= dt;
    for (const fm of m.flashMats) fm.emissive.setHex(b.flash > 0 ? 0x880000 : 0);
    const dx = player.pos.x - b.pos.x, dz = player.pos.z - b.pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const turn = (rate) => {
      const target = Math.atan2(-dx, -dz);
      let diff = target - b.yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      b.yaw += diff * Math.min(1, dt * rate);
      b.root.rotation.y = b.yaw;
    };
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
        turn(3);
        const s = Math.sin(b.t * 18);
        m.arms[0].rotation.set(1.6 + s * 0.35, 0, 0.55);
        m.arms[1].rotation.set(1.6 - s * 0.35, 0, -0.55);
        m.mouth.scale.y = 3;
        if (b.stateT > (b.state === 'intro' ? 3 : 1.7)) {
          setBossState('chase');
          b.beatCd = rand(10, 14);
        }
        break;
      }
      case 'chase': {
        turn(4);
        if (dist > 4.5) {
          b.pos.x += (dx / dist) * BOSS.speed * dt;
          b.pos.z += (dz / dist) * BOSS.speed * dt;
        }
        const p = b.t * 4;
        m.legs[0].rotation.x = Math.sin(p) * 0.45;
        m.legs[1].rotation.x = -Math.sin(p) * 0.45;
        armX(0.35 - Math.sin(p) * 0.4, 0.35 + Math.sin(p) * 0.4);
        b.pos.y = Math.abs(Math.sin(p)) * 0.12;
        b.throwCd -= dt;
        b.beatCd -= dt;
        if (dist < 5.5) {
          setBossState('slamWind');
          Sound.growl();
        } else if (dist > 12 && b.throwCd <= 0) setBossState('throwWind');
        else if (b.beatCd <= 0) {
          setBossState('beat');
          Sound.roar();
          Sound.chestBeat();
        }
        break;
      }
      case 'slamWind':
        turn(2);
        armX(Math.PI * 0.95, Math.PI * 0.95, 6);
        m.mouth.scale.y = 2.5;
        if (b.stateT > 0.9) doSlam();
        break;
      case 'throwWind':
        turn(5);
        armX(0.3, -2.5, 8);
        if (b.stateT > 0.8) throwRock();
        break;
      case 'recover':
        armX(0.55, 0.55, 14);
        if (b.stateT > 0.9) setBossState('chase');
        break;
      case 'stagger':
        m.torso.rotation.x = 0.3 * Math.sin(Math.min(1, b.stateT / 0.7) * Math.PI);
        m.mouth.scale.y = 3;
        armX(1.2, 1.2, 8);
        if (b.stateT > 0.7) setBossState('chase');
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
      const dc = Math.hypot(b.pos.x - ARENA.x, b.pos.z - ARENA.z);
      if (dc > ARENA.r - 3) {
        b.pos.x = ARENA.x + ((b.pos.x - ARENA.x) / dc) * (ARENA.r - 3);
        b.pos.z = ARENA.z + ((b.pos.z - ARENA.z) / dc) * (ARENA.r - 3);
      }
      updateSpheres(b, b.S);
    }
  }

  function doSlam() {
    const b = boss;
    const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw);
    b.slamCenter.set(b.pos.x + fx * 3, 0.1, b.pos.z + fz * 3);
    Sound.slam();
    shake(0.9);
    shockRing(b.slamCenter, BOSS.slamRadius, 0xe8d3a8);
    emit('dust', b.slamCenter, 30, { speed: 9, up: 3, spread: 1.5, size: 0.35, life: 1.0 });
    emit('rock', b.slamCenter, 10, { speed: 6, up: 6, size: 0.18, life: 1.2 });
    const d = Math.hypot(player.pos.x - b.slamCenter.x, player.pos.z - b.slamCenter.z);
    if (d < BOSS.slamRadius && player.pos.y < 0.6) {
      damagePlayer(BOSS.slamDamage, b.slamCenter);
      player.vel.y = 5;
      player.onGround = false;
    }
    setBossState('recover');
  }

  const rockGeo = new THREE.DodecahedronGeometry(0.6, 0);
  function throwRock() {
    const b = boss;
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
    setBossState('recover');
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
        if (dPlayer < 1.3) damagePlayer(BOSS.rockDamage, p);
        else if (Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < 2.2) damagePlayer(BOSS.rockDamage / 2, p);
        Sound.thunk();
        emit('rock', p, 10, { speed: 5, up: 3, size: 0.2, life: 1.0 });
        emit('dust', p, 8, { speed: 3, up: 1, size: 0.3, life: 0.8 });
        r.mesh.removeFromParent();
        rocks.splice(i, 1);
      }
    }
  }

  // ---------- Phases ----------
  let gameState = 'menu'; // menu | play | paused | dead | finale | won
  let phase = 'monkeys'; // monkeys | wolves | toArena | boss | escape
  let phaseKills = 0, phaseSpawned = 0, spawnTimer = 0, minionTimer = 0, bossDeadT = 0, rpgHintT = 0, runTime = 0, runFrom = 0;

  function setPhase(p) {
    phase = p;
    phaseKills = 0;
    phaseSpawned = 0;
    spawnTimer = 1.5;
    switch (p) {
      case 'monkeys':
        toast('Vahşi maymunlar!', 'Hepsini okla vur — yol ancak o zaman açılır', 3.5);
        break;
      case 'wolves':
        barriers[0].openUp();
        save.checkpoint = Math.max(save.checkpoint, 1);
        writeSave();
        Sound.howl();
        toast('Kurtlar geliyor!', 'Devrik ağaçlar kalktı — ilerle', 3);
        break;
      case 'toArena':
        barriers[1].openUp();
        toast('Yol açıldı!', 'Ormanın derinliklerine ilerle...', 3);
        break;
      case 'boss':
        spawnBoss();
        if (!player.hasRpg) hangItem('rpg');
        save.checkpoint = 2;
        writeSave();
        minionTimer = MINIONS.interval;
        rpgHintT = 0;
        toast('KING KONG!', "Oklar ona işlemez — ağaçlarda asılı RPG-7'yi bul!", 4);
        break;
      case 'escape':
        gate.open();
        toast('King Kong yenildi!', 'Ormanın son kapısı açıldı — çık!', 4);
        break;
    }
  }

  function spawnAhead(type, zMin, zMax) {
    let z = player.pos.z - rand(14, 38);
    if (z < zMin) z = player.pos.z + rand(12, 22);
    z = clamp(z, zMin, zMax);
    const x = type === 'wolf' ? (Math.random() < 0.5 ? -1 : 1) * (LEVEL.corridorHalf - 1) : rand(-12, 12);
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
    if (phase === 'monkeys') {
      if (spawnTimer <= 0 && phaseSpawned < MONKEY.total && aliveCount() < MONKEY.maxAlive) {
        spawnAhead('monkey', LEVEL.barrier1 + 3, -2);
        spawnTimer = rand(0.8, 1.8);
      }
      if (phaseKills >= MONKEY.total) setPhase('wolves');
    } else if (phase === 'wolves') {
      if (spawnTimer <= 0 && phaseSpawned < WOLF.total && aliveCount() < WOLF.maxAlive) {
        spawnAhead('wolf', LEVEL.barrier2 + 3, LEVEL.barrier1 - 3);
        spawnTimer = rand(1.0, 2.2);
      }
      if (phaseKills >= WOLF.total) setPhase('toArena');
    } else if (phase === 'toArena') {
      if (player.pos.z < -312) setPhase('boss');
    } else if (phase === 'boss') {
      if (boss.state === 'dead') {
        bossDeadT += dt;
        if (bossDeadT > 3) setPhase('escape');
        return;
      }
      minionTimer -= dt;
      if (minionTimer <= 0 && aliveCount(true) < MINIONS.maxAlive) {
        minionTimer = MINIONS.interval;
        let a = Math.random() * Math.PI * 2;
        let x = ARENA.x + Math.cos(a) * (ARENA.r - 4), z = ARENA.z + Math.sin(a) * (ARENA.r - 4);
        if (Math.hypot(x - player.pos.x, z - player.pos.z) < 15) {
          a += Math.PI;
          x = ARENA.x + Math.cos(a) * (ARENA.r - 4);
          z = ARENA.z + Math.sin(a) * (ARENA.r - 4);
        }
        spawnEnemy(Math.random() < 0.5 ? 'monkey' : 'wolf', x, z, false, false);
      }
      if (!player.hasRpg) {
        rpgHintT += dt;
        if (rpgHintT > 50) {
          rpgHintT = -999;
          toast('İpucu', 'Büyük ağaçların dallarına bak!', 3);
        }
      }
    } else if (phase === 'escape') {
      if (player.pos.z < LEVEL.gateZ - 1.5) startFinale();
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
      case 'monkeys': return `🐒 Maymunlar: ${phaseKills} / ${MONKEY.total}`;
      case 'wolves': return `🐺 Kurtlar: ${phaseKills} / ${WOLF.total}`;
      case 'toArena': return '🌲 Ormanın derinliklerine ilerle';
      case 'boss': return player.hasRpg ? "🦍 King Kong'u RPG-7 ile vur!" : "🔎 Ağaçlarda asılı RPG-7'yi bul!";
      default: return '🚪 Kapıdan çık!';
    }
  }

  function updateHud(dt) {
    $('hp-fill').style.width = `${(player.hp / PLAYER.maxHp) * 100}%`;
    $('hp').classList.toggle('low', player.hp < 35);
    $('objective').textContent = objectiveText();
    const showBoss = !!boss && phase === 'boss';
    $('boss').classList.toggle('hidden', !showBoss);
    if (showBoss) $('boss-fill').style.width = `${(boss.hp / BOSS.hp) * 100}%`;
    $('weapon').innerHTML = player.weapon === 'rpg'
      ? `🚀 RPG-7 × ${player.rockets}<small>[1] yay · [2] RPG-7</small>`
      : `🏹 Yay<small>${player.hasRpg ? '[1] yay · [2] RPG-7' : 'sınırsız ok'}</small>`;
    if (toastT > 0) {
      toastT -= dt;
      if (toastT <= 0) $('toast').classList.remove('show');
    }
    hurtT = Math.max(0, hurtT - dt);
    $('hurt').style.opacity = Math.min(1, hurtT * 1.6 + (player.hp < 30 ? 0.25 : 0));
    arrowBossNoticeT -= dt;
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
    clearList(pickups);
    for (const p of particles) {
      scene.remove(p.m);
      particlePool.push(p.m);
    }
    particles.length = 0;
    if (boss) boss.root.removeFromParent();
    boss = null;
    if (hanging) hanging.group.removeFromParent();
    hanging = null;
    lastHangTree = null;
  }

  function startRun(checkpoint) {
    resetWorld();
    leaveStadium();
    Object.assign(player, { hp: PLAYER.maxHp, hasRpg: false, rockets: 0, cooldown: 0.3, invuln: 0, onGround: true });
    player.vel.set(0, 0, 0);
    setWeapon('bow');
    barriers[0].set(checkpoint >= 1);
    barriers[1].set(checkpoint >= 2);
    gate.set(false);
    const startZ = [-3, -156, -302][checkpoint];
    player.pos.set(0, 0, startZ);
    yaw = 0;
    pitch = -0.1;
    runTime = 0;
    runFrom = checkpoint;
    setPhase(['monkeys', 'wolves', 'toArena'][checkpoint]);
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
    $('dead-text').textContent = `Kaldığın yerden devam edeceksin: ${PHASE_NAMES[save.checkpoint]}`;
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
    Sound.crowdStop();
    gameState = 'menu';
    for (const id of ['pause', 'dead', 'win', 'hud']) $(id).classList.add('hidden');
    $('menu').classList.remove('hidden');
    $('fade').style.opacity = 0;
    barriers[0].set(false);
    barriers[1].set(false);
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
    cont.textContent = `Devam et: ${PHASE_NAMES[save.checkpoint]}`;
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
    if (!stadiumActive) return;
    stadiumActive = false;
    scene.add(player.rig.root);
    player.rig.root.scale.setScalar(1);
    Sound.crowdStop();
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
        Sound.crowdStart();
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
    if (boss) updateBoss(dt);
    updateArrows(dt);
    updateRockets(dt);
    updateRocks(dt);
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
    if (gameState === 'play' && player.hasRpg) setWeapon(player.weapon === 'bow' ? 'rpg' : 'bow');
  });

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (gameState === 'play') {
      if (e.code === 'KeyE') takeHanging();
      else if (e.code === 'Digit1') setWeapon('bow');
      else if (e.code === 'Digit2') setWeapon('rpg');
      else if (e.code === 'KeyQ' && player.hasRpg) setWeapon(player.weapon === 'bow' ? 'rpg' : 'bow');
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
