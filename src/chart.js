/**
 * Stacked area chart rendering (savings / pension / housing equity).
 * Draws on a <canvas> element using the 2D context API.
 */

/**
 * Draw the net-worth stacked area chart.
 * @param {HTMLCanvasElement} canvas - Target canvas element
 * @param {Array} results - Quarterly simulation results
 */
export function drawChart(canvas, results) {
  canvas.style.display = 'block';

  // Sharp on HiDPI displays
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || canvas.offsetWidth || 800;
  const cssH = canvas.clientHeight || canvas.offsetHeight || 280;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const W = cssW;
  const H = cssH;
  const PAD = { top: 28, right: 20, bottom: 36, left: 76 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Build three component series
  const n = results.length;
  const sSavings = results.map(r => r.savingsEnd);
  const sPension = results.map(r => r.pensionEnd);
  // True housing equity — not floored at zero, so negative equity is visible.
  const sHousing = results.map(r => (r.houseVal || 0) - (r.mortgageLeft || 0));

  // Stacked boundaries
  const sBot = sSavings;
  const sMid = results.map((_, i) => sSavings[i] + sPension[i]);
  const sTop = results.map((_, i) => sSavings[i] + sPension[i] + sHousing[i]);

  const allVals = [...sBot, ...sMid, ...sTop];
  const minVal = Math.min(0, ...allVals);
  const maxVal = Math.max(1, ...allVals);
  const range = maxVal - minVal;

  const xOf = i => PAD.left + (i / (n - 1)) * plotW;
  const yOf = v => PAD.top + plotH - ((v - minVal) / range) * plotH;

  // Background
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  // Filled bands
  function fillBand(lower, upper, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(lower[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(xOf(i), yOf(lower[i]));
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(xOf(i), yOf(upper[i]));
    ctx.closePath();
    ctx.fill();
  }

  const sFloor = results.map(() => minVal);
  fillBand(sFloor, sBot, 'rgba(26,110,181,0.50)');  // savings — blue
  fillBand(sBot, sMid, 'rgba(42,180,140,0.55)');    // pension — teal
  fillBand(sMid, sTop, 'rgba(230,160,40,0.55)');    // housing — amber

  // Boundary lines
  function drawLine(series, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    series.forEach((v, i) => (i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v))));
    ctx.stroke();
  }
  drawLine(sBot, 'rgba(26,110,181,0.9)');
  drawLine(sMid, 'rgba(42,180,140,0.9)');
  drawLine(sTop, 'rgba(200,140,30,0.9)');

  // Zero line (if savings go negative)
  if (minVal < 0) {
    const y0 = yOf(0);
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(PAD.left, y0);
    ctx.lineTo(PAD.left + plotW, y0);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Grid & Y-axis labels
  ctx.font = '10px Segoe UI, Arial, sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 5; i++) {
    const v = minVal + (range / 5) * i;
    const y = yOf(v);
    ctx.strokeStyle = '#efefef';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + plotW, y);
    ctx.stroke();
    const lbl = Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'm' : (v / 1e3).toFixed(0) + 'k';
    ctx.fillStyle = '#888';
    ctx.fillText('\u00A3' + lbl, PAD.left - 6, y + 3);
  }

  // X-axis year labels
  ctx.textAlign = 'center';
  ctx.fillStyle = '#888';
  results.forEach((r, i) => {
    if (r.quarter === 0 && r.year % 5 === 0) {
      ctx.fillText(r.year, xOf(i), H - PAD.bottom + 14);
    }
  });

  // Legend
  const items = [
    { label: 'Savings', fill: 'rgba(26,110,181,0.50)' },
    { label: 'Pension', fill: 'rgba(42,180,140,0.55)' },
    { label: 'Housing', fill: 'rgba(230,160,40,0.55)' },
  ];
  ctx.font = '10px Segoe UI, Arial, sans-serif';
  ctx.textAlign = 'left';
  let legX = PAD.left + 10;
  items.forEach(item => {
    ctx.fillStyle = item.fill;
    ctx.fillRect(legX, PAD.top + 8, 12, 10);
    ctx.strokeStyle = '#0005';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(legX, PAD.top + 8, 12, 10);
    ctx.fillStyle = '#444';
    ctx.fillText(item.label, legX + 16, PAD.top + 17);
    legX += ctx.measureText(item.label).width + 38;
  });
}
