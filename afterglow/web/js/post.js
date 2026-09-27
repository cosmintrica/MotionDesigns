'use strict';
// ---------------------------------------------------------------------------
// WebGL2 post-processing: the "memory look".
// scene (2D canvas) -> bloom chain + haze chain (dual-kawase) -> composite:
// chromatic aberration, halation, diffusion, filmic shoulder, grade, split
// tone, fade, light leaks, VHS/CRT, vignette, grain, dust, dither.
// The composite is written upside-down so readPixels returns top row first.
// ---------------------------------------------------------------------------

const LOOK_DEFAULTS = {
  exposure: 0, contrast: 1.05, sat: 1.0, warmth: 0.0, tint: 0.0,
  lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1],
  fade: 0.04, fadeColor: [0.07, 0.055, 0.075],
  split: 0.0, shadowTint: [-0.02, 0.01, 0.04], highTint: [0.05, 0.02, -0.03],
  bloom: 0.55, bloomThreshold: 0.62, bloomKnee: 0.35, bloomTint: [1.0, 0.92, 0.82],
  haze: 0.12, halation: 0.25,
  ca: 0.6, vignette: 0.45,
  grain: 0.055, grainSize: 1.35, weave: 0.5, flicker: 0.015, dust: 0.0,
  vhs: 0, crt: 0, leak: 0, leakSeed: 0,
  letterbox: 0, black: 0, white: 0,
};

const Post = (() => {
  let gl, canvas, quadBuf, texScene, texNoise;
  const P = {};
  const levels = [];
  const hlevels = [];
  let floatOK = false;

  const VS = `#version 300 es
  in vec2 aPos; out vec2 vUv;
  void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FS_PREFILTER = `#version 300 es
  precision highp float; in vec2 vUv; out vec4 o;
  uniform sampler2D uTex; uniform vec2 uTexel; uniform float uThreshold, uKnee;
  void main(){
    vec3 c = texture(uTex, vUv).rgb;   // bilinear tap = average of the 2x2 block
    c *= c;                            // ~linear (gamma 2)
    float br = max(c.r, max(c.g, c.b));
    float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
    soft = soft * soft / (4.0 * uKnee + 1e-4);
    float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
    o = vec4(c * contrib, 1.0);
  }`;

  const FS_DOWN = `#version 300 es
  precision highp float; in vec2 vUv; out vec4 o;
  uniform sampler2D uTex; uniform vec2 uHalf;
  void main(){
    vec3 s = texture(uTex, vUv).rgb * 4.0;
    s += texture(uTex, vUv - uHalf).rgb;
    s += texture(uTex, vUv + uHalf).rgb;
    s += texture(uTex, vUv + vec2(uHalf.x, -uHalf.y)).rgb;
    s += texture(uTex, vUv - vec2(uHalf.x, -uHalf.y)).rgb;
    o = vec4(s / 8.0, 1.0);
  }`;

  const FS_UP = `#version 300 es
  precision highp float; in vec2 vUv; out vec4 o;
  uniform sampler2D uTex; uniform sampler2D uAdd; uniform vec2 uHalf; uniform float uAddW;
  void main(){
    vec3 s = texture(uTex, vUv + vec2(-uHalf.x * 2.0, 0.0)).rgb;
    s += texture(uTex, vUv + vec2(-uHalf.x, uHalf.y)).rgb * 2.0;
    s += texture(uTex, vUv + vec2(0.0, uHalf.y * 2.0)).rgb;
    s += texture(uTex, vUv + vec2(uHalf.x, uHalf.y)).rgb * 2.0;
    s += texture(uTex, vUv + vec2(uHalf.x * 2.0, 0.0)).rgb;
    s += texture(uTex, vUv + vec2(uHalf.x, -uHalf.y)).rgb * 2.0;
    s += texture(uTex, vUv + vec2(0.0, -uHalf.y * 2.0)).rgb;
    s += texture(uTex, vUv + vec2(-uHalf.x, -uHalf.y)).rgb * 2.0;
    o = vec4(s / 12.0 + texture(uAdd, vUv).rgb * uAddW, 1.0);
  }`;

  const FS_COMPOSITE = `#version 300 es
  precision highp float; in vec2 vUv; out vec4 o;
  uniform sampler2D uScene, uBloomTex, uHazeTex, uNoise;
  uniform vec2 uRes, uWeave;
  uniform float uTime, uFrame;
  uniform float uExposure, uContrast, uSat, uWarmth, uTint, uFade, uSplit;
  uniform vec3 uLift, uGamma, uGain, uFadeColor, uShadowTint, uHighTint, uBloomTint;
  uniform float uBloom, uHaze, uHalation, uCA, uVignette, uGrain, uGrainSize, uFlick, uDust;
  uniform float uVhs, uCrt, uLeak, uLeakSeed, uLetterbox, uBlack, uWhite, uBloomNorm, uHazeNorm;
  float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  vec3 toLin(vec3 c){ return c * c; }
  vec3 toSrgb(vec3 c){ return sqrt(max(c, 0.0)); }
  vec3 shoulder(vec3 x){ vec3 ov = max(x - 0.78, 0.0); return min(x, 0.78) + ov / (1.0 + ov * 4.545); }
  void main(){
    vec2 uv = vUv + uWeave;           // v = 0 is the top of the image
    float fr = uFrame;
    if (uVhs > 0.001) {
      float line = floor(uv.y * 270.0);
      float j = (h12(vec2(line, fr)) - 0.5) * 0.0022 * uVhs;
      float bandY = fract(uTime * 0.21 + 0.35);
      float band = smoothstep(0.045, 0.0, abs(uv.y - bandY));
      j += band * (h12(vec2(line * 3.1, fr)) - 0.35) * 0.018 * uVhs;
      uv.x += j;
    }
    vec2 d = uv - 0.5;
    vec2 da = d * vec2(1.7778, 1.0);
    float r2 = dot(da, da);
    vec2 caOff = d * uCA * 0.0055 * (0.35 + r2 * 1.6);
    vec3 col;
    col.r = texture(uScene, uv + caOff).r;
    col.g = texture(uScene, uv).g;
    col.b = texture(uScene, uv - caOff).b;
    if (uVhs > 0.001) {
      vec3 s1 = texture(uScene, uv + vec2(0.0028, 0.0)).rgb;
      vec3 s2 = texture(uScene, uv + vec2(0.0056, 0.0)).rgb;
      vec3 s3 = texture(uScene, uv - vec2(0.0020, 0.0)).rgb;
      vec3 avg = (col + s1 + s2 + s3) * 0.25;
      float yl = dot(col, vec3(0.299, 0.587, 0.114));
      float ya = dot(avg, vec3(0.299, 0.587, 0.114));
      col = mix(col, vec3(yl) + (avg - vec3(ya)), clamp(uVhs, 0.0, 1.0) * 0.85);
    }
    vec3 lin = toLin(col);
    vec3 bl = texture(uBloomTex, uv).rgb * uBloomNorm;
    vec3 hz = texture(uHazeTex, uv).rgb * uHazeNorm;
    lin += bl * uBloom * uBloomTint;
    lin += bl * uHalation * vec3(1.0, 0.30, 0.09);
    lin = mix(lin, 1.0 - (1.0 - lin) * (1.0 - hz * 0.95), uHaze);
    lin *= exp2(uExposure + uFlick);
    lin *= vec3(1.0 + uWarmth * 0.12, 1.0 + uTint * 0.06, 1.0 - uWarmth * 0.12);
    lin = shoulder(lin);
    col = toSrgb(lin);
    col = col * uGain + uLift * (1.0 - col);
    vec3 sc = col * col * (3.0 - 2.0 * col);
    col = mix(col, sc, uContrast - 1.0);
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col += uShadowTint * (1.0 - l) * (1.0 - l) * uSplit + uHighTint * l * l * uSplit;
    l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(l), col, uSat);
    col = mix(col, uFadeColor + col * (1.0 - uFadeColor), uFade);
    if (uLeak > 0.001) {
      vec3 leak = vec3(0.0);
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        vec2 c = vec2(fract(uLeakSeed * 0.37 + fi * 0.43) * 1.3 - 0.15 + 0.22 * sin(uTime * 0.31 + fi * 2.1),
                      (i == 1 ? 0.05 : 0.95) + 0.18 * cos(uTime * 0.23 + fi * 1.7));
        float rr = 0.32 + 0.12 * sin(uTime * 0.47 + fi * 3.0);
        vec2 dd = (uv - c) * vec2(1.7778, 1.0);
        float a = exp(-dot(dd, dd) / (rr * rr));
        vec3 lc = i == 0 ? vec3(1.0, 0.36, 0.08) : (i == 1 ? vec3(1.0, 0.62, 0.22) : vec3(0.95, 0.16, 0.30));
        leak += lc * a;
      }
      col = 1.0 - (1.0 - col) * (1.0 - clamp(leak * uLeak, 0.0, 1.0));
    }
    if (uCrt > 0.001) {
      float sl = 0.5 + 0.5 * cos(gl_FragCoord.y * 3.14159 * 0.6667);
      col *= 1.0 - uCrt * 0.22 * sl;
      float m = mod(gl_FragCoord.x, 3.0);
      vec3 mask = m < 1.0 ? vec3(1.0, 0.85, 0.85) : (m < 2.0 ? vec3(0.85, 1.0, 0.85) : vec3(0.85, 0.85, 1.0));
      col *= mix(vec3(1.0), mask, uCrt * 0.5);
    }
    float vig = pow(clamp(length(d * vec2(1.05, 0.95)) * 1.3, 0.0, 1.4), 2.3);
    col *= 1.0 - uVignette * vig;
    // film grain (soft, luminance weighted)
    vec2 gp = gl_FragCoord.xy / (256.0 * uGrainSize) + vec2(h12(vec2(fr, 1.7)), h12(vec2(fr, 9.1)));
    vec2 nn = texture(uNoise, gp).rg;
    float n = nn.x + nn.y - 1.0;
    l = dot(col, vec3(0.299, 0.587, 0.114));
    col += n * uGrain * (0.55 + 0.9 * clamp(1.0 - abs(l - 0.42) * 1.7, 0.0, 1.0));
    if (uDust > 0.001) {
      vec2 cell = floor(gl_FragCoord.xy / 96.0);
      float rnd = h12(cell + fr * 7.13);
      if (rnd > 1.0 - 0.004 * uDust) {
        vec2 cc = (cell + 0.5 + (vec2(h12(cell + fr), h12(cell - fr)) - 0.5) * 0.6) * 96.0;
        float rad = 1.0 + 3.2 * h12(cell * 1.3 + fr);
        float sp = smoothstep(rad, rad * 0.25, length((gl_FragCoord.xy - cc) * vec2(1.0, 0.6 + h12(cell + 5.0))));
        col = mix(col, h12(cell + 3.3) > 0.55 ? vec3(0.96, 0.93, 0.86) : vec3(0.03), sp * 0.75);
      }
      float blk = floor(fr / 2.0);
      if (h12(vec2(blk, 4.2)) > 0.86) {
        float sx = h12(vec2(blk, 1.9)) * uRes.x;
        float ln = smoothstep(1.3, 0.0, abs(gl_FragCoord.x - sx - sin(gl_FragCoord.y * 0.01 + blk) * 3.0));
        col = mix(col, vec3(0.92, 0.9, 0.84), ln * 0.22 * uDust);
      }
    }
    if (uLetterbox > 0.0) {
      float yy = vUv.y;
      if (yy < uLetterbox || yy > 1.0 - uLetterbox) col = vec3(0.0);
    }
    col = mix(col, vec3(0.0), uBlack);
    col = mix(col, vec3(1.0, 0.94, 0.84), uWhite);
    col += (h12(gl_FragCoord.xy + fr * 1.37) - 0.5) / 255.0;
    o = vec4(clamp(col, 0.0, 1.0), 1.0);
  }`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
    return s;
  }
  function program(fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  function tex(w, h, isFloat, filter = gl.LINEAR, wrap = gl.CLAMP_TO_EDGE, data = null) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    if (isFloat) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return t;
  }
  function fbo(w, h) {
    const t = tex(w, h, floatOK);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { f, t, w, h };
  }

  function init(outCanvas) {
    canvas = outCanvas;
    canvas.width = W; canvas.height = H;
    gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2 unavailable');
    floatOK = /float16/.test(location.search) && !!gl.getExtension('EXT_color_buffer_float');
    P.pre = program(FS_PREFILTER); P.down = program(FS_DOWN); P.up = program(FS_UP); P.comp = program(FS_COMPOSITE);
    quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    texScene = tex(W, H, false);
    // noise texture for grain
    const N = 256, nd = new Uint8Array(N * N * 4), rnd = mulberry32(1234);
    for (let i = 0; i < nd.length; i++) nd[i] = (rnd() * 255) | 0;
    texNoise = tex(N, N, false, gl.LINEAR, gl.REPEAT, nd);
    // bloom chain: 1/2 .. 1/64 ; haze chain 1/4 .. 1/64
    let w = W / 2, h = H / 2;
    for (let i = 0; i < 6; i++) { levels.push({ down: fbo(Math.ceil(w), Math.ceil(h)), up: fbo(Math.ceil(w), Math.ceil(h)) }); w /= 2; h /= 2; }
    w = W / 4; h = H / 4;
    for (let i = 0; i < 5; i++) { hlevels.push({ down: fbo(Math.ceil(w), Math.ceil(h)), up: fbo(Math.ceil(w), Math.ceil(h)) }); w /= 2; h /= 2; }
  }

  function bindTex(unit, t) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); }
  function pass(prog, target, setup) {
    gl.useProgram(prog.p);
    if (target) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.f); gl.viewport(0, 0, target.w, target.h); }
    else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); }
    setup(prog.u);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function chain(lv, srcTex, srcW, srcH, threshold, knee) {
    pass(P.pre, lv[0].down, (u) => {
      bindTex(0, srcTex); gl.uniform1i(u.uTex, 0);
      gl.uniform2f(u.uTexel, 1 / srcW, 1 / srcH);
      gl.uniform1f(u.uThreshold, threshold); gl.uniform1f(u.uKnee, knee);
    });
    for (let i = 1; i < lv.length; i++) {
      const src = lv[i - 1].down;
      pass(P.down, lv[i].down, (u) => {
        bindTex(0, src.t); gl.uniform1i(u.uTex, 0);
        gl.uniform2f(u.uHalf, 0.5 / src.w, 0.5 / src.h);
      });
    }
    // progressive upsample, adding each level
    let cur = lv[lv.length - 1].down;
    for (let i = lv.length - 2; i >= 0; i--) {
      const tgt = lv[i].up, add = lv[i].down;
      pass(P.up, tgt, (u) => {
        bindTex(0, cur.t); gl.uniform1i(u.uTex, 0);
        bindTex(1, add.t); gl.uniform1i(u.uAdd, 1);
        gl.uniform2f(u.uHalf, 0.5 / cur.w, 0.5 / cur.h);
        gl.uniform1f(u.uAddW, 1.0);
      });
      cur = tgt;
    }
    return { tex: cur.t, norm: 1 / lv.length };
  }

  const _px1 = new Uint8Array(4);
  const prof = { on: false, t: {} };
  function mark(name) {
    if (!prof.on) return;
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, _px1);
    const now = performance.now();
    prof.t[name] = (prof.t[name] || 0) + (now - prof.last);
    prof.last = now;
  }
  function render(src, look, t, frame) {
    const L = look;
    if (prof.on) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, _px1); prof.last = performance.now(); }
    gl.bindTexture(gl.TEXTURE_2D, texScene);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    mark('upload');
    const b = chain(levels, texScene, W, H, L.bloomThreshold, L.bloomKnee);
    mark('bloom');
    const hz = chain(hlevels, texScene, W, H, 0.0, 0.001);
    mark('haze');
    // gate weave: smooth noise, in uv units
    const wx = (fbm(t * 1.7 + 11.1, 2) * 0.6 + (hash(frame * 1.31) - 0.5) * 0.25) * L.weave * 0.0009;
    const wy = (fbm(t * 1.3 + 3.7, 2) * 0.6 + (hash(frame * 2.17) - 0.5) * 0.25) * L.weave * 0.0013;
    const flick = (hash(frame * 0.713 + 5.1) - 0.5) * 2 * L.flicker;
    pass(P.comp, null, (u) => {
      bindTex(0, texScene); gl.uniform1i(u.uScene, 0);
      bindTex(1, b.tex); gl.uniform1i(u.uBloomTex, 1);
      bindTex(2, hz.tex); gl.uniform1i(u.uHazeTex, 2);
      bindTex(3, texNoise); gl.uniform1i(u.uNoise, 3);
      gl.uniform2f(u.uRes, W, H);
      gl.uniform2f(u.uWeave, wx, wy);
      gl.uniform1f(u.uTime, t); gl.uniform1f(u.uFrame, frame % 4096);
      gl.uniform1f(u.uExposure, L.exposure); gl.uniform1f(u.uContrast, L.contrast); gl.uniform1f(u.uSat, L.sat);
      gl.uniform1f(u.uWarmth, L.warmth); gl.uniform1f(u.uTint, L.tint); gl.uniform1f(u.uFade, L.fade); gl.uniform1f(u.uSplit, L.split);
      gl.uniform3fv(u.uLift, L.lift); gl.uniform3fv(u.uGamma, L.gamma); gl.uniform3fv(u.uGain, L.gain);
      gl.uniform3fv(u.uFadeColor, L.fadeColor); gl.uniform3fv(u.uShadowTint, L.shadowTint); gl.uniform3fv(u.uHighTint, L.highTint);
      gl.uniform3fv(u.uBloomTint, L.bloomTint);
      gl.uniform1f(u.uBloom, L.bloom); gl.uniform1f(u.uHaze, L.haze); gl.uniform1f(u.uHalation, L.halation);
      gl.uniform1f(u.uBloomNorm, b.norm * 2.2); gl.uniform1f(u.uHazeNorm, hz.norm);
      gl.uniform1f(u.uCA, L.ca); gl.uniform1f(u.uVignette, L.vignette);
      gl.uniform1f(u.uGrain, L.grain); gl.uniform1f(u.uGrainSize, L.grainSize);
      gl.uniform1f(u.uFlick, flick); gl.uniform1f(u.uDust, L.dust);
      gl.uniform1f(u.uVhs, L.vhs); gl.uniform1f(u.uCrt, L.crt);
      gl.uniform1f(u.uLeak, L.leak); gl.uniform1f(u.uLeakSeed, L.leakSeed);
      gl.uniform1f(u.uLetterbox, L.letterbox); gl.uniform1f(u.uBlack, L.black); gl.uniform1f(u.uWhite, L.white);
    });
    mark('composite');
  }

  function read(buf) { gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf); }

  return { init, render, read, prof, get gl() { return gl; } };
})();
