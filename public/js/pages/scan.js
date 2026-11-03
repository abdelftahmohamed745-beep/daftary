'use strict';

import { api, escapeHTML, money, timeLabel, todayISO } from '../api.js';
import { icon, avatarHTML, toast, emptyHTML } from '../ui.js';
import { barcodeHTML } from '../barcode.js';

const STATUS_LABELS = { present: 'حاضر', absent: 'غايب', late: 'متأخر', excused: 'بعذر', unmarked: 'لسه' };

function studentPanel(data) {
  const { student, lessons } = data;
  return `<div class="scan-result">
    <div class="scan-student">
      ${avatarHTML(student.name, student.avatarColor)}
      <div class="grow" style="min-width:0">
        <div class="strong">${escapeHTML(student.name)}</div>
        <div class="small muted">${escapeHTML(student.grade || '')} · ${escapeHTML(student.code)}</div>
        <div class="row mt-1" style="gap:6px">
          <span class="badge ${data.balance > 0 ? 'red' : 'green'}">${data.balance > 0 ? `عليه ${money(data.balance)}` : 'مفيش متأخرات'}</span>
          <span class="badge blue">${data.points} نقطة</span>
        </div>
      </div>
      <div class="scan-barcode">${barcodeHTML(student.code, { height: 44 })}</div>
    </div>
    <div class="card-head mt-2"><div><h2>حصص النهارده</h2><div class="sub">اختار الحصة وسجّل الحضور</div></div></div>
    ${lessons.length
      ? `<div class="stack-sm">${lessons.map((lesson) => `<div class="scan-lesson" data-lesson="${lesson.id}">
          <span class="group-dot" style="background:${escapeHTML(lesson.groupColor)}"></span>
          <div class="grow"><div class="strong small">${escapeHTML(lesson.groupName)}</div>
          <div class="tiny muted">${escapeHTML(timeLabel(lesson.start))} · ${escapeHTML(lesson.topic || 'حصة')}</div></div>
          <span class="badge ${lesson.status === 'present' ? 'green' : lesson.status === 'absent' ? 'red' : lesson.status === 'late' ? 'amber' : 'gray'}">${STATUS_LABELS[lesson.status] || lesson.status}</span>
          <div class="row" style="gap:4px">
            ${['present', 'late', 'absent'].map((status) => `<button class="btn xs ${lesson.status === status ? '' : 'secondary'}" data-mark="${status}">${STATUS_LABELS[status]}</button>`).join('')}
          </div>
        </div>`).join('')}</div>`
      : `<div class="empty" style="padding:22px"><p>مفيش حصص للطالب ده النهارده.</p></div>`}
  </div>`;
}

export async function render(ctx) {
  return `<div class="page">
    <div class="page-head">
      <div><h1>التحضير بالباركود</h1><div class="sub">امسح كود الطالب أو اكتبه يدوي — التحضير في ثانية</div></div>
      <div class="page-actions">
        <a class="btn secondary" href="#/id-cards">${icon('credit')}كروت الطلبة</a>
        <a class="btn secondary" href="#/archive">${icon('archive')}أرشيف الغياب</a>
      </div>
    </div>

    <div class="grid grid-2">
      <section class="card">
        <div class="card-head"><div><h2>الماسح</h2><div class="sub">الكود بيبدأ بـ DFT — تقدر تستخدم قارئ باركود USB</div></div></div>
        <form data-scan class="scan-form">
          <div class="scan-icon">${icon('smartphone')}</div>
          <input class="input mono scan-input" name="code" dir="ltr" autocomplete="off" autofocus
            placeholder="DFT-2026-0001" aria-label="كود الطالب">
          <button class="btn" type="submit">${icon('search')}بحث وتحضير</button>
        </form>
        <div class="help mt-2">جرّب مثال: <button class="link-button mono" data-demo type="button">DFT-2026-0001</button></div>
        <div class="scan-log" data-log></div>
      </section>

      <section class="card" data-result>
        ${emptyHTML('smartphone', 'مستني الكود', 'اول ما تمسح كود الطالب، بياناته وحصص النهارده هتظهر هنا.')}
      </section>
    </div>
  </div>`;
}

export async function mount(root, ctx) {
  const form = root.querySelector('[data-scan]');
  const result = root.querySelector('[data-result]');
  const log = root.querySelector('[data-log]');
  let current = null;

  const scans = [];
  const renderLog = () => {
    if (!scans.length) {
      log.innerHTML = '';
      return;
    }
    log.innerHTML = `<div class="card-head mt-2"><div><h2>آخر عمليات المسح</h2></div></div><div class="stack-sm">${scans
      .slice(0, 6)
      .map((item) => `<div class="mini-rank"><span class="alert-icon good">${icon('checkCircle')}</span>
        <div class="grow"><div class="strong small">${escapeHTML(item.name)}</div>
        <div class="tiny muted">${escapeHTML(item.action)}</div></div>
        <span class="tiny muted">${escapeHTML(item.time)}</span></div>`)
      .join('')}</div>`;
  };

  const renderResult = (data) => {
    current = data;
    result.innerHTML = studentPanel(data);
    result.querySelectorAll('.scan-lesson').forEach((row) => {
      const lessonId = row.dataset.lesson;
      row.querySelectorAll('[data-mark]').forEach((button) => {
        button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            await api.post('/api/scan/attendance', {
              code: data.student.code,
              lessonId,
              status: button.dataset.mark,
            });
            scans.unshift({
              name: data.student.shortName || data.student.name,
              action: `${STATUS_LABELS[button.dataset.mark]} — ${row.querySelector('.strong').textContent}`,
              time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
            });
            renderLog();
            const refreshed = await api.post('/api/scan', { code: data.student.code });
            renderResult(refreshed);
            toast('الحضور اتسجل');
          } catch (error) {
            toast(error.message, 'error');
            button.disabled = false;
          }
        });
      });
    });
  };

  const search = async (code) => {
    const value = String(code || '').trim();
    if (!value) return;
    try {
      const data = await api.post('/api/scan', { code: value });
      renderResult(data);
      form.code.value = '';
      form.code.focus();
    } catch (error) {
      toast(error.message, 'error');
      form.code.select();
    }
  };

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    search(form.code.value);
  });
  root.querySelector('[data-demo]')?.addEventListener('click', async () => {
    const data = await api.get('/api/students?limit=1');
    const student = data.items[0];
    if (student) search(student.code);
  });
}
