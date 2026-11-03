'use strict';

import {
  api,
  money,
  dateShort,
  relativeDay,
  timeLabel,
  escapeHTML,
  statusBadge,
  debounce,
  DAYS,
} from '../api.js';
import { icon, ringHTML, toast, emptyHTML } from '../ui.js';
import { groupModal } from '../forms.js';

let allGroups = [];

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

function groupCard(group) {
  const count = group.studentCount || 0;
  const cap = Number(group.capacity) || 0;
  const pct = cap ? Math.min(100, Math.round((count / cap) * 100)) : 0;
  const full = cap && count >= cap;
  return `<div class="card" data-group="${group.id}" style="display:flex;flex-direction:column;gap:10px">
    <div class="row-between" style="align-items:flex-start">
      <div class="row" style="align-items:flex-start;min-width:0">
        <span class="group-dot" style="background:${escapeHTML(group.color)};margin-top:5px"></span>
        <div style="min-width:0">
          <a href="#/groups/${group.id}" style="color:inherit"><div class="strong truncate" style="font-size:14px">${escapeHTML(group.name)}</div></a>
          <div class="tiny muted">${escapeHTML(group.subject)}${group.level ? ` · ${escapeHTML(group.level)}` : ''}${group.room ? ` · ${escapeHTML(group.room)}` : ''}</div>
        </div>
      </div>
      <div class="row" style="gap:4px">
        ${group.status !== 'active' ? '<span class="badge gray">مؤرشفة</span>' : group.type === 'individual' ? '<span class="badge plum">فردي</span>' : ''}
        <button class="icon-btn" data-edit="${group.id}" title="تعديل">${icon('edit')}</button>
      </div>
    </div>

    <div class="chips">
      ${(group.schedule || []).map((slot) => `<span class="chip">${icon('clock')}${escapeHTML(DAYS[Number(slot.day)] || '')} ${escapeHTML(timeLabel(slot.start))}</span>`).join('') || '<span class="chip muted">مفيش مواعيد</span>'}
    </div>

    <div>
      <div class="row-between tiny muted" style="margin-bottom:4px">
        <span>${count} من ${cap || '∞'} طالب ${full ? '— مليانة' : ''}</span>
        <span>${group.price ? `${money(group.price)} / شهر` : 'من غير سعر'}</span>
      </div>
      <div class="progress"><span style="width:${pct}%;--bar:${escapeHTML(group.color)}"></span></div>
    </div>

    <div class="row-between" style="border-top:1px solid var(--line);padding-top:10px;margin-top:auto">
      <div>
        <div class="tiny muted">${group.nextLesson ? `الحصة الجاية ${escapeHTML(relativeDay(group.nextLesson.date))} · ${escapeHTML(timeLabel(group.nextLesson.start))}` : 'مفيش حصة مجدولة'}</div>
        <div class="tiny ${group.finances.balance > 0 ? 'money debt' : 'money ok'}" style="margin-top:2px">
          ${group.finances.balance > 0 ? `متأخرات ${money(group.finances.balance)}` : 'حسابات المجموعة مظبوطة'}
        </div>
      </div>
      <div class="row" style="gap:7px">
        ${ringHTML(group.attendanceRate, 'sm')}
        <a class="btn xs" href="#/groups/${group.id}">فتح</a>
      </div>
    </div>
  </div>`;
}

function renderCards(list) {
  if (!list.length) return emptyHTML('grid', 'مفيش مجموعات بالفلتر ده', 'جرّب تغيّر البحث أو تضيف مجموعة جديدة.');
  return `<div class="student-grid">${list.map(groupCard).join('')}</div>`;
}

function summaryCard(label, value, sub, iconName, color, soft) {
  return `<div class="kpi" style="--kpi:${color};--kpi-soft:${soft}">
    <div class="kpi-top"><span>${escapeHTML(label)}</span><span class="kpi-icon">${icon(iconName)}</span></div>
    <div class="kpi-value">${value}</div>
    <div class="kpi-foot">${escapeHTML(sub)}</div>
  </div>`;
}

export async function render(ctx) {
  const data = await api.get('/api/groups?status=all');
  allGroups = data.items || [];
  const subjects = data.subjects || [];
  const summary = data.summary || { groups: 0, students: 0, seats: 0 };
  const occupancy = summary.seats ? Math.round((summary.students / summary.seats) * 100) : 0;

  return `<div class="page">
    <div class="page-head">
      <div><h1>المجموعات</h1>
        <div class="sub">${summary.groups} مجموعة نشطة · ${summary.students} طالب · ${occupancy}% إشغال</div></div>
      <div class="page-actions">
        <a class="btn secondary" href="#/calendar">${icon('calendar')}الجدول</a>
        <button class="btn" data-add-group>${icon('plus')}مجموعة جديدة</button>
      </div>
    </div>

    <div class="grid grid-4 mb-3">
      ${summaryCard('مجموعات نشطة', summary.groups, `${allGroups.length} مجموعة إجمالاً`, 'grid', 'var(--teal)', 'var(--teal-soft)')}
      ${summaryCard('طلبة مسجلين', summary.students, 'في كل المجموعات النشطة', 'users', 'var(--blue)', 'var(--blue-soft)')}
      ${summaryCard('إجمالي الأماكن', summary.seats, `${Math.max(0, summary.seats - summary.students)} مكان فاضي`, 'target', 'var(--saffron)', 'var(--saffron-soft)')}
      ${summaryCard('نسبة الإشغال', `${occupancy}<small>%</small>`, occupancy >= 85 ? 'قريب من الطاقة القصوى' : 'فيه مساحة للتوسع', 'percent', 'var(--coral)', 'var(--coral-soft)')}
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="search">${icon('search')}
          <input class="input" type="search" placeholder="دوّر باسم المجموعة، المادة، القاعة…" data-search>
        </div>
        <select class="select" data-filter="subject">
          <option value="">كل المواد</option>
          ${subjects.map((subject) => `<option value="${escapeHTML(subject)}">${escapeHTML(subject)}</option>`).join('')}
        </select>
        <select class="select" data-filter="status">
          <option value="active">النشطة</option>
          <option value="archived">المؤرشفة</option>
          <option value="all">الكل</option>
        </select>
        <select class="select" data-filter="sort">
          <option value="next">أقرب حصة</option>
          <option value="name">بالاسم</option>
          <option value="students">بعدد الطلبة</option>
          <option value="attendance">بالحضور</option>
          <option value="balance">بالمتأخرات</option>
        </select>
        <span class="grow"></span>
        <span class="small muted" data-count></span>
      </div>
      <div data-groups-list>${renderCards(allGroups.filter((g) => g.status === 'active'))}</div>
    </div>
  </div>`;
}

export async function mount(root, ctx) {
  const listEl = root.querySelector('[data-groups-list]');
  const countEl = root.querySelector('[data-count]');
  const searchEl = root.querySelector('[data-search]');
  const state = { search: '', subject: '', status: 'active', sort: 'next' };

  const apply = () => {
    let items = [...allGroups];
    if (state.status !== 'all') items = items.filter((g) => g.status === state.status);
    if (state.subject) items = items.filter((g) => g.subject === state.subject);
    if (state.search) {
      const needle = normalize(state.search);
      items = items.filter((g) => [g.name, g.subject, g.level, g.room].some((v) => normalize(v).includes(needle)));
    }
    const sorters = {
      next: (a, b) => (a.nextLesson?.date || '9999').localeCompare(b.nextLesson?.date || '9999') || (a.nextLesson?.start || '').localeCompare(b.nextLesson?.start || ''),
      name: (a, b) => a.name.localeCompare(b.name, 'ar'),
      students: (a, b) => (b.studentCount || 0) - (a.studentCount || 0),
      attendance: (a, b) => (b.attendanceRate || 0) - (a.attendanceRate || 0),
      balance: (a, b) => (b.finances?.balance || 0) - (a.finances?.balance || 0),
    };
    items.sort(sorters[state.sort] || sorters.next);
    listEl.innerHTML = renderCards(items);
    if (countEl) countEl.textContent = `${items.length} مجموعة`;
    bindCards();
  };

  const bindCards = () => {
    listEl.querySelectorAll('[data-edit]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const group = allGroups.find((g) => g.id === button.dataset.edit);
        if (group) groupModal({ group, onSaved: () => ctx.refresh() });
      });
    });
  };

  searchEl?.addEventListener('input', debounce((event) => {
    state.search = event.target.value;
    apply();
  }, 180));

  root.querySelectorAll('[data-filter]').forEach((select) => {
    select.addEventListener('change', () => {
      state[select.dataset.filter] = select.value;
      apply();
    });
  });

  root.querySelector('[data-add-group]')?.addEventListener('click', () => {
    groupModal({ onSaved: () => ctx.refresh() });
  });

  apply();
  if (ctx.query?.get('new') === '1') groupModal({ onSaved: () => ctx.refresh() });
}
