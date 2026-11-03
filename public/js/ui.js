'use strict';

import { escapeHTML, initials } from './api.js';

const PATHS = {
  dashboard: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="m9 11 3 3L22 4"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  xCircle: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>',
  wallet: '<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
  chart: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
  bookOpen: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2Z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7Z"/>',
  folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  arrowUpRight: '<path d="M7 17 17 7M7 7h10v10"/>',
  arrowDown: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
  message: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
  print: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
  credit: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  sparkles: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9Z"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.8V4h6v6.8l2 3.2H7l2-3.2Z"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
  filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5Z"/>',
  more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.5 13 17 22l-5-3-5 3 1.5-9"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  percent: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  smartphone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/>',
};

export function icon(name, cls = '') {
  const path = PATHS[name] || PATHS.info;
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

export function avatarHTML(name, color = '#2f6f5e', cls = '') {
  return `<span class="avatar ${cls}" style="--av:${escapeHTML(color || '#2f6f5e')}" aria-hidden="true">${escapeHTML(initials(name))}</span>`;
}

export function ringHTML(percent, cls = '') {
  const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const color = value >= 80 ? 'var(--teal)' : value >= 60 ? 'var(--saffron)' : 'var(--coral)';
  return `<span class="ring ${cls}" style="--p:${value};--ring-color:${color}" title="${value}%"><span>${value}%</span></span>`;
}

export function emptyHTML(iconName, title, text = '') {
  return `<div class="empty">
    <div class="empty-icon">${icon(iconName)}</div>
    <h3>${escapeHTML(title)}</h3>
    ${text ? `<p>${escapeHTML(text)}</p>` : ''}
  </div>`;
}

/* ---------------- Toasts ---------------- */
export function toast(message, type = 'success', timeout = 3800) {
  let host = document.querySelector('.toasts');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toasts';
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${icon(type === 'error' ? 'alert' : type === 'info' ? 'info' : 'checkCircle')}
    <div class="grow">${escapeHTML(message)}</div>
    <button class="toast-close" aria-label="قفل">${icon('close')}</button>`;
  host.appendChild(el);
  const remove = () => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
  };
  el.querySelector('.toast-close').addEventListener('click', remove);
  setTimeout(remove, timeout);
}

/* ---------------- Modal ---------------- */
let activeModal = null;

export function closeModal() {
  if (!activeModal) return;
  activeModal.backdrop.remove();
  document.body.style.overflow = '';
  activeModal = null;
}

export function openModal({
  title,
  sub = '',
  body = '',
  footer = '',
  wide = false,
  narrow = false,
  onMount = null,
  closable = true,
  className = '',
} = {}) {
  closeModal();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal ${wide ? 'wide' : ''} ${narrow ? 'narrow' : ''} ${className}" role="dialog" aria-modal="true" aria-label="${escapeHTML(title || 'نافذة')}">
    <div class="modal-head">
      <div><h2>${escapeHTML(title || '')}</h2>${sub ? `<div class="sub">${escapeHTML(sub)}</div>` : ''}</div>
      ${closable ? `<button class="icon-btn" data-close aria-label="قفل">${icon('close')}</button>` : ''}
    </div>
    <div class="modal-body"></div>
    ${footer ? '<div class="modal-foot"></div>' : ''}
  </div>`;
  const modal = backdrop.querySelector('.modal');
  const bodyEl = backdrop.querySelector('.modal-body');
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body instanceof Node) bodyEl.appendChild(body);
  const footEl = backdrop.querySelector('.modal-foot');
  if (footEl) {
    if (typeof footer === 'string') footEl.innerHTML = footer;
    else if (footer instanceof Node) footEl.appendChild(footer);
  }
  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';

  const close = () => closeModal();
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop && closable) close();
  });
  backdrop.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', close));
  const onKey = (event) => {
    if (event.key === 'Escape' && closable) {
      close();
      document.removeEventListener('keydown', onKey);
    }
  };
  document.addEventListener('keydown', onKey, { once: false });
  const observer = new MutationObserver(() => {
    if (!document.body.contains(backdrop)) {
      document.removeEventListener('keydown', onKey);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true });

  activeModal = { backdrop, modal, close };

  if (onMount) onMount({ root: modal, body: bodyEl, footer: footEl, close });
  const focusable = modal.querySelector('input, select, textarea, button:not([data-close])');
  if (focusable) setTimeout(() => focusable.focus({ preventScroll: true }), 60);
  return { root: modal, body: bodyEl, footer: footEl, close };
}

export function confirmModal({
  title = 'متأكد؟',
  message = '',
  confirmText = 'أيوه، كمّل',
  cancelText = 'لا، رجّع',
  danger = false,
  onConfirm = null,
} = {}) {
  return new Promise((resolve) => {
    const { close } = openModal({
      title,
      narrow: true,
      body: `<p style="font-size:13px;line-height:1.9;color:var(--ink-2)">${escapeHTML(message)}</p>`,
      footer: `<button class="btn ${danger ? 'danger' : ''}" data-yes>${escapeHTML(confirmText)}</button>
        <button class="btn secondary" data-no>${escapeHTML(cancelText)}</button>`,
      onMount: ({ root }) => {
        root.querySelector('[data-yes]').addEventListener('click', async () => {
          const btn = root.querySelector('[data-yes]');
          if (onConfirm) {
            btn.disabled = true;
            try {
              await onConfirm();
            } catch {
              btn.disabled = false;
              return;
            }
          }
          close();
          resolve(true);
        });
        root.querySelector('[data-no]').addEventListener('click', () => {
          close();
          resolve(false);
        });
      },
    });
    const observer = new MutationObserver(() => {
      if (!document.body.contains(document.querySelector('.modal-backdrop'))) {
        observer.disconnect();
        resolve(false);
      }
    });
    observer.observe(document.body, { childList: true });
  });
}

/* ---------------- Forms ---------------- */
export function fieldHTML(field, value, options = {}) {
  const id = `f_${field.name}_${Math.random().toString(36).slice(2, 7)}`;
  const span = field.span === 2 ? 'span-2' : '';
  const req = field.required ? '<span class="req">*</span>' : '';
  const val = value === undefined || value === null ? '' : value;
  const help = field.help ? `<div class="help">${escapeHTML(field.help)}</div>` : '';
  const attrs = [
    `id="${id}"`,
    `name="${escapeHTML(field.name)}"`,
    field.required ? 'required' : '',
    field.disabled ? 'disabled' : '',
    field.min !== undefined ? `min="${field.min}"` : '',
    field.max !== undefined ? `max="${field.max}"` : '',
    field.step !== undefined ? `step="${field.step}"` : '',
    field.maxlength ? `maxlength="${field.maxlength}"` : '',
    field.autocomplete ? `autocomplete="${field.autocomplete}"` : '',
    field.inputmode ? `inputmode="${field.inputmode}"` : '',
    field.dir ? `dir="${field.dir}"` : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (field.type === 'hidden') {
    return `<input type="hidden" name="${escapeHTML(field.name)}" value="${escapeHTML(val)}" ${field.disabled ? 'disabled' : ''}>`;
  }

  if (field.type === 'switch') {
    return `<div class="field ${span}">
      <label class="switch"><input type="checkbox" name="${escapeHTML(field.name)}" ${val ? 'checked' : ''} ${field.disabled ? 'disabled' : ''}><span class="track"></span><span>${escapeHTML(field.label || '')}</span></label>
      ${help}
    </div>`;
  }

  let control = '';
  if (field.type === 'select') {
    const list = field.options || [];
    control = `<select class="select" ${attrs}>${list
      .map((option) => {
        const opt = typeof option === 'string' ? { value: option, label: option } : option;
        return `<option value="${escapeHTML(opt.value)}" ${String(opt.value) === String(val) ? 'selected' : ''}>${escapeHTML(opt.label)}</option>`;
      })
      .join('')}</select>`;
  } else if (field.type === 'textarea') {
    control = `<textarea class="textarea" rows="${field.rows || 4}" ${attrs} placeholder="${escapeHTML(field.placeholder || '')}">${escapeHTML(val)}</textarea>`;
  } else if (field.type === 'checkbox') {
    return `<div class="field ${span}"><label class="checkline"><input type="checkbox" name="${escapeHTML(field.name)}" ${val ? 'checked' : ''} ${field.disabled ? 'disabled' : ''}><span>${escapeHTML(field.label || '')}</span></label>${help}</div>`;
  } else {
    const type = field.type || 'text';
    control = `<input class="input" type="${type}" ${attrs} value="${escapeHTML(val)}" placeholder="${escapeHTML(field.placeholder || '')}" ${field.step ? `step="${field.step}"` : ''}>`;
  }

  return `<div class="field ${span}">
    <label for="${id}">${escapeHTML(field.label || '')}${req}</label>
    ${control}
    ${help}
  </div>`;
}

export function fieldsHTML(fields, values = {}) {
  return `<div class="form-grid">${fields
    .map((field) => fieldHTML(field, values[field.name], values))
    .join('')}</div>`;
}

export function collectForm(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') {
      out[el.name] = el.checked;
    } else if (el.type === 'number') {
      out[el.name] = el.value === '' ? null : Number(el.value);
    } else if (el.multiple) {
      out[el.name] = [...el.selectedOptions].map((option) => option.value);
    } else {
      out[el.name] = el.value;
    }
  }
  return out;
}

export function formModal({
  title,
  sub = '',
  fields = [],
  values = {},
  submitText = 'حفظ',
  cancelText = 'إلغاء',
  onSubmit,
  wide = false,
  note = '',
  extraBody = '',
  onMount = null,
  footerExtra = '',
} = {}) {
  const body = `${note ? `<div class="demo-box" style="margin:0 0 14px">${note}</div>` : ''}
    <form novalidate>${fieldsHTML(fields, values)}${extraBody}</form>`;
  return openModal({
    title,
    sub,
    wide,
    body,
    footer: `<button class="btn" data-submit>${icon('save')}${escapeHTML(submitText)}</button>
      <button class="btn secondary" data-close>${escapeHTML(cancelText)}</button>
      <span class="grow"></span>${footerExtra}`,
    onMount: ({ root, close }) => {
      const form = root.querySelector('form');
      const submitBtn = root.querySelector('[data-submit]');
      const submit = async () => {
        const valuesOut = collectForm(form);
        submitBtn.disabled = true;
        const original = submitBtn.innerHTML;
        submitBtn.innerHTML = `${icon('refresh')}لحظة...`;
        form.querySelectorAll('.field-error').forEach((el) => el.remove());
        form.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
        try {
          const keepOpen = await onSubmit(valuesOut, { form, close, root });
          if (keepOpen !== false) close();
        } catch (error) {
          if (error.fields) {
            for (const [name, message] of Object.entries(error.fields)) {
              if (!message) continue;
              const input = form.querySelector(`[name="${CSS.escape(name)}"]`);
              if (input) {
                input.classList.add('invalid');
                const hint = document.createElement('div');
                hint.className = 'help field-error';
                hint.style.color = 'var(--coral)';
                hint.textContent = message;
                input.closest('.field')?.appendChild(hint);
              }
            }
          }
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = original;
        }
      };
      submitBtn.addEventListener('click', submit);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        submit();
      });
      if (onMount) onMount({ root, form, close });
    },
  });
}

/* ---------------- Print ---------------- */
export function printHTML(html) {
  const root = document.getElementById('print-root');
  if (!root) return;
  root.innerHTML = html;
  const run = () => {
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        root.innerHTML = '';
      }, 500);
    }, 80);
  };
  if (document.fonts?.ready) document.fonts.ready.then(run);
  else run();
}

export function moneyClass(value) {
  const n = Number(value) || 0;
  return n > 0 ? 'debt' : n < 0 ? 'ok' : 'zero';
}

export function optionList(list, { valueKey = 'id', labelKey = 'name', placeholder = '' } = {}) {
  return `${placeholder ? `<option value="">${escapeHTML(placeholder)}</option>` : ''}${list
    .map((item) => `<option value="${escapeHTML(item[valueKey])}">${escapeHTML(item[labelKey])}</option>`)
    .join('')}`;
}

export function statusPillForLesson(lesson) {
  if (lesson.status === 'cancelled') return '<span class="badge red">ملغية</span>';
  if (lesson.status === 'done') return '<span class="badge green">خلصت</span>';
  if (lesson.marked && lesson.studentCount && lesson.marked >= lesson.studentCount) {
    return '<span class="badge green">اتحضّرت</span>';
  }
  return '<span class="badge blue">قادمة</span>';
}
