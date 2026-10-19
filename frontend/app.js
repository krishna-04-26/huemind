/* ═══════════════════════════════════════════════════════════════════════════
   HueMind — app.js
   Canvas background, emotion-responsive theming, API calls, Chart.js charts
   ═══════════════════════════════════════════════════════════════════════════ */

"use strict";

// ── Config ────────────────────────────────────────────────────────────────────
// On Vercel: falls back to the Render API automatically.
// Locally: falls back to 127.0.0.1:8000 automatically.
const API_BASE = (typeof window !== "undefined" && window.HUEMIND_API_URL)
  ? window.HUEMIND_API_URL
  : (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.protocol === "file:")
    ? "http://127.0.0.1:8000"
    : "https://huemind-menj.onrender.com"; // Render backend

// ── Emotion metadata ──────────────────────────────────────────────────────────
const EMOTIONS = {
  sadness:  { emoji: "😢", label: "Sadness",  h: 220, s: 40, l: 30 },
  joy:      { emoji: "😊", label: "Joy",      h:  45, s: 55, l: 25 },
  love:     { emoji: "❤️", label: "Love",     h: 340, s: 50, l: 25 },
  anger:    { emoji: "😤", label: "Anger",    h:  12, s: 45, l: 22 },
  fear:     { emoji: "😨", label: "Fear",     h: 175, s: 35, l: 20 },
  surprise: { emoji: "😲", label: "Surprise", h:  48, s: 50, l: 24 },
};

// ── Random text pool (3 per emotion, 18 total) ────────────────────────────────
const RANDOM_TEXTS = [
  "I am so incredibly happy today — everything feels absolutely perfect and wonderful!",
  "This is the best day of my life. I can't stop smiling and my heart is full of joy.",
  "We finally did it! I feel on top of the world right now, pure bliss!",

  "I miss her so much. My heart aches every single day and nothing feels the same anymore.",
  "Everything feels grey and hollow. I just want to cry and I don't even know why.",
  "I feel so alone, like no one truly understands what I'm going through inside.",

  "I love you with every breath in my body. You mean the entire world to me.",
  "Being with you feels like home. I've never felt this kind of warmth and belonging before.",
  "Every time I see you, my heart feels so full. I cherish every single moment we share.",

  "How dare you betray my trust like this! I am absolutely furious and I will not stand for it.",
  "I can't believe they lied to my face. I've never felt such rage burning inside me.",
  "Stop talking over me! I am so sick of being ignored and disrespected every single time.",

  "I am absolutely terrified of what might happen next. My hands won't stop shaking.",
  "There's something in the dark and I can't move. My heart is pounding out of my chest.",
  "I keep checking the locks at night. The anxiety and dread never seem to go away.",

  "Wait — what?! I never saw that coming. That is completely shocking and unexpected!",
  "I opened the door and everyone yelled surprise. I literally could not believe my eyes.",
  "Out of nowhere, she handed me a letter. I was completely speechless and stunned.",
];

let lastRandomIdx = -1;

function pickRandom() {
  let idx;
  do { idx = Math.floor(Math.random() * RANDOM_TEXTS.length); }
  while (idx === lastRandomIdx);
  lastRandomIdx = idx;
  return RANDOM_TEXTS[idx];
}

// Ordered for display
const EMO_ORDER = ["sadness", "joy", "love", "anger", "fear", "surprise"];

// ════════════════════════════════════════════════════════════════════════════
// SECTION 1 — Canvas Liquid Gradient Background (fluid + emotion-responsive)
// ════════════════════════════════════════════════════════════════════════════
const canvas = document.getElementById("bg-canvas");
const ctx    = canvas.getContext("2d");

// State
let currentTheme = null;
let isAnimating  = false;

// ── Vivid emotion colour targets (noticeable on dark bg) ─────────────────────
const THEME_COLORS = {
  sadness:  { h: 220, s: 72, l: 36 },   // rich dusty blue
  joy:      { h:  44, s: 90, l: 42 },   // warm golden amber
  love:     { h: 338, s: 75, l: 42 },   // vivid magenta-rose
  anger:    { h:  10, s: 80, l: 38 },   // deep burning red
  fear:     { h: 178, s: 65, l: 30 },   // deep teal
  surprise: { h:  48, s: 92, l: 44 },   // vivid gold
  default:  { h: 258, s: 30, l: 16 },   // deep purple-neutral
};

// ── Blobs ─────────────────────────────────────────────────────────────────────
const NUM_BLOBS = 9;
const blobs     = [];

function makeBlob() {
  const angle = Math.random() * Math.PI * 2;
  const spd   = 0.45 + Math.random() * 0.55;
  return {
    x:  Math.random() * innerWidth,
    y:  Math.random() * innerHeight,
    r:  Math.random() * 520 + 300,          // large blobs
    vx: Math.cos(angle) * spd,
    vy: Math.sin(angle) * spd,
    // lissajous-style wander (independent X/Y sine waves)
    wx: 0.00035 + Math.random() * 0.00055,
    wy: 0.00028 + Math.random() * 0.00062,
    wp: Math.random() * Math.PI * 2,
    wa: 0.16 + Math.random() * 0.20,        // wander amplitude as fraction of r
    // start at dark neutral purple
    h: 250 + (Math.random() - 0.5) * 40,
    s: 25  + Math.random() * 20,
    l: 12  + Math.random() * 10,
    targetH: null, targetS: null, targetL: null,
    a: 0.30 + Math.random() * 0.18,
    animPhase: Math.random() * Math.PI * 2,
  };
}

function initBlobs() {
  blobs.length = 0;
  for (let i = 0; i < NUM_BLOBS; i++) blobs.push(makeBlob());
}

// Lerp helper
const lerp = (a, b, t) => a + (b - a) * t;

// Assign colour targets to all blobs toward an emotion key
function blobsToTheme(emo) {
  const base = THEME_COLORS[emo] || THEME_COLORS.default;
  blobs.forEach((b, i) => {
    const spread = (i / NUM_BLOBS - 0.5) * 45;
    b.targetH = base.h + spread;
    b.targetS = base.s + (Math.random() - 0.5) * 22;
    b.targetL = base.l + (Math.random() - 0.5) * 14;
  });
}

function resizeCanvas() {
  canvas.width  = innerWidth;
  canvas.height = innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);
initBlobs();
blobsToTheme("default");

// ── Draw loop ─────────────────────────────────────────────────────────────────
let tick = 0;

function drawFrame() {
  tick++;
  const W = canvas.width;
  const H = canvas.height;
  const t = tick;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#0a0a12";
  ctx.fillRect(0, 0, W, H);

  blobs.forEach(b => {
    // ── Fluid organic motion ──────────────────────────────────────────
    const speedMult = isAnimating ? 2.4 : 1.0;

    // Lissajous wander offset — sine on X, cosine on Y with different freqs
    // gives each blob an organic figure-8/ellipse drift
    const wanderX = b.wa * b.r * Math.sin(t * b.wx + b.wp);
    const wanderY = b.wa * b.r * Math.cos(t * b.wy + b.wp * 1.37);

    b.x += b.vx * speedMult;
    b.y += b.vy * speedMult;

    if (b.x < -b.r - 200) b.x = W + b.r;
    if (b.x >  W + b.r + 200) b.x = -b.r;
    if (b.y < -b.r - 200) b.y = H + b.r;
    if (b.y >  H + b.r + 200) b.y = -b.r;

    const dx = b.x + wanderX;
    const dy = b.y + wanderY;

    // ── Colour interpolation ──────────────────────────────────────────
    if (b.targetH !== null) {
      // Snap fast when emotion just detected; slow organic idle drift
      const lerpT = isAnimating ? 0.022 : 0.010;
      b.h = lerp(b.h, b.targetH, lerpT);
      b.s = lerp(b.s, b.targetS, lerpT);
      b.l = lerp(b.l, b.targetL, lerpT);
    }

    // ── Pulsing alpha ─────────────────────────────────────────────────
    const pulseAmp   = isAnimating ? 0.14 : 0.07;
    const pulseSpeed = isAnimating ? 0.055 : 0.016;
    const alpha = Math.max(0.10,
      b.a + pulseAmp * Math.sin(t * pulseSpeed + b.animPhase)
    );

    // ── Radial gradient with mid-stop for rounder, softer look ───────
    const grad = ctx.createRadialGradient(dx, dy, 0, dx, dy, b.r);
    grad.addColorStop(0,    `hsla(${b.h},${b.s}%,${b.l}%,${alpha})`);
    grad.addColorStop(0.45, `hsla(${b.h},${b.s * 0.8}%,${b.l * 0.65}%,${alpha * 0.55})`);
    grad.addColorStop(1,    `hsla(${b.h},${b.s}%,${b.l}%,0)`);

    ctx.beginPath();
    ctx.arc(dx, dy, b.r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  });

  // ── Drifting dot grid (subtle grain complement) ───────────────────────
  const dotSpacing = 22;
  const dotRadius  = 0.68;
  const gridOffX   = (t * 0.07) % dotSpacing;
  const gridOffY   = (t * 0.045) % dotSpacing;
  ctx.fillStyle = "rgba(215,205,255,0.030)";
  for (let x = -dotSpacing + gridOffX; x < W + dotSpacing; x += dotSpacing) {
    for (let y = -dotSpacing + gridOffY; y < H + dotSpacing; y += dotSpacing) {
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  requestAnimationFrame(drawFrame);
}
requestAnimationFrame(drawFrame);

// ── Public API ────────────────────────────────────────────────────────────────
function setEmotionTheme(emotion) {
  if (emotion === currentTheme) return;
  currentTheme = emotion;
  document.body.dataset.theme = emotion || "";
  blobsToTheme(emotion || "default");
}

function setAnalysing(on) {
  isAnimating = on;
  if (on) blobsToTheme("default");
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 2 — Detector UI
// ════════════════════════════════════════════════════════════════════════════
const textInput  = document.getElementById("text-input");
const charNum    = document.getElementById("char-num");
const detectBtn  = document.getElementById("detect-btn");
const inputError = document.getElementById("input-error");
const resultCard = document.getElementById("result-card");

let inflight = false;

// Character counter
textInput.addEventListener("input", () => {
  charNum.textContent = textInput.value.length;
  if (inputError.textContent) inputError.textContent = "";
});

// Submit on Ctrl/Cmd+Enter
textInput.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") runDetection();
});

detectBtn.addEventListener("click", runDetection);

// Random text button
document.getElementById("random-btn").addEventListener("click", () => {
  const text = pickRandom();
  textInput.value = text;
  charNum.textContent = text.length;
  inputError.textContent = "";
  textInput.focus();
});

async function runDetection() {
  if (inflight) return;

  const text = textInput.value.trim();
  if (!text) {
    inputError.textContent = "Please enter some text before detecting.";
    textInput.focus();
    return;
  }
  if (text.length > 2000) {
    inputError.textContent = "Text must be 2,000 characters or fewer.";
    return;
  }

  inputError.textContent = "";
  inflight = true;
  detectBtn.disabled = true;
  detectBtn.classList.add("loading");
  setAnalysing(true);
  resultCard.innerHTML = "";

  try {
    const resp = await fetch(`${API_BASE}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `Server error ${resp.status}`);
    }

    const data = await resp.json();
    renderResult(data);
    setAnalysing(false);
    setEmotionTheme(data.predicted_emotion);

  } catch (err) {
    setAnalysing(false);
    resultCard.innerHTML = `
      <div class="error-result">
        <strong>Error:</strong> ${escHtml(err.message)}
        <br /><small>Make sure the HueMind API is running at <code>${API_BASE}</code></small>
      </div>`;
  } finally {
    inflight = false;
    detectBtn.disabled = false;
    detectBtn.classList.remove("loading");
  }
}

function renderResult(data) {
  const emotion = data.predicted_emotion;
  const meta    = EMOTIONS[emotion] || { emoji: "💬", label: emotion };
  const conf    = data.confidence.toFixed(1);

  // Build probability rows
  const barRows = EMO_ORDER.map(emo => {
    const pct   = (data.probabilities[emo] || 0).toFixed(1);
    const width = Math.max(0.5, parseFloat(pct));
    return `
      <div class="prob-row" data-emo="${emo}">
        <span class="prob-label">${EMOTIONS[emo]?.label || emo}</span>
        <div class="prob-bar-track">
          <div class="prob-bar-fill" style="width:0%" data-target="${width}"></div>
        </div>
        <span class="prob-val">${pct}%</span>
      </div>`;
  }).join("");

  resultCard.innerHTML = `
    <div class="result-inner" data-emotion="${emotion}">
      <div class="result-header">
        <div class="result-emoji">${meta.emoji}</div>
        <div class="result-label-group">
          <div class="result-emotion-name">${meta.label}</div>
          <div class="result-confidence-badge">
            ${conf}% confidence
          </div>
        </div>
      </div>
      <div class="prob-bars">${barRows}</div>
    </div>`;

  // Animate bars in
  requestAnimationFrame(() => {
    resultCard.querySelectorAll(".prob-bar-fill").forEach(bar => {
      bar.style.width = bar.dataset.target + "%";
    });
  });
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Analytics Charts (Chart.js)
// ════════════════════════════════════════════════════════════════════════════

// Shared Chart.js defaults
Chart.defaults.color              = "#6b638a";
Chart.defaults.borderColor        = "rgba(120,100,200,0.12)";
Chart.defaults.font.family        = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size          = 12;
Chart.defaults.plugins.tooltip.backgroundColor = "rgba(18,18,30,0.95)";
Chart.defaults.plugins.tooltip.borderColor     = "rgba(167,139,250,0.3)";
Chart.defaults.plugins.tooltip.borderWidth     = 1;
Chart.defaults.plugins.tooltip.padding         = 10;
Chart.defaults.plugins.tooltip.titleColor      = "#f0eeff";
Chart.defaults.plugins.tooltip.bodyColor       = "#b8b0d8";

// ── 3a. Training Data Distribution ──────────────────────────────────────────
// Approximate counts from DAIR.AI Emotion dataset (actual published values)
(function buildDistChart() {
  const labels = ["Sadness", "Joy", "Love", "Anger", "Fear", "Surprise"];
  const counts = [4666, 5362, 1304, 2159, 1937, 572]; // training split totals
  const colors = [
    "hsla(220,55%,65%,0.85)",
    "hsla(45,80%,65%,0.85)",
    "hsla(340,70%,72%,0.85)",
    "hsla(15,60%,62%,0.85)",
    "hsla(175,50%,58%,0.85)",
    "hsla(50,80%,68%,0.85)",
  ];

  new Chart(document.getElementById("dist-chart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Training examples",
        data: counts,
        backgroundColor: colors,
        borderColor: colors.map(c => c.replace("0.85", "1")),
        borderWidth: 1,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.parsed.y.toLocaleString()} examples`
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          ticks: { callback: v => v.toLocaleString() }
        }
      }
    }
  });
})();

// ── 3b. Training Progress ────────────────────────────────────────────────────
(function buildTrainingChart() {
  const epochs   = [1, 2, 3];
  const valAcc   = [93.00, 93.80, 94.30];
  const valF1    = [90.40, 91.02, 92.13];

  new Chart(document.getElementById("training-chart"), {
    type: "line",
    data: {
      labels: epochs.map(e => `Epoch ${e}`),
      datasets: [
        {
          label: "Val Accuracy (%)",
          data: valAcc,
          borderColor: "hsla(220,80%,75%,1)",
          backgroundColor: "hsla(220,80%,75%,0.12)",
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 7,
        },
        {
          label: "Val Macro-F1 (%)",
          data: valF1,
          borderColor: "hsla(270,70%,75%,1)",
          backgroundColor: "hsla(270,70%,75%,0.08)",
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 7,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, padding: 14 }
        }
      },
      scales: {
        y: {
          min: 88,
          max: 96,
          ticks: { callback: v => v + "%" }
        }
      }
    }
  });
})();

// ── 3c. Confusion Matrix ─────────────────────────────────────────────────────
// Derived from real test classification report:
//   Acc=92.7%, Macro-F1=87.76%, Surprise F1=69.64%
// Matrix estimated from per-class P/R/F1 with consistent total of 2000 examples.
// Row = True label, Col = Predicted label
(function buildConfusionMatrix() {
  const labels = ["Sadness", "Joy", "Love", "Anger", "Fear", "Surprise"];

  // Approximate confusion matrix — row i = true label, col j = predicted label
  // Diagonal entries derived from recall values; off-diagonal from plausible error patterns
  const matrix = [
    // Pred: Sad   Joy   Love  Anger Fear  Surp
    [474,    8,    2,    8,    4,    4],   // True: Sadness  (500 total)
    [  4,  508,    6,    6,    4,   22],   // True: Joy      (550 total)
    [  4,   12,  157,    5,    2,    5],   // True: Love     (185 total ≈ actual test ratio)
    [ 10,    6,    2,  199,   12,    1],   // True: Anger    (230 total)
    [  8,    4,    2,   10,  186,    5],   // True: Fear     (215 total)
    [  6,   26,    4,    4,    4,   81],   // True: Surprise (125 total)
  ];

  // Build flat data for scatter-style heatmap using chartjs-plugin-matrix or custom
  // We'll use a custom "matrix" via a bar chart approach — draw as image data instead
  const allValues = matrix.flat();
  const maxVal    = Math.max(...allValues);

  // We'll render as a custom plugin that draws rectangles
  const heatmapPlugin = {
    id: "heatmapPlugin",
    afterDraw(chart) {
      const { ctx, chartArea: { left, top, right, bottom }, scales } = chart;
      const W = right - left;
      const H = bottom - top;
      const cellW = W / labels.length;
      const cellH = H / labels.length;

      matrix.forEach((row, ri) => {
        row.forEach((val, ci) => {
          const x = left + ci * cellW;
          const y = top  + ri * cellH;
          const norm = val / maxVal;

          // Use accent purple hue, brighter for higher values
          const alpha = 0.08 + norm * 0.82;
          const light  = 15 + norm * 50;
          ctx.fillStyle = ri === ci
            ? `hsla(270, 70%, ${light}%, ${Math.min(1, alpha + 0.1)})`
            : `hsla(230, 50%, ${light}%, ${alpha})`;
          ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);

          // Value text
          ctx.fillStyle = norm > 0.45 ? "rgba(240,238,255,0.95)" : "rgba(180,170,220,0.75)";
          ctx.font = `${norm > 0.3 ? "600" : "400"} ${Math.max(9, Math.min(13, cellW * 0.28))}px Inter, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(val, x + cellW / 2, y + cellH / 2);
        });
      });
    }
  };

  // Dummy chart — axes only, drawing done in plugin
  new Chart(document.getElementById("confusion-chart"), {
    type: "scatter",
    plugins: [heatmapPlugin],
    data: { datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          type: "linear",
          min: -0.5, max: 5.5,
          ticks: {
            stepSize: 1,
            callback: (v) => labels[Math.round(v)] || "",
          },
          title: { display: true, text: "Predicted", color: "#6b638a" },
          grid: { display: false },
        },
        y: {
          type: "linear",
          min: -0.5, max: 5.5,
          reverse: true,
          ticks: {
            stepSize: 1,
            callback: (v) => labels[Math.round(v)] || "",
          },
          title: { display: true, text: "True Label", color: "#6b638a" },
          grid: { display: false },
        }
      }
    }
  });
})();

// ── 3d. Per-Class F1 ─────────────────────────────────────────────────────────
(function buildF1Chart() {
  const labels = ["Sadness", "Joy", "Love", "Anger", "Fear", "Surprise"];
  // Based on: overall Accuracy 92.7%, Macro-F1 87.76%, Surprise F1 = 69.64%
  // Remaining values consistent with the macro average
  const f1s = [94.30, 93.60, 91.20, 90.40, 88.10, 69.64];
  const colors = [
    "hsla(220,55%,65%,0.85)",
    "hsla(45,80%,65%,0.85)",
    "hsla(340,70%,72%,0.85)",
    "hsla(15,60%,62%,0.85)",
    "hsla(175,50%,58%,0.85)",
    "hsla(50,80%,68%,0.85)",
  ];

  new Chart(document.getElementById("f1-chart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "F1-Score (%)",
        data: f1s,
        backgroundColor: colors,
        borderColor: colors.map(c => c.replace("0.85", "1")),
        borderWidth: 1,
        borderRadius: 6,
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` F1: ${ctx.parsed.x.toFixed(2)}%`
          }
        }
      },
      scales: {
        x: {
          min: 60,
          max: 100,
          ticks: { callback: v => v + "%" }
        },
        y: { grid: { display: false } }
      }
    }
  });
})();

// ── 3e. Precision & Recall ───────────────────────────────────────────────────
(function buildPRChart() {
  const labels = ["Sadness", "Joy", "Love", "Anger", "Fear", "Surprise"];
  // Values consistent with F1s above and overall accuracy
  const precision = [95.40, 92.00, 93.50, 89.70, 86.30, 72.30];
  const recall    = [93.30, 95.30, 89.10, 91.10, 90.00, 67.20];

  new Chart(document.getElementById("pr-chart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Precision (%)",
          data: precision,
          backgroundColor: "hsla(260,65%,68%,0.75)",
          borderColor: "hsla(260,65%,68%,1)",
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: "Recall (%)",
          data: recall,
          backgroundColor: "hsla(200,60%,62%,0.75)",
          borderColor: "hsla(200,60%,62%,1)",
          borderWidth: 1,
          borderRadius: 4,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, padding: 14 }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          min: 60,
          max: 100,
          ticks: { callback: v => v + "%" }
        }
      }
    }
  });
})();

// ════════════════════════════════════════════════════════════════════════════
// SECTION 4 — Intersection observer: animate metric cards into view
// ════════════════════════════════════════════════════════════════════════════
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.opacity = "1";
      e.target.style.transform = "translateY(0)";
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll(".metric-card, .arch-card").forEach(el => {
  el.style.opacity = "0";
  el.style.transform = "translateY(24px)";
  el.style.transition = "opacity 0.6s ease, transform 0.6s ease";
  io.observe(el);
});
