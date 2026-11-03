'use strict';

import {
  api,
  setCurrency,
  money,
  dateLong,
  todayISO,
  timeLabel,
  monthLabel,
  initials,
  escapeHTML,
  whatsappLink,
  AUTH_EVENT,
} from './api.js';
import { icon, avatarHTML, toast, openModal, closeModal } from './ui.js';

import * as dashboardPage from './pages/dashboard.js';
import * as studentsPage from './pages/students.js';
import * as studentPage from './pages/student.js';
import * as groupsPage from './pages/groups.js';
import * as groupPage from './pages/group.js';
import * as calendarPage from './pages/calendar.js';
import * as lessonPage from './pages/lesson.js';
import * as financePage from './pages/finance.js';
import * as reportsPage from './pages/reports.js';
import * as assignmentsPage from './pages/assignments.js';
import * as assignmentPage from './pages/assignment.js';
import * as materialsPage from './pages/materials.js';
import * as settingsPage from './pages/settings.js';
import * as usersPage from './pages/users.js';
import * as activityPage from './pages/activity.js';
import * as backupsPage from './pages/backups.js';
import * as profilePage from './pages/profile.js';
import * as examsPage from './pages/exams.js';
import * as examPage from './pages/exam.js';
import * as certificatesPage from './pages/certificates.js';
import * as hallOfFamePage from './pages/hall-of-fame.js';
import * as analyticsPage from './pages/analytics.js';
import * as archivePage from './pages/archive.js';
import * as scanPage from './pages/scan.js';
import * as portalPage from './pages/portal.js';
import * as idCardsPage from './pages/id-cards.js';
import * as verifyPage from './pages/verify.js';
import * as syncPage from './pages/sync.js';
import * as treasuryPage from './pages/treasury.js';
import * as shiftsPage from './pages/shifts.js';
import * as platformPage from './pages/platform.js';

export const state = {
  user: null,
  settings: null,
  ready: false,
  route: null,
  alerts: null,
};

const app = document.getElementById('app');
let navToken = 0;

const ROUTES = [
  { path: '', page: dashboardPage, nav: 'dashboard', title: 'لوحة التحكم' },
  { path: 'dashboard', page: dashboardPage, nav: 'dashboard', title: 'لوحة التحكم' },
  { path: 'students', page: studentsPage, nav: 'students', title: 'الطلبة' },
  { path: 'students/:id', page: studentPage, nav: 'students', title: 'ملف الطالب' },
  { path: 'groups', page: groupsPage, nav: 'groups', title: 'المجموعات' },
  { path: 'groups/:id', page: groupPage, nav: 'groups', title: 'المجموعة' },
  { path: 'calendar', page: calendarPage, nav: 'calendar', title: 'جدول الحصص' },
  { path: 'lessons/:id', page: lessonPage, nav: 'calendar', title: 'الحصة' },
  { path: 'finance', page: financePage, nav: 'finance', title: 'الحسابات' },
  { path: 'reports', page: reportsPage, nav: 'reports', title: 'التقارير' },
  { path: 'assignments', page: assignmentsPage, nav: 'assignments', title: 'الواجبات' },
  { path: 'assignments/:id', page: assignmentPage, nav: 'assignments', title: 'تصحيح الواجب' },
  { path: 'materials', page: materialsPage, nav: 'materials', title: 'المكتبة' },
  { path: 'settings', page: settingsPage, nav: 'settings', title: 'الإعدادات' },
  { path: 'users', page: usersPage, nav: 'users', title: 'المستخدمين', admin: true },
  { path: 'activity', page: activityPage, nav: 'activity', title: 'سجل النشاط' },
  { path: 'backups', page: backupsPage, nav: 'backups', title: 'النسخ والبيانات', admin: true },
  { path: 'profile', page: profilePage, nav: 'profile', title: 'حسابي' },
  { path: 'exams', page: examsPage, nav: 'exams', title: 'الامتحانات' },
  { path: 'exams/:id', page: examPage, nav: 'exams', title: 'تصحيح الامتحان' },
  { path: 'certificates', page: certificatesPage, nav: 'certificates', title: 'الشهادات' },
  { path: 'hall-of-fame', page: hallOfFamePage, nav: 'hall-of-fame', title: 'لوحة الشرف' },
  { path: 'analytics', page: analyticsPage, nav: 'analytics', title: 'التحليلات الذكية' },
  { path: 'archive', page: archivePage, nav: 'archive', title: 'أرشيف الغياب' },
  { path: 'scan', page: scanPage, nav: 'scan', title: 'التحضير بالباركود' },
  { path: 'portal', page: portalPage, nav: 'portal', title: 'بوابة الطالب' },
  { path: 'id-cards', page: idCardsPage, nav: 'id-cards', title: 'كروت الطلبة' },
  { path: 'verify', page: verifyPage, nav: 'certificates', title: 'التحقق من الشهادات' },
  { path: 'sync', page: syncPage, nav: 'sync', title: 'مزامنة المجلدات' },
  { path: 'treasury', page: treasuryPage, nav: 'treasury', title: 'الخزنة' },
  { path: 'shifts', page: shiftsPage, nav: 'shifts', title: 'ورديات الفريق' },
  { path: 'platform', page: platformPage, nav: 'platform', title: 'الترخيص والتفعيل' },
];

const NAV = [
  { label: 'الرئيسية', items: [{ key: 'dashboard', label: 'لوحة التحكم', icon: 'dashboard', href: '#/dashboard' }] },
  {
    label: 'التعليم',
    items: [
      { key: 'students', label: 'الطلبة', icon: 'users', href: '#/students' },
      { key: 'groups', label: 'المجموعات', icon: 'grid', href: '#/groups' },
      { key: 'calendar', label: 'جدول الحصص', icon: 'calendar', href: '#/calendar' },
      { key: 'assignments', label: 'الواجبات', icon: 'clipboard', href: '#/assignments' },
      { key: 'materials', label: 'المكتبة', icon: 'folder', href: '#/materials' },
      { key: 'exams', label: 'الامتحانات', icon: 'target', href: '#/exams' },
    ],
  },
  {
    label: 'التميز والتحليلات',
    items: [
      { key: 'hall-of-fame', label: 'لوحة الشرف', icon: 'award', href: '#/hall-of-fame' },
      { key: 'certificates', label: 'الشهادات', icon: 'file', href: '#/certificates' },
      { key: 'analytics', label: 'التحليلات الذكية', icon: 'sparkles', href: '#/analytics' },
    ],
  },
  {
    label: 'الفلوس',
    items: [
      { key: 'finance', label: 'الحسابات', icon: 'wallet', href: '#/finance' },
      { key: 'treasury', label: 'الخزنة', icon: 'database', href: '#/treasury' },
      { key: 'reports', label: 'التقارير', icon: 'chart', href: '#/reports' },
    ],
  },
  {
    label: 'الأدوات',
    items: [
      { key: 'scan', label: 'التحضير بالباركود', icon: 'smartphone', href: '#/scan' },
      { key: 'id-cards', label: 'كروت الطلبة', icon: 'credit', href: '#/id-cards' },
      { key: 'archive', label: 'أرشيف الغياب', icon: 'archive', href: '#/archive' },
      { key: 'shifts', label: 'ورديات الفريق', icon: 'clock', href: '#/shifts' },
      { key: 'portal', label: 'بوابة الطالب', icon: 'eye', href: '#/portal' },
    ],
  },
  {
    label: 'الإدارة',
    items: [
      { key: 'platform', label: 'الترخيص والتفعيل', icon: 'shield', href: '#/platform', admin: true },
      { key: 'sync', label: 'مزامنة المجلدات', icon: 'refresh', href: '#/sync', admin: true },
      { key: 'users', label: 'المستخدمين', icon: 'shield', href: '#/users', admin: true },
      { key: 'activity', label: 'سجل النشاط', icon: 'activity', href: '#/activity' },
      { key: 'backups', label: 'النسخ والبيانات', icon: 'database', href: '#/backups', admin: true },
      { key: 'settings', label: 'الإعدادات', icon: 'settings', href: '#/settings' },
    ],
  },
];

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  return { segments, path: segments.join('/'), query: new URLSearchParams(queryPart || '') };
}

function matchRoute(segments) {
  for (const route of ROUTES) {
    const parts = route.path.split('/').filter(Boolean);
    if (parts.length !== segments.length) continue;
    let ok = true;
    const params = {};
    for (let i = 0; i < parts.length; i += 1) {
      if (parts[i].startsWith(':')) params[parts[i].slice(1)] = segments[i];
      else if (parts[i] !== segments[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { route, params };
  }
  return null;
}

function activeNav() {
  const { segments } = parseHash();
  if (!segments.length) return 'dashboard';
  const first = segments[0];
  if (first === 'lessons') return 'calendar';
  if (first === 'verify') return 'certificates';
  return first;
}

/* ---------------- Theme ---------------- */
function applyTheme(theme) {
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('daftary-theme', next);
  const btn = document.querySelector('[data-theme-btn]');
  if (btn) btn.innerHTML = icon(next === 'dark' ? 'sun' : 'moon');
}
function currentTheme() {
  return localStorage.getItem('daftary-theme') || state.settings?.theme || 'light';
}
function toggleTheme() {
  applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}

/* ---------------- Shell ---------------- */
function shellHTML() {
  const user = state.user;
  const admin = user.role === 'admin';
  const navigation = NAV.map((group) => {
    const items = group.items
      .filter((item) => !item.admin || admin)
      .map(
        (item) => `<a class="nav-item" href="${item.href}" data-nav="${item.key}">
          ${icon(item.icon)}<span>${item.label}</span>
          ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
        </a>`,
      )
      .join('');
    return items ? `<div class="nav-label">${group.label}</div>${items}` : '';
  }).join('');

  return `<div class="app-shell">
    <div class="sidebar-backdrop" data-sidebar-backdrop></div>
    <aside class="sidebar" id="sidebar">
      <a class="brand" href="#/dashboard">
        <span class="brand-mark">د</span>
        <div><div class="brand-name">دفتري</div><div class="brand-sub">كل يوم بحاله… وحسابه</div></div>
      </a>
      <nav class="side-nav" aria-label="القائمة الرئيسية">${navigation}</nav>
      <div class="sidebar-foot">
        <div class="sidebar-tip">
          <strong>نصيحة سريعة</strong>
          اضغط <b>/</b> في أي مكان عشان تدوّر على طالب بسرعة.
        </div>
        <a class="side-user" href="#/profile">
          ${avatarHTML(user.name, user.avatarColor)}
          <div class="grow">
            <div class="side-user-name truncate">${escapeHTML(user.name)}</div>
            <div class="side-user-role">${admin ? 'مدير المركز' : 'مساعد'}</div>
          </div>
          ${icon('chevronLeft')}
        </a>
      </div>
    </aside>
    <div class="main" id="main">
      <header class="topbar">
        <button class="icon-btn mobile-only" data-menu aria-label="القائمة">${icon('menu')}</button>
        <div>
          <div class="topbar-title" data-page-title>لوحة التحكم</div>
          <div class="topbar-crumb" data-page-crumb></div>
        </div>
        <div class="topbar-actions">
          <div class="search-top">
            ${icon('search')}
            <input type="search" placeholder="دوّر على طالب…" data-global-search autocomplete="off" aria-label="بحث">
            <div class="search-results hidden" data-search-results></div>
          </div>
          <div class="dropdown">
            <button class="btn secondary sm desktop-only" data-quick-add>${icon('plus')}إضافة سريعة</button>
            <button class="icon-btn mobile-only" data-quick-add aria-label="إضافة">${icon('plus')}</button>
          </div>
          <div class="dropdown">
            <button class="icon-btn has-dot" data-bell aria-label="تنبيهات">${icon('bell')}</button>
          </div>
          <button class="icon-btn" data-theme-btn aria-label="تغيير المظهر">${icon(currentTheme() === 'dark' ? 'sun' : 'moon')}</button>
          <div class="dropdown">
            <button class="icon-btn" data-profile-menu aria-label="حسابي" style="padding:3px">
              ${avatarHTML(user.name, user.avatarColor, 'sm')}
            </button>
          </div>
        </div>
      </header>
      <div id="page-root"></div>
      <nav class="mobile-nav" aria-label="تنقل سريع">
        <a href="#/dashboard" data-nav="dashboard">${icon('dashboard')}<span>الرئيسية</span></a>
        <a href="#/students" data-nav="students">${icon('users')}<span>الطلبة</span></a>
        <a href="#/calendar" data-nav="calendar">${icon('calendar')}<span>الجدول</span></a>
        <a href="#/finance" data-nav="finance">${icon('wallet')}<span>الفلوس</span></a>
        <a href="#/settings" data-nav="settings">${icon('settings')}<span>أكتر</span></a>
      </nav>
    </div>
  </div>`;
}

function bindShell() {
  document.querySelector('[data-menu]')?.addEventListener('click', openSidebar);
  document.querySelector('[data-sidebar-backdrop]')?.addEventListener('click', closeSidebar);
  document.querySelector('[data-theme-btn]')?.addEventListener('click', toggleTheme);
  document.querySelectorAll('[data-nav]').forEach((link) => {
    link.addEventListener('click', closeSidebar);
  });

  document.querySelector('[data-quick-add]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    openQuickAdd(event.currentTarget);
  });
  document.querySelector('[data-bell]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    openNotifications(event.currentTarget);
  });
  document.querySelector('[data-profile-menu]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    openProfileMenu(event.currentTarget);
  });

  const input = document.querySelector('[data-global-search]');
  const results = document.querySelector('[data-search-results]');
  let searchTimer = null;
  input?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = input.value.trim();
    if (!q) {
      results.classList.add('hidden');
      return;
    }
    searchTimer = setTimeout(async () => {
      try {
        const data = await api.get(`/api/students?search=${encodeURIComponent(q)}&limit=6`);
        if (!data.items.length) {
          results.innerHTML = '<div class="search-result"><span class="muted small">مفيش نتائج</span></div>';
        } else {
          results.innerHTML = data.items
            .map(
              (student) => `<div class="search-result" data-go="#/students/${student.id}">
                ${avatarHTML(student.name, student.avatarColor, 'sm')}
                <div class="grow"><div class="small strong truncate">${escapeHTML(student.name)}</div>
                <small>${escapeHTML(student.grade || '')}${student.balance > 0 ? ` · عليه ${money(student.balance)}` : ''}</small></div>
                ${icon('chevronLeft')}
              </div>`,
            )
            .join('');
        }
        results.classList.remove('hidden');
        results.querySelectorAll('[data-go]').forEach((row) => {
          row.addEventListener('click', () => {
            location.hash = row.dataset.go;
            input.value = '';
            results.classList.add('hidden');
          });
        });
      } catch {
        /* handled */
      }
    }, 220);
  });
  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      input.value = '';
      results.classList.add('hidden');
      input.blur();
    }
    if (event.key === 'Enter') {
      const first = results.querySelector('[data-go]');
      if (first) first.click();
    }
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.search-top')) results?.classList.add('hidden');
    if (!event.target.closest('.dropdown')) closeDropdowns();
  });
}

function openSidebar() {
  document.getElementById('sidebar')?.classList.add('open');
  document.querySelector('[data-sidebar-backdrop]')?.classList.add('open');
}
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.querySelector('[data-sidebar-backdrop]')?.classList.remove('open');
}

function closeDropdowns() {
  document.querySelectorAll('.dropdown-menu').forEach((menu) => menu.remove());
}

function attachDropdown(anchor, html, onMount) {
  const existing = anchor.parentElement.querySelector('.dropdown-menu');
  const isSame = existing && existing.dataset.owner === anchor.dataset.ownerKey;
  closeDropdowns();
  if (isSame) return null;
  const menu = document.createElement('div');
  menu.className = 'dropdown-menu';
  menu.dataset.owner = anchor.dataset.ownerKey || '';
  menu.style.minWidth = '220px';
  menu.innerHTML = html;
  anchor.parentElement.appendChild(menu);
  menu.addEventListener('click', (event) => event.stopPropagation());
  if (onMount) onMount(menu);
  return menu;
}

function openQuickAdd(anchor) {
  anchor.dataset.ownerKey = 'quick';
  attachDropdown(
    anchor,
    `<div class="dropdown-title">إضافة سريعة</div>
      <button class="dropdown-item" data-add="student">${icon('user')}طالب جديد</button>
      <button class="dropdown-item" data-add="payment">${icon('wallet')}تسجيل دفعة</button>
      <button class="dropdown-item" data-add="charge">${icon('receipt')}مستحق جديد</button>
      <button class="dropdown-item" data-add="lesson">${icon('calendar')}حصة جديدة</button>
      <div class="dropdown-sep"></div>
      <button class="dropdown-item" data-add="group">${icon('grid')}مجموعة جديدة</button>
      <button class="dropdown-item" data-add="assignment">${icon('clipboard')}واجب جديد</button>
      <div class="dropdown-sep"></div>
      <button class="dropdown-item" data-add="exam">${icon('target')}امتحان جديد</button>
      <button class="dropdown-item" data-add="certificate">${icon('award')}شهادة جديدة</button>
      <button class="dropdown-item" data-add="treasury">${icon('database')}حركة خزنة</button>
      <button class="dropdown-item" data-add="shift">${icon('clock')}وردية جديدة</button>`,
    (menu) => {
      menu.querySelectorAll('[data-add]').forEach((item) => {
        item.addEventListener('click', () => {
          closeDropdowns();
          const add = item.dataset.add;
          const map = {
            student: '#/students?new=1',
            payment: '#/finance?new=payment',
            charge: '#/finance?new=charge',
            lesson: '#/calendar?new=1',
            group: '#/groups?new=1',
            assignment: '#/assignments?new=1',
            exam: '#/exams?new=1',
            certificate: '#/certificates?new=1',
            treasury: '#/treasury?new=1',
            shift: '#/shifts?new=1',
          };
          location.hash = map[add];
        });
      });
    },
  );
}

async function openNotifications(anchor) {
  anchor.dataset.ownerKey = 'bell';
  const menu = attachDropdown(anchor, `<div class="dropdown-title">التنبيهات</div><div class="small muted" style="padding:10px">بجيب التنبيهات…</div>`);
  if (!menu) return;
  try {
    const data = state.alerts || (await api.get('/api/dashboard')).alerts;
    state.alerts = data;
    if (!data.length) {
      menu.innerHTML = `<div class="dropdown-title">التنبيهات</div>${icon('checkCircle')}<div class="small muted" style="padding:10px">كل حاجة تمام، مفيش تنبيهات.</div>`;
      return;
    }
    menu.innerHTML = `<div class="dropdown-title">محتاج انتباهك</div>` +
      data.map((alert) => `<a class="dropdown-item" href="${escapeHTML(alert.href || '#/dashboard')}" style="align-items:flex-start">
        <span class="alert-icon ${alert.type}" style="width:26px;height:26px">${icon(alert.icon || 'info')}</span>
        <span style="min-width:0"><span class="strong" style="display:block;font-size:12px">${escapeHTML(alert.title)}</span>
        <span class="tiny muted">${escapeHTML(alert.detail)}</span></span>
      </a>`).join('');
    menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeDropdowns));
  } catch {
    menu.innerHTML = `<div class="dropdown-title">التنبيهات</div><div class="small muted" style="padding:10px">مش قادر أجيب التنبيهات.</div>`;
  }
}

function openProfileMenu(anchor) {
  anchor.dataset.ownerKey = 'profile';
  attachDropdown(
    anchor,
    `<div class="dropdown-title">${escapeHTML(state.user.name)}</div>
      <a class="dropdown-item" href="#/profile">${icon('user')}حسابي</a>
      <a class="dropdown-item" href="#/settings">${icon('settings')}الإعدادات</a>
      <button class="dropdown-item" data-theme-action>${icon(currentTheme() === 'dark' ? 'sun' : 'moon')}${currentTheme() === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}</button>
      <div class="dropdown-sep"></div>
      <button class="dropdown-item danger" data-logout>${icon('logout')}تسجيل الخروج</button>`,
    (menu) => {
      menu.querySelector('[data-theme-action]').addEventListener('click', () => {
        toggleTheme();
        closeDropdowns();
      });
      menu.querySelector('[data-logout]').addEventListener('click', async () => {
        try {
          await api.post('/api/auth/logout');
        } catch {
          /* ignore */
        }
        state.user = null;
        location.hash = '';
        renderLogin();
      });
    },
  );
}

/* ---------------- Login ---------------- */
function loginHTML() {
  return `<div class="login-wrap">
    <button class="icon-btn login-theme" data-login-theme aria-label="تغيير المظهر">${icon(currentTheme() === 'dark' ? 'sun' : 'moon')}</button>
    <section class="login-brand">
      <div class="login-brand-top">
        <span class="brand-mark">د</span>
        <div><div class="login-brand-name">دفتري</div><div class="tiny" style="color:#9db3a9">إدارة الدروس من غير وجع دماغ</div></div>
      </div>
      <div class="login-hero">
        <span class="login-kicker">${icon('sparkles')} اتعمل للمعلم المصري</span>
        <h1>طلبتك، حصصك،<br>وفلوسك… <em>في مكان واحد.</em></h1>
        <p>من أول ما الطالب يجي لحد آخر قرش في الخزنة. حضور، اشتراكات، واجبات، تقارير، ورسائل واتساب — كله جاهز ومظبوط.</p>
        <div class="login-points">
          <div class="login-point"><span class="tick">${icon('check')}</span>تحضير الحصة في أقل من دقيقة</div>
          <div class="login-point"><span class="tick">${icon('check')}</span>متابعة المتأخرات وإيصالات الدفع</div>
          <div class="login-point"><span class="tick">${icon('check')}</span>تقارير جاهزة تطلعها بضغطة</div>
        </div>
      </div>
      <div class="login-foot">© ${new Date().getFullYear()} دفتري — بياناتك على جهازك، مفيش حاجة بتطلع بره.</div>
    </section>
    <section class="login-panel">
      <div class="login-card">
        <span class="brand-mark">د</span>
        <h2>أهلاً بيك تاني</h2>
        <div class="sub">سجّل دخولك وكل حاجة مستنياك زي ما سيبتها.</div>
        <div data-login-error></div>
        <form data-login-form novalidate>
          <div class="field">
            <label>الإيميل</label>
            <div class="input-group">${icon('user')}<input class="input" type="email" name="email" placeholder="you@example.com" autocomplete="username" dir="ltr" required></div>
          </div>
          <div class="field">
            <label>الباسورد</label>
            <div class="input-group">${icon('shield')}<input class="input" type="password" name="password" placeholder="••••••••" autocomplete="current-password" required></div>
          </div>
          <label class="checkline" style="margin:4px 0 12px"><input type="checkbox" name="remember" checked> افتكرني على الجهاز ده</label>
          <button class="btn block" type="submit" data-login-submit>دخول ${icon('arrowLeft')}</button>
        </form>
        <div class="demo-box">
          <strong>حساب تجريبي جاهز:</strong><br>
          المدير: <code>admin@daftary.app</code> · الباسورد: <code>Daftary@123</code><br>
          المساعد: <code>assistant@daftary.app</code> · نفس الباسورد
        </div>
      </div>
    </section>
  </div>`;
}

function renderLogin(message = '') {
  document.title = 'دخول — دفتري';
  app.innerHTML = loginHTML();
  if (message) {
    document.querySelector('[data-login-error]').innerHTML = `<div class="login-error">${escapeHTML(message)}</div>`;
  }
  document.querySelector('[data-login-theme]')?.addEventListener('click', toggleTheme);
  const form = document.querySelector('[data-login-form]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('[data-login-submit]');
    const email = form.email.value.trim();
    const password = form.password.value;
    const remember = form.remember.checked;
    if (!email || !password) {
      document.querySelector('[data-login-error]').innerHTML = '<div class="login-error">اكتب الإيميل والباسورد الأول.</div>';
      return;
    }
    button.disabled = true;
    button.innerHTML = `${icon('refresh')}بيدخل…`;
    try {
      const data = await api.post('/api/auth/login', { email, password, remember });
      state.user = data.user;
      state.settings = data.settings;
      setCurrency(data.settings.currency, data.settings.currencyPosition);
      if (!location.hash || location.hash === '#') location.hash = '#/dashboard';
      await bootSession();
      toast(`أهلاً بيك يا ${data.user.name.split(' ')[0]}`);
    } catch (error) {
      document.querySelector('[data-login-error]').innerHTML = `<div class="login-error">${escapeHTML(error.message)}</div>`;
    } finally {
      button.disabled = false;
      button.innerHTML = `دخول ${icon('arrowLeft')}`;
    }
  });
}

/* ---------------- Router ---------------- */
function skeletonPage() {
  return `<div class="page">
    <div class="skeleton" style="width:180px;height:26px;margin-bottom:10px"></div>
    <div class="skeleton" style="width:260px;height:12px;margin-bottom:26px"></div>
    <div class="grid grid-4" style="margin-bottom:16px">${Array.from({ length: 4 }).map(() => '<div class="card"><div class="skeleton" style="width:60%;height:12px;margin-bottom:12px"></div><div class="skeleton" style="width:40%;height:28px"></div></div>').join('')}</div>
    <div class="grid grid-2"><div class="card"><div class="skeleton" style="height:150px"></div></div><div class="card"><div class="skeleton" style="height:150px"></div></div></div>
  </div>`;
}

function renderNotFound() {
  document.getElementById('page-root').innerHTML = `<div class="page"><div class="empty" style="padding:80px 20px">
    <div class="empty-icon">${icon('search')}</div>
    <h3>الصفحة مش موجودة</h3>
    <p>يمكن الرابط قديم أو اتكتب غلط. يلا نرجع للوحة التحكم.</p>
    <a class="btn mt-3" href="#/dashboard">${icon('dashboard')}لوحة التحكم</a>
  </div></div>`;
}

let lastPath = '';

async function renderRoute() {
  if (!state.user) {
    renderLogin();
    return;
  }
  const parsed = parseHash();
  const matched = matchRoute(parsed.segments);
  if (!matched) {
    renderNotFound();
    return;
  }
  const { route, params } = matched;
  if (route.admin && state.user.role !== 'admin') {
    document.getElementById('page-root').innerHTML = `<div class="page"><div class="empty" style="padding:70px 20px">
      <div class="empty-icon">${icon('shield')}</div><h3>الصفحة دي للمدير بس</h3>
      <p>لو محتاج صلاحية أكتر كلم مدير المركز.</p></div></div>`;
    return;
  }

  const token = ++navToken;
  state.route = { ...parsed, route, params };
  const pageRoot = document.getElementById('page-root');
  if (!pageRoot) return;
  if (lastPath !== parsed.path) pageRoot.innerHTML = skeletonPage();
  lastPath = parsed.path;

  const titleEl = document.querySelector('[data-page-title]');
  const crumbEl = document.querySelector('[data-page-crumb]');
  if (titleEl) titleEl.textContent = route.title;
  if (crumbEl) crumbEl.textContent = '';

  document.querySelectorAll('[data-nav]').forEach((link) => {
    link.classList.toggle('active', link.dataset.nav === activeNav());
  });

  const ctx = {
    params,
    query: parsed.query,
    segments: parsed.segments,
    user: state.user,
    settings: state.settings,
    state,
    navigate: (path) => {
      location.hash = path.startsWith('#') ? path : `#/${path.replace(/^\//, '')}`;
    },
    refresh: () => renderRoute(),
    setTitle: (title, crumb = '') => {
      if (titleEl) titleEl.textContent = title;
      if (crumbEl) crumbEl.textContent = crumb;
      if (title) document.title = `${title} — دفتري`;
    },
  };

  try {
    const html = await route.page.render(ctx);
    if (token !== navToken) return;
    if (html === null || html === undefined) return;
    pageRoot.innerHTML = html;
    if (route.page.mount) await route.page.mount(pageRoot, ctx);
    if (titleEl && titleEl.textContent === route.title) document.title = `${route.title} — دفتري`;
    if (!location.hash.includes('?tab=')) window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  } catch (error) {
    if (token !== navToken) return;
    if (error.status === 401) return;
    pageRoot.innerHTML = `<div class="page"><div class="empty" style="padding:70px 20px">
      <div class="empty-icon">${icon('alert')}</div>
      <h3>حصلت مشكلة وأنا بجيب الصفحة</h3>
      <p>${escapeHTML(error.message || 'جرب تحدّث الصفحة.')}</p>
      <button class="btn mt-3" data-retry>${icon('refresh')}جرب تاني</button>
    </div></div>`;
    pageRoot.querySelector('[data-retry]')?.addEventListener('click', renderRoute);
  }
}

async function bootSession() {
  try {
    const me = await api.get('/api/auth/me');
    state.user = me.user;
    state.settings = me.settings;
    setCurrency(me.settings.currency, me.settings.currencyPosition);
    state.ready = true;
    app.innerHTML = shellHTML();
    bindShell();
    applyTheme(currentTheme());
    await renderRoute();
  } catch (error) {
    if (error.status === 401) {
      renderLogin();
      return;
    }
    renderLogin('مش قادر أوصل للسيرفر. اتأكد إن السيرفر شغال وجرب تاني.');
  }
}

function init() {
  applyTheme(currentTheme());

  api.onError = (message) => {
    if (state.user) toast(message, 'error');
  };
  api.onUnauthorized = () => {
    if (state.user) {
      state.user = null;
      renderLogin('الجلسة خلصت، سجّل دخول تاني.');
    }
  };
  window.addEventListener(AUTH_EVENT, () => renderLogin());

  window.addEventListener('hashchange', () => {
    closeDropdowns();
    closeSidebar();
    renderRoute();
  });

  document.addEventListener('keydown', (event) => {
    if ((event.key === '/' || (event.ctrlKey && event.key.toLowerCase() === 'k')) && state.user) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
      event.preventDefault();
      document.querySelector('[data-global-search]')?.focus();
    }
  });

  bootSession();
}

init();
