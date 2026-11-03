'use strict';

import { api, dateFull, relativeTime, escapeHTML } from '../api.js';
import { icon, emptyHTML, avatarHTML } from '../ui.js';

const ACTION_ICONS = {
  payment: 'wallet',
  charge: 'receipt',
  attendance: 'checkCircle',
  student: 'user',
  group: 'grid',
  lesson: 'calendar',
  assignment: 'clipboard',
  material: 'folder',
  exam: 'target',
  points: 'award',
  certificate: 'award',
  treasury: 'wallet',
  user: 'shield',
  settings: 'settings',
  sync: 'refresh',
  platform: 'shield',
  codes: 'shield',
  shift: 'clock',
  profile: 'user',
  auth: 'shield',
};

const ACTION_TONES = {
  delete: 'red',
  create: 'green',
  update: 'blue',
  grade: 'amber',
};

function iconFor(action) {
  const prefix = String(action).split('.')[0];
  return ACTION_ICONS[prefix] || 'activity';
}
function toneFor(action) {
  const suffix = String(action).split('.')[1] || '';
  return ACTION_TONES[suffix] || 'info';
}

function grouped(items) {
  const groups = new Map();
  for (const item of items) {
    const day = String(item.at || '').slice(0, 10);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(item);
  }
  return [...groups.entries()];
}

export async function render(ctx) {
  const limit = Number(ctx.query.get('limit')) || 80;
  const data = await api.get(`/api/activity?limit=${limit}`);
  const days = grouped(data.items);

  return `<div class="page">
    <div class="page-head">
      <div><h1>سجل النشاط</h1><div class="sub">${data.total} حركة مسجلة — كل اللي بيحصل في المركز</div></div>
      <div class="page-actions">
        <select class="select" data-limit>
          <option value="40" ${limit === 40 ? 'selected' : ''}>آخر ٤٠ حركة</option>
          <option value="80" ${limit === 80 ? 'selected' : ''}>آخر ٨٠ حركة</option>
          <option value="200" ${limit === 200 ? 'selected' : ''}>آخر ٢٠٠ حركة</option>
        </select>
      </div>
    </div>

    ${days.length
      ? `<div class="stack">${days.map(([day, items]) => `<section class="card">
          <div class="card-head"><div><h2>${escapeHTML(dateFull(day))}</h2><div class="sub">${items.length} حركة</div></div></div>
          <div class="activity-feed">${items.map((item) => `<div class="activity-row">
            <span class="alert-icon ${toneFor(item.action)}">${icon(iconFor(item.action))}</span>
            <div class="grow">
              <div class="row" style="gap:6px;flex-wrap:wrap"><span class="strong small">${escapeHTML(item.actorName || 'النظام')}</span>
                <span class="badge gray tiny">${escapeHTML(item.action)}</span>
                <span class="tiny muted nowrap" style="margin-inline-start:auto">${escapeHTML(relativeTime(item.at))}</span></div>
              <div class="small muted" style="margin-top:2px">${escapeHTML(item.detail || '')}</div>
            </div>
          </div>`).join('')}</div>
        </section>`).join('')}</div>`
      : `<div class="card">${emptyHTML('activity', 'السجل فاضي', 'أول ما تبدأ تشتغل، كل حركة هتتسجل هنا.')}</div>`}
  </div>`;
}

export async function mount(root, ctx) {
  root.querySelector('[data-limit]')?.addEventListener('change', (event) => {
    location.hash = `#/activity?limit=${event.target.value}`;
  });
}
