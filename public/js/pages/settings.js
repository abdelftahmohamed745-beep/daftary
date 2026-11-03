'use strict';

import { api, escapeHTML, dateFull, timeLabel } from '../api.js';
import { icon, toast } from '../ui.js';

const WEEK_DAYS = ['الأحد', 'الاتنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function section(title, sub, body) {
  return `<section class="card">
    <div class="card-head"><div><h2>${escapeHTML(title)}</h2>${sub ? `<div class="sub">${escapeHTML(sub)}</div>` : ''}</div></div>
    ${body}
  </section>`;
}

function input(name, label, value, opts = {}) {
  return `<div class="field ${opts.span ? `span-${opts.span}` : ''}">
    <label>${escapeHTML(label)}</label>
    <input class="input" name="${name}" type="${opts.type || 'text'}" value="${escapeHTML(value ?? '')}"
      ${opts.min !== undefined ? `min="${opts.min}"` : ''} ${opts.max !== undefined ? `max="${opts.max}"` : ''}
      ${opts.dir ? `dir="${opts.dir}"` : ''} placeholder="${escapeHTML(opts.placeholder || '')}">
    ${opts.help ? `<div class="help">${escapeHTML(opts.help)}</div>` : ''}
  </div>`;
}

function area(name, label, value, opts = {}) {
  return `<div class="field ${opts.span ? `span-${opts.span}` : ''}">
    <label>${escapeHTML(label)}</label>
    <textarea class="textarea" name="${name}" rows="${opts.rows || 4}">${escapeHTML(value ?? '')}</textarea>
    ${opts.help ? `<div class="help">${escapeHTML(opts.help)}</div>` : ''}
  </div>`;
}

function toggle(name, label, checked, help) {
  return `<div class="field"><label class="switch">
    <input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span class="track"></span>
    <span>${escapeHTML(label)}</span></label>${help ? `<div class="help">${escapeHTML(help)}</div>` : ''}</div>`;
}

export async function render(ctx) {
  const [{ settings }, platform] = await Promise.all([
    api.get('/api/settings'),
    api.get('/api/platform'),
  ]);
  const pts = settings.points || {};
  const portal = settings.portal || {};
  const sync = settings.sync || {};

  return `<div class="page">
    <div class="page-head">
      <div><h1>الإعدادات</h1><div class="sub">كل حاجة بتخص المركز، الرسائل، البوابة، والنقاط</div></div>
      <div class="page-actions">
        <button class="btn" data-save>${icon('save')}حفظ الإعدادات</button>
      </div>
    </div>

    <div class="settings-layout">
      <div class="stack">
        <form data-settings-form>
          ${section('بيانات المركز', 'الاسم والعنوان اللي يظهر في الإيصالات والشهادات', `<div class="form-grid">
            ${input('centerName', 'اسم المركز', settings.centerName, { span: 2 })}
            ${input('teacherName', 'اسم المعلم', settings.teacherName)}
            ${input('phone', 'تليفون المركز', settings.phone, { dir: 'ltr' })}
            ${input('email', 'الإيميل', settings.email, { type: 'email', dir: 'ltr' })}
            ${input('address', 'العنوان', settings.address)}
            ${input('academicYear', 'السنة الدراسية', settings.academicYear)}
            ${input('invoicePrefix', 'بادئة الإيصالات', settings.invoicePrefix)}
          </div>`)}

          ${section('إعدادات التعليم', 'المدة، بداية الأسبوع، والباركود', `<div class="form-grid">
            ${input('lessonDuration', 'مدة الحصة (دقيقة)', settings.lessonDuration, { type: 'number', min: 15, max: 300 })}
            <div class="field"><label>بداية الأسبوع</label>
              <select class="select" name="weekStart">${WEEK_DAYS.map((day, index) => `<option value="${index}" ${Number(settings.weekStart) === index ? 'selected' : ''}>${day}</option>`).join('')}</select>
            </div>
            ${input('barcodePrefix', 'بادئة كود الطالب / الباركود', settings.barcodePrefix, { dir: 'ltr', help: 'حروف إنجليزي وأرقام بس — بتتستخدم في كروت الطلبة.' })}
            ${input('certificateSigner', 'اسم الموقّع على الشهادات', settings.certificateSigner)}
          </div>`)}

          ${section('العملة والفوترة', 'شكل الأرقام في كل الشاشات', `<div class="form-grid">
            ${input('currency', 'رمز العملة', settings.currency)}
            <div class="field"><label>مكان العملة</label>
              <select class="select" name="currencyPosition">
                <option value="after" ${settings.currencyPosition !== 'before' ? 'selected' : ''}>بعد الرقم</option>
                <option value="before" ${settings.currencyPosition === 'before' ? 'selected' : ''}>قبل الرقم</option>
              </select>
            </div>
          </div>`)}

          ${section('قوالب الرسائل', 'المتغيرات: {parent}، {student}، {teacher}، {date}، {time}، {amount}، {currency}، {phone}', `<div class="form-grid">
            ${area('reminderTemplate', 'رسالة تذكير بالحصة', settings.reminderTemplate, { span: 2, rows: 3 })}
            ${area('paymentTemplate', 'رسالة تذكير بالمتأخرات', settings.paymentTemplate, { span: 2, rows: 3 })}
          </div>`)}

          ${section('الشهادات والبوابة', 'نص الشهادة ورسالة بوابة أولياء الأمور', `<div class="form-grid">
            ${area('certificateNote', 'نص أسفل الشهادة', settings.certificateNote, { span: 2, rows: 2 })}
            ${area('portalMessage', 'رسالة بوابة الطالب', settings.portalMessage, { span: 2, rows: 2 })}
            ${toggle('enablePortal', 'تشغيل بوابة الطالب', settings.enablePortal !== false, 'لما تتقفل، أي حد بيحاول يفتح البوابة هيشوف رسالة إنها متقفلة.')}
            ${toggle('autoBackup', 'نسخة احتياطية تلقائية عند التشغيل', settings.autoBackup !== false)}
            ${toggle('portal.showAttendance', 'إظهار الحضور في البوابة', portal.showAttendance !== false)}
            ${toggle('portal.showExams', 'إظهار الدرجات والامتحانات', portal.showExams !== false)}
            ${toggle('portal.showCertificates', 'إظهار الشهادات', portal.showCertificates !== false)}
            ${toggle('portal.showBalance', 'إظهار المتأخرات المالية', Boolean(portal.showBalance), 'الأفضل تسيبها مقفولة لو مش عايز الأولياء يشوفوا الفلوس.')}
          </div>`)}

          ${section('نظام النقاط', 'كل حضور أو تصحيح بيضيف نقاط تلقائي — تقدر تظبط القيم', `<div class="form-grid">
            ${input('points.present', 'نقاط الحضور', pts.present, { type: 'number', min: -100, max: 100 })}
            ${input('points.late', 'نقاط التأخير', pts.late, { type: 'number', min: -100, max: 100 })}
            ${input('points.absent', 'نقاط الغياب', pts.absent, { type: 'number', min: -100, max: 100 })}
            ${input('points.excused', 'نقاط الغياب بعذر', pts.excused, { type: 'number', min: -100, max: 100 })}
            ${input('points.grade', 'نقاط إضافية للدرجة العالية', pts.grade, { type: 'number', min: -100, max: 100 })}
          </div>`)}

          <div class="row" style="margin-top:4px">
            <button class="btn" type="submit">${icon('save')}حفظ الإعدادات</button>
            <button class="btn secondary" type="reset">${icon('refresh')}استرجاع القيم</button>
          </div>
        </form>
      </div>

      <div class="stack">
        <section class="card">
          <div class="card-head"><div><h2>الترخيص والتفعيل</h2><div class="sub">حالة الاشتراك الحالي</div></div></div>
          <div class="platform-card ${platform.platform.expired ? 'expired' : ''}">
            <div class="row-between">
              <span class="badge ${platform.platform.active ? 'green' : 'red'} dot">${platform.platform.active ? 'نشط' : 'متوقف'}</span>
              <span class="small strong">باقة ${escapeHTML(platform.platform.plan)}</span>
            </div>
            <div class="platform-days">${platform.platform.expired ? 'انتهى الاشتراك' : `${platform.platform.daysLeft} يوم متبقي`}</div>
            <div class="small muted">ينتهي ${escapeHTML(dateFull(platform.platform.expiresAt))}</div>
            <a class="btn soft sm mt-2" href="#/platform">${icon('award')}إدارة الأكواد والتفعيل</a>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><div><h2>المزامنة</h2><div class="sub">نسخة محلية من الملفات</div></div></div>
          <div class="kv-list">
            <div class="kv-row"><span>الحالة</span><span class="badge ${sync.enabled ? 'green' : 'gray'}">${sync.enabled ? 'مفعلة' : 'مقفولة'}</span></div>
            <div class="kv-row"><span>المجلد</span><span class="small" dir="ltr" style="text-align:end">${escapeHTML(sync.folder || '—')}</span></div>
            <div class="kv-row"><span>كل</span><span>${Number(sync.intervalMinutes) || 60} دقيقة</span></div>
            <div class="kv-row"><span>آخر مزامنة</span><span>${sync.lastSyncAt ? escapeHTML(timeLabel(new Date(sync.lastSyncAt).toTimeString().slice(0, 5))) : 'لسه'}</span></div>
          </div>
          <a class="btn secondary sm mt-2" href="#/sync">${icon('refresh')}إعدادات المزامنة</a>
        </section>

        <section class="card">
          <div class="card-head"><div><h2>روابط سريعة</h2><div class="sub">صفحات إدارية مرتبطة</div></div></div>
          <div class="list">
            <a class="list-row" href="#/users">${icon('shield')}<div class="list-main"><div class="list-title">المستخدمين والصلاحيات</div></div>${icon('chevronLeft')}</a>
            <a class="list-row" href="#/backups">${icon('database')}<div class="list-main"><div class="list-title">النسخ الاحتياطي</div></div>${icon('chevronLeft')}</a>
            <a class="list-row" href="#/activity">${icon('activity')}<div class="list-main"><div class="list-title">سجل النشاط</div></div>${icon('chevronLeft')}</a>
            <a class="list-row" href="#/portal" target="_blank" rel="noopener">${icon('smartphone')}<div class="list-main"><div class="list-title">معاينة بوابة الطالب</div></div>${icon('chevronLeft')}</a>
          </div>
        </section>
      </div>
    </div>
  </div>`;
}

function readForm(form) {
  const values = { points: {}, portal: {} };
  for (const el of form.elements) {
    if (!el.name) continue;
    const value = el.type === 'checkbox' ? el.checked : el.value;
    if (el.name.startsWith('points.')) values.points[el.name.slice(7)] = Number(value) || 0;
    else if (el.name.startsWith('portal.')) values.portal[el.name.slice(7)] = value;
    else if (el.type === 'number') values[el.name] = value === '' ? null : Number(value);
    else values[el.name] = value;
  }
  return values;
}

export async function mount(root, ctx) {
  const form = root.querySelector('[data-settings-form]');

  const save = async () => {
    const button = root.querySelector('[data-save]');
    button.disabled = true;
    button.innerHTML = `${icon('refresh')}بيحفظ…`;
    try {
      const values = readForm(form);
      const data = await api.patch('/api/settings', values);
      ctx.state.settings = { ...ctx.state.settings, ...data.settings };
      toast('الإعدادات اتحفظت');
      ctx.refresh();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      button.disabled = false;
      button.innerHTML = `${icon('save')}حفظ الإعدادات`;
    }
  };

  root.querySelector('[data-save]')?.addEventListener('click', save);
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    save();
  });
}
