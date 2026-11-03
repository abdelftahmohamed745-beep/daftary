'use strict';

import { api, escapeHTML, relativeDay, downloadURL } from '../api.js';
import { icon, toast, emptyHTML, confirmModal } from '../ui.js';
import { examModal } from '../feature-forms.js';
import { loadGroups } from '../forms.js';

const TYPE_LABELS = { quiz: 'كويز', exam: 'امتحان', monthly: 'شهري', final: 'نهائي', practical: 'عملي' };

function summaryCard(label, value, iconName, color, soft, foot = '') {
  return `<div class="kpi" style="--kpi:${color};--kpi-soft:${soft}">
    <div class="kpi-top"><span>${escapeHTML(label)}</span><span class="kpi-icon">${icon(iconName)}</span></div>
    <div class="kpi-value">${value}</div>
    ${foot ? `<div class="kpi-foot">${foot}</div>` : ''}
  </div>`;
}

function rowHTML(exam) {
  const tone = exam.status === 'graded' ? 'green' : exam.status === 'open' ? 'amber' : exam.status === 'closed' ? 'gray' : 'blue';
  return `<tr data-open="${exam.id}">
    <td><div class="row"><span class="group-dot" style="background:${escapeHTML(exam.groupColor)}"></span>
      <div><div class="strong small">${escapeHTML(exam.title)}</div>
      <div class="tiny muted">${escapeHTML(TYPE_LABELS[exam.type] || exam.type)} · ${escapeHTML(exam.groupName)}</div></div></div></td>
    <td class="small">${escapeHTML(relativeDay(exam.date))}</td>
    <td class="small muted">${escapeHTML(exam.start || '')}</td>
    <td><span class="badge ${tone}">${escapeHTML(exam.statusLabel || exam.status)}</span></td>
    <td class="num">${exam.gradedCount}/${exam.studentCount}</td>
    <td class="num"><span class="badge ${exam.percent >= 75 ? 'green' : exam.percent >= 50 ? 'amber' : 'red'}">${exam.percent}%</span></td>
    <td class="num small">${exam.average} / ${exam.maxScore}</td>
    <td class="end"><div class="row" style="justify-content:flex-end">
      <a class="btn xs secondary" href="#/exams/${exam.id}">${exam.status === 'graded' ? 'النتائج' : 'تصحيح'}</a>
      <button class="icon-btn" data-edit title="تعديل">${icon('settings')}</button>
      <button class="icon-btn danger" data-delete title="حذف">${icon('trash')}</button>
    </div></td>
  </tr>`;
}

function tableHTML(items) {
  if (!items.length) return emptyHTML('target', 'مفيش امتحانات بالفلتر ده', 'أضف امتحان جديد وابدأ التصحيح السريع.');
  return `<div class="table-wrap"><table class="table">
    <thead><tr><th>الامتحان</th><th>التاريخ</th><th>الوقت</th><th>الحالة</th><th class="num">اتصحح</th><th class="num">المتوسط</th><th class="num">الدرجة</th><th></th></tr></thead>
    <tbody>${items.map(rowHTML).join('')}</tbody></table></div>`;
}

export async function render(ctx) {
  const params = new URLSearchParams();
  for (const key of ['groupId', 'status', 'type', 'q']) if (ctx.query.get(key)) params.set(key, ctx.query.get(key));
  const [data, groups] = await Promise.all([
    api.get(`/api/exams?${params.toString()}`),
    loadGroups(),
  ]);
  const q = Object.fromEntries(params.entries());
  const summary = data.summary;

  return `<div class="page">
    <div class="page-head">
      <div><h1>الامتحانات</h1><div class="sub">${summary.total} امتحان · ${summary.open} مفتوح للتصحيح · متوسط ${summary.average}%</div></div>
      <div class="page-actions">
        <button class="btn secondary" data-export>${icon('download')}تصدير</button>
        <button class="btn" data-add>${icon('plus')}امتحان جديد</button>
      </div>
    </div>

    <div class="grid grid-4 mb-3">
      ${summaryCard('إجمالي الامتحانات', summary.total, 'target', 'var(--teal)', 'var(--teal-soft)')}
      ${summaryCard('مفتوح للتصحيح', summary.open, 'clock', 'var(--saffron)', 'var(--saffron-soft)')}
      ${summaryCard('مصحح', summary.graded, 'checkCircle', 'var(--blue)', 'var(--blue-soft)')}
      ${summaryCard('قادم', summary.upcoming, 'calendar', 'var(--plum)', 'var(--plum-soft)')}
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="search">${icon('search')}
          <input class="input" type="search" placeholder="دوّر باسم الامتحان…" value="${escapeHTML(q.q || '')}" data-search>
        </div>
        <select class="select" data-filter="groupId">
          <option value="">كل المجموعات</option>
          ${groups.map((g) => `<option value="${g.id}" ${q.groupId === g.id ? 'selected' : ''}>${escapeHTML(g.name)}</option>`).join('')}
        </select>
        <select class="select" data-filter="status">
          <option value="">كل الحالات</option>
          ${[['open', 'مفتوح'], ['graded', 'مصحح'], ['draft', 'مسودة'], ['closed', 'مغلق']].map(([value, label]) => `<option value="${value}" ${q.status === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
        <select class="select" data-filter="type">
          <option value="">كل الأنواع</option>
          ${Object.entries(TYPE_LABELS).map(([value, label]) => `<option value="${value}" ${q.type === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>
      <div data-list>${tableHTML(data.items)}</div>
    </div>
  </div>`;
}

export async function mount(root, ctx) {
  const current = Object.fromEntries((ctx.query || new URLSearchParams()).entries());
  const listEl = root.querySelector('[data-list]');
  let timer = null;

  const bind = () => {
    listEl.querySelectorAll('[data-open]').forEach((row) => {
      row.addEventListener('click', (event) => {
        if (event.target.closest('button, a')) return;
        location.hash = `#/exams/${row.dataset.open}`;
      });
    });
    listEl.querySelectorAll('[data-edit]').forEach((button) => {
      button.addEventListener('click', async () => {
        const id = button.closest('[data-open]').dataset.open;
        const data = await api.get(`/api/exams/${id}`);
        examModal({ exam: data.exam, onSaved: refresh });
      });
    });
    listEl.querySelectorAll('[data-delete]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.closest('[data-open]').dataset.open;
        confirmModal({
          title: 'حذف الامتحان؟',
          message: 'الامتحان وكل درجاته هيتشالوا نهائياً.',
          danger: true,
          onConfirm: async () => {
            await api.delete(`/api/exams/${id}`);
            toast('الامتحان اتحذف');
            refresh();
          },
        });
      });
    });
  };

  const refresh = async () => {
    const params = new URLSearchParams();
    for (const key of ['groupId', 'status', 'type', 'q']) if (current[key]) params.set(key, current[key]);
    listEl.style.opacity = '0.45';
    try {
      const data = await api.get(`/api/exams?${params.toString()}`);
      listEl.innerHTML = tableHTML(data.items);
      listEl.style.opacity = '';
      const sub = root.querySelector('.page-head .sub');
      if (sub) sub.textContent = `${data.summary.total} امتحان · ${data.summary.open} مفتوح للتصحيح · متوسط ${data.summary.average}%`;
      bind();
    } catch (error) {
      listEl.style.opacity = '';
      toast(error.message, 'error');
    }
  };

  root.querySelector('[data-search]')?.addEventListener('input', (event) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      current.q = event.target.value.trim();
      refresh();
    }, 260);
  });
  root.querySelectorAll('[data-filter]').forEach((select) => {
    select.addEventListener('change', () => {
      current[select.dataset.filter] = select.value;
      refresh();
    });
  });
  root.querySelector('[data-add]')?.addEventListener('click', () => examModal({ onSaved: refresh }));
  root.querySelector('[data-export]')?.addEventListener('click', () => {
    downloadURL('/api/exports/grades.csv');
    toast('بيتم تحميل ملف الدرجات');
  });
  bind();
  if (ctx.query?.get('new') === '1') examModal({ onSaved: refresh });
}
