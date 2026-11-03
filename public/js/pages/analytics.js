'use strict';

import { api, escapeHTML, money, compactMoney, dateLong, chartDayLabel } from '../api.js';
import { icon, avatarHTML, emptyHTML } from '../ui.js';

function summaryCard(label, value, iconName, color, soft, foot = '') {
  return `<div class="kpi" style="--kpi:${color};--kpi-soft:${soft}">
    <div class="kpi-top"><span>${escapeHTML(label)}</span><span class="kpi-icon">${icon(iconName)}</span></div>
    <div class="kpi-value">${value}</div>
    ${foot ? `<div class="kpi-foot">${foot}</div>` : ''}
  </div>`;
}

function attendanceChart(points) {
  const max = 100;
  return `<div class="chart" style="height:160px">
    ${points
      .map((point, index) => {
        const last = index === points.length - 1;
        return `<div class="chart-col" title="${escapeHTML(dateLong(point.from))} — ${point.rate}%">
          <div class="chart-value ${last ? '' : 'muted'}">${point.total ? `${Math.round(point.rate)}%` : '—'}</div>
          <div class="chart-bars"><div class="chart-bar ${last ? '' : 'soft'}" style="height:${Math.max(4, Math.round((point.rate / max) * 100))}%"></div></div>
          <div class="chart-label">${escapeHTML(chartDayLabel(point.from))}</div>
        </div>`;
      })
      .join('')}
  </div>`;
}

function incomeChart(points) {
  const max = Math.max(1, ...points.map((point) => Math.max(point.income, point.expenses)));
  return `<div class="chart" style="height:160px">
    ${points
      .map((point) => `<div class="chart-col" title="${escapeHTML(point.label)} — دخل ${money(point.income)} / مصروف ${money(point.expenses)}">
        <div class="chart-value muted">${compactMoney(point.net)}</div>
        <div class="chart-bars">
          <div class="chart-bar" style="height:${Math.max(3, Math.round((point.income / max) * 100))}%"></div>
          <div class="chart-bar alt" style="height:${Math.max(3, Math.round((point.expenses / max) * 100))}%"></div>
        </div>
        <div class="chart-label">${escapeHTML(point.label.split(' ')[0])}</div>
      </div>`)
      .join('')}
  </div>`;
}

export async function render(ctx) {
  const data = await api.get('/api/analytics');
  const kpis = data.kpis;

  return `<div class="page">
    <div class="page-head">
      <div><h1>التحليلات الذكية</h1><div class="sub">قراءة سريعة لأداء المركز — الحضور، التحصيل، والدرجات</div></div>
      <div class="page-actions">
        <a class="btn secondary" href="#/reports">${icon('file')}التقارير التفصيلية</a>
        <a class="btn" href="#/hall-of-fame">${icon('award')}لوحة الشرف</a>
      </div>
    </div>

    <div class="grid grid-4 mb-3">
      ${summaryCard('نسبة التحصيل', `${kpis.collectionRate}%`, 'wallet', 'var(--teal)', 'var(--teal-soft)', `متأخرات ${money(kpis.outstanding)}`)}
      ${summaryCard('متوسط الحضور', `${kpis.attendanceRate}%`, 'checkCircle', 'var(--blue)', 'var(--blue-soft)', `${kpis.students} طالب نشط`)}
      ${summaryCard('متوسط الامتحانات', `${kpis.averageExam}%`, 'target', 'var(--saffron)', 'var(--saffron-soft)', `${data.examRows.length} امتحان مصحح`)}
      ${summaryCard('المحصّل', money(kpis.totalPaid), 'receipt', 'var(--plum)', 'var(--plum-soft)', `من ${money(kpis.totalCharged)}`)}
    </div>

    <div class="grid grid-2 mb-3">
      <section class="card">
        <div class="card-head"><div><h2>أهم الملاحظات</h2><div class="sub">تحليل تلقائي لبيانات المركز</div></div></div>
        <div class="stack-sm">
          ${data.insights.map((insight) => `<div class="insight ${insight.tone}">
            <span class="alert-icon ${insight.tone === 'warn' ? 'bad' : insight.tone === 'good' ? 'good' : 'info'}">${icon(insight.tone === 'warn' ? 'alert' : insight.tone === 'good' ? 'checkCircle' : 'info')}</span>
            <div><div class="strong small">${escapeHTML(insight.title)}</div>
            <div class="small muted" style="line-height:1.8">${escapeHTML(insight.body)}</div></div>
          </div>`).join('')}
        </div>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>اتجاه الحضور</h2><div class="sub">آخر ٨ أسابيع</div></div></div>
        ${data.attendanceTrend.length ? attendanceChart(data.attendanceTrend) : emptyHTML('chart', 'مفيش بيانات كفاية', '')}
      </section>
    </div>

    <div class="grid grid-2 mb-3">
      <section class="card">
        <div class="card-head"><div><h2>الدخل والمصروف</h2><div class="sub">آخر ٦ شهور</div></div></div>
        ${data.incomeTrend.length ? incomeChart(data.incomeTrend) : emptyHTML('chart', 'مفيش بيانات مالية', '')}
        <div class="legend-row"><span class="legend-dot" style="background:var(--teal)"></span>دخل<span class="legend-dot" style="background:var(--saffron)"></span>مصروف</div>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>أداء المجموعات</h2><div class="sub">حضور ودرجات وتحصيل</div></div></div>
        ${data.groups.length
          ? `<div class="table-wrap"><table class="table compact">
              <thead><tr><th>المجموعة</th><th class="num">طلبة</th><th class="num">حضور</th><th class="num">درجات</th><th class="num">متأخرات</th></tr></thead>
              <tbody>${data.groups.map((group) => `<tr>
                <td><div class="row"><span class="group-dot" style="background:${escapeHTML(group.color)}"></span>
                  <div><div class="strong small">${escapeHTML(group.name)}</div><div class="tiny muted">${escapeHTML(group.subject)}</div></div></div></td>
                <td class="num">${group.students}</td>
                <td class="num"><span class="badge ${group.attendanceRate >= 85 ? 'green' : group.attendanceRate >= 70 ? 'amber' : 'red'}">${group.attendanceRate}%</span></td>
                <td class="num small">${group.examPercent}%</td>
                <td class="num small ${group.balance > 0 ? 'debt' : ''}">${money(group.balance)}</td>
              </tr>`).join('')}</tbody></table></div>`
          : emptyHTML('grid', 'مفيش مجموعات نشطة', '')}
      </section>
    </div>

    <div class="grid grid-3">
      <section class="card">
        <div class="card-head"><div><h2>أفضل الطلبة</h2><div class="sub">حسب النقاط</div></div></div>
        ${data.topStudents.length
          ? `<div class="stack-sm">${data.topStudents.map((row) => `<a class="mini-rank" href="#/students/${row.studentId}" style="color:inherit">
              <span class="rank-badge ${row.rank <= 3 ? 'top' : ''}">${row.rank}</span>
              ${avatarHTML(row.fullName, row.avatarColor, 'sm')}
              <div class="grow"><div class="strong small truncate">${escapeHTML(row.name)}</div>
              <div class="tiny muted">${escapeHTML(row.grade || '')}</div></div>
              <span class="badge green">${row.total}</span>
            </a>`).join('')}</div>`
          : emptyHTML('award', 'مفيش بيانات', '')}
      </section>

      <section class="card">
        <div class="card-head"><div><h2>محتاجين متابعة</h2><div class="sub">حضور أقل من ٧٠٪</div></div></div>
        ${data.weakStudents.length
          ? `<div class="stack-sm">${data.weakStudents.map((row) => `<a class="mini-rank" href="#/students/${row.studentId}" style="color:inherit">
              ${avatarHTML(row.name, row.avatarColor, 'sm')}
              <div class="grow"><div class="strong small truncate">${escapeHTML(row.name)}</div>
              <div class="tiny muted">${row.absent} غياب</div></div>
              <span class="badge red">${row.rate}%</span>
            </a>`).join('')}</div>`
          : emptyHTML('checkCircle', 'كل الطلبة منتظمين', 'مفيش حد تحت ٧٠٪ حضور.')}
      </section>

      <section class="card">
        <div class="card-head"><div><h2>أقوى الامتحانات</h2><div class="sub">حسب متوسط النسبة</div></div></div>
        ${data.examRows.length
          ? `<div class="stack-sm">${data.examRows.slice(0, 6).map((exam) => `<a class="mini-rank" href="#/exams/${exam.id}" style="color:inherit">
              <span class="alert-icon info">${icon('target')}</span>
              <div class="grow"><div class="strong small truncate">${escapeHTML(exam.title)}</div>
              <div class="tiny muted truncate">${escapeHTML(exam.groupName)}</div></div>
              <span class="badge ${exam.percent >= 75 ? 'green' : exam.percent >= 50 ? 'amber' : 'red'}">${exam.percent}%</span>
            </a>`).join('')}</div>`
          : emptyHTML('target', 'مفيش امتحانات مصححة', '')}
      </section>
    </div>
  </div>`;
}
