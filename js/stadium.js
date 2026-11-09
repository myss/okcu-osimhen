// Finale: the player walks into a packed, cheering RAMS Park.
const Stadium = (() => {
  'use strict';
  const V3 = THREE.Vector3;
  const CROWD = 6000;
  const SX = 1.35; // stands are a circle stretched into an oval along x

  function pitchTexture() {
    return Models.textTexture(1024, 1024, (g, w, h) => {
      const px = w / 105, pz = h / 68;
      for (let i = 0; i < 14; i++) {
        g.fillStyle = i % 2 ? '#2f8a3a' : '#38994a';
        g.fillRect((i * w) / 14, 0, w / 14 + 1, h);
      }
      g.strokeStyle = '#ffffff';
      g.lineWidth = 5;
      g.strokeRect(4, 4, w - 8, h - 8);
      g.beginPath();
      g.moveTo(w / 2, 0);
      g.lineTo(w / 2, h);
      g.stroke();
      g.beginPath();
      g.ellipse(w / 2, h / 2, 9.15 * px, 9.15 * pz, 0, 0, Math.PI * 2);
      g.stroke();
      for (const side of [0, 1]) {
        const x = side ? w - 16.5 * px : 0;
        g.strokeRect(x, h / 2 - 20.16 * pz, 16.5 * px, 40.32 * pz);
        const x2 = side ? w - 5.5 * px : 0;
        g.strokeRect(x2, h / 2 - 9.16 * pz, 5.5 * px, 18.32 * pz);
      }
    });
  }

  function bannerTexture() {
    const t = Models.textTexture(2048, 128, (g, w, h) => {
      const words = ['OSİMHEN 45', 'CİMBOM', 'ŞAMPİYON', 'GALATASARAY'];
      const seg = w / words.length;
      words.forEach((word, i) => {
        g.fillStyle = i % 2 ? '#f7b500' : '#a90432';
        g.fillRect(i * seg, 0, seg, h);
        g.fillStyle = i % 2 ? '#a90432' : '#f7b500';
        g.font = 'bold 78px Arial Black, Arial';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(word, i * seg + seg / 2, h / 2 + 4);
      });
    });
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(-4, 1);
    return t;
  }

  function create() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e1838);
    scene.fog = new THREE.Fog(0x0e1838, 160, 420);
    scene.add(new THREE.HemisphereLight(0xc8d8ff, 0x1d2a1d, 0.75));
    const flood = new THREE.DirectionalLight(0xffffff, 0.85);
    flood.position.set(20, 60, 30);
    flood.castShadow = true;
    flood.shadow.mapSize.set(1024, 1024);
    Object.assign(flood.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 150 });
    scene.add(flood);

    const surround = new THREE.Mesh(new THREE.PlaneGeometry(170, 130), Models.mat(0x245a2c));
    surround.rotation.x = -Math.PI / 2;
    surround.position.y = -0.02;
    scene.add(surround);
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(105, 68), new THREE.MeshLambertMaterial({ map: pitchTexture() }));
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    scene.add(pitch);

    for (const s of [-1, 1]) {
      const goal = new THREE.Group();
      const white = Models.mat(0xffffff);
      for (const z of [-3.66, 3.66]) Models.add(goal, new THREE.BoxGeometry(0.12, 2.44, 0.12), white, 0, 1.22, z);
      Models.add(goal, new THREE.BoxGeometry(0.12, 0.12, 7.44), white, 0, 2.44, 0);
      goal.position.x = s * 52.5;
      scene.add(goal);
    }

    const stands = new THREE.Mesh(
      new THREE.LatheGeometry([[44, 0], [44, 3], [70, 29], [72, 30], [72, 0]].map(([x, y]) => new THREE.Vector2(x, y)), 72),
      Models.mat(0x34343f, { side: THREE.DoubleSide })
    );
    stands.scale.x = SX;
    scene.add(stands);

    const wall = new THREE.Mesh(new THREE.CylinderGeometry(43.9, 43.9, 3, 72, 1, true), new THREE.MeshBasicMaterial({ map: bannerTexture(), side: THREE.BackSide }));
    wall.scale.x = SX;
    wall.position.y = 1.5;
    scene.add(wall);

    const roof = new THREE.Mesh(
      new THREE.LatheGeometry([[58, 37], [74, 33], [74, 34], [58, 38]].map(([x, y]) => new THREE.Vector2(x, y)), 72),
      Models.mat(0xa90432, { side: THREE.DoubleSide })
    );
    roof.scale.x = SX;
    scene.add(roof);

    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfffbe8 });
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(3, 0.6, 1.2), lampMat);
      lamp.position.set(Math.cos(a) * 60 * SX, 36.5, Math.sin(a) * 60);
      lamp.lookAt(0, 0, 0);
      scene.add(lamp);
    }

    // Crowd: one instanced box per fan, bouncing on the stands.
    const crowd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 1.1, 0.6), Models.mat(0xffffff), CROWD);
    const base = new Float32Array(CROWD);
    const phase = new Float32Array(CROWD);
    {
      const m = new THREE.Matrix4(), col = new THREE.Color();
      const palette = [0xf7b500, 0xf7b500, 0xa90432, 0xa90432, 0xffffff, 0xe0102f];
      for (let i = 0; i < CROWD; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = Math.random();
        const r = 45 + 25 * s;
        const y = 3.9 + 26 * s;
        m.makeTranslation(Math.cos(a) * r * SX, y, Math.sin(a) * r);
        crowd.setMatrixAt(i, m);
        crowd.setColorAt(i, col.setHex(palette[i % palette.length]));
        base[i] = y;
        phase[i] = Math.random() * Math.PI * 2;
      }
    }
    scene.add(crowd);

    // Confetti
    const CONFETTI = 1500;
    const confGeo = new THREE.BufferGeometry();
    const confPos = new Float32Array(CONFETTI * 3), confCol = new Float32Array(CONFETTI * 3);
    {
      const c = new THREE.Color();
      for (let i = 0; i < CONFETTI; i++) {
        confPos.set([(Math.random() - 0.5) * 60, Math.random() * 30, (Math.random() - 0.5) * 40], i * 3);
        c.setHex(i % 2 ? 0xf7b500 : 0xc4002b);
        confCol.set([c.r, c.g, c.b], i * 3);
      }
    }
    confGeo.setAttribute('position', new THREE.BufferAttribute(confPos, 3));
    confGeo.setAttribute('color', new THREE.BufferAttribute(confCol, 3));
    scene.add(new THREE.Points(confGeo, new THREE.PointsMaterial({ size: 0.35, vertexColors: true })));

    // Fireworks above the stands
    const bursts = [];
    let fireworkT = 0;
    function launchFirework() {
      const N = 140;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(N * 3), vel = [];
      const center = new V3((Math.random() - 0.5) * 140, 45 + Math.random() * 20, (Math.random() - 0.5) * 90);
      for (let i = 0; i < N; i++) {
        pos.set([center.x, center.y, center.z], i * 3);
        vel.push(new V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(14 + Math.random() * 6));
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const color = [0xf7b500, 0xff2a3a, 0xffffff, 0xffd060][Math.floor(Math.random() * 4)];
      const mat = new THREE.PointsMaterial({ color, size: 1.2, transparent: true, fog: false });
      const pts = new THREE.Points(geo, mat);
      scene.add(pts);
      bursts.push({ pts, vel, t: 0 });
      Sound.firework();
    }

    let t = 0;
    let rig = null;
    const walkFrom = new V3(0, 0, 30);

    return {
      scene,
      enter(playerRig) {
        rig = playerRig;
        scene.add(rig.root);
        rig.root.position.copy(walkFrom);
        rig.root.rotation.set(0, 0, 0);
        t = 0;
      },
      update(dt, camera) {
        t += dt;
        const arr = crowd.instanceMatrix.array;
        for (let i = 0; i < CROWD; i++) arr[i * 16 + 13] = base[i] + Math.max(0, Math.sin(t * 9 + phase[i])) * 0.6;
        crowd.instanceMatrix.needsUpdate = true;

        for (let i = 0; i < CONFETTI; i++) {
          let y = confPos[i * 3 + 1] - dt * (1.5 + (i % 7) * 0.2);
          if (y < 0) y += 30;
          confPos[i * 3 + 1] = y;
          confPos[i * 3] += Math.sin(t * 2 + i) * dt * 0.6;
        }
        confGeo.attributes.position.needsUpdate = true;

        fireworkT -= dt;
        if (fireworkT <= 0) {
          fireworkT = 0.5 + Math.random() * 0.7;
          launchFirework();
        }
        for (let i = bursts.length - 1; i >= 0; i--) {
          const b = bursts[i];
          b.t += dt;
          const p = b.pts.geometry.attributes.position;
          for (let k = 0; k < b.vel.length; k++) {
            b.vel[k].y -= 6 * dt;
            b.vel[k].multiplyScalar(1 - dt * 0.8);
            p.setXYZ(k, p.getX(k) + b.vel[k].x * dt, p.getY(k) + b.vel[k].y * dt, p.getZ(k) + b.vel[k].z * dt);
          }
          p.needsUpdate = true;
          b.pts.material.opacity = Math.max(0, 1 - b.t / 2);
          if (b.t > 2) {
            scene.remove(b.pts);
            b.pts.geometry.dispose();
            b.pts.material.dispose();
            bursts.splice(i, 1);
          }
        }

        // Walk to the center spot, then celebrate.
        const walk = Math.min(1, t / 4);
        rig.root.position.z = walkFrom.z * (1 - walk);
        if (walk < 1) {
          const ph = t * 11;
          rig.legs[0].rotation.x = Math.sin(ph) * 0.8;
          rig.legs[1].rotation.x = -Math.sin(ph) * 0.8;
          rig.root.position.y = Math.abs(Math.sin(ph)) * 0.05;
          rig.cheer(t);
          rig.root.rotation.y = 0;
        } else {
          rig.legs[0].rotation.x = rig.legs[1].rotation.x = 0;
          rig.root.position.y = Math.abs(Math.sin(t * 5)) * 0.45;
          rig.root.rotation.y = Math.PI + Math.sin(t * 0.6) * 0.6;
          rig.cheer(t);
        }

        const target = rig.root.position;
        const a = t * 0.3 + 0.3;
        const r = 9 - Math.min(1, t / 6) * 2;
        camera.position.set(target.x + Math.sin(a) * r, 2.6 + Math.sin(t * 0.5) * 0.6, target.z + Math.cos(a) * r);
        camera.lookAt(target.x, 1.4, target.z);
      },
    };
  }

  return { create };
})();
