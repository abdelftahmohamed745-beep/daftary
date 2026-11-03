'use strict';

import { api, escapeHTML, relativeTime } from '../api.js';
import { icon, toast, emptyHTML } from '../ui.js';

export async function render(ctx) {
  const data = await api.get('/api/sync');
  const settings = data.settings || {};
  return `<div class="page">
    <div class="page-head">
      <div><h1>مزامنة المجلدات</h1><div class="sub">نسخة محلية من الملفات على جهازك — بدون أي خدمة خارجية</div></div>
      <div class="page-actions">
        <button class="btn secondary" data-run>${icon('refresh')}مزامنة الآن</button>
        <button class="btn" data-save>${icon('save')}حفظ الإعدادات</button>
      </div>
    </div>

    <div class="grid grid-2 mb-3">
      <section class="card">
        <div class="card-head"><div><h2>إعدادات المزامنة</h2><div class="sub">اختار مجلد على السيرفر تتنسخ فيه الملفات</div></div></div>
        <form data-sync-form class="form-grid">
          <div class="field span-2"><label class="switch">
            <input type="checkbox" name="enabled" ${settings.enabled ? 'checked' : ''}><span class="track"></span>
            <span>تشغيل المزامنة الدورية</span></label>
            <div class="help">لما تتقفل، المزامنة اليدوية بتفضل شغالة.</div>
          </div>
          <div class="field span-2"><label>مسار المجلد</label>
            <input class="input mono" name="folder" dir="ltr" value="${escapeHTML(settings.folder || '')}" placeholder="/home/user/daftary-sync">
            <div class="help">المسار على السيرفر نفسه. ممكن تستخدم ~ في البداية.</div>
          </div>
          <div class="field"><label>كل كام دقيقة</label>
            <input class="input" name="intervalMinutes" type="number" min="5" max="1440" value="${Number(settings.intervalMinutes) || 60}">
          </div>
          <div class="field"><label>آخر مزامنة</label>
            <div class="input muted" style="display:flex;align-items:center">${settings.lastSyncAt ? escapeHTML(relativeTime(settings.lastSyncAt)) : 'لسه'}</div>
          </div>
        </form>
        <div class="row mt-3"><button class="btn" data-save-bottom>${icon('save')}حفظ</button></div>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>حالة الاتصال</h2><div class="sub">آخر نتيجة مزامنة</div></div></div>
        <div class="kv-list">
          <div class="kv-row"><span>الحالة</span><span class="badge ${settings.enabled ? 'green' : 'gray'} dot">${settings.enabled ? 'مفعلة' : 'مقفولة'}</span></div>
          <div class="kv-row"><span>المجلد</span><span class="small mono" dir="ltr" style="text-align:end;word-break:break-all">${escapeHTML(settings.folder || '—')}</span></div>
          <div class="kv-row"><span>الدورية</span><span>${Number(settings.intervalMinutes) || 60} دقيقة</span></div>
          <div class="kv-row"><span>آخر مزامنة</span><span>${settings.lastSyncAt ? escapeHTML(relativeTime(settings.lastSyncAt)) : 'لسه'}</span></div>
        </div>
        <div class="demo-box mt-3">المزامنة بتقرأ عدد الملفات في المجلد وتسجّل النتيجة في السجل. مش بترفع أي حاجة على الإنترنت.</div>
      </section>
    </div>

    <section class="card">
      <div class="card-head"><div><h2>سجل المزامنة</h2><div class="sub">${data.logs.length} محاولة</div></div></div>
      <div data-logs>
        ${data.logs.length
          ? `<div class="table-wrap"><table class="table">
              <thead><tr><th>التاريخ</th><th>الحالة</th><th class="num">الملفات</th><th>الرسالة</th></tr></thead>
              <tbody>${data.logs.map((log) => `<tr>
                <td class="small">${escapeHTML(log.date)} <span class="tiny muted">${escapeHTML(relativeTime(log.at))}</span></td>
                <td><span class="badge ${log.status === 'ok' ? 'green' : 'red'} dot">${log.status === 'ok' ? 'نجحت' : 'فشلت'}</span></td>
                <td class="num small">${log.files}</td>
                <td class="small muted">${escapeHTML(log.message || '')}</td>
              </tr>`).join('')}</tbody></table></div>`
          : emptyHTML('refresh', 'مفيش عمليات مزامنة', 'اضغط "مزامنة الآن" عشان تبدأ.')}
      </div>
    </section>
  </div>`;
}

export async function mount(root, ctx) {
  const save = async () => {
    const form = root.querySelector('[data-sync-form]');
    try {
      await api.patch('/api/sync', {
        enabled: form.enabled.checked,
        folder: form.folder.value.trim(),
        intervalMinutes: Number(form.intervalMinutes.value) || 60,
      });
      toast('إعدادات المزامنة اتحفظت');
      ctx.refresh();
    } catch (error) {
      toast(error.message, 'error');
    }
  };
  root.querySelector('[data-save]')?.addEventListener('click', save);
  root.querySelector('[data-save-bottom]')?.addEventListener('click', save);
  root.querySelector('[data-run]')?.addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    try {
      const data = await api.post('/api/sync/run');
      toast(data.entry.status === 'ok' ? data.entry.message : data.entry.message, data.entry.status === 'ok' ? 'success' : 'error');
      ctx.refresh();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      event.currentTarget.disabled = false;
    }
  });
}
