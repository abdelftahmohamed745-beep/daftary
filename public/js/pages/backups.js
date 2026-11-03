'use strict';

import { api, escapeHTML, relativeTime, downloadURL } from '../api.js';
import { icon, toast, emptyHTML, confirmModal } from '../ui.js';

function bytes(value) {
  const n = Number(value) || 0;
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} ميجا`;
  if (n >= 1024) return `${Math.round(n / 1024)} كيلو`;
  return `${n} بايت`;
}

function summaryCard(label, value, iconName, color, soft) {
  return `<div class="kpi" style="--kpi:${color};--kpi-soft:${soft}">
    <div class="kpi-top"><span>${escapeHTML(label)}</span><span class="kpi-icon">${icon(iconName)}</span></div>
    <div class="kpi-value">${value}</div>
  </div>`;
}

export async function render(ctx) {
  const [system, backups] = await Promise.all([
    api.get('/api/system'),
    api.get('/api/backups'),
  ]);

  return `<div class="page">
    <div class="page-head">
      <div><h1>النسخ والبيانات</h1><div class="sub">حجم الداتا ${bytes(system.size)} · ${backups.items.length} نسخة محفوظة</div></div>
      <div class="page-actions">
        <button class="btn secondary" data-export>${icon('download')}تصدير الداتا</button>
        <button class="btn" data-backup>${icon('save')}نسخة جديدة</button>
      </div>
    </div>

    <div class="grid grid-4 mb-3">
      ${summaryCard('حجم الداتا', bytes(system.size), 'database', 'var(--teal)', 'var(--teal-soft)')}
      ${summaryCard('الطلبة', system.counts.students, 'users', 'var(--blue)', 'var(--blue-soft)')}
      ${summaryCard('الامتحانات', system.counts.exams, 'target', 'var(--plum)', 'var(--plum-soft)')}
      ${summaryCard('النسخ المحفوظة', backups.items.length, 'archive', 'var(--saffron)', 'var(--saffron-soft)')}
    </div>

    <div class="grid grid-2 mb-3">
      <section class="card">
        <div class="card-head"><div><h2>معلومات النظام</h2><div class="sub">حالة السيرفر والملفات</div></div></div>
        <div class="kv-list">
          <div class="kv-row"><span>ملف الداتا</span><span class="small mono" dir="ltr" style="text-align:end;word-break:break-all">${escapeHTML(system.file)}</span></div>
          <div class="kv-row"><span>مجلد النسخ</span><span class="small mono" dir="ltr" style="text-align:end;word-break:break-all">${escapeHTML(backups.directory)}</span></div>
          <div class="kv-row"><span>إصدار Node</span><span dir="ltr">${escapeHTML(system.node)}</span></div>
          <div class="kv-row"><span>مدة التشغيل</span><span>${Math.round(system.uptime / 60)} دقيقة</span></div>
          <div class="kv-row"><span>الذاكرة</span><span>${system.memory} ميجا</span></div>
          <div class="kv-row"><span>آخر تحميل</span><span>${escapeHTML(relativeTime(system.loadedAt))}</span></div>
        </div>
        <div class="row mt-3">
          <label class="btn secondary">${icon('upload')}استيراد نسخة<input type="file" accept="application/json,.json" data-import hidden></label>
          <button class="btn danger-soft" data-reset>${icon('trash')}مسح وإعادة تعيين</button>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>توزيع البيانات</h2><div class="sub">عدد السجلات في كل جدول</div></div></div>
        <div class="data-grid">
          ${Object.entries(system.counts).map(([key, value]) => `<div class="data-chip">
            <span>${escapeHTML(key)}</span><strong>${value}</strong></div>`).join('')}
        </div>
      </section>
    </div>

    <section class="card">
      <div class="card-head"><div><h2>النسخ الاحتياطية</h2><div class="sub">أحدث ٢٥ نسخة تلقائية ويدوية</div></div></div>
      ${backups.items.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>الملف</th><th>الحجم</th><th>التاريخ</th><th></th></tr></thead>
        <tbody>${backups.items.map((item) => `<tr data-name="${escapeHTML(item.name)}">
          <td class="small mono" dir="ltr" style="text-align:end;word-break:break-all">${escapeHTML(item.name)}</td>
          <td class="small">${bytes(item.size)}</td>
          <td class="small muted">${escapeHTML(relativeTime(item.at))}</td>
          <td class="end"><div class="row" style="justify-content:flex-end">
            <button class="btn xs secondary" data-download>${icon('download')}تحميل</button>
            <button class="btn xs secondary" data-restore>${icon('refresh')}استرجاع</button>
          </div></td>
        </tr>`).join('')}</tbody>
      </table></div>` : emptyHTML('archive', 'مفيش نسخ لسه', 'اعمل أول نسخة احتياطية بضغطة.')}
    </section>
  </div>`;
}

export async function mount(root, ctx) {
  root.querySelector('[data-backup]')?.addEventListener('click', async () => {
    try {
      const data = await api.post('/api/backups');
      toast(`تم إنشاء ${data.name}`);
      ctx.refresh();
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  root.querySelector('[data-export]')?.addEventListener('click', () => {
    downloadURL('/api/backup/export');
    toast('بيتم تحميل ملف الداتا');
  });

  root.querySelectorAll('[data-name]').forEach((row) => {
    const name = row.dataset.name;
    row.querySelector('[data-download]')?.addEventListener('click', () => {
      downloadURL(`/api/backups/${encodeURIComponent(name)}/download`);
    });
    row.querySelector('[data-restore]')?.addEventListener('click', () => {
      confirmModal({
        title: 'استرجاع النسخة؟',
        message: 'الداتا الحالية هتتستبدل بالنسخة دي. هيتم عمل نسخة أمان قبل الاسترجاع.',
        danger: true,
        confirmText: 'أيوه، استرجع',
        onConfirm: async () => {
          await api.post(`/api/backups/${encodeURIComponent(name)}/restore`);
          toast('تم استرجاع النسخة');
          setTimeout(() => location.reload(), 800);
        },
      });
    });
  });

  const input = root.querySelector('[data-import]');
  input?.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await api.post('/api/backup/import', { data });
      toast('تم استيراد النسخة');
      setTimeout(() => location.reload(), 800);
    } catch (error) {
      toast(error.message || 'ملف النسخة غير صحيح', 'error');
      input.value = '';
    }
  });

  root.querySelector('[data-reset]')?.addEventListener('click', () => {
    confirmModal({
      title: 'مسح كل البيانات؟',
      message: 'كل البيانات هتتمسح وهيرجع الداتا التجريبية. الخطوة دي مش بترجع، بس هيتم عمل نسخة قبل المسح.',
      danger: true,
      confirmText: 'امسح وابدأ من جديد',
      onConfirm: async () => {
        await api.post('/api/system/reset', { confirm: 'RESET' });
        toast('تم مسح الداتا وإعادة التعيين');
        setTimeout(() => location.reload(), 900);
      },
    });
  });
}
