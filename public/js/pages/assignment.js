'use strict';

import {
  api,
  dateFull,
  relativeDay,
  escapeHTML,
  ASSIGNMENT_LABELS,
  downloadURL,
} from '../api.js';
import { icon, avatarHTML, toast, emptyHTML, confirmModal } from '../ui.js';
import { assignmentModal } from '../forms.js';

export async function render(ctx) {
  const data = await api.get(`/api/assignments/${ctx.params.id}`);
  const { assignment, roster, stats } = data;
  ctx.setTitle('تصحيح الواجب', assignment.title);

  return `<div class="page">
    <div class="page-head">
      <div>
        <a class="link-button" href="#/assignments">${icon('arrowRight')}كل الواجبات</a>
        <h1 class="mt-1">${escapeHTML(assignment.title)}</h1>
        <div class="sub">${escapeHTML(assignment.groupName)} · ${escapeHTML(ASSIGNMENT_LABELS[assignment.type] || assignment.type)} · التسليم ${escapeHTML(relativeDay(assignment.dueDate))}</div>
      </div>
      <div class="page-actions">
        <button class="btn secondary" data-export>${icon('download')}CSV</button>
        <button class="btn secondary" data-edit>${icon('settings')}تعديل</button>
        <a class="btn" href="#/assignments">${icon('check')}خلصت</a>
      </div>
    </div>

    <div class="grid grid-4 mb-3">
      ${statCard('اتصحح', `${stats.graded}/${stats.total}`, 'checkCircle', 'var(--teal)', 'var(--teal-soft)')}
      ${statCard('المتوسط', `${stats.average} / ${assignment.maxScore}`, 'chart', 'var(--saffron)', 'var(--saffron-soft)')}
      ${statCard('أعلى درجة', stats.highest, 'award', 'var(--blue)', 'var(--blue-soft)')}
      ${statCard('أقل درجة', stats.lowest, 'trend', 'var(--coral)', 'var(--coral-soft)')}
    </div>

    ${assignment.description ? `<div class="card mb-3"><div class="card-head"><div><h2>تفاصيل الواجب</h2></div></div><p class="small muted" style="line-height:1.9;margin:0">${escapeHTML(assignment.description)}</p></div>` : ''}

    <div class="card">
      <div class="card-head">
        <div><h2>تصحيح سريع</h2><div class="sub">اكتب الدرجة وعلّق، وبعدين احفظ الكل مرة واحدة</div></div>
        <div class="row">
          <input class="input" type="search" placeholder="فلتر بالاسم…" data-filter style="max-width:180px">
          <button class="btn" data-save>${icon('save')}حفظ الدرجات</button>
        </div>
      </div>
      <div class="progress mb-2" aria-hidden="true" style="height:8px"><span data-progress style="width:${stats.total ? Math.round((stats.graded / stats.total) * 100) : 0}%"></span></div>
      ${roster.length ? `<div class="table-wrap"><table class="table grade-table">
        <thead><tr><th>الطالب</th><th style="width:130px">الدرجة</th><th>ملاحظة</th><th></th></tr></thead>
        <tbody>${roster.map(rowHTML(assignment)).join('')}</tbody>
      </table></div>` : emptyHTML('users', 'مفيش طلبة في المجموعة', 'ضيف طلبة للمجموعة الأول.')}
      <div class="row-between mt-3" style="border-top:1px solid var(--line);padding-top:12px">
        <span class="small muted" data-status>${stats.graded} من ${stats.total} اتصححوا</span>
        <button class="btn" data-save-bottom>${icon('save')}حفظ الدرجات</button>
      </div>
    </div>
  </div>`;
}

function statCard(label, value, iconName, color, soft) {
  return `<div class="kpi" style="--kpi:${color};--kpi-soft:${soft}">
    <div class="kpi-top"><span>${escapeHTML(label)}</span><span class="kpi-icon">${icon(iconName)}</span></div>
    <div class="kpi-value">${value}</div>
  </div>`;
}

function rowHTML(assignment) {
  return (student) => `<tr data-row="${student.id}">
    <td><div class="row">${avatarHTML(student.name, student.avatarColor, 'sm')}
      <div><div class="strong small">${escapeHTML(student.shortName || student.name)}</div>
      <div class="tiny muted" dir="ltr" style="text-align:end">${escapeHTML(student.phone || '')}</div></div></div></td>
    <td><div class="score-input">
      <input class="input" type="number" min="0" max="${assignment.maxScore}" step="0.5" value="${student.score ?? ''}" placeholder="—" data-score aria-label="درجة ${escapeHTML(student.shortName)}">
      <span>/ ${assignment.maxScore}</span></div></td>
    <td><input class="input" type="text" value="${escapeHTML(student.feedback || '')}" placeholder="ملاحظة اختيارية" data-note></td>
    <td class="end"><span class="badge ${student.score !== null ? 'green' : 'gray'}" data-badge>${student.score !== null ? 'مصحح' : 'لسه'}</span></td>
  </tr>`;
}

export async function mount(root, ctx) {
  const rows = [...root.querySelectorAll('[data-row]')];
  const status = root.querySelector('[data-status]');
  const progress = root.querySelector('[data-progress]');

  const refreshProgress = () => {
    const graded = rows.filter((row) => row.querySelector('[data-score]').value !== '').length;
    const percent = rows.length ? Math.round((graded / rows.length) * 100) : 0;
    if (progress) progress.style.width = `${percent}%`;
    if (status) status.textContent = `${graded} من ${rows.length} اتصححوا`;
    rows.forEach((row) => {
      const value = row.querySelector('[data-score]').value;
      const badge = row.querySelector('[data-badge]');
      badge.className = `badge ${value !== '' ? 'green' : 'gray'}`;
      badge.textContent = value !== '' ? 'مصحح' : 'لسه';
    });
  };

  rows.forEach((row) => row.querySelector('[data-score]')?.addEventListener('input', refreshProgress));
  root.querySelector('[data-filter]')?.addEventListener('input', (event) => {
    const needle = event.target.value.trim();
    rows.forEach((row) => {
      row.style.display = !needle || row.textContent.includes(needle) ? '' : 'none';
    });
  });

  const save = async () => {
    const grades = rows
      .filter((row) => row.style.display !== 'none' || true)
      .map((row) => ({
        studentId: row.dataset.row,
        score: row.querySelector('[data-score]').value === '' ? '' : Number(row.querySelector('[data-score]').value),
        feedback: row.querySelector('[data-note]').value.trim(),
      }));
    try {
      await api.post(`/api/assignments/${ctx.params.id}/grades`, { grades });
      toast('الدرجات اتحفظت');
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  root.querySelector('[data-save]')?.addEventListener('click', save);
  root.querySelector('[data-save-bottom]')?.addEventListener('click', save);
  root.querySelector('[data-export]')?.addEventListener('click', () => {
    downloadURL(`/api/assignments/${ctx.params.id}/csv`);
  });
  root.querySelector('[data-edit]')?.addEventListener('click', async () => {
    const data = await api.get(`/api/assignments/${ctx.params.id}`);
    assignmentModal({ assignment: data.assignment, onSaved: () => ctx.refresh() });
  });
}
