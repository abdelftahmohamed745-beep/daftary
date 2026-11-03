'use strict';

import {
  api,
  todayISO,
  addDaysISO,
  startOfWeekISO,
  dateShort,
  monthLabel,
  timeLabel,
  escapeHTML,
  DAYS,
} from '../api.js';
import { icon } from '../ui.js';
import { lessonModal, loadGroups } from '../forms.js';

const STATUS_OPTIONS = [
  { value: 'all', label: 'كل الحصص' },
  { value: 'scheduled', label: 'قادمة' },
  { value: 'done', label: 'خلصت' },
  { value: 'cancelled', label: 'ملغية' },
];

function lessonCard(lesson) {
  const statusClass =
    lesson.status === 'cancelled' ? 'cancelled' : lesson.status === 'done' ? 'done' : '';
  return `<div class="cal-lesson ${statusClass}" data-lesson="${lesson.id}"
      style="--lc:${escapeHTML(lesson.groupColor || 'var(--teal)')}" role="button" tabindex="0"
      title="${escapeHTML(lesson.groupName)} — ${escapeHTML(timeLabel(lesson.start))}">
    <div class="t">${escapeHTML(timeLabel(lesson.start))}${lesson.status === 'cancelled' ? ' · ملغية' : ''}</div>
    <div class="n truncate">${escapeHTML(lesson.groupName || 'حصة')}</div>
    <div class="m truncate">${escapeHTML(lesson.topic || '')}${lesson.studentCount ? ` · ${lesson.marked || 0}/${lesson.studentCount}` : ''}</div>
  </div>`;
}

function gridHTML(items, start) {
  const today = todayISO();
  const columns = Array.from({ length: 7 }, (_, index) => {
    const date = addDaysISO(start, index);
    const day = new Date(`${date}T00:00:00`);
    const dayLessons = items
      .filter((lesson) => lesson.date === date)
      .sort((a, b) => a.start.localeCompare(b.start));
    return `<div class="day-col ${date === today ? 'today' : ''}">
      <div class="day-head">
        <div class="dname">${escapeHTML(DAYS[day.getDay()])}</div>
        <div class="dnum">${day.getDate()}</div>
      </div>
      <div class="day-body">
        ${dayLessons.map(lessonCard).join('') || '<div class="day-empty">مفيش حصص</div>'}
        <button class="cal-add" data-add-day="${date}">${icon('plus')} حصة</button>
      </div>
    </div>`;
  }).join('');
  return `<div class="week-grid">${columns}</div>`;
}

export async function render(ctx) {
  const settings = ctx.settings || {};
  const weekStart = Number.isInteger(settings.weekStart) ? settings.weekStart : 6;
  const today = todayISO();
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(ctx.query?.get('week') || '')
    ? ctx.query.get('week')
    : today;
  const start = startOfWeekISO(anchor, weekStart);
  const end = addDaysISO(start, 6);
  const [data, groups] = await Promise.all([
    api.get(`/api/calendar?from=${start}&to=${end}`),
    loadGroups(),
  ]);
  const items = data.items || [];
  const activeGroups = groups.filter((group) => group.status === 'active');
  const done = items.filter((l) => l.status === 'done').length;
  const cancelled = items.filter((l) => l.status === 'cancelled').length;
  const unmarked = items.filter((l) => l.status !== 'cancelled' && !l.marked).length;
  const prev = addDaysISO(start, -7);
  const next = addDaysISO(start, 7);
  const rangeLabel = start === end ? dateShort(start) : `${dateShort(start)} — ${dateShort(end)}`;
  ctx.setTitle('جدول الحصص', rangeLabel);

  return `<div class="page">
    <div class="page-head">
      <div><h1>جدول الحصص</h1>
        <div class="sub">${items.length} حصة في الأسبوع · ${done} خلصت · ${unmarked} لسه محتاجة تحضير</div></div>
      <div class="page-actions">
        <a class="btn secondary" href="#/groups">${icon('grid')}المجموعات</a>
        <button class="btn" data-add-lesson>${icon('plus')}حصة جديدة</button>
      </div>
    </div>

    <div class="card">
      <div class="cal-toolbar">
        <div class="row" style="gap:4px">
          <a class="icon-btn" href="#/calendar?week=${prev}" aria-label="الأسبوع السابق">${icon('chevronRight')}</a>
          <a class="icon-btn" href="#/calendar?week=${next}" aria-label="الأسبوع الجاي">${icon('chevronLeft')}</a>
          <a class="btn secondary sm" href="#/calendar">النهارده</a>
        </div>
        <div class="cal-title">${escapeHTML(rangeLabel)}</div>
        <span class="badge gray">${escapeHTML(monthLabel(start.slice(0, 7)))}</span>
        <span class="grow"></span>
        <select class="select" data-filter-group style="width:auto;min-width:150px">
          <option value="">كل المجموعات</option>
          ${activeGroups.map((group) => `<option value="${group.id}">${escapeHTML(group.name)}</option>`).join('')}
        </select>
        <select class="select" data-filter-status style="width:auto">
          ${STATUS_OPTIONS.map((option) => `<option value="${option.value}">${option.label}</option>`).join('')}
        </select>
        <span class="small muted" data-count>${items.length} حصة</span>
      </div>

      <div class="cal-scroll" data-cal-grid>${gridHTML(items, start)}</div>

      <div class="row-between mt-3" style="flex-wrap:wrap;gap:8px">
        <div class="legend">
          <span><i style="background:var(--teal)"></i>قادمة</span>
          <span><i style="background:var(--muted)"></i>خلصت</span>
          <span><i style="background:var(--coral)"></i>ملغية</span>
          <span><i style="background:var(--line-strong)"></i>محتاجة تحضير</span>
        </div>
        <div class="tiny muted">${cancelled ? `${cancelled} حصة ملغية هذا الأسبوع` : 'كل الحصص شغالة'}</div>
      </div>
    </div>
  </div>`;
}

export async function mount(root, ctx) {
  const settings = ctx.settings || {};
  const weekStart = Number.isInteger(settings.weekStart) ? settings.weekStart : 6;
  const today = todayISO();
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(ctx.query?.get('week') || '')
    ? ctx.query.get('week')
    : today;
  const start = startOfWeekISO(anchor, weekStart);
  const end = addDaysISO(start, 6);
  const data = await api.get(`/api/calendar?from=${start}&to=${end}`);
  const all = data.items || [];
  const gridEl = root.querySelector('[data-cal-grid]');
  const countEl = root.querySelector('[data-count]');
  const groupSelect = root.querySelector('[data-filter-group]');
  const statusSelect = root.querySelector('[data-filter-status]');
  const state = { groupId: '', status: 'all' };

  const paint = () => {
    const items = all.filter(
      (lesson) =>
        (!state.groupId || lesson.groupId === state.groupId) &&
        (state.status === 'all' || lesson.status === state.status),
    );
    gridEl.innerHTML = gridHTML(items, start);
    if (countEl) countEl.textContent = `${items.length} حصة`;
  };

  groupSelect?.addEventListener('change', () => {
    state.groupId = groupSelect.value;
    paint();
  });
  statusSelect?.addEventListener('change', () => {
    state.status = statusSelect.value;
    paint();
  });

  root.addEventListener('click', (event) => {
    const lessonEl = event.target.closest('[data-lesson]');
    if (lessonEl) {
      location.hash = `#/lessons/${lessonEl.dataset.lesson}`;
      return;
    }
    const addEl = event.target.closest('[data-add-day]');
    if (addEl) {
      lessonModal({ date: addEl.dataset.addDay, onSaved: () => ctx.refresh() });
    }
  });

  root.querySelector('[data-add-lesson]')?.addEventListener('click', () => {
    const defaultDate = today >= start && today <= end ? today : start;
    lessonModal({ date: defaultDate, onSaved: () => ctx.refresh() });
  });

  if (ctx.query?.get('new') === '1') {
    const defaultDate = today >= start && today <= end ? today : start;
    lessonModal({ date: defaultDate, onSaved: () => ctx.refresh() });
  }
}
