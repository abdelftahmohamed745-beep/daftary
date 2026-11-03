'use strict';

import {
  api,
  money,
  dateShort,
  dateFull,
  relativeDay,
  timeLabel,
  escapeHTML,
  statusBadge,
  ASSIGNMENT_LABELS,
  DAYS,
} from '../api.js';
import {
  icon,
  avatarHTML,
  ringHTML,
  toast,
  emptyHTML,
  formModal,
  confirmModal,
  openModal,
  printHTML,
} from '../ui.js';
import {
  groupModal,
  lessonModal,
  paymentModal,
  reminderModal,
  deleteConfirm,
  loadStudents,
  clearCaches,
} from '../forms.js';

let profile = null;

function scheduleText(schedule = []) {
  return schedule
    .map((slot) => `${DAYS[Number(slot.day)] || ''} ${timeLabel(slot.start)}`)
    .join(' · ');
}

function tabButton(key, label, count, active) {
  return `<button class="tab ${active ? 'active' : ''}" data-tab="${key}">
    ${label}${count !== undefined && count !== null ? `<span class="count">${count}</span>` : ''}
  </button>`;
}

const MATERIAL_ICONS = { link: 'link', note: 'note', file: 'file' };

function rosterHTML(data) {
  const roster = data.roster || [];
  return `<section class="card">
    <div class="card-head">
      <div><h2>الطلبة</h2><div class="sub">${roster.length} طالب في المجموعة${data.capacity ? ` من ${data.capacity}` : ''}</div></div>
      <div class="row">
        <button class="btn secondary sm" data-remind-all>${icon('message')}تذكير الجميع</button>
        <button class="btn sm" data-add-student>${icon('plus')}ضم طالب</button>
      </div>
    </div>
    ${roster.length
      ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>الطالب</th><th>الصف</th><th>الحضور</th><th class="num">عليه</th><th>ولي الأمر</th><th></th></tr></thead>
          <tbody>${roster.map((student) => `<tr>
            <td><a class="row" href="#/students/${student.id}" style="color:inherit">
              ${avatarHTML(student.name, student.avatarColor, 'sm')}
              <div><div class="strong small">${escapeHTML(student.name)}</div>
                <div class="tiny muted">${escapeHTML(student.shortName || '')}</div></div></a></td>
            <td class="small muted">${escapeHTML(student.grade || '—')}</td>
            <td style="min-width:120px"><div class="row">
              <span class="small strong" style="min-width:34px">${student.attendanceRate}%</span>
              <div class="progress grow"><span style="width:${Math.min(100, student.attendanceRate)}%"></span></div></div>
              <div class="tiny muted">${student.attendance.present} حاضر · ${student.attendance.absent} غايب</div></td>
            <td class="num"><span class="money ${student.balance > 0 ? 'debt' : 'ok'}">${money(student.balance)}</span></td>
            <td class="small">${student.parentPhone ? `<span dir="ltr">${escapeHTML(student.parentPhone)}</span>` : '<span class="muted">—</span>'}</td>
            <td class="end"><div class="row" style="justify-content:flex-end;gap:4px">
              <button class="icon-btn" data-remind="${student.id}" title="تذكير بالفلوس">${icon('message')}</button>
              <button class="icon-btn" data-pay="${student.id}" title="تسجيل دفعة">${icon('wallet')}</button>
              <button class="icon-btn" data-remove="${student.id}" title="إخراج من المجموعة">${icon('x')}</button>
            </div></td>
          </tr>`).join('')}</tbody>
        </table></div>`
      : emptyHTML('users', 'مفيش طلبة في المجموعة', 'ضُم أول طالب عشان الحصص والاشتراكات تتحسب.')}
  </section>`;
}

function lessonsHTML(data) {
  const lessons = data.lessons || [];
  return `<section class="card">
    <div class="card-head">
      <div><h2>الحصص</h2><div class="sub">${lessons.length} حصة مسجلة للمجموعة</div></div>
      <div class="row">
        <a class="btn secondary sm" href="#/calendar">${icon('calendar')}الجدول</a>
        <button class="btn soft sm" data-generate>${icon('refresh')}توليد حصص</button>
        <button class="btn sm" data-add-lesson>${icon('plus')}حصة</button>
      </div>
    </div>
    ${lessons.length
      ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>التاريخ</th><th>الوقت</th><th>الموضوع</th><th>الحالة</th><th></th></tr></thead>
          <tbody>${lessons.map((lesson) => `<tr>
            <td class="small"><div class="strong">${escapeHTML(dateShort(lesson.date))}</div>
              <div class="tiny muted">${escapeHTML(relativeDay(lesson.date))}</div></td>
            <td class="small nowrap">${escapeHTML(timeLabel(lesson.start))}</td>
            <td class="small">${escapeHTML(lesson.topic || '—')}</td>
            <td>${statusBadge(lesson.status)}</td>
            <td class="end"><a class="btn xs secondary" href="#/lessons/${lesson.id}">فتح</a></td>
          </tr>`).join('')}</tbody>
        </table></div>`
      : emptyHTML('calendar', 'مفيش حصص', 'ولّد حصص الأسبوع من مواعيد المجموعة بضغطة.')}
  </section>`;
}

function assignmentsHTML(data) {
  const assignments = data.assignments || [];
  return `<section class="card">
    <div class="card-head">
      <div><h2>الواجبات</h2><div class="sub">${assignments.length} واجب وامتحان</div></div>
      <a class="btn sm" href="#/assignments?new=1&groupId=${data.id}">${icon('plus')}واجب جديد</a>
    </div>
    ${assignments.length
      ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>الواجب</th><th>النوع</th><th>التسليم</th><th>التصحيح</th><th class="num">المتوسط</th><th></th></tr></thead>
          <tbody>${assignments.map((assignment) => `<tr>
            <td><div class="strong small">${escapeHTML(assignment.title)}</div>
              <div class="tiny muted">${escapeHTML(assignment.description || '')}</div></td>
            <td class="small">${escapeHTML(ASSIGNMENT_LABELS[assignment.type] || assignment.type)}</td>
            <td class="small nowrap">${escapeHTML(dateShort(assignment.dueDate))}</td>
            <td style="min-width:130px"><div class="row-between tiny"><span>${assignment.gradedCount} من ${data.studentCount}</span>
              <span class="muted">${statusBadge(assignment.status)}</span></div>
              <div class="progress mt-1"><span style="width:${data.studentCount ? Math.round((assignment.gradedCount / data.studentCount) * 100) : 0}%"></span></div></td>
            <td class="num strong">${assignment.average || 0}</td>
            <td class="end"><a class="btn xs secondary" href="#/assignments/${assignment.id}">تصحيح</a></td>
          </tr>`).join('')}</tbody>
        </table></div>`
      : emptyHTML('clipboard', 'مفيش واجبات', 'ضيف واجب للمجموعة وابدأ التصحيح.')}
  </section>`;
}

function materialsHTML(data) {
  const materials = data.materials || [];
  return `<section class="card">
    <div class="card-head">
      <div><h2>مواد المجموعة</h2><div class="sub">${materials.length} مادة في المكتبة</div></div>
      <a class="btn sm" href="#/materials?new=1&groupId=${data.id}">${icon('plus')}إضافة مادة</a>
    </div>
    ${materials.length
      ? `<div class="stack-list">${materials.map((material) => `<div class="list-row">
          <span class="alert-icon info" style="width:32px;height:32px">${icon(MATERIAL_ICONS[material.type] || 'file')}</span>
          <div class="list-main"><div class="list-title">${escapeHTML(material.title)}</div>
            <div class="list-sub truncate">${escapeHTML(material.description || '')}</div></div>
          ${material.url ? `<a class="btn xs secondary" href="${escapeHTML(material.url)}" target="_blank" rel="noopener">فتح</a>` : ''}
        </div>`).join('')}</div>`
      : emptyHTML('folder', 'مفيش مواد', 'ضيف ملزمة أو رابط أو ملاحظة لكل الطلبة.')}
  </section>`;
}

function detailsHTML(data) {
  const rows = [
    ['المادة', data.subject],
    ['الصف', data.level || '—'],
    ['النوع', data.type === 'individual' ? 'فردي' : 'مجموعة'],
    ['القاعة', data.room || '—'],
    ['السعر الشهري', data.price ? money(data.price) : 'من غير سعر'],
    ['طريقة الدفع', data.billing === 'per_lesson' ? 'بالحصة' : 'شهري'],
    ['الطاقة', data.capacity ? `${data.studentCount} من ${data.capacity}` : 'مفتوحة'],
    ['تاريخ البداية', data.startDate ? dateFull(data.startDate) : '—'],
    ['المواعيد', scheduleText(data.schedule) || 'مفيش مواعيد'],
  ];
  return `<div class="grid grid-2">
    <section class="card">
      <div class="card-head"><div><h2>بيانات المجموعة</h2><div class="sub">كل تفاصيل المجموعة في مكان واحد</div></div></div>
      <div class="kv-list">${rows.map(([label, value]) => `<div class="kv-row"><span class="k">${escapeHTML(label)}</span><span class="v">${escapeHTML(value)}</span></div>`).join('')}</div>
    </section>
    <section class="card">
      <div class="card-head"><div><h2>الوصف والحساب</h2><div class="sub">ملاحظات وإجماليات المجموعة</div></div>${ringHTML(data.attendanceRate)}</div>
      <p class="small" style="color:var(--ink-2);line-height:1.9">${escapeHTML(data.description || 'مفيش وصف مكتوب للمجموعة.')}</p>
      <div class="stat-row mt-3" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <div class="stat-mini"><div class="lbl">إجمالي المستحق</div><div class="val money">${money(data.finances.charged)}</div></div>
        <div class="stat-mini"><div class="lbl">المحصّل</div><div class="val money ok">${money(data.finances.paid)}</div></div>
        <div class="stat-mini"><div class="lbl">متأخرات</div><div class="val money debt">${money(data.finances.balance)}</div></div>
      </div>
      <div class="tiny muted mt-3">اتعملت في ${escapeHTML(dateFull(String(data.createdAt || '').slice(0, 10)))}</div>
    </section>
  </div>`;
}

export async function render(ctx) {
  const data = await api.get(`/api/groups/${ctx.params.id}`);
  profile = data;
  const query = ctx.query || new URLSearchParams();
  const tabs = ['roster', 'lessons', 'assignments', 'materials', 'details'];
  const activeTab = tabs.includes(query.get('tab')) ? query.get('tab') : 'roster';
  ctx.setTitle(data.name, 'المجموعة');

  return `<div class="page">
    <div class="page-head">
      <div class="profile-head" style="flex:1">
        <div class="profile-id">
          <span class="brand-mark" style="background:${escapeHTML(data.color || 'var(--teal)')};color:#fff;border-radius:16px">${escapeHTML((data.subject || 'م').slice(0, 1))}</span>
          <div style="min-width:0">
            <div class="row" style="gap:8px;flex-wrap:wrap">
              <h1>${escapeHTML(data.name)}</h1>
              ${statusBadge(data.status)}
              ${data.type === 'individual' ? '<span class="badge plum">فردي</span>' : ''}
            </div>
            <div class="profile-meta">
              <span>${icon('book')}${escapeHTML(data.subject)}${data.level ? ` · ${escapeHTML(data.level)}` : ''}</span>
              ${data.room ? `<span>${icon('home')}${escapeHTML(data.room)}</span>` : ''}
              <span>${icon('clock')}${escapeHTML(scheduleText(data.schedule)) || 'مفيش مواعيد'}</span>
              ${data.nextLesson ? `<span>${icon('calendar')}الجاية ${escapeHTML(relativeDay(data.nextLesson.date))} ${escapeHTML(timeLabel(data.nextLesson.start))}</span>` : ''}
            </div>
          </div>
        </div>
      </div>
      <div class="page-actions">
        <button class="btn secondary" data-edit>${icon('edit')}تعديل</button>
        <button class="btn secondary" data-print-roster>${icon('print')}كشف الطلبة</button>
        <button class="btn secondary" data-remind-all>${icon('message')}تذكير</button>
        <button class="btn" data-add-lesson>${icon('plus')}حصة</button>
      </div>
    </div>

    <div class="stat-row" style="margin:16px 0">
      <div class="stat-mini"><div class="lbl">الطلبة</div><div class="val">${data.studentCount}${data.capacity ? ` <small>من ${data.capacity}</small>` : ''}</div></div>
      <div class="stat-mini"><div class="lbl">نسبة الحضور</div><div class="val">${data.attendanceRate}% <small>${data.attendance.total} تسجيل</small></div></div>
      <div class="stat-mini"><div class="lbl">متأخرات المجموعة</div><div class="val money ${data.finances.balance > 0 ? 'debt' : 'ok'}">${money(data.finances.balance)}</div></div>
      <div class="stat-mini"><div class="lbl">الدخل الشهري المتوقع</div><div class="val money">${money(data.studentCount * Number(data.price || 0))}</div></div>
    </div>

    <div class="tabs" style="margin-bottom:14px">
      ${tabButton('roster', 'الطلبة', data.roster.length, activeTab === 'roster')}
      ${tabButton('lessons', 'الحصص', data.lessons.length, activeTab === 'lessons')}
      ${tabButton('assignments', 'الواجبات', data.assignments.length, activeTab === 'assignments')}
      ${tabButton('materials', 'المواد', data.materials.length, activeTab === 'materials')}
      ${tabButton('details', 'التفاصيل', null, activeTab === 'details')}
    </div>

    <div data-pane="roster" ${activeTab === 'roster' ? '' : 'hidden'}>${rosterHTML(data)}</div>
    <div data-pane="lessons" ${activeTab === 'lessons' ? '' : 'hidden'}>${lessonsHTML(data)}</div>
    <div data-pane="assignments" ${activeTab === 'assignments' ? '' : 'hidden'}>${assignmentsHTML(data)}</div>
    <div data-pane="materials" ${activeTab === 'materials' ? '' : 'hidden'}>${materialsHTML(data)}</div>
    <div data-pane="details" ${activeTab === 'details' ? '' : 'hidden'}>${detailsHTML(data)}</div>

    ${ctx.user.role === 'admin' ? `<section class="card mt-3" style="border-color:color-mix(in srgb,var(--coral) 35%,var(--line))">
      <div class="card-head"><div><h2>منطقة خطر</h2><div class="sub">حذف المجموعة بيمسح حصصها وواجباتها وموادها.</div></div>
        <button class="btn danger sm" data-delete>${icon('trash')}حذف المجموعة</button></div>
    </section>` : ''}
  </div>`;
}

export async function mount(root, ctx) {
  if (!profile) return;
  const group = profile;

  root.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b === button));
      root.querySelectorAll('[data-pane]').forEach((pane) => {
        pane.hidden = pane.dataset.pane !== button.dataset.tab;
      });
      const next = `#/groups/${group.id}?tab=${button.dataset.tab}`;
      if (location.hash !== next) history.replaceState(null, '', next);
    });
  });

  const refresh = () => ctx.refresh();

  root.querySelector('[data-edit]')?.addEventListener('click', () => {
    groupModal({ group, onSaved: refresh });
  });

  root.querySelectorAll('[data-add-lesson]').forEach((button) => {
    button.addEventListener('click', () => lessonModal({ groupId: group.id, onSaved: refresh }));
  });

  root.querySelectorAll('[data-add-student]').forEach((button) => {
    button.addEventListener('click', async () => {
      const students = await loadStudents(true);
      const enrolled = new Set((group.roster || []).map((s) => s.id));
      const available = students.filter((s) => !enrolled.has(s.id));
      if (!available.length) {
        toast('كل الطلبة مضافين للمجموعة', 'info');
        return;
      }
      formModal({
        title: 'ضم طالب للمجموعة',
        sub: `اختار طالب يضاف لمجموعة ${group.name}.`,
        fields: [
          {
            name: 'studentId',
            label: 'الطالب',
            type: 'select',
            required: true,
            span: 2,
            options: available.map((s) => ({
              value: s.id,
              label: `${s.name}${s.grade ? ` — ${s.grade}` : ''}`,
            })),
          },
        ],
        values: { studentId: available[0].id },
        submitText: 'ضم للمجموعة',
        onSubmit: async (values) => {
          await api.post(`/api/groups/${group.id}/enrollments`, values);
          toast('الطالب انضم للمجموعة');
          clearCaches();
          refresh();
        },
      });
    });
  });

  root.querySelectorAll('[data-remove]').forEach((button) => {
    button.addEventListener('click', () => {
      deleteConfirm({
        title: 'إخراج من المجموعة',
        message: 'الطالب هيخرج من المجموعة، لكن بياناته وحسابه هيفضلوا محفوظين.',
        confirmText: 'أيوه، أخرجه',
        onConfirm: async () => {
          await api.delete(`/api/groups/${group.id}/enrollments/${button.dataset.remove}`);
          clearCaches();
          refresh();
        },
      });
    });
  });

  root.querySelectorAll('[data-pay]').forEach((button) => {
    button.addEventListener('click', () => {
      paymentModal({ studentId: button.dataset.pay, onSaved: refresh });
    });
  });

  root.querySelectorAll('[data-remind]').forEach((button) => {
    button.addEventListener('click', () => reminderModal(button.dataset.remind, 'payment'));
  });

  root.querySelectorAll('[data-remind-all]').forEach((button) => {
    button.addEventListener('click', () => openReminders(group, refresh));
  });

  root.querySelectorAll('[data-generate]').forEach((button) => {
    button.addEventListener('click', () => {
      formModal({
        title: 'توليد حصص من المواعيد',
        sub: 'هيتم إنشاء الحصص حسب مواعيد المجموعة الأسبوعية، من غير تكرار.',
        fields: [
          { name: 'from', label: 'ابتداءً من', type: 'date', required: true },
          { name: 'weeks', label: 'عدد الأسابيع', type: 'number', min: 1, max: 26, required: true, help: 'من أسبوع لـ ٢٦ أسبوع' },
        ],
        values: { from: new Date().toISOString().slice(0, 10), weeks: 4 },
        submitText: 'ولّد الحصص',
        onSubmit: async (values) => {
          const data = await api.post(`/api/groups/${group.id}/lessons/generate`, values);
          toast(`اتعملت ${data.created} حصة جديدة`);
          refresh();
        },
      });
    });
  });

  root.querySelector('[data-delete]')?.addEventListener('click', () => {
    confirmModal({
      title: 'حذف المجموعة نهائي',
      message: `هتتمسح مجموعة ${group.name} وكل حصصها وواجباتها وموادها وارتباطاتها. الخطوة دي مش بترجع.`,
      danger: true,
      confirmText: 'أيوه، امسح المجموعة',
      onConfirm: async () => {
        await api.delete(`/api/groups/${group.id}`);
        toast('تم حذف المجموعة');
        location.hash = '#/groups';
      },
    });
  });

  root.querySelector('[data-print-roster]')?.addEventListener('click', () => printRoster(group, ctx.settings));
}

async function openReminders(group, refresh) {
  const data = await api.get(`/api/groups/${group.id}/reminders?kind=payment`);
  const reminders = data.reminders || [];
  if (!reminders.length) {
    toast('مفيش طلبة في المجموعة', 'info');
    return;
  }
  openModal({
    title: 'تذكير الجميع بالفلوس',
    sub: `${reminders.length} رسالة جاهزة — ابعت اللي تحبه على واتساب.`,
    wide: true,
    body: reminders.length
      ? `<div class="stack-list">${reminders.map((row, index) => `<div class="card flat" style="padding:12px">
          <div class="row-between" style="align-items:flex-start">
            <div><div class="strong small">${escapeHTML(row.student.name)}</div>
              <div class="tiny muted">${row.balance > 0 ? `عليه ${money(row.balance)}` : 'حسابه مظبوط'}</div></div>
            <div class="row" style="gap:5px">
              <button class="btn xs secondary" data-copy="${index}">${icon('copy')}نسخ</button>
              <a class="btn xs" href="${escapeHTML(row.whatsapp)}" target="_blank" rel="noopener">${icon('message')}واتساب</a>
            </div>
          </div>
          <div class="tiny mt-2" style="color:var(--ink-2);line-height:1.9;background:var(--surface-2);border-radius:9px;padding:8px 10px">${escapeHTML(row.message)}</div>
        </div>`).join('')}</div>`
      : emptyHTML('message', 'مفيش رسائل', ''),
    onMount: ({ body }) => {
      body.querySelectorAll('[data-copy]').forEach((button) => {
        button.addEventListener('click', async () => {
          const row = reminders[Number(button.dataset.copy)];
          try {
            await navigator.clipboard.writeText(row.message);
            toast('الرسالة اتنسخت');
          } catch {
            toast('مش قادر أنسخ دلوقتي', 'error');
          }
        });
      });
    },
  });
}

function printRoster(group, settings) {
  const rows = (group.roster || [])
    .map(
      (student) => `<tr><td>${escapeHTML(student.name)}</td><td>${escapeHTML(student.grade || '')}</td>
      <td>${escapeHTML(student.phone || '')}</td><td>${escapeHTML(student.parentPhone || '')}</td>
      <td>${student.attendanceRate}%</td><td>${money(student.balance)}</td></tr>`,
    )
    .join('');
  printHTML(`<div class="print-sheet">
    <div class="print-head">
      <div><h1 style="margin:0;font-size:22px">${escapeHTML(settings.centerName || 'دفتري')}</h1>
        <div style="font-size:12px;color:#555;margin-top:4px">كشف طلبة ${escapeHTML(group.name)} — ${escapeHTML(group.subject)}</div></div>
      <div style="font-size:11px;text-align:end">${escapeHTML(dateFull(new Date().toISOString().slice(0, 10)))}</div>
    </div>
    <table class="print-table"><thead><tr><th>الطالب</th><th>الصف</th><th>الموبايل</th><th>ولي الأمر</th><th>الحضور</th><th>المتبقي</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">مفيش طلبة</td></tr>'}</tbody></table>
    <div class="print-totals"><span>عدد الطلبة ${group.roster.length}</span><span>إجمالي المتأخرات ${money(group.finances.balance)}</span></div>
  </div>`);
}
