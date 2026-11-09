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

    const bowHolder = group(root, -0.26, 1.42, -0.62);
    const bowModel = bow();
    bowHolder.add(bowModel);
    const rpgHolder = group(root, 0.2, 1.62, -0.05);
    const rpgModel = rpg();
    rpgHolder.add(rpgModel);
    rpgHolder.visible = false;

    const rig = { root, legs, armL, armR, head, torso, bowHolder, bow: bowModel, rpgHolder };
    rig.pose = (weapon) => {
      bowHolder.visible = weapon === 'bow';
      rpgHolder.visible = weapon === 'rpg';
      if (weapon === 'rpg') {
        armL.rotation.set(1.35, 0, -0.35);
        armR.rotation.set(1.1, 0, 0.25);
      } else {
        armL.rotation.set(Math.PI / 2, 0, 0);
        armR.rotation.set(1.5, 0, -0.9);
      }
    };
    rig.cheer = (t) => {
      bowHolder.visible = false;
      rpgHolder.visible = false;
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

  // ---------- Wolf ----------
  function wolf() {
    const root = new THREE.Group();
    const fur = mat(0x6f6f6f), dark = mat(0x3d3d3d), light = mat(0xbdbdbd), eye = glow(0xffd000);
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
    const ear = new THREE.ConeGeometry(0.06, 0.15, 4);
    add(head, ear, dark, -0.09, 0.2, 0.03);
    add(head, ear, dark, 0.09, 0.2, 0.03);
    const legs = [];
    for (const [x, z] of [[-0.14, -0.4], [0.14, -0.4], [-0.14, 0.42], [0.14, 0.42]]) {
      const leg = group(body, x, 0.58, z);
      add(leg, box(0.1, 0.58, 0.1), dark, 0, -0.29, 0);
      legs.push(leg);
    }
    const tail = group(body, 0, 0.85, 0.55);
    const t = add(tail, new THREE.CylinderGeometry(0.07, 0.04, 0.55, 6), fur, 0, -0.25, 0);
    tail.rotation.x = 2.3;
    t.castShadow = true;
    return { root, body, head, legs, tail, flashMats: [fur] };
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

  return { ARROW_LEN, GORILLA_HEIGHT, arrow, bow, rpg, rocket, player, monkey, wolf, gorilla, banana, medkit, rocketBag, textTexture, mat, add, group };
})();
