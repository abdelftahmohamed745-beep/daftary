'use strict';

const fs = require('fs');
const { id, str, num, oneOf, fail, nowISO } = require('../lib/utils');
const { hashPassword, passwordProblem } = require('../lib/passwords');
const db = require('../lib/db');
const auth = require('../lib/auth');
const { log, ensureAdmin } = require('./_helpers');

const ROLES = ['admin', 'assistant'];
const SETTING_FIELDS = [
  'centerName',
  'teacherName',
  'phone',
  'email',
  'address',
  'currency',
  'weekStart',
  'invoicePrefix',
  'reminderTemplate',
  'paymentTemplate',
  'theme',
  'lessonDuration',
  'currencyPosition',
  'academicYear',
  'barcodePrefix',
  'certificateSigner',
  'certificateNote',
  'portalMessage',
  'enablePortal',
  'autoBackup',
];

function publicSettings(state) {
  return state.settings;
}

function userView(user) {
  return auth.publicUser(user);
}

module.exports = [
  {
    method: 'GET',
    path: '/api/settings',
    handler: (ctx) => ({ settings: publicSettings(ctx.state) }),
  },
  {
    method: 'PATCH',
    path: '/api/settings',
    adminOnly: true,
    handler: (ctx) => {
      ensureAdmin(ctx.user);
      return ctx.mutate((state) => {
        const next = { ...state.settings };
        for (const key of SETTING_FIELDS) {
          if (ctx.body[key] === undefined) continue;
          if (key === 'weekStart') {
            const day = Number(ctx.body[key]);
            if (!Number.isInteger(day) || day < 0 || day > 6) throw fail(422, 'بداية الأسبوع غير صحيحة', 'VALIDATION');
            next[key] = day;
          } else if (key === 'lessonDuration') {
            next[key] = num(ctx.body[key], { min: 15, max: 300, field: 'مدة الحصة' }) || 90;
          } else if (key === 'theme') {
            next[key] = oneOf(ctx.body[key], ['light', 'dark'], 'المظهر', 'light');
          } else if (key === 'currencyPosition') {
            next[key] = oneOf(ctx.body[key], ['before', 'after'], 'مكان العملة', 'after');
          } else if (key === 'reminderTemplate' || key === 'paymentTemplate') {
            next[key] = str(ctx.body[key], { max: 1200, field: 'نص الرسالة' });
          } else if (key === 'portalMessage' || key === 'certificateNote') {
            next[key] = str(ctx.body[key], { max: 1200, field: 'النص' });
          } else if (key === 'barcodePrefix') {
            const prefix = str(ctx.body[key], { max: 12, field: 'بادئة الباركود' })
              .replace(/[^A-Za-z0-9]/g, '')
              .toUpperCase();
            if (!prefix) throw fail(422, 'بادئة الباركود لازم حروف أو أرقام', 'VALIDATION');
            next[key] = prefix;
          } else if (key === 'enablePortal' || key === 'autoBackup') {
            next[key] = Boolean(ctx.body[key]);
          } else if (key === 'email') {
            next[key] = str(ctx.body[key], { max: 120, field: 'الإيميل' });
          } else {
            next[key] = str(ctx.body[key], { max: 260, field: key });
          }
        }
        if (ctx.body.points && typeof ctx.body.points === 'object') {
          const points = { ...state.settings.points };
          for (const field of ['present', 'late', 'absent', 'excused', 'grade']) {
            if (ctx.body.points[field] === undefined) continue;
            points[field] = num(ctx.body.points[field], { min: -100, max: 100, field: 'قيمة النقاط' }) || 0;
          }
          next.points = points;
        }
        if (ctx.body.portal && typeof ctx.body.portal === 'object') {
          next.portal = {
            ...state.settings.portal,
            ...(ctx.body.portal.showBalance !== undefined
              ? { showBalance: Boolean(ctx.body.portal.showBalance) }
              : {}),
            ...(ctx.body.portal.showExams !== undefined ? { showExams: Boolean(ctx.body.portal.showExams) } : {}),
            ...(ctx.body.portal.showAttendance !== undefined
              ? { showAttendance: Boolean(ctx.body.portal.showAttendance) }
              : {}),
            ...(ctx.body.portal.showCertificates !== undefined
              ? { showCertificates: Boolean(ctx.body.portal.showCertificates) }
              : {}),
          };
        }
        state.settings = next;
        log(state, ctx.user, 'settings.update', 'settings', null, 'تحديث إعدادات المركز');
        return { settings: state.settings };
      });
    },
  },
  {
    method: 'GET',
    path: '/api/users',
    adminOnly: true,
    handler: (ctx) => {
      ensureAdmin(ctx.user);
      return {
        items: ctx.state.users.map(userView),
        total: ctx.state.users.length,
      };
    },
  },
  {
    method: 'POST',
    path: '/api/users',
    adminOnly: true,
    handler: (ctx) => {
      ensureAdmin(ctx.user);
      const name = str(ctx.body.name, { required: true, field: 'الاسم', min: 2, max: 60 });
      const email = str(ctx.body.email, { required: true, field: 'الإيميل', min: 5, max: 120 }).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw fail(422, 'الإيميل غير صحيح', 'VALIDATION', { email: 'الإيميل غير صحيح' });
      }
      const role = oneOf(ctx.body.role, ROLES, 'الدور', 'assistant');
      const password = String(ctx.body.password || '');
      const problem = passwordProblem(password);
      if (problem) throw fail(422, problem, 'VALIDATION', { password: problem });
      const phone = str(ctx.body.phone, { max: 30, field: 'الموبايل' });
      return ctx.mutate((state) => {
        if (state.users.some((u) => String(u.email).toLowerCase() === email)) {
          throw fail(409, 'الإيميل ده مستخدم بالفعل', 'DUPLICATE', { email: 'مستخدم بالفعل' });
        }
        const { salt, passwordHash } = hashPassword(password);
        const user = {
          id: id('usr'),
          name,
          email,
          phone,
          role,
          active: true,
          salt,
          passwordHash,
          avatarColor: role === 'admin' ? '#2f6f5e' : '#c25a3c',
          createdAt: nowISO(),
          lastLoginAt: null,
        };
        state.users.push(user);
        log(state, ctx.user, 'user.create', 'user', user.id, `إضافة مستخدم ${user.name}`);
        return { user: userView(user) };
      });
    },
  },
  {
    method: 'PATCH',
    path: '/api/users/:id',
    adminOnly: true,
    handler: (ctx) => {
      ensureAdmin(ctx.user);
      const target = ctx.state.users.find((u) => u.id === ctx.params.id);
      if (!target) throw fail(404, 'المستخدم مش موجود', 'NOT_FOUND');
      return ctx.mutate((state) => {
        const user = state.users.find((u) => u.id === target.id);
        const admins = state.users.filter((u) => u.role === 'admin' && u.active !== false);
        if (ctx.body.name !== undefined) {
          user.name = str(ctx.body.name, { required: true, min: 2, max: 60, field: 'الاسم' });
        }
        if (ctx.body.email !== undefined) {
          const email = str(ctx.body.email, { required: true, min: 5, max: 120, field: 'الإيميل' }).toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(422, 'الإيميل غير صحيح', 'VALIDATION');
          if (state.users.some((u) => u.id !== user.id && String(u.email).toLowerCase() === email)) {
            throw fail(409, 'الإيميل ده مستخدم بالفعل', 'DUPLICATE');
          }
          user.email = email;
        }
        if (ctx.body.phone !== undefined) user.phone = str(ctx.body.phone, { max: 30, field: 'الموبايل' });
        if (ctx.body.role !== undefined) {
          const role = oneOf(ctx.body.role, ROLES, 'الدور');
          if (role !== 'admin' && user.role === 'admin' && admins.length <= 1) {
            throw fail(409, 'لازم يفضل مدير واحد على الأقل', 'LAST_ADMIN');
          }
          if (user.id === ctx.user.id && role !== 'admin') {
            throw fail(409, 'مش تقدر تغير دورك انت', 'SELF_ROLE');
          }
          user.role = role;
        }
        if (ctx.body.active !== undefined) {
          const active = Boolean(ctx.body.active);
          if (!active && user.id === ctx.user.id) throw fail(409, 'مش تقدر توقف حسابك', 'SELF_DISABLE');
          if (!active && user.role === 'admin' && admins.length <= 1) {
            throw fail(409, 'لازم يفضل مدير واحد على الأقل', 'LAST_ADMIN');
          }
          user.active = active;
          if (!active) state.sessions = state.sessions.filter((s) => s.userId !== user.id);
        }
        if (ctx.body.avatarColor !== undefined) {
          user.avatarColor = str(ctx.body.avatarColor, { max: 20, field: 'اللون' });
        }
        user.updatedAt = nowISO();
        log(state, ctx.user, 'user.update', 'user', user.id, `تعديل مستخدم ${user.name}`);
        return { user: userView(user) };
      });
    },
  },
  {
    method: 'POST',
    path: '/api/users/:id/password',
    adminOnly: true,
    handler: (ctx) => {
      ensureAdmin(ctx.user);
      const target = ctx.state.users.find((u) => u.id === ctx.params.id);
      if (!target) throw fail(404, 'المستخدم مش موجود', 'NOT_FOUND');
      const password = String(ctx.body.password || '');
      const problem = passwordProblem(password);
      if (problem) throw fail(422, problem, 'VALIDATION', { password: problem });
      return ctx.mutate((state) => {
        const user = state.users.find((u) => u.id === target.id);
        const { salt, passwordHash } = hashPassword(password);
        user.salt = salt;
        user.passwordHash = passwordHash;
        state.sessions = state.sessions.filter((s) => s.userId !== user.id);
        log(state, ctx.user, 'user.password', 'user', user.id, `تعيين باسورد جديد لـ ${user.name}`);
        return { ok: true };
      });
    },
  },
  {
    method: 'DELETE',
    path: '/api/users/:id',
    adminOnly: true,
    handler: (ctx) => {
      ensureAdmin(ctx.user);
      if (ctx.params.id === ctx.user.id) throw fail(409, 'مش تقدر تحذف حسابك', 'SELF_DELETE');
      const target = ctx.state.users.find((u) => u.id === ctx.params.id);
      if (!target) throw fail(404, 'المستخدم مش موجود', 'NOT_FOUND');
      return ctx.mutate((state) => {
        const admins = state.users.filter((u) => u.role === 'admin' && u.active !== false);
        if (target.role === 'admin' && admins.length <= 1) {
          throw fail(409, 'مش تقدر تحذف آخر مدير', 'LAST_ADMIN');
        }
        state.users = state.users.filter((u) => u.id !== target.id);
        state.sessions = state.sessions.filter((s) => s.userId !== target.id);
        log(state, ctx.user, 'user.delete', 'user', target.id, `حذف مستخدم ${target.name}`);
        return { ok: true };
      });
    },
  },
  {
    method: 'GET',
    path: '/api/activity',
    handler: (ctx) => {
      const limit = Math.min(300, Math.max(1, Number(ctx.query.limit) || 60));
      let items = ctx.state.activities;
      if (ctx.query.action) items = items.filter((a) => a.action.startsWith(ctx.query.action));
      return {
        items: [...items].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, limit),
        total: items.length,
      };
    },
  },
  {
    method: 'GET',
    path: '/api/backups',
    adminOnly: true,
    handler: (ctx) => {
      ensureAdmin(ctx.user);
      return { items: db.listBackups(), directory: db.BACKUP_DIR };
    },
  },
  {
    method: 'POST',
    path: '/api/backups',
    adminOnly: true,
    handler: (ctx) => {
      ensureAdmin(ctx.user);
      const file = db.backup('manual');
      if (!file) throw fail(404, 'مفيش داتا أعملها نسخة', 'NOT_FOUND');
      return { name: require('path').basename(file), items: db.listBackups() };
    },
  },
  {
    method: 'GET',
    path: '/api/backups/:name/download',
    adminOnly: true,
    handler: (ctx) => {
      ensureAdmin(ctx.user);
      const safe = require('path').basename(ctx.params.name);
      if (!safe.endsWith('.json')) throw fail(422, 'اسم النسخة غير صحيح', 'VALIDATION');
      const full = require('path').join(db.BACKUP_DIR, safe);
      if (!fs.existsSync(full)) throw fail(404, 'النسخة مش موجودة', 'NOT_FOUND');
      return { __file: full, filename: safe, contentType: 'application/json' };
    },
  },
  {
    method: 'POST',
    path: '/api/backups/:name/restore',
    adminOnly: true,
    handler: (ctx) => {
      ensureAdmin(ctx.user);
      const data = db.readBackup(ctx.params.name);
      db.replace(data, { label: 'before-restore' });
      return { ok: true, restored: ctx.params.name };
    },
  },
  {
    method: 'GET',
    path: '/api/backup/export',
    adminOnly: true,
    handler: (ctx) => {
      ensureAdmin(ctx.user);
      return { __file: db.DB_FILE, filename: `daftary-backup-${new Date().toISOString().slice(0, 10)}.json`, contentType: 'application/json' };
    },
  },
  {
    method: 'POST',
    path: '/api/backup/import',
    adminOnly: true,
    handler: (ctx) => {
      ensureAdmin(ctx.user);
      const data = ctx.body.data;
      if (!data || typeof data !== 'object' || !Array.isArray(data.students) || !Array.isArray(data.users)) {
        throw fail(422, 'ملف النسخة غير صحيح', 'VALIDATION');
      }
      db.replace(data, { label: 'before-import' });
      return { ok: true, counts: db.stats().counts };
    },
  },
  {
    method: 'GET',
    path: '/api/system',
    adminOnly: true,
    handler: (ctx) => {
      ensureAdmin(ctx.user);
      return {
        ...db.stats(),
        node: process.version,
        uptime: Math.round(process.uptime()),
        memory: Math.round(process.memoryUsage().rss / 1024 / 1024),
        app: process.env.npm_package_version || '1.0.0',
      };
    },
  },
  {
    method: 'POST',
    path: '/api/system/reset',
    adminOnly: true,
    handler: (ctx) => {
      ensureAdmin(ctx.user);
      if (String(ctx.body.confirm || '') !== 'RESET') {
        throw fail(422, 'اكتب RESET عشان تأكد المسح', 'VALIDATION', { confirm: 'مطلوب' });
      }
      db.reset();
      return { ok: true };
    },
  },
];
