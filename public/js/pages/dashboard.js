'use strict';

import {
  api,
  money,
  compactMoney,
  formatNumber,
  dateFull,
  dateLong,
  chartDayLabel,
  relativeDay,
  relativeTime,
  timeLabel,
  todayISO,
  escapeHTML,
  STATUS_LABELS,
  METHOD_LABELS,
} from '../api.js';
import { icon, avatarHTML, ringHTML, toast, emptyHTML } from '../ui.js';

function kpi({ label, value, unit = '', foot, iconName, color, soft, href }) {
  const inner = `<div class="kpi" style="--kpi:${color};--kpi-soft:${soft}">
    <div class="kpi-top"><span>${escapeHTML(label)}</span>
      <span class="kpi-icon">${icon(iconName)}</span>
    </div>
    <div class="kpi-value">${value}${unit ? `<small>${escapeHTML(unit)}</small>` : ''}</div>
    <div class="kpi-foot">${foot || ''}</div>
  </div>`;
  return href ? `<a href="${href}" style="display:block;color:inherit">${inner}</a>` : inner;
}

function trendChart(points) {
  const max = Math.max(1, ...points.map((p) => p.rate));
  return `<div class="chart" style="height:132px">
    ${points
      .map((p, index) => {
        const h = Math.max(4, Math.round((p.rate / max) * 100));
        const isLast = index === points.length - 1;
        return `<div class="chart-col" title="${escapeHTML(dateLong(p.from))} — ${p.rate}%">
          <div class="chart-value ${isLast ? '' : 'muted'}">${p.total ? `${Math.round(p.rate)}%` : '—'}</div>
          <div class="chart-bars"><div class="chart-bar ${isLast ? '' : 'soft'}" style="height:${h}%"></div></div>
          <div class="chart-label">${escapeHTML(chartDayLabel(p.from))}</div>
        </div>`;
      })
      .join('')}
  </div>`;
}

function incomeChart(points) {
  const max = Math.max(1, ...points.map((p) => Math.max(p.income, p.expenses)));
  return `<div class="chart" style="height:150px">
    ${points
      .map((p) => `<div class="chart-col" title="${escapeHTML(p.label)} — دخل ${money(p.income)} / مصروف ${money(p.expenses)}">
        <div class="chart-value muted">${compactMoney(p.net)}</div>
        <div class="chart-bars">
          <div class="chart-bar" style="height:${Math.max(2, Math.round((p.income / max) * 100))}%"></div>
          <div class="chart-bar alt" style="height:${Math.max(2, Math.round((p.expenses / max) * 100))}%"></div>
        </div>
        <div class="chart-label">${escapeHTML(p.label.split(' ')[0])}</div>
      </div>`)
      .join('')}
  </div>`;
}

function lessonRow(lesson) {
  const marked = lesson.marked || 0;
  const total = lesson.studentCount || 0;
  const full = total > 0 && marked >= total;
  return `<a class="timeline-row" href="#/lessons/${lesson.id}" style="color:inherit">
    <div class="timeline-time">${escapeHTML(timeLabel(lesson.start))}<small>${escapeHTML(String(lesson.duration || 90))} د</small></div>
    <div class="timeline-body">
      <div class="timeline-title"><span class="group-dot" style="background:${escapeHTML(lesson.groupColor || '#2f6f5e')}"></span>
        ${escapeHTML(lesson.groupName || 'حصة')}</div>
      <div class="timeline-sub">${escapeHTML(lesson.topic || '')} · ${total} طالب</div>
    </div>
    <div class="timeline-end">
      ${full ? '<span class="badge green dot">اتحضّرت</span>' : marked ? `<span class="badge amber">${marked}/${total}</span>` : '<span class="badge blue dot">مستنية</span>'}
    </div>
  </a>`;
}

export async function render(ctx) {
  const data = await api.get('/api/dashboard');
  const { kpis, lessonsToday, debtors, recentPayments, alerts, groups, activity } = data;
  const today = data.today || todayISO();
  const netPositive = kpis.monthNet >= 0;
  const unmarked = lessonsToday.filter((l) => l.marked < l.studentCount).length;

  return `<div class="page">
    <div class="hello mb-3">
      <div>
        <h1>${greeting()} يا ${escapeHTML(String(ctx.user.name || '').split(' ').slice(-1)[0] || 'أستاذ')}</h1>
        <div class="date">${escapeHTML(dateFull(today))} · ${lessonsToday.length ? `عندك ${lessonsToday.length} حصة النهارده` : 'مفيش حصص النهارده، يوم هادي'}</div>
      </div>
      <div class="page-actions">
        ${unmarked ? `<a class="btn saffron" href="#/calendar">${icon('check')}حضّر ${unmarked} حصة</a>` : ''}
        <a class="btn" href="#/finance?new=payment">${icon('plus')}تسجيل دفعة</a>
        <a class="btn secondary" href="#/students?new=1">${icon('user')}طالب جديد</a>
      </div>
    </div>

    <div class="grid grid-4 mb-3">
      ${kpi({
        label: 'الطلبة النشطين',
        value: formatNumber(kpis.activeStudents),
        foot: `${kpis.activeGroups} مجموعة · ${kpis.pausedStudents ? `${kpis.pausedStudents} موقوف` : 'كله نشط'}`,
        iconName: 'users',
        color: 'var(--teal)',
        soft: 'var(--teal-soft)',
        href: '#/students',
      })}
      ${kpi({
        label: 'دخل الشهر',
        value: money(kpis.monthIncome),
        foot: `<span class="${kpis.monthNet >= 0 ? 'trend-up' : 'trend-down'}">${netPositive ? '+' : ''}${money(kpis.monthNet)}</span> صافي بعد المصروفات`,
        iconName: 'wallet',
        color: 'var(--saffron)',
        soft: 'var(--saffron-soft)',
        href: '#/finance',
      })}
      ${kpi({
        label: 'متأخرات علي الطلبة',
        value: money(kpis.outstanding),
        foot: `${debtors.length ? `${debtors.length} طالب محتاج متابعة` : 'مفيش متأخرات'}`,
        iconName: 'receipt',
        color: 'var(--coral)',
        soft: 'var(--coral-soft)',
        href: '#/finance?tab=dues',
      })}
      ${kpi({
        label: 'حضور آخر ٣٠ يوم',
        value: `${Math.round(kpis.attendanceRate)}<small>%</small>`,
        foot: `من ${formatNumber(kpis.attendanceTotal)} حضور مسجل`,
        iconName: 'checkCircle',
        color: 'var(--blue)',
        soft: 'var(--blue-soft)',
        href: '#/reports',
      })}
    </div>

    <div class="grid dash-layout">
      <div class="stack">
        <section class="card">
          <div class="card-head">
            <div><h2>حصص النهارده</h2><div class="sub">${escapeHTML(dateLong(today))}</div></div>
            <a class="card-link" href="#/calendar">الجدول كله ${icon('arrowLeft')}</a>
          </div>
          ${lessonsToday.length ? `<div class="timeline">${lessonsToday.map(lessonRow).join('')}</div>` : emptyHTML('calendar', 'مفيش حصص النهارده', 'تقدر تضيف حصة من الجدول أو تولّد حصص المجموعة تلقائي.')}
          ${lessonsToday.length ? `<div class="row-between mt-3" style="border-top:1px solid var(--line);padding-top:12px">
            <span class="small muted">${lessonsToday.reduce((t, l) => t + (l.studentCount || 0), 0)} طالب متوقع</span>
            <a class="btn soft sm" href="#/calendar">${icon('calendar')}فتح الجدول</a>
          </div>` : ''}
        </section>

        <div class="grid grid-2">
          <section class="card">
            <div class="card-head"><div><h2>الحضور</h2><div class="sub">آخر ٨ أسابيع</div></div>${ringHTML(kpis.attendanceRate, 'sm')}</div>
            ${trendChart(data.attendanceTrend)}
          </section>
          <section class="card">
            <div class="card-head"><div><h2>الدخل والمصروف</h2><div class="sub">آخر ٦ شهور</div></div>
              <div class="legend"><span><i style="background:var(--teal)"></i>دخل</span><span><i style="background:var(--saffron)"></i>مصروف</span></div>
            </div>
            ${incomeChart(data.incomeTrend)}
          </section>
        </div>

        <section class="card">
          <div class="card-head">
            <div><h2>فلوس محتاجة متابعة</h2><div class="sub">أكبر المتأخرات عند الطلبة</div></div>
            <a class="card-link" href="#/finance?tab=dues">كل المتأخرات ${icon('arrowLeft')}</a>
          </div>
          ${debtors.length ? `<div class="table-wrap"><table class="table">
            <thead><tr><th>الطالب</th><th>ولي الأمر</th><th class="num">المتأخر</th><th>أقدم استحقاق</th><th></th></tr></thead>
            <tbody>${debtors.map((d) => `<tr>
              <td><a href="#/students/${d.id}" style="color:inherit"><div class="row">${avatarHTML(d.fullName, d.avatarColor, 'sm')}
                <div><div class="strong small">${escapeHTML(d.fullName)}</div><div class="tiny muted">${escapeHTML(d.name || '')}</div></div></div></a></td>
              <td class="small muted" dir="ltr" style="text-align:end">${escapeHTML(d.phone || '—')}</td>
              <td class="num money debt">${money(d.balance)}</td>
              <td class="small muted">${d.oldestDue ? escapeHTML(relativeDay(d.oldestDue)) : '—'}</td>
              <td class="end"><a class="btn xs secondary" href="#/finance?new=payment&student=${d.id}">تحصيل</a></td>
            </tr>`).join('')}</tbody>
          </table></div>` : emptyHTML('checkCircle', 'مفيش متأخرات', 'كل الطلبة مسددين. شغل عظيم!')}
        </section>
      </div>

      <div class="stack">
        <section class="card">
          <div class="card-head"><div><h2>إضافة سريعة</h2><div class="sub">أكتر الحاجات اللي بتعملها</div></div></div>
          <div class="quick-grid">
            <a class="quick-btn" href="#/students?new=1">${icon('user')}طالب</a>
            <a class="quick-btn" href="#/finance?new=payment">${icon('wallet')}دفعة</a>
            <a class="quick-btn" href="#/finance?new=charge">${icon('receipt')}مستحق</a>
            <a class="quick-btn" href="#/calendar?new=1">${icon('calendar')}حصة</a>
            <a class="quick-btn" href="#/assignments?new=1">${icon('clipboard')}واجب</a>
            <a class="quick-btn" href="#/materials?new=1">${icon('folder')}مادة</a>
            <a class="quick-btn" href="#/groups?new=1">${icon('grid')}مجموعة</a>
            <a class="quick-btn" href="#/finance?bulk=1">${icon('sparkles')}اشتراكات</a>
          </div>
        </section>

        <section class="card">
          <div class="card-head"><div><h2>محتاج انتباهك</h2><div class="sub">${alerts.length} ملاحظة</div></div></div>
          ${alerts.length
            ? alerts.slice(0, 6).map((alert) => `<a class="alert-item" href="${escapeHTML(alert.href || '#/dashboard')}" style="color:inherit">
                <span class="alert-icon ${alert.type}">${icon(alert.icon || 'info')}</span>
                <span class="alert-body"><span class="alert-title">${escapeHTML(alert.title)}</span>
                <span class="alert-detail">${escapeHTML(alert.detail)}</span></span>
              </a>`).join('')
            : emptyHTML('checkCircle', 'كل حاجة تمام', 'مفيش تنبيهات محتاجة تدخل منك دلوقتي.')}
        </section>

        <section class="card">
          <div class="card-head">
            <div><h2>آخر الدفعات</h2><div class="sub">${kpis.receiptsMonth} إيصال الشهر ده</div></div>
            <a class="card-link" href="#/finance?tab=payments">الكل ${icon('arrowLeft')}</a>
          </div>
          ${recentPayments.length ? `<div class="list">${recentPayments.map((p) => `<a class="list-row" href="#/students/${p.studentId}" style="color:inherit">
            ${avatarHTML(p.studentName, p.avatarColor, 'sm')}
            <div class="list-main"><div class="list-title truncate">${escapeHTML(p.studentName)}</div>
              <div class="list-sub">${escapeHTML(METHOD_LABELS[p.method] || p.method)} · ${escapeHTML(relativeDay(p.date))}</div></div>
            <div class="list-end"><div class="money ok">+${money(p.amount)}</div>
              <div class="tiny muted">${escapeHTML(relativeTime(p.createdAt))}</div></div>
          </a>`).join('')}</div>` : emptyHTML('wallet', 'مفيش دفعات لسه', 'أول ما تسجل دفعة هتظهر هنا.')}
        </section>

        <section class="card">
          <div class="card-head">
            <div><h2>المجموعات</h2><div class="sub">${kpis.activeGroups} مجموعة نشطة</div></div>
            <a class="card-link" href="#/groups">الكل ${icon('arrowLeft')}</a>
          </div>
          <div class="list">${groups.slice(0, 5).map((g) => {
            const count = g.studentCount || 0;
            const cap = Number(g.capacity) || 0;
            const pct = cap ? Math.min(100, Math.round((count / cap) * 100)) : 0;
            return `<a class="list-row" href="#/groups/${g.id}" style="color:inherit">
              <span class="group-dot" style="background:${escapeHTML(g.color)}"></span>
              <div class="list-main"><div class="list-title truncate">${escapeHTML(g.name)}</div>
                <div class="list-sub">${count}/${cap} طالب · ${g.nextLesson ? escapeHTML(relativeDay(g.nextLesson.date)) : 'مفيش موعد'}</div>
                <div class="progress mt-1" style="max-width:140px"><span style="width:${pct}%;--bar:${escapeHTML(g.color)}"></span></div>
              </div>
              <div class="list-end">${ringHTML(g.attendanceRate, 'sm')}</div>
            </a>`;
          }).join('')}</div>
        </section>
      </div>
    </div>

    <section class="card mt-3">
      <div class="card-head">
        <div><h2>آخر الحركة</h2><div class="sub">كل اللي اتعمل في المركز</div></div>
        <a class="card-link" href="#/activity">السجل ${icon('arrowLeft')}</a>
      </div>
      <div class="list">${(activity || []).slice(0, 6).map((a) => `<div class="list-row">
        <span class="alert-icon info" style="width:28px;height:28px">${icon('activity')}</span>
        <div class="list-main"><div class="list-title">${escapeHTML(a.actorName || 'حد')} — ${escapeHTML(a.detail || a.action)}</div>
          <div class="list-sub">${escapeHTML(relativeTime(a.at))}</div></div>
      </div>`).join('') || '<div class="small muted" style="padding:10px">السجل فاضي</div>'}</div>
    </section>
  </div>`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'صباح الخير';
  if (hour < 16) return 'يومك سعيد';
  if (hour < 20) return 'مساء الخير';
  return 'سهرة موفقة';
}

export async function mount(root) {
  root.querySelectorAll('a[href^="#/"]').forEach((link) => {
    if (link.dataset.bound) return;
    link.dataset.bound = '1';
  });
}
