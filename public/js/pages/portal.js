'use strict';

import { api, escapeHTML, money, formatNumber, dateFull, relativeDay } from '../api.js';
import { icon, avatarHTML, toast, emptyHTML, ringHTML } from '../ui.js';

const STATUS_LABELS = { present: 'حاضر', absent: 'غايب', late: 'متأخر', excused: 'بعذر' };

function profileHTML(data) {
  const { profile } = data;
  const student = profile.student;
  return `<div class="portal-profile">
    <div class="portal-hero">
      ${avatarHTML(student.name, student.avatarColor)}
      <div class="grow" style="min-width:0">
        <div class="strong">${escapeHTML(student.name)}</div>
        <div class="small muted">${escapeHTML(student.grade || '')} · ${escapeHTML(student.school || '')}</div>
        <div class="mono tiny" dir="ltr">${escapeHTML(student.code)}</div>
      </div>
      <div class="portal-points"><strong>${formatNumber(profile.points)}</strong><small>نقطة</small></div>
    </div>

    <div class="grid grid-3 mt-3">
      <div class="portal-stat"><span>نسبة الحضور</span><strong>${profile.attendance.rate}%</strong>
        <div class="progress thin mt-1"><span style="width:${profile.attendance.rate}%"></span></div></div>
      <div class="portal-stat"><span>الغياب</span><strong>${profile.attendance.absent}</strong><small>من ${profile.attendance.total} حصة</small></div>
      <div class="portal-stat"><span>المجموعات</span><strong>${profile.groups.length}</strong><small>${escapeHTML(profile.groups.map((g) => g.subject).join('، '))}</small></div>
    </div>

    ${profile.settings.showExams !== false && profile.exams.length ? `<section class="card mt-3">
      <div class="card-head"><div><h2>الدرجات</h2><div class="sub">آخر الامتحانات</div></div></div>
      <div class="table-wrap"><table class="table compact">
        <thead><tr><th>الامتحان</th><th>التاريخ</th><th class="num">الدرجة</th><th class="num">النسبة</th></tr></thead>
        <tbody>${profile.exams.slice(0, 10).map((exam) => `<tr>
          <td class="small strong">${escapeHTML(exam.title)}</td>
          <td class="small muted">${escapeHTML(relativeDay(exam.date))}</td>
          <td class="num small">${exam.graded ? `${exam.score} / ${exam.maxScore}` : '—'}</td>
          <td class="num">${exam.percent !== null ? `<span class="badge ${exam.percent >= 75 ? 'green' : exam.percent >= 50 ? 'amber' : 'red'}">${exam.percent}%</span>` : '<span class="badge gray">لسه</span>'}</td>
        </tr>`).join('')}</tbody></table></div>
    </section>` : ''}

    ${profile.settings.showCertificates !== false && profile.certificates.length ? `<section class="card mt-3">
      <div class="card-head"><div><h2>الشهادات</h2><div class="sub">${profile.certificates.length} شهادة سارية</div></div></div>
      <div class="stack-sm">${profile.certificates.map((cert) => `<div class="mini-rank">
        <span class="alert-icon good">${icon('award')}</span>
        <div class="grow"><div class="strong small">${escapeHTML(cert.title)}</div>
        <div class="tiny muted">${escapeHTML(dateFull(cert.issuedAt))}</div></div>
        <span class="badge green mono" dir="ltr">${escapeHTML(cert.code)}</span>
      </div>`).join('')}</div>
    </section>` : ''}

    ${profile.balance !== null && profile.settings.showBalance ? `<div class="portal-balance ${profile.balance > 0 ? 'due' : ''}">
      <span>${profile.balance > 0 ? 'المتأخرات' : 'الحساب'}</span>
      <strong>${money(Math.max(0, profile.balance))}</strong>
    </div>` : ''}

    ${profile.settings.message ? `<div class="portal-message">${icon('info')}<div>${escapeHTML(profile.settings.message)}</div></div>` : ''}
  </div>`;
}

export async function render(ctx) {
  const portal = await api.get('/api/public/portal');
  const code = ctx.query.get('code') || '';
  let profile = null;
  if (code) {
    try {
      profile = await api.get(`/api/public/portal/${encodeURIComponent(code)}`);
    } catch (error) {
      toast(error.message, 'error');
    }
  }
  const stages = Object.entries(portal.stages || {});

  return `<div class="page">
    <div class="page-head">
      <div><h1>بوابة الطالب</h1><div class="sub">${escapeHTML(portal.settings.centerName)} · ${escapeHTML(portal.settings.academicYear || '')}</div></div>
      <div class="page-actions">
        <a class="btn secondary" href="#/verify">${icon('shield')}تحقق من شهادة</a>
        <button class="btn secondary" data-open-public>${icon('eye')}معاينة عامة</button>
      </div>
    </div>

    <div class="portal-banner">
      <div>
        <span class="login-kicker">${icon('smartphone')} بوابة أولياء الأمور</span>
        <h2>تابع ابنك من غير ما تتصل</h2>
        <p>الحضور، الدرجات، الشهادات، والمتأخرات — كلها بكود الطالب.</p>
      </div>
      <div class="portal-stats">
        <span><strong>${portal.stats.students}</strong> طالب</span>
        <span><strong>${portal.stats.groups}</strong> مجموعة</span>
        <span><strong>${portal.stats.certificates}</strong> شهادة</span>
      </div>
    </div>

    <div class="grid grid-2 mt-3">
      <section class="card">
        <div class="card-head"><div><h2>ادخل بكود الطالب</h2><div class="sub">الكود موجود على كارت الطالب</div></div></div>
        <form data-lookup class="row" style="gap:8px">
          <input class="input mono" name="code" dir="ltr" placeholder="DFT-2026-0001" value="${escapeHTML(code)}" required>
          <button class="btn" type="submit">${icon('search')}عرض</button>
        </form>
        <div class="help mt-2">معاك كود الطالب؟ اكتبه فوق، أو <button type="button" class="link-button" data-demo>جرّب طالب من النظام</button>.</div>
        <div class="mt-3" data-profile>
          ${profile ? profileHTML(profile) : emptyHTML('smartphone', 'مستني كود الطالب', 'اكتب الكود فوق عشان تشوف بيانات الطالب.')}
        </div>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>المراحل والمجموعات</h2><div class="sub">${stages.length} مرحلة متاحة</div></div></div>
        <div class="stack-sm">
          ${stages.length
            ? stages.map(([stage, groups]) => `<div class="stage-block">
                <div class="stage-title">${escapeHTML(stage)}</div>
                ${groups.map((group) => `<div class="stage-group">
                  <span class="group-dot" style="background:${escapeHTML(group.color)}"></span>
                  <div class="grow"><div class="strong small">${escapeHTML(group.name)}</div>
                  <div class="tiny muted">${escapeHTML(group.subject)} · ${group.students} طالب</div></div>
                  <span class="badge gray">${group.schedule?.length || 0} موعد</span>
                </div>`).join('')}
              </div>`).join('')
            : emptyHTML('grid', 'مفيش مجموعات', '')}
        </div>
        ${portal.settings.message ? `<div class="portal-message mt-3">${icon('message')}<div>${escapeHTML(portal.settings.message)}</div></div>` : ''}
      </section>
    </div>
  </div>`;
}

export async function mount(root) {
  const form = root.querySelector('[data-lookup]');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const code = form.code.value.trim();
    if (code) location.hash = `#/portal?code=${encodeURIComponent(code)}`;
  });
  root.querySelector('[data-open-public]')?.addEventListener('click', () => {
    window.open('/portal.html', '_blank', 'noopener');
  });
  root.querySelector('[data-demo]')?.addEventListener('click', async () => {
    const data = await api.get('/api/students?limit=1');
    const student = data.items[0];
    if (student) location.hash = `#/portal?code=${encodeURIComponent(student.code)}`;
  });
}
