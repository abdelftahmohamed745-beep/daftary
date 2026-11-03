'use strict';

import { api, escapeHTML, relativeTime } from '../api.js';
import { icon, avatarHTML, toast, emptyHTML, formModal, confirmModal } from '../ui.js';

const ROLE_LABELS = { admin: 'مدير', assistant: 'مساعد' };

function summaryCard(label, value, iconName, color, soft) {
  return `<div class="kpi" style="--kpi:${color};--kpi-soft:${soft}">
    <div class="kpi-top"><span>${escapeHTML(label)}</span><span class="kpi-icon">${icon(iconName)}</span></div>
    <div class="kpi-value">${value}</div>
  </div>`;
}

export async function render(ctx) {
  const data = await api.get('/api/users');
  const admins = data.items.filter((u) => u.role === 'admin' && u.active !== false).length;
  const active = data.items.filter((u) => u.active !== false).length;

  return `<div class="page">
    <div class="page-head">
      <div><h1>المستخدمين والصلاحيات</h1><div class="sub">${data.total} حساب · ${admins} مدير · ${active} نشط</div></div>
      <div class="page-actions"><button class="btn" data-add>${icon('plus')}مستخدم جديد</button></div>
    </div>

    <div class="grid grid-4 mb-3">
      ${summaryCard('إجمالي الحسابات', data.total, 'users', 'var(--teal)', 'var(--teal-soft)')}
      ${summaryCard('مديرين', admins, 'shield', 'var(--saffron)', 'var(--saffron-soft)')}
      ${summaryCard('مساعدين', data.items.filter((u) => u.role === 'assistant').length, 'user', 'var(--blue)', 'var(--blue-soft)')}
      ${summaryCard('حسابات موقوفة', data.items.filter((u) => u.active === false).length, 'xCircle', 'var(--coral)', 'var(--coral-soft)')}
    </div>

    <div class="card">
      <div class="table-wrap"><table class="table">
        <thead><tr><th>المستخدم</th><th>الدور</th><th>الموبايل</th><th>آخر دخول</th><th>الحالة</th><th></th></tr></thead>
        <tbody>${data.items.map((user) => `<tr data-id="${user.id}">
          <td><div class="row">${avatarHTML(user.name, user.avatarColor, 'sm')}
            <div><div class="strong small">${escapeHTML(user.name)}${user.id === ctx.user.id ? ' <span class="badge gray">إنت</span>' : ''}</div>
            <div class="tiny muted" dir="ltr" style="text-align:end">${escapeHTML(user.email)}</div></div></div></td>
          <td><span class="badge ${user.role === 'admin' ? 'amber' : 'blue'}">${ROLE_LABELS[user.role] || user.role}</span></td>
          <td class="small" dir="ltr" style="text-align:end">${escapeHTML(user.phone || '—')}</td>
          <td class="small muted">${user.lastLoginAt ? escapeHTML(relativeTime(user.lastLoginAt)) : 'لسه'}</td>
          <td><span class="badge ${user.active !== false ? 'green' : 'red'} dot">${user.active !== false ? 'نشط' : 'موقوف'}</span></td>
          <td class="end"><div class="row" style="justify-content:flex-end">
            <button class="icon-btn" data-edit title="تعديل">${icon('settings')}</button>
            <button class="icon-btn" data-password title="باسورد">${icon('shield')}</button>
            ${user.id !== ctx.user.id ? `<button class="icon-btn danger" data-delete title="حذف">${icon('trash')}</button>` : ''}
          </div></td>
        </tr>`).join('')}</tbody>
      </table></div>
      ${!data.items.length ? emptyHTML('users', 'مفيش مستخدمين', 'أضف أول حساب للمركز.') : ''}
    </div>
  </div>`;
}

function userModal({ user = null, onSaved }) {
  return formModal({
    title: user ? 'تعديل المستخدم' : 'مستخدم جديد',
    sub: user ? 'عدّل البيانات أو الصلاحيات' : 'الحساب الجديد هيقدر يدخل على النظام',
    fields: [
      { name: 'name', label: 'الاسم', required: true, span: 2 },
      { name: 'email', label: 'الإيميل', type: 'email', required: true, dir: 'ltr' },
      { name: 'phone', label: 'الموبايل', dir: 'ltr' },
      { name: 'role', label: 'الدور', type: 'select', options: [
        { value: 'assistant', label: 'مساعد' },
        { value: 'admin', label: 'مدير' },
      ] },
      ...(!user ? [{ name: 'password', label: 'الباسورد', type: 'password', required: true, help: '٨ حروف على الأقل، فيها حرف كبير ورقم.' }] : []),
      ...(user ? [{ name: 'active', label: 'الحساب نشط', type: 'switch' }] : []),
    ],
    values: user
      ? { ...user }
      : { name: '', email: '', phone: '', role: 'assistant', password: '' },
    onSubmit: async (values) => {
      if (user) {
        const payload = { name: values.name, email: values.email, phone: values.phone, role: values.role, active: values.active };
        await api.patch(`/api/users/${user.id}`, payload);
        toast('بيانات المستخدم اتحدثت');
      } else {
        await api.post('/api/users', values);
        toast('المستخدم اتضاف');
      }
      onSaved();
    },
  });
}

function passwordModal(user, onSaved) {
  return formModal({
    title: 'باسورد جديد',
    sub: `لـ ${user.name}`,
    fields: [
      { name: 'password', label: 'الباسورد الجديد', type: 'password', required: true, span: 2, help: '٨ حروف على الأقل، فيها حرف كبير ورقم.' },
    ],
    values: { password: '' },
    submitText: 'تعيين الباسورد',
    onSubmit: async (values) => {
      await api.post(`/api/users/${user.id}/password`, values);
      toast('الباسورد اتغير — المستخدم هيتطلب منه يدخل تاني');
      onSaved();
    },
  });
}

export async function mount(root, ctx) {
  root.querySelector('[data-add]')?.addEventListener('click', () => userModal({ onSaved: () => ctx.refresh() }));

  root.querySelectorAll('[data-id]').forEach((row) => {
    const user = { id: row.dataset.id };
    row.querySelector('[data-edit]')?.addEventListener('click', async () => {
      const data = await api.get('/api/users');
      const target = data.items.find((u) => u.id === user.id);
      userModal({ user: target, onSaved: () => ctx.refresh() });
    });
    row.querySelector('[data-password]')?.addEventListener('click', async () => {
      const data = await api.get('/api/users');
      const target = data.items.find((u) => u.id === user.id);
      passwordModal(target, () => ctx.refresh());
    });
    row.querySelector('[data-delete]')?.addEventListener('click', () => {
      confirmModal({
        title: 'حذف المستخدم؟',
        message: 'الحساب هيتشال نهائياً وكل جلساته هتتقفل.',
        danger: true,
        onConfirm: async () => {
          await api.delete(`/api/users/${user.id}`);
          toast('المستخدم اتحذف');
          ctx.refresh();
        },
      });
    });
  });
}
