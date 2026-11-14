/**
 * One-off events list: rendering and state management.
 */

import { formatMoney, currentFractYear } from './utils.js';
import { attachMoneyFormatting } from './form.js';

/**
 * Render the events list into the given container element.
 * @param {HTMLElement} listEl - The container to render into
 * @param {Array} events - Mutable events array
 * @param {Function} onChanged - Called after events are modified (for re-render)
 */
export function renderEvents(listEl, events, onChanged) {
  listEl.innerHTML = '';

  events.forEach((ev, i) => {
    const row = document.createElement('div');
    row.className = 'event-row';

    // Year + Quarter
    const yqWrap = document.createElement('div');
    yqWrap.className = 'yq-wrap';
    const yrInp = document.createElement('input');
    yrInp.className = 'plain';
    yrInp.type = 'number';
    yrInp.value = Math.floor(ev.fractYear);
    yrInp.placeholder = 'Year';
    yrInp.setAttribute('aria-label', `Event ${i + 1} year`);
    const qSel = document.createElement('select');
    qSel.setAttribute('aria-label', `Event ${i + 1} quarter`);
    [['Q1', '0'], ['Q2', '0.25'], ['Q3', '0.5'], ['Q4', '0.75']].forEach(([label, val]) => {
      const o = document.createElement('option');
      o.value = val;
      o.textContent = label;
      if (Math.abs(parseFloat(val) - (ev.fractYear - Math.floor(ev.fractYear))) < 0.01) o.selected = true;
      qSel.appendChild(o);
    });
    const updateFract = () => {
      const yearText = yrInp.value.trim();
      const year = yearText === '' ? NaN : Number(yearText);
      const quarter = Number(qSel.value);
      ev.fractYear = Number.isFinite(year) && Number.isFinite(quarter) ? year + quarter : NaN;
    };
    yrInp.addEventListener('change', updateFract);
    qSel.addEventListener('change', updateFract);
    yqWrap.appendChild(yrInp);
    yqWrap.appendChild(qSel);

    // Description
    const descInp = document.createElement('input');
    descInp.className = 'plain';
    descInp.type = 'text';
    descInp.value = ev.description;
    descInp.placeholder = 'Description';
    descInp.setAttribute('aria-label', `Event ${i + 1} description`);
    descInp.addEventListener('change', () => { ev.description = descInp.value; });

    // Amount + currency toggle
    const wrap = document.createElement('div');
    wrap.className = 'money-wrap';
    const amtInp = document.createElement('input');
    amtInp.type = 'text';
    amtInp.value = formatMoney(ev.amount);
    amtInp.placeholder = '\u00B1amount';
    amtInp.setAttribute('aria-label', `Event ${i + 1} amount`);
    attachMoneyFormatting(amtInp);
    amtInp.addEventListener('blur', () => {
      const value = amtInp.value.replace(/,/g, '').trim();
      ev.amount = value === '' ? NaN : Number(value);
    });

    const ctog = document.createElement('div');
    ctog.className = 'cur-toggle';
    ctog.setAttribute('role', 'group');
    ctog.setAttribute('aria-label', `Currency for event ${i + 1} amount`);
    const updatePressed = () => {
      ctog.querySelectorAll('button').forEach(button => {
        const selected = button.dataset.cur === ev.currency;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
    };
    ['GBP', 'EUR'].forEach(cur => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = cur === 'GBP' ? '\u00A3' : '\u20AC';
      b.dataset.cur = cur;
      b.setAttribute('aria-label', `Use ${cur} for event ${i + 1} amount`);
      b.addEventListener('click', () => {
        ev.currency = cur;
        updatePressed();
      });
      ctog.appendChild(b);
    });
    updatePressed();
    wrap.appendChild(amtInp);
    wrap.appendChild(ctog);

    // Delete button
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn-sm btn-del';
    del.textContent = '\u2715';
    del.setAttribute('aria-label', `Delete event ${i + 1}${ev.description ? `: ${ev.description}` : ''}`);
    del.addEventListener('click', () => {
      events.splice(i, 1);
      onChanged();
    });

    row.appendChild(yqWrap);
    row.appendChild(descInp);
    row.appendChild(wrap);
    row.appendChild(del);
    listEl.appendChild(row);
  });
}

/** Add a new blank event and trigger re-render. */
export function addEvent(events, onChanged) {
  events.push({ fractYear: currentFractYear(), amount: 0, description: '', currency: 'GBP' });
  onChanged();
}
