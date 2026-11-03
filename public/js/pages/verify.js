'use strict';

import { api, escapeHTML, dateFull } from '../api.js';
import { icon, toast, emptyHTML, printHTML } from '../ui.js';
import { certificatePrintHTML } from './certificates.js';

export async function render(ctx) {
  const code = (ctx.query.get('code') || '').trim();
  let result = null;
  let error = '';
  if (code) {
    try {
      result = await api.get(`/api/public/certificate/${encodeURIComponent(code)}`);
    } catch (err) {
      error = err.message;
    }
  }

  return `<div class="page">
    <div class="page-head">
      <div><h1>التحقق من الشهادات</h1><div class="sub">اكتب كود الشهادة للتأكد إنها سارية وصادرة من المركز</div></div>
      <div class="page-actions"><a class="btn secondary" href="#/certificates">${icon('award')}كل الشهادات</a></div>
    </div>

    <div class="grid grid-2">
      <section class="card">
        <div class="card-head"><div><h2>كود الشهادة</h2><div class="sub">بيبدأ بـ CERT</div></div></div>
        <form data-verify class="row" style="gap:8px">
          <input class="input mono" name="code" dir="ltr" placeholder="CERT-2026-0001" value="${escapeHTML(code)}" required>
          <button class="btn" type="submit">${icon('shield')}تحقق</button>
        </form>
        <div class="help mt-2">الكود موجود تحت كل شهادة مطبوعة، أو في صفحة الشهادات.</div>

        <div class="mt-3">
          ${error ? `<div class="alert-banner bad">${icon('xCircle')}<div><strong>مش قادر أتحقق</strong><div class="small">${escapeHTML(error)}</div></div></div>` : ''}
          ${result ? `<div class="alert-banner ${result.valid ? 'good' : 'bad'}">
            ${icon(result.valid ? 'checkCircle' : 'xCircle')}
            <div><strong>${result.valid ? 'الشهادة سارية وصحيحة' : 'الشهادة ملغية'}</strong>
            <div class="small">${escapeHTML(result.certificate.studentName)} — ${escapeHTML(result.certificate.title)}</div></div>
          </div>` : ''}
          ${!error && !result ? emptyHTML('shield', 'مستني كود الشهادة', 'اكتب الكود فوق واضغط تحقق.') : ''}
        </div>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>بيانات الشهادة</h2><div class="sub">${result ? 'تم التحقق بنجاح' : 'هتظهر بعد التحقق'}</div></div></div>
        ${result
          ? `<div class="kv-list">
              <div class="kv-row"><span>الطالب</span><span class="strong">${escapeHTML(result.certificate.studentName)}</span></div>
              <div class="kv-row"><span>الشهادة</span><span>${escapeHTML(result.certificate.title)}</span></div>
              <div class="kv-row"><span>تاريخ الإصدار</span><span>${escapeHTML(dateFull(result.certificate.issuedAt))}</span></div>
              <div class="kv-row"><span>الكود</span><span class="mono" dir="ltr">${escapeHTML(result.certificate.code)}</span></div>
              <div class="kv-row"><span>المركز</span><span>${escapeHTML(result.settings.centerName || '')}</span></div>
              <div class="kv-row"><span>الحالة</span><span class="badge ${result.valid ? 'green' : 'red'}">${result.valid ? 'سارية' : 'ملغية'}</span></div>
            </div>
            <div class="cert-preview mt-3">${certificatePrintHTML(result.certificate, result.settings)}</div>
            <div class="row mt-3"><button class="btn secondary" data-print>${icon('print')}طباعة الشهادة</button></div>`
          : emptyHTML('file', 'مفيش بيانات', 'بعد التحقق هتلاقي كل تفاصيل الشهادة هنا.')}
      </section>
    </div>
  </div>`;
}

export async function mount(root) {
  root.querySelector('[data-verify]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const code = event.target.code.value.trim();
    if (code) location.hash = `#/verify?code=${encodeURIComponent(code)}`;
  });
  root.querySelector('[data-print]')?.addEventListener('click', () => {
    const preview = root.querySelector('.cert-preview');
    if (preview) printHTML(preview.innerHTML);
  });
}
