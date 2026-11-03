'use strict';

import { api, escapeHTML, dateFull, relativeDay, addDaysISO, todayISO, downloadURL, whatsappLink } from '../api.js';
import { icon, avatarHTML, emptyHTML } from '../ui.js';
import { loadGroups } from '../forms.js';

function summaryCard(label, value, iconName, color, soft) {
  return `<div class="kpi" style="--kpi:${color};--kpi-soft:${soft}">
    <div class="kpi-top"><span>${escapeHTML(label)}</span><span class="kpi-icon">${icon(iconName)}</span></div>
    <div class="kpi-value">${value}</div>
  </div>`;
}

export async function render(ctx) {
  const from = ctx.query.get('from') || addDaysISO(todayISO(), -60);
  const to = ctx.query.get('to') || todayISO();
  const groupId = ctx.query.get('groupId') || '';
  const params = new URLSearchParams({ from, to });
  if (groupId) params.set('groupId', groupId);
  const [data, groups] = await Promise.all([
    api.get(`/api/absence-archive?${params.toString()}`),
    loadGroups(),
  ]);

  return `<div class="page">
    <div class="page-head">
      <div><h1>أرشيف الغياب</h1><div class="sub">${data.counts.total} تسجيل · ${data.counts.absent} غياب · ${data.counts.late} تأخير</div></div>
      <div class="page-actions">
        <button class="btn secondary" data-export>${icon('download')}تصدير CSV</button>
        <a class="btn" href="#/scan">${icon('smartphone')}تحضير بالباركود</a>
      </div>
    </div>

    <div class="grid grid-4 mb-3">
      ${summaryCard('إجمالي التسجيلات', data.counts.total, 'archive', 'var(--teal)', 'var(--teal-soft)')}
      ${summaryCard('غياب', data.counts.absent, 'xCircle', 'var(--coral)', 'var(--coral-soft)')}
      ${summaryCard('تأخير', data.counts.late, 'clock', 'var(--saffron)', 'var(--saffron-soft)')}
      ${summaryCard('طلبة متأثرين', data.students.length, 'users', 'var(--blue)', 'var(--blue-soft)')}
    </div>

    <div class="card mb-3">
      <div class="toolbar">
        <div class="field-inline"><label>من</label><input class="input" type="date" value="${from}" data-from></div>
        <div class="field-inline"><label>لحد</label><input class="input" type="date" value="${to}" data-to></div>
        <div class="field-inline"><label>المجموعة</label>
          <select class="select" data-group>
            <option value="">كل المجموعات</option>
            ${groups.map((g) => `<option value="${g.id}" ${groupId === g.id ? 'selected' : ''}>${escapeHTML(g.name)}</option>`).join('')}
          </select>
        </div>
        <button class="btn secondary sm" data-apply>${icon('filter')}تطبيق</button>
      </div>
    </div>

    <div class="grid grid-2 mb-3">
      <section class="card">
        <div class="card-head"><div><h2>أكثر الطلبة غياباً</h2><div class="sub">ملخص لكل طالب في الفترة</div></div></div>
        ${data.students.length
          ? `<div class="stack-sm">${data.students.slice(0, 10).map((student) => `<div class="mini-rank" data-student="${student.studentId}">
              ${avatarHTML(student.fullName, student.avatarColor, 'sm')}
              <div class="grow"><div class="strong small truncate">${escapeHTML(student.name)}</div>
              <div class="tiny muted">${student.absent} غياب · ${student.late} تأخير</div></div>
              ${student.parentPhone ? `<a class="icon-btn" href="${whatsappLink(student.parentPhone, `سلام عليكم، بنطمّن على ${student.fullName}. غياب ${student.absent} حصة في الفترة الأخيرة.`)}" target="_blank" rel="noopener" title="واتساب ولي الأمر">${icon('message')}</a>` : ''}
              <span class="badge ${student.total >= 4 ? 'red' : 'amber'}">${student.total}</span>
            </div>`).join('')}</div>`
          : emptyHTML('checkCircle', 'مفيش غياب', 'كل الطلبة منتظمين في الفترة دي.')}
      </section>

      <section class="card">
        <div class="card-head"><div><h2>توزيع الغياب</h2><div class="sub">حسب المجموعة</div></div></div>
        ${data.rows.length
          ? `<div class="stack-sm">${Object.values(
              data.rows.reduce((acc, row) => {
                const key = row.groupId;
                acc[key] = acc[key] || { name: row.groupName, color: row.groupColor, absent: 0, late: 0 };
                acc[key][row.status] += 1;
                return acc;
              }, {}),
            )
              .sort((a, b) => b.absent + b.late - (a.absent + a.late))
              .map((group) => {
                const total = group.absent + group.late;
                return `<div class="bar-row">
                  <span class="group-dot" style="background:${escapeHTML(group.color)}"></span>
                  <div class="grow"><div class="row-between"><span class="small strong">${escapeHTML(group.name)}</span>
                    <span class="tiny muted">${group.absent} غياب · ${group.late} تأخير</span></div>
                    <div class="progress thin"><span style="width:${Math.min(100, total * 8)}%"></span></div></div>
                </div>`;
              })
              .join('')}</div>`
          : emptyHTML('chart', 'مفيش بيانات', '')}
      </section>
    </div>

    <section class="card">
      <div class="card-head"><div><h2>سجل الغياب التفصيلي</h2><div class="sub">${data.rows.length} تسجيل</div></div></div>
      ${data.rows.length
        ? `<div class="table-wrap"><table class="table">
            <thead><tr><th>التاريخ</th><th>الطالب</th><th>المجموعة</th><th>الحالة</th><th>ملاحظة</th><th></th></tr></thead>
            <tbody>${data.rows.map((row) => `<tr>
              <td class="small"><div class="strong">${escapeHTML(dateFull(row.date))}</div><div class="tiny muted">${escapeHTML(row.start)}</div></td>
              <td><div class="row">${avatarHTML(row.studentName, row.avatarColor, 'sm')}
                <div><div class="strong small">${escapeHTML(row.studentShort || row.studentName)}</div>
                <div class="tiny muted" dir="ltr" style="text-align:end">${escapeHTML(row.parentPhone || '')}</div></div></div></td>
              <td class="small"><div class="row"><span class="group-dot" style="background:${escapeHTML(row.groupColor)}"></span>${escapeHTML(row.groupName)}</div></td>
              <td><span class="badge ${row.status === 'absent' ? 'red' : 'amber'}">${row.status === 'absent' ? 'غايب' : 'متأخر'}</span></td>
              <td class="small muted">${escapeHTML(row.note || '—')}</td>
              <td class="end">${row.parentPhone ? `<a class="icon-btn" href="${whatsappLink(row.parentPhone, `سلام عليكم، ${row.studentName} كان ${row.status === 'absent' ? 'غايب' : 'متأخر'} عن حصة ${row.groupName} يوم ${row.date}.`)}" target="_blank" rel="noopener" title="واتساب">${icon('message')}</a>` : ''}</td>
            </tr>`).join('')}</tbody></table></div>`
        : emptyHTML('archive', 'مفيش تسجيلات في الفترة دي', 'جرّب تغيّر التاريخ أو المجموعة.')}
    </section>
  </div>`;
}

export async function mount(root) {
  const fromEl = root.querySelector('[data-from]');
  const toEl = root.querySelector('[data-to]');
  const groupEl = root.querySelector('[data-group]');
  const apply = () => {
    const params = new URLSearchParams({ from: fromEl.value, to: toEl.value });
    if (groupEl.value) params.set('groupId', groupEl.value);
    location.hash = `#/archive?${params.toString()}`;
  };
  root.querySelector('[data-apply]')?.addEventListener('click', apply);
  root.querySelector('[data-export]')?.addEventListener('click', () => {
    const params = new URLSearchParams({ from: fromEl.value, to: toEl.value });
    if (groupEl.value) params.set('groupId', groupEl.value);
    downloadURL(`/api/absence-archive/csv?${params.toString()}`);
  });
}
