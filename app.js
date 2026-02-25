// Absolute Age Dating Explorer
// Features added:
// 1) Randomized decay order per run (so atoms decay unpredictably).
// 2) Advanced mode: initial daughter contamination (D0).
// 3) Slider uses 0.25% increments + fractional atom visualization.

const ATOM_COUNT = 100;

// --- DOM ---
const systemSel = document.getElementById('system');
const resetBtn = document.getElementById('resetBtn');
const newRunBtn = document.getElementById('newRunBtn');

const halfLifeValue = document.getElementById('halfLifeValue');
const halfLifeUnit = document.getElementById('halfLifeUnit');

const daughterSlider = document.getElementById('daughterSlider');
const daughterOut = document.getElementById('daughterOut');

const advancedMode = document.getElementById('advancedMode');
const advancedPanel = document.getElementById('advancedPanel');
const advancedKpi = document.getElementById('advancedKpi');
const initialDaughter = document.getElementById('initialDaughter');
const initialDaughterOut = document.getElementById('initialDaughterOut');

const parentPctEl = document.getElementById('parentPct');
const nHalvesEl = document.getElementById('nHalves');
const ageOutEl = document.getElementById('ageOut');

const ageApparentEl = document.getElementById('ageApparent');
const ageTrueEl = document.getElementById('ageTrue');
const d0AtomsEl = document.getElementById('d0Atoms');

const parentBar = document.getElementById('parentBar');
const daughterBar = document.getElementById('daughterBar');
const parentBarLabel = document.getElementById('parentBarLabel');
const daughterBarLabel = document.getElementById('daughterBarLabel');

const canvas = document.getElementById('atomsCanvas');
const ctx = canvas.getContext('2d');

// --- Isotope presets (typical values; editable via Custom) ---
// Values are in years.
const presets = [
  { name: 'Custom', t12: 5730, unit: 'yr' },
  { name: 'Carbon-14 → Nitrogen-14', t12: 5730, unit: 'yr' },
  { name: 'Potassium-40 → Argon-40', t12: 1.248e9, unit: 'Gyr' },
  { name: 'Uranium-238 → Lead-206', t12: 4.468e9, unit: 'Gyr' },
  { name: 'Uranium-235 → Lead-207', t12: 7.04e8, unit: 'Myr' },
  { name: 'Rubidium-87 → Strontium-87', t12: 4.88e10, unit: 'Gyr' },
  { name: 'Samarium-147 → Neodymium-143', t12: 1.06e11, unit: 'Gyr' },
];

// --- Randomization state ---
let contamOrder = []; // shuffle of 0..99
let decayOrder = [];  // shuffle of remaining indices after contamination
let overallOrder = []; // contam indices first, then decay indices

function unitFactor(u){
  switch(u){
    case 'yr': return 1;
    case 'kyr': return 1e3;
    case 'Myr': return 1e6;
    case 'Gyr': return 1e9;
    default: return 1;
  }
}

function fmtYears(y){
  if (!isFinite(y) || y < 0) return '—';
  const abs = Math.abs(y);
  const nf = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
  if (abs >= 1e9) return nf.format(y/1e9) + ' Gyr';
  if (abs >= 1e6) return nf.format(y/1e6) + ' Myr';
  if (abs >= 1e3) return nf.format(y/1e3) + ' kyr';
  return nf.format(y) + ' years';
}

function clamp(x, a, b){ return Math.min(b, Math.max(a, x)); }

function shuffle(arr){
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildOrders(){
  // Contamination is represented as daughter atoms present at t=0.
  contamOrder = shuffle([...Array(ATOM_COUNT).keys()]);

  const initD = getInitialDaughters();
  const initFull = Math.floor(initD);
  // Treat the fractional initial daughter as belonging to the next contamination index.
  const initCountForIndexing = initFull + (initD - initFull > 0 ? 1 : 0);
  const contamIndices = contamOrder.slice(0, initCountForIndexing);
  const remaining = contamOrder.slice(initCountForIndexing);
  decayOrder = shuffle([...remaining]);
  overallOrder = [...contamIndices, ...decayOrder];
}

function getInitialDaughters(){
  return advancedMode.checked ? parseFloat(initialDaughter.value || '0') : 0;
}

function getTotalDaughters(){
  // Total daughter percentage slider.
  const d = parseFloat(daughterSlider.value || '0');
  // If advanced mode: total daughters cannot be below initial D0.
  const d0 = getInitialDaughters();
  return advancedMode.checked ? Math.max(d, d0) : d;
}

function setSliderMinForD0(){
  if (!advancedMode.checked){
    daughterSlider.min = '0';
    return;
  }
  const d0 = getInitialDaughters();
  daughterSlider.min = d0.toFixed(2);
  // If slider currently below d0, bump it up.
  if (parseFloat(daughterSlider.value) < d0){
    daughterSlider.value = d0;
  }
}

function computeAges(){
  const hlYears = parseFloat(halfLifeValue.value || '0') * unitFactor(halfLifeUnit.value);
  const dTot = getTotalDaughters()/100; // fraction
  const d0 = getInitialDaughters()/100;
  const parentNow = 1 - dTot;

  // Guard: parentNow must be > 0.
  const eps = 1e-12;
  const parentNowSafe = clamp(parentNow, eps, 1);

  // Apparent (assume N0=1 i.e., D0=0)
  const nApp = Math.log2(1 / parentNowSafe);
  const ageApp = hlYears * nApp;

  if (!advancedMode.checked){
    return { parentNow, nHalves: nApp, age: ageApp, ageApp, ageTrue: ageApp, d0Atoms: 0 };
  }

  // True (uses N0 = 1 - d0)
  const nTrue = Math.log2((1 - d0) / parentNowSafe);
  const ageTrue = hlYears * nTrue;

  return {
    parentNow,
    nHalves: nTrue,
    age: ageTrue,
    ageApp,
    ageTrue,
    d0Atoms: d0 * ATOM_COUNT
  };
}

function drawAtom(x, y, r, state){
  // state: 'parent' | 'daughter' | {partial: frac}
  ctx.save();
  ctx.translate(x, y);

  // soft shadow
  ctx.shadowColor = 'rgba(0,0,0,.35)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;

  if (state === 'parent' || state === 'daughter'){
    ctx.fillStyle = state === 'parent' ? '#6ad39b' : '#ff7aa8';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  } else if (state && state.partial){
    const frac = clamp(state.partial, 0, 1);
    // Draw full parent circle first
    ctx.fillStyle = '#6ad39b';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Clip a rectangle for daughter portion (left-to-right)
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.rect(-r, -r, 2*r*frac, 2*r);
    ctx.clip();

    ctx.fillStyle = '#ff7aa8';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // outline
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function draw(){
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Background grid hint
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = 'rgba(255,255,255,.08)';
  for (let gx = 0; gx <= w; gx += 26){
    ctx.beginPath();
    ctx.moveTo(gx, 0); ctx.lineTo(gx, h);
    ctx.stroke();
  }
  for (let gy = 0; gy <= h; gy += 26){
    ctx.beginPath();
    ctx.moveTo(0, gy); ctx.lineTo(w, gy);
    ctx.stroke();
  }
  ctx.restore();

  // We keep the slider in 0.25% steps for smoothness,
  // but the 100-atom grid can only show whole atoms.
  // So we ROUND the daughter count to the nearest whole atom:
  // fractional part < 0.5 → round down, ≥ 0.5 → round up.
  const totalD = Math.max(0, Math.min(100, getTotalDaughters()));
  const daughterAtoms = Math.round(totalD);

  // Determine which indices are daughters based on randomized overallOrder.
  const daughterSet = new Set(overallOrder.slice(0, daughterAtoms));

  // Layout 10x10 grid
  const cols = 10;
  const pad = 34;
  const gridW = w - pad*2;
  const gridH = h - pad*2;
  const dx = gridW / (cols - 1);
  const dy = gridH / (cols - 1);
  const r = 12;

  for (let i = 0; i < ATOM_COUNT; i++){
    const c = i % cols;
    const rIdx = Math.floor(i / cols);
    const x = pad + c * dx;
    const y = pad + rIdx * dy;

    if (daughterSet.has(i)) drawAtom(x, y, r, 'daughter');
    else drawAtom(x, y, r, 'parent');
  }
}

function updateUI(){
  setSliderMinForD0();

  const d0 = getInitialDaughters();
  const dTot = getTotalDaughters();

  daughterOut.textContent = dTot.toFixed(2) + '%';
  initialDaughterOut.textContent = d0.toFixed(2) + '%';

  // Bars + labels
  const p = 100 - dTot;
  parentPctEl.textContent = p.toFixed(2) + '%';

  parentBar.style.width = p + '%';
  daughterBar.style.width = dTot + '%';
  parentBarLabel.textContent = p.toFixed(2) + '% parent';
  daughterBarLabel.textContent = dTot.toFixed(2) + '% daughter';

  // Age calculations
  const { nHalves, age, ageApp, ageTrue, d0Atoms } = computeAges();

  nHalvesEl.textContent = (isFinite(nHalves) ? nHalves : 0).toFixed(2);
  ageOutEl.textContent = fmtYears(age);

  if (advancedMode.checked){
    ageApparentEl.textContent = fmtYears(ageApp);
    ageTrueEl.textContent = fmtYears(ageTrue);
    d0AtomsEl.textContent = d0Atoms.toFixed(2);
  }

  draw();
}

function toggleAdvanced(){
  const on = advancedMode.checked;
  advancedPanel.classList.toggle('hidden', !on);
  advancedKpi.classList.toggle('hidden', !on);

  buildOrders();
  setSliderMinForD0();
  updateUI();
}

function resetAll(){
  initialDaughter.value = '0';
  advancedMode.checked = false;
  daughterSlider.value = '0';

  toggleAdvanced();
  buildOrders();
  updateUI();
}

function newRun(){
  buildOrders();
  updateUI();
}

function applyPreset(p){
  const y = p.t12;
  let unit = p.unit || 'yr';
  let value = y / unitFactor(unit);

  if (value >= 10000 && unit === 'yr'){ unit = 'kyr'; value = y / unitFactor(unit); }
  if (value >= 10000 && unit === 'kyr'){ unit = 'Myr'; value = y / unitFactor(unit); }
  if (value >= 10000 && unit === 'Myr'){ unit = 'Gyr'; value = y / unitFactor(unit); }

  halfLifeUnit.value = unit;
  halfLifeValue.value = (value).toString();
}

function init(){
  presets.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = p.name;
    systemSel.appendChild(opt);
  });
  systemSel.value = '0';
  applyPreset(presets[0]);

  buildOrders();

  systemSel.addEventListener('change', () => {
    const p = presets[parseInt(systemSel.value, 10)] || presets[0];
    applyPreset(p);
    updateUI();
  });

  [halfLifeValue, halfLifeUnit].forEach(el => el.addEventListener('input', updateUI));
  daughterSlider.addEventListener('input', updateUI);
  initialDaughter.addEventListener('input', () => {
    buildOrders();
    setSliderMinForD0();
    updateUI();
  });
  advancedMode.addEventListener('change', toggleAdvanced);
  resetBtn.addEventListener('click', resetAll);
  newRunBtn.addEventListener('click', newRun);

  toggleAdvanced();
  updateUI();
}

init();
