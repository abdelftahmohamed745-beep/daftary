'use strict';

import { api, money, escapeHTML, dateFull, downloadURL, todayISO, addDaysISO, METHOD_LABELS } from '../api.js';
import { icon, toast, emptyHTML, confirmModal } from '../ui.js';
import { treasuryModal } from '../feature-forms.js';

const METHOD_NAMES = { cash: 'كاش', vodafone: 'فودافون كاش', instapay: 'إنستاباي', bank: 'بنكي', other: 'تانية' };

function summaryCard(label, value, iconName, color, soft, foot = '') {
  return `<div class="kpi" style="--kpi:${color};--kpi-soft:${soft}">
    <div class="kpi-top"><span>${escapeHTML(label)}</span><span class="kpi-icon">${icon(iconName)}</span></div>
    <div class="kpi-value">${value}</div>
    ${foot ? `<div class="kpi-foot">${foot}</div>` : ''}
  </div>`;
}

function rowHTML(entry) {
  const deposit = entry.type === 'deposit';
  return `<tr data-id="${entry.id}">
    <td class="small">${escapeHTML(dateFull(entry.date))}</td>
    <td><div class="row"><span class="alert-icon ${deposit ? 'good' : 'bad'}" style="width:28px;height:28px">${icon(deposit ? 'arrowDown' : 'arrowUp')}</span>
      <div><div class="strong small">${escapeHTML(entry.title)}</div>
      <div class="tiny muted">${escapeHTML(entry.note || '')}</div></div></div></td>
    <td><span class="badge ${deposit ? 'green' : 'red'}">${deposit ? 'إيداع' : 'سحب'}</span></td>
    <td class="small">${escapeHTML(METHOD_NAMES[entry.method] || entry.method || '—')}</td>
    <td class="small muted">${escapeHTML(entry.by || '')}</td>
    <td class="num strong ${deposit ? 'ok' : 'debt'}">${deposit ? '+' : '−'}${money(entry.amount)}</td>
    <td class="end"><button class="icon-btn danger" data-delete title="حذف">${icon('trash')}</button></td>
  </tr>`;
}

function tableHTML(entries) {
  if (!entries.length) return emptyHTML('wallet', 'مفيش حركات في الفترة دي', 'سجّل أول إيداع أو مصروف من الخزنة.');
  return `<div class="table-wrap"><table class="table">
    <thead><tr><th>التاريخ</th><th>البيان</th><th>النوع</th><th>الطريقة</th><th>بواسطة</th><th class="num">المبلغ</th><th></th></tr></thead>
    <tbody>${entries.map(rowHTML).join('')}</tbody></table></div>`;
}

export async function render(ctx) {
  const from = ctx.query.get('from') || addDaysISO(todayISO(), -60);
  const to = ctx.query.get('to') || todayISO();
  const data = await api.get(`/api/treasury?from=${from}&to=${to}`);

  return `<div class="page">
    <div class="page-head">
      <div><h1>الخزنة</h1><div class="sub">${data.count} حركة في الفترة · رصيد ${money(data.balance)}</div></div>
      <div class="page-actions">
        <button class="btn secondary" data-export>${icon('download')}تصدير</button>
        <button class="btn" data-add>${icon('plus')}حركة جديدة</button>
      </div>
    </div>

    <div class="grid grid-4 mb-3">
      ${summaryCard('رصيد الخزنة', money(data.balance), 'wallet', 'var(--teal)', 'var(--teal-soft)', 'إيداع − سحب')}
      ${summaryCard('إجمالي الإيداعات', money(data.deposits), 'arrowDown', 'var(--blue)', 'var(--blue-soft)')}
      ${summaryCard('إجمالي المسحوبات', money(data.withdrawals), 'arrowUp', 'var(--coral)', 'var(--coral-soft)')}
      ${summaryCard('تحصيل الفترة', money(data.collected), 'receipt', 'var(--saffron)', 'var(--saffron-soft)', 'من دفعات الطلبة')}
    </div>

    <div class="card mb-3">
      <div class="toolbar">
        <div class="field-inline"><label>من</label><input class="input" type="date" value="${from}" data-from></div>
        <div class="field-inline"><label>لحد</label><input class="input" type="date" value="${to}" data-to></div>
        <button class="btn secondary sm" data-range>${icon('filter')}تطبيق</button>
        <span class="grow"></span>
        <div class="row" style="gap:6px">
          ${Object.entries(data.byMethod).map(([method, value]) => `<span class="chip"><span class="dot" style="--c:${value >= 0 ? 'var(--teal)' : 'var(--coral)'}"></span>${escapeHTML(METHOD_NAMES[method] || method)}: ${money(value)}</span>`).join('')}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div><h2>حركات الخزنة</h2><div class="sub">مرتبة من الأحدث للأقدم</div></div></div>
      <div data-list>${tableHTML(data.entries)}</div>
    </div>
  </div>`;
}

export async function mount(root, ctx) {
  const listEl = root.querySelector('[data-list]');
  const fromEl = root.querySelector('[data-from]');
  const toEl = root.querySelector('[data-to]');

  const bind = () => {
    listEl.querySelectorAll('[data-id]').forEach((row) => {
      row.querySelector('[data-delete]')?.addEventListener('click', () => {
        confirmModal({
          title: 'حذف الحركة؟',
          message: 'الحركة هتتشال من الخزنة نهائياً.',
          danger: true,
          onConfirm: async () => {
            await api.delete(`/api/treasury/${row.dataset.id}`);
            toast('الحركة اتحذفت');
            ctx.refresh();
          },
        });
      });
    });
  };

  root.querySelector('[data-range]')?.addEventListener('click', () => {
    location.hash = `#/treasury?from=${fromEl.value}&to=${toEl.value}`;
  });
  root.querySelector('[data-add]')?.addEventListener('click', () => treasuryModal({ onSaved: () => ctx.refresh() }));
  root.querySelector('[data-export]')?.addEventListener('click', () => {
    downloadURL(`/api/treasury/csv?from=${fromEl.value}&to=${toEl.value}`);
  });
  bind();
  if (ctx.query?.get('new') === '1') treasuryModal({ onSaved: () => ctx.refresh() });
}
