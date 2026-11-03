'use strict';

import {
  api,
  money,
  dateFull,
  dateShort,
  relativeDay,
  timeLabel,
  todayISO,
  escapeHTML,
  statusBadge,
  attendanceBadge,
  METHOD_LABELS,
  ASSIGNMENT_LABELS,
} from '../api.js';
import {
  icon,
  avatarHTML,
  ringHTML,
  toast,
  emptyHTML,
  formModal,
  confirmModal,
} from '../ui.js';
import {
  studentModal,
  paymentModal,
  chargeModal,
  reminderModal,
  printStatement,
  loadGroups,
  deleteConfirm,
  receiptModal,
} from '../forms.js';
import { DAYS } from '../api.js';

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

function ledgerHTML(data) {
  const rows = data.ledger || [];
  const payments = data.payments || [];
  return `<div class="grid" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)">
    <section class="card">
      <div class="card-head">
        <div><h2>كشف الحساب</h2><div class="sub">${rows.filter((r) => !r.settled).length} مستحق لسه مفتوح</div></div>
        <div class="row">
          <button class="btn soft sm" data-add-charge>${icon('plus')}مستحق</button>
          <button class="btn sm" data-pay>${icon('wallet')}دفعة</button>
        </div>
      </div>
      ${rows.length
        ? `<div class="table-wrap"><table class="table">
            <thead><tr><th>البيان</th><th>الاستحقاق</th><th class="num">المبلغ</th><th class="num">مدفوع</th><th class="num">متبقي</th><th></th></tr></thead>
            <tbody>${rows.map((row) => `<tr>
              <td><div class="strong small">${escapeHTML(row.title)}</div>
                <div class="tiny muted">${escapeHTML(row.type === 'subscription' ? 'اشتراك' : row.type === 'material' ? 'ملازم' : row.type === 'exam' ? 'امتحان' : 'مستحق')}${row.month ? ` · ${escapeHTML(row.month)}` : ''}</div></td>
              <td class="small">${escapeHTML(dateShort(row.dueDate))}</td>
              <td class="num">${money(row.amount)}</td>
              <td class="num">${money(row.paidAmount)}</td>
              <td class="num money ${row.remaining > 0 ? 'debt' : 'ok'}">${money(row.remaining)}</td>
              <td class="end">${row.settled ? '<span class="badge green">مسدد</span>' : `<button class="btn xs secondary" data-pay-charge="${row.id}">تحصيل</button>`}</td>
            </tr>`).join('')}</tbody>
            <tfoot><tr><td colspan="2" class="strong">الإجمالي</td><td class="num strong">${money(data.charged)}</td><td class="num strong">${money(data.paid)}</td><td class="num strong ${data.balance > 0 ? 'debt' : 'ok'}">${money(data.balance)}</td><td></td></tr></tfoot>
          </table></div>`
        : emptyHTML('receipt', 'مفيش مستحقات', 'لسه مفيش أي مبلغ مسجل على الطالب.')}
      ${data.credit > 0 ? `<div class="demo-box mt-3" style="margin-bottom:0">عند الطالب رصيد زيادة <b>${money(data.credit)}</b> هيتخصم من المستحقات الجديدة.</div>` : ''}
    </section>

    <section class="card">
      <div class="card-head">
        <div><h2>الدفعات</h2><div class="sub">${payments.length} دفعة مسجلة</div></div>
        <button class="btn soft sm" data-pay>${icon('plus')}دفعة</button>
      </div>
      ${payments.length
        ? `<div class="list">${payments.map((payment) => `<button class="list-row" data-receipt="${payment.id}" style="text-align:start;background:none;border:0;width:100%;font:inherit;color:inherit">
            <span class="alert-icon info" style="width:30px;height:30px">${icon('wallet')}</span>
            <div class="list-main"><div class="list-title">${money(payment.amount)}</div>
              <div class="list-sub">${escapeHTML(payment.receiptNo)} · ${escapeHTML(METHOD_LABELS[payment.method] || payment.method)}</div></div>
            <div class="list-end"><div class="small strong">${escapeHTML(relativeDay(payment.date))}</div>
              <div class="tiny muted">${icon('receipt')}</div></div>
          </button>`).join('')}</div>`
        : emptyHTML('wallet', 'مفيش دفعات', 'أول دفعة هتتسجل هنا مع رقم إيصال.')}
    </section>
  </div>`;
}

function attendanceHTML(data) {
  const rows = data.attendance || [];
  return `<section class="card">
    <div class="card-head">
      <div><h2>سجل الحضور</h2><div class="sub">${rows.length} حصة مسجلة · نسبة الحضور ${data.attendanceRate}%</div></div>
      ${ringHTML(data.attendanceRate)}
    </div>
    ${rows.length
      ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>التاريخ</th><th>المجموعة</th><th>الموضوع</th><th>الحضور</th><th>ملاحظة</th></tr></thead>
          <tbody>${rows.map((row) => `<tr>
            <td class="small">${escapeHTML(dateShort(row.date))}</td>
            <td><span class="chip"><span class="dot" style="--c:${escapeHTML(row.groupColor || 'var(--teal)')}"></span>${escapeHTML(row.groupName || '—')}</span></td>
            <td class="small muted">${escapeHTML(row.topic || '—')}</td>
            <td>${attendanceBadge(row.status)}</td>
            <td class="small muted">${escapeHTML(row.note || '—')}</td>
          </tr>`).join('')}</tbody>
        </table></div>`
      : emptyHTML('calendar', 'مفيش حضور لسه', 'أول ما تحضّر حصة هتظهر هنا بالتفصيل.')}
  </section>`;
}

function gradesHTML(data) {
  const grades = data.grades || [];
  const average = grades.length
    ? Math.round(grades.reduce((total, g) => total + (Number(g.percent) || 0), 0) / grades.length)
    : 0;
  return `<section class="card">
    <div class="card-head">
      <div><h2>الدرجات</h2><div class="sub">${grades.length} واجب/امتحان مصحح</div></div>
      <div class="row">${ringHTML(average, 'sm')}<a class="btn soft sm" href="#/assignments">${icon('clipboard')}الواجبات</a></div>
    </div>
    ${grades.length
      ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>الواجب</th><th>النوع</th><th>المجموعة</th><th>الدرجة</th><th>النسبة</th><th>تعليق</th></tr></thead>
          <tbody>${grades.map((g) => `<tr>
            <td><div class="strong small">${escapeHTML(g.title)}</div><div class="tiny muted">${escapeHTML(dateShort(g.dueDate || ''))}</div></td>
            <td class="small">${escapeHTML(ASSIGNMENT_LABELS[g.type] || g.type || '—')}</td>
            <td class="small muted">${escapeHTML(g.groupName || '—')}</td>
            <td class="num strong">${g.score} <span class="muted tiny">/ ${g.maxScore}</span></td>
            <td style="min-width:120px"><div class="row"><span class="small strong" style="min-width:38px">${Math.round(g.percent)}%</span>
              <div class="progress grow"><span style="width:${Math.min(100, Math.round(g.percent))}%"></span></div></div></td>
            <td class="small muted">${escapeHTML(g.feedback || '—')}</td>
          </tr>`).join('')}</tbody>
        </table></div>`
      : emptyHTML('award', 'مفيش درجات', 'لسه مفيش واجبات مصححة للطالب.')}
  </section>`;
}

function notesHTML(data) {
  const notes = data.notes || [];
  return `<section class="card">
    <div class="card-head">
      <div><h2>ملاحظات المتابعة</h2><div class="sub">${notes.length} ملاحظة · المثبت فوق</div></div>
      <button class="btn sm" data-add-note>${icon('plus')}ملاحظة</button>
    </div>
    ${notes.length
      ? notes.map((note) => `<div class="note ${note.pinned ? 'pinned' : ''}">
          <div>${escapeHTML(note.body)}</div>
          <div class="note-meta">
            ${note.pinned ? `<span class="badge amber">${icon('pin')}مثبتة</span>` : ''}
            <span>${escapeHTML(relativeDay(String(note.createdAt).slice(0, 10)))}</span>
            <span class="grow"></span>
            <button class="icon-btn" data-pin-note="${note.id}" data-pinned="${note.pinned ? '1' : '0'}" title="${note.pinned ? 'فك التثبيت' : 'تثبيت'}">${icon('pin')}</button>
            <button class="icon-btn" data-edit-note="${note.id}" title="تعديل">${icon('edit')}</button>
            <button class="icon-btn" data-del-note="${note.id}" title="حذف">${icon('trash')}</button>
          </div>
        </div>`).join('')
      : emptyHTML('note', 'مفيش ملاحظات', 'اكتب ملاحظة عن المستوى، السلوك، أو أي متابعة محتاجة.')}
  </section>`;
}

function groupsHTML(data) {
  const groups = data.groups || [];
  return `<section class="card">
    <div class="card-head">
      <div><h2>المجموعات</h2><div class="sub">${groups.length} مجموعة مسجل فيها</div></div>
      <button class="btn sm" data-add-group>${icon('plus')}ضم لمجموعة</button>
    </div>
    ${groups.length
      ? `<div class="student-grid">${groups.map((group) => `<div class="card">
          <div class="row-between">
            <a class="row" href="#/groups/${group.id}" style="color:inherit">
              <span class="group-dot" style="background:${escapeHTML(group.color)}"></span>
              <div><div class="strong small">${escapeHTML(group.name)}</div><div class="tiny muted">${escapeHTML(group.subject || '')}${group.level ? ` · ${escapeHTML(group.level)}` : ''}</div></div>
            </a>
            <a class="icon-btn" href="#/groups/${group.id}" aria-label="فتح المجموعة">${icon('chevronLeft')}</a>
          </div>
          <div class="row-between mt-2">
            <span class="tiny muted">${group.studentCount} طالب${group.price ? ` · ${money(group.price)} شهرياً` : ''}</span>
            <button class="btn xs danger" data-remove-group="${group.id}">إخراج</button>
          </div>
          <div class="tiny muted mt-1">${escapeHTML(scheduleText(group.schedule)) || 'مفيش مواعيد'}</div>
        </div>`).join('')}</div>`
      : emptyHTML('grid', 'مش في مجموعة', 'ضُم الطالب لمجموعة عشان الحصص والاشتراكات تتحسب لوحدها.')}
  </section>`;
}

function upcomingHTML(data) {
  const lessons = data.upcoming || [];
  return `<section class="card">
    <div class="card-head">
      <div><h2>الحصص الجاية</h2><div class="sub">${lessons.length} حصة قادمة</div></div>
      <a class="card-link" href="#/calendar">الجدول ${icon('arrowLeft')}</a>
    </div>
    ${lessons.length
      ? `<div class="timeline">${lessons.map((lesson) => `<a class="timeline-row" href="#/lessons/${lesson.id}" style="color:inherit">
          <div class="timeline-time">${escapeHTML(timeLabel(lesson.start))}<small>${escapeHTML(dateShort(lesson.date))}</small></div>
          <div class="timeline-body"><div class="timeline-title">${escapeHTML(lesson.groupName || 'حصة')}</div>
            <div class="timeline-sub">${escapeHTML(lesson.topic || '')}</div></div>
          <div class="timeline-end">${statusBadge(lesson.status)}</div>
        </a>`).join('')}</div>`
      : emptyHTML('calendar', 'مفيش حصص جاية', 'الحصص الجديدة بتظهر هنا أول ما تتجدول.')}
  </section>`;
}

export async function render(ctx) {
  const data = await api.get(`/api/students/${ctx.params.id}`);
  profile = data;
  const query = ctx.query || new URLSearchParams();
  const activeTab = ['statement', 'attendance', 'grades', 'notes', 'groups', 'upcoming'].includes(query.get('tab'))
    ? query.get('tab')
    : 'statement';
  ctx.setTitle(data.name, 'ملف الطالب');

  const balanceClass = data.balance > 0 ? 'debt' : data.balance < 0 ? 'ok' : 'zero';
  const groups = data.groups || [];
  const admin = ctx.user.role === 'admin';

  return `<div class="page">
    <div class="page-head">
      <div class="profile-head" style="flex:1">
        <div class="profile-id">
          ${avatarHTML(data.name, data.avatarColor, 'xl')}
          <div style="min-width:0">
            <div class="row" style="gap:8px;flex-wrap:wrap">
              <h1>${escapeHTML(data.name)}</h1>
              ${statusBadge(data.status)}
              ${data.balance > 0 ? '<span class="badge red dot">عليه فلوس</span>' : ''}
            </div>
            <div class="profile-meta">
              ${data.grade ? `<span>${icon('book')}${escapeHTML(data.grade)}</span>` : ''}
              ${data.school ? `<span>${icon('home')}${escapeHTML(data.school)}</span>` : ''}
              ${data.phone ? `<span dir="ltr">${icon('phone')}<a href="tel:${escapeHTML(data.phone)}">${escapeHTML(data.phone)}</a></span>` : ''}
              ${data.parentName ? `<span>${icon('user')}ولي الأمر: ${escapeHTML(data.parentName)}</span>` : ''}
              ${data.parentPhone ? `<span dir="ltr">${icon('phone')}<a href="tel:${escapeHTML(data.parentPhone)}">${escapeHTML(data.parentPhone)}</a></span>` : ''}
              <span>${icon('calendar')}انضم ${escapeHTML(dateShort(data.joinedAt))}</span>
              ${groups.length ? `<span>${icon('grid')}${groups.map((g) => escapeHTML(g.name)).join(' · ')}</span>` : ''}
            </div>
          </div>
        </div>
      </div>
      <div class="page-actions">
        ${data.status !== 'active' ? `<button class="btn secondary" data-reenroll>${icon('refresh')}إعادة تفعيل</button>` : ''}
        <button class="btn secondary" data-reminder="payment">${icon('message')}تذكير</button>
        <button class="btn secondary" data-print>${icon('print')}كشف حساب</button>
        <button class="btn secondary" data-edit>${icon('edit')}تعديل</button>
        <button class="btn" data-pay>${icon('wallet')}تسجيل دفعة</button>
      </div>
    </div>

    <div class="stat-row my-3" style="margin-top:16px;margin-bottom:16px">
      <div class="stat-mini"><div class="lbl">المتبقي على الطالب</div><div class="val money ${balanceClass}">${money(data.balance)}</div></div>
      <div class="stat-mini"><div class="lbl">إجمالي المستحق</div><div class="val">${money(data.charged)}</div></div>
      <div class="stat-mini"><div class="lbl">إجمالي المدفوع</div><div class="val" style="color:var(--teal)">${money(data.paid)}</div></div>
      <div class="stat-mini"><div class="lbl">نسبة الحضور</div><div class="val">${data.attendanceRate}% <small>${data.attendance.length} حصة</small></div></div>
    </div>

    <div class="tabs" style="margin-bottom:14px">
      ${tabButton('statement', 'الحساب', data.ledger.length, activeTab === 'statement')}
      ${tabButton('attendance', 'الحضور', data.attendance.length, activeTab === 'attendance')}
      ${tabButton('grades', 'الدرجات', data.grades.length, activeTab === 'grades')}
      ${tabButton('notes', 'ملاحظات', data.notes.length, activeTab === 'notes')}
      ${tabButton('groups', 'المجموعات', groups.length, activeTab === 'groups')}
      ${tabButton('upcoming', 'حصص جاية', data.upcoming.length, activeTab === 'upcoming')}
    </div>

    <div data-pane="statement" ${activeTab === 'statement' ? '' : 'hidden'}>${ledgerHTML(data)}</div>
    <div data-pane="attendance" ${activeTab === 'attendance' ? '' : 'hidden'}>${attendanceHTML(data)}</div>
    <div data-pane="grades" ${activeTab === 'grades' ? '' : 'hidden'}>${gradesHTML(data)}</div>
    <div data-pane="notes" ${activeTab === 'notes' ? '' : 'hidden'}>${notesHTML(data)}</div>
    <div data-pane="groups" ${activeTab === 'groups' ? '' : 'hidden'}>${groupsHTML(data)}</div>
    <div data-pane="upcoming" ${activeTab === 'upcoming' ? '' : 'hidden'}>${upcomingHTML(data)}</div>

    ${admin ? `<section class="card mt-3" style="border-color:color-mix(in srgb,var(--coral) 35%,var(--line))">
      <div class="card-head"><div><h2>منطقة خطر</h2><div class="sub">حذف الطالب بيمسح كل حاجته نهائي.</div></div>
        <button class="btn danger sm" data-delete>${icon('trash')}حذف الطالب</button></div>
    </section>` : ''}
  </div>`;
}

export async function mount(root, ctx) {
  if (!profile) return;
  const student = profile;

  root.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b === button));
      root.querySelectorAll('[data-pane]').forEach((pane) => {
        pane.hidden = pane.dataset.pane !== button.dataset.tab;
      });
      const next = `#/students/${student.id}?tab=${button.dataset.tab}`;
      if (location.hash !== next) history.replaceState(null, '', next);
    });
  });

  const refresh = () => ctx.refresh();

  root.querySelector('[data-edit]')?.addEventListener('click', () => {
    studentModal({ student, onSaved: refresh });
  });

  root.querySelectorAll('[data-pay], [data-pay-charge]').forEach((button) => {
    button.addEventListener('click', () => {
      paymentModal({ studentId: student.id, onSaved: refresh });
    });
  });

  root.querySelectorAll('[data-add-charge]').forEach((button) => {
    button.addEventListener('click', () => {
      chargeModal({ studentId: student.id, onSaved: refresh });
    });
  });

  root.querySelector('[data-print]')?.addEventListener('click', () => printStatement(student.id));

  root.querySelector('[data-reminder]')?.addEventListener('click', () => {
    reminderModal(student.id, 'payment');
  });

  root.querySelector('[data-reenroll]')?.addEventListener('click', async () => {
    try {
      await api.post(`/api/students/${student.id}/reenroll`);
      toast('تم إعادة تفعيل الطالب');
      refresh();
    } catch {
      /* handled */
    }
  });

  root.querySelectorAll('[data-receipt]').forEach((button) => {
    button.addEventListener('click', () => {
      receiptModal(button.dataset.receipt);
    });
  });

  /* notes */
  const noteModal = (note = null) => {
    return formModal({
      title: note ? 'تعديل الملاحظة' : 'ملاحظة جديدة',
      sub: note ? 'عدّل نص الملاحظة.' : 'أي حاجة مهمة عن الطالب — المستوى، السلوك، أو اتفاق مع ولي الأمر.',
      fields: [
        { name: 'body', label: 'الملاحظة', type: 'textarea', rows: 5, span: 2, required: true, placeholder: 'اكتب الملاحظة…' },
        { name: 'pinned', label: 'ثبّت الملاحظة فوق', type: 'checkbox' },
      ],
      values: { body: note?.body || '', pinned: Boolean(note?.pinned) },
      submitText: note ? 'حفظ' : 'إضافة الملاحظة',
      onSubmit: async (values) => {
        if (note) await api.patch(`/api/students/${student.id}/notes/${note.id}`, values);
        else await api.post(`/api/students/${student.id}/notes`, values);
        toast(note ? 'تم تعديل الملاحظة' : 'تمت إضافة الملاحظة');
        refresh();
      },
    });
  };

  root.querySelector('[data-add-note]')?.addEventListener('click', () => noteModal());
  const notesData = student.notes || [];
  root.querySelectorAll('[data-edit-note]').forEach((button) => {
    button.addEventListener('click', () => {
      const note = notesData.find((n) => n.id === button.dataset.editNote);
      if (note) noteModal(note);
    });
  });
  root.querySelectorAll('[data-pin-note]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await api.patch(`/api/students/${student.id}/notes/${button.dataset.pinNote}`, {
          pinned: button.dataset.pinned !== '1',
        });
        toast('تم تحديث التثبيت');
        refresh();
      } catch {
        /* handled */
      }
    });
  });
  root.querySelectorAll('[data-del-note]').forEach((button) => {
    button.addEventListener('click', () => {
      deleteConfirm({
        title: 'حذف الملاحظة',
        message: 'الملاحظة هتتمسح نهائي. متأكد؟',
        onConfirm: async () => {
          await api.delete(`/api/students/${student.id}/notes/${button.dataset.delNote}`);
          refresh();
        },
      });
    });
  });

  /* enrollments */
  root.querySelector('[data-add-group]')?.addEventListener('click', async () => {
    const all = await loadGroups();
    const enrolled = new Set((student.groups || []).map((g) => g.id));
    const available = all.filter((g) => g.status !== 'archived' && !enrolled.has(g.id));
    if (!available.length) {
      toast('الطالب في كل المجموعات المتاحة', 'info');
      return;
    }
    formModal({
      title: 'ضم الطالب لمجموعة',
      sub: 'اختار المجموعة اللي الطالب هينضم لها.',
      fields: [
        {
          name: 'groupId',
          label: 'المجموعة',
          type: 'select',
          required: true,
          span: 2,
          options: available.map((g) => ({
            value: g.id,
            label: `${g.name} — ${g.subject}${g.capacity ? ` (${g.studentCount || 0}/${g.capacity})` : ''}`,
          })),
        },
        { name: 'joinedAt', label: 'تاريخ الانضمام', type: 'date', required: true },
      ],
      values: { groupId: available[0].id, joinedAt: todayISO() },
      submitText: 'ضم للمجموعة',
      onSubmit: async (values) => {
        await api.post(`/api/students/${student.id}/enrollments`, values);
        toast('الطالب انضم للمجموعة');
        refresh();
      },
    });
  });
  root.querySelectorAll('[data-remove-group]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      deleteConfirm({
        title: 'إخراج من المجموعة',
        message: 'الطالب هيخرج من المجموعة، بس بياناته وحسابه هيفضلوا محفوظين.',
        confirmText: 'أيوه، أخرجه',
        onConfirm: async () => {
          await api.delete(`/api/students/${student.id}/enrollments/${button.dataset.removeGroup}`);
          refresh();
        },
      });
    });
  });

  root.querySelector('[data-delete]')?.addEventListener('click', () => {
    confirmModal({
      title: 'حذف الطالب نهائي',
      message: `هتتمسح بيانات ${student.name} وكل حضوضه ومستحقاته ومدفوعاته ودرجاته. الخطوة دي مش بترجع.`,
      danger: true,
      confirmText: 'أيوه، امسح كل حاجة',
      onConfirm: async () => {
        await api.delete(`/api/students/${student.id}`);
        toast('تم حذف الطالب');
        location.hash = '#/students';
      },
    });
  });
}
