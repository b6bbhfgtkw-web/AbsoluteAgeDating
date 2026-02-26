// Absolute Age Dating Explorer
// Stable visualization update
// - Dots do NOT reshuffle while dragging the slider.
// - Dots flip only at whole-number % changes (no partial-color dots).
// - Reset/New run randomizes the decay order for the run.
// - Visualization shows ONLY the primary isotope system.

const ATOM_COUNT = 100;

// --- DOM ---
const systemSel = document.getElementById('system');
const resetBtn = document.getElementById('resetBtn');
const newRunBtn = document.getElementById('newRunBtn');
const halfLifeValue = document.getElementById('halfLifeValue');
const halfLifeUnit = document.getElementById('halfLifeUnit');

const daughterSlider = document.getElementById('daughterSlider');
const daughterOut = document.getElementById('daughterOut');
const primarySliderLabel = document.getElementById('primarySliderLabel');
const sliderHint = document.getElementById('sliderHint');

const modePD = document.getElementById('modePD');
const modeTime = document.getElementById('modeTime');
const modeHint = document.getElementById('modeHint');

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

// Compare (numbers only; does not affect visualization)
const compareOn = document.getElementById('compareOn');
const comparePanel = document.getElementById('comparePanel');
const compareSystem = document.getElementById('compareSystem');
const cmp1Parent = document.getElementById('cmp1Parent');
const cmp1Daughter = document.getElementById('cmp1Daughter');
const cmp1Ratio = document.getElementById('cmp1Ratio');
const cmp2Parent = document.getElementById('cmp2Parent');
const cmp2Daughter = document.getElementById('cmp2Daughter');
const cmp2Ratio = document.getElementById('cmp2Ratio');

// --- State ---
const state = {
  mode: 'pd',
  order: [] // fixed shuffle per run
};

// --- Presets (years) ---
const presets = [
  { name: 'Custom', t12: 5730, unit: 'yr' },
  { name: 'Carbon-14 → Nitrogen-14', t12: 5730, unit: 'yr' },
  { name: 'Potassium-40 → Argon-40', t12: 1.248e9, unit: 'Gyr' },
  { name: 'Uranium-238 → Lead-206', t12: 4.468e9, unit: 'Gyr' },
  { name: 'Uranium-235 → Lead-207', t12: 7.04e8, unit: 'Myr' },
  { name: 'Rubidium-87 → Strontium-87', t12: 4.88e10, unit: 'Gyr' },
  { name: 'Samarium-147 → Neodymium-143', t12: 1.06e11, unit: 'Gyr' },
];

function unitFactor(u){
  switch(u){
    case 'yr': return 1;
    case 'kyr': return 1e3;
    case 'Myr': return 1e6;
    case 'Gyr': return 1e9;
    default: return 1;
  }
}

function clamp(x, a, b){ return Math.min(b, Math.max(a, x)); }

function shuffle(arr){
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randomizeOrder(){
  state.order = shuffle([...Array(ATOM_COUNT).keys()]);
}

function getHalfLifeYears(){
  return parseFloat(halfLifeValue.value || '0') * unitFactor(halfLifeUnit.value);
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

function fmtNum(x, digits=3){
  if (x === Infinity) return '∞';
  if (!isFinite(x)) return '—';
  return x.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function getInitialDaughters(){
  return advancedMode.checked ? parseFloat(initialDaughter.value || '0') : 0;
}

// Exact total daughter % (may be fractional)
function getTotalDaughtersExact(){
  const d0 = getInitialDaughters();

  if (state.mode === 'time'){
    const n = clamp(parseFloat(daughterSlider.value || '0'), 0, 7);
    const N0 = 100 - d0;
    const N = N0 * Math.pow(0.5, n);
    return d0 + (N0 - N);
  }

  const d = parseFloat(daughterSlider.value || '0');
  return advancedMode.checked ? Math.max(d, d0) : d;
}

// Whole-number dot count
function getDaughterDots(){
  return clamp(Math.floor(getTotalDaughtersExact()), 0, 100);
}

function setSliderConstraints(){
  if (state.mode === 'time'){
    daughterSlider.min = '0';
    daughterSlider.max = '7';
    daughterSlider.step = '0.01';
    daughterSlider.value = String(clamp(parseFloat(daughterSlider.value || '0'), 0, 7));
    return;
  }

  daughterSlider.max = '100';
  daughterSlider.step = '0.25';

  if (!advancedMode.checked){
    daughterSlider.min = '0';
  } else {
    const d0 = getInitialDaughters();
    daughterSlider.min = d0.toFixed(2);
    if (parseFloat(daughterSlider.value || '0') < d0) daughterSlider.value = d0.toFixed(2);
  }
}

function computeAges(){
  const hlYears = getHalfLifeYears();
  const dTot = getTotalDaughtersExact()/100;
  const d0 = getInitialDaughters()/100;
  const parentNow = 1 - dTot;

  const eps = 1e-12;
  const parentNowSafe = clamp(parentNow, eps, 1);

  const nApp = Math.log2(1 / parentNowSafe);
  const ageApp = hlYears * nApp;

  if (!advancedMode.checked){
    return { nHalves: nApp, age: ageApp, ageApp, ageTrue: ageApp, d0Atoms: 0 };
  }

  const nTrue = Math.log2((1 - d0) / parentNowSafe);
  const ageTrue = hlYears * nTrue;

  return {
    nHalves: (state.mode === 'time') ? clamp(parseFloat(daughterSlider.value || '0'), 0, 7) : nTrue,
    age: (state.mode === 'time') ? hlYears * clamp(parseFloat(daughterSlider.value || '0'), 0, 7) : ageTrue,
    ageApp,
    ageTrue,
    d0Atoms: d0 * ATOM_COUNT
  };
}

function drawAtom(x, y, r, kind){
  ctx.save();
  ctx.translate(x, y);

  ctx.shadowColor = 'rgba(0,0,0,.35)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;

  ctx.fillStyle = (kind === 'daughter') ? '#ff7aa8' : '#6ad39b';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

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

  // grid hint
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

  const fullD = getDaughterDots();
  const daughterSet = new Set(state.order.slice(0, fullD));

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
    drawAtom(x, y, r, daughterSet.has(i) ? 'daughter' : 'parent');
  }
}

function currentTimeYears(){
  const hl = getHalfLifeYears();
  if (!isFinite(hl) || hl <= 0) return NaN;
  if (state.mode === 'time') return hl * clamp(parseFloat(daughterSlider.value || '0'), 0, 7);
  return computeAges().age;
}

function updateCompare(){
  if (!compareOn || !compareOn.checked) return;

  const tYears = currentTimeYears();
  const d0 = getInitialDaughters();

  const d1 = getTotalDaughtersExact();
  const p1 = 100 - d1;
  const r1 = (p1 > 0) ? (d1 / p1) : Infinity;

  const idx = parseInt(compareSystem.value || '0', 10);
  const preset = presets[idx] || presets[0];
  const hl2 = preset.t12;

  let d2 = NaN, p2 = NaN, r2 = NaN;
  if (isFinite(tYears) && isFinite(hl2) && hl2 > 0){
    const N0 = 100 - d0;
    const n2 = tYears / hl2;
    const N2 = N0 * Math.pow(0.5, n2);
    d2 = d0 + (N0 - N2);
    p2 = 100 - d2;
    r2 = (p2 > 0) ? (d2 / p2) : Infinity;
  }

  cmp1Parent.textContent = p1.toFixed(2) + '%';
  cmp1Daughter.textContent = d1.toFixed(2) + '%';
  cmp1Ratio.textContent = fmtNum(r1, 3);

  cmp2Parent.textContent = isFinite(p2) ? p2.toFixed(2) + '%' : '—';
  cmp2Daughter.textContent = isFinite(d2) ? d2.toFixed(2) + '%' : '—';
  cmp2Ratio.textContent = (isFinite(r2) || r2 === Infinity) ? fmtNum(r2, 3) : '—';
}

function updateUI(){
  setSliderConstraints();

  const d0 = getInitialDaughters();
  const dTot = getTotalDaughtersExact();

  if (state.mode === 'time'){
    const n = clamp(parseFloat(daughterSlider.value || '0'), 0, 7);
    daughterOut.textContent = n.toFixed(2) + ' half-lives (' + fmtYears(getHalfLifeYears() * n) + ')';
  } else {
    daughterOut.textContent = dTot.toFixed(2) + '%';
  }

  initialDaughterOut.textContent = d0.toFixed(2) + '%';

  const p = 100 - dTot;
  parentPctEl.textContent = p.toFixed(2) + '%';
  parentBar.style.width = p + '%';
  daughterBar.style.width = dTot + '%';
  parentBarLabel.textContent = p.toFixed(2) + '% parent';
  daughterBarLabel.textContent = dTot.toFixed(2) + '% daughter';

  const ages = computeAges();
  nHalvesEl.textContent = (isFinite(ages.nHalves) ? ages.nHalves : 0).toFixed(2);
  ageOutEl.textContent = fmtYears(ages.age);

  if (advancedMode.checked){
    ageApparentEl.textContent = fmtYears(ages.ageApp);
    ageTrueEl.textContent = fmtYears(ages.ageTrue);
    d0AtomsEl.textContent = ages.d0Atoms.toFixed(2);
  }

  draw();
  updateCompare();
}

function toggleAdvanced(){
  const on = advancedMode.checked;
  advancedPanel.classList.toggle('hidden', !on);
  advancedKpi.classList.toggle('hidden', !on);
  setSliderConstraints();
  updateUI();
}

function setMode(mode){
  state.mode = mode;
  const isTime = (mode === 'time');

  modePD.classList.toggle('on', !isTime);
  modeTime.classList.toggle('on', isTime);
  modePD.setAttribute('aria-pressed', String(!isTime));
  modeTime.setAttribute('aria-pressed', String(isTime));

  primarySliderLabel.textContent = isTime ? 'Time elapsed (half-lives)' : 'Daughter atoms (%)';
  modeHint.textContent = isTime ? 'Slide through time (0 to 7 half-lives).' : 'Set daughter % directly.';
  sliderHint.textContent = isTime ? 'Time slider spans 0–7 half-lives of the selected system.' : 'Slider shows 0.25% increments.';

  // Map slider value without randomizing order
  if (isTime){
    daughterSlider.value = String(clamp(computeAges().nHalves, 0, 7));
  } else {
    daughterSlider.value = String(clamp(getTotalDaughtersExact(), 0, 100));
  }

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
  halfLifeValue.value = String(value);
}

function resetAll(){
  randomizeOrder();
  initialDaughter.value = '0';
  advancedMode.checked = false;
  if (compareOn) compareOn.checked = false;
  if (comparePanel) comparePanel.classList.add('hidden');
  daughterSlider.value = '0';
  toggleAdvanced();
  setMode('pd');
  updateUI();
}

function newRun(){
  randomizeOrder();
  updateUI();
}

function init(){
  presets.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = p.name;
    systemSel.appendChild(opt);
  });

  if (compareSystem){
    presets.forEach((p, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = p.name;
      compareSystem.appendChild(opt);
    });
  }

  systemSel.value = '0';
  if (compareSystem) compareSystem.value = '3';

  applyPreset(presets[0]);
  randomizeOrder();

  systemSel.addEventListener('change', () => {
    const p = presets[parseInt(systemSel.value, 10)] || presets[0];
    applyPreset(p);
    updateUI();
  });

  [halfLifeValue, halfLifeUnit].forEach(el => el.addEventListener('input', updateUI));

  // Key fix: DO NOT randomize order on slider drag
  daughterSlider.addEventListener('input', updateUI);

  // D0 changes also should not randomize
  initialDaughter.addEventListener('input', updateUI);

  advancedMode.addEventListener('change', toggleAdvanced);
  resetBtn.addEventListener('click', resetAll);
  newRunBtn.addEventListener('click', newRun);

  modePD.addEventListener('click', () => setMode('pd'));
  modeTime.addEventListener('click', () => setMode('time'));

  if (compareOn && comparePanel){
    compareOn.addEventListener('change', () => {
      comparePanel.classList.toggle('hidden', !compareOn.checked);
      updateUI();
    });
  }
  if (compareSystem) compareSystem.addEventListener('change', updateUI);

  comparePanel && comparePanel.classList.add('hidden');
  toggleAdvanced();
  setMode('pd');
  updateUI();
}

init();
