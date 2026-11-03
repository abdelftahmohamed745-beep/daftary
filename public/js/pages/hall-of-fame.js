'use strict';

import { api, escapeHTML, formatNumber } from '../api.js';
import { icon, avatarHTML, toast, emptyHTML, openModal } from '../ui.js';
import { pointModal } from '../feature-forms.js';
import { loadGroups } from '../forms.js';

function summaryCard(label, value, iconName, color, soft) {
  return `<div class="kpi" style="--kpi:${color};--kpi-soft:${soft}">
    <div class="kpi-top"><span>${escapeHTML(label)}</span><span class="kpi-icon">${icon(iconName)}</span></div>
    <div class="kpi-value">${value}</div>
  </div>`;
}

function podiumHTML(items) {
  if (!items.length) return '';
  const order = [1, 0, 2];
  return `<div class="podium">${order
    .map((index) => {
      const row = items[index];
      if (!row) return '';
      const place = index + 1;
      return `<div class="podium-slot place-${place}">
        <div class="podium-avatar">${avatarHTML(row.fullName, row.avatarColor)}
          <span class="podium-medal">${place}</span>
        </div>
        <div class="strong small truncate">${escapeHTML(row.name)}</div>
        <div class="tiny muted">${escapeHTML(row.grade || '')}</div>
        <div class="podium-points">${formatNumber(row.total)} <small>نقطة</small></div>
        <div class="podium-base">${place}</div>
      </div>`;
    })
    .join('')}</div>`;
}

function rowHTML(row) {
  return `<tr data-id="${row.studentId}">
    <td class="num"><span class="rank-badge ${row.rank <= 3 ? 'top' : ''}">${row.rank}</span></td>
    <td><div class="row">${avatarHTML(row.fullName, row.avatarColor, 'sm')}
      <div><div class="strong small">${escapeHTML(row.name)}</div>
      <div class="tiny muted">${escapeHTML(row.grade || '')}</div></div></div></td>
    <td class="num"><span class="badge ${row.total > 0 ? 'green' : row.total < 0 ? 'red' : 'gray'}">${formatNumber(row.total)}</span></td>
    <td class="num small">${row.attendancePoints}</td>
    <td class="num small">${row.manualPoints}</td>
    <td class="num small">${row.present} / ${row.absent}</td>
    <td class="num small">${row.gradePercent}%</td>
    <td class="end"><div class="row" style="justify-content:flex-end">
      <button class="icon-btn" data-history title="سجل النقاط">${icon('clock')}</button>
      <button class="btn xs secondary" data-add>${icon('plus')}نقاط</button>
    </div></td>
  </tr>`;
}

export async function render(ctx) {
  const groupId = ctx.query.get('groupId') || '';
  const data = await api.get(`/api/hall-of-fame?${groupId ? `groupId=${groupId}&` : ''}limit=100`);
  const groups = await loadGroups();
  const top = data.items.slice(0, 3);

  return `<div class="page">
    <div class="page-head">
      <div><h1>لوحة الشرف</h1><div class="sub">${data.stats.participants} طالب · متوسط ${data.stats.average} نقطة · أعلى ${formatNumber(data.stats.topPoints)} نقطة</div></div>
      <div class="page-actions">
        <select class="select" data-group>
          <option value="">كل المجموعات</option>
          ${groups.map((g) => `<option value="${g.id}" ${groupId === g.id ? 'selected' : ''}>${escapeHTML(g.name)}</option>`).join('')}
        </select>
        <button class="btn" data-add>${icon('plus')}إضافة نقاط</button>
      </div>
    </div>

    <div class="grid grid-4 mb-3">
      ${summaryCard('المشاركين', data.stats.participants, 'users', 'var(--teal)', 'var(--teal-soft)')}
      ${summaryCard('متوسط النقاط', data.stats.average, 'chart', 'var(--saffron)', 'var(--saffron-soft)')}
      ${summaryCard('أعلى نقاط', formatNumber(data.stats.topPoints), 'award', 'var(--blue)', 'var(--blue-soft)')}
      ${summaryCard('غياب مسجل', data.stats.absentTotal, 'alert', 'var(--coral)', 'var(--coral-soft)')}
    </div>

    ${top.length ? `<section class="card mb-3"><div class="card-head"><div><h2>المنصة</h2><div class="sub">أفضل ٣ طلبة حسب إجمالي النقاط</div></div></div>${podiumHTML(top)}</section>` : ''}

    <div class="card">
      <div class="card-head"><div><h2>ترتيب الطلبة</h2><div class="sub">النقاط بتتحسب من الحضور + الدرجات + النقاط اليدوية</div></div></div>
      ${data.items.length
        ? `<div class="table-wrap"><table class="table">
            <thead><tr><th class="num">#</th><th>الطالب</th><th class="num">النقاط</th><th class="num">حضور</th><th class="num">يدوي</th><th class="num">ح/غ</th><th class="num">الدرجات</th><th></th></tr></thead>
            <tbody>${data.items.map(rowHTML).join('')}</tbody></table></div>`
        : emptyHTML('award', 'مفيش طلبة', 'ضيف طلبة الأول عشان تبدأ لوحة الشرف.')}
    </div>
  </div>`;
}

export async function mount(root, ctx) {
  root.querySelector('[data-group]')?.addEventListener('change', (event) => {
    const value = event.target.value;
    location.hash = value ? `#/hall-of-fame?groupId=${value}` : '#/hall-of-fame';
  });
  root.querySelector('[data-add]')?.addEventListener('click', () => pointModal({ onSaved: () => ctx.refresh() }));

  root.querySelectorAll('[data-id]').forEach((row) => {
    const id = row.dataset.id;
    row.querySelector('[data-add]')?.addEventListener('click', () => pointModal({ studentId: id, onSaved: () => ctx.refresh() }));
    row.querySelector('[data-history]')?.addEventListener('click', async () => {
      const data = await api.get('/api/points');
      const record = data.items.find((item) => item.studentId === id);
      const entries = record?.entries || [];
      openModal({
        title: 'سجل النقاط',
        sub: record ? `${record.fullName} — إجمالي ${formatNumber(record.total)} نقطة` : '',
        narrow: true,
        body: entries.length
          ? `<div class="stack-sm">${entries
              .map((entry) => `<div class="point-row">
                <span class="badge ${entry.points >= 0 ? 'green' : 'red'}">${entry.points >= 0 ? '+' : ''}${formatNumber(entry.points)}</span>
                <div class="grow"><div class="small">${escapeHTML(entry.reason || 'نقاط يدوية')}</div>
                <div class="tiny muted">${escapeHTML(entry.createdBy || '')} · ${escapeHTML(String(entry.at || '').slice(0, 10))}</div></div>
                <button class="icon-btn danger" data-del="${entry.id}" title="حذف">${icon('trash')}</button>
              </div>`)
              .join('')}</div>`
          : `<div class="empty" style="padding:24px"><p>مفيش نقاط يدوية مسجلة للطالب ده.</p></div>`,
        footer: `<button class="btn secondary" data-close>قفل</button>`,
        onMount: ({ root: modal, close }) => {
          modal.querySelectorAll('[data-del]').forEach((button) => {
            button.addEventListener('click', async () => {
              await api.delete(`/api/points/${button.dataset.del}`);
              toast('النقاط اتحذفت');
              close();
              ctx.refresh();
            });
          });
        },
      });
    });
  });
}
