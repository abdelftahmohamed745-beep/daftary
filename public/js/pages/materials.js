'use strict';

import { api, relativeDay, escapeHTML } from '../api.js';
import { icon, toast, emptyHTML, confirmModal } from '../ui.js';
import { materialModal, loadGroups } from '../forms.js';

const TYPE_LABELS = { link: 'رابط', note: 'ملاحظة', file: 'ملف' };
const TYPE_ICONS = { link: 'link', note: 'note', file: 'file' };

function fileSize(bytes) {
  const value = Number(bytes) || 0;
  if (!value) return '';
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} ميجا`;
  if (value >= 1024) return `${Math.round(value / 1024)} كيلو`;
  return `${value} بايت`;
}

function cardHTML(m) {
  const isFile = m.type === 'file';
  const isLink = m.type === 'link';
  const href = isLink ? m.url : isFile ? m.url : null;
  return `<article class="material-card" data-id="${m.id}">
    <div class="material-icon ${m.type}">${icon(TYPE_ICONS[m.type] || 'file')}</div>
    <div class="material-main">
      <div class="row-between">
        <h3 class="truncate">${escapeHTML(m.title)}</h3>
        <span class="badge gray">${TYPE_LABELS[m.type] || m.type}</span>
      </div>
      ${m.description ? `<p class="material-desc">${escapeHTML(m.description)}</p>` : ''}
      <div class="material-meta">
        ${m.groupName ? `<span class="chip"><span class="dot" style="--c:${escapeHTML(m.groupColor || 'var(--teal)')}"></span>${escapeHTML(m.groupName)}</span>` : '<span class="chip muted">لكل الطلبة</span>'}
        ${isFile ? `<span class="tiny muted">${escapeHTML(fileSize(m.fileSize))}</span>` : ''}
        <span class="tiny muted">${escapeHTML(relativeDay(String(m.createdAt).slice(0, 10)))}</span>
      </div>
      <div class="material-actions">
        ${href ? `<a class="btn xs secondary" href="${escapeHTML(href)}" target="_blank" rel="noopener">${icon(isFile ? 'download' : 'link')}${isFile ? 'تحميل' : 'فتح'}</a>` : ''}
        <button class="btn xs secondary" data-edit>${icon('settings')}تعديل</button>
        <button class="btn xs danger-soft" data-delete>${icon('trash')}حذف</button>
      </div>
    </div>
  </article>`;
}

function listHTML(items) {
  if (!items.length) return emptyHTML('folder', 'المكتبة فاضية', 'أضف رابط أو ملاحظة أو ملف يشاركه الطلبة.');
  return `<div class="material-grid">${items.map(cardHTML).join('')}</div>`;
}

export async function render(ctx) {
  const params = new URLSearchParams();
  for (const key of ['groupId', 'type', 'search']) if (ctx.query.get(key)) params.set(key, ctx.query.get(key));
  const [data, groups] = await Promise.all([
    api.get(`/api/materials?${params.toString()}`),
    loadGroups(),
  ]);
  const q = Object.fromEntries(params.entries());
  return `<div class="page">
    <div class="page-head">
      <div><h1>المكتبة</h1><div class="sub">${data.total} مادة متاحة للطلبة</div></div>
      <div class="page-actions">
        <button class="btn" data-add>${icon('plus')}إضافة للمكتبة</button>
      </div>
    </div>
    <div class="card">
      <div class="toolbar">
        <div class="search">${icon('search')}
          <input class="input" type="search" placeholder="دوّر في المكتبة…" value="${escapeHTML(q.search || '')}" data-search>
        </div>
        <select class="select" data-filter="groupId">
          <option value="">كل المجموعات</option>
          ${groups.map((g) => `<option value="${g.id}" ${q.groupId === g.id ? 'selected' : ''}>${escapeHTML(g.name)}</option>`).join('')}
        </select>
        <select class="select" data-filter="type">
          <option value="">كل الأنواع</option>
          ${Object.entries(TYPE_LABELS).map(([value, label]) => `<option value="${value}" ${q.type === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>
      <div data-list>${listHTML(data.items)}</div>
    </div>
  </div>`;
}

export async function mount(root, ctx) {
  const listEl = root.querySelector('[data-list]');
  const current = Object.fromEntries((ctx.query || new URLSearchParams()).entries());
  let timer = null;

  const bindList = () => {
    listEl.querySelectorAll('[data-id]').forEach((card) => {
      const id = card.dataset.id;
      card.querySelector('[data-delete]')?.addEventListener('click', () => {
        confirmModal({
          title: 'حذف المادة؟',
          message: 'المادة هتتشال من المكتبة نهائياً.',
          danger: true,
          onConfirm: async () => {
            await api.delete(`/api/materials/${id}`);
            toast('المادة اتحذفت');
            refresh();
          },
        });
      });
      card.querySelector('[data-edit]')?.addEventListener('click', () => {
        materialModal({ onSaved: refresh });
      });
    });
  };

  const refresh = async () => {
    const params = new URLSearchParams();
    for (const key of ['groupId', 'type', 'search']) if (current[key]) params.set(key, current[key]);
    listEl.style.opacity = '0.45';
    try {
      const data = await api.get(`/api/materials?${params.toString()}`);
      listEl.innerHTML = listHTML(data.items);
      listEl.style.opacity = '';
      root.querySelector('.page-head .sub').textContent = `${data.total} مادة متاحة للطلبة`;
      bindList();
    } catch (error) {
      listEl.style.opacity = '';
      toast(error.message, 'error');
    }
  };

  root.querySelector('[data-search]')?.addEventListener('input', (event) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      current.search = event.target.value.trim();
      refresh();
    }, 260);
  });
  root.querySelectorAll('[data-filter]').forEach((el) => {
    el.addEventListener('change', () => {
      current[el.dataset.filter] = el.value;
      refresh();
    });
  });
  root.querySelector('[data-add]')?.addEventListener('click', () => materialModal({ onSaved: refresh }));
  bindList();
  if (ctx.query?.get('new') === '1') materialModal({ onSaved: refresh });
}
