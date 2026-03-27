/* ═══════════════════════════════════════════════
   BIRTHDAY WEBSITE — MAIN LOGIC
   All scenes, animations, audio, particles, Three.js
   ═══════════════════════════════════════════════ */

import { gsap } from "gsap";
import * as THREE from "three";
import { Howl } from "howler";

// ─── STATE ────────────────────────────────────
let currentScene = 0; // will be set to 1 after boot
let isMuted = true;
let isTransitioning = false;
let scene2Timeline = null;
let scene3Timeline = null;
let threeCtx = null; // { renderer, scene, camera, group, raf }
let s4Video = null;
let s4LightTriggered = false;
let scene4RevealTimeout = null;
let s4LoopSegmentActive = false;
let s4LoopStartTime = 0;
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
const hasFinePointer = window.matchMedia("(pointer: fine)").matches;

// ─── DOM REFS ─────────────────────────────────
const $app = document.getElementById("app");
const $flash = document.getElementById("flash-overlay");
const $muteBtn = document.getElementById("mute-btn");
const $nextBtn = document.getElementById("next-btn");
const $prevBtn = document.getElementById("prev-btn");
const $charImg = document.getElementById("char-img");
const $charWrap = document.getElementById("char-wrap");
const $readBtn = document.getElementById("read-letter-btn");
const $restartBtn = document.getElementById("restart-btn");
const $cursorTrailCanvas = document.getElementById("cursor-trail-canvas");

function $(sel) {
  return document.querySelector(sel);
}
function $$(sel) {
  return document.querySelectorAll(sel);
}

// ─── GLOBAL CURSOR TRAIL ──────────────────────
function createCursorTrailRenderer(canvas) {
  if (!canvas || !hasFinePointer) return null;

  const ctx = canvas.getContext("2d");
  const particles = [];
  const palette = ["#ff69b4", "#f9a8d4", "#ffd166", "#fff0f6", "#ffb7c5"];
  const reducedFactor = prefersReducedMotion ? 0.45 : 1;
  let width = 0;
  let height = 0;
  let lastEmit = 0;
  let rafId = 0;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  function drawHeart(size) {
    ctx.beginPath();
    ctx.moveTo(0, size * 0.28);
    ctx.bezierCurveTo(
      0,
      -size * 0.18,
      -size * 0.5,
      -size * 0.18,
      -size * 0.5,
      size * 0.2,
    );
    ctx.bezierCurveTo(
      -size * 0.5,
      size * 0.5,
      -size * 0.16,
      size * 0.72,
      0,
      size,
    );
    ctx.bezierCurveTo(
      size * 0.16,
      size * 0.72,
      size * 0.5,
      size * 0.5,
      size * 0.5,
      size * 0.2,
    );
    ctx.bezierCurveTo(
      size * 0.5,
      -size * 0.18,
      0,
      -size * 0.18,
      0,
      size * 0.28,
    );
    ctx.closePath();
    ctx.fill();
  }

  function drawStar(size) {
    const spikes = 5;
    const outer = size;
    const inner = size * 0.46;
    let rotation = (Math.PI / 2) * 3;

    ctx.beginPath();
    ctx.moveTo(0, -outer);

    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(Math.cos(rotation) * outer, Math.sin(rotation) * outer);
      rotation += Math.PI / spikes;
      ctx.lineTo(Math.cos(rotation) * inner, Math.sin(rotation) * inner);
      rotation += Math.PI / spikes;
    }

    ctx.closePath();
    ctx.fill();
  }

  function emit(x, y, burst = false) {
    const count = Math.max(2, Math.round((burst ? 12 : 5) * reducedFactor));

    for (let i = 0; i < count; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * (burst ? 2.1 : 0.95),
        vy: -0.15 - Math.random() * (burst ? 1.45 : 0.75),
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.085,
        life: 1,
        decay: (0.009 + Math.random() * 0.01) / reducedFactor,
        size: 6 + Math.random() * (burst ? 12 : 9),
        color: palette[Math.floor(Math.random() * palette.length)],
        shape: Math.random() > 0.45 ? "heart" : "star",
      });
    }
  }

  function handlePointerMove(event) {
    const now = performance.now();
    if (now - lastEmit < (prefersReducedMotion ? 72 : 22)) return;
    lastEmit = now;
    emit(event.clientX, event.clientY, false);
  }

  function handlePointerDown(event) {
    emit(event.clientX, event.clientY, true);
  }

  function render() {
    ctx.clearRect(0, 0, width, height);

    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.009;
      particle.rotation += particle.spin;
      particle.life -= particle.decay;

      if (particle.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.globalAlpha = particle.life * 0.9;
      ctx.fillStyle = particle.color;
      ctx.shadowColor = particle.color;
      ctx.shadowBlur = 14;

      if (particle.shape === "heart") {
        drawHeart(particle.size);
      } else {
        drawStar(particle.size);
      }

      ctx.restore();
    }

    rafId = requestAnimationFrame(render);
  }

  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  window.addEventListener("pointerdown", handlePointerDown, { passive: true });
  render();

  return {
    stop() {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
    },
  };
}

// ─── AUDIO ────────────────────────────────────
// Place audio files in public/audio/ folder. If a file is missing, that scene
// will simply have no audio — no errors will occur.
//
// startAt: seconds offset to begin playback (change this to skip intros)

const AUDIO_CONFIG = {
  // Scene 1: soft cozy lofi / acoustic guitar ambience
  s1: { src: "/audio/1.mp3", loop: true, startAt: 20 },
  // Scene 2: "Die With A Smile" — plays during the rocket trail
  s2: { src: "/audio/2.mp3", loop: false, startAt: 44 },
  // Scene 4: dramatic orchestral → celebratory pop
  s4: { src: "/audio/3.mp3", loop: true, startAt: 0 },
  // Scene 5: soft emotional piano
  s5: { src: "/audio/4.mp3", loop: true, startAt: 0 },
};

// Eagerly-loaded Howl instances
const audio = {};

function initHowl(key) {
  const cfg = AUDIO_CONFIG[key];
  if (!cfg) return null;

  const howl = new Howl({
    src: [cfg.src],
    loop: cfg.loop,
    volume: 0,
    html5: false,
    preload: true,
    onloaderror: (id, err) => {
      console.warn(
        `[Audio] Could not load "${cfg.src}" — add the file to public/audio/.`,
      );
      howl._failed = true;
    },
    onplayerror: (id, err) => {
      console.warn(`[Audio] Play error "${cfg.src}" — retrying after unlock.`);
      howl.once("unlock", () => {
        howl.play();
      });
    },
  });
  howl._failed = false;
  howl._startAt = cfg.startAt || 0;
  audio[key] = howl;
  return howl;
}

// Preload all audio tracks at boot
function preloadAllAudio() {
  Object.keys(AUDIO_CONFIG).forEach((key) => initHowl(key));
}

function getAudioForScene(num) {
  if (num === 1) return audio.s1 || null;
  if (num === 2) return audio.s2 || null;
  // Scene 3: video audio only — no Howl track
  if (num === 4) return audio.s4 || null;
  if (num === 5) return audio.s5 || null;
  return null;
}

function crossfadeAudio(toScene) {
  if (isMuted) return;
  const target = getAudioForScene(toScene);

  // Fade out all tracks that aren't the target
  Object.values(audio).forEach((snd) => {
    if (snd === target || snd._failed) return;
    if (snd.playing()) {
      snd.fade(snd.volume(), 0, 1200);
      setTimeout(() => {
        try {
          if (snd.playing() && snd.volume() < 0.05) snd.pause();
        } catch (e) {}
      }, 1300);
    }
  });

  if (!target || target._failed) return;

  // If already playing at decent volume, keep going
  if (target.playing()) {
    if (target.volume() > 0.2) return;
    target.fade(target.volume(), 0.8, 1200);
    return;
  }

  // Start fresh with configured start offset
  try {
    target.play();
    if (target._startAt > 0) target.seek(target._startAt);
    target.fade(0, 0.8, 1200);
  } catch (e) {
    console.warn("[Audio] Playback failed:", e);
  }
}

function muteAll() {
  Object.values(audio).forEach((snd) => {
    if (snd._failed) return;
    try {
      if (snd.playing()) {
        snd.fade(snd.volume(), 0, 400);
        setTimeout(() => {
          try {
            snd.pause();
          } catch (e) {}
        }, 450);
      }
    } catch (e) {}
  });
}

function setAudioState(muted) {
  isMuted = muted;
  $muteBtn.querySelector(".mute-icon").textContent = isMuted ? "🔇" : "🔊";
  $muteBtn.querySelector(".mute-label").textContent = isMuted
    ? "sound off"
    : "sound on";
  $muteBtn.classList.toggle("unmuted", !isMuted);
  if (!isMuted) {
    crossfadeAudio(currentScene);
    if (currentScene === 3 && s3Video) s3Video.muted = false;
    if (currentScene === 4 && s4Video) s4Video.muted = false;
  } else {
    muteAll();
    if (s3Video) s3Video.muted = true;
    if (s4Video) s4Video.muted = true;
  }
}

$muteBtn.addEventListener("click", () => setAudioState(!isMuted));

// ─── PARALLAX + INTERACTIVE (Scene 1) ────────
// Mouse parallax on character
document.addEventListener("mousemove", (e) => {
  if (currentScene !== 1) return;
  const dx = (e.clientX / window.innerWidth - 0.5) * -30;
  const dy = (e.clientY / window.innerHeight - 0.5) * -30;
  $charImg.style.transform = `translate(${dx}px, ${dy}px)`;
});

// ─── FLOATING HEARTS CANVAS (Scene 1) ───────
function createHeartsRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  let w, h;
  const hearts = [];
  const COLORS = ["#ff69b4", "#ff5fa2", "#ff87bf", "#f9a8d4", "#ec4899"];

  function drawHeart(x, y, size, color, alpha, rotation = 0) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(size / 24, size / 24);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.bezierCurveTo(0, -1, -12, -1, -12, 7);
    ctx.bezierCurveTo(-12, 14, -4, 18, 0, 22);
    ctx.bezierCurveTo(4, 18, 12, 14, 12, 7);
    ctx.bezierCurveTo(12, -1, 0, -1, 0, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function resize() {
    w = canvas.width = canvas.offsetWidth;
    h = canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  // Passive ambient hearts
  function spawnAmbient() {
    if (hearts.length < 15) {
      hearts.push({
        x: Math.random() * w,
        y: h + 20,
        vy: -(0.5 + Math.random() * 1),
        vx: (Math.random() - 0.5) * 0.5,
        size: 14 + Math.random() * 16,
        alpha: 0.3 + Math.random() * 0.4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rot: (Math.random() - 0.5) * 0.3,
        wobble: Math.random() * Math.PI * 2,
      });
    }
  }

  // Burst hearts from a point (on click)
  function burst(x, y, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      hearts.push({
        x,
        y,
        vy: Math.sin(angle) * (2 + Math.random() * 3),
        vx: Math.cos(angle) * (2 + Math.random() * 3),
        size: 18 + Math.random() * 14,
        alpha: 0.8 + Math.random() * 0.2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rot: (Math.random() - 0.5) * 0.5,
        wobble: Math.random() * Math.PI * 2,
        decay: 0.012 + Math.random() * 0.008,
      });
    }
  }

  let animId;
  let frameCount = 0;
  function draw() {
    ctx.clearRect(0, 0, w, h);
    frameCount++;
    if (frameCount % 60 === 0) spawnAmbient();

    for (let i = hearts.length - 1; i >= 0; i--) {
      const h2 = hearts[i];
      h2.x += h2.vx + Math.sin(Date.now() * 0.002 + h2.wobble) * 0.3;
      h2.y += h2.vy;
      if (h2.decay) h2.alpha -= h2.decay;
      else if (h2.y < -30) h2.alpha -= 0.005;

      if (h2.alpha <= 0) {
        hearts.splice(i, 1);
        continue;
      }

      drawHeart(
        h2.x,
        h2.y,
        h2.size,
        h2.color,
        h2.alpha,
        Math.sin(Date.now() * 0.003 + h2.wobble) * h2.rot,
      );
    }
    animId = requestAnimationFrame(draw);
  }
  draw();
  return { burst, stop: () => cancelAnimationFrame(animId) };
}

let heartsCtx = null;

// ─── SPEECH BUBBLE (Scene 1) ──────────────
const SPEECH_LINES = [
  "hehe you found me! ✿",
  "happy bday to meee~",
  "i'm the main character ♡",
  "stop clicking me!! >.<",
  "ok one more... ✨",
  "no really stop ❤",
  "fine i like the attention",
  "sunshine chan~ ☆",
];
let speechIndex = 0;
let speechTimeout = null;

function hideSpeechBubble() {
  const bubble = document.getElementById("speech-bubble");
  if (!bubble) return;

  bubble.classList.remove("show", "is-measuring");
}

function positionSpeechBubble() {
  const bubble = document.getElementById("speech-bubble");
  if (!bubble) return;

  const viewportMargin = 16;
  bubble.style.setProperty("--bubble-shift", "0px");
  bubble.dataset.position = "above";

  let rect = bubble.getBoundingClientRect();
  let shift = 0;

  if (rect.left < viewportMargin) {
    shift = viewportMargin - rect.left;
  } else if (rect.right > window.innerWidth - viewportMargin) {
    shift = window.innerWidth - viewportMargin - rect.right;
  }

  bubble.style.setProperty("--bubble-shift", `${shift}px`);
}

function showSpeechBubble(message, duration = 2500) {
  const bubble = document.getElementById("speech-bubble");
  const textEl = document.getElementById("speech-text");
  if (!bubble || !textEl) return;

  textEl.textContent = message;
  bubble.classList.add("show", "is-measuring");
  positionSpeechBubble();

  requestAnimationFrame(() => {
    bubble.classList.remove("is-measuring");
  });

  clearTimeout(speechTimeout);
  speechTimeout = setTimeout(() => hideSpeechBubble(), duration);
}

$charWrap.addEventListener("click", (e) => {
  if (currentScene !== 1) return;

  // Cycle through lines
  const line = SPEECH_LINES[speechIndex % SPEECH_LINES.length];
  speechIndex++;

  showSpeechBubble(line);

  // Burst hearts from character
  if (heartsCtx) {
    const rect = $charWrap.getBoundingClientRect();
    heartsCtx.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 10);
  }
});

window.addEventListener("resize", () => {
  const bubble = document.getElementById("speech-bubble");
  if (!bubble?.classList.contains("show")) return;

  bubble.classList.add("is-measuring");
  positionSpeechBubble();
  requestAnimationFrame(() => {
    bubble.classList.remove("is-measuring");
  });
});

// ─── CARD INTERACTIONS (Scene 1) ───────────
document.querySelectorAll(".px-card").forEach((card) => {
  card.addEventListener("click", () => {
    // Wiggle animation
    card.classList.remove("wiggle");
    void card.offsetWidth; // reflow
    card.classList.add("wiggle");
    setTimeout(() => card.classList.remove("wiggle"), 500);

    // Spawn emoji burst from card
    if (heartsCtx) {
      const rect = card.getBoundingClientRect();
      heartsCtx.burst(rect.left + rect.width / 2, rect.top, 5);
    }
  });
});

// ─── STAR-FIELD CANVAS (Scene 2) ─────────────
function createStarField(canvas) {
  const ctx = canvas.getContext("2d");
  let w,
    h,
    stars = [];
  const LAYERS = [
    { count: 80, speed: 0.3, size: 1, alpha: 0.4 },
    { count: 50, speed: 0.8, size: 1.5, alpha: 0.6 },
    { count: 30, speed: 1.8, size: 2.5, alpha: 1 },
  ];

  function resize() {
    w = canvas.width = canvas.offsetWidth;
    h = canvas.height = canvas.offsetHeight;
    stars = [];
    LAYERS.forEach((layer) => {
      for (let i = 0; i < layer.count; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          speed: layer.speed + Math.random() * 0.3,
          size: layer.size,
          alpha: layer.alpha * (0.5 + Math.random() * 0.5),
        });
      }
    });
  }

  let animId;
  function draw() {
    ctx.clearRect(0, 0, w, h);
    stars.forEach((s) => {
      s.x -= s.speed;
      if (s.x < -4) {
        s.x = w + 4;
        s.y = Math.random() * h;
      }
      ctx.globalAlpha =
        s.alpha * (0.6 + 0.4 * Math.sin(Date.now() * 0.003 + s.y));
      ctx.fillStyle = "#fff";
      ctx.fillRect(
        Math.round(s.x),
        Math.round(s.y),
        Math.round(s.size),
        Math.round(s.size),
      );
    });
    animId = requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener("resize", resize);
  draw();
  return () => cancelAnimationFrame(animId);
}

// ─── TRAIL PARTICLES (Scene 2) ───────────────
function createTrailRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  let w, h;
  const particles = [];
  const COLORS = ["#f9a8d4", "#e9d5ff", "#ff69b4", "#fce7f3", "#ffb7c5"];

  function resize() {
    w = canvas.width = canvas.offsetWidth;
    h = canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  function emit(x, y) {
    for (let i = 0; i < 5; i++) {
      particles.push({
        x,
        y,
        vx: -Math.random() * 3 - 1,
        vy: (Math.random() - 0.5) * 2,
        life: 1,
        decay: 0.012 + Math.random() * 0.015,
        size: 2 + Math.random() * 5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    }
  }

  let animId;
  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = p.life * 0.8;
      ctx.fillStyle = p.color;
      // pixel-style square particles
      ctx.fillRect(
        Math.round(p.x),
        Math.round(p.y),
        Math.round(p.size),
        Math.round(p.size),
      );
    }
    animId = requestAnimationFrame(draw);
  }
  draw();

  return { emit, stop: () => cancelAnimationFrame(animId) };
}

// ─── DUST PARTICLES (Scene 5) ────────────────

// ─── THREE.JS (Scene 4) ─────────────────────
function setupThree(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  );
  camera.position.z = 14;

  const group = new THREE.Group();
  scene.add(group);

  const COLORS = [0xf9a8d4, 0xe9d5ff, 0xff69b4, 0xffb7c5, 0xec4899, 0xfbbf24];
  const geos = [
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.IcosahedronGeometry(0.6, 0),
    new THREE.OctahedronGeometry(0.7, 0),
    new THREE.TetrahedronGeometry(0.8, 0),
  ];

  for (let i = 0; i < 40; i++) {
    const geo = geos[Math.floor(Math.random() * geos.length)];
    const mat = new THREE.MeshPhongMaterial({
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      flatShading: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const spread = 18;
    mesh.position.set(
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * 8 - 4,
    );
    const s = 0.4 + Math.random() * 0.9;
    mesh.scale.setScalar(s);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    mesh.userData = {
      rotX: (Math.random() - 0.5) * 0.02,
      rotY: (Math.random() - 0.5) * 0.02,
      floatSpeed: 0.3 + Math.random() * 0.5,
      baseY: mesh.position.y,
    };
    group.add(mesh);
  }

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(5, 8, 6);
  scene.add(dir);

  let clock = new THREE.Clock();
  let raf;
  function animate() {
    raf = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    group.children.forEach((m) => {
      m.rotation.x += m.userData.rotX;
      m.rotation.y += m.userData.rotY;
      m.position.y =
        m.userData.baseY +
        Math.sin(t * m.userData.floatSpeed + m.position.x) * 0.8;
    });
    group.rotation.y = t * 0.05;
    renderer.render(scene, camera);
  }

  function handleResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener("resize", handleResize);

  return {
    renderer,
    scene,
    camera,
    group,
    animate,
    raf,
    stop: () => cancelAnimationFrame(raf),
  };
}

// ─── TRANSITION ENGINE ───────────────────────
function showBtn(el) {
  el.classList.remove("hide-btn");
  el.classList.add("show-btn");
}
function hideBtn(el) {
  el.classList.remove("show-btn");
  el.classList.add("hide-btn");
}

function screenShake() {
  $app.classList.add("shake");
  setTimeout(() => $app.classList.remove("shake"), 450);
}

function transitionTo(num) {
  if (num < 1 || num > 5 || num === currentScene || isTransitioning) return;
  isTransitioning = true;

  const prev = currentScene;
  const prevEl = document.getElementById(`scene-${prev}`);
  const nextEl = document.getElementById(`scene-${num}`);
  const goingForward = num > prev;

  // Kill previous scene timelines
  if (scene2Timeline) {
    scene2Timeline.kill();
    scene2Timeline = null;
  }
  if (scene3Timeline) {
    scene3Timeline.kill();
    scene3Timeline = null;
  }

  hideBtn($readBtn);
  hideBtn($restartBtn);

  // Pause video when leaving scene 3 or 4
  if (prev === 3) pauseScene3Video();
  if (prev === 4) pauseScene4Video();
  if (prev === 5) cleanupScene5();

  hideBtn($nextBtn);
  hideBtn($prevBtn);

  // Slide direction: forward = slide left, backward = slide right
  const slideOutX = goingForward ? "-100%" : "100%";
  const slideInX = goingForward ? "100%" : "-100%";
  const useFadeTransition = num === 5 || prev === 5;

  // Prepare incoming scene off-screen
  currentScene = num;
  nextEl.classList.add("active");
  gsap.set(nextEl, {
    x: useFadeTransition ? "0%" : slideInX,
    opacity: useFadeTransition ? 0 : 1,
    visibility: "visible",
  });

  // Smooth slide — 1.0s with gentle easing, no flash/flicker
  const slideDuration = useFadeTransition ? 0.75 : 1.0;
  const tl = gsap.timeline({
    onComplete: () => {
      prevEl.classList.remove("active");
      gsap.set(prevEl, { x: "0%", opacity: 0, visibility: "hidden" });
      isTransitioning = false;
    },
  });

  if (useFadeTransition) {
    tl.to(
      prevEl,
      {
        opacity: 0,
        duration: slideDuration,
        ease: "power2.out",
      },
      0,
    );

    tl.to(
      nextEl,
      {
        opacity: 1,
        duration: slideDuration,
        ease: "power2.out",
      },
      0,
    );
  } else {
    // Outgoing scene slides away (stays fully opaque to avoid flicker)
    tl.to(
      prevEl,
      {
        x: slideOutX,
        duration: slideDuration,
        ease: "power2.inOut",
      },
      0,
    );

    // Incoming scene slides in
    tl.to(
      nextEl,
      {
        x: "0%",
        duration: slideDuration,
        ease: "power2.inOut",
      },
      0,
    );
  }

  crossfadeAudio(num);

  // Fire scene init
  switch (num) {
    case 1:
      enterScene1();
      break;
    case 2:
      enterScene2();
      break;
    case 3:
      enterScene3();
      break;
    case 4:
      enterScene4();
      break;
    case 5:
      enterScene5();
      break;
  }
}

// ─── SCENE 1 — HOME ─────────────────────────
function enterScene1() {
  // Init hearts canvas
  const heartsCanvas = document.getElementById("hearts-canvas");
  if (!heartsCtx) heartsCtx = createHeartsRenderer(heartsCanvas);

  // Hide speech bubble
  hideSpeechBubble();

  // Reset elements
  gsap.set(".s1-line", { y: 40, opacity: 0 });
  gsap.set(".px-card", { y: 24, opacity: 0 });
  gsap.set($charWrap, { x: -180, opacity: 0 });

  const tl = gsap.timeline();

  // Character slides in
  tl.to($charWrap, { x: 0, opacity: 1, duration: 1.2, ease: "power3.out" });

  // Text appears line by line
  tl.to(
    ".s1-line",
    { y: 0, opacity: 1, duration: 0.8, stagger: 0.25, ease: "power3.out" },
    "-=0.4",
  );

  // Cards pop up
  tl.to(
    ".px-card",
    {
      y: 0,
      opacity: 1,
      duration: 0.6,
      stagger: 0.15,
      ease: "back.out(1.5)",
      onComplete: () => {
        showBtn($nextBtn);
        // Show initial speech bubble hint
        showSpeechBubble("click me! ♡", 3000);
      },
    },
    "-=0.2",
  );
}

// ─── SCENE 2 — THE TRAIL ────────────────────
let stopStars = null;
let trailCtx = null;

function enterScene2() {
  showBtn($prevBtn);

  // Init canvases
  const starCanvas = document.getElementById("star-canvas");
  const trailCanvas = document.getElementById("trail-canvas");
  if (!stopStars) stopStars = createStarField(starCanvas);
  if (!trailCtx) trailCtx = createTrailRenderer(trailCanvas);

  // Reset
  const rocketWrap = document.getElementById("rocket-wrap");
  gsap.set(rocketWrap, { x: -120, y: "-50%" });
  gsap.set(".tr-line", { opacity: 0, y: 20, scale: 1 });

  const chunk1 = $$('.tr-line[data-chunk="1"]');
  const chunk2 = $$('.tr-line[data-chunk="2"]');
  gsap.set(chunk2, { opacity: 0 });

  const tl = gsap.timeline();
  scene2Timeline = tl;

  const endX = window.innerWidth + 200;

  // Rocket moves across
  tl.to(
    rocketWrap,
    {
      x: endX,
      duration: 10.2,
      ease: "power1.inOut",
      onUpdate: function () {
        // Emit trail particles from rocket position
        const rect = rocketWrap.getBoundingClientRect();
        if (trailCtx) trailCtx.emit(rect.left, rect.top + rect.height / 2);
      },
    },
    0,
  );

  // Chunk 1 text
  tl.to(chunk1[0], { opacity: 1, y: 0, duration: 0.5 }, 1); // "she is my—"
  tl.fromTo(
    chunk1[1],
    { scale: 0.2, opacity: 0 },
    {
      scale: 1,
      opacity: 1,
      duration: 0.6,
      ease: "back.out(2.5)",
      onComplete: screenShake,
    },
    1.8,
  ); // "BESTEST" — slams in
  tl.to(chunk1[2], { opacity: 1, y: 0, duration: 0.6 }, 2.8); // "best friend."

  // Fade out chunk 1
  tl.to(chunk1, { opacity: 0, duration: 0.4 }, 4.5);

  // Chunk 2 text
  tl.to(chunk2[0], { opacity: 1, y: 0, duration: 0.5 }, 5.2);
  tl.to(chunk2[1], { opacity: 1, y: 0, duration: 0.5 }, 5.8);
  tl.to(chunk2[2], { opacity: 1, y: 0, duration: 0.5 }, 6.4);

  // After rocket exits — flash to Scene 3
  tl.call(
    () => {
      transitionTo(3);
    },
    null,
    10.4,
  );
}

// ─── SCENE 3 — VIDEO VIBES ✿ ──────────────
let s3Video = null;
let sparkleCtx = null;

// Sparkle particles — follow mouse over the video
function createSparkleRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  let w, h;
  const particles = [];
  const COLORS = [
    "#fff",
    "#f9a8d4",
    "#ff69b4",
    "#e9d5ff",
    "#fbbf24",
    "#ffb7c5",
  ];

  function resize() {
    w = canvas.width = canvas.offsetWidth;
    h = canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  function emit(x, y, count = 3) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3 - 1,
        size: 2 + Math.random() * 4,
        alpha: 0.8 + Math.random() * 0.2,
        decay: 0.015 + Math.random() * 0.01,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    }
  }

  let animId;
  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      p.size *= 0.98;
      if (p.alpha <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();

      // Add a glow
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    animId = requestAnimationFrame(draw);
  }
  draw();
  return { emit, stop: () => cancelAnimationFrame(animId) };
}

// Mouse tracking for sparkles in Scene 3
document.addEventListener("mousemove", (e) => {
  if (currentScene !== 3 || !sparkleCtx) return;
  const scene3El = document.getElementById("scene-3");
  const rect = scene3El.getBoundingClientRect();
  sparkleCtx.emit(e.clientX - rect.left, e.clientY - rect.top, 2);
});

function enterScene3() {
  showBtn($prevBtn);

  // Init sparkle canvas
  const sparkleCanvas = document.getElementById("sparkle-canvas");
  if (!sparkleCtx) sparkleCtx = createSparkleRenderer(sparkleCanvas);

  // Get video element & play it
  s3Video = document.getElementById("s3-video");
  if (s3Video) {
    s3Video.currentTime = 0;
    s3Video.muted = isMuted;
    s3Video.play().catch((e) => console.warn("[Video] Autoplay blocked:", e));
  }

  // The heartfelt message — typed out beautifully ✿
  const lines = [
    "Just like these flowers",
    "shining in the dark...",
    "you shine brighter,",
    "sunshine chan~",
    "illuminating my life,",
    "thank you for being",
    "in my life ♡",
  ];

  const display = document.getElementById("fact-display");
  display.innerHTML = "";

  const tl = gsap.timeline();
  scene3Timeline = tl;

  // Create all lines, stack them vertically in the center
  const container = document.createElement("div");
  container.style.cssText = `
    display: flex; flex-direction: column; align-items: center;
    gap: 0.3rem;
  `;
  display.appendChild(container);

  lines.forEach((text, i) => {
    const el = document.createElement("div");
    el.textContent = text;

    // Style based on emphasis
    const isEmphasis = text.includes("sunshine") || text.includes("brighter") || text.includes("illuminating");
    const isLast = i === lines.length - 1;

    el.style.cssText = `
      font-family: ${isEmphasis ? "'Bebas Neue', Impact, sans-serif" : "'Nunito', sans-serif"};
      font-size: ${isEmphasis ? "clamp(2.5rem, 6vw, 4.5rem)" : isLast ? "clamp(1.2rem, 2.5vw, 2rem)" : "clamp(1.4rem, 3vw, 2.2rem)"};
      font-weight: ${isEmphasis ? "400" : "600"};
      color: ${isEmphasis ? "#ff69b4" : isLast ? "#e9d5ff" : "#fff"};
      text-shadow: 0 2px 20px rgba(0,0,0,0.6), 0 0 ${isEmphasis ? "50px rgba(255,105,180,0.5)" : "30px rgba(255,255,255,0.2)"};
      opacity: 0;
      letter-spacing: ${isEmphasis ? "4px" : "2px"};
      line-height: 1.2;
      text-transform: ${isEmphasis ? "uppercase" : "none"};
    `;
    container.appendChild(el);

    // Staggered reveal — each line fades in and stays
    tl.fromTo(
      el,
      { y: 20, opacity: 0, filter: "blur(8px)" },
      {
        y: 0,
        opacity: 1,
        filter: "blur(0px)",
        duration: 1.0,
        ease: "power2.out",
      },
      i * 1.5 + 0.5,
    );
  });

  // After all lines are visible, gentle pulse on the emphasis lines
  const totalDuration = lines.length * 1.5 + 2;
  tl.call(
    () => {
      // Add subtle breathing glow to emphasis text
      container.querySelectorAll("div").forEach((el, i) => {
        if (
          lines[i] &&
          (lines[i].includes("sunshine") || lines[i].includes("brighter") || lines[i].includes("illuminating"))
        ) {
          gsap.to(el, {
            textShadow:
              "0 2px 20px rgba(0,0,0,0.6), 0 0 60px rgba(255,105,180,0.7)",
            duration: 1.5,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
          });
        }
      });
      showBtn($nextBtn);
      showBtn($prevBtn);
    },
    null,
    totalDuration,
  );
}

// Pause video when leaving scene 3
function pauseScene3Video() {
  if (s3Video) {
    s3Video.pause();
    s3Video.muted = true;
  }
}

function syncScene4Lighting() {
  const scene4El = document.getElementById("scene-4");
  if (!scene4El || !s4Video) return;

  if (!s4LightTriggered && s4Video.currentTime >= 6) {
    s4LightTriggered = true;
    scene4El.classList.add("scene-4-lit");
  }
}

function handleScene4VideoTimeUpdate() {
  syncScene4Lighting();

  if (!s4Video || !s4LoopSegmentActive || !Number.isFinite(s4Video.duration))
    return;
  if (s4Video.currentTime >= s4Video.duration - 0.08) {
    s4Video.currentTime = s4LoopStartTime;
  }
}

function pauseScene4Video() {
  if (scene4RevealTimeout) {
    clearTimeout(scene4RevealTimeout);
    scene4RevealTimeout = null;
  }
  gsap.killTweensOf($readBtn);
  hideBtn($readBtn);
  if (!s4Video) return;
  s4Video.pause();
  s4Video.currentTime = 0;
  s4Video.onended = null;
  s4Video.ontimeupdate = null;
  s4LightTriggered = false;
  s4LoopSegmentActive = false;
  s4LoopStartTime = 0;
  document.getElementById("scene-4")?.classList.remove("scene-4-lit");
}

function revealScene4ReadButton() {
  if (currentScene !== 4 || isTransitioning) return;
  gsap.killTweensOf($readBtn);
  $readBtn.classList.remove("hide-btn");
  $readBtn.classList.add("show-btn");
  gsap.fromTo(
    $readBtn,
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 0.8 },
  );
}

// ─── SCENE 4 — BIRTHDAY (Video Only) ────────
function enterScene4() {
  showBtn($prevBtn);
  hideBtn($readBtn);

  const scene4El = document.getElementById("scene-4");
  s4LightTriggered = false;

  s4Video = document.getElementById("s4-video");
  if (s4Video) {
    s4Video.currentTime = 0;
    scene4El.classList.add("scene-4-lit");
    s4Video.muted = isMuted;
    s4LoopSegmentActive = false;
    s4LoopStartTime = 0;
    s4Video.ontimeupdate = handleScene4VideoTimeUpdate;
    s4Video.onended = () => {
      scene4El.classList.add("scene-4-lit");
      s4LightTriggered = true;
      revealScene4ReadButton();
      if (Number.isFinite(s4Video.duration) && s4Video.duration > 0) {
        s4LoopStartTime = Math.max(s4Video.duration - 3, 0);
      } else {
        s4LoopStartTime = 8;
      }
      s4LoopSegmentActive = true;
      s4Video.currentTime = s4LoopStartTime;
      s4Video
        .play()
        .catch((e) => console.warn("[Scene4 Video] Loop replay blocked:", e));
    };
    s4Video
      .play()
      .catch((e) => console.warn("[Scene4 Video] Autoplay blocked:", e));

    // Fallback in case ended doesn't fire consistently after a seek/revisit.
    const fallbackMs =
      Number.isFinite(s4Video.duration) && s4Video.duration > 0
        ? Math.ceil(s4Video.duration * 1000) + 200
        : 9800;
    scene4RevealTimeout = setTimeout(() => {
      scene4El.classList.add("scene-4-lit");
      s4LightTriggered = true;
      revealScene4ReadButton();
    }, fallbackMs);
  }
}

function cleanupScene5() {
  gsap.killTweensOf($restartBtn);
  const letterBody = document.getElementById("letter-body");
  if (letterBody) letterBody.innerHTML = "";
  hideBtn($restartBtn);
}

$readBtn.addEventListener("click", () => {
  if (
    currentScene !== 4 ||
    isTransitioning ||
    !$readBtn.classList.contains("show-btn")
  ) {
    return;
  }
  transitionTo(5);
});

// ─── SCENE 5 — THE LETTER ──────────────────
const envContent = import.meta.env.VITE_LETTER_CONTENT;
const fallbackContent = `Dear SRINIDHI,

Happy Birthday! 🎂

— Your Favorite Person`;

const LETTER_CONTENT = envContent ? envContent.replace(/\\n/g, '\n') : fallbackContent;

function enterScene5() {
  hideBtn($nextBtn);
  showBtn($prevBtn);
  hideBtn($restartBtn);
  cleanupScene5();

  const letterCard = document.getElementById("letter-card");
  gsap.set(letterCard, { opacity: 1, y: 0 });
  document.getElementById("letter-body").textContent = LETTER_CONTENT;

  $restartBtn.classList.remove("hide-btn");
  $restartBtn.classList.add("show-btn");
  gsap.set($restartBtn, { opacity: 1 });
  return;

  // Start typing after envelope settles
  scene5TypeStartTimeout = setTimeout(() => {
    scene5TypeStartTimeout = null;
    if (currentScene !== 5 || isTransitioning) return;

    // // EDIT THIS — change the letter content below
    const letterContent = `Dear SRINIDHI,

Happy Birthday to the most incredible person I know.

You are one of those rare humans who makes everyone around you feel seen, heard, and valued. Your energy is contagious, your laughter could honestly cure diseases, and your loyalty is the kind they write songs about.

Thank you for being the kind of friend who shows up — not just when it is easy, but when it matters.

Here is to another year of bad jokes, deep talks, unnecessary debates about food, and making every single moment count.

Happy Birthday. You deserve the whole world and then some. 🎂

— Your Favorite Person (don't argue)`;

    letterTyped = new Typed("#letter-body", {
      strings: [letterContent],
      typeSpeed: 25,
      showCursor: true,
      cursorChar: "▌",
      onComplete: () => {
        if (currentScene !== 5 || isTransitioning) return;
        // Gentle confetti
        canvasConfetti({
          particleCount: 100,
          spread: 100,
          origin: { y: 0.35 },
          colors: ["#ff69b4", "#e9d5ff", "#f9a8d4"],
          gravity: 0.4,
          ticks: 300,
        });
        // Show restart
        gsap.killTweensOf($restartBtn);
        $restartBtn.classList.remove("hide-btn");
        $restartBtn.classList.add("show-btn");
        gsap.fromTo($restartBtn, { opacity: 0 }, { opacity: 1, duration: 0.8 });
      },
    });
  }, 1800);
}

$restartBtn.addEventListener("click", () => {
  if (
    currentScene !== 5 ||
    isTransitioning ||
    !$restartBtn.classList.contains("show-btn")
  ) {
    return;
  }
  cleanupScene5();
  transitionTo(1);
});

// ─── NAV BUTTONS ─────────────────────────────
$nextBtn.addEventListener("click", () => {
  if (currentScene < 5) transitionTo(currentScene + 1);
});
$prevBtn.addEventListener("click", () => {
  if (currentScene > 1) transitionTo(currentScene - 1);
});

// ─── AUDIO PERMISSION POPUP ──────────────────
function createAudioPopup() {
  const overlay = document.createElement("div");
  overlay.id = "audio-popup-overlay";
  overlay.innerHTML = `
    <div class="audio-popup">
      <div class="audio-popup-icon">🎵</div>
      <div class="audio-popup-title">Enable Sound?</div>
      <div class="audio-popup-desc">This experience is best with audio on!</div>
      <div class="audio-popup-btns">
        <button id="audio-yes" class="audio-popup-btn audio-popup-yes">♪ Turn On Audio</button>
        <button id="audio-no" class="audio-popup-btn audio-popup-no">Continue Muted</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  function dismiss(enableAudio) {
    gsap.to(overlay, {
      opacity: 0,
      duration: 0.4,
      ease: "power2.out",
      onComplete: () => {
        overlay.remove();
        if (enableAudio) setAudioState(false); // unmute
      },
    });
  }

  document
    .getElementById("audio-yes")
    .addEventListener("click", () => dismiss(true));
  document
    .getElementById("audio-no")
    .addEventListener("click", () => dismiss(false));
}

// ─── BOOT ────────────────────────────────────
preloadAllAudio();
createCursorTrailRenderer($cursorTrailCanvas);
currentScene = 1;
enterScene1();

// Show audio popup after a brief delay so the page renders first
setTimeout(createAudioPopup, 600);

// Attempt fullscreen on the first user interaction
document.addEventListener("click", function startFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch((err) => {
      console.warn("Fullscreen request failed:", err);
    });
  }
  document.removeEventListener("click", startFullscreen, true);
}, { capture: true });
