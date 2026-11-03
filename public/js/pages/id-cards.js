'use strict';

import { api, escapeHTML, dateFull, downloadURL } from '../api.js';
import { icon, avatarHTML, toast, emptyHTML, printHTML } from '../ui.js';
import { barcodeHTML } from '../barcode.js';
import { loadGroups } from '../forms.js';

function cardHTML(card, settings) {
  return `<article class="id-card" data-id="${card.id}">
    <div class="id-card-head">
      <div class="id-brand">
        <span class="brand-mark sm">د</span>
        <div><div class="id-center">${escapeHTML(settings.centerName || card.centerName || 'مركز دفتري')}</div>
        <div class="id-year">${escapeHTML(card.academicYear || settings.academicYear || '')}</div></div>
      </div>
      <span class="id-chip">${icon('credit')}</span>
    </div>
    <div class="id-card-body">
      <div class="id-photo" style="--c:${escapeHTML(card.avatarColor || 'var(--teal)')}">${escapeHTML((card.shortName || card.name || '?').slice(0, 1))}</div>
      <div class="id-info">
        <div class="id-name">${escapeHTML(card.name)}</div>
        <div class="id-meta">${escapeHTML(card.grade || '')}</div>
        <div class="id-meta truncate">${escapeHTML(card.groupNames || '')}</div>
        <div class="id-code mono" dir="ltr">${escapeHTML(card.code)}</div>
      </div>
    </div>
    <div class="id-card-foot">
      ${barcodeHTML(card.code, { height: 34, narrow: 1.2 })}
    </div>
    <div class="id-card-bottom">
      <span>${escapeHTML(card.centerName || settings.centerName || '')}</span>
      <span dir="ltr">${escapeHTML(card.phone2 || settings.phone || '')}</span>
    </div>
  </article>`;
}

export async function render(ctx) {
  const groupId = ctx.query.get('groupId') || '';
  const [data, groups] = await Promise.all([
    api.get(`/api/id-cards${groupId ? `?groupId=${groupId}` : ''}`),
    loadGroups(),
  ]);

  return `<div class="page">
    <div class="page-head">
      <div><h1>كروت الطلبة</h1><div class="sub">${data.items.length} كارت · باركود جاهز للطباعة والمسح</div></div>
      <div class="page-actions">
        <select class="select" data-group>
          <option value="">كل الطلبة</option>
          ${groups.map((g) => `<option value="${g.id}" ${groupId === g.id ? 'selected' : ''}>${escapeHTML(g.name)}</option>`).join('')}
        </select>
        <button class="btn secondary" data-print-all>${icon('print')}طباعة الكل</button>
      </div>
    </div>

    <div class="card mb-3">
      <div class="toolbar">
        <div class="search">${icon('search')}
          <input class="input" type="search" placeholder="فلتر بالاسم أو الكود…" data-search>
        </div>
        <span class="grow"></span>
        <span class="chip"><span class="dot" style="--c:var(--teal)"></span>${data.items.length} كارت جاهز</span>
      </div>
    </div>

    <div data-grid>
      ${data.items.length
        ? `<div class="id-grid">${data.items.map((card) => cardHTML(card, data.settings)).join('')}</div>`
        : `<div class="card">${emptyHTML('credit', 'مفيش طلبة', 'ضيف طلبة أو غيّر فلتر المجموعة.')}</div>`}
    </div>
  </div>`;
}

export async function mount(root) {
  const grid = root.querySelector('[data-grid]');
  const search = root.querySelector('[data-search]');

  const bind = () => {
    grid.querySelectorAll('.id-card').forEach((card) => {
      card.addEventListener('click', () => {
        printHTML(`<div class="print-id-page">${card.outerHTML}</div>`);
      });
    });
  };

  search?.addEventListener('input', () => {
    const needle = search.value.trim().toLowerCase();
    grid.querySelectorAll('.id-card').forEach((card) => {
      card.style.display = !needle || card.textContent.toLowerCase().includes(needle) ? '' : 'none';
    });
  });

  root.querySelector('[data-group]')?.addEventListener('change', (event) => {
    const value = event.target.value;
    location.hash = value ? `#/id-cards?groupId=${value}` : '#/id-cards';
  });

  root.querySelector('[data-print-all]')?.addEventListener('click', () => {
    const cards = [...grid.querySelectorAll('.id-card')].filter((card) => card.style.display !== 'none');
    if (!cards.length) {
      toast('مفيش كروت للطباعة', 'error');
      return;
    }
    printHTML(`<div class="print-id-page">${cards.map((card) => card.outerHTML).join('')}</div>`);
  });

  bind();
}
