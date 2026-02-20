// Absolute Age Dating Explorer
// Single-file JS app: no build tools; suitable for GitHub Pages.

const systems = [
  { name: 'Custom (enter your own)', halfLifeYears: null },
  // Common examples used in intro geology. Values are typical and rounded.
  { name: 'Carbon-14 → Nitrogen-14 (t½ ≈ 5,730 years)', halfLifeYears: 5730 },
  { name: 'Potassium-40 → Argon-40 (t½ ≈ 1.248 billion years)', halfLifeYears: 1.248e9 },
  { name: 'Uranium-238 → Lead-206 (t½ ≈ 4.468 billion years)', halfLifeYears: 4.468e9 },
  { name: 'Uranium-235 → Lead-207 (t½ ≈ 703.8 million years)', halfLifeYears: 703.8e6 },
  { name: 'Rubidium-87 → Strontium-87 (t½ ≈ 48.8 billion years)', halfLifeYears: 48.8e9 },
  { name: 'Thorium-232 → Lead-208 (t½ ≈ 14.05 billion years)', halfLifeYears: 14.05e9 },
];

const unitToYears = {
  yr: 1,
  kyr: 1e3,
  Myr: 1e6,
  Gyr: 1e9,
};

// DOM
const systemSelect = document.getElementById('system');
const halfLifeValue = document.getElementById('halfLifeValue');
const halfLifeUnit = document.getElementById('halfLifeUnit');
const daughterSlider = document.getElementById('daughterSlider');
const daughterOut = document.getElementById('daughterOut');
const parentPct = document.getElementById('parentPct');
const nHalves = document.getElementById('nHalves');
const ageOut = document.getElementById('ageOut');
const resetBtn = document.getElementById('resetBtn');

const canvas = document.getElementById('atomsCanvas');
const ctx = canvas.getContext('2d');

const parentBar = document.getElementById('parentBar');
const daughterBar = document.getElementById('daughterBar');
const parentBarLabel = document.getElementById('parentBarLabel');
const daughterBarLabel = document.getElementById('daughterBarLabel');

function initSystems(){
  systems.forEach((s, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = s.name;
    systemSelect.appendChild(opt);
  });
  systemSelect.value = '1'; // default: Carbon-14
  applySystem();
}

function bestUnitForYears(years){
  const abs = Math.abs(years);
  if (!isFinite(abs) || abs === 0) return { unit: 'yr', factor: 1 };
  if (abs >= 1e9) return { unit: 'Gyr', factor: 1e9 };
  if (abs >= 1e6) return { unit: 'Myr', factor: 1e6 };
  if (abs >= 1e3) return { unit: 'kyr', factor: 1e3 };
  return { unit: 'yr', factor: 1 };
}

function formatNumber(x){
  // Friendly formatting for students.
  if (!isFinite(x)) return '∞';
  const abs = Math.abs(x);
  if (abs >= 1e6) return x.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (abs >= 1e3) return x.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return x.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function getHalfLifeYears(){
  const val = parseFloat(halfLifeValue.value);
  const unit = halfLifeUnit.value;
  if (!isFinite(val) || val <= 0) return NaN;
  return val * unitToYears[unit];
}

function applySystem(){
  const s = systems[parseInt(systemSelect.value, 10)];
  if (s.halfLifeYears == null){
    // Custom: keep user values.
    return update();
  }

  // Choose a unit that makes the number student-friendly.
  const { unit, factor } = bestUnitForYears(s.halfLifeYears);
  halfLifeUnit.value = unit;
  halfLifeValue.value = (s.halfLifeYears / factor).toString();
  update();
}

function computeAge(daughterPercent, halfLifeYears){
  const parentFraction = 1 - daughterPercent/100;

  if (parentFraction <= 0){
    return { parentFraction: 0, nHalfLives: Infinity, ageYears: Infinity };
  }
  if (parentFraction >= 1){
    return { parentFraction: 1, nHalfLives: 0, ageYears: 0 };
  }

  // n = log2(N0/N) with N0 = 1
  const nHalfLives = Math.log(1/parentFraction) / Math.log(2);
  const ageYears = halfLifeYears * nHalfLives;
  return { parentFraction, nHalfLives, ageYears };
}

function drawAtoms(daughterPercent){
  const total = 100;
  const dCount = Math.round(daughterPercent);
  const pCount = total - dCount;

  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Title
  ctx.save();
  ctx.fillStyle = 'rgba(238,242,255,0.92)';
  ctx.font = '700 18px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
  ctx.fillText('100-atom grid (1 dot = 1%)', 18, 30);
  ctx.restore();

  const cols = 10;
  const rows = 10;
  const pad = 22;
  const top = 52;
  const w = canvas.width - pad*2;
  const h = canvas.height - top - pad;

  const cell = Math.min(w/cols, h/rows);
  const r = cell * 0.32;

  // Colors
  const parentColor = '#1f77b4';
  const daughterColor = '#ff7f0e';

  // Draw dots
  let idx = 0;
  for (let y=0; y<rows; y++){
    for (let x=0; x<cols; x++){
      idx++;
      const cx = pad + x*cell + cell/2;
      const cy = top + y*cell + cell/2;
      const isParent = idx <= pCount;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI*2);
      ctx.closePath();
      ctx.fillStyle = isParent ? parentColor : daughterColor;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.20)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Caption
  ctx.save();
  ctx.fillStyle = 'rgba(174,183,214,0.95)';
  ctx.font = '500 14px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
  ctx.fillText(`Parent: ${pCount}%   Daughter: ${dCount}%`, 18, canvas.height - 18);
  ctx.restore();
}

function updateBars(daughterPercent){
  const p = 100 - daughterPercent;
  const d = daughterPercent;

  parentBar.style.width = `${p}%`;
  daughterBar.style.width = `${d}%`;

  // Only show labels if there's room
  parentBarLabel.textContent = p >= 10 ? `Parent ${p}%` : '';
  daughterBarLabel.textContent = d >= 10 ? `Daughter ${d}%` : '';
}

function update(){
  const d = parseInt(daughterSlider.value, 10);
  daughterOut.textContent = `${d}%`;
  parentPct.textContent = `${100 - d}%`;

  const tHalfYears = getHalfLifeYears();
  const res = computeAge(d, tHalfYears);

  // Display half-lives
  nHalves.textContent = isFinite(res.nHalfLives)
    ? res.nHalfLives.toFixed(2)
    : '≥ 10+'; // educational shorthand

  // Age formatting
  if (!isFinite(tHalfYears)){
    ageOut.textContent = 'Enter a valid half-life';
  } else if (!isFinite(res.ageYears)){
    ageOut.textContent = 'Too old (parent = 0%)';
  } else {
    const { unit, factor } = bestUnitForYears(res.ageYears);
    ageOut.textContent = `${formatNumber(res.ageYears / factor)} ${unit}`;
  }

  drawAtoms(d);
  updateBars(d);
}

function reset(){
  daughterSlider.value = '0';
  systemSelect.value = '1';
  applySystem();
  update();
}

// Events
systemSelect.addEventListener('change', applySystem);
halfLifeValue.addEventListener('input', update);
halfLifeUnit.addEventListener('change', update);
daughterSlider.addEventListener('input', update);
resetBtn.addEventListener('click', reset);

// Start
initSystems();
update();
