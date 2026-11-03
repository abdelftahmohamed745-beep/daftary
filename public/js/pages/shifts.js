'use strict';

import { api, escapeHTML, dateFull, relativeDay, timeLabel, todayISO } from '../api.js';
import { icon, avatarHTML, toast, emptyHTML, confirmModal } from '../ui.js';
import { shiftModal } from '../feature-forms.js';

function summaryCard(label, value, iconName, color, soft) {
  return `<div class="kpi" style="--kpi:${color};--kpi-soft:${soft}">
    <div class="kpi-top"><span>${escapeHTML(label)}</span><span class="kpi-icon">${icon(iconName)}</span></div>
    <div class="kpi-value">${value}</div>
  </div>`;
}

function hoursBetween(shift) {
  const [sh, sm] = String(shift.start).split(':').map(Number);
  const [eh, em] = String(shift.end).split(':').map(Number);
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
}

function rowHTML(shift, staff) {
  const person = staff.find((u) => u.id === shift.userId) || {};
  const today = shift.date === todayISO();
  return `<tr data-id="${shift.id}" class="${today ? 'row-today' : ''}">
    <td><div class="row">${avatarHTML(person.name || shift.userName, person.avatarColor || '#2f6f5e', 'sm')}
      <div><div class="strong small">${escapeHTML(person.name || shift.userName)}</div>
      <div class="tiny muted">${escapeHTML(shift.role || '')}</div></div></div></td>
    <td class="small">${escapeHTML(dateFull(shift.date))}${today ? ' <span class="badge green tiny">النهارده</span>' : ''}</td>
    <td class="small mono" dir="ltr" style="text-align:end">${escapeHTML(shift.start)} — ${escapeHTML(shift.end)}</td>
    <td class="num small">${hoursBetween(shift)} ساعة</td>
    <td><span class="badge ${shift.status === 'open' ? 'amber' : 'gray'}">${shift.status === 'open' ? 'مفتوحة' : 'مقفولة'}</span></td>
    <td class="end"><div class="row" style="justify-content:flex-end">
      ${shift.status === 'open' ? `<button class="btn xs secondary" data-close-shift>${icon('check')}قفل</button>` : ''}
      <button class="icon-btn" data-edit title="تعديل">${icon('settings')}</button>
      <button class="icon-btn danger" data-delete title="حذف">${icon('trash')}</button>
    </div></td>
  </tr>`;
}

function tableHTML(items, staff) {
  if (!items.length) return emptyHTML('clock', 'مفيش ورديات', 'سجّل أول وردية لفريق المركز.');
  return `<div class="table-wrap"><table class="table">
    <thead><tr><th>الموظف</th><th>اليوم</th><th>الوقت</th><th class="num">المدة</th><th>الحالة</th><th></th></tr></thead>
    <tbody>${items.map((shift) => rowHTML(shift, staff)).join('')}</tbody></table></div>`;
}

export async function render(ctx) {
  const data = await api.get('/api/shifts');
  const today = data.items.filter((s) => s.date === todayISO());
  const upcoming = data.items.filter((s) => s.date > todayISO()).slice(0, 8);

  return `<div class="page">
    <div class="page-head">
      <div><h1>ورديات الفريق</h1><div class="sub">${data.summary.total} وردية · ${data.summary.today} النهارده · ${data.summary.hours} ساعة</div></div>
      <div class="page-actions"><button class="btn" data-add>${icon('plus')}وردية جديدة</button></div>
    </div>

    <div class="grid grid-4 mb-3">
      ${summaryCard('إجمالي الورديات', data.summary.total, 'clock', 'var(--teal)', 'var(--teal-soft)')}
      ${summaryCard('ورديات النهارده', data.summary.today, 'calendar', 'var(--saffron)', 'var(--saffron-soft)')}
      ${summaryCard('مفتوحة', data.summary.open, 'activity', 'var(--blue)', 'var(--blue-soft)')}
      ${summaryCard('إجمالي الساعات', data.summary.hours, 'chart', 'var(--plum)', 'var(--plum-soft)')}
    </div>

    <div class="grid grid-2 mb-3">
      <section class="card">
        <div class="card-head"><div><h2>ورديات النهارده</h2><div class="sub">${escapeHTML(dateFull(todayISO()))}</div></div></div>
        ${today.length
          ? `<div class="stack-sm">${today.map((shift) => {
              const person = data.staff.find((u) => u.id === shift.userId) || {};
              return `<div class="shift-today ${shift.status === 'open' ? 'open' : ''}">
                ${avatarHTML(person.name || shift.userName, person.avatarColor || '#2f6f5e', 'sm')}
                <div class="grow"><div class="strong small">${escapeHTML(person.name || shift.userName)}</div>
                <div class="tiny muted">${escapeHTML(shift.role || '')} · ${escapeHTML(timeLabel(shift.start))} — ${escapeHTML(timeLabel(shift.end))}</div></div>
                <span class="badge ${shift.status === 'open' ? 'green' : 'gray'} dot">${shift.status === 'open' ? 'مفتوحة' : 'خلصت'}</span>
              </div>`;
            }).join('')}</div>`
          : emptyHTML('clock', 'مفيش ورديات النهارده', 'ضيف وردية للفريق.')}
      </section>
      <section class="card">
        <div class="card-head"><div><h2>الورديات الجاية</h2><div class="sub">أقرب ٨ ورديات</div></div></div>
        ${upcoming.length
          ? `<div class="stack-sm">${upcoming.map((shift) => `<div class="shift-today">
              <span class="alert-icon info">${icon('clock')}</span>
              <div class="grow"><div class="strong small">${escapeHTML(shift.userName)}</div>
              <div class="tiny muted">${escapeHTML(relativeDay(shift.date))} · ${escapeHTML(shift.start)} — ${escapeHTML(shift.end)}</div></div>
              <span class="badge blue">${escapeHTML(shift.role || '')}</span>
            </div>`).join('')}</div>`
          : emptyHTML('calendar', 'مفيش ورديات قادمة', '')}
      </section>
    </div>

    <div class="card">
      <div class="card-head"><div><h2>سجل الورديات</h2><div class="sub">كل الورديات المسجلة</div></div></div>
      <div data-list>${tableHTML(data.items, data.staff)}</div>
    </div>
  </div>`;
}

export async function mount(root, ctx) {
  const staff = (await api.get('/api/shifts')).staff;
  const listEl = root.querySelector('[data-list]');

  const bind = () => {
    listEl.querySelectorAll('[data-id]').forEach((row) => {
      const id = row.dataset.id;
      row.querySelector('[data-edit]')?.addEventListener('click', async () => {
        const data = await api.get('/api/shifts');
        const shift = data.items.find((item) => item.id === id);
        shiftModal({ shift, staff, onSaved: () => ctx.refresh() });
      });
      row.querySelector('[data-close-shift]')?.addEventListener('click', async () => {
        await api.patch(`/api/shifts/${id}`, { status: 'closed' });
        toast('الوردية اتقفلت');
        ctx.refresh();
      });
      row.querySelector('[data-delete]')?.addEventListener('click', () => {
        confirmModal({
          title: 'حذف الوردية؟',
          message: 'الوردية هتتشال من السجل.',
          danger: true,
          onConfirm: async () => {
            await api.delete(`/api/shifts/${id}`);
            toast('الوردية اتحذفت');
            ctx.refresh();
          },
        });
      });
    });
  };

  root.querySelector('[data-add]')?.addEventListener('click', () => shiftModal({ staff, onSaved: () => ctx.refresh() }));
  bind();
  if (ctx.query?.get('new') === '1') shiftModal({ staff, onSaved: () => ctx.refresh() });
}
