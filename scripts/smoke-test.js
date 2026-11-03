'use strict';

/**
 * End-to-end smoke test for the دفتري API.
 *
 * Runs against an isolated copy of the demo database so it never touches
 * real centre data:
 *   node scripts/smoke-test.js
 *
 * Set DAFTARY_KEEP_DATA=1 to keep the temporary database for inspection.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'daftary-smoke-'));
const PORT = 4700 + Math.floor(Math.random() * 160);
let BASE = `http://127.0.0.1:${PORT}`;

let cookie = '';
let passed = 0;
let failed = 0;
const failures = [];

function ok(label, extra = '') {
  passed += 1;
  console.log(`  ✓ ${label}${extra ? ` — ${extra}` : ''}`);
}

function bad(label, detail) {
  failed += 1;
  failures.push({ label, detail });
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

function check(label, condition, detail = '') {
  if (condition) ok(label, detail);
  else bad(label, detail);
}

async function request(url, { method = 'GET', body = undefined, raw = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${BASE}${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = text;
  if (!raw) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  const setCookie = response.headers.getSetCookie?.() || [];
  if (setCookie.length) cookie = setCookie.map((item) => item.split(';')[0]).join('; ');
  return { status: response.status, headers: response.headers, data, text };
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => {
      reject(new Error(`السيرفر ماردش في الوقت المناسب\n${output}`));
    }, 20000);
    const onData = (chunk) => {
      output += String(chunk);
      const match = output.match(/http:\/\/localhost:(\d+)/);
      if (match) {
        clearTimeout(timer);
        child.stdout.off('data', onData);
        resolve(Number(match[1]));
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', (chunk) => {
      output += String(chunk);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`السيرفر خرج بكود ${code}\n${output}`));
    });
  });
}

async function run() {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      DAFTARY_DATA_DIR: DATA_DIR,
      DAFTARY_SHOW_CREDENTIALS: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const actualPort = await waitForServer(child);
  const base = `http://127.0.0.1:${actualPort}`;
  BASE = base;

  try {
    console.log(`\n  دفتري — اختبار شامل (${base})\n`);

    /* ----------------------------- public ------------------------------ */
    console.log('  [عام]');
    let res = await request('/api/public/portal');
    check('البوابة العامة متاحة', res.status === 200 && res.data?.settings?.centerName, res.status);
    const portal = res.data;

    res = await request('/portal.html', { raw: true });
    check('صفحة البوابة المستقلة', res.status === 200 && res.text.includes('public-portal.js'));
    res = await request('/js/public-portal.js', { raw: true });
    check('سكربت البوابة', res.status === 200 && res.text.includes('portalProfile') === false && res.text.includes('getJSON'));
    res = await request('/js/app.js', { raw: true });
    check('سكربت التطبيق', res.status === 200 && res.text.includes('hall-of-fame'));

    /* ------------------------------ auth ------------------------------- */
    console.log('\n  [الدخول]');
    res = await request('/api/auth/me');
    check('منع الوصول بدون تسجيل دخول', res.status === 401);

    res = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@daftary.app', password: 'Daftary@123', remember: true },
    });
    check('تسجيل دخول المدير', res.status === 200 && res.data?.user?.role === 'admin');
    check('كوكي الجلسة اتسجل', Boolean(cookie));

    res = await request('/api/auth/me');
    check('بيانات الجلسة', res.status === 200 && res.data?.user?.email === 'admin@daftary.app');

    /* ---------------------------- read pages --------------------------- */
    console.log('\n  [قراءة الصفحات]');
    const getPaths = [
      '/api/dashboard',
      '/api/students?limit=200',
      '/api/groups',
      '/api/calendar',
      '/api/lessons',
      '/api/finance/summary',
      '/api/reports',
      '/api/charges',
      '/api/payments',
      '/api/expenses',
      '/api/assignments',
      '/api/materials',
      '/api/grades',
      '/api/exams',
      '/api/points',
      '/api/hall-of-fame',
      '/api/certificates',
      '/api/treasury',
      '/api/shifts',
      '/api/platform',
      '/api/sync',
      '/api/analytics',
      '/api/absence-archive',
      '/api/id-cards',
      '/api/settings',
      '/api/users',
      '/api/activity',
      '/api/backups',
      '/api/system',
    ];
    for (const url of getPaths) {
      res = await request(url);
      check(`GET ${url}`, res.status === 200, res.status === 200 ? '' : JSON.stringify(res.data));
    }

    /* --------------------------- students ------------------------------ */
    const studentsRes = await request('/api/students?limit=200');
    const students = studentsRes.data?.items || [];
    const student = students.find((item) => (item.groups || []).length && item.code);
    check('الطلبة عندهم أكواد ومجموعات', Boolean(student), student?.code);
    const groupId = student?.groups?.[0]?.id;
    check('مجموعة الطالب موجودة', Boolean(groupId));

    res = await request(`/api/students/${student.id}`);
    check('ملف الطالب', res.status === 200 && (res.data?.id === student.id || res.data?.student?.id === student.id));

    res = await request(`/api/id-cards/${student.id}`);
    check('كارت طالب مفرد', res.status === 200 && res.data?.card?.code === student.code);

    res = await request('/api/public/portal/' + encodeURIComponent(student.code));
    check(
      'البوابة بكود الطالب',
      res.status === 200 && res.data?.profile?.student?.id === student.id,
      res.data?.profile?.attendance?.rate !== undefined ? `حضور ${res.data.profile.attendance.rate}%` : '',
    );

    /* ----------------------------- exams ------------------------------- */
    console.log('\n  [الامتحانات]');
    res = await request('/api/exams', {
      method: 'POST',
      body: {
        groupId,
        title: 'امتحان اختبار تلقائي',
        type: 'quiz',
        status: 'open',
        date: new Date().toISOString().slice(0, 10),
        start: '17:00',
        duration: 45,
        maxScore: 20,
        passScore: 10,
        description: 'اتعمل بواسطة smoke test',
      },
    });
    check('إنشاء امتحان', res.status === 200 && res.data?.exam?.id, res.data?.exam?.title);
    const exam = res.data?.exam;

    const roster = (await request(`/api/groups/${groupId}`)).data?.students || [];
    const gradedIds = (roster.length ? roster : students).slice(0, 2).map((item) => item.id);
    res = await request(`/api/exams/${exam.id}/results`, {
      method: 'POST',
      body: {
        records: gradedIds.map((studentId, index) => ({
          studentId,
          score: index === 0 ? 18 : 12,
          note: 'تصحيح تلقائي',
        })),
      },
    });
    check('تصحيح سريع', res.status === 200 && res.data?.saved >= 1, `${res.data?.saved} درجة`);

    res = await request(`/api/exams/${exam.id}`);
    check(
      'حساب نتيجة الامتحان',
      res.status === 200 && res.data?.exam?.gradedCount >= 1,
      `${res.data?.exam?.percent}%`,
    );

    res = await request(`/api/exams/${exam.id}`, {
      method: 'PATCH',
      body: { title: 'امتحان اختبار تلقائي — معدل', status: 'graded' },
    });
    check('تعديل امتحان', res.status === 200 && res.data?.exam?.title.includes('معدل'));

    res = await request(`/api/exams/${exam.id}/csv`, { raw: true });
    check('تصدير درجات الامتحان', res.status === 200 && res.headers.get('content-type')?.includes('text/csv'));

    /* ------------------------- achievements ---------------------------- */
    console.log('\n  [النقاط والشهادات]');
    res = await request('/api/points', {
      method: 'POST',
      body: {
        studentId: student.id,
        groupId,
        category: 'behavior',
        points: 12,
        reason: 'مشاركة ممتازة — اختبار',
      },
    });
    check('إضافة نقاط', res.status === 200 && res.data?.entry?.points === 12, `${res.data?.row?.total} إجمالي`);

    res = await request('/api/hall-of-fame?limit=100');
    check('لوحة الشرف', res.status === 200 && Array.isArray(res.data?.items) && res.data.items.length > 0);

    res = await request('/api/certificates/bulk', {
      method: 'POST',
      body: {
        studentIds: gradedIds.slice(0, 2),
        kind: 'excellence',
        title: 'شهادة تفوق — اختبار',
        note: 'تقديراً للتفوق في اختبار النظام.',
        issuedAt: new Date().toISOString().slice(0, 10),
      },
    });
    check('إصدار شهادات جماعي', res.status === 200 && res.data?.count >= 1, `${res.data?.count} شهادة`);
    const certificate = res.data?.items?.[0];

    res = await request(`/api/public/certificate/${encodeURIComponent(certificate.code)}`);
    check('التحقق العام من الشهادة', res.status === 200 && res.data?.valid === true);

    res = await request(`/api/certificates/${certificate.id}`, {
      method: 'PATCH',
      body: { status: 'revoked' },
    });
    check('إلغاء شهادة', res.status === 200 && res.data?.certificate?.status === 'revoked');
    res = await request(`/api/public/certificate/${encodeURIComponent(certificate.code)}`);
    check('الشهادة الملغية مرفوضة', res.status === 200 && res.data?.valid === false);

    res = await request('/api/certificates/export/csv', { raw: true });
    check('تصدير الشهادات', res.status === 200 && res.headers.get('content-type')?.includes('text/csv'));

    /* ---------------------------- treasury ----------------------------- */
    console.log('\n  [الخزنة والورديات]');
    const before = (await request('/api/treasury')).data?.balance || 0;
    res = await request('/api/treasury', {
      method: 'POST',
      body: { type: 'deposit', title: 'إيداع اختبار', amount: 500, method: 'cash', date: new Date().toISOString().slice(0, 10) },
    });
    check('إيداع في الخزنة', res.status === 200 && res.data?.entry?.amount === 500);
    res = await request('/api/treasury', {
      method: 'POST',
      body: { type: 'withdraw', title: 'مصروف اختبار', amount: 120, method: 'cash', date: new Date().toISOString().slice(0, 10) },
    });
    check('سحب من الخزنة', res.status === 200 && res.data?.entry?.amount === 120);
    res = await request('/api/treasury');
    check('رصيد الخزنة اتحدث', Math.round(res.data?.balance) === Math.round(before + 380), `${res.data?.balance}`);

    res = await request('/api/treasury/csv', { raw: true });
    check('تصدير الخزنة', res.status === 200 && res.headers.get('content-type')?.includes('text/csv'));

    const users = (await request('/api/users')).data?.items || [];
    res = await request('/api/shifts', {
      method: 'POST',
      body: {
        userId: users[0]?.id,
        date: new Date().toISOString().slice(0, 10),
        start: '14:00',
        end: '19:00',
        role: 'استقبال',
        status: 'open',
      },
    });
    check('إنشاء وردية', res.status === 200 && res.data?.shift?.id);
    const shift = res.data?.shift;
    res = await request(`/api/shifts/${shift.id}`, { method: 'PATCH', body: { status: 'closed' } });
    check('قفل الوردية', res.status === 200 && res.data?.shift?.status === 'closed');

    /* ---------------------------- platform ----------------------------- */
    console.log('\n  [الترخيص والمزامنة]');
    res = await request('/api/codes', {
      method: 'POST',
      body: { plan: 'monthly', days: 30, count: 2 },
    });
    check('توليد أكواد تفعيل', res.status === 200 && res.data?.items?.length === 2);
    const code = res.data?.items?.[0];
    res = await request('/api/platform/activate', { method: 'POST', body: { code: code.code } });
    check('تفعيل الاشتراك بالكود', res.status === 200 && res.data?.platform?.active === true);

    const syncFolder = path.join(DATA_DIR, 'sync-target');
    fs.mkdirSync(syncFolder, { recursive: true });
    fs.writeFileSync(path.join(syncFolder, 'note.txt'), 'sync ok');
    res = await request('/api/sync', { method: 'PATCH', body: { enabled: false, folder: syncFolder, intervalMinutes: 30 } });
    check('حفظ إعدادات المزامنة', res.status === 200 && res.data?.settings?.folder === syncFolder);
    res = await request('/api/sync/run', { method: 'POST' });
    check('تشغيل المزامنة', res.status === 200 && res.data?.entry?.status === 'ok', res.data?.entry?.message);

    /* ------------------------------- scan ------------------------------ */
    console.log('\n  [الباركود والحضور]');
    res = await request('/api/scan', { method: 'POST', body: { code: student.code } });
    check('مسح كود الطالب', res.status === 200 && res.data?.student?.id === student.id);
    const today = new Date().toISOString().slice(0, 10);
    res = await request(`/api/lessons?from=${today}&to=${today}&studentId=${student.id}`);
    const lesson = (res.data?.items || []).find((item) => item.status !== 'cancelled');
    if (lesson) {
      res = await request('/api/scan/attendance', {
        method: 'POST',
        body: { code: student.code, lessonId: lesson.id, status: 'present' },
      });
      check('تحضير بالباركود', res.status === 200 && res.data?.ok === true);
      res = await request(`/api/lessons/${lesson.id}`);
      check(
        'الحضور اتسجل في الحصة',
        res.status === 200 && (res.data?.students || []).some((row) => row.id === student.id && row.status === 'present'),
      );
    } else {
      ok('تحضير بالباركود — مفيش حصة النهارده (متخطي)');
    }

    res = await request('/api/absence-archive/csv', { raw: true });
    check('تصدير أرشيف الغياب', res.status === 200 && res.headers.get('content-type')?.includes('text/csv'));

    /* ----------------------------- exports ----------------------------- */
    console.log('\n  [التصدير]');
    for (const url of [
      '/api/exports/students.csv',
      '/api/exports/dues.csv',
      '/api/exports/payments.csv',
      '/api/exports/attendance.csv',
      '/api/exports/grades.csv',
    ]) {
      res = await request(url, { raw: true });
      check(`GET ${url}`, res.status === 200 && res.headers.get('content-type')?.includes('text/csv'));
    }

    /* ---------------------------- settings ----------------------------- */
    res = await request('/api/settings', {
      method: 'PATCH',
      body: { centerName: 'مركز دفتري — اختبار', portalMessage: 'رسالة اختبار' },
    });
    check('تعديل الإعدادات', res.status === 200 && res.data?.settings?.centerName.includes('اختبار'));

    /* ----------------------------- cleanup ----------------------------- */
    await request(`/api/exams/${exam.id}`, { method: 'DELETE' });
    await request(`/api/shifts/${shift.id}`, { method: 'DELETE' });
    await request(`/api/certificates/${certificate.id}`, { method: 'DELETE' });

    console.log(`\n  النتيجة: ${passed} ناجح · ${failed} فاشل\n`);
    if (failed) {
      console.log('  الفشل:');
      for (const item of failures) console.log(`   - ${item.label}: ${item.detail}`);
      console.log('');
    }
    process.exitCode = failed ? 1 : 0;
    return { portal, base };
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 2500);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}

async function main() {
  try {
    const result = await run();
    if (process.env.DAFTARY_KEEP_DATA === '1') {
      console.log(`  الداتا المؤقتة: ${DATA_DIR}\n`);
    } else {
      fs.rmSync(DATA_DIR, { recursive: true, force: true });
    }
    if (result?.portal) {
      console.log(`  البوابة: ${result.portal.settings.centerName} — ${result.portal.stats.students} طالب\n`);
    }
  } catch (error) {
    failed += 1;
    console.error(`\n  ✗ الاختبار اتوقف: ${error.message}\n`);
    if (process.env.DAFTARY_KEEP_DATA === '1') console.error(`  الداتا: ${DATA_DIR}\n`);
    else fs.rmSync(DATA_DIR, { recursive: true, force: true });
    process.exitCode = 1;
  }
}

main();
