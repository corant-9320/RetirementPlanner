/**
 * Drawdown lines list: rendering and state management.
 *
 * Each line holds raw UI strings ({year, quarter, rate}). A line's rate applies
 * from its start quarter until the next line (by date) starts. Before the
 * earliest line there is no drawdown; a 0% line pauses it.
 */

const QUARTERS = [['Q1', '0'], ['Q2', '0.25'], ['Q3', '0.5'], ['Q4', '0.75']];

/** The single line a new form starts with (the former drawdown field defaults). */
export function defaultDrawdownLines() {
  return [{ year: '2045', quarter: '0', rate: '5.0' }];
}

/** Element ids for a line's controls, used to point validation errors at them. */
export function drawdownControlId(index, part) {
  return `drawdown-${part}-${index}`;
}

/**
 * Render the drawdown lines into the given container element.
 * @param {HTMLElement} listEl - The container to render into
 * @param {Array} lines - Mutable array of {year, quarter, rate} strings
 * @param {object} handlers
 * @param {Function} handlers.onChanged - Called after a line is added or removed
 * @param {Function} handlers.onOptimise - Called with a line index for "Find lowest"
 */
export function renderDrawdowns(listEl, lines, { onChanged, onOptimise }) {
  listEl.replaceChildren();

  lines.forEach((line, i) => {
    const n = i + 1;
    const row = document.createElement('div');
    row.className = 'drawdown-row';

    // Start year + quarter
    const yqWrap = document.createElement('div');
    yqWrap.className = 'yq-wrap';
    const yrInp = document.createElement('input');
    yrInp.className = 'plain';
    yrInp.type = 'number';
    yrInp.id = drawdownControlId(i, 'year');
    yrInp.value = line.year;
    yrInp.placeholder = 'Year';
    yrInp.setAttribute('aria-label', `Drawdown line ${n} start year`);
    yrInp.addEventListener('change', () => { line.year = yrInp.value; });

    const qSel = document.createElement('select');
    qSel.id = drawdownControlId(i, 'quarter');
    qSel.setAttribute('aria-label', `Drawdown line ${n} start quarter`);
    QUARTERS.forEach(([label, val]) => {
      const o = document.createElement('option');
      o.value = val;
      o.textContent = label;
      if (val === line.quarter) o.selected = true;
      qSel.appendChild(o);
    });
    qSel.addEventListener('change', () => { line.quarter = qSel.value; });
    yqWrap.append(yrInp, qSel);

    // Annual rate + optimiser
    const rateWrap = document.createElement('div');
    rateWrap.className = 'input-action';
    const rateInp = document.createElement('input');
    rateInp.className = 'plain';
    rateInp.type = 'number';
    rateInp.step = '0.1';
    rateInp.id = drawdownControlId(i, 'rate');
    rateInp.value = line.rate;
    rateInp.placeholder = '%';
    rateInp.setAttribute('aria-label', `Drawdown line ${n} annual rate %`);
    rateInp.addEventListener('change', () => { line.rate = rateInp.value; });

    const opt = document.createElement('button');
    opt.type = 'button';
    opt.className = 'btn-sm';
    opt.textContent = 'Find lowest';
    opt.title = 'Set the lowest % for this line that keeps savings from going negative';
    opt.setAttribute('aria-label', `Find lowest rate for drawdown line ${n}`);
    opt.addEventListener('click', () => onOptimise(i));
    rateWrap.append(rateInp, opt);

    // Delete
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn-sm btn-del';
    del.textContent = '\u2715';
    del.setAttribute('aria-label', `Delete drawdown line ${n}`);
    del.addEventListener('click', () => {
      lines.splice(i, 1);
      onChanged();
    });

    row.append(yqWrap, rateWrap, del);
    listEl.appendChild(row);
  });
}

/**
 * Append a line starting a year after the latest existing start (same quarter
 * and rate), or the default line when the list is empty.
 */
export function addDrawdown(lines, onChanged) {
  const dated = lines
    .filter(line => String(line.year).trim() !== '')
    .map(line => ({ line, fy: Number(line.year) + Number(line.quarter) }))
    .filter(entry => Number.isFinite(entry.fy));
  if (dated.length === 0) {
    lines.push(defaultDrawdownLines()[0]);
  } else {
    const latest = dated.reduce((a, b) => (b.fy > a.fy ? b : a)).line;
    lines.push({ year: String(Number(latest.year) + 1), quarter: latest.quarter, rate: latest.rate });
  }
  onChanged();
}
