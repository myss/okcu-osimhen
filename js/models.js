// Procedural low-poly models. Every model faces -z with its feet at y = 0.
const Models = (() => {
  'use strict';
  const V3 = THREE.Vector3;

  const mat = (color, opts) => new THREE.MeshLambertMaterial(Object.assign({ color }, opts));
  const glow = (color) => new THREE.MeshBasicMaterial({ color });
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const sphere = (r, ws = 12, hs = 8) => new THREE.SphereGeometry(r, ws, hs);

  function add(parent, geo, material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  function group(parent, x = 0, y = 0, z = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    if (parent) parent.add(g);
    return g;
  }

  function textTexture(width, height, draw) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    draw(c.getContext('2d'), width, height);
    return new THREE.CanvasTexture(c);
  }

  // ---------- Arrow: tip at the origin, pointing +z ----------
  const ARROW_LEN = 0.8;
  const arrowGeo = (() => {
    const shaft = new THREE.CylinderGeometry(0.009, 0.009, ARROW_LEN - 0.05, 6);
    shaft.rotateX(Math.PI / 2);
    shaft.translate(0, 0, -(ARROW_LEN - 0.05) / 2 - 0.05);
    const head = new THREE.ConeGeometry(0.02, 0.07, 8);
    head.rotateX(Math.PI / 2);
    head.translate(0, 0, -0.035);
    const vane = new THREE.PlaneGeometry(0.12, 0.035);
    vane.rotateY(Math.PI / 2);
    vane.translate(0, 0.028, -ARROW_LEN + 0.1);
    return { shaft, head, vane };
  })();
  const arrowMat = {
    shaft: mat(0xd9c39a),
    head: mat(0x70757c),
    vanes: [mat(0xd8232a, { side: THREE.DoubleSide }), mat(0xd8232a, { side: THREE.DoubleSide }), mat(0xf5c400, { side: THREE.DoubleSide })],
  };

  function arrow() {
    const g = new THREE.Group();
    add(g, arrowGeo.shaft, arrowMat.shaft);
    add(g, arrowGeo.head, arrowMat.head);
    for (let k = 0; k < 3; k++) add(g, arrowGeo.vane, arrowMat.vanes[k]).rotation.z = (k * Math.PI * 2) / 3;
    return g;
  }

  // ---------- Bow: vertical along y, belly toward -z, string toward +z ----------
  function bow() {
    const g = new THREE.Group();
    const pts = [
      [0, -0.62, 0.06], [0, -0.5, -0.02], [0, -0.25, -0.09], [0, 0, -0.11],
      [0, 0.25, -0.09], [0, 0.5, -0.02], [0, 0.62, 0.06],
    ].map((p) => new V3(...p));
    add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.02, 6), mat(0x5b3a1e));
    add(g, box(0.05, 0.16, 0.06), mat(0x2a1a0e), 0, 0, -0.11);
    const stringGeo = new THREE.BufferGeometry().setFromPoints([pts[0], new V3(0, 0, 0.06), pts[6]]);
    g.add(new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: 0xeeeeee })));
    const nocked = arrow();
    nocked.rotation.y = Math.PI;
    g.add(nocked);
    g.userData.setDraw = (k) => {
      const z = 0.06 + 0.4 * k;
      stringGeo.attributes.position.setZ(1, z);
      stringGeo.attributes.position.needsUpdate = true;
      nocked.position.set(0.03, 0, z - ARROW_LEN);
      nocked.visible = k > 0.05;
    };
    g.userData.setDraw(1);
    return g;
  }

  // ---------- RPG-7: muzzle toward -z ----------
  function rpgWarhead(parent) {
    const olive = mat(0x55602a);
    const body = add(parent, new THREE.CylinderGeometry(0.05, 0.05, 0.22, 10), olive, 0, 0, -0.6);
    body.rotation.x = Math.PI / 2;
    const cone = new THREE.ConeGeometry(0.095, 0.32, 10);
    cone.rotateX(-Math.PI / 2);
    add(parent, cone, olive, 0, 0, -0.86);
  }

  function rpg() {
    const g = new THREE.Group();
    const olive = mat(0x4b5320), dark = mat(0x262626), wood = mat(0x8a5a33);
    const tube = new THREE.CylinderGeometry(0.045, 0.045, 1.0, 10);
    tube.rotateX(Math.PI / 2);
    add(g, tube, olive);
    const guard = new THREE.CylinderGeometry(0.058, 0.058, 0.32, 10);
    guard.rotateX(Math.PI / 2);
    add(g, guard, wood, 0, 0, -0.02);
    add(g, box(0.04, 0.13, 0.05), dark, 0, -0.1, 0.06);
    add(g, box(0.04, 0.13, 0.05), dark, 0, -0.1, -0.2);
    add(g, box(0.025, 0.07, 0.04), dark, 0.055, 0.07, -0.12);
    const bell = new THREE.CylinderGeometry(0.06, 0.045, 0.12, 10, 1, true);
    bell.rotateX(Math.PI / 2);
    add(g, bell, dark, 0, 0, 0.55);
    rpgWarhead(g);
    return g;
  }

  // ---------- Firearms: muzzle toward -z, userData.muzzle marks the barrel tip ----------
  function along(geo) {
    geo.rotateX(Math.PI / 2);
    return geo;
  }

  function ak47() {
    const g = new THREE.Group();
    const steel = mat(0x222326), wood = mat(0x9a5428), mag = mat(0xa0461c);
    add(g, box(0.06, 0.09, 0.34), steel);
    add(g, along(new THREE.CylinderGeometry(0.013, 0.013, 0.42, 8)), steel, 0, 0.01, -0.38);
    add(g, along(new THREE.CylinderGeometry(0.016, 0.016, 0.26, 8)), steel, 0, 0.045, -0.27);
    add(g, box(0.07, 0.07, 0.24), wood, 0, 0, -0.27);
    add(g, box(0.012, 0.05, 0.012), steel, 0, 0.05, -0.55);
    const stock = add(g, box(0.05, 0.1, 0.32), wood, 0, -0.03, 0.31);
    stock.rotation.x = 0.12;
    const grip = add(g, box(0.04, 0.11, 0.05), wood, 0, -0.09, 0.1);
    grip.rotation.x = -0.3;
    const magazine = add(g, box(0.04, 0.2, 0.08), mag, 0, -0.13, -0.05);
    magazine.rotation.x = 0.35;
    g.userData.muzzle = group(g, 0, 0.01, -0.6);
    return g;
  }

  function revolver() {
    const g = new THREE.Group();
    const steel = mat(0xb9bcc2), dark = mat(0x2a2a2e), wood = mat(0x6e3b1a);
    add(g, box(0.035, 0.06, 0.14), steel);
    add(g, along(new THREE.CylinderGeometry(0.016, 0.016, 0.18, 8)), steel, 0, 0.015, -0.15);
    add(g, along(new THREE.CylinderGeometry(0.036, 0.036, 0.07, 8)), dark, 0, 0.0, -0.02);
    const grip = add(g, box(0.034, 0.11, 0.05), wood, 0, -0.07, 0.07);
    grip.rotation.x = -0.35;
    add(g, box(0.008, 0.025, 0.008), dark, 0, 0.04, -0.22);
    g.userData.muzzle = group(g, 0, 0.015, -0.25);
    return g;
  }

  function rocket() {
    const g = new THREE.Group();
    const inner = group(g, 0, 0, 0.6);
    rpgWarhead(inner);
    const flame = add(g, sphere(0.09, 8, 6), glow(0xffb02e), 0, 0, 0.12);
    flame.scale.set(1, 1, 2.2);
    flame.castShadow = false;
    return g;
  }

  // ---------- Osimhen ----------
  function backPrint() {
    return textTexture(256, 256, (g, w) => {
      g.textAlign = 'center';
      g.lineJoin = 'round';
      g.font = 'bold 40px Arial Black, Arial, sans-serif';
      g.lineWidth = 8;
      g.strokeStyle = '#5a0016';
      g.fillStyle = '#ffffff';
      g.strokeText('OSİMHEN', w / 2, 52);
      g.fillText('OSİMHEN', w / 2, 52);
      g.font = 'bold 150px Arial Black, Arial, sans-serif';
      g.lineWidth = 14;
      g.strokeText('45', w / 2, 210);
      g.fillText('45', w / 2, 210);
    });
  }

  function player() {
    const root = new THREE.Group();
    const skin = mat(0x3b2418), yellow = mat(0xf7b500), red = mat(0xb0002a), black = mat(0x151515);

    const legs = [];
    for (const s of [-1, 1]) {
      const leg = group(root, 0.11 * s, 0.9, 0);
      add(leg, box(0.19, 0.3, 0.21), black, 0, -0.13, 0);
      add(leg, box(0.12, 0.4, 0.13), skin, 0, -0.47, 0);
      add(leg, box(0.13, 0.18, 0.14), s < 0 ? red : yellow, 0, -0.73, 0);
      add(leg, box(0.14, 0.08, 0.28), black, 0, -0.86, -0.05);
      legs.push(leg);
    }

    const torso = group(root, 0, 0.9, 0);
    add(torso, box(0.22, 0.62, 0.27), yellow, -0.11, 0.3, 0);
    add(torso, box(0.22, 0.62, 0.27), red, 0.11, 0.3, 0);
    const print = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.38), new THREE.MeshLambertMaterial({ map: backPrint(), transparent: true }));
    print.position.set(0, 0.33, 0.137);
    torso.add(print);

    const head = group(root, 0, 1.52, 0);
    add(head, new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8), skin, 0, 0.04, 0);
    add(head, sphere(0.135, 14, 10), skin, 0, 0.2, 0);
    add(head, new THREE.SphereGeometry(0.142, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), mat(0xe2b23a), 0, 0.21, 0.01);
    // Osimhen's trademark black face mask
    add(head, box(0.22, 0.1, 0.07), black, 0, 0.21, -0.11);
    add(head, box(0.28, 0.025, 0.25), black, 0, 0.23, 0.01);

    const armL = group(root, -0.3, 1.44, 0);
    add(armL, box(0.12, 0.2, 0.13), yellow, 0, -0.08, 0);
    add(armL, box(0.09, 0.4, 0.1), skin, 0, -0.36, 0);
    const armR = group(root, 0.3, 1.44, 0);
    add(armR, box(0.12, 0.2, 0.13), red, 0, -0.08, 0);
    add(armR, box(0.09, 0.4, 0.1), skin, 0, -0.36, 0);

    // Worn on the right hip so the name and number on the back stay visible.
    const quiver = group(root, 0.28, 0.98, 0.08);
    quiver.rotation.set(0.25, 0, -0.18);
    add(quiver, new THREE.CylinderGeometry(0.075, 0.065, 0.6, 10), mat(0x6e4422));
    for (let k = 0; k < 4; k++) add(quiver, box(0.02, 0.1, 0.035), k % 2 ? arrowMat.vanes[2] : arrowMat.vanes[0], (k - 1.5) * 0.03, 0.34, 0);

    // One holder per weapon, placed where the hands hold it; each weapon has its own arm pose.
    const bowModel = bow();
    const holders = {
      bow: group(root, -0.26, 1.42, -0.62),
      ak: group(root, 0.12, 1.38, -0.3),
      pistol: group(root, 0, 1.43, -0.6),
      rpg: group(root, 0.2, 1.62, -0.05),
    };
    holders.bow.add(bowModel);
    holders.ak.add(ak47());
    holders.pistol.add(revolver());
    holders.rpg.add(rpg());
    const ARM_POSES = {
      bow: [[Math.PI / 2, 0, 0], [1.5, 0, -0.9]],
      ak: [[1.45, 0, -0.5], [1.2, 0, 0.3]],
      pistol: [[1.5, 0, -0.45], [1.5, 0, 0.45]],
      rpg: [[1.35, 0, -0.35], [1.1, 0, 0.25]],
    };

    const rig = { root, legs, armL, armR, head, torso, holders, bowHolder: holders.bow, bow: bowModel, rpgHolder: holders.rpg };
    rig.pose = (weapon) => {
      for (const w in holders) holders[w].visible = w === weapon;
      armL.rotation.set(...ARM_POSES[weapon][0]);
      armR.rotation.set(...ARM_POSES[weapon][1]);
    };
    rig.muzzle = (weapon, out) => holders[weapon].children[0].userData.muzzle.getWorldPosition(out);
    rig.cheer = (t) => {
      for (const w in holders) holders[w].visible = false;
      armL.rotation.set(Math.PI - 0.25 + Math.sin(t * 8) * 0.25, 0, -0.35);
      armR.rotation.set(Math.PI - 0.25 + Math.sin(t * 8 + 1) * 0.25, 0, 0.35);
    };
    rig.pose('bow');
    return rig;
  }

  // ---------- Wild monkey (~1.45 m) ----------
  function monkey() {
    const root = new THREE.Group();
    const fur = mat(0x5a3a1f), face = mat(0xc89062), eye = glow(0xff2a00), tooth = mat(0xffffff);
    const body = group(root);
    add(body, sphere(0.32), fur, 0, 0.74, 0).scale.set(1, 1.25, 0.9);
    add(body, sphere(0.2), face, 0, 0.7, -0.17).scale.set(1, 1.3, 0.5);
    const head = group(body, 0, 1.2, -0.08);
    add(head, sphere(0.22), fur);
    add(head, sphere(0.15), face, 0, -0.03, -0.13).scale.set(1.1, 0.9, 0.7);
    add(head, sphere(0.035, 6, 4), eye, -0.07, 0.05, -0.2);
    add(head, sphere(0.035, 6, 4), eye, 0.07, 0.05, -0.2);
    add(head, box(0.1, 0.035, 0.03), tooth, 0, -0.09, -0.235);
    add(head, sphere(0.07), face, -0.22, 0.02, 0);
    add(head, sphere(0.07), face, 0.22, 0.02, 0);
    const arms = [], legs = [];
    for (const s of [-1, 1]) {
      const arm = group(body, 0.3 * s, 1.0, 0);
      add(arm, box(0.09, 0.62, 0.09), fur, 0, -0.3, 0);
      add(arm, sphere(0.07), face, 0, -0.63, 0);
      arms.push(arm);
      const leg = group(body, 0.14 * s, 0.46, 0);
      add(leg, box(0.11, 0.44, 0.11), fur, 0, -0.22, 0);
      legs.push(leg);
    }
    const tail = new THREE.CatmullRomCurve3([[0, 0.55, 0.25], [0, 0.5, 0.55], [0, 0.85, 0.75], [0, 1.05, 0.6]].map((p) => new V3(...p)));
    add(body, new THREE.TubeGeometry(tail, 12, 0.035, 5), fur);
    return { root, body, head, arms, legs, flashMats: [fur] };
  }

  // ---------- Four-legged beasts: wolf, lion, tiger ----------
  const BEASTS = {
    wolf: { fur: 0x6f6f6f, legs: 0x3d3d3d, light: 0xbdbdbd, ear: 0x3d3d3d, eye: 0xffd000, scale: 1, pointedEars: true },
    lion: { fur: 0xc9974c, legs: 0xb7853e, light: 0xead0a0, ear: 0x8a6430, eye: 0xffb000, scale: 1.4, mane: 0x6e3f17, tuft: 0x5a3212 },
    tiger: { fur: 0xe2781e, legs: 0xe2781e, light: 0xf4efe6, ear: 0x1d1d1d, eye: 0x9cff3a, scale: 1.35, stripes: true },
  };

  let stripeTexture = null;
  function stripes() {
    if (!stripeTexture) {
      stripeTexture = textTexture(128, 128, (g, w, h) => {
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#1a1a1a';
        for (let x = 6; x < w; x += 22) {
          g.beginPath();
          g.moveTo(x, 0);
          g.lineTo(x + 9, h * 0.45);
          g.lineTo(x + 2, h);
          g.lineTo(x - 4, h);
          g.lineTo(x + 3, h * 0.45);
          g.lineTo(x - 5, 0);
          g.fill();
        }
      });
    }
    return stripeTexture;
  }

  function beast(kind) {
    const o = BEASTS[kind];
    const root = new THREE.Group();
    const fur = mat(o.fur, o.stripes ? { map: stripes() } : undefined);
    const legsM = o.stripes ? fur : mat(o.legs), light = mat(o.light), dark = mat(0x1d1d1d), eye = glow(o.eye), earM = mat(o.ear);
    const body = group(root);
    add(body, box(0.42, 0.42, 1.0), fur, 0, 0.74, 0.05);
    add(body, box(0.3, 0.14, 0.8), light, 0, 0.52, 0.05);
    add(body, box(0.44, 0.48, 0.32), fur, 0, 0.82, -0.48);
    const head = group(body, 0, 0.98, -0.72);
    add(head, box(0.3, 0.28, 0.3), fur);
    add(head, box(0.16, 0.14, 0.28), light, 0, -0.05, -0.25);
    add(head, box(0.07, 0.06, 0.05), dark, 0, 0, -0.4);
    add(head, sphere(0.03, 6, 4), eye, -0.08, 0.06, -0.15);
    add(head, sphere(0.03, 6, 4), eye, 0.08, 0.06, -0.15);
    const ear = o.pointedEars ? new THREE.ConeGeometry(0.06, 0.15, 4) : sphere(0.06, 8, 6);
    add(head, ear, earM, -0.11, 0.17, 0.03);
    add(head, ear, earM, 0.11, 0.17, 0.03);
    if (o.mane) add(head, sphere(0.3, 12, 10), mat(o.mane), 0, 0.02, 0.1).scale.set(1.2, 1.2, 0.75);
    const legs = [];
    for (const [x, z] of [[-0.14, -0.4], [0.14, -0.4], [-0.14, 0.42], [0.14, 0.42]]) {
      const leg = group(body, x, 0.58, z);
      add(leg, box(0.1, 0.58, 0.1), legsM, 0, -0.29, 0);
      legs.push(leg);
    }
    const tail = group(body, 0, 0.85, 0.55);
    add(tail, new THREE.CylinderGeometry(0.07, 0.04, 0.55, 6), fur, 0, -0.25, 0);
    if (o.tuft) add(tail, sphere(0.08), mat(o.tuft), 0, -0.55, 0);
    tail.rotation.x = 2.3;
    root.scale.setScalar(o.scale);
    return { root, body, head, legs, tail, scale: o.scale, flashMats: [fur] };
  }

  // ---------- Dragon: about 11 m long, wings span 13 m; head toward -z ----------
  function dragonWing(side, material, bone) {
    const pivot = new THREE.Group();
    const s = side;
    const pts = [
      [0, 0, -0.6], [6.4 * s, 0.9, 0.2], [4.6 * s, 0.1, 1.6],
      [0, 0, -0.6], [4.6 * s, 0.1, 1.6], [2.6 * s, -0.1, 2.0],
      [0, 0, -0.6], [2.6 * s, -0.1, 2.0], [0, 0, 1.4],
    ].flat();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    geo.computeVertexNormals();
    const membrane = new THREE.Mesh(geo, material);
    membrane.castShadow = true;
    pivot.add(membrane);
    const spar = new THREE.CatmullRomCurve3([new V3(0, 0, -0.6), new V3(3.2 * s, 0.7, -0.4), new V3(6.4 * s, 0.9, 0.2)]);
    add(pivot, new THREE.TubeGeometry(spar, 10, 0.09, 5), bone);
    return pivot;
  }

  // Team-coloured dragons for the final fight.
  const DRAGON_COLORS = {
    fb: { scales: 0x13286e, belly: 0xf5d300, wing: 0xf5d300, horn: 0xf5d300, eye: 0xffffff },
    bjk: { scales: 0x141414, belly: 0xf2f2f2, wing: 0xe6e6e6, horn: 0xffffff, eye: 0xff2020 },
  };

  function dragon(palette) {
    const c = DRAGON_COLORS[palette];
    const root = new THREE.Group();
    const scales = mat(c.scales), belly = mat(c.belly), horn = mat(c.horn), eye = glow(c.eye);
    const wingM = mat(c.wing, { side: THREE.DoubleSide });
    const body = group(root);
    add(body, sphere(1.2, 16, 12), scales, 0, 2.4, 0).scale.set(1, 0.9, 2.0);
    add(body, sphere(1.0, 14, 10), belly, 0, 2.1, -0.3).scale.set(0.85, 0.7, 1.7);
    for (let i = 0; i < 6; i++) {
      const spike = new THREE.ConeGeometry(0.16, 0.5, 5);
      add(body, spike, horn, 0, 3.45 - Math.abs(i - 2) * 0.08, -1.4 + i * 0.6);
    }
    const neck = group(body, 0, 2.9, -2.0);
    add(neck, sphere(0.62, 12, 8), scales, 0, 0.3, -0.4);
    add(neck, sphere(0.52, 12, 8), scales, 0, 0.9, -0.9);
    const head = group(neck, 0, 1.5, -1.5);
    add(head, box(0.9, 0.7, 1.3), scales);
    add(head, box(0.7, 0.35, 1.0), scales, 0, 0.05, -1.05);
    const jaw = group(head, 0, -0.25, -0.3);
    add(jaw, box(0.62, 0.18, 1.3), belly, 0, -0.05, -0.6);
    add(head, sphere(0.09, 8, 6), eye, -0.36, 0.2, -0.45);
    add(head, sphere(0.09, 8, 6), eye, 0.36, 0.2, -0.45);
    for (const s of [-1, 1]) {
      const h = add(head, new THREE.ConeGeometry(0.12, 0.8, 6), horn, 0.3 * s, 0.5, 0.4);
      h.rotation.x = 0.9;
    }
    const mouth = group(head, 0, -0.1, -1.6);
    const wings = [dragonWing(-1, wingM, horn), dragonWing(1, wingM, horn)];
    wings[0].position.set(-0.9, 3.0, -0.6);
    wings[1].position.set(0.9, 3.0, -0.6);
    body.add(wings[0], wings[1]);
    const tail = [];
    let parent = body;
    let at = new V3(0, 2.3, 2.2);
    for (let i = 0; i < 6; i++) {
      const seg = group(parent, at.x, at.y, at.z);
      add(seg, sphere(0.6 - i * 0.08, 10, 8), scales, 0, 0, 0.45);
      tail.push(seg);
      parent = seg;
      at = new V3(0, i === 0 ? -0.3 : -0.1, 0.8);
    }
    const tip = new THREE.ConeGeometry(0.25, 0.7, 4);
    tip.rotateX(Math.PI / 2);
    add(parent, tip, horn, 0, 0, 1.1);
    const legs = [];
    for (const [x, z] of [[-0.75, -1.2], [0.75, -1.2], [-0.8, 1.1], [0.8, 1.1]]) {
      const leg = group(body, x, 1.6, z);
      add(leg, box(0.45, 1.6, 0.5), scales, 0, -0.8, 0);
      add(leg, box(0.55, 0.2, 0.75), horn, 0, -1.55, -0.12);
      legs.push(leg);
    }
    return { root, body, neck, head, jaw, mouth, wings, tail, legs, flashMats: [scales] };
  }

  // ---------- T-Rex: about 6.5 m tall, 13 m long; head toward -z ----------
  function trex() {
    const root = new THREE.Group();
    const skin = mat(0x5b6e2e), belly = mat(0xc9b98a), dark = mat(0x3c4a1e), tooth = mat(0xfaf6e8), eye = glow(0xffd000);
    const body = group(root);
    add(body, sphere(1.5, 16, 12), skin, 0, 3.7, 0).scale.set(1, 1.05, 1.8);
    add(body, sphere(1.25, 14, 10), belly, 0, 3.3, -0.6).scale.set(0.9, 0.85, 1.4);
    add(body, sphere(0.95, 12, 10), skin, 0, 4.5, -2.3).scale.set(1, 1.1, 1.2);
    const head = group(body, 0, 5.2, -3.1);
    add(head, box(1.1, 1.05, 2.2), skin, 0, 0.1, -0.9);
    add(head, box(1.15, 0.22, 1.2), dark, 0, 0.7, -0.6);
    add(head, sphere(0.1, 8, 6), eye, -0.5, 0.45, -0.5);
    add(head, sphere(0.1, 8, 6), eye, 0.5, 0.45, -0.5);
    const toothGeo = new THREE.ConeGeometry(0.06, 0.2, 5);
    toothGeo.rotateX(Math.PI);
    for (let i = 0; i < 6; i++) {
      for (const s of [-1, 1]) add(head, toothGeo, tooth, 0.45 * s, -0.5, -0.4 - i * 0.28);
    }
    const jaw = group(head, 0, -0.4, 0);
    add(jaw, box(1.0, 0.35, 2.0), belly, 0, -0.15, -0.9);
    const jawTooth = new THREE.ConeGeometry(0.05, 0.16, 5);
    for (let i = 0; i < 5; i++) {
      for (const s of [-1, 1]) add(jaw, jawTooth, tooth, 0.4 * s, 0.1, -0.5 - i * 0.28);
    }
    const arms = [];
    for (const s of [-1, 1]) {
      const arm = group(body, 0.75 * s, 3.4, -1.8);
      add(arm, box(0.18, 0.6, 0.2), skin, 0, -0.25, -0.1);
      arm.rotation.x = 0.9;
      arms.push(arm);
    }
    const legs = [];
    for (const s of [-1, 1]) {
      const leg = group(body, 0.9 * s, 3.4, 0.3);
      add(leg, box(0.8, 1.7, 1.0), skin, 0, -0.8, 0);
      const shin = group(leg, 0, -1.6, 0.1);
      add(shin, box(0.45, 1.6, 0.5), dark, 0, -0.75, 0);
      add(shin, box(0.65, 0.25, 1.2), dark, 0, -1.6, -0.35);
      legs.push(leg);
    }
    const tail = [];
    let parent = body;
    let at = new V3(0, 3.8, 2.4);
    for (let i = 0; i < 6; i++) {
      const seg = group(parent, at.x, at.y, at.z);
      add(seg, sphere(0.95 - i * 0.14, 10, 8), skin, 0, 0, 0.55).scale.set(1, 0.9, 1.3);
      tail.push(seg);
      parent = seg;
      at = new V3(0, -0.12, 1.05);
    }
    return { root, body, head, jaw, arms, legs, tail, flashMats: [skin] };
  }

  // ---------- Giant birds: Fenerbahçe canary and Beşiktaş black eagle; centered on the origin ----------
  const BIRDS = {
    canary: { body: 0xf5d300, wing: 0xf5d300, tip: 0x13286e, head: 0xf5d300, tail: 0x13286e, beak: 0xff9a1a, span: 1.0, scale: 1.1 },
    eagle: { body: 0x161616, wing: 0x1c1c1c, tip: 0xf2f2f2, head: 0xf2f2f2, tail: 0xf2f2f2, beak: 0xf5c000, span: 1.7, scale: 1.4 },
  };

  function bird(kind) {
    const o = BIRDS[kind];
    const root = new THREE.Group();
    const bodyM = mat(o.body);
    const body = group(root);
    add(body, sphere(0.35, 12, 10), bodyM).scale.set(0.9, 0.85, 1.4);
    const head = group(body, 0, 0.18, -0.45);
    add(head, sphere(0.22, 12, 10), mat(o.head));
    const beak = new THREE.ConeGeometry(0.08, 0.26, 6);
    beak.rotateX(-Math.PI / 2);
    add(head, beak, mat(o.beak), 0, -0.03, -0.27);
    add(head, sphere(0.04, 6, 4), glow(0x111111), -0.12, 0.06, -0.12);
    add(head, sphere(0.04, 6, 4), glow(0x111111), 0.12, 0.06, -0.12);
    const tailGeo = new THREE.ConeGeometry(0.22, 0.5, 4);
    tailGeo.rotateX(Math.PI / 2);
    add(body, tailGeo, mat(o.tail), 0, 0.02, 0.6).scale.set(1, 0.3, 1);
    const wingM = mat(o.wing, { side: THREE.DoubleSide }), tipM = mat(o.tip, { side: THREE.DoubleSide });
    const wings = [];
    for (const s of [-1, 1]) {
      const pivot = group(body, 0.2 * s, 0.08, -0.05);
      const inner = add(pivot, box(o.span * 0.6, 0.04, 0.45), wingM, s * o.span * 0.3, 0, 0);
      inner.castShadow = true;
      add(pivot, box(o.span * 0.45, 0.04, 0.35), tipM, s * o.span * 0.82, 0, 0.05);
      wings.push(pivot);
    }
    root.scale.setScalar(o.scale);
    return { root, body, head, wings, scale: o.scale, flashMats: [bodyM] };
  }

  // ---------- King Kong: built ~1.94 m tall, scaled up by the caller ----------
  const GORILLA_HEIGHT = 1.94;
  function gorilla() {
    const root = new THREE.Group();
    const fur = mat(0x242424), skinD = mat(0x3c3a3a), chest = mat(0x4d4848), eye = glow(0xff2200), mouthM = mat(0x5a0a0a);
    const legs = [];
    for (const s of [-1, 1]) {
      const leg = group(root, 0.22 * s, 0.55, 0.05);
      add(leg, box(0.25, 0.56, 0.27), fur, 0, -0.27, 0);
      add(leg, box(0.27, 0.08, 0.36), skinD, 0, -0.52, -0.05);
      legs.push(leg);
    }
    const torso = group(root, 0, 0.55, 0);
    add(torso, sphere(0.5, 16, 12), fur, 0, 0.5, 0).scale.set(1.05, 1, 0.8);
    add(torso, sphere(0.33, 14, 10), chest, 0, 0.55, -0.24).scale.set(1, 1, 0.45);
    add(torso, sphere(0.26), fur, -0.45, 0.85, 0);
    add(torso, sphere(0.26), fur, 0.45, 0.85, 0);
    const head = group(torso, 0, 1.15, -0.12);
    add(head, sphere(0.25, 14, 10), fur);
    add(head, sphere(0.18, 12, 8), skinD, 0, -0.05, -0.12).scale.set(1, 1, 0.7);
    add(head, box(0.34, 0.07, 0.12), fur, 0, 0.07, -0.18);
    add(head, sphere(0.035, 6, 4), eye, -0.075, 0.015, -0.245);
    add(head, sphere(0.035, 6, 4), eye, 0.075, 0.015, -0.245);
    const mouth = add(head, box(0.14, 0.06, 0.04), mouthM, 0, -0.12, -0.24);
    const arms = [];
    for (const s of [-1, 1]) {
      const arm = group(torso, 0.56 * s, 0.92, 0);
      add(arm, box(0.25, 0.56, 0.27), fur, 0, -0.27, 0);
      add(arm, box(0.23, 0.5, 0.25), fur, 0, -0.76, 0);
      add(arm, sphere(0.16), skinD, 0, -1.04, 0);
      arms.push(arm);
    }
    return { root, torso, head, mouth, arms, legs, flashMats: [fur] };
  }

  // ---------- Pickups ----------
  function banana() {
    const g = new THREE.Group();
    const curve = new THREE.QuadraticBezierCurve3(new V3(-0.18, 0.05, 0), new V3(0, -0.12, 0), new V3(0.18, 0.05, 0));
    add(g, new THREE.TubeGeometry(curve, 10, 0.045, 6), mat(0xf5d020));
    add(g, box(0.03, 0.05, 0.03), mat(0x4a3a10), -0.19, 0.07, 0);
    return g;
  }

  function medkit() {
    const g = new THREE.Group();
    add(g, box(0.4, 0.28, 0.2), mat(0xf2f2f2));
    const red = mat(0xd0101a);
    add(g, box(0.2, 0.06, 0.21), red);
    add(g, box(0.06, 0.2, 0.21), red);
    return g;
  }

  function rocketBag() {
    const g = new THREE.Group();
    add(g, box(0.45, 0.55, 0.22), mat(0x3f4a22));
    for (const x of [-0.12, 0, 0.12]) {
      const c = new THREE.ConeGeometry(0.05, 0.16, 8);
      add(g, c, mat(0x55602a), x, 0.35, 0);
    }
    return g;
  }

  function ammoBox() {
    const g = new THREE.Group();
    add(g, box(0.42, 0.24, 0.26), mat(0x4b5320));
    add(g, box(0.43, 0.06, 0.27), mat(0xf2c200));
    add(g, box(0.12, 0.03, 0.05), mat(0x262626), 0, 0.135, 0);
    return g;
  }

  return { ARROW_LEN, GORILLA_HEIGHT, arrow, bow, rpg, rocket, player, monkey, beast, bird, dragon, trex, gorilla, banana, medkit, rocketBag, ammoBox, textTexture, mat, add, group };
})();
