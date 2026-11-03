'use strict';

import {
  api,
  money,
  escapeHTML,
  dateShort,
  debounce,
  relativeDay,
  downloadURL,
} from '../api.js';
import { icon, avatarHTML, ringHTML, toast, emptyHTML, confirmModal } from '../ui.js';
import {
  studentModal,
  paymentModal,
  chargeModal,
  reminderModal,
  loadGroups,
  deleteConfirm,
} from '../forms.js';

export async function render(ctx) {
  const query = ctx.query || new URLSearchParams();
  const params = new URLSearchParams();
  for (const key of ['search', 'status', 'groupId', 'grade', 'dues', 'sort', 'dir']) {
    if (query.get(key)) params.set(key, query.get(key));
  }
  if (!params.get('status')) params.set('status', 'all');
  params.set('limit', '500');
  const [data, groups] = await Promise.all([
    api.get(`/api/students?${params.toString()}`),
    loadGroups(),
  ]);
  const q = Object.fromEntries(params.entries());

  return `<div class="page">
    <div class="page-head">
      <div>
        <h1>الطلبة</h1>
        <div class="sub">${data.total} طالب مسجل · ${data.summary.active} نشط · ${data.summary.debtors} عليهم متأخرات</div>
      </div>
      <div class="page-actions">
        <button class="btn secondary" data-export>${icon('download')}تصدير Excel</button>
        <button class="btn" data-add-student>${icon('plus')}طالب جديد</button>
      </div>
    </div>

    <div class="grid grid-4 mb-3">
      ${summaryCard('إجمالي الطلبة', data.summary.total, 'users', 'var(--teal)', 'var(--teal-soft)')}
      ${summaryCard('نشطين', data.summary.active, 'checkCircle', 'var(--blue)', 'var(--blue-soft)')}
      ${summaryCard('موقوفين', data.summary.paused, 'clock', 'var(--saffron)', 'var(--saffron-soft)')}
      ${summaryCard('إجمالي المتأخرات', money(data.summary.dues), 'wallet', 'var(--coral)', 'var(--coral-soft)')}
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="search">${icon('search')}
          <input class="input" type="search" placeholder="دوّر بالاسم، الموبايل، المدرسة…" value="${escapeHTML(q.search || '')}" data-search>
        </div>
        <select class="select" data-filter="status">
          <option value="all">كل الحالات</option>
          <option value="active" ${q.status === 'active' ? 'selected' : ''}>نشط</option>
          <option value="paused" ${q.status === 'paused' ? 'selected' : ''}>موقوف</option>
          <option value="left" ${q.status === 'left' ? 'selected' : ''}>منسحب</option>
        </select>
        <select class="select" data-filter="groupId">
          <option value="">كل المجموعات</option>
          ${groups.map((g) => `<option value="${g.id}" ${q.groupId === g.id ? 'selected' : ''}>${escapeHTML(g.name)}</option>`).join('')}
        </select>
        <select class="select" data-filter="grade">
          <option value="">كل الصفوف</option>
          ${(data.grades || []).map((g) => `<option value="${escapeHTML(g)}" ${q.grade === g ? 'selected' : ''}>${escapeHTML(g)}</option>`).join('')}
        </select>
        <select class="select" data-filter="sort">
          <option value="name" ${q.sort === 'name' || !q.sort ? 'selected' : ''}>بالاسم</option>
          <option value="balance" ${q.sort === 'balance' ? 'selected' : ''}>بالمتأخرات</option>
          <option value="joined" ${q.sort === 'joined' ? 'selected' : ''}>بالانضمام</option>
          <option value="attendance" ${q.sort === 'attendance' ? 'selected' : ''}>بالحضور</option>
        </select>
        <label class="checkline" style="white-space:nowrap"><input type="checkbox" data-filter="dues" ${q.dues === '1' ? 'checked' : ''}> عليهم فلوس بس</label>
        <div class="row" style="margin-inline-start:auto">
          <button class="icon-btn" data-view="grid" title="عرض كروت">${icon('grid')}</button>
          <button class="icon-btn" data-view="table" title="عرض جدول">${icon('menu')}</button>
        </div>
      </div>
      <div data-list>${listHTML(data.items)}</div>
    </div>
  </div>`;
}

function summaryCard(label, value, iconName, color, soft) {
  return `<div class="kpi" style="--kpi:${color};--kpi-soft:${soft}">
    <div class="kpi-top"><span>${escapeHTML(label)}</span><span class="kpi-icon">${icon(iconName)}</span></div>
    <div class="kpi-value">${value}</div>
  </div>`;
}

function studentCard(s) {
  const balanceClass = s.balance > 0 ? 'debt' : s.balance < 0 ? 'ok' : 'zero';
  return `<div class="student-card" data-open="${s.id}" role="button" tabindex="0">
    ${avatarHTML(s.name, s.avatarColor)}
    <div class="student-card-main">
      <div class="row-between">
        <div class="student-card-name truncate">${escapeHTML(s.name)}</div>
        ${s.status !== 'active' ? `<span class="badge ${s.status === 'paused' ? 'amber' : 'gray'}">${s.status === 'paused' ? 'موقوف' : 'منسحب'}</span>` : ''}
      </div>
      <div class="student-card-sub">${escapeHTML(s.grade || 'من غير صف')}${s.school ? ` · ${escapeHTML(s.school)}` : ''}</div>
      <div class="student-card-groups">
        ${(s.groups || []).slice(0, 3).map((g) => `<span class="chip"><span class="dot" style="--c:${escapeHTML(g.color)}"></span>${escapeHTML(g.name)}</span>`).join('')}
        ${(s.groups || []).length > 3 ? `<span class="chip">+${s.groups.length - 3}</span>` : ''}
        ${!(s.groups || []).length ? '<span class="chip muted">مش في مجموعة</span>' : ''}
      </div>
      <div class="student-card-foot">
        <div>
          <div class="money ${balanceClass}">${s.balance > 0 ? money(s.balance) : s.balance < 0 ? `${money(Math.abs(s.balance))} رصيد` : 'مسدد'}</div>
          <div class="tiny muted">${s.lastPaymentAt ? `آخر دفعة ${relativeDay(s.lastPaymentAt)}` : 'مفيش دفعات'}</div>
        </div>
        <div class="row" style="gap:4px">
          <button class="btn xs secondary" data-pay="${s.id}" title="تسجيل دفعة">${icon('wallet')}</button>
          <button class="btn xs secondary" data-charge="${s.id}" title="مستحق">${icon('receipt')}</button>
          ${ringHTML(s.attendanceRate, 'sm')}
        </div>
      </div>
    </div>
  </div>`;
}

function tableHTML(items) {
  return `<div class="table-wrap"><table class="table">
    <thead><tr><th>الطالب</th><th>الصف</th><th>المجموعات</th><th class="num">الرصيد</th><th class="num">الحضور</th><th>ولي الأمر</th><th></th></tr></thead>
    <tbody>${items.map((s) => `<tr>
      <td><div class="row" style="cursor:pointer" data-open="${s.id}">${avatarHTML(s.name, s.avatarColor, 'sm')}
        <div><div class="strong small">${escapeHTML(s.shortName || s.name)}</div><div class="tiny muted" dir="ltr" style="text-align:end">${escapeHTML(s.phone || '')}</div></div></div></td>
      <td class="small">${escapeHTML(s.grade || '—')}</td>
      <td class="small muted">${escapeHTML((s.groups || []).map((g) => g.name).join(' · ') || '—')}</td>
      <td class="num money ${s.balance > 0 ? 'debt' : s.balance < 0 ? 'ok' : 'zero'}">${money(s.balance)}</td>
      <td class="num">${s.attendanceRate}%</td>
      <td class="small" dir="ltr" style="text-align:end">${escapeHTML(s.parentPhone || '—')}</td>
      <td class="end"><button class="btn xs secondary" data-pay="${s.id}">دفعة</button></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function listHTML(items) {
  if (!items.length) {
    return emptyHTML('users', 'مفيش طلبة بالفلتر ده', 'جرّب تغيّر البحث أو تضيف طالب جديد.');
  }
  const view = localStorage.getItem('daftary-students-view') || 'grid';
  return view === 'table' ? tableHTML(items) : `<div class="student-grid">${items.map(studentCard).join('')}</div>`;
}

export async function mount(root, ctx) {
  let current = { ...Object.fromEntries((ctx.query || new URLSearchParams()).entries()) };
  if (!current.status) current.status = 'all';
  const listEl = root.querySelector('[data-list]');

  const setViewButtons = () => {
    const view = localStorage.getItem('daftary-students-view') || 'grid';
    root.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    root.querySelectorAll('[data-view]').forEach((b) => {
      b.style.background = b.dataset.view === view ? 'var(--teal-soft)' : '';
      b.style.color = b.dataset.view === view ? 'var(--teal)' : '';
    });
  };

  const bindList = () => {
    listEl.querySelectorAll('[data-open]').forEach((el) => {
      el.addEventListener('click', () => {
        location.hash = `#/students/${el.dataset.open}`;
      });
      el.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') location.hash = `#/students/${el.dataset.open}`;
      });
    });
    listEl.querySelectorAll('[data-pay]').forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.stopPropagation();
        await paymentModal({ studentId: btn.dataset.pay, onSaved: refresh });
      });
    });
    listEl.querySelectorAll('[data-charge]').forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.stopPropagation();
        await chargeModal({ studentId: btn.dataset.charge, onSaved: refresh });
      });
    });
  };

  const refresh = async () => {
    const params = new URLSearchParams();
    if (current.search) params.set('search', current.search);
    if (current.status && current.status !== 'all') params.set('status', current.status);
    if (current.groupId) params.set('groupId', current.groupId);
    if (current.grade) params.set('grade', current.grade);
    if (current.dues) params.set('dues', '1');
    if (current.sort) params.set('sort', current.sort);
    params.set('limit', '500');
    listEl.style.opacity = '0.45';
    try {
      const data = await api.get(`/api/students?${params.toString()}`);
      listEl.innerHTML = listHTML(data.items);
      listEl.style.opacity = '';
      bindList();
      const sub = root.querySelector('.page-head .sub');
      if (sub) sub.textContent = `${data.total} طالب مسجل · ${data.summary.active} نشط · ${data.summary.debtors} عليهم متأخرات`;
      const gradeSelect = root.querySelector('[data-filter="grade"]');
      if (gradeSelect) {
        const now = current.grade || '';
        gradeSelect.innerHTML = `<option value="">كل الصفوف</option>${(data.grades || [])
          .map((g) => `<option value="${escapeHTML(g)}" ${g === now ? 'selected' : ''}>${escapeHTML(g)}</option>`)
          .join('')}`;
      }
    } catch (error) {
      listEl.style.opacity = '';
      toast(error.message, 'error');
    }
  };

  const search = debounce((value) => {
    current.search = value;
    refresh();
  }, 280);
  root.querySelector('[data-search]')?.addEventListener('input', (event) => search(event.target.value));

  root.querySelectorAll('[data-filter]').forEach((el) => {
    el.addEventListener('change', () => {
      if (el.type === 'checkbox') current[el.dataset.filter] = el.checked ? '1' : '';
      else current[el.dataset.filter] = el.value;
      refresh();
    });
  });

  root.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      localStorage.setItem('daftary-students-view', btn.dataset.view);
      setViewButtons();
      listEl.innerHTML = listEl.innerHTML;
      refresh();
    });
  });

  root.querySelector('[data-add-student]')?.addEventListener('click', () => {
    studentModal({
      onSaved: async () => {
        await refresh();
      },
    });
  });

  root.querySelector('[data-export]')?.addEventListener('click', () => {
    downloadURL('/api/exports/students.csv');
    toast('بيتم تحميل الملف');
  });

  bindList();
  setViewButtons();

  if (ctx.query?.get('new') === '1') {
    studentModal({ onSaved: refresh });
  }
}

export { deleteConfirm };
