'use strict';

import {
  api,
  money,
  compactMoney,
  todayISO,
  addDaysISO,
  dateShort,
  dateFull,
  monthKey,
  monthLabel,
  escapeHTML,
  METHOD_LABELS,
  EXPENSE_LABELS,
  downloadURL,
} from '../api.js';
import { icon, emptyHTML, printHTML, toast } from '../ui.js';

const METHOD_OPTIONS = [
  { value: 'cash', label: 'كاش' },
  { value: 'vodafone', label: 'فودافون كاش' },
  { value: 'instapay', label: 'إنستاباي' },
  { value: 'bank', label: 'تحويل بنكي' },
  { value: 'other', label: 'طريقة تانية' },
];

let pageData = null;

function lastDayOf(key) {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

function previousMonth() {
  const now = new Date();
  return monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
}

function resolveRange(query) {
  const today = todayISO();
  const current = monthKey();
  const last = previousMonth();
  const presets = {
    month: { label: 'الشهر ده', from: `${current}-01`, to: `${current}-${String(lastDayOf(current)).padStart(2, '0')}` },
    last: { label: 'الشهر اللي فات', from: `${last}-01`, to: `${last}-${String(lastDayOf(last)).padStart(2, '0')}` },
    quarter: { label: 'آخر ٣ شهور', from: addDaysISO(today, -89), to: today },
    year: { label: 'السنة', from: `${today.slice(0, 4)}-01-01`, to: today },
  };
  const queryFrom = query?.get('from');
  const queryTo = query?.get('to');
  if (/^\d{4}-\d{2}-\d{2}$/.test(queryFrom || '') && /^\d{4}-\d{2}-\d{2}$/.test(queryTo || '')) {
    return { key: 'custom', label: 'فترة مخصصة', from: queryFrom, to: queryTo, presets };
  }
  const key = presets[query?.get('range')] ? query.get('range') : 'month';
  return { key, label: presets[key].label, from: presets[key].from, to: presets[key].to, presets };
}

function kpi({ label, value, unit = '', foot, iconName, color, soft }) {
  return `<div class="kpi" style="--kpi:${color};--kpi-soft:${soft}">
    <div class="kpi-top"><span>${escapeHTML(label)}</span><span class="kpi-icon">${icon(iconName)}</span></div>
    <div class="kpi-value">${value}${unit ? `<small>${escapeHTML(unit)}</small>` : ''}</div>
    <div class="kpi-foot">${foot || ''}</div>
  </div>`;
}

function financeChart(byMonth) {
  const rows = byMonth || [];
  if (!rows.length) return `<div class="chart-empty" style="height:160px">مفيش حركة مالية في الفترة دي</div>`;
  const max = Math.max(1, ...rows.map((row) => Math.max(Number(row.income), Number(row.expenses))));
  return `<div class="chart" style="height:168px">
    ${rows
      .map(
        (row) => `<div class="chart-col" title="${escapeHTML(monthLabel(row.key))} — دخل ${money(row.income)} / مصروف ${money(row.expenses)}">
          <div class="chart-value muted">${compactMoney(Number(row.income) - Number(row.expenses))}</div>
          <div class="chart-bars">
            <div class="chart-bar" style="height:${Math.max(2, Math.round((Number(row.income) / max) * 100))}%"></div>
            <div class="chart-bar alt" style="height:${Math.max(2, Math.round((Number(row.expenses) / max) * 100))}%"></div>
          </div>
          <div class="chart-label">${escapeHTML(monthLabel(row.key).split(' ')[0])}</div>
        </div>`,
      )
      .join('')}
  </div>`;
}

function attendanceChart(points) {
  if (!points?.length) return `<div class="chart-empty" style="height:150px">مفيش حضور مسجل</div>`;
  const max = 100;
  return `<div class="chart" style="height:156px">
    ${points
      .map(
        (point, index) => `<div class="chart-col" title="${escapeHTML(dateShort(point.from))} — ${point.rate}% (${point.total} تسجيل)">
          <div class="chart-value ${index === points.length - 1 ? '' : 'muted'}">${point.total ? `${Math.round(point.rate)}%` : '—'}</div>
          <div class="chart-bars"><div class="chart-bar ${index === points.length - 1 ? '' : 'soft'}" style="height:${Math.max(3, Math.round((point.rate / max) * 100))}%"></div></div>
          <div class="chart-label">${escapeHTML(dateLongShort(point.from))}</div>
        </div>`,
      )
      .join('')}
  </div>`;
}

function dateLongShort(iso) {
  return dateShort(iso).split(' ')[0];
}

function barList(entries, emptyText, color = 'var(--teal)') {
  const list = entries.filter((entry) => Number(entry.value) > 0);
  const max = Math.max(1, ...list.map((entry) => Number(entry.value)));
  if (!list.length) return `<div class="chart-empty" style="height:110px">${escapeHTML(emptyText)}</div>`;
  return `<div class="bar-list">${list
    .map(
      (entry) => `<div class="bar-item">
        <div class="bar-top"><span>${escapeHTML(entry.label)}</span><span>${money(entry.value)}</span></div>
        <div class="bar-track"><span style="width:${Math.max(3, Math.round((Number(entry.value) / max) * 100))}%;background:${entry.color || color}"></span></div>
      </div>`,
    )
    .join('')}</div>`;
}

function groupTable(groups) {
  if (!groups?.length) return emptyHTML('grid', 'مفيش حضور في الفترة دي', 'سجّل حضور الحصص عشان تظهر أرقام المجموعات.');
  return `<div class="table-wrap"><table class="table">
    <thead><tr><th>المجموعة</th><th class="num">تسجيلات</th><th class="num">حضور</th><th style="min-width:150px">النسبة</th><th class="num">الحالة</th></tr></thead>
    <tbody>${groups
      .map(
        (group) => `<tr>
          <td><a class="row" href="#/groups/${group.id}" style="color:inherit">
            <span class="group-dot" style="background:${escapeHTML(group.color || 'var(--teal)')}"></span>
            <span class="strong small">${escapeHTML(group.name || 'مجموعة')}</span></a></td>
          <td class="num">${group.total}</td>
          <td class="num">${group.attended}</td>
          <td><div class="row"><div class="progress grow"><span style="width:${Math.min(100, group.rate)}%;--bar:${group.rate >= 80 ? 'var(--teal)' : group.rate >= 60 ? 'var(--saffron)' : 'var(--coral)'}"></span></div>
            <span class="small strong" style="min-width:38px">${group.rate}%</span></div></td>
          <td class="num">${group.rate >= 80 ? '<span class="badge green">ممتاز</span>' : group.rate >= 60 ? '<span class="badge amber">مقبول</span>' : '<span class="badge red">محتاج متابعة</span>'}</td>
        </tr>`,
      )
      .join('')}</tbody>
  </table></div>`;
}

function topStudents(students) {
  const scored = (students || [])
    .filter((student) => student.gradesCount > 0)
    .sort((a, b) => b.average - a.average)
    .slice(0, 6);
  if (!scored.length) return emptyHTML('award', 'مفيش درجات في الفترة دي', 'صحح واجب أو امتحان عشان يظهر ترتيب الطلبة.');
  return `<div class="stack-list">${scored
    .map(
      (student, index) => `<a class="list-row" href="#/students/${student.id}" style="color:inherit">
        <span class="rank ${index < 3 ? 'top' : ''}">${index + 1}</span>
        <div class="list-main"><div class="list-title">${escapeHTML(student.name)}</div>
          <div class="list-sub">${student.gradesCount} درجة · ${escapeHTML((student.groups || []).join(' / ') || 'من غير مجموعة')}</div></div>
        <div class="list-end"><div class="money ok">${student.average}%</div>
          <div class="tiny muted">متوسط</div></div>
      </a>`,
    )
    .join('')}</div>`;
}

function lowAttendance(students) {
  const low = (students || [])
    .filter((student) => student.attendance.total >= 3 && student.attendance.rate < 70)
    .sort((a, b) => a.attendance.rate - b.attendance.rate)
    .slice(0, 6);
  if (!low.length) return emptyHTML('checkCircle', 'كل الطلبة منتظمين', 'مفيش طالب حضوره أقل من ٧٠٪ في الفترة دي.');
  return `<div class="stack-list">${low
    .map(
      (student) => `<a class="list-row" href="#/students/${student.id}" style="color:inherit">
        <span class="alert-icon warning" style="width:30px;height:30px">${icon('user')}</span>
        <div class="list-main"><div class="list-title">${escapeHTML(student.name)}</div>
          <div class="list-sub">غاب ${student.attendance.absent} من ${student.attendance.total} حصة</div></div>
        <div class="list-end"><span class="money debt">${student.attendance.rate}%</span></div>
      </a>`,
    )
    .join('')}</div>`;
}

function duesTable(dues) {
  if (!dues?.length) return emptyHTML('checkCircle', 'مفيش متأخرات', 'كل الطلبة مسددين.');
  return `<div class="table-wrap"><table class="table">
    <thead><tr><th>الطالب</th><th class="num">المتأخر</th><th>أقدم استحقاق</th></tr></thead>
    <tbody>${dues
      .slice(0, 8)
      .map(
        (due) => `<tr><td class="small">${escapeHTML(due.studentName || due.studentId)}</td>
          <td class="num money debt">${money(due.balance)}</td>
          <td class="small muted">${due.oldestDue ? escapeHTML(dateShort(due.oldestDue)) : '—'}</td></tr>`,
      )
      .join('')}</tbody>
  </table></div>`;
}

function printReport(range, data) {
  const { totals, byMonth, attendance, students, dues } = data;
  const monthRows = byMonth
    .map(
      (row) => `<tr><td>${escapeHTML(monthLabel(row.key))}</td><td>${money(row.income)}</td><td>${money(row.expenses)}</td><td>${money(Number(row.income) - Number(row.expenses))}</td></tr>`,
    )
    .join('');
  const groupRows = (attendance.byGroup || [])
    .map(
      (group) => `<tr><td>${escapeHTML(group.name)}</td><td>${group.total}</td><td>${group.attended}</td><td>${group.rate}%</td></tr>`,
    )
    .join('');
  const topRows = (students || [])
    .filter((student) => student.gradesCount > 0)
    .sort((a, b) => b.average - a.average)
    .slice(0, 10)
    .map(
      (student, index) => `<tr><td>${index + 1}</td><td>${escapeHTML(student.name)}</td><td>${student.average}%</td><td>${student.attendance.rate}%</td><td>${money(student.balance)}</td></tr>`,
    )
    .join('');
  const dueRows = (dues || [])
    .slice(0, 12)
    .map(
      (due) => `<tr><td>${escapeHTML(due.studentName || '')}</td><td>${money(due.balance)}</td><td>${due.oldestDue ? escapeHTML(due.oldestDue) : '—'}</td></tr>`,
    )
    .join('');

  printHTML(`<div class="print-sheet">
    <div class="print-head">
      <div><h1 style="margin:0;font-size:24px">تقرير المركز</h1>
        <div style="font-size:12px;color:#555;margin-top:4px">${escapeHTML(pageData.settings.centerName || 'دفتري')} — ${escapeHTML(dateFull(range.from))} إلى ${escapeHTML(dateFull(range.to))}</div></div>
      <div style="font-size:11px;text-align:end">اتطبع ${escapeHTML(dateFull(todayISO()))}</div>
    </div>
    <div class="print-totals">
      <span>الدخل ${money(totals.income)}</span><span>المصروفات ${money(totals.expenses)}</span>
      <span>الصافي ${money(totals.net)}</span><span>الحضور ${totals.attendanceRate}%</span>
    </div>
    <div style="display:flex;gap:24px;margin:16px 0;font-size:12px">
      <span>الدفعات: <b>${totals.payments}</b></span>
      <span>المصروفات: <b>${totals.expenseCount}</b></span>
      <span>الحصص: <b>${totals.doneLessons}/${totals.lessons}</b></span>
      <span>طلبة جدد: <b>${totals.newStudents}</b></span>
    </div>
    <h2 style="font-size:15px;margin:18px 0 8px">الشهور</h2>
    <table class="print-table"><thead><tr><th>الشهر</th><th>الدخل</th><th>المصروف</th><th>الصافي</th></tr></thead>
      <tbody>${monthRows || '<tr><td colspan="4">مفيش حركة</td></tr>'}</tbody></table>
    <h2 style="font-size:15px;margin:20px 0 8px">أداء المجموعات</h2>
    <table class="print-table"><thead><tr><th>المجموعة</th><th>تسجيلات</th><th>حضور</th><th>النسبة</th></tr></thead>
      <tbody>${groupRows || '<tr><td colspan="4">مفيش بيانات</td></tr>'}</tbody></table>
    <h2 style="font-size:15px;margin:20px 0 8px">أفضل الطلبة</h2>
    <table class="print-table"><thead><tr><th>#</th><th>الطالب</th><th>الدرجات</th><th>الحضور</th><th>المتأخر</th></tr></thead>
      <tbody>${topRows || '<tr><td colspan="5">مفيش درجات</td></tr>'}</tbody></table>
    <h2 style="font-size:15px;margin:20px 0 8px">المتأخرات</h2>
    <table class="print-table"><thead><tr><th>الطالب</th><th>المبلغ</th><th>أقدم استحقاق</th></tr></thead>
      <tbody>${dueRows || '<tr><td colspan="3">مفيش متأخرات</td></tr>'}</tbody></table>
    <div style="margin-top:24px;font-size:10px;color:#777;text-align:center">دفتري — تقرير إداري داخلي</div>
  </div>`);
}

export async function render(ctx) {
  const range = resolveRange(ctx.query);
  const data = await api.get(`/api/reports?from=${range.from}&to=${range.to}`);
  pageData = { range, data, settings: ctx.settings || {} };
  const { totals, attendance } = data;
  ctx.setTitle('التقارير', `${range.label} · ${dateShort(range.from)} — ${dateShort(range.to)}`);

  const methodEntries = Object.entries(data.methods || {}).map(([key, value]) => ({
    label: METHOD_LABELS[key] || key,
    value,
  }));
  const categoryEntries = Object.entries(data.categories || {}).map(([key, value]) => ({
    label: EXPENSE_LABELS[key] || key,
    value,
  }));

  return `<div class="page">
    <div class="page-head">
      <div><h1>التقارير</h1>
        <div class="sub">صورة كاملة للمركز من ${escapeHTML(dateShort(range.from))} لـ ${escapeHTML(dateShort(range.to))}</div></div>
      <div class="page-actions">
        <button class="btn secondary" data-print>${icon('print')}طباعة التقرير</button>
        <button class="btn secondary" data-export="report">${icon('download')}CSV</button>
        <a class="btn" href="#/finance">${icon('wallet')}الحسابات</a>
      </div>
    </div>

    <section class="card mb-3">
      <div class="row-between" style="flex-wrap:wrap;gap:10px">
        <div class="range-tabs">
          ${Object.entries(range.presets)
            .map(
              ([key, preset]) =>
                `<a href="#/reports?range=${key}" class="${range.key === key ? 'active' : ''}">${escapeHTML(preset.label)}</a>`,
            )
            .join('')}
          <span class="${range.key === 'custom' ? 'active' : ''}">${range.key === 'custom' ? 'فترة مخصصة' : ''}</span>
        </div>
        <form class="row" style="gap:6px;flex-wrap:wrap" data-range-form>
          <input class="input" type="date" name="from" value="${escapeHTML(range.from)}" style="width:auto">
          <span class="small muted">لـ</span>
          <input class="input" type="date" name="to" value="${escapeHTML(range.to)}" style="width:auto">
          <button class="btn secondary sm" type="submit">${icon('filter')}اعرض</button>
        </form>
      </div>
      <div class="tiny muted mt-2">${escapeHTML(dateFull(range.from))} — ${escapeHTML(dateFull(range.to))} · ${range.label}</div>
    </section>

    <div class="grid grid-4 mb-3">
      ${kpi({
        label: 'الدخل',
        value: money(totals.income),
        foot: `${totals.payments} دفعة · متوسط ${money(totals.averagePayment)}`,
        iconName: 'wallet',
        color: 'var(--teal)',
        soft: 'var(--teal-soft)',
      })}
      ${kpi({
        label: 'المصروفات',
        value: money(totals.expenses),
        foot: `${totals.expenseCount} مصروف في الفترة`,
        iconName: 'credit',
        color: 'var(--saffron)',
        soft: 'var(--saffron-soft)',
      })}
      ${kpi({
        label: 'الصافي',
        value: money(totals.net),
        foot: `<span class="${totals.net >= 0 ? 'trend-up' : 'trend-down'}">${totals.net >= 0 ? 'مكسب' : 'خسارة'}</span> بعد المصروفات`,
        iconName: 'trend',
        color: totals.net >= 0 ? 'var(--teal)' : 'var(--coral)',
        soft: totals.net >= 0 ? 'var(--teal-soft)' : 'var(--coral-soft)',
      })}
      ${kpi({
        label: 'نسبة الحضور',
        value: `${totals.attendanceRate}<small>%</small>`,
        foot: `من ${totals.attendanceTotal} تسجيل حضور`,
        iconName: 'checkCircle',
        color: 'var(--blue)',
        soft: 'var(--blue-soft)',
      })}
    </div>

    <div class="stat-row mb-3">
      <div class="stat-mini"><div class="lbl">الحصص اللي خلصت</div><div class="val">${totals.doneLessons} <small>من ${totals.lessons}</small></div></div>
      <div class="stat-mini"><div class="lbl">طلبة جدد</div><div class="val">${totals.newStudents}</div></div>
      <div class="stat-mini"><div class="lbl">إجمالي المتأخرات</div><div class="val money debt">${money((data.dues || []).reduce((sum, due) => sum + Number(due.balance || 0), 0))}</div></div>
      <div class="stat-mini"><div class="lbl">طلبة عليهم متأخرات</div><div class="val">${data.dues?.length || 0}</div></div>
    </div>

    <div class="report-grid mb-3">
      <section class="card">
        <div class="card-head">
          <div><h2>الدخل والمصروف</h2><div class="sub">حسب الشهور في الفترة</div></div>
          <div class="legend"><span><i style="background:var(--teal)"></i>دخل</span><span><i style="background:var(--saffron)"></i>مصروف</span></div>
        </div>
        ${financeChart(data.byMonth)}
      </section>
      <section class="card">
        <div class="card-head"><div><h2>حضور آخر ٨ أسابيع</h2><div class="sub">اتجاه الحضور الأسبوعي</div></div>
          <span class="badge blue">${attendance.rate}%</span></div>
        ${attendanceChart(attendance.trend)}
      </section>
    </div>

    <div class="grid grid-3 mb-3">
      <section class="card">
        <div class="card-head"><div><h2>التحصيل</h2><div class="sub">حسب طريقة الدفع</div></div></div>
        ${barList(methodEntries, 'مفيش دفعات')}
      </section>
      <section class="card">
        <div class="card-head"><div><h2>المصروفات</h2><div class="sub">حسب النوع</div></div></div>
        ${barList(categoryEntries, 'مفيش مصروفات', 'var(--saffron)')}
      </section>
      <section class="card">
        <div class="card-head"><div><h2>تصدير سريع</h2><div class="sub">ملفات CSV جاهزة</div></div></div>
        <div class="quick-grid">
          <button class="quick-btn" data-export="students">${icon('users')}الطلبة</button>
          <button class="quick-btn" data-export="dues">${icon('receipt')}المتأخرات</button>
          <button class="quick-btn" data-export="payments">${icon('wallet')}الدفعات</button>
          <button class="quick-btn" data-export="charges">${icon('credit')}المستحقات</button>
          <button class="quick-btn" data-export="expenses">${icon('credit')}المصروفات</button>
          <button class="quick-btn" data-export="attendance">${icon('check')}الحضور</button>
        </div>
      </section>
    </div>

    <section class="card mb-3">
      <div class="card-head">
        <div><h2>أداء المجموعات</h2><div class="sub">${attendance.byGroup?.length || 0} مجموعة · ${attendance.total} تسجيل</div></div>
        <a class="card-link" href="#/groups">المجموعات ${icon('arrowLeft')}</a>
      </div>
      ${groupTable(attendance.byGroup)}
    </section>

    <div class="grid grid-2 mb-3">
      <section class="card">
        <div class="card-head"><div><h2>أفضل الطلبة</h2><div class="sub">حسب متوسط الدرجات</div></div><span class="badge green">${icon('award')}</span></div>
        ${topStudents(data.students)}
      </section>
      <section class="card">
        <div class="card-head"><div><h2>حضور محتاج متابعة</h2><div class="sub">أقل من ٧٠٪ في الفترة</div></div><span class="badge amber">${icon('alert')}</span></div>
        ${lowAttendance(data.students)}
      </section>
    </div>

    <div class="grid grid-2">
      <section class="card">
        <div class="card-head"><div><h2>المتأخرات</h2><div class="sub">أكبر المبالغ المستحقة</div></div>
          <a class="card-link" href="#/finance?tab=dues">التفاصيل ${icon('arrowLeft')}</a></div>
        ${duesTable(data.dues)}
      </section>
      <section class="card">
        <div class="card-head"><div><h2>ملخص الفترة</h2><div class="sub">أرقام سريعة</div></div></div>
        <div class="kv-list">
          <div class="kv-row"><span class="k">إجمالي الدخل</span><span class="v money ok">${money(totals.income)}</span></div>
          <div class="kv-row"><span class="k">إجمالي المصروفات</span><span class="v money debt">${money(totals.expenses)}</span></div>
          <div class="kv-row"><span class="k">الصافي</span><span class="v money ${totals.net >= 0 ? 'ok' : 'debt'}">${money(totals.net)}</span></div>
          <div class="kv-row"><span class="k">متوسط الدفعة</span><span class="v">${money(totals.averagePayment)}</span></div>
          <div class="kv-row"><span class="k">الحضور</span><span class="v">${totals.attendanceRate}%</span></div>
          <div class="kv-row"><span class="k">الحصص المنتهية</span><span class="v">${totals.doneLessons} من ${totals.lessons}</span></div>
          <div class="kv-row"><span class="k">طلبة جدد</span><span class="v">${totals.newStudents}</span></div>
        </div>
      </section>
    </div>
  </div>`;
}

export async function mount(root, ctx) {
  if (!pageData) return;
  const { range } = pageData;

  root.querySelector('[data-range-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const from = form.querySelector('[name="from"]').value;
    const to = form.querySelector('[name="to"]').value;
    if (!from || !to || from > to) {
      toast('اختار فترة صحيحة', 'error');
      return;
    }
    location.hash = `#/reports?from=${from}&to=${to}`;
  });

  const urls = {
    report: `/api/exports/report.csv?from=${range.from}&to=${range.to}`,
    students: '/api/exports/students.csv',
    dues: '/api/exports/dues.csv',
    payments: `/api/exports/payments.csv?from=${range.from}&to=${range.to}`,
    charges: `/api/exports/charges.csv?from=${range.from}&to=${range.to}`,
    expenses: `/api/exports/expenses.csv?from=${range.from}&to=${range.to}`,
    attendance: `/api/exports/attendance.csv?from=${range.from}&to=${range.to}`,
    grades: '/api/exports/grades.csv',
  };
  root.querySelectorAll('[data-export]').forEach((button) => {
    button.addEventListener('click', () => downloadURL(urls[button.dataset.export] || urls.report));
  });

  root.querySelector('[data-print]')?.addEventListener('click', () => printReport(range, pageData.data));
}
