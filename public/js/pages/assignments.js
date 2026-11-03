'use strict';

import {
  api,
  dateShort,
  relativeDay,
  escapeHTML,
  ASSIGNMENT_LABELS,
  downloadURL,
} from '../api.js';
import { icon, toast, emptyHTML, confirmModal } from '../ui.js';
import { assignmentModal, loadGroups, deleteConfirm } from '../forms.js';

const STATUS_LABELS = { open: 'مفتوح', closed: 'مقفول' };

function summaryCard(label, value, iconName, color, soft) {
  return `<div class="kpi" style="--kpi:${color};--kpi-soft:${soft}">
    <div class="kpi-top"><span>${escapeHTML(label)}</span><span class="kpi-icon">${icon(iconName)}</span></div>
    <div class="kpi-value">${value}</div>
  </div>`;
}

function rowHTML(item) {
  const percent = Number(item.percent) || 0;
  const tone = percent >= 80 ? 'green' : percent >= 60 ? 'amber' : 'red';
  return `<tr data-open="${item.id}">
    <td><div class="row"><span class="group-dot" style="background:${escapeHTML(item.groupColor)}"></span>
      <div><div class="strong small">${escapeHTML(item.title)}</div>
      <div class="tiny muted">${escapeHTML(ASSIGNMENT_LABELS[item.type] || item.type)} · ${escapeHTML(item.groupName)}</div></div></div></td>
    <td class="small">${escapeHTML(relativeDay(item.dueDate))}</td>
    <td><span class="badge ${item.status === 'open' ? 'green' : 'gray'}">${STATUS_LABELS[item.status] || item.status}</span></td>
    <td class="num">${item.gradedCount}/${item.studentCount}</td>
    <td class="num"><span class="badge ${tone}">${percent}%</span></td>
    <td class="num small">${item.average} / ${item.maxScore}</td>
    <td class="end">${
      item.overdue
        ? '<span class="badge red">متأخر</span>'
        : `<a class="btn xs secondary" href="#/assignments/${item.id}">تصحيح</a>`
    }</td>
  </tr>`;
}

function listHTML(items) {
  if (!items.length) {
    return emptyHTML('clipboard', 'مفيش واجبات بالفلتر ده', 'أضف واجب جديد وابدأ التصحيح السريع.');
  }
  return `<div class="table-wrap"><table class="table">
    <thead><tr><th>الواجب</th><th>التسليم</th><th>الحالة</th><th class="num">اتصحح</th><th class="num">المتوسط</th><th class="num">الدرجة</th><th></th></tr></thead>
    <tbody>${items.map(rowHTML).join('')}</tbody></table></div>`;
}

export async function render(ctx) {
  const params = new URLSearchParams();
  for (const key of ['groupId', 'status', 'type']) {
    if (ctx.query.get(key)) params.set(key, ctx.query.get(key));
  }
  const [data, groups] = await Promise.all([
    api.get(`/api/assignments?${params.toString()}`),
    loadGroups(),
  ]);
  const q = Object.fromEntries(params.entries());
  return `<div class="page">
    <div class="page-head">
      <div><h1>الواجبات والتصحيح</h1>
        <div class="sub">${data.total} واجب · ${data.summary.open} مفتوح · ${data.summary.graded} درجة مسجلة</div></div>
      <div class="page-actions">
        <button class="btn secondary" data-export>${icon('download')}تصدير</button>
        <button class="btn" data-add>${icon('plus')}واجب جديد</button>
      </div>
    </div>

    <div class="grid grid-4 mb-3">
      ${summaryCard('إجمالي الواجبات', data.total, 'clipboard', 'var(--teal)', 'var(--teal-soft)')}
      ${summaryCard('مفتوح للتسليم', data.summary.open, 'clock', 'var(--saffron)', 'var(--saffron-soft)')}
      ${summaryCard('مقفول', data.summary.closed, 'archive', 'var(--blue)', 'var(--blue-soft)')}
      ${summaryCard('درجات مصححة', data.summary.graded, 'checkCircle', 'var(--plum)', 'var(--plum-soft)')}
    </div>

    <div class="card">
      <div class="toolbar">
        <select class="select" data-filter="groupId">
          <option value="">كل المجموعات</option>
          ${groups.map((g) => `<option value="${g.id}" ${q.groupId === g.id ? 'selected' : ''}>${escapeHTML(g.name)}</option>`).join('')}
        </select>
        <select class="select" data-filter="status">
          <option value="">كل الحالات</option>
          <option value="open" ${q.status === 'open' ? 'selected' : ''}>مفتوح</option>
          <option value="closed" ${q.status === 'closed' ? 'selected' : ''}>مقفول</option>
        </select>
        <select class="select" data-filter="type">
          <option value="">كل الأنواع</option>
          ${Object.entries(ASSIGNMENT_LABELS).map(([value, label]) => `<option value="${value}" ${q.type === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>
      <div data-list>${listHTML(data.items)}</div>
    </div>
  </div>`;
}

export async function mount(root, ctx) {
  const listEl = root.querySelector('[data-list]');
  const current = Object.fromEntries((ctx.query || new URLSearchParams()).entries());

  const refresh = async () => {
    const params = new URLSearchParams();
    for (const key of ['groupId', 'status', 'type']) if (current[key]) params.set(key, current[key]);
    listEl.style.opacity = '0.45';
    try {
      const data = await api.get(`/api/assignments?${params.toString()}`);
      listEl.innerHTML = listHTML(data.items);
      listEl.style.opacity = '';
      const sub = root.querySelector('.page-head .sub');
      if (sub) sub.textContent = `${data.total} واجب · ${data.summary.open} مفتوح · ${data.summary.graded} درجة مسجلة`;
    } catch (error) {
      listEl.style.opacity = '';
      toast(error.message, 'error');
    }
  };

  root.querySelectorAll('[data-filter]').forEach((el) => {
    el.addEventListener('change', () => {
      current[el.dataset.filter] = el.value;
      refresh();
    });
  });

  root.querySelector('[data-add]')?.addEventListener('click', () => {
    assignmentModal({ onSaved: refresh });
  });
  root.querySelector('[data-export]')?.addEventListener('click', () => {
    downloadURL('/api/exports/grades.csv');
    toast('بيتم تحميل ملف الدرجات');
  });

  if (ctx.query?.get('new') === '1') assignmentModal({ onSaved: refresh });
}
