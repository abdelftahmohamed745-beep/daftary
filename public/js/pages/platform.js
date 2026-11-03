'use strict';

import { api, escapeHTML, dateFull, relativeTime, formatNumber } from '../api.js';
import { icon, toast, emptyHTML, confirmModal } from '../ui.js';

const PLAN_LABELS = { trial: 'تجريبية', monthly: 'شهرية', yearly: 'سنوية', lifetime: 'مدى الحياة' };

function summaryCard(label, value, iconName, color, soft) {
  return `<div class="kpi" style="--kpi:${color};--kpi-soft:${soft}">
    <div class="kpi-top"><span>${escapeHTML(label)}</span><span class="kpi-icon">${icon(iconName)}</span></div>
    <div class="kpi-value">${value}</div>
  </div>`;
}

function codeRow(entry) {
  return `<tr data-id="${entry.id}">
    <td class="mono strong" dir="ltr" style="text-align:end">${escapeHTML(entry.code)}</td>
    <td><span class="badge blue">${escapeHTML(PLAN_LABELS[entry.plan] || entry.plan)}</span></td>
    <td class="num small">${entry.days} يوم</td>
    <td><span class="badge ${entry.status === 'used' ? 'gray' : 'green'} dot">${entry.status === 'used' ? 'مستخدم' : 'متاح'}</span></td>
    <td class="small muted">${entry.usedBy ? `${escapeHTML(entry.usedBy)} · ${escapeHTML(relativeTime(entry.usedAt))}` : '—'}</td>
    <td class="end"><div class="row" style="justify-content:flex-end">
      <button class="icon-btn" data-copy title="نسخ">${icon('copy')}</button>
      <button class="icon-btn danger" data-delete title="حذف">${icon('trash')}</button>
    </div></td>
  </tr>`;
}

export async function render(ctx) {
  const data = await api.get('/api/platform');
  const platform = data.platform;
  const used = data.codes.filter((c) => c.status === 'used').length;
  const available = data.codes.filter((c) => c.status !== 'used').length;

  return `<div class="page">
    <div class="page-head">
      <div><h1>الترخيص والتفعيل</h1><div class="sub">إدارة اشتراك المنصة وأكواد التفعيل</div></div>
    </div>

    <div class="grid grid-4 mb-3">
      ${summaryCard('حالة الاشتراك', platform.active ? 'نشط' : platform.expired ? 'منتهي' : 'متوقف', 'shield', platform.active ? 'var(--teal)' : 'var(--coral)', platform.active ? 'var(--teal-soft)' : 'var(--coral-soft)')}
      ${summaryCard('الأيام المتبقية', platform.daysLeft === null ? '—' : platform.daysLeft, 'clock', 'var(--saffron)', 'var(--saffron-soft)')}
      ${summaryCard('أكواد متاحة', available, 'copy', 'var(--blue)', 'var(--blue-soft)')}
      ${summaryCard('أكواد مستخدمة', used, 'checkCircle', 'var(--plum)', 'var(--plum-soft)')}
    </div>

    <div class="grid grid-2 mb-3">
      <section class="card">
        <div class="card-head"><div><h2>حالة الاشتراك</h2><div class="sub">الباقة الحالية وتاريخ الانتهاء</div></div></div>
        <div class="platform-hero ${platform.expired ? 'expired' : platform.expiringSoon ? 'soon' : ''}">
          <div class="row-between">
            <span class="badge ${platform.active ? 'green' : 'red'} dot">${platform.active ? 'اشتراك نشط' : 'اشتراك متوقف'}</span>
            <span class="platform-plan">${escapeHTML(PLAN_LABELS[platform.plan] || platform.plan || '—')}</span>
          </div>
          <div class="platform-big">${platform.daysLeft === null ? '—' : platform.daysLeft}<small>يوم متبقي</small></div>
          <div class="small muted">ينتهي في ${escapeHTML(dateFull(platform.expiresAt))}</div>
          ${platform.licenseKey ? `<div class="platform-key mono" dir="ltr">${escapeHTML(platform.licenseKey)}</div>` : ''}
        </div>
        <form data-activate class="row mt-3" style="gap:8px">
          <input class="input mono" name="code" dir="ltr" placeholder="DFT-MON-0000-0000" required>
          <button class="btn" type="submit">${icon('shield')}تفعيل الكود</button>
        </form>
        <div class="help mt-2">لو عندك كود تفعيل، اكتبه هنا وهيتضاف على مدة الاشتراك الحالي.</div>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>توليد أكواد جديدة</h2><div class="sub">الأكواد بتتولد محلياً وبتتستخدم مرة واحدة</div></div></div>
        <form data-generate class="form-grid">
          <div class="field"><label>الباقة</label>
            <select class="select" name="plan">
              ${Object.entries(PLAN_LABELS).map(([value, label]) => `<option value="${value}" ${value === 'monthly' ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>عدد الأيام</label><input class="input" type="number" name="days" min="1" max="3650" value="30"></div>
          <div class="field span-2"><label>عدد الأكواد</label><input class="input" type="number" name="count" min="1" max="50" value="1"></div>
        </form>
        <div class="row mt-3"><button class="btn" data-generate-btn>${icon('sparkles')}توليد الأكواد</button></div>
        <div class="help mt-2">كل كود صالح للاستخدام مرة واحدة، وممكن تديه لأي حد يفعّل بيه نسخته.</div>
      </section>
    </div>

    <section class="card">
      <div class="card-head"><div><h2>أكواد التفعيل</h2><div class="sub">${data.codes.length} كود</div></div></div>
      ${data.codes.length
        ? `<div class="table-wrap"><table class="table">
            <thead><tr><th>الكود</th><th>الباقة</th><th class="num">المدة</th><th>الحالة</th><th>الاستخدام</th><th></th></tr></thead>
            <tbody>${data.codes.map(codeRow).join('')}</tbody></table></div>`
        : emptyHTML('copy', 'مفيش أكواد', 'ولّد أول كود تفعيل.')}
    </section>
  </div>`;
}

export async function mount(root, ctx) {
  const activate = root.querySelector('[data-activate]');
  activate?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = activate.code.value.trim();
    if (!code) return;
    try {
      await api.post('/api/platform/activate', { code });
      toast('الاشتراك اتفعّل');
      ctx.refresh();
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  const generate = async () => {
    const form = root.querySelector('[data-generate]');
    const button = root.querySelector('[data-generate-btn]');
    button.disabled = true;
    try {
      const data = await api.post('/api/codes', {
        plan: form.plan.value,
        days: Number(form.days.value) || 30,
        count: Number(form.count.value) || 1,
      });
      toast(`اتولدت ${data.items.length} كود`);
      ctx.refresh();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      button.disabled = false;
    }
  };
  root.querySelector('[data-generate-btn]')?.addEventListener('click', generate);

  root.querySelectorAll('[data-id]').forEach((row) => {
    const id = row.dataset.id;
    row.querySelector('[data-copy]')?.addEventListener('click', async () => {
      const code = row.querySelector('.mono').textContent.trim();
      try {
        await navigator.clipboard.writeText(code);
        toast('الكود اتنسخ');
      } catch {
        toast(`الكود: ${code}`);
      }
    });
    row.querySelector('[data-delete]')?.addEventListener('click', () => {
      confirmModal({
        title: 'حذف الكود؟',
        message: 'الكود هيتشال ومش هينفع يتستخدم.',
        danger: true,
        onConfirm: async () => {
          await api.delete(`/api/codes/${id}`);
          toast('الكود اتحذف');
          ctx.refresh();
        },
      });
    });
  });
}
