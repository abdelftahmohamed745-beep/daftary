'use strict';

import { escapeHTML, dateFull, relativeDay, money, formatNumber } from './api.js';
import { icon, avatarHTML, toast, emptyHTML } from './ui.js';
import { barcodeHTML } from './barcode.js';

const app = document.getElementById('public-app');
const state = { portal: null, profile: null, cert: null, error: '' };

function currentTheme() {
  return localStorage.getItem('daftary-theme') || 'light';
}

function applyTheme(theme) {
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('daftary-theme', next);
  const button = document.querySelector('[data-theme-btn]');
  if (button) button.innerHTML = icon(next === 'dark' ? 'sun' : 'moon');
}

async function getJSON(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    throw new Error((data && (data.message || data.error)) || 'مش قادر أجيب البيانات دلوقتي.');
  }
  return data;
}

function shellHTML() {
  const settings = state.portal?.settings || {};
  const stats = state.portal?.stats || { students: 0, groups: 0, lessons: 0, certificates: 0 };
  return `<div class="public-shell">
    <header class="public-topbar">
      <a class="brand" href="/portal.html">
        <span class="brand-mark">د</span>
        <div><div class="brand-name">دفتري</div><div class="brand-sub">بوابة الطالب</div></div>
      </a>
      <div class="row" style="gap:8px">
        <a class="btn secondary sm desktop-only" href="/">${icon('arrowLeft')}دخول النظام</a>
        <button class="icon-btn" data-theme-btn aria-label="تغيير المظهر">${icon(currentTheme() === 'dark' ? 'sun' : 'moon')}</button>
      </div>
    </header>

    <main class="public-main">
      <section class="portal-banner">
        <div>
          <span class="login-kicker">${icon('smartphone')} بوابة أولياء الأمور</span>
          <h2>تابع ابنك من غير ما تتصل</h2>
          <p>الحضور، الدرجات، الشهادات، والمتأخرات — كلها بكود الطالب. اكتب الكود اللي على كارت الطالب وكل حاجة هتظهر قدامك.</p>
        </div>
        <div class="portal-stats">
          <span><strong>${formatNumber(stats.students)}</strong> طالب</span>
          <span><strong>${formatNumber(stats.groups)}</strong> مجموعة</span>
          <span><strong>${formatNumber(stats.certificates)}</strong> شهادة</span>
        </div>
      </section>

      <div class="public-note">
        ${icon('info')}
        <span>${escapeHTML(settings.message || 'البيانات المعروضة بتتحدث تلقائياً من دفتر المركز.')}</span>
      </div>

      <div class="grid grid-2 public-grid">
        <section class="card">
          <div class="card-head">
            <div><h2>بيانات الطالب</h2><div class="sub">اكتب كود الطالب — بيبدأ بـ DFT</div></div>
          </div>
          <form data-student-form class="row public-form" style="gap:8px">
            <input class="input mono" name="code" dir="ltr" autocomplete="off" placeholder="DFT-2026-0001" aria-label="كود الطالب" required>
            <button class="btn" type="submit">${icon('search')}عرض</button>
          </form>
          <div class="mt-3" data-profile>${emptyHTML('smartphone', 'مستني كود الطالب', 'اكتب الكود فوق عشان تشوف الحضور والدرجات والشهادات.')}</div>
        </section>

        <section class="card">
          <div class="card-head">
            <div><h2>التحقق من شهادة</h2><div class="sub">اكتب كود الشهادة — بيبدأ بـ CERT</div></div>
          </div>
          <form data-cert-form class="row public-form" style="gap:8px">
            <input class="input mono" name="code" dir="ltr" autocomplete="off" placeholder="CERT-2026-0001" aria-label="كود الشهادة" required>
            <button class="btn secondary" type="submit">${icon('shield')}تحقق</button>
          </form>
          <div class="mt-3" data-cert>${emptyHTML('shield', 'مستني كود الشهادة', 'بعد التحقق هتعرف إذا كانت الشهادة سارية ولا لأ.')}</div>
        </section>
      </div>

      <section class="card mt-3">
        <div class="card-head">
          <div><h2>المراحل والمجموعات</h2><div class="sub">${Object.keys(state.portal?.stages || {}).length} مرحلة متاحة</div></div>
        </div>
        <div class="grid grid-3">
          ${Object.entries(state.portal?.stages || {})
            .map(
              ([stage, groups]) => `<div class="stage-block">
                <div class="stage-title">${escapeHTML(stage)}</div>
                ${groups
                  .map(
                    (group) => `<div class="stage-group">
                      <span class="group-dot" style="background:${escapeHTML(group.color)}"></span>
                      <div class="grow"><div class="strong small">${escapeHTML(group.name)}</div>
                      <div class="tiny muted">${escapeHTML(group.subject)} · ${formatNumber(group.students)} طالب</div></div>
                      <span class="badge gray">${(group.schedule || []).length} موعد</span>
                    </div>`,
                  )
                  .join('')}
              </div>`,
            )
            .join('') || emptyHTML('grid', 'مفيش مجموعات متاحة', '')}
        </div>
      </section>
    </main>

    <footer class="public-foot">
      <span>${escapeHTML(settings.centerName || 'دفتري')} · ${escapeHTML(settings.academicYear || '')}</span>
      <span>${escapeHTML(settings.phone || '')}</span>
    </footer>
  </div>`;
}

function profileHTML(profile) {
  const student = profile.student;
  const settings = profile.settings || {};
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

    <div class="scan-barcode mt-3" style="display:grid;place-items:center">${barcodeHTML(student.code, { height: 40 })}</div>

    ${
      settings.showExams !== false && profile.exams.length
        ? `<section class="card mt-3">
            <div class="card-head"><div><h2>الدرجات</h2><div class="sub">آخر الامتحانات</div></div></div>
            <div class="table-wrap"><table class="table compact">
              <thead><tr><th>الامتحان</th><th>التاريخ</th><th class="num">الدرجة</th><th class="num">النسبة</th></tr></thead>
              <tbody>${profile.exams
                .slice(0, 10)
                .map(
                  (exam) => `<tr>
                    <td class="small strong">${escapeHTML(exam.title)}</td>
                    <td class="small muted">${escapeHTML(relativeDay(exam.date))}</td>
                    <td class="num small">${exam.graded ? `${exam.score} / ${exam.maxScore}` : '—'}</td>
                    <td class="num">${
                      exam.percent !== null
                        ? `<span class="badge ${exam.percent >= 75 ? 'green' : exam.percent >= 50 ? 'amber' : 'red'}">${exam.percent}%</span>`
                        : '<span class="badge gray">لسه</span>'
                    }</td>
                  </tr>`,
                )
                .join('')}</tbody>
            </table></div>
          </section>`
        : ''
    }

    ${
      settings.showCertificates !== false && profile.certificates.length
        ? `<section class="card mt-3">
            <div class="card-head"><div><h2>الشهادات</h2><div class="sub">${profile.certificates.length} شهادة سارية</div></div></div>
            <div class="stack-sm">${profile.certificates
              .map(
                (cert) => `<div class="mini-rank">
                  <span class="alert-icon good">${icon('award')}</span>
                  <div class="grow"><div class="strong small">${escapeHTML(cert.title)}</div>
                  <div class="tiny muted">${escapeHTML(dateFull(cert.issuedAt))}</div></div>
                  <span class="badge green mono" dir="ltr">${escapeHTML(cert.code)}</span>
                </div>`,
              )
              .join('')}</div>
          </section>`
        : ''
    }

    ${
      profile.balance !== null && settings.showBalance
        ? `<div class="portal-balance ${profile.balance > 0 ? 'due' : ''}">
            <span>${profile.balance > 0 ? 'المتأخرات' : 'الحساب'}</span>
            <strong>${money(Math.max(0, profile.balance))}</strong>
          </div>`
        : ''
    }

    ${settings.message ? `<div class="portal-message">${icon('info')}<div>${escapeHTML(settings.message)}</div></div>` : ''}
  </div>`;
}

function certHTML(result) {
  const cert = result.certificate;
  return `<div class="stack-sm">
    <div class="alert-banner ${result.valid ? 'good' : 'bad'}">
      ${icon(result.valid ? 'checkCircle' : 'xCircle')}
      <div><strong>${result.valid ? 'الشهادة سارية وصحيحة' : 'الشهادة ملغية'}</strong>
      <div class="small">${escapeHTML(cert.title)} — ${escapeHTML(cert.studentName)}</div></div>
    </div>
    <div class="kv-list">
      <div class="kv-row"><span>الكود</span><span class="mono" dir="ltr">${escapeHTML(cert.code)}</span></div>
      <div class="kv-row"><span>تاريخ الإصدار</span><span>${escapeHTML(dateFull(cert.issuedAt))}</span></div>
      <div class="kv-row"><span>المركز</span><span>${escapeHTML(result.settings.centerName || '')}</span></div>
      <div class="kv-row"><span>الحالة</span><span class="badge ${result.valid ? 'green' : 'red'}">${result.valid ? 'سارية' : 'ملغية'}</span></div>
    </div>
  </div>`;
}

function render() {
  app.innerHTML = shellHTML();
  applyTheme(currentTheme());
  document.querySelector('[data-theme-btn]')?.addEventListener('click', () => {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  });

  const profileBox = app.querySelector('[data-profile]');
  const certBox = app.querySelector('[data-cert]');
  if (state.profile) profileBox.innerHTML = profileHTML(state.profile);
  if (state.cert) certBox.innerHTML = certHTML(state.cert);
  if (state.error) profileBox.innerHTML = `<div class="alert-banner bad">${icon('alert')}<div>${escapeHTML(state.error)}</div></div>`;

  app.querySelector('[data-student-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const code = form.code.value.trim();
    if (!code) return;
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      const data = await getJSON(`/api/public/portal/${encodeURIComponent(code)}`);
      state.profile = data.profile;
      state.error = '';
      profileBox.innerHTML = profileHTML(data.profile);
      const params = new URLSearchParams(location.search);
      params.set('code', code);
      history.replaceState(null, '', `?${params.toString()}`);
      toast('البيانات ظهرت');
    } catch (error) {
      state.profile = null;
      state.error = error.message;
      profileBox.innerHTML = `<div class="alert-banner bad">${icon('alert')}<div>${escapeHTML(error.message)}</div></div>`;
    } finally {
      button.disabled = false;
    }
  });

  app.querySelector('[data-cert-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const code = form.code.value.trim();
    if (!code) return;
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      const data = await getJSON(`/api/public/certificate/${encodeURIComponent(code)}`);
      state.cert = data;
      certBox.innerHTML = certHTML(data);
      const params = new URLSearchParams(location.search);
      params.set('cert', code);
      history.replaceState(null, '', `?${params.toString()}`);
    } catch (error) {
      state.cert = null;
      certBox.innerHTML = `<div class="alert-banner bad">${icon('xCircle')}<div>${escapeHTML(error.message)}</div></div>`;
    } finally {
      button.disabled = false;
    }
  });
}

async function boot() {
  try {
    const data = await getJSON('/api/public/portal');
    state.portal = data;
  } catch (error) {
    app.innerHTML = `<div class="public-shell"><main class="public-main">
      <div class="empty" style="padding:80px 20px">
        <div class="empty-icon">${icon('shield')}</div>
        <h3>البوابة متقفلة حالياً</h3>
        <p>${escapeHTML(error.message)}</p>
        <a class="btn mt-3" href="/">${icon('arrowLeft')}دخول النظام</a>
      </div>
    </main></div>`;
    return;
  }

  render();

  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const cert = params.get('cert');
  if (code) {
    const form = app.querySelector('[data-student-form]');
    form.code.value = code;
    form.requestSubmit();
  }
  if (cert) {
    const form = app.querySelector('[data-cert-form]');
    form.code.value = cert;
    form.requestSubmit();
  }
}

boot();
