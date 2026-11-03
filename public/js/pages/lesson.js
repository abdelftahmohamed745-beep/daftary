'use strict';

import {
  api,
  todayISO,
  dateFull,
  dateLong,
  relativeDay,
  timeLabel,
  escapeHTML,
  statusBadge,
  ATTENDANCE_LABELS,
  downloadURL,
} from '../api.js';
import {
  icon,
  avatarHTML,
  toast,
  formModal,
  confirmModal,
  printHTML,
  emptyHTML,
} from '../ui.js';
import { lessonModal } from '../forms.js';

const OPTIONS = ['present', 'absent', 'late', 'excused'];

let pageData = null;

function rateFromCounts(counts) {
  const total = counts.present + counts.absent + counts.late + counts.excused + counts.unmarked;
  const attended = counts.present + counts.late;
  return total ? Math.round((attended / total) * 100) : 0;
}

function attendanceRow(student) {
  return `<div class="att-row ${student.status !== 'unmarked' ? 'marked' : ''}" data-student="${student.id}" data-status="${student.status}">
    <div class="row grow" style="gap:9px;min-width:190px">
      ${avatarHTML(student.name, student.avatarColor, 'sm')}
      <div class="att-name">
        <a href="#/students/${student.id}" style="color:inherit">${escapeHTML(student.name)}</a>
        <small>${student.parentPhone ? `ولي الأمر: ${escapeHTML(student.parentPhone)}` : escapeHTML(student.shortName || '')}</small>
      </div>
    </div>
    <div class="att-opts">
      ${OPTIONS.map((status) => `<button class="att-opt ${student.status === status ? 'active' : ''}" data-v="${status}" data-set="${status}">
        ${ATTENDANCE_LABELS[status]}
      </button>`).join('')}
    </div>
    <input class="att-note" data-att-note placeholder="ملاحظة سريعة (اختياري)" value="${escapeHTML(student.note || '')}">
  </div>`;
}

function infoHTML(data) {
  const lesson = data.lesson;
  const group = data.group || {};
  const rows = [
    ['التاريخ', `${dateLong(lesson.date)}`],
    ['الوقت', `${timeLabel(lesson.start)} — ${lesson.duration} دقيقة`],
    ['المجموعة', group.name || '—'],
    ['القاعة', group.room || '—'],
    ['المادة', group.subject || '—'],
    ['الحضور', `${data.counts.present + data.counts.late} من ${data.students.length}`],
  ];
  return `<section class="card">
    <div class="card-head"><div><h2>تفاصيل الحصة</h2><div class="sub">${escapeHTML(relativeDay(lesson.date))}</div></div>
      <a class="card-link" href="#/groups/${group.id}">المجموعة ${icon('arrowLeft')}</a></div>
    <div class="kv-list">${rows.map(([label, value]) => `<div class="kv-row"><span class="k">${escapeHTML(label)}</span><span class="v">${escapeHTML(value)}</span></div>`).join('')}</div>
    <div class="divider my-2" style="margin:12px 0"></div>
    <div class="field" style="margin:0">
      <label>ملاحظات الحصة</label>
      <textarea class="textarea" rows="4" data-lesson-notes placeholder="حلينا الواجب، محتاجين مراجعة…">${escapeHTML(lesson.notes || '')}</textarea>
    </div>
    <button class="btn soft sm mt-2" data-save-notes>${icon('save')}حفظ الملاحظات</button>
  </section>`;
}

export async function render(ctx) {
  const data = await api.get(`/api/lessons/${ctx.params.id}`);
  pageData = data;
  const lesson = data.lesson;
  const group = data.group || {};
  const rate = rateFromCounts(data.counts);
  ctx.setTitle(group.name || 'حصة', dateFull(lesson.date));

  return `<div class="page">
    <div class="page-head">
      <div class="profile-head" style="flex:1">
        <div class="profile-id">
          <span class="brand-mark" style="background:${escapeHTML(group.color || 'var(--teal)')};color:#fff;border-radius:16px">${icon('calendar')}</span>
          <div style="min-width:0">
            <div class="row" style="gap:8px;flex-wrap:wrap">
              <h1>${escapeHTML(group.name || 'حصة')}</h1>
              ${statusBadge(lesson.status)}
            </div>
            <div class="profile-meta">
              <span>${icon('calendar')}${escapeHTML(dateLong(lesson.date))}</span>
              <span>${icon('clock')}${escapeHTML(timeLabel(lesson.start))} · ${lesson.duration} دقيقة</span>
              ${group.room ? `<span>${icon('home')}${escapeHTML(group.room)}</span>` : ''}
              <span>${icon('book')}${escapeHTML(lesson.topic || group.subject || '—')}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="page-actions">
        <button class="btn secondary" data-print>${icon('print')}كشف الحضور</button>
        <button class="btn secondary" data-csv>${icon('download')}CSV</button>
        <button class="btn secondary" data-duplicate>${icon('copy')}نسخ</button>
        <button class="btn secondary" data-edit>${icon('edit')}تعديل</button>
      </div>
    </div>

    <div class="stat-row" style="margin:16px 0">
      <div class="stat-mini"><div class="lbl">طلبة المجموعة</div><div class="val">${data.students.length}</div></div>
      <div class="stat-mini"><div class="lbl">حاضر</div><div class="val" style="color:var(--teal)">${data.counts.present + data.counts.late}</div></div>
      <div class="stat-mini"><div class="lbl">غايب</div><div class="val" style="color:var(--coral)">${data.counts.absent}</div></div>
      <div class="stat-mini"><div class="lbl">نسبة الحضور</div><div class="val">${rate}% <small>${data.counts.unmarked} لسه</small></div></div>
    </div>

    <div class="lesson-layout">
      <section class="card">
        <div class="att-head">
          <div><h2 style="font-size:15px">تحضير الحصة</h2>
            <div class="att-progress mt-1">
              <span data-att-count>${data.students.length - data.counts.unmarked} من ${data.students.length} اتسجلوا</span>
              <div class="progress" style="width:130px"><span data-att-progress style="width:${data.students.length ? Math.round(((data.students.length - data.counts.unmarked) / data.students.length) * 100) : 0}%"></span></div>
            </div>
          </div>
          <div class="row" style="gap:6px">
            <button class="btn secondary sm" data-all-present>${icon('checkCircle')}الكل حاضر</button>
            <button class="btn sm" data-save-attendance>${icon('save')}حفظ التحضير</button>
          </div>
        </div>
        ${data.students.length
          ? `<div class="att-list">${data.students.map(attendanceRow).join('')}</div>
            <label class="checkline mt-3"><input type="checkbox" data-mark-done ${lesson.status === 'done' ? 'checked' : ''}>
              <span>خلصت الحصة — اعتبر التحضير نهائي</span></label>`
          : emptyHTML('users', 'مفيش طلبة في المجموعة', 'ضُم طلبة للمجموعة الأول عشان تقدر تحضّر.')}
      </section>

      ${infoHTML(data)}
    </div>

    ${ctx.user.role === 'admin' ? `<section class="card mt-3" style="border-color:color-mix(in srgb,var(--coral) 35%,var(--line))">
      <div class="card-head"><div><h2>حذف الحصة</h2><div class="sub">هتتمسح الحصة وكل سجلات الحضور بتاعتها.</div></div>
        <button class="btn danger sm" data-delete>${icon('trash')}حذف الحصة</button></div>
    </section>` : ''}
  </div>`;
}

export async function mount(root, ctx) {
  if (!pageData) return;
  const data = pageData;

  const updateProgress = () => {
    const rows = [...root.querySelectorAll('[data-student]')];
    const marked = rows.filter((row) => row.dataset.status !== 'unmarked').length;
    const countEl = root.querySelector('[data-att-count]');
    const barEl = root.querySelector('[data-att-progress]');
    if (countEl) countEl.textContent = `${marked} من ${rows.length} اتسجلوا`;
    if (barEl) barEl.style.width = `${rows.length ? Math.round((marked / rows.length) * 100) : 0}%`;
  };

  root.querySelectorAll('[data-student]').forEach((row) => {
    row.querySelectorAll('[data-set]').forEach((button) => {
      button.addEventListener('click', () => {
        row.dataset.status = button.dataset.set;
        row.classList.add('marked');
        row.querySelectorAll('[data-set]').forEach((b) => b.classList.toggle('active', b === button));
        updateProgress();
      });
    });
  });

  const saveAttendance = async () => {
    const records = [...root.querySelectorAll('[data-student]')].map((row) => ({
      studentId: row.dataset.student,
      status: row.dataset.status === 'unmarked' ? 'present' : row.dataset.status,
      note: row.querySelector('[data-att-note]')?.value.trim() || '',
    }));
    if (!records.length) {
      toast('مفيش طلبة في المجموعة', 'error');
      return;
    }
    const markDone = Boolean(root.querySelector('[data-mark-done]')?.checked);
    const result = await api.post(`/api/lessons/${data.lesson.id}/attendance`, { records, markDone });
    toast(`اتحفظ حضور ${result.students.length} طالب${markDone ? ' — الحصة خلصت' : ''}`);
    ctx.refresh();
  };

  root.querySelector('[data-save-attendance]')?.addEventListener('click', saveAttendance);

  root.querySelector('[data-all-present]')?.addEventListener('click', async () => {
    try {
      await api.post(`/api/lessons/${data.lesson.id}/attendance/all`, { status: 'present' });
      toast('تم تسجيل الكل حاضر');
      ctx.refresh();
    } catch {
      /* handled */
    }
  });

  root.querySelector('[data-edit]')?.addEventListener('click', () => {
    lessonModal({ lesson: data.lesson, onSaved: () => ctx.refresh() });
  });

  root.querySelector('[data-duplicate]')?.addEventListener('click', () => {
    formModal({
      title: 'نسخ الحصة',
      sub: 'هيتم عمل حصة جديدة بنفس الوقت والمجموعة في تاريخ تاني.',
      fields: [{ name: 'date', label: 'التاريخ الجديد', type: 'date', required: true, span: 2 }],
      values: { date: todayISO() },
      submitText: 'انسخ الحصة',
      onSubmit: async (values) => {
        const result = await api.post(`/api/lessons/${data.lesson.id}/duplicate`, values);
        toast('اتعملت نسخة من الحصة');
        location.hash = `#/lessons/${result.lesson.id}`;
      },
    });
  });

  root.querySelector('[data-save-notes]')?.addEventListener('click', async () => {
    const notes = root.querySelector('[data-lesson-notes]')?.value || '';
    await api.patch(`/api/lessons/${data.lesson.id}`, { notes });
    toast('تم حفظ ملاحظات الحصة');
  });

  root.querySelector('[data-csv]')?.addEventListener('click', () => {
    downloadURL(`/api/lessons/${data.lesson.id}/csv`);
  });

  root.querySelector('[data-print]')?.addEventListener('click', () => {
    const rows = [...root.querySelectorAll('[data-student]')].map((row) => {
      const student = data.students.find((s) => s.id === row.dataset.student) || {};
      return {
        name: student.name || '',
        phone: student.phone || '',
        status: row.dataset.status,
        note: row.querySelector('[data-att-note]')?.value.trim() || '',
      };
    });
    printAttendance(data, rows, ctx.settings);
  });

  root.querySelector('[data-delete]')?.addEventListener('click', () => {
    confirmModal({
      title: 'حذف الحصة نهائي',
      message: 'هتتمسح الحصة وكل حضورها. الخطوة دي مش بترجع.',
      danger: true,
      confirmText: 'أيوه، امسح الحصة',
      onConfirm: async () => {
        await api.delete(`/api/lessons/${data.lesson.id}`);
        toast('تم حذف الحصة');
        location.hash = '#/calendar';
      },
    });
  });
}

function printAttendance(data, rows, settings) {
  const body = rows
    .map(
      (row) => `<tr><td>${escapeHTML(row.name)}</td><td dir="ltr">${escapeHTML(row.phone || '')}</td>
      <td>${escapeHTML(ATTENDANCE_LABELS[row.status] || row.status)}</td><td>${escapeHTML(row.note || '')}</td></tr>`,
    )
    .join('');
  printHTML(`<div class="print-sheet">
    <div class="print-head">
      <div><h1 style="margin:0;font-size:22px">كشف حضور — ${escapeHTML(data.group?.name || '')}</h1>
        <div style="font-size:12px;color:#555;margin-top:4px">${escapeHTML(settings.centerName || 'دفتري')} · ${escapeHTML(dateFull(data.lesson.date))} · ${escapeHTML(timeLabel(data.lesson.start))}</div></div>
      <div style="font-size:11px;text-align:end">${escapeHTML(data.lesson.topic || '')}</div>
    </div>
    <table class="print-table"><thead><tr><th>الطالب</th><th>الموبايل</th><th>الحضور</th><th>ملاحظة</th></tr></thead>
      <tbody>${body || '<tr><td colspan="4">مفيش طلبة</td></tr>'}</tbody></table>
    <div class="print-totals"><span>عدد الطلبة ${rows.length}</span><span>حاضر ${rows.filter((r) => r.status === 'present' || r.status === 'late').length}</span></div>
  </div>`);
}
