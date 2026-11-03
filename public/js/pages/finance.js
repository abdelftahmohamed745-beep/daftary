'use strict';

import {
  api,
  money,
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
import { icon, toast, emptyHTML, formModal, openModal, confirmModal, printHTML } from '../ui.js';
import {
  paymentModal,
  chargeModal,
  expenseModal,
  receiptModal,
  reminderModal,
  deleteConfirm,
  loadGroups,
} from '../forms.js';

const METHOD_OPTIONS = [
  { value: 'cash', label: 'كاش' },
  { value: 'vodafone', label: 'فودافون كاش' },
  { value: 'instapay', label: 'إنستاباي' },
  { value: 'bank', label: 'تحويل بنكي' },
  { value: 'other', label: 'طريقة تانية' },
];
const CHARGE_TYPES = [
  { value: 'subscription', label: 'اشتراك' },
  { value: 'manual', label: 'مستحق يدوي' },
  { value: 'material', label: 'ملازم ومواد' },
  { value: 'exam', label: 'امتحان' },
  { value: 'other', label: 'حاجة تانية' },
];
const EXPENSE_CATEGORIES = [
  { value: 'rent', label: 'إيجار' },
  { value: 'salaries', label: 'مرتبات' },
  { value: 'marketing', label: 'تسويق' },
  { value: 'materials', label: 'مواد وطباعة' },
  { value: 'transport', label: 'مواصلات' },
  { value: 'other', label: 'مصروفات تانية' },
];
const CHARGE_TYPE_LABELS = Object.fromEntries(CHARGE_TYPES.map((t) => [t.value, t.label]));

let pageData = null;

/* ---------------- ranges ---------------- */
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

function rangeLink(key, range, tab) {
  return `#/finance?range=${key}${tab ? `&tab=${tab}` : ''}`;
}

function tabLink(tab, range) {
  const params = new URLSearchParams({ tab });
  if (range.key === 'custom') {
    params.set('from', range.from);
    params.set('to', range.to);
  } else {
    params.set('range', range.key);
  }
  return `#/finance?${params.toString()}`;
}

/* ---------------- bits ---------------- */
function kpi({ label, value, unit = '', foot, iconName, color, soft, href }) {
  const inner = `<div class="kpi" style="--kpi:${color};--kpi-soft:${soft}">
    <div class="kpi-top"><span>${escapeHTML(label)}</span><span class="kpi-icon">${icon(iconName)}</span></div>
    <div class="kpi-value">${value}${unit ? `<small>${escapeHTML(unit)}</small>` : ''}</div>
    <div class="kpi-foot">${foot || ''}</div>
  </div>`;
  return href ? `<a href="${href}" style="display:block;color:inherit">${inner}</a>` : inner;
}

function barList(entries, emptyText, color = 'var(--teal)') {
  const list = entries.filter((entry) => Number(entry.value) > 0);
  const max = Math.max(1, ...list.map((entry) => Number(entry.value)));
  if (!list.length) return `<div class="chart-empty" style="height:96px">${escapeHTML(emptyText)}</div>`;
  return `<div class="bar-list">${list
    .map(
      (entry) => `<div class="bar-item">
        <div class="bar-top"><span>${escapeHTML(entry.label)}</span><span>${money(entry.value)}</span></div>
        <div class="bar-track"><span style="width:${Math.max(3, Math.round((Number(entry.value) / max) * 100))}%;background:${entry.color || color}"></span></div>
      </div>`,
    )
    .join('')}</div>`;
}

function tabButton(key, label, count, active) {
  return `<button class="tab ${active ? 'active' : ''}" data-tab="${key}">
    ${label}${count !== undefined ? `<span class="count">${count}</span>` : ''}
  </button>`;
}

function agingCard(summary) {
  const buckets = { current: 0, 30: 0, 60: 0, 90: 0 };
  for (const due of summary.dues || []) {
    buckets[due.bucket] = (buckets[due.bucket] || 0) + Number(due.balance || 0);
  }
  const total = Object.values(buckets).reduce((sum, value) => sum + value, 0);
  return `<section class="card">
    <div class="card-head">
      <div><h2>أعمار المتأخرات</h2><div class="sub">${summary.totals.debtors || 0} طالب عليهم ${money(total)}</div></div>
      ${icon('clock')}
    </div>
    <div class="aging">
      <div><div class="l">مستحق دلوقتي</div><div class="v" style="color:var(--teal)">${money(buckets.current || 0)}</div></div>
      <div><div class="l">متأخر لحد ٣٠ يوم</div><div class="v" style="color:var(--saffron)">${money(buckets[30] || 0)}</div></div>
      <div><div class="l">من ٣١ لـ ٦٠ يوم</div><div class="v" style="color:var(--coral)">${money(buckets[60] || 0)}</div></div>
      <div><div class="l">أكتر من ٦٠ يوم</div><div class="v" style="color:var(--coral)">${money(buckets[90] || 0)}</div></div>
    </div>
    <div class="divider" style="margin:14px 0"></div>
    <div class="row-between small">
      <span class="muted">أكبر ٣ متأخرين</span>
      <a class="card-link" href="${tabLink('dues', pageData.range)}">كل المتأخرات ${icon('arrowLeft')}</a>
    </div>
    <div class="stack-list mt-2">
      ${(summary.dues || [])
        .slice(0, 3)
        .map(
          (due) => `<a class="list-row" href="#/students/${due.studentId}" style="color:inherit">
            <div class="list-main"><div class="list-title">${escapeHTML(due.studentName)}</div>
              <div class="list-sub">أقدم استحقاق ${due.ageDays ? `من ${due.ageDays} يوم` : 'لسه'}</div></div>
            <div class="list-end"><span class="money debt">${money(due.balance)}</span></div>
          </a>`,
        )
        .join('') || '<div class="small muted">مفيش متأخرات</div>'}
    </div>
  </section>`;
}

function methodsCard(summary) {
  const entries = Object.entries(summary.methods || {}).map(([key, value]) => ({
    label: METHOD_LABELS[key] || key,
    value,
  }));
  return `<section class="card">
    <div class="card-head">
      <div><h2>التحصيل إزاي</h2><div class="sub">توزيع الدخل حسب طريقة الدفع</div></div>
      <span class="badge green">${money(summary.totals.income)}</span>
    </div>
    ${barList(entries, 'مفيش دفعات في الفترة دي')}
    <div class="divider" style="margin:14px 0"></div>
    <div class="row-between small">
      <span class="muted">أكبر بنود المصروفات</span>
      <a class="card-link" href="${tabLink('expenses', pageData.range)}">المصروفات ${icon('arrowLeft')}</a>
    </div>
    <div class="mt-2">${barList(
      Object.entries(summary.categories || {}).map(([key, value]) => ({ label: EXPENSE_LABELS[key] || key, value })),
      'مفيش مصروفات في الفترة دي',
      'var(--saffron)',
    )}</div>
  </section>`;
}

function monthChart(byMonth) {
  const rows = (byMonth || []).slice(-6);
  if (!rows.length) return `<div class="chart-empty" style="height:130px">مفيش حركة مالية في الفترة دي</div>`;
  const max = Math.max(1, ...rows.map((row) => Math.max(Number(row.income), Number(row.expenses))));
  return `<div class="chart" style="height:132px">
    ${rows
      .map(
        (row) => `<div class="chart-col" title="${escapeHTML(monthLabel(row.key))}">
          <div class="chart-value ${Number(row.income) - Number(row.expenses) >= 0 ? 'trend-up' : 'trend-down'}">${money(Number(row.income) - Number(row.expenses))}</div>
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

/* ---------------- tables ---------------- */
function duesTable(summary, range) {
  const dues = summary.dues || [];
  return `<section class="card">
    <div class="card-head">
      <div><h2>المتأخرات</h2><div class="sub">${dues.length} طالب — إجمالي ${money(summary.totals.outstanding)}</div></div>
      <div class="row" style="gap:6px">
        <button class="btn ghost sm" data-export="dues">${icon('download')}CSV</button>
        <button class="btn secondary sm" data-remind-all-dues>${icon('message')}تذكير الجميع</button>
        <button class="btn sm" data-new-payment>${icon('wallet')}تحصيل</button>
      </div>
    </div>
    ${dues.length
      ? `<div class="toolbar" style="padding-inline:0;border:0;margin-bottom:8px">
          <div class="search">${icon('search')}<input class="input" data-filter="dues-search" placeholder="دوّر باسم الطالب أو الموبايل…"></div>
          <select class="select" data-filter="dues-age">
            <option value="">كل الأعمار</option>
            <option value="current">مستحق دلوقتي</option>
            <option value="30">متأخر لحد ٣٠ يوم</option>
            <option value="60">من ٣١ لـ ٦٠ يوم</option>
            <option value="90">أكتر من ٦٠ يوم</option>
          </select>
        </div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>الطالب</th><th>الموبايل</th><th class="num">المتأخر</th><th>أقدم استحقاق</th><th>التأخير</th><th></th></tr></thead>
          <tbody>${dues
            .map(
              (due) => `<tr data-dues-row data-age="${escapeHTML(due.bucket)}" data-student="${escapeHTML(due.studentId)}">
                <td><a class="row" href="#/students/${due.studentId}" style="color:inherit">
                  <span class="avatar sm" style="--av:${escapeHTML(due.avatarColor || '#2f6f5e')}">${escapeHTML((due.studentShort || due.studentName || '؟').slice(0, 2))}</span>
                  <div><div class="strong small">${escapeHTML(due.studentName)}</div>
                    <div class="tiny muted">${escapeHTML(due.studentShort || '')}</div></div></a></td>
                <td class="small" dir="ltr" style="text-align:end">${escapeHTML(due.phone || '—')}</td>
                <td class="num money debt">${money(due.balance)}</td>
                <td class="small muted">${due.oldestDue ? escapeHTML(dateFull(due.oldestDue)) : '—'}</td>
                <td>${ageBadge(due)}</td>
                <td class="end"><div class="row" style="justify-content:flex-end;gap:4px">
                  <button class="icon-btn" data-remind="${due.studentId}" title="تذكير">${icon('message')}</button>
                  <button class="btn xs" data-pay-student="${due.studentId}" data-amount="${due.balance}">تحصيل</button>
                </div></td>
              </tr>`,
            )
            .join('')}</tbody>
        </table></div>`
      : emptyHTML('checkCircle', 'مفيش متأخرات', 'كل الطلبة مسددين في الفترة دي. شغل عظيم!')}
  </section>`;
}

function ageBadge(due) {
  if (!due.ageDays || due.bucket === 'current') return '<span class="badge green">لسه</span>';
  if (due.bucket === '30') return `<span class="badge amber">${due.ageDays} يوم</span>`;
  return `<span class="badge red">${due.ageDays} يوم</span>`;
}

function paymentsTable(data, range) {
  const items = data.payments.items || [];
  const summary = data.payments.summary || {};
  return `<section class="card">
    <div class="card-head">
      <div><h2>الدفعات</h2><div class="sub">${summary.count || 0} دفعة — إجمالي ${money(summary.amount || 0)}</div></div>
      <div class="row" style="gap:6px">
        <button class="btn ghost sm" data-export="payments">${icon('download')}CSV</button>
        <button class="btn sm" data-new-payment>${icon('plus')}دفعة جديدة</button>
      </div>
    </div>
    ${items.length
      ? `<div class="toolbar" style="padding-inline:0;border:0;margin-bottom:8px">
          <div class="search">${icon('search')}<input class="input" data-filter="payments-search" placeholder="رقم إيصال، طالب، مبلغ…"></div>
          <select class="select" data-filter="payments-method">
            <option value="">كل الطرق</option>
            ${METHOD_OPTIONS.map((option) => `<option value="${option.value}">${option.label}</option>`).join('')}
          </select>
        </div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>الإيصال</th><th>الطالب</th><th class="num">المبلغ</th><th>الطريقة</th><th>التاريخ</th><th>ملاحظة</th><th></th></tr></thead>
          <tbody>${items
            .map(
              (payment) => `<tr data-payments-row data-method="${escapeHTML(payment.method)}">
                <td class="mono small">${escapeHTML(payment.receiptNo || '—')}</td>
                <td><a class="row" href="#/students/${payment.studentId}" style="color:inherit">
                  <span class="avatar sm" style="--av:${escapeHTML(payment.avatarColor || '#2f6f5e')}">${escapeHTML((payment.studentShort || payment.studentName || '؟').slice(0, 2))}</span>
                  <span class="strong small">${escapeHTML(payment.studentName)}</span></a></td>
                <td class="num money ok">${money(payment.amount)}</td>
                <td class="small">${escapeHTML(METHOD_LABELS[payment.method] || payment.method)}</td>
                <td class="small nowrap">${escapeHTML(dateShort(payment.date))}</td>
                <td class="small muted truncate" style="max-width:180px">${escapeHTML(payment.note || '—')}</td>
                <td class="end"><div class="row" style="justify-content:flex-end;gap:3px">
                  <button class="icon-btn" data-receipt="${payment.id}" title="الإيصال">${icon('receipt')}</button>
                  <button class="icon-btn" data-edit-payment="${payment.id}" title="تعديل">${icon('edit')}</button>
                  ${pageData.isAdmin ? `<button class="icon-btn" data-delete-payment="${payment.id}" title="حذف">${icon('trash')}</button>` : ''}
                </div></td>
              </tr>`,
            )
            .join('')}</tbody>
        </table></div>`
      : emptyHTML('wallet', 'مفيش دفعات في الفترة دي', 'سجّل دفعة من زرار "دفعة جديدة".')}
  </section>`;
}

function chargesTable(data) {
  const items = data.charges.items || [];
  const summary = data.charges.summary || {};
  return `<section class="card">
    <div class="card-head">
      <div><h2>المستحقات</h2><div class="sub">${summary.count || 0} مستحق — متبقي ${money(summary.remaining)}</div></div>
      <div class="row" style="gap:6px">
        <button class="btn ghost sm" data-export="charges">${icon('download')}CSV</button>
        <button class="btn secondary sm" data-bulk>${icon('sparkles')}اشتراكات الشهر</button>
        <button class="btn sm" data-new-charge>${icon('plus')}مستحق جديد</button>
      </div>
    </div>
    ${items.length
      ? `<div class="toolbar" style="padding-inline:0;border:0;margin-bottom:8px">
          <div class="search">${icon('search')}<input class="input" data-filter="charges-search" placeholder="بيان، طالب، مجموعة…"></div>
          <select class="select" data-filter="charges-status">
            <option value="">الكل</option>
            <option value="overdue">متأخر</option>
            <option value="unpaid">متبقي</option>
            <option value="paid">مسدد</option>
          </select>
          <select class="select" data-filter="charges-type">
            <option value="">كل الأنواع</option>
            ${CHARGE_TYPES.map((type) => `<option value="${type.value}">${type.label}</option>`).join('')}
          </select>
        </div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>البيان</th><th>الطالب</th><th>المجموعة</th><th class="num">المبلغ</th><th class="num">متبقي</th><th>الاستحقاق</th><th>الحالة</th><th></th></tr></thead>
          <tbody>${items
            .map((charge) => {
              const status = charge.settled ? 'paid' : charge.overdue ? 'overdue' : 'unpaid';
              return `<tr data-charges-row data-status="${status}" data-type="${escapeHTML(charge.type || '')}">
                <td><div class="strong small">${escapeHTML(charge.title)}</div>
                  <div class="tiny muted">${escapeHTML(CHARGE_TYPE_LABELS[charge.type] || charge.type || '')}${charge.month ? ` · ${escapeHTML(monthLabel(charge.month))}` : ''}</div></td>
                <td class="small"><a href="#/students/${charge.studentId}" style="color:inherit">${escapeHTML(charge.studentName)}</a></td>
                <td class="small muted">${escapeHTML(charge.groupName || '—')}</td>
                <td class="num">${money(charge.amount)}</td>
                <td class="num ${charge.remaining > 0 ? 'money debt' : 'money ok'}">${money(charge.remaining)}</td>
                <td class="small nowrap">${escapeHTML(dateShort(charge.dueDate))}</td>
                <td>${charge.settled ? '<span class="badge green">مسدد</span>' : charge.overdue ? '<span class="badge red">متأخر</span>' : '<span class="badge amber">متبقي</span>'}</td>
                <td class="end"><div class="row" style="justify-content:flex-end;gap:3px">
                  ${charge.remaining > 0 ? `<button class="btn xs" data-charge-pay="${charge.studentId}" data-amount="${charge.remaining}">تحصيل</button>` : ''}
                  <button class="icon-btn" data-edit-charge="${charge.id}" title="تعديل">${icon('edit')}</button>
                  ${pageData.isAdmin ? `<button class="icon-btn" data-delete-charge="${charge.id}" title="حذف">${icon('trash')}</button>` : ''}
                </div></td>
              </tr>`;
            })
            .join('')}</tbody>
        </table></div>`
      : emptyHTML('receipt', 'مفيش مستحقات في الفترة دي', 'ضيف مستحق أو ولّد اشتراكات الشهر.')}
  </section>`;
}

function expensesTable(data) {
  const items = data.expenses.items || [];
  const summary = data.expenses.summary || {};
  return `<section class="card">
    <div class="card-head">
      <div><h2>المصروفات</h2><div class="sub">${items.length} مصروف — إجمالي ${money(summary.amount || 0)}</div></div>
      <div class="row" style="gap:6px">
        <button class="btn ghost sm" data-export="expenses">${icon('download')}CSV</button>
        <button class="btn sm" data-new-expense>${icon('plus')}مصروف جديد</button>
      </div>
    </div>
    ${items.length
      ? `<div class="toolbar" style="padding-inline:0;border:0;margin-bottom:8px">
          <div class="search">${icon('search')}<input class="input" data-filter="expenses-search" placeholder="بيان أو ملاحظة…"></div>
          <select class="select" data-filter="expenses-category">
            <option value="">كل الأنواع</option>
            ${EXPENSE_CATEGORIES.map((category) => `<option value="${category.value}">${category.label}</option>`).join('')}
          </select>
        </div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>البيان</th><th>النوع</th><th>التاريخ</th><th class="num">المبلغ</th><th>ملاحظة</th><th></th></tr></thead>
          <tbody>${items
            .map(
              (expense) => `<tr data-expenses-row data-category="${escapeHTML(expense.category)}">
                <td class="strong small">${escapeHTML(expense.title)}</td>
                <td><span class="badge gray">${escapeHTML(EXPENSE_LABELS[expense.category] || expense.category)}</span></td>
                <td class="small nowrap">${escapeHTML(dateShort(expense.date))}</td>
                <td class="num money debt">${money(expense.amount)}</td>
                <td class="small muted truncate" style="max-width:220px">${escapeHTML(expense.note || '—')}</td>
                <td class="end"><div class="row" style="justify-content:flex-end;gap:3px">
                  <button class="icon-btn" data-edit-expense="${expense.id}" title="تعديل">${icon('edit')}</button>
                  ${pageData.isAdmin ? `<button class="icon-btn" data-delete-expense="${expense.id}" title="حذف">${icon('trash')}</button>` : ''}
                </div></td>
              </tr>`,
            )
            .join('')}</tbody>
        </table></div>`
      : emptyHTML('credit', 'مفيش مصروفات في الفترة دي', 'سجّل الإيجار والمرتبات وأي فلوس خارجة.')}
  </section>`;
}

/* ---------------- modals ---------------- */
async function editPaymentModal(payment, onSaved) {
  return formModal({
    title: 'تعديل الدفعة',
    sub: `${payment.receiptNo} — ${payment.studentName || ''}`,
    fields: [
      { name: 'amount', label: 'المبلغ', type: 'number', min: 0.5, step: '0.5', required: true },
      { name: 'method', label: 'طريقة الدفع', type: 'select', options: METHOD_OPTIONS, required: true },
      { name: 'date', label: 'التاريخ', type: 'date', required: true },
      { name: 'note', label: 'ملاحظة', span: 2 },
    ],
    values: { amount: payment.amount, method: payment.method, date: payment.date, note: payment.note || '' },
    submitText: 'حفظ التعديلات',
    onSubmit: async (values) => {
      await api.patch(`/api/payments/${payment.id}`, values);
      toast('تم تحديث الدفعة');
      if (onSaved) await onSaved();
    },
  });
}

async function editChargeModal(charge, onSaved) {
  const groups = await loadGroups();
  return formModal({
    title: 'تعديل المستحق',
    sub: charge.studentName || charge.title,
    fields: [
      { name: 'title', label: 'البيان', required: true, span: 2 },
      { name: 'amount', label: 'المبلغ', type: 'number', min: 1, step: '0.5', required: true },
      { name: 'dueDate', label: 'تاريخ الاستحقاق', type: 'date', required: true },
      { name: 'type', label: 'النوع', type: 'select', options: CHARGE_TYPES },
      { name: 'groupId', label: 'المجموعة', type: 'select', options: [{ value: '', label: 'من غير مجموعة' }, ...groups.map((g) => ({ value: g.id, label: g.name }))] },
      { name: 'month', label: 'شهر الاشتراك', type: 'month' },
      { name: 'note', label: 'ملاحظة', span: 2 },
    ],
    values: {
      title: charge.title,
      amount: charge.amount,
      dueDate: charge.dueDate,
      type: charge.type || 'manual',
      groupId: charge.groupId || '',
      month: charge.month || '',
      note: charge.note || '',
    },
    submitText: 'حفظ التعديلات',
    onSubmit: async (values) => {
      await api.patch(`/api/charges/${charge.id}`, values);
      toast('تم تحديث المستحق');
      if (onSaved) await onSaved();
    },
  });
}

async function editExpenseModal(expense, onSaved) {
  return formModal({
    title: 'تعديل المصروف',
    sub: expense.title,
    fields: [
      { name: 'title', label: 'البيان', required: true, span: 2 },
      { name: 'amount', label: 'المبلغ', type: 'number', min: 0.5, step: '0.5', required: true },
      { name: 'category', label: 'النوع', type: 'select', options: EXPENSE_CATEGORIES, required: true },
      { name: 'date', label: 'التاريخ', type: 'date', required: true },
      { name: 'note', label: 'ملاحظة', span: 2 },
    ],
    values: { title: expense.title, amount: expense.amount, category: expense.category, date: expense.date, note: expense.note || '' },
    submitText: 'حفظ التعديلات',
    onSubmit: async (values) => {
      await api.patch(`/api/expenses/${expense.id}`, values);
      toast('تم تحديث المصروف');
      if (onSaved) await onSaved();
    },
  });
}

async function bulkChargesModal(onSaved, range) {
  const groups = (await loadGroups()).filter((group) => group.status === 'active');
  if (!groups.length) {
    toast('مفيش مجموعات نشطة', 'error');
    return;
  }
  const month = todayISO().slice(0, 7);
  return formModal({
    title: 'توليد اشتراكات الشهر',
    sub: 'هيتم عمل مستحق لكل طالب في المجموعات المختارة، من غير تكرار.',
    wide: true,
    fields: [
      { name: 'month', label: 'الشهر', type: 'month', required: true },
      { name: 'dueDate', label: 'تاريخ الاستحقاق', type: 'date', required: true },
      { name: 'amount', label: 'قيمة الاشتراك (اختياري)', type: 'number', min: 0, step: '0.5', help: 'سيبه فاضي لاستخدام سعر كل مجموعة' },
    ],
    values: { month, dueDate: `${month}-05`, amount: '' },
    extraBody: `<div class="form-section-title">المجموعات</div>
      <div class="check-grid">${groups
        .map(
          (group, index) => `<label class="checkline">
            <input type="checkbox" data-group-check value="${group.id}" ${index < groups.length ? 'checked' : ''}>
            <span><span class="dot" style="display:inline-block;width:7px;height:7px;border-radius:3px;background:${escapeHTML(group.color)}"></span>
            ${escapeHTML(group.name)} — ${money(group.price)}</span>
          </label>`,
        )
        .join('')}</div>`,
    submitText: 'ولّد الاشتراكات',
    onMount: ({ form }) => {
      const monthInput = form.querySelector('[name="month"]');
      monthInput?.addEventListener('change', () => {
        const due = form.querySelector('[name="dueDate"]');
        if (due) due.value = `${monthInput.value}-05`;
      });
    },
    onSubmit: async (values, { root }) => {
      const groupIds = [...root.querySelectorAll('[data-group-check]:checked')].map((input) => input.value);
      if (!groupIds.length) {
        toast('اختار مجموعة واحدة على الأقل', 'error');
        return false;
      }
      const data = await api.post('/api/charges/bulk', { ...values, groupIds });
      toast(`اتعمل ${data.created} اشتراك${data.skipped ? ` — ${data.skipped} موجود قبل كده` : ''}`);
      if (onSaved) await onSaved();
      return true;
    },
  });
}

async function remindAllDues(dues) {
  const rows = (dues || []).slice(0, 30);
  if (!rows.length) {
    toast('مفيش حد عليه متأخرات', 'info');
    return;
  }
  const students = await api.get('/api/students?limit=500');
  const byId = new Map((students.items || []).map((student) => [student.id, student]));
  const messages = [];
  for (const due of rows) {
    const student = byId.get(due.studentId);
    if (!student) continue;
    const reminder = await api.get(`/api/students/${student.id}/reminder?kind=payment`);
    messages.push({ student, reminder });
  }
  openModal({
    title: 'تذكير المتأخرين',
    sub: `${messages.length} رسالة جاهزة — ابعت اللي تحبه على واتساب.`,
    wide: true,
    body: messages.length
      ? `<div class="stack-list">${messages
          .map(
            (row, index) => `<div class="card flat" style="padding:12px">
              <div class="row-between" style="align-items:flex-start">
                <div><div class="strong small">${escapeHTML(row.student.name)}</div>
                  <div class="tiny muted">عليه ${money(row.reminder.balance)}</div></div>
                <div class="row" style="gap:5px">
                  <button class="btn xs secondary" data-copy="${index}">${icon('copy')}نسخ</button>
                  <a class="btn xs" href="${escapeHTML(row.reminder.whatsapp)}" target="_blank" rel="noopener">${icon('message')}واتساب</a>
                </div>
              </div>
              <div class="tiny mt-2" style="color:var(--ink-2);line-height:1.9;background:var(--surface-2);border-radius:9px;padding:8px 10px">${escapeHTML(row.reminder.message)}</div>
            </div>`,
          )
          .join('')}</div>`
      : emptyHTML('message', 'مفيش رسائل', ''),
    onMount: ({ body }) => {
      body.querySelectorAll('[data-copy]').forEach((button) => {
        button.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(messages[Number(button.dataset.copy)].reminder.message);
            toast('الرسالة اتنسخت');
          } catch {
            toast('مش قادر أنسخ دلوقتي', 'error');
          }
        });
      });
    },
  });
}

/* ---------------- print ---------------- */
function printFinance(range, summary, data) {
  const methodRows = Object.entries(summary.methods || {})
    .map(([key, value]) => `<tr><td>${escapeHTML(METHOD_LABELS[key] || key)}</td><td>${money(value)}</td></tr>`)
    .join('');
  const dueRows = (summary.dues || [])
    .map(
      (due) => `<tr><td>${escapeHTML(due.studentName)}</td><td dir="ltr">${escapeHTML(due.phone || '')}</td>
      <td>${money(due.balance)}</td><td>${due.oldestDue ? escapeHTML(due.oldestDue) : '—'}</td></tr>`,
    )
    .join('');
  printHTML(`<div class="print-sheet">
    <div class="print-head">
      <div><h1 style="margin:0;font-size:22px">كشف حساب الفترة</h1>
        <div style="font-size:12px;color:#555;margin-top:4px">${escapeHTML(dateFull(range.from))} — ${escapeHTML(dateFull(range.to))}</div></div>
      <div style="font-size:11px;text-align:end">${escapeHTML(pageData.settings.centerName || 'دفتري')}</div>
    </div>
    <div class="print-totals"><span>الدخل ${money(summary.totals.income)}</span><span>المصروفات ${money(summary.totals.expenses)}</span><span>الصافي ${money(summary.totals.net)}</span></div>
    <table class="print-table"><thead><tr><th>طريقة الدفع</th><th>المبلغ</th></tr></thead><tbody>${methodRows || '<tr><td colspan="2">مفيش دفعات</td></tr>'}</tbody></table>
    <h2 style="font-size:15px;margin:22px 0 8px">المتأخرات</h2>
    <table class="print-table"><thead><tr><th>الطالب</th><th>الموبايل</th><th>المتأخر</th><th>أقدم استحقاق</th></tr></thead>
      <tbody>${dueRows || '<tr><td colspan="4">مفيش متأخرات</td></tr>'}</tbody></table>
    <div style="margin-top:20px;font-size:10px;color:#777;text-align:center">اتطبع في ${escapeHTML(dateFull(todayISO()))} — ${escapeHTML(String(data.payments.total || 0))} دفعة و${escapeHTML(String(data.expenses.total || 0))} مصروف</div>
  </div>`);
}

/* ---------------- render ---------------- */
export async function render(ctx) {
  const range = resolveRange(ctx.query);
  const tab = ['dues', 'payments', 'charges', 'expenses'].includes(ctx.query?.get('tab')) ? ctx.query.get('tab') : 'dues';
  const [summary, charges, payments, expenses] = await Promise.all([
    api.get(`/api/finance/summary?from=${range.from}&to=${range.to}`),
    api.get(`/api/charges?from=${range.from}&to=${range.to}&limit=500`),
    api.get(`/api/payments?from=${range.from}&to=${range.to}&limit=500`),
    api.get(`/api/expenses?from=${range.from}&to=${range.to}`),
  ]);
  pageData = {
    range,
    tab,
    summary,
    charges,
    payments,
    expenses,
    isAdmin: ctx.user.role === 'admin',
    settings: ctx.settings || {},
  };
  const netPositive = summary.totals.net >= 0;
  ctx.setTitle('الحسابات', `${range.label} · ${dateShort(range.from)} — ${dateShort(range.to)}`);
  const tabs = [
    ['dues', 'المتأخرات', summary.dues?.length || 0],
    ['payments', 'الدفعات', payments.total || 0],
    ['charges', 'المستحقات', charges.total || 0],
    ['expenses', 'المصروفات', expenses.total || 0],
  ];

  return `<div class="page">
    <div class="page-head">
      <div><h1>الحسابات</h1>
        <div class="sub">${summary.totals.debtors || 0} طالب عليهم متأخرات · ${summary.totals.payments || 0} دفعة في الفترة</div></div>
      <div class="page-actions">
        <button class="btn secondary" data-print>${icon('print')}طباعة الكشف</button>
        <button class="btn secondary" data-export="summary">${icon('download')}CSV</button>
        <button class="btn" data-new-payment>${icon('plus')}دفعة</button>
      </div>
    </div>

    <section class="card mb-3">
      <div class="row-between" style="flex-wrap:wrap;gap:10px">
        <div class="range-tabs">
          ${Object.entries(range.presets)
            .map(
              ([key, preset]) =>
                `<a href="${rangeLink(key, range, tab)}" class="${range.key === key ? 'active' : ''}">${escapeHTML(preset.label)}</a>`,
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
        label: 'الدخل المحصّل',
        value: money(summary.totals.income),
        foot: `${summary.totals.payments || 0} دفعة · متوسط ${money(summary.totals.averagePayment || 0)}`,
        iconName: 'wallet',
        color: 'var(--teal)',
        soft: 'var(--teal-soft)',
      })}
      ${kpi({
        label: 'المصروفات',
        value: money(summary.totals.expenses),
        foot: `${summary.totals.expenseCount || 0} مصروف في الفترة`,
        iconName: 'credit',
        color: 'var(--saffron)',
        soft: 'var(--saffron-soft)',
      })}
      ${kpi({
        label: 'الصافي',
        value: money(summary.totals.net),
        foot: `<span class="${netPositive ? 'trend-up' : 'trend-down'}">${netPositive ? 'مكسب' : 'خسارة'}</span> بعد كل المصروفات`,
        iconName: 'trend',
        color: netPositive ? 'var(--teal)' : 'var(--coral)',
        soft: netPositive ? 'var(--teal-soft)' : 'var(--coral-soft)',
      })}
      ${kpi({
        label: 'المتأخرات',
        value: money(summary.totals.outstanding),
        foot: `${summary.totals.debtors || 0} طالب محتاج متابعة`,
        iconName: 'receipt',
        color: 'var(--coral)',
        soft: 'var(--coral-soft)',
        href: tabLink('dues', range),
      })}
    </div>

    <div class="report-grid mb-3">
      ${agingCard(summary)}
      ${methodsCard(summary)}
    </div>

    <section class="card mb-3">
      <div class="card-head">
        <div><h2>الدخل والمصروف</h2><div class="sub">حسب الشهور داخل الفترة</div></div>
        <div class="legend"><span><i style="background:var(--teal)"></i>دخل</span><span><i style="background:var(--saffron)"></i>مصروف</span></div>
      </div>
      ${monthChart(summary.byMonth)}
    </section>

    <div class="tabs" style="margin-bottom:14px">
      ${tabs.map(([key, label, count]) => tabButton(key, label, count, tab === key)).join('')}
    </div>

    <div data-pane="dues" ${tab === 'dues' ? '' : 'hidden'}>${duesTable(summary, range)}</div>
    <div data-pane="payments" ${tab === 'payments' ? '' : 'hidden'}>${paymentsTable({ payments }, range)}</div>
    <div data-pane="charges" ${tab === 'charges' ? '' : 'hidden'}>${chargesTable({ charges })}</div>
    <div data-pane="expenses" ${tab === 'expenses' ? '' : 'hidden'}>${expensesTable({ expenses })}</div>
  </div>`;
}

/* ---------------- mount ---------------- */
export async function mount(root, ctx) {
  if (!pageData) return;
  const { range, summary, payments, charges, expenses, isAdmin } = pageData;

  /* tabs */
  root.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b === button));
      root.querySelectorAll('[data-pane]').forEach((pane) => {
        pane.hidden = pane.dataset.pane !== button.dataset.tab;
      });
      const next = tabLink(button.dataset.tab, range);
      if (location.hash !== next) history.replaceState(null, '', next);
    });
  });

  /* range form */
  root.querySelector('[data-range-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const from = form.querySelector('[name="from"]').value;
    const to = form.querySelector('[name="to"]').value;
    if (!from || !to || from > to) {
      toast('اختار فترة صحيحة', 'error');
      return;
    }
    location.hash = `#/finance?from=${from}&to=${to}&tab=${pageData.tab}`;
  });

  const refresh = () => ctx.refresh();

  /* filter helpers */
  const filterRows = (selector, needle, attr, value) => {
    const query = String(needle || '').trim().toLowerCase();
    root.querySelectorAll(selector).forEach((row) => {
      const textMatch = !query || row.textContent.toLowerCase().includes(query);
      const attrMatch = !value || row.dataset[attr] === value;
      row.hidden = !(textMatch && attrMatch);
    });
  };
  const bindFilter = (name, selector, attr) => {
    const search = root.querySelector(`[data-filter="${name}-search"]`);
    const select = root.querySelector(`[data-filter="${name}-${attr || 'all'}"]`);
    const apply = () => filterRows(selector, search?.value, attr || 'all', select?.value);
    search?.addEventListener('input', apply);
    select?.addEventListener('change', apply);
  };
  bindFilter('dues', '[data-dues-row]', 'age');
  bindFilter('payments', '[data-payments-row]', 'method');
  bindFilter('charges', '[data-charges-row]', 'status');
  // second charges select filters type too
  const chargeType = root.querySelector('[data-filter="charges-type"]');
  chargeType?.addEventListener('change', () => {
    const status = root.querySelector('[data-filter="charges-status"]')?.value || '';
    const search = root.querySelector('[data-filter="charges-search"]')?.value || '';
    const query = String(search).trim().toLowerCase();
    root.querySelectorAll('[data-charges-row]').forEach((row) => {
      const textMatch = !query || row.textContent.toLowerCase().includes(query);
      const statusMatch = !status || row.dataset.status === status;
      const typeMatch = !chargeType.value || row.dataset.type === chargeType.value;
      row.hidden = !(textMatch && statusMatch && typeMatch);
    });
  });
  bindFilter('expenses', '[data-expenses-row]', 'category');

  /* new buttons */
  root.querySelectorAll('[data-new-payment]').forEach((button) =>
    button.addEventListener('click', () => paymentModal({ onSaved: refresh })),
  );
  root.querySelectorAll('[data-new-charge]').forEach((button) =>
    button.addEventListener('click', () => chargeModal({ onSaved: refresh })),
  );
  root.querySelectorAll('[data-new-expense]').forEach((button) =>
    button.addEventListener('click', () => expenseModal({ onSaved: refresh })),
  );
  root.querySelectorAll('[data-bulk]').forEach((button) =>
    button.addEventListener('click', () => bulkChargesModal(refresh, range)),
  );

  /* row actions */
  root.querySelectorAll('[data-pay-student]').forEach((button) => {
    button.addEventListener('click', () =>
      paymentModal({ studentId: button.dataset.payStudent, presetAmount: Number(button.dataset.amount) || null, onSaved: refresh }),
    );
  });
  root.querySelectorAll('[data-charge-pay]').forEach((button) => {
    button.addEventListener('click', () =>
      paymentModal({ studentId: button.dataset.chargePay, presetAmount: Number(button.dataset.amount) || null, onSaved: refresh }),
    );
  });
  root.querySelectorAll('[data-remind]').forEach((button) => {
    button.addEventListener('click', () => reminderModal(button.dataset.remind, 'payment'));
  });
  root.querySelectorAll('[data-remind-all-dues]').forEach((button) => {
    button.addEventListener('click', () => remindAllDues(summary.dues));
  });
  root.querySelectorAll('[data-receipt]').forEach((button) => {
    button.addEventListener('click', () => receiptModal(button.dataset.receipt));
  });

  const findPayment = (id) => (payments.items || []).find((item) => item.id === id);
  const findCharge = (id) => (charges.items || []).find((item) => item.id === id);
  const findExpense = (id) => (expenses.items || []).find((item) => item.id === id);

  root.querySelectorAll('[data-edit-payment]').forEach((button) => {
    button.addEventListener('click', () => {
      const payment = findPayment(button.dataset.editPayment);
      if (payment) editPaymentModal(payment, refresh);
    });
  });
  root.querySelectorAll('[data-edit-charge]').forEach((button) => {
    button.addEventListener('click', () => {
      const charge = findCharge(button.dataset.editCharge);
      if (charge) editChargeModal(charge, refresh);
    });
  });
  root.querySelectorAll('[data-edit-expense]').forEach((button) => {
    button.addEventListener('click', () => {
      const expense = findExpense(button.dataset.editExpense);
      if (expense) editExpenseModal(expense, refresh);
    });
  });

  root.querySelectorAll('[data-delete-payment]').forEach((button) => {
    button.addEventListener('click', () => {
      const payment = findPayment(button.dataset.deletePayment);
      if (!payment) return;
      deleteConfirm({
        title: 'حذف الدفعة',
        message: `هتتمسح دفعة ${money(payment.amount)} للطالب ${payment.studentName}. الرصيد هيتعدل.`,
        onConfirm: async () => {
          await api.delete(`/api/payments/${payment.id}`);
          refresh();
        },
      });
    });
  });
  root.querySelectorAll('[data-delete-charge]').forEach((button) => {
    button.addEventListener('click', () => {
      const charge = findCharge(button.dataset.deleteCharge);
      if (!charge) return;
      deleteConfirm({
        title: 'حذف المستحق',
        message: `هتتمسح ${charge.title} — ${money(charge.amount)}.`,
        onConfirm: async () => {
          await api.delete(`/api/charges/${charge.id}`);
          refresh();
        },
      });
    });
  });
  root.querySelectorAll('[data-delete-expense]').forEach((button) => {
    button.addEventListener('click', () => {
      const expense = findExpense(button.dataset.deleteExpense);
      if (!expense) return;
      deleteConfirm({
        title: 'حذف المصروف',
        message: `هتتمسح ${expense.title} — ${money(expense.amount)}.`,
        onConfirm: async () => {
          await api.delete(`/api/expenses/${expense.id}`);
          refresh();
        },
      });
    });
  });

  /* exports */
  const exportURLs = {
    dues: '/api/exports/dues.csv',
    payments: `/api/exports/payments.csv?from=${range.from}&to=${range.to}`,
    charges: `/api/exports/charges.csv?from=${range.from}&to=${range.to}`,
    expenses: `/api/exports/expenses.csv?from=${range.from}&to=${range.to}`,
    summary: `/api/exports/report.csv?from=${range.from}&to=${range.to}`,
  };
  root.querySelectorAll('[data-export]').forEach((button) => {
    button.addEventListener('click', () => downloadURL(exportURLs[button.dataset.export] || exportURLs.summary));
  });

  root.querySelector('[data-print]')?.addEventListener('click', () =>
    printFinance(range, summary, { payments, expenses }),
  );

  /* auto-open from query */
  const wantNew = ctx.query?.get('new');
  if (wantNew === 'payment') paymentModal({ studentId: ctx.query.get('student') || '', onSaved: refresh });
  if (wantNew === 'charge') chargeModal({ onSaved: refresh });
  if (wantNew === 'expense') expenseModal({ onSaved: refresh });
  if (ctx.query?.get('bulk') === '1') bulkChargesModal(refresh, range);
}
