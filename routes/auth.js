'use strict';

const auth = require('../lib/auth');
const db = require('../lib/db');
const { hashPassword, verifyPassword, passwordProblem } = require('../lib/passwords');
const { fail, str, nowISO } = require('../lib/utils');
const { log } = require('./_helpers');

const publicSettings = (settings) => ({
  centerName: settings.centerName,
  teacherName: settings.teacherName,
  phone: settings.phone,
  email: settings.email,
  address: settings.address,
  currency: settings.currency,
  weekStart: settings.weekStart,
  theme: settings.theme,
  currencyPosition: settings.currencyPosition,
  academicYear: settings.academicYear,
  enablePortal: settings.enablePortal,
  portalMessage: settings.portalMessage,
  barcodePrefix: settings.barcodePrefix,
  invoicePrefix: settings.invoicePrefix,
  lessonDuration: settings.lessonDuration,
});

module.exports = [
  {
    method: 'POST',
    path: '/api/auth/login',
    public: true,
    handler: (ctx) => {
      const email = str(ctx.body.email, { required: true, field: 'الإيميل', max: 120 });
      const password = str(ctx.body.password, { required: true, field: 'الباسورد', max: 200 });
      const { token, user, expiresAt } = auth.login(ctx.req, email, password, Boolean(ctx.body.remember));
      auth.setSessionCookie(ctx.req, ctx.res, token, Boolean(ctx.body.remember), user);
      db.mutate((state) => {
        log(state, user, 'auth.login', 'user', user.id, `دخول ${user.name}`);
      });
      return {
        user: auth.publicUser(user),
        expiresAt,
        settings: publicSettings(db.get().settings),
      };
    },
  },
  {
    method: 'POST',
    path: '/api/auth/logout',
    handler: (ctx) => {
      if (ctx.user) {
        db.mutate((state) => log(state, ctx.user, 'auth.logout', 'user', ctx.user.id, 'خروج'));
      }
      auth.logout(ctx.req);
      auth.clearSessionCookie(ctx.res);
      return { ok: true };
    },
  },
  {
    method: 'GET',
    path: '/api/auth/me',
    handler: (ctx) => {
      if (!ctx.user) throw fail(401, 'مش مسجل دخول', 'UNAUTHORIZED');
      return {
        user: auth.publicUser(ctx.user),
        settings: publicSettings(ctx.state.settings),
        session: { expiresAt: ctx.session.expiresAt },
      };
    },
  },
  {
    method: 'PATCH',
    path: '/api/auth/profile',
    handler: (ctx) => {
      const name = str(ctx.body.name, { required: true, field: 'الاسم', min: 2, max: 60 });
      const phone = str(ctx.body.phone, { max: 30, field: 'الموبايل' });
      return db.mutate((state) => {
        const user = state.users.find((u) => u.id === ctx.user.id);
        user.name = name;
        user.phone = phone;
        log(state, user, 'profile.update', 'user', user.id, 'تحديث البيانات الشخصية');
        return { user: auth.publicUser(user) };
      });
    },
  },
  {
    method: 'POST',
    path: '/api/auth/password',
    handler: (ctx) => {
      const current = String(ctx.body.current || '');
      const next = String(ctx.body.next || '');
      if (!verifyPassword(current, ctx.user.salt, ctx.user.passwordHash)) {
        throw fail(422, 'الباسورد الحالي مش صح', 'VALIDATION', { current: 'الباسورد الحالي مش صح' });
      }
      const problem = passwordProblem(next);
      if (problem) throw fail(422, problem, 'VALIDATION', { next: problem });
      if (current === next) throw fail(422, 'الباسورد الجديد لازم يختلف عن القديم', 'VALIDATION');
      return db.mutate((state) => {
        const user = state.users.find((u) => u.id === ctx.user.id);
        const { salt, passwordHash } = hashPassword(next);
        user.salt = salt;
        user.passwordHash = passwordHash;
        user.passwordChangedAt = nowISO();
        state.sessions = state.sessions.filter(
          (s) => s.userId !== user.id || s.tokenHash === ctx.session.tokenHash,
        );
        log(state, user, 'auth.password', 'user', user.id, 'تغيير الباسورد');
        return { ok: true };
      });
    },
  },
];
