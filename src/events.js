/**
 * One-off events list: rendering and state management.
 */

import { parseMoney, formatMoney, currentFractYear } from './utils.js';
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
    const qSel = document.createElement('select');
    [['Q1', '0'], ['Q2', '0.25'], ['Q3', '0.5'], ['Q4', '0.75']].forEach(([label, val]) => {
      const o = document.createElement('option');
      o.value = val;
      o.textContent = label;
      if (Math.abs(parseFloat(val) - (ev.fractYear - Math.floor(ev.fractYear))) < 0.01) o.selected = true;
      qSel.appendChild(o);
    });
    const updateFract = () => {
      ev.fractYear = (parseInt(yrInp.value) || 0) + parseFloat(qSel.value);
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
    descInp.addEventListener('change', () => { ev.description = descInp.value; });

    // Amount + currency toggle
    const wrap = document.createElement('div');
    wrap.className = 'money-wrap';
    const amtInp = document.createElement('input');
    amtInp.type = 'text';
    amtInp.value = formatMoney(ev.amount);
    amtInp.placeholder = '\u00B1amount';
    attachMoneyFormatting(amtInp);
    amtInp.addEventListener('blur', () => { ev.amount = parseMoney(amtInp.value); });

    const ctog = document.createElement('div');
    ctog.className = 'cur-toggle';
    ['GBP', 'EUR'].forEach(cur => {
      const b = document.createElement('button');
      b.textContent = cur === 'GBP' ? '\u00A3' : '\u20AC';
      b.dataset.cur = cur;
      if (cur === ev.currency) b.classList.add('active');
      b.addEventListener('click', () => {
        ctog.querySelectorAll('button').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        ev.currency = cur;
      });
      ctog.appendChild(b);
    });
    wrap.appendChild(amtInp);
    wrap.appendChild(ctog);

    // Delete button
    const del = document.createElement('button');
    del.className = 'btn-sm btn-del';
    del.textContent = '\u2715';
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
