'use strict';

import { api, escapeHTML, relativeTime, dateFull } from '../api.js';
import { icon, avatarHTML, toast } from '../ui.js';

export async function render(ctx) {
  const me = await api.get('/api/auth/me');
  const user = me.user;
  return `<div class="page">
    <div class="page-head">
      <div><h1>حسابي</h1><div class="sub">بياناتك الشخصية وكلمة السر والجلسة الحالية</div></div>
    </div>

    <div class="grid grid-2">
      <section class="card">
        <div class="card-head"><div><h2>البيانات الشخصية</h2><div class="sub">الاسم والموبايل اللي بيظهروا في النظام</div></div></div>
        <div class="profile-head">
          ${avatarHTML(user.name, user.avatarColor)}
          <div class="grow">
            <div class="strong">${escapeHTML(user.name)}</div>
            <div class="small muted">${user.role === 'admin' ? 'مدير المركز' : 'مساعد'}</div>
            <div class="tiny muted" dir="ltr" style="text-align:end">${escapeHTML(user.email)}</div>
          </div>
        </div>
        <form data-profile-form class="form-grid mt-3">
          <div class="field span-2"><label>الاسم</label><input class="input" name="name" value="${escapeHTML(user.name)}" required></div>
          <div class="field span-2"><label>الموبايل</label><input class="input" name="phone" dir="ltr" value="${escapeHTML(user.phone || '')}" placeholder="01xxxxxxxxx"></div>
          <div class="field span-2"><label>الإيميل</label><input class="input" value="${escapeHTML(user.email)}" dir="ltr" disabled></div>
        </form>
        <div class="row mt-3"><button class="btn" data-save-profile>${icon('save')}حفظ البيانات</button></div>
      </section>

      <div class="stack">
        <section class="card">
          <div class="card-head"><div><h2>كلمة السر</h2><div class="sub">آخر تغيير ${user.passwordChangedAt ? escapeHTML(relativeTime(user.passwordChangedAt)) : 'لسه متغيرتش'}</div></div></div>
          <form data-password-form class="form-grid">
            <div class="field span-2"><label>الباسورد الحالي</label><input class="input" type="password" name="current" autocomplete="current-password" required></div>
            <div class="field"><label>الباسورد الجديد</label><input class="input" type="password" name="next" autocomplete="new-password" required></div>
            <div class="field"><label>تأكيد الباسورد</label><input class="input" type="password" name="confirm" autocomplete="new-password" required></div>
          </form>
          <div class="row mt-3"><button class="btn secondary" data-save-password>${icon('shield')}تغيير الباسورد</button></div>
        </section>

        <section class="card">
          <div class="card-head"><div><h2>الجلسة الحالية</h2><div class="sub">معلومات الأمان</div></div></div>
          <div class="kv-list">
            <div class="kv-row"><span>الدور</span><span class="badge ${user.role === 'admin' ? 'amber' : 'blue'}">${user.role === 'admin' ? 'مدير' : 'مساعد'}</span></div>
            <div class="kv-row"><span>آخر دخول</span><span>${user.lastLoginAt ? escapeHTML(relativeTime(user.lastLoginAt)) : '—'}</span></div>
            <div class="kv-row"><span>انتهاء الجلسة</span><span>${me.session?.expiresAt ? escapeHTML(relativeTime(me.session.expiresAt)) : '—'}</span></div>
            <div class="kv-row"><span>تاريخ الإنشاء</span><span>${user.createdAt ? escapeHTML(dateFull(String(user.createdAt).slice(0, 10))) : '—'}</span></div>
          </div>
        </section>
      </div>
    </div>
  </div>`;
}

export async function mount(root, ctx) {
  root.querySelector('[data-save-profile]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const form = root.querySelector('[data-profile-form]');
    button.disabled = true;
    try {
      const data = await api.patch('/api/auth/profile', {
        name: form.name.value.trim(),
        phone: form.phone.value.trim(),
      });
      ctx.state.user = { ...ctx.state.user, ...data.user };
      toast('البيانات اتحدثت');
      ctx.refresh();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      button.disabled = false;
    }
  });

  root.querySelector('[data-save-password]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const form = root.querySelector('[data-password-form]');
    if (!form.current.value || !form.next.value) {
      toast('اكتب الباسورد الحالي والجديد', 'error');
      return;
    }
    if (form.next.value !== form.confirm.value) {
      toast('تأكيد الباسورد مش مطابق', 'error');
      return;
    }
    button.disabled = true;
    try {
      await api.post('/api/auth/password', { current: form.current.value, next: form.next.value });
      form.reset();
      toast('الباسورد اتغير');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      button.disabled = false;
    }
  });
}
