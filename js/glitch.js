// Migrated copy of Maren's code. Triggered by Konami code.
// html2canvas is lazy-loaded on first Konami trigger.

const VERT = `#version 300 es
  in vec2 a_pos;
  out vec2 vUv;
  void main() {
    vUv = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

const FRAG = `#version 300 es
  precision highp float;

  uniform sampler2D tDiffuse;
  uniform sampler2D tDisp;
  uniform int   byp;
  uniform float amount;
  uniform float angle;
  uniform float seed;
  uniform float seed_x;
  uniform float seed_y;
  uniform float distortion_x;
  uniform float distortion_y;
  uniform float col_s;

  in  vec2 vUv;
  out vec4 fragColor;

  float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    if (byp < 1) {
      vec2 p = vUv;
      vec4 normal = texture(tDisp, fract(vec2(
        floor(seed * 7654.0 * p.x) / 1024.0,
        floor(seed * 7654.0 * p.y) / 1024.0
      )));

      if (p.y < distortion_x + col_s && p.y > distortion_x - col_s * seed) {
        if (seed_x > 0.0) p.y = 1.0 - (p.y + distortion_y);
        else              p.y = distortion_y;
      }
      if (p.x < distortion_y + col_s && p.x > distortion_y - col_s * seed) {
        if (seed_y > 0.0) p.x = distortion_x;
        else              p.x = 1.0 - (p.x + distortion_x);
      }

      p.x += normal.r * seed_x * (seed / 50.0);
      p.y += normal.g * seed_y * (seed / 50.0);

      vec2 offset = amount * vec2(cos(angle), sin(angle));
      vec4 cr  = texture(tDiffuse, p + offset);
      vec4 cga = texture(tDiffuse, p);
      vec4 cb  = texture(tDiffuse, p - offset);
      fragColor = vec4(cr.r, cga.g, cb.b, cga.a);

      fragColor.rgb += 2.0 * amount * vec3(rand(gl_FragCoord.xy * seed));
    } else {
      fragColor = texture(tDiffuse, vUv);
    }
    if (mod(gl_FragCoord.y, 2.0) < 1.0) fragColor.rgb *= 0.78;
  }
`;

const FRAG_COMP = `#version 300 es
  precision highp float;
  uniform sampler2D tCurr;
  uniform sampler2D tPrev;
  uniform float temporal;
  in  vec2 vUv;
  out vec4 fragColor;
  void main() {
    vec4 curr = texture(tCurr, vUv);
    vec4 prev = texture(tPrev, vUv);
    fragColor = vec4(curr.r, curr.g, mix(curr.b, prev.b, temporal), curr.a);
  }
`;

function compileShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function createProgram(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.bindAttribLocation(p, 0, 'a_pos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(p));
    return null;
  }
  return p;
}

function uploadTexture(gl, unit, image, isFloat, w, h, nearest = false) {
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const filter = nearest ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  if (isFloat) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB32F, w, h, 0, gl.RGB, gl.FLOAT, image);
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  }
  return tex;
}

function createFBO(gl, w, h) {
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex };
}

function generateHeightmap(size) {
  const len = size * size * 3;
  const data = new Float32Array(len);
  for (let i = 0; i < len; i++) data[i] = Math.random();
  return data;
}

function randFloat(lo, hi) {
  return lo + Math.random() * (hi - lo);
}
function randInt(lo, hi) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function playGlitchAudio(duration) {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    const dur = duration / 1000;

    const out = ctx.createGain();
    out.gain.setValueAtTime(1, t);
    out.gain.exponentialRampToValueAtTime(0.001, t + dur);
    out.connect(ctx.destination);

    // Sawtooth at 1/4 of CRT horizontal scan (15,750 Hz) — harmonics fall at 3937, 7875,
    // 11812, 15750 Hz, all audible. At 15,750 Hz directly, browser anti-aliasing kills
    // all harmonics and it reduces to a sine. LFO at glitch fps simulates sync lock jitter.
    const whine = ctx.createOscillator();
    whine.type = 'sawtooth';
    whine.frequency.setValueAtTime(3937, t);
    whine.frequency.exponentialRampToValueAtTime(300, t + dur);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 8;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 60;
    lfo.connect(lfoGain);
    lfoGain.connect(whine.frequency);
    const whineGain = ctx.createGain();
    whineGain.gain.value = 0.08;
    whine.connect(whineGain);
    whineGain.connect(out);
    whine.start(t); lfo.start(t);
    whine.stop(t + dur); lfo.stop(t + dur);

    // Sparse impulses — arcing is intermittent bursts, not continuous static
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, Math.ceil(sr * dur), sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() < 0.05 ? (Math.random() * 2 - 1) * 5 : 0;
    const crackle = ctx.createBufferSource();
    crackle.buffer = buf;
    const cf = ctx.createBiquadFilter();
    cf.type = 'bandpass';
    cf.frequency.value = 3500;
    cf.Q.value = 0.6;
    crackle.connect(cf);
    cf.connect(out);
    crackle.start(t);

    // Inductive spike from deflection coil; bypasses shared fade — impulsive, not sustained
    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(80, t);
    thump.frequency.exponentialRampToValueAtTime(20, t + 0.12);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.9, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    thump.connect(tg);
    tg.connect(ctx.destination);
    thump.start(t);
    thump.stop(t + 0.2);

    setTimeout(() => ctx.close(), duration + 300);
  } catch (_) {}
}

function ensureHtml2canvas() {
  if (typeof html2canvas !== 'undefined') return Promise.resolve();
  if (window._h2cLoad) return window._h2cLoad;
  window._h2cLoad = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
  return window._h2cLoad;
}

function captureScreen(el) {
  return ensureHtml2canvas().then(() => html2canvas(el, { logging: false, scale: 1 }));
}

async function pageGlitch(el, opts = {}) {
  const { duration = 1000, fps = 8, dtSize = 64, onDone = null, sourceCanvas: capturePromise = null } = opts;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    onDone?.();
    return;
  }

  const wild = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
  const dpr = window.devicePixelRatio || 1;

  let sourceCanvas;
  try {
    sourceCanvas = capturePromise ? await capturePromise : null;
    if (!sourceCanvas) sourceCanvas = await captureScreen(el);
  } catch {
    onDone?.();
    return;
  }

  {
      const overlay = document.createElement("canvas");
      overlay.width = sourceCanvas.width || window.innerWidth;
      overlay.height = sourceCanvas.height || window.innerHeight;
      overlay.style.cssText =
        "position:fixed;inset:0;z-index:10000;width:100vw;height:100vh;pointer-events:none;";
      document.body.appendChild(overlay);

      const gl = overlay.getContext("webgl2");
      if (!gl) {
        console.error("WebGL2 not available");
        overlay.remove();
        if (onDone) onDone();
        return;
      }
      gl.getExtension("EXT_color_buffer_float");

      // Scale drawing buffer to physical pixels so scanlines land on individual
      // physical pixels. Capped at MAX_TEXTURE_SIZE to prevent FBO failures on
      // large or very high-DPI screens.
      const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      const dprScale = Math.min(dpr, maxTex / Math.max(overlay.width, overlay.height));
      if (dprScale > 1) {
        overlay.width = Math.floor(overlay.width * dprScale);
        overlay.height = Math.floor(overlay.height * dprScale);
      }

      const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
      const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
      const compFs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_COMP);
      const prog = createProgram(gl, vs, fs);
      const compProg = createProgram(gl, vs, compFs);

      const quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      );
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      let sourceTex;
      try {
        sourceTex = uploadTexture(gl, 0, sourceCanvas, false);
      } catch (_) {
        // tainted canvas fallback: use noise as diffuse
        const noise = generateHeightmap(dtSize);
        sourceTex = uploadTexture(gl, 0, noise, true, dtSize, dtSize);
      }

      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      const hmap = generateHeightmap(dtSize);
      const dispTex = uploadTexture(gl, 1, hmap, true, dtSize, dtSize, true);

      // Glitch program uniforms (units 0, 1)
      gl.useProgram(prog);
      gl.uniform1i(gl.getUniformLocation(prog, 'tDiffuse'), 0);
      gl.uniform1i(gl.getUniformLocation(prog, 'tDisp'), 1);
      const u = {};
      for (const name of ['byp', 'amount', 'angle', 'seed', 'seed_x', 'seed_y', 'distortion_x', 'distortion_y', 'col_s']) {
        u[name] = gl.getUniformLocation(prog, name);
      }

      // Composite program uniforms (units 2, 3)
      gl.useProgram(compProg);
      gl.uniform1i(gl.getUniformLocation(compProg, 'tCurr'), 2);
      gl.uniform1i(gl.getUniformLocation(compProg, 'tPrev'), 3);
      const ucTemporal = gl.getUniformLocation(compProg, 'temporal');

      // Ping-pong FBOs for temporal channel offset
      const fboA = createFBO(gl, overlay.width, overlay.height);
      const fboB = createFBO(gl, overlay.width, overlay.height);
      let ping = fboA, pong = fboB;

      // createFBO clobbers TEXTURE0 — restore intended bindings
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sourceTex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, dispTex);

      let curF = 0;
      let randX = randInt(120, 240);
      let hmapFrame = 0;
      gl.viewport(0, 0, overlay.width, overlay.height);

      const interval = 1000 / fps;
      let elapsed = 0;
      let lastTime = performance.now();
      let rafId;

      function frame(now) {
        rafId = requestAnimationFrame(frame);
        const dt = now - lastTime;
        if (dt < interval) return;
        lastTime = now - (dt % interval);
        elapsed += interval;

        const env = Math.sin((elapsed / duration) * Math.PI);

        // Pass 1: glitch → ping FBO
        gl.bindFramebuffer(gl.FRAMEBUFFER, ping.fbo);
        gl.useProgram(prog);
        gl.uniform1f(u.seed, Math.random());
        gl.uniform1f(u.col_s, Math.random() * 0.05 * env);

        let temporal = 0;
        if (curF % randX === 0 || wild) {
          gl.uniform1i(u.byp, 0);
          gl.uniform1f(u.amount, (Math.random() / 30.0) * env);
          gl.uniform1f(u.angle, randFloat(-Math.PI, Math.PI));
          gl.uniform1f(u.seed_x, randFloat(-env, env));
          gl.uniform1f(u.seed_y, randFloat(-env, env));
          gl.uniform1f(u.distortion_x, randFloat(0.0, 1.0));
          gl.uniform1f(u.distortion_y, randFloat(0.0, 1.0));
          curF = 0;
          randX = randInt(120, 240);
          if (hmapFrame % 2 === 0) {
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, dispTex);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, dtSize, dtSize, gl.RGB, gl.FLOAT, generateHeightmap(dtSize));
          }
          hmapFrame++;
          temporal = env * 0.18;
        } else if (curF % randX < randX / 5) {
          gl.uniform1i(u.byp, 0);
          gl.uniform1f(u.amount, (Math.random() / 90.0) * env);
          gl.uniform1f(u.angle, randFloat(-Math.PI, Math.PI));
          gl.uniform1f(u.seed_x, randFloat(-0.3, 0.3));
          gl.uniform1f(u.seed_y, randFloat(-0.3, 0.3));
          gl.uniform1f(u.distortion_x, randFloat(0.0, 1.0));
          gl.uniform1f(u.distortion_y, randFloat(0.0, 1.0));
          temporal = env * 0.09;
        } else {
          gl.uniform1i(u.byp, 1);
          temporal = env * 0.03;
        }
        curF++;
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // Pass 2: composite curr+prev → screen
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.useProgram(compProg);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, ping.tex);
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, pong.tex);
        gl.uniform1f(ucTemporal, temporal);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        [ping, pong] = [pong, ping];

        if (elapsed >= duration) {
          cancelAnimationFrame(rafId);
          gl.deleteProgram(prog);
          gl.deleteProgram(compProg);
          gl.deleteShader(vs);
          gl.deleteShader(fs);
          gl.deleteShader(compFs);
          gl.deleteTexture(sourceTex);
          gl.deleteTexture(dispTex);
          gl.deleteBuffer(quad);
          gl.deleteFramebuffer(fboA.fbo);
          gl.deleteTexture(fboA.tex);
          gl.deleteFramebuffer(fboB.fbo);
          gl.deleteTexture(fboB.tex);
          overlay.remove();
          if (onDone) onDone();
        }
      }
      playGlitchAudio(duration);
      rafId = requestAnimationFrame(frame);
  }
}

window.pageGlitch = pageGlitch;

// Konami code: ↑ ↑ ↓ ↓ ← → ← → B A
(() => {
  const sequence = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let pos = 0;
  let active = false;
  let pendingCapture = null;

  window.addEventListener('keydown', (e) => {
    if (!e.key) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const next = key === sequence[pos] ? pos + 1 : key === sequence[0] ? 1 : 0;
    if (next < pos) pendingCapture = null; // sequence broken, discard stale capture
    pos = next;

    if (pos === 5) ensureHtml2canvas();
    if (pos === 8) pendingCapture = captureScreen(document.body).catch(() => null);

    if (pos === sequence.length) {
      pos = 0;
      if (active) return;
      active = true;
      const capture = pendingCapture;
      pendingCapture = null;
      pageGlitch(document.body, {
        duration: 1000,
        fps: 8,
        sourceCanvas: capture,
        onDone: () => { active = false; },
      });
    }
  });
})();

export {};
