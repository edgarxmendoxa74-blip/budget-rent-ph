import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function radialTexture(size, stops) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

function badgeTexture() {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(90, 80, 10, s / 2, s / 2, s / 2);
  grad.addColorStop(0, '#FFE585');
  grad.addColorStop(0.55, '#FFB800');
  grad.addColorStop(1, '#C66A05');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#003B7A';
  g.font = '800 168px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('₱', s / 2, s / 2 + 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildBudi() {
  const root = new THREE.Group();
  const bear = new THREE.Group();
  root.add(bear);

  const fur = new THREE.MeshStandardMaterial({ color: 0xc98545, roughness: 0.85 });
  const furDark = new THREE.MeshStandardMaterial({ color: 0xa8642a, roughness: 0.9 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xf6d9b0, roughness: 0.85 });
  const earIn = new THREE.MeshStandardMaterial({ color: 0xe9a98a, roughness: 0.9 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x0e4fa0, roughness: 0.75 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffb800, roughness: 0.5, metalness: 0.1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1006, roughness: 0.25 });
  const nose = new THREE.MeshStandardMaterial({ color: 0x2b1a08, roughness: 0.2 });
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pink = new THREE.MeshStandardMaterial({ color: 0xff8fa3, roughness: 0.9, transparent: true, opacity: 0.55 });
  const mouthIn = new THREE.MeshStandardMaterial({ color: 0x7a2e2e, roughness: 0.6 });

  const sphere = new THREE.SphereGeometry(1, 28, 20);
  const mk = (geo, mat, pos, scale, parent) => {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(...pos);
    if (scale) m.scale.set(...scale);
    parent.add(m);
    return m;
  };

  // ---- feet
  [-1, 1].forEach((s) => {
    mk(sphere, furDark, [s * 0.58, 0.38, 0.28], [0.44, 0.34, 0.55], bear);
    mk(sphere, cream, [s * 0.58, 0.32, 0.72], [0.26, 0.2, 0.14], bear);
  });

  // ---- torso
  mk(sphere, blue, [0, 1.35, 0], [1.0, 1.08, 0.9], bear);
  const stripe = mk(new THREE.TorusGeometry(0.985, 0.13, 16, 48), yellow, [0, 1.2, 0], [1, 0.9, 1], bear);
  stripe.rotation.x = Math.PI / 2;
  const collar = mk(new THREE.TorusGeometry(0.6, 0.1, 14, 40), yellow, [0, 2.42, 0.02], [1, 0.9, 1], bear);
  collar.rotation.x = Math.PI / 2;
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.25, 40), new THREE.MeshStandardMaterial({ map: badgeTexture(), roughness: 0.5 }));
  badge.position.set(0, 0.72, 0.78);
  badge.rotation.x = 0.5;
  bear.add(badge);

  // ---- arms (pivot at shoulder, hang down -y)
  const makeArm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.92, 2.0, 0.05);
    mk(new THREE.CapsuleGeometry(0.31, 0.6, 8, 20), blue, [0, -0.55, 0], null, pivot);
    const cuff = mk(new THREE.TorusGeometry(0.3, 0.075, 12, 28), yellow, [0, -1.0, 0], null, pivot);
    cuff.rotation.x = Math.PI / 2;
    mk(sphere, furDark, [0, -1.2, 0], [0.28, 0.28, 0.28], pivot);
    bear.add(pivot);
    return pivot;
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // ---- head (pivot near the neck)
  const HY = 2.5;
  const head = new THREE.Group();
  head.position.set(0, HY, 0);
  bear.add(head);
  const hp = (x, y, z) => [x, y - HY, z];

  mk(sphere, fur, hp(0, 3.15, 0), [1.05, 0.92, 0.95], head);
  [-1, 1].forEach((s) => {
    mk(sphere, furDark, hp(s * 0.8, 3.85, -0.05), [0.38, 0.38, 0.26], head);
    mk(sphere, earIn, hp(s * 0.8, 3.85, 0.05), [0.24, 0.24, 0.16], head);
  });
  mk(sphere, cream, hp(0, 2.97, 0.72), [0.44, 0.34, 0.34], head);
  mk(sphere, nose, hp(0, 3.13, 1.03), [0.17, 0.12, 0.12], head);
  mk(sphere, white, hp(-0.05, 3.16, 1.13), [0.04, 0.025, 0.02], head);

  // cheeks
  [-1, 1].forEach((s) => {
    const c = mk(sphere, pink, hp(s * 0.68, 2.93, 0.66), [0.17, 0.12, 0.05], head);
    c.rotation.y = s * 0.75;
  });

  // eyes (grouped so they can look around)
  const eyes = new THREE.Group();
  head.add(eyes);
  [-1, 1].forEach((s) => {
    mk(sphere, dark, hp(s * 0.36, 3.3, 0.85), [0.11, 0.13, 0.08], eyes);
    mk(sphere, white, hp(s * 0.36 + 0.035, 3.35, 0.92), [0.035, 0.035, 0.02], eyes);
  });

  // brows (thinking)
  const brows = new THREE.Group();
  head.add(brows);
  [-1, 1].forEach((s) => {
    const b = mk(new THREE.CapsuleGeometry(0.03, 0.2, 4, 8), dark, hp(s * 0.36, 3.55, 0.82), null, brows);
    b.rotation.z = Math.PI / 2 + s * 0.15;
  });

  // star eyes (idea)
  const starEyes = new THREE.Group();
  head.add(starEyes);
  const starShape = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? 0.17 : 0.06;
    const a = (i / 8) * Math.PI * 2 + Math.PI / 2;
    i === 0 ? starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r) : starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  starShape.closePath();
  const starGeo = new THREE.ShapeGeometry(starShape);
  [-1, 1].forEach((s) => {
    const st = mk(starGeo, new THREE.MeshBasicMaterial({ color: 0xffd34d }), hp(s * 0.36, 3.3, 0.93), null, starEyes);
    st.name = 'star';
  });

  // mouths
  const mouthSmile = mk(new THREE.TorusGeometry(0.12, 0.022, 8, 24, Math.PI), dark, hp(0, 2.98, 1.0), null, head);
  mouthSmile.rotation.z = Math.PI;
  const mouthHmm = mk(new THREE.CapsuleGeometry(0.022, 0.16, 4, 8), dark, hp(0.03, 2.9, 1.0), null, head);
  mouthHmm.rotation.z = Math.PI / 2 - 0.15;
  const mouthOpen = new THREE.Group();
  mouthOpen.position.set(...hp(0, 2.9, 0.98));
  mk(sphere, mouthIn, [0, 0, 0], [0.17, 0.15, 0.08], mouthOpen);
  mk(sphere, pink, [0, -0.06, 0.03], [0.09, 0.06, 0.04], mouthOpen);
  head.add(mouthOpen);

  // ---- ground shadow
  const shadowTex = radialTexture(128, [[0, 'rgba(0,0,0,.55)'], [0.6, 'rgba(0,0,0,.2)'], [1, 'rgba(0,0,0,0)']]);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  // ---- thought bubble
  const thought = new THREE.Group();
  thought.position.set(0, 0, 0);
  const bubbleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0.25 });
  mk(sphere, bubbleMat, [1.55, 4.55, 0.2], [0.12, 0.12, 0.12], thought);
  mk(sphere, bubbleMat, [1.85, 4.95, 0.2], [0.2, 0.2, 0.2], thought);
  const cloud = new THREE.Group();
  cloud.position.set(2.55, 5.65, 0.2);
  mk(sphere, bubbleMat, [0, 0, 0], [1.15, 0.78, 0.4], cloud);
  mk(sphere, bubbleMat, [-0.6, 0.25, 0], [0.55, 0.5, 0.36], cloud);
  mk(sphere, bubbleMat, [0.6, 0.28, 0], [0.55, 0.5, 0.36], cloud);
  const dotMat = new THREE.MeshStandardMaterial({ color: 0x003b7a, roughness: 0.4 });
  const dots = [-0.4, 0, 0.4].map((x) => mk(sphere, dotMat, [x, -0.02, 0.4], [0.11, 0.11, 0.11], cloud));
  thought.add(cloud);
  thought.scale.setScalar(0.0001);
  root.add(thought);

  // ---- light bulb
  const bulb = new THREE.Group();
  bulb.position.set(2.55, 5.55, 0.3);
  const glass = new THREE.MeshStandardMaterial({ color: 0xffc933, emissive: 0xffb800, emissiveIntensity: 1.1, roughness: 0.2 });
  mk(sphere, glass, [0, 0.1, 0], [0.62, 0.66, 0.62], bulb);
  mk(new THREE.CylinderGeometry(0.28, 0.24, 0.3, 20), blue, [0, -0.62, 0], null, bulb);
  mk(new THREE.CylinderGeometry(0.2, 0.16, 0.18, 20), new THREE.MeshStandardMaterial({ color: 0x002652, roughness: 0.6 }), [0, -0.84, 0], null, bulb);
  const glowTex = radialTexture(128, [[0, 'rgba(255,220,90,.95)'], [0.4, 'rgba(255,200,60,.45)'], [1, 'rgba(255,190,40,0)']]);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.scale.set(4.2, 4.2, 1);
  glow.position.set(0, 0.1, -0.1);
  bulb.add(glow);
  const rays = new THREE.Group();
  const rayMat = new THREE.MeshBasicMaterial({ color: 0xffd34d });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = mk(new THREE.CapsuleGeometry(0.035, 0.22, 4, 8), rayMat, [Math.cos(a) * 1.05, 0.1 + Math.sin(a) * 1.05, 0], null, rays);
    r.rotation.z = a - Math.PI / 2;
  }
  bulb.add(rays);
  const bulbLight = new THREE.PointLight(0xffc933, 0, 14, 1.6);
  bulbLight.position.set(0, 0.2, 1.5);
  bulb.add(bulbLight);
  bulb.scale.setScalar(0.0001);
  root.add(bulb);

  return { root, bear, head, eyes, brows, starEyes, mouthSmile, mouthHmm, mouthOpen, armL, armR, shadow, thought, dots, bulb, rays, glow, bulbLight };
}

export default function BudiScene({ phase = 'hop', lite = false, onReady, onFail }) {
  const mountRef = useRef(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    const mount = mountRef.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !lite, alpha: true, powerPreference: 'low-power' });
    } catch {
      onFail?.();
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1.25 : 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 3.7, 15);
    camera.lookAt(0, 3.0, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a6a4a, 1.25));
    const key = new THREE.DirectionalLight(0xfff1dc, 2.6); key.position.set(4, 7, 8); scene.add(key);
    const fill = new THREE.DirectionalLight(0x9cc4ff, 1.0); fill.position.set(-6, 3, 4); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffd27a, 1.6); rim.position.set(0, 4, -8); scene.add(rim);

    const b = buildBudi();
    scene.add(b.root);

    const resize = () => {
      const w = mount.clientWidth || 300;
      const h = mount.clientHeight || 320;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // smoothed pose values
    const cur = { rotY: 0, headZ: 0, headX: 0, aLz: -0.15, aLx: 0, aRz: 0.15, aRx: 0, thoughtS: 0, bulbS: 0, eyeX: 0, eyeY: 0 };
    let lastPhase = null;
    let phaseStart = 0;
    let raf;
    let readyFired = false;
    let visible = true;
    let lastDraw = 0;
    // Huwag mag-render kapag wala sa screen / nakatago ang tab — para hindi bumagal ang scroll at hindi maubos ang baterya
    const io = new IntersectionObserver((entries) => { visible = entries[0]?.isIntersecting !== false; });
    io.observe(mount);
    const clock = new THREE.Clock();
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible || document.hidden) { clock.getDelta(); return; }
      const t0 = performance.now();
      // hero Budi: 30fps lang ay sapat na at mas magaan sa scroll
      if (lite && t0 - lastDraw < 33) return;
      lastDraw = t0;
      const dt = Math.min(clock.getDelta(), 0.05);
      const now = clock.elapsedTime;
      const ph = phaseRef.current;
      if (ph !== lastPhase) {
        // keep rotation continuous when a spin ends
        cur.rotY = wrapPi(cur.rotY);
        lastPhase = ph;
        phaseStart = now;
      }
      const tp = now - phaseStart;
      const k = 1 - Math.exp(-dt * 10);
      const lerp = (key2, target) => { cur[key2] += (target - cur[key2]) * k; };

      let posY = 0, sx = 1, sy = 1;
      let tgt = { headZ: 0, headX: 0, aLz: -0.15, aLx: 0, aRz: 0.15, aRx: 0, thoughtS: 0, bulbS: 0, eyeX: 0, eyeY: 0 };
      let mouth = 'smile';

      if (ph === 'hop') {
        const p = 0.55;
        const h = Math.abs(Math.sin((Math.PI * tp) / p));
        posY = reduced ? 0 : h * 1.1;
        const land = 1 - h;
        sx = 1 + 0.06 * land; sy = 1 - 0.08 * land;
        cur.rotY = reduced ? 0 : easeInOut(clamp01(tp / 1.65)) * Math.PI * 2;
        tgt.aLz = -(0.3 + 1.6 * h); tgt.aRz = 0.3 + 1.6 * h;
        tgt.headZ = Math.sin(tp * 6) * 0.05;
      } else if (ph === 'think') {
        const sway = Math.sin(tp * 1.7);
        lerp('rotY', -0.35 + sway * 0.14);
        tgt.headZ = -0.17 + Math.sin(tp * 1.7) * 0.04;
        tgt.headX = -0.14;
        tgt.eyeX = 0.05; tgt.eyeY = 0.03;
        tgt.aRz = -2.6; tgt.aRx = 0.9;
        tgt.aLz = -0.12;
        tgt.thoughtS = 1;
        mouth = 'hmm';
        posY = 0;
      } else if (ph === 'wave') {
        // paikot na 4s: tatalon muna (2x), pagkatapos kakaway
        const c = tp % 4;
        lerp('rotY', -0.12);
        if (c < 1.6) {
          const hh = reduced ? 0 : Math.abs(Math.sin((Math.PI * c) / 0.8));
          posY = hh * 0.45;
          sx = 1 + 0.05 * (1 - hh); sy = 1 - 0.07 * (1 - hh);
          tgt.aLz = -(0.3 + 1.6 * hh); tgt.aRz = 0.3 + 1.6 * hh;
          tgt.headZ = Math.sin(tp * 6) * 0.05;
        } else {
          const w = c - 1.6;
          tgt.aLz = -(2.5 + Math.sin(w * 9) * 0.42);
          tgt.aRz = 0.12;
          tgt.headZ = 0.07 + Math.sin(w * 9) * 0.035;
          posY = Math.abs(Math.sin(tp * 2.2)) * 0.03;
        }
      } else if (ph === 'travel') {
        // naglalakad: tatalbog nang bahagya, nagwawagayway ang mga braso, nakatagilid na tanaw
        const s = tp * 7;
        const step = Math.abs(Math.sin(s));
        posY = reduced ? 0 : step * 0.28;
        sx = 1 + 0.04 * (1 - step); sy = 1 - 0.05 * (1 - step);
        lerp('rotY', -0.4);
        tgt.aLz = -0.12; tgt.aRz = 0.12;
        if (!reduced) {
          tgt.aLx = Math.sin(s) * 0.75;
          tgt.aRx = -Math.sin(s) * 0.75;
          tgt.headZ = Math.sin(s) * 0.06;
        }
      } else {
        // idea + exit
        const T = 0.15;
        const q = Math.max(0, tp - T);
        const h = ph === 'idea' ? (q < 1.8 ? Math.abs(Math.sin((Math.PI * q) / 0.6)) : 0) : 0;
        posY = reduced ? 0 : h * 1.1;
        const land = 1 - h;
        sx = 1 + 0.05 * land; sy = 1 - 0.06 * land;
        if (ph === 'idea' && !reduced && q < 1.1) cur.rotY = -0.35 + easeInOut(clamp01(q / 1.0)) * Math.PI * 2;
        else lerp('rotY', wrapPi(-0.1));
        tgt.aLz = -2.9; tgt.aRz = 2.9;
        tgt.headX = -0.1;
        tgt.bulbS = 1;
        mouth = 'open';
      }

      ['headZ', 'headX', 'aLz', 'aLx', 'aRz', 'aRx', 'eyeX', 'eyeY'].forEach((n) => lerp(n, tgt[n]));
      cur.thoughtS += (tgt.thoughtS - cur.thoughtS) * (1 - Math.exp(-dt * (tgt.thoughtS ? 9 : 25)));

      b.bear.position.y = posY;
      b.bear.scale.set(sx, sy, sx);
      b.bear.rotation.y = cur.rotY;
      b.head.rotation.z = cur.headZ;
      b.head.rotation.x = cur.headX;
      b.armL.rotation.set(cur.aLx, 0, cur.aLz);
      b.armR.rotation.set(cur.aRx, 0, cur.aRz);
      b.eyes.position.set(cur.eyeX, cur.eyeY, 0);
      b.brows.visible = ph === 'think';
      b.eyes.visible = mouth !== 'open';
      b.starEyes.visible = mouth === 'open';
      b.mouthSmile.visible = mouth === 'smile';
      b.mouthHmm.visible = mouth === 'hmm';
      b.mouthOpen.visible = mouth === 'open';
      const shS = Math.max(0.4, 1 - posY * 0.35);
      b.shadow.scale.set(shS, shS, shS);
      b.shadow.material.opacity = shS;

      // thought bubble
      const ts = ph === 'think' ? easeOutBack(clamp01(cur.thoughtS)) : cur.thoughtS;
      b.thought.scale.setScalar(Math.max(0.0001, ts));
      b.thought.position.y = Math.sin(now * 3) * 0.06;
      b.dots.forEach((d, i) => { d.position.y = -0.02 + Math.max(0, Math.sin(now * 6 - i * 0.6)) * 0.14; });

      // bulb
      const bp = ph === 'hop' || ph === 'think' || ph === 'wave' || ph === 'travel' ? 0 : ph === 'exit' ? 1 : clamp01((tp - 0.05) / 0.55);
      const bs = bp === 0 ? 0.0001 : Math.max(0.0001, easeOutBack(bp));
      b.bulb.scale.setScalar(bs);
      b.bulb.rotation.z = Math.sin(now * 8) * 0.05;
      b.rays.rotation.z = now * 0.8;
      const pulse = 0.75 + Math.sin(now * 10) * 0.25;
      b.glow.material.opacity = pulse;
      b.bulbLight.intensity = bp * 18 * pulse;
      b.starEyes.children.forEach((s) => { s.rotation.z = Math.sin(now * 9) * 0.25; s.scale.setScalar(0.9 + Math.sin(now * 12) * 0.12); });

      renderer.render(scene, camera);
      if (!readyFired) { readyFired = true; onReady?.(); }
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        mats.forEach((m) => { m.map?.dispose(); m.dispose(); });
      });
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="budi-3d" ref={mountRef} role="img" aria-label="Budi, the BudgetRent teddy bear mascot" />;
}
