'use strict';

import { api, escapeHTML, dateFull, downloadURL, relativeDay } from '../api.js';
import { icon, avatarHTML, toast, emptyHTML, confirmModal } from '../ui.js';
import { examModal } from '../feature-forms.js';

const TYPE_LABELS = { quiz: 'كويز', exam: 'امتحان', monthly: 'شهري', final: 'نهائي', practical: 'عملي' };

function statCard(label, value, iconName, color, soft, foot = '') {
  return `<div class="kpi" style="--kpi:${color};--kpi-soft:${soft}">
    <div class="kpi-top"><span>${escapeHTML(label)}</span><span class="kpi-icon">${icon(iconName)}</span></div>
    <div class="kpi-value">${value}</div>
    ${foot ? `<div class="kpi-foot">${foot}</div>` : ''}
  </div>`;
}

function rowHTML(exam) {
  return (student) => `<tr data-row="${student.id}">
    <td><div class="row">${avatarHTML(student.fullName, student.avatarColor, 'sm')}
      <div><div class="strong small">${escapeHTML(student.name)}</div>
      <div class="tiny muted mono">${escapeHTML(student.code || '')}</div></div></div></td>
    <td><div class="score-input">
      <input class="input" type="number" min="0" max="${exam.maxScore}" step="0.5" value="${student.score ?? ''}" placeholder="—" data-score aria-label="درجة ${escapeHTML(student.name)}">
      <span>/ ${exam.maxScore}</span></div></td>
    <td class="num"><span class="badge ${student.passed === true ? 'green' : student.passed === false ? 'red' : 'gray'}" data-badge>${student.graded ? (student.passed ? 'ناجح' : 'راسب') : 'لسه'}</span></td>
    <td><input class="input" type="text" value="${escapeHTML(student.note || '')}" placeholder="ملاحظة" data-note></td>
  </tr>`;
}

export async function render(ctx) {
  const data = await api.get(`/api/exams/${ctx.params.id}`);
  const { exam, results } = data;
  ctx.setTitle('الامتحان', exam.title);

  return `<div class="page">
    <div class="page-head">
      <div>
        <a class="link-button" href="#/exams">${icon('arrowRight')}كل الامتحانات</a>
        <h1 class="mt-1">${escapeHTML(exam.title)}</h1>
        <div class="sub">${escapeHTML(exam.groupName)} · ${escapeHTML(TYPE_LABELS[exam.type] || exam.type)} · ${escapeHTML(dateFull(exam.date))} ${exam.start ? `· ${escapeHTML(exam.start)}` : ''}</div>
      </div>
      <div class="page-actions">
        <button class="btn secondary" data-export>${icon('download')}CSV</button>
        <button class="btn secondary" data-edit>${icon('settings')}تعديل</button>
        <a class="btn" href="#/exams">${icon('check')}خلصت</a>
      </div>
    </div>

    <div class="grid grid-4 mb-3">
      ${statCard('اتصحح', `${exam.gradedCount}/${exam.studentCount}`, 'checkCircle', 'var(--teal)', 'var(--teal-soft)', exam.pending ? `${exam.pending} باقي` : 'مكتمل')}
      ${statCard('المتوسط', `${exam.average} / ${exam.maxScore}`, 'chart', 'var(--saffron)', 'var(--saffron-soft)', `${exam.percent}%`) }
      ${statCard('أعلى درجة', exam.highest, 'award', 'var(--blue)', 'var(--blue-soft)')}
      ${statCard('نسبة النجاح', `${exam.passRate}%`, 'percent', 'var(--plum)', 'var(--plum-soft)', `${exam.passCount} ناجح`)}
    </div>

    ${exam.description ? `<div class="card mb-3"><p class="small muted" style="line-height:1.9;margin:0">${escapeHTML(exam.description)}</p></div>` : ''}

    <div class="card">
      <div class="card-head">
        <div><h2>تصحيح سريع</h2><div class="sub">اكتب الدرجات وملاحظة، وبعدين احفظ الكل مرة واحدة</div></div>
        <div class="row">
          <input class="input" type="search" placeholder="فلتر بالاسم…" data-filter style="max-width:180px">
          <button class="btn" data-save>${icon('save')}حفظ الدرجات</button>
        </div>
      </div>
      <div class="progress mb-2" aria-hidden="true" style="height:8px"><span data-progress style="width:${exam.studentCount ? Math.round((exam.gradedCount / exam.studentCount) * 100) : 0}%"></span></div>
      ${results.length ? `<div class="table-wrap"><table class="table grade-table">
        <thead><tr><th>الطالب</th><th style="width:150px">الدرجة</th><th class="num">الحالة</th><th>ملاحظة</th></tr></thead>
        <tbody>${results.map(rowHTML(exam)).join('')}</tbody>
      </table></div>` : emptyHTML('users', 'مفيش طلبة في المجموعة', 'ضيف طلبة للمجموعة الأول.')}
      <div class="row-between mt-3" style="border-top:1px solid var(--line);padding-top:12px">
        <span class="small muted" data-status>${exam.gradedCount} من ${exam.studentCount} اتصححوا</span>
        <div class="row">
          <button class="btn secondary" data-clear>${icon('refresh')}مسح الدرجات الفاضية</button>
          <button class="btn" data-save-bottom>${icon('save')}حفظ الدرجات</button>
        </div>
      </div>
    </div>
  </div>`;
}

export async function mount(root, ctx) {
  const rows = [...root.querySelectorAll('[data-row]')];
  const statusEl = root.querySelector('[data-status]');
  const progress = root.querySelector('[data-progress]');

  const refreshProgress = () => {
    const graded = rows.filter((row) => row.querySelector('[data-score]').value !== '').length;
    const percent = rows.length ? Math.round((graded / rows.length) * 100) : 0;
    if (progress) progress.style.width = `${percent}%`;
    if (statusEl) statusEl.textContent = `${graded} من ${rows.length} اتصححوا`;
    rows.forEach((row) => {
      const value = row.querySelector('[data-score]').value;
      const badge = row.querySelector('[data-badge]');
      const max = Number(row.querySelector('[data-score]').max) || 0;
      if (value === '') {
        badge.className = 'badge gray';
        badge.textContent = 'لسه';
      } else {
        const passed = Number(value) >= max / 2;
        badge.className = `badge ${passed ? 'green' : 'red'}`;
        badge.textContent = passed ? 'ناجح' : 'راسب';
      }
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
    const records = rows.map((row) => ({
      studentId: row.dataset.row,
      score: row.querySelector('[data-score]').value === '' ? '' : Number(row.querySelector('[data-score]').value),
      note: row.querySelector('[data-note]').value.trim(),
    }));
    try {
      const data = await api.post(`/api/exams/${ctx.params.id}/results`, { records });
      toast(`اتحفظ ${data.saved} درجة`);
      ctx.refresh();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  root.querySelector('[data-save]')?.addEventListener('click', save);
  root.querySelector('[data-save-bottom]')?.addEventListener('click', save);
  root.querySelector('[data-clear]')?.addEventListener('click', () => {
    rows.forEach((row) => {
      row.querySelector('[data-score]').value = '';
    });
    refreshProgress();
  });
  root.querySelector('[data-export]')?.addEventListener('click', () => {
    downloadURL(`/api/exams/${ctx.params.id}/csv`);
  });
  root.querySelector('[data-edit]')?.addEventListener('click', async () => {
    const data = await api.get(`/api/exams/${ctx.params.id}`);
    examModal({ exam: data.exam, onSaved: () => ctx.refresh() });
  });
}
