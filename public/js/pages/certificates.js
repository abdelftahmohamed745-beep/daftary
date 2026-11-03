'use strict';

import { api, escapeHTML, dateFull } from '../api.js';
import { icon, toast, emptyHTML, confirmModal, openModal, printHTML } from '../ui.js';
import { certificateModal, bulkCertificateModal } from '../feature-forms.js';

const KIND_LABELS = { excellence: 'تفوق', attendance: 'انتظام وحضور', completion: 'إتمام منهج', custom: 'مخصصة' };
const KIND_ICONS = { excellence: 'award', attendance: 'checkCircle', completion: 'bookOpen', custom: 'sparkles' };

export function certificatePrintHTML(cert, settings = {}) {
  const centerName = settings.centerName || 'مركز دفتري';
  const signer = settings.certificateSigner || settings.teacherName || '';
  const note = cert.note || settings.certificateNote || '';
  return `<div class="cert-sheet">
    <div class="cert-border">
      <div class="cert-inner">
        <div class="cert-brand">${escapeHTML(centerName)}</div>
        <div class="cert-rule"></div>
        <div class="cert-kicker">${escapeHTML(KIND_LABELS[cert.kind] || 'شهادة')}</div>
        <h1 class="cert-title">${escapeHTML(cert.title || 'شهادة تقدير')}</h1>
        <div class="cert-for">تُمنح هذه الشهادة إلى</div>
        <div class="cert-name">${escapeHTML(cert.studentName || cert.studentShort || '')}</div>
        <p class="cert-note">${escapeHTML(note)}</p>
        <div class="cert-meta">
          <span>كود التحقق: <b dir="ltr">${escapeHTML(cert.code || '')}</b></span>
          <span>التاريخ: ${escapeHTML(dateFull(cert.issuedAt))}</span>
        </div>
        <div class="cert-sign">
          <div class="cert-sign-line"></div>
          <div>${escapeHTML(signer)}</div>
          <div class="tiny muted">التوقيع</div>
        </div>
      </div>
    </div>
  </div>`;
}

function cardHTML(cert) {
  const revoked = cert.status !== 'active';
  return `<article class="cert-card ${revoked ? 'revoked' : ''}" data-id="${cert.id}">
    <div class="cert-card-top">
      <span class="cert-medal ${cert.kind}">${icon(KIND_ICONS[cert.kind] || 'award')}</span>
      <div class="grow" style="min-width:0">
        <div class="strong truncate">${escapeHTML(cert.title)}</div>
        <div class="tiny muted">${escapeHTML(KIND_LABELS[cert.kind] || cert.kind)} · ${escapeHTML(dateFull(cert.issuedAt))}</div>
      </div>
      <span class="badge ${revoked ? 'red' : 'green'} dot">${revoked ? 'ملغية' : 'سارية'}</span>
    </div>
    <div class="row" style="gap:8px;margin-top:10px">
      <div class="avatar sm" style="background:${escapeHTML(cert.avatarColor || 'var(--teal)')}">${escapeHTML((cert.studentShort || cert.studentName || '?').slice(0, 1))}</div>
      <div class="grow" style="min-width:0"><div class="small strong truncate">${escapeHTML(cert.studentName)}</div>
      <div class="tiny muted truncate">${escapeHTML(cert.groupNames || cert.grade || '')}</div></div>
    </div>
    <div class="cert-code mono" dir="ltr">${escapeHTML(cert.code)}</div>
    <div class="row" style="gap:6px;margin-top:10px">
      <button class="btn xs secondary" data-print>${icon('print')}طباعة</button>
      <button class="btn xs secondary" data-verify>${icon('shield')}تحقق</button>
      <button class="icon-btn" data-edit title="تعديل">${icon('settings')}</button>
      <button class="icon-btn danger" data-delete title="حذف">${icon('trash')}</button>
    </div>
  </article>`;
}

function gridHTML(items) {
  if (!items.length) return emptyHTML('award', 'مفيش شهادات', 'أصدر أول شهادة لطالب من زرار "شهادة جديدة".');
  return `<div class="cert-grid">${items.map(cardHTML).join('')}</div>`;
}

function summaryCard(label, value, iconName, color, soft) {
  return `<div class="kpi" style="--kpi:${color};--kpi-soft:${soft}">
    <div class="kpi-top"><span>${escapeHTML(label)}</span><span class="kpi-icon">${icon(iconName)}</span></div>
    <div class="kpi-value">${value}</div>
  </div>`;
}

export async function render(ctx) {
  const params = new URLSearchParams();
  for (const key of ['kind', 'status', 'q']) if (ctx.query.get(key)) params.set(key, ctx.query.get(key));
  const data = await api.get(`/api/certificates?${params.toString()}`);
  const q = Object.fromEntries(params.entries());
  return `<div class="page">
    <div class="page-head">
      <div><h1>الشهادات</h1><div class="sub">${data.summary.total} شهادة · ${data.summary.active} سارية · ${data.summary.thisMonth} هذا الشهر</div></div>
      <div class="page-actions">
        <a class="btn secondary" href="#/verify">${icon('shield')}تحقق من شهادة</a>
        <button class="btn secondary" data-bulk>${icon('users')}إصدار جماعي</button>
        <button class="btn" data-add>${icon('plus')}شهادة جديدة</button>
      </div>
    </div>

    <div class="grid grid-4 mb-3">
      ${summaryCard('إجمالي الشهادات', data.summary.total, 'award', 'var(--teal)', 'var(--teal-soft)')}
      ${summaryCard('سارية', data.summary.active, 'checkCircle', 'var(--blue)', 'var(--blue-soft)')}
      ${summaryCard('تفوق', data.summary.excellence, 'sparkles', 'var(--saffron)', 'var(--saffron-soft)')}
      ${summaryCard('هذا الشهر', data.summary.thisMonth, 'calendar', 'var(--plum)', 'var(--plum-soft)')}
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="search">${icon('search')}
          <input class="input" type="search" placeholder="دوّر بالطالب أو الشهادة…" value="${escapeHTML(q.q || '')}" data-search>
        </div>
        <select class="select" data-filter="kind">
          <option value="">كل الأنواع</option>
          ${Object.entries(KIND_LABELS).map(([value, label]) => `<option value="${value}" ${q.kind === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
        <select class="select" data-filter="status">
          <option value="">كل الحالات</option>
          <option value="active" ${q.status === 'active' ? 'selected' : ''}>سارية</option>
          <option value="revoked" ${q.status === 'revoked' ? 'selected' : ''}>ملغية</option>
        </select>
      </div>
      <div data-list>${gridHTML(data.items)}</div>
    </div>
  </div>`;
}

export async function mount(root, ctx) {
  const current = Object.fromEntries((ctx.query || new URLSearchParams()).entries());
  const listEl = root.querySelector('[data-list]');
  let timer = null;

  const verify = async (code) => {
    try {
      const data = await api.get(`/api/public/certificate/${encodeURIComponent(code)}`);
      openModal({
        title: 'نتيجة التحقق',
        narrow: true,
        body: `<div class="stack-sm">
          <div class="alert-banner ${data.valid ? 'good' : 'bad'}">${icon(data.valid ? 'checkCircle' : 'xCircle')}
            <div><strong>${data.valid ? 'الشهادة سارية وصحيحة' : 'الشهادة ملغية'}</strong>
            <div class="tiny">${escapeHTML(data.certificate.title)} — ${escapeHTML(data.certificate.studentName)}</div></div></div>
          <div class="kv-list">
            <div class="kv-row"><span>الكود</span><span class="mono" dir="ltr">${escapeHTML(code)}</span></div>
            <div class="kv-row"><span>تاريخ الإصدار</span><span>${escapeHTML(dateFull(data.certificate.issuedAt))}</span></div>
            <div class="kv-row"><span>المركز</span><span>${escapeHTML(data.settings.centerName || '')}</span></div>
          </div>
        </div>`,
        footer: `<button class="btn secondary" data-close>تمام</button>`,
      });
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  const bind = () => {
    listEl.querySelectorAll('[data-id]').forEach((card) => {
      const id = card.dataset.id;
      card.querySelector('[data-print]')?.addEventListener('click', async () => {
        const data = await api.get(`/api/certificates/${id}`);
        printHTML(certificatePrintHTML(data.certificate, ctx.state.settings || {}));
      });
      card.querySelector('[data-verify]')?.addEventListener('click', () => {
        const code = card.querySelector('.cert-code').textContent.trim();
        verify(code);
      });
      card.querySelector('[data-edit]')?.addEventListener('click', async () => {
        const data = await api.get(`/api/certificates/${id}`);
        certificateModal({ certificate: data.certificate, onSaved: refresh });
      });
      card.querySelector('[data-delete]')?.addEventListener('click', () => {
        confirmModal({
          title: 'حذف الشهادة؟',
          message: 'الشهادة هتتشال نهائياً ومش هينفع التحقق منها.',
          danger: true,
          onConfirm: async () => {
            await api.delete(`/api/certificates/${id}`);
            toast('الشهادة اتحذفت');
            refresh();
          },
        });
      });
    });
  };

  const refresh = async () => {
    const params = new URLSearchParams();
    for (const key of ['kind', 'status', 'q']) if (current[key]) params.set(key, current[key]);
    listEl.style.opacity = '0.45';
    try {
      const data = await api.get(`/api/certificates?${params.toString()}`);
      listEl.innerHTML = gridHTML(data.items);
      listEl.style.opacity = '';
      root.querySelector('.page-head .sub').textContent = `${data.summary.total} شهادة · ${data.summary.active} سارية · ${data.summary.thisMonth} هذا الشهر`;
      bind();
    } catch (error) {
      listEl.style.opacity = '';
      toast(error.message, 'error');
    }
  };

  root.querySelector('[data-search]')?.addEventListener('input', (event) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      current.q = event.target.value.trim();
      refresh();
    }, 260);
  });
  root.querySelectorAll('[data-filter]').forEach((select) => {
    select.addEventListener('change', () => {
      current[select.dataset.filter] = select.value;
      refresh();
    });
  });
  root.querySelector('[data-add]')?.addEventListener('click', () => certificateModal({ onSaved: refresh }));
  root.querySelector('[data-bulk]')?.addEventListener('click', () => bulkCertificateModal({ onSaved: refresh }));
  bind();
  if (ctx.query?.get('new') === '1') certificateModal({ onSaved: refresh });
}
