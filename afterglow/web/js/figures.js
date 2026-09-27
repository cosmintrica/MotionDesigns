'use strict';
// ---------------------------------------------------------------------------
// Silhouette people: a tiny forward-kinematics rig drawn as tapered capsules.
// Angles are degrees measured from "straight down", positive = forward (+x).
// Figures face +x; mirror with opts.flip. Root = hip point.
// ---------------------------------------------------------------------------

const Fig = (() => {
  const R = Math.PI / 180;
  const d = (a) => [Math.sin(a * R), Math.cos(a * R)];

  const BODY = {
    adult: { head: 0.064, neck: 0.04, torso: 0.3, chest: 0.16, waist: 0.13, hipD: 0.14, shoulderW: 0.25, hipW: 0.17,
      uarm: 0.17, farm: 0.15, hand: 0.026, thigh: 0.245, shin: 0.235, foot: 0.07,
      wUarm: 0.06, wFarm: 0.046, wThigh: 0.095, wShin: 0.064, wAnkle: 0.038 },
    woman: { head: 0.064, neck: 0.042, torso: 0.29, chest: 0.145, waist: 0.105, hipD: 0.15, shoulderW: 0.22, hipW: 0.19,
      uarm: 0.165, farm: 0.145, hand: 0.023, thigh: 0.25, shin: 0.235, foot: 0.065,
      wUarm: 0.05, wFarm: 0.04, wThigh: 0.09, wShin: 0.058, wAnkle: 0.033 },
    child: { head: 0.09, neck: 0.03, torso: 0.28, chest: 0.155, waist: 0.14, hipD: 0.145, shoulderW: 0.23, hipW: 0.17,
      uarm: 0.155, farm: 0.135, hand: 0.032, thigh: 0.215, shin: 0.2, foot: 0.078,
      wUarm: 0.064, wFarm: 0.054, wThigh: 0.097, wShin: 0.072, wAnkle: 0.046 },
    teen: { head: 0.07, neck: 0.04, torso: 0.3, chest: 0.145, waist: 0.12, hipD: 0.135, shoulderW: 0.23, hipW: 0.17,
      uarm: 0.17, farm: 0.15, hand: 0.025, thigh: 0.25, shin: 0.24, foot: 0.068,
      wUarm: 0.054, wFarm: 0.043, wThigh: 0.086, wShin: 0.06, wAnkle: 0.035 },
    elder: { head: 0.07, neck: 0.03, torso: 0.29, chest: 0.18, waist: 0.17, hipD: 0.18, shoulderW: 0.25, hipW: 0.2,
      uarm: 0.16, farm: 0.145, hand: 0.027, thigh: 0.235, shin: 0.225, foot: 0.07,
      wUarm: 0.064, wFarm: 0.052, wThigh: 0.1, wShin: 0.068, wAnkle: 0.044 },
  };

  function lerpBody(a, b, k) {
    const A = BODY[a], B = BODY[b], o = {};
    for (const key in A) o[key] = lerp(A[key], B[key], k);
    return o;
  }

  // tapered capsule between two points
  function capsule(ctx, ax, ay, bx, by, ra, rb) {
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-6;
    const ang = Math.atan2(dy, dx);
    const s = clamp((ra - rb) / L, -0.99, 0.99);
    const phi = Math.acos(s);
    ctx.moveTo(ax + ra * Math.cos(ang + phi), ay + ra * Math.sin(ang + phi));
    ctx.arc(ax, ay, ra, ang + phi, ang - phi + TAU, false);
    ctx.arc(bx, by, rb, ang - phi, ang + phi, false);
    ctx.closePath();
  }

  // Build joint positions. pose fields (deg): lean, neck, shL, elL, shR, elR, hipL, knL, hipR, knR, ankL, ankR
  function solve(body, S, pose) {
    const B = body;
    const lean = pose.lean || 0;
    const J = {};
    J.hip = [0, 0];
    const td = d(180 - lean);
    const tl = B.torso * S * (pose.torsoScale || 1);
    J.neck = [td[0] * tl, td[1] * tl];
    const nd = d(180 - lean - (pose.neck || 0));
    const nl = B.neck * S;
    J.headBase = [J.neck[0] + nd[0] * nl, J.neck[1] + nd[1] * nl];
    const hr = B.head * S;
    J.head = [J.headBase[0] + nd[0] * hr * 0.92, J.headBase[1] + nd[1] * hr * 0.92];
    J.headR = hr;
    J.headDir = nd;
    J.shoulder = [td[0] * tl * 0.93, td[1] * tl * 0.93];
    const front = pose.view === 'front';
    const arm = (sh, el, side) => {
      const off = front ? side * B.shoulderW * S * 0.5 : 0;
      const s0 = [J.shoulder[0] + off, J.shoulder[1] + (front ? B.chest * S * 0.12 : 0)];
      const a1 = front ? -lean * 0 + sh * side : -lean + sh;
      const u = d(a1), ul = B.uarm * S * (pose.armScale || 1);
      const e = [s0[0] + u[0] * ul, s0[1] + u[1] * ul];
      const a2 = front ? a1 + el * side : a1 + el;
      const f = d(a2), fl = B.farm * S * (pose.armScale || 1);
      const h = [e[0] + f[0] * fl, e[1] + f[1] * fl];
      return { s: s0, e, h };
    };
    J.armL = arm(pose.shL || 0, pose.elL || 0, -1);
    J.armR = arm(pose.shR || 0, pose.elR || 0, 1);
    const leg = (hp, kn, ank, side, scale) => {
      const off = front ? side * B.hipW * S * 0.3 : 0;
      const h0 = [off, 0];
      const a1 = front ? hp * side : hp;
      const u = d(a1), tlen = B.thigh * S * (scale ?? 1);
      const k = [h0[0] + u[0] * tlen, h0[1] + u[1] * tlen];
      const a2 = front ? a1 - kn * side : a1 - kn;
      const s = d(a2), sl = B.shin * S;
      const a = [k[0] + s[0] * sl, k[1] + s[1] * sl];
      const fa = front ? 0 : a2 + 90 - (ank || 0);
      const fd = d(fa);
      const fl = B.foot * S;
      const toe = front ? [a[0] + side * fl * 0.3, a[1] + fl * 0.15] : [a[0] + fd[0] * fl, a[1] + fd[1] * fl];
      return { h: h0, k, a, toe };
    };
    J.legL = leg(pose.hipL || 0, pose.knL || 0, pose.ankL || 0, -1, pose.thighScaleL ?? pose.thighScale);
    J.legR = leg(pose.hipR || 0, pose.knR || 0, pose.ankR || 0, 1, pose.thighScaleR ?? pose.thighScale);
    return J;
  }

  function drawBodyPath(ctx, B, S, J, pose, o) {
    const front = pose.view === 'front';
    // torso
    const lean = pose.lean || 0;
    const td = d(180 - lean), perp = [td[1], -td[0]]; // perpendicular (points forward-ish)
    const cw = (front ? B.shoulderW * 0.5 : B.chest * 0.5) * S * (o.bulk || 1);
    const ww = (front ? B.shoulderW * 0.36 : B.waist * 0.5) * S * (o.bulk || 1);
    const hw = (front ? B.hipW * 0.5 : B.hipD * 0.5) * S * (o.bulk || 1);
    const sh = J.shoulder, nk = J.neck;
    const hump = o.hump || 0; // stooped back for grandparents
    const P = (x, y) => [x, y];
    const pts = [
      P(-perp[0] * hw, -perp[1] * hw),
      P(-perp[0] * ww + td[0] * S * 0.12, -perp[1] * ww + td[1] * S * 0.12),
      P(-perp[0] * (cw + hump * S) + sh[0] * 0.8, -perp[1] * (cw + hump * S) + sh[1] * 0.8),
      P(-perp[0] * cw * 0.7 + nk[0], -perp[1] * cw * 0.7 + nk[1]),
      P(perp[0] * cw * 0.7 + nk[0], perp[1] * cw * 0.7 + nk[1]),
      P(perp[0] * cw + sh[0] * 0.8, perp[1] * cw + sh[1] * 0.8),
      P(perp[0] * ww + td[0] * S * 0.12, perp[1] * ww + td[1] * S * 0.12),
      P(perp[0] * hw, perp[1] * hw),
    ];
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i], q = pts[i - 1];
      ctx.quadraticCurveTo(q[0], q[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    ctx.closePath();
    ctx.fill();
    const F = (fn) => { ctx.beginPath(); fn(); ctx.fill(); };
    // hips / pelvis
    F(() => ctx.ellipse(0, 0, hw * 1.02, hw * 0.95, Math.atan2(td[1], td[0]), 0, TAU));
    // neck
    F(() => capsule(ctx, J.neck[0], J.neck[1], J.headBase[0], J.headBase[1], B.head * S * 0.42, B.head * S * 0.4));
    // head
    F(() => ctx.arc(J.head[0], J.head[1], J.headR, 0, TAU));
    // legs
    for (const L of [J.legL, J.legR]) {
      F(() => capsule(ctx, L.h[0], L.h[1], L.k[0], L.k[1], B.wThigh * S * 0.5, B.wShin * S * 0.55));
      F(() => capsule(ctx, L.k[0], L.k[1], L.a[0], L.a[1], B.wShin * S * 0.5, B.wAnkle * S * 0.5));
      F(() => capsule(ctx, L.a[0], L.a[1], L.toe[0], L.toe[1], B.wAnkle * S * 0.55, B.wAnkle * S * 0.38));
    }
    // arms
    for (const A of [J.armL, J.armR]) {
      F(() => capsule(ctx, A.s[0], A.s[1], A.e[0], A.e[1], B.wUarm * S * 0.5, B.wFarm * S * 0.55));
      F(() => capsule(ctx, A.e[0], A.e[1], A.h[0], A.h[1], B.wFarm * S * 0.5, B.hand * S * 0.8));
      F(() => ctx.arc(A.h[0], A.h[1], B.hand * S, 0, TAU));
    }
  }

  function drawExtras(ctx, B, S, J, pose, o, t) {
    const hx = J.head[0], hy = J.head[1], hr = J.headR;
    const hd = J.headDir; // up-ish direction of head
    const fwd = [-hd[1], hd[0]]; // perpendicular (towards face, +x)
    const back = [-fwd[0], -fwd[1]];
    const up = [hd[0], hd[1]];
    const P = (a, b) => [hx + fwd[0] * a * hr + up[0] * b * hr, hy + fwd[1] * a * hr + up[1] * b * hr];
    const F = (fn) => { ctx.beginPath(); fn(); ctx.fill(); };
    if (o.hair === 'short' || o.hair === 'ponytail' || o.hair === 'bun' || o.hair === 'long') F(() => {
      // slightly larger cap on top/back
      ctx.moveTo(...P(0.9, 0.3));
      const pts = [P(0.7, 0.9), P(0, 1.18), P(-0.8, 0.95), P(-1.12, 0.2), P(-1.05, -0.45), P(-0.6, -0.2)];
      for (const p of pts) ctx.lineTo(p[0], p[1]);
      ctx.closePath();
    });
    if (o.hair === 'long') F(() => {
      ctx.moveTo(...P(-0.9, 0.5));
      const sway = Math.sin((t || 0) * 2.1) * 0.12;
      const pts = [P(-1.2, -0.3), P(-1.15 + sway, -1.6), P(-0.3 + sway, -1.75), P(-0.1, -0.6)];
      for (const p of pts) ctx.lineTo(p[0], p[1]);
      ctx.closePath();
    });
    if (o.hair === 'ponytail') F(() => {
      const sw = Math.sin((t || 0) * 5.3) * 0.35 + (o.ponySwing || 0);
      const base = P(-1.0, 0.45);
      const tip = P(-2.1 - Math.abs(sw) * 0.3, -0.9 + sw);
      const mid = P(-1.9, 0.1 + sw * 0.5);
      ctx.moveTo(base[0], base[1]);
      ctx.quadraticCurveTo(mid[0], mid[1], tip[0], tip[1]);
      const mid2 = P(-1.4, -0.3 + sw * 0.4);
      const base2 = P(-0.9, 0.05);
      ctx.quadraticCurveTo(mid2[0], mid2[1], base2[0], base2[1]);
      ctx.closePath();
    });
    if (o.hair === 'bun') F(() => {
      const c = P(-0.75, 0.95);
      ctx.arc(c[0], c[1], hr * 0.45, 0, TAU);
    });
    if (o.cap) F(() => {
      // baseball cap with brim forward
      ctx.moveTo(...P(-0.95, 0.35));
      const pts = [P(-0.7, 1.0), P(0.2, 1.12), P(0.85, 0.72), P(1.75, 0.45), P(1.7, 0.33), P(0.9, 0.35)];
      for (const p of pts) ctx.lineTo(p[0], p[1]);
      ctx.closePath();
    });
    if (o.scarf) F(() => {
      // babushka headscarf: rounder head, knot tail at the nape
      ctx.moveTo(...P(0.75, 0.75));
      const pts = [P(0.1, 1.22), P(-0.8, 1.05), P(-1.25, 0.25), P(-1.2, -0.55), P(-1.55, -1.15), P(-0.95, -0.95), P(-0.6, -0.55), P(0.55, -0.35), P(0.95, 0.15)];
      for (const p of pts) ctx.lineTo(p[0], p[1]);
      ctx.closePath();
    });
    if (o.skirt) F(() => {
      const hw = B.hipD * S * 0.6;
      const kx = (J.legL.k[0] + J.legR.k[0]) / 2, ky = (J.legL.k[1] + J.legR.k[1]) / 2;
      const spread = Math.abs(J.legL.k[0] - J.legR.k[0]) * 0.6 + S * o.skirt * 0.12;
      ctx.moveTo(-hw, -S * 0.02);
      ctx.lineTo(hw, -S * 0.02);
      ctx.lineTo(kx + spread, ky + S * 0.02);
      ctx.lineTo(kx - spread, ky + S * 0.02);
      ctx.closePath();
    });
  }

  // draw a figure. o: {x, y, S, body, pose, color, rim, rimDir, flip, t, hair, cap, scarf, skirt, key, alpha}
  function draw(ctx, o) {
    const B = typeof o.body === 'string' ? BODY[o.body] : o.body;
    const S = o.S;
    const pose = o.pose;
    const J = solve(B, S, pose);
    const path = (dx = 0, dy = 0, c = ctx) => {
      c.save();
      c.translate(dx, dy);
      c.beginPath();
      drawBodyPath(c, B, S, J, pose, o);
      drawExtras(c, B, S, J, pose, o, o.t);
      c.restore();
    };
    ctx.save();
    ctx.translate(o.x, o.y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.flip) ctx.scale(-1, 1);
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    if (o.halo) {
      // backlight wrap: a soft glow behind the whole silhouette (low-res layer)
      Soft.draw(ctx, (x) => { x.fillStyle = o.halo; path(0, 0, x); }, { scale: 0.25, blur: Math.max(1, (o.haloBlur || 8) / 4), comp: 'lighter' });
    }
    if (o.rim) {
      const rd = o.rimDir || [-1, -0.6];
      const rw = o.rimWidth || S * 0.012;
      ctx.fillStyle = o.rim;
      path(0, 0);
      ctx.fillStyle = o.color || '#1b1020';
      path(-rd[0] * rw * (o.flip ? -1 : 1), -rd[1] * rw);
    } else {
      ctx.fillStyle = o.color || '#1b1020';
      path(0, 0);
    }
    // key on a string (latchkey kid)
    if (o.key) {
      const sw = o.keySwing || 0;
      const nx = J.neck[0], ny = J.neck[1];
      const kx = nx + S * (0.06 + sw * 0.05), ky = ny + S * (0.15 - Math.abs(sw) * 0.03);
      ctx.strokeStyle = o.color || '#1b1020';
      ctx.lineWidth = Math.max(1, S * 0.006);
      ctx.beginPath(); ctx.moveTo(nx - S * 0.01, ny - S * 0.01); ctx.lineTo(kx, ky); ctx.stroke();
      ctx.fillStyle = o.keyColor || o.color || '#1b1020';
      ctx.beginPath(); ctx.arc(kx, ky + S * 0.012, S * 0.012, 0, TAU); ctx.fill();
      ctx.fillRect(kx - S * 0.004, ky + S * 0.02, S * 0.008, S * 0.03);
    }
    ctx.restore();
    return J;
  }

  // ---- poses ------------------------------------------------------------------
  function walk(p, amp = 1) {
    const s = Math.sin(p), c = Math.cos(p);
    const knee = (ph) => 6 + 52 * Math.pow(Math.max(0, Math.cos(ph + 0.7)), 1.6);
    return {
      lean: 4, neck: -2,
      hipL: 24 * amp * s, knL: knee(p) * amp, ankL: 0,
      hipR: -24 * amp * s, knR: knee(p + Math.PI) * amp, ankR: 0,
      shL: -20 * amp * s, elL: 18 + 10 * Math.max(0, -s),
      shR: 20 * amp * s, elR: 18 + 10 * Math.max(0, s),
      bob: -Math.abs(c) * 0.012,
    };
  }
  function run(p, amp = 1) {
    const s = Math.sin(p);
    const knee = (ph) => 25 + 85 * Math.pow(Math.max(0, Math.cos(ph + 0.9)), 1.3);
    return {
      lean: 12, neck: -8,
      hipL: 38 * amp * s + 8, knL: knee(p) * amp,
      hipR: -38 * amp * s + 8, knR: knee(p + Math.PI) * amp,
      shL: -48 * amp * s, elL: 85, shR: 48 * amp * s, elR: 85,
      bob: -Math.abs(Math.sin(p)) * 0.035,
    };
  }
  function stand(t = 0, sway = 1) {
    const b = Math.sin(t * 1.3) * sway;
    return { lean: 1 + b * 0.6, neck: -3 + b, hipL: -3, knL: 3, hipR: 3, knR: 2, shL: -4, elL: 10, shR: 5, elR: 12, bob: 0 };
  }
  return { draw, solve, walk, run, stand, BODY, lerpBody, capsule };
})();
