'use strict';

const fs = require('fs');
const path = require('path');
const { id, str, num, oneOf, dateStr, timeStr, fail, nowISO, todayISO } = require('../lib/utils');
const domain = require('../lib/domain');
const features = require('../lib/features');
const { log, ensureAdmin, csvResult, toCsv } = require('./_helpers');

const TREASURY_TYPES = ['deposit', 'withdraw'];
const METHODS = ['cash', 'vodafone', 'instapay', 'bank', 'other'];
const PLANS = ['trial', 'monthly', 'yearly', 'lifetime'];

function findShift(state, shiftId) {
  const shift = state.shifts.find((s) => s.id === shiftId);
  if (!shift) throw fail(404, 'الوردية مش موجودة', 'NOT_FOUND');
  return shift;
}

function makeCode(plan) {
  const chunk = () => String(Math.floor(1000 + Math.random() * 9000));
  return `DFT-${plan.slice(0, 3).toUpperCase()}-${chunk()}-${chunk()}`;
}

module.exports = [
  /* ------------------------------- shifts ------------------------------- */
  {
    method: 'GET',
    path: '/api/shifts',
    handler: (ctx) => {
      const { state, query } = ctx;
      let items = [...state.shifts];
      if (query.from) items = items.filter((s) => s.date >= query.from);
      if (query.to) items = items.filter((s) => s.date <= query.to);
      if (query.userId) items = items.filter((s) => s.userId === query.userId);
      if (query.status && query.status !== 'all') items = items.filter((s) => s.status === query.status);
      items.sort((a, b) => (a.date === b.date ? a.start.localeCompare(b.start) : b.date.localeCompare(a.date)));
      const today = todayISO();
      return {
        items,
        staff: state.users.map((u) => ({ id: u.id, name: u.name, role: u.role, avatarColor: u.avatarColor })),
        summary: {
          total: items.length,
          today: items.filter((s) => s.date === today).length,
          open: items.filter((s) => s.status === 'open').length,
          hours: domain.round2(
            items.reduce((total, s) => {
              const mins = Math.max(0, domain.timeToMinutes(s.end) - domain.timeToMinutes(s.start));
              return total + mins / 60;
            }, 0),
          ),
        },
      };
    },
  },
  {
    method: 'POST',
    path: '/api/shifts',
    handler: (ctx) => {
      const user = ctx.state.users.find((u) => u.id === ctx.body.userId) || ctx.user;
      const start = timeStr(ctx.body.start, 'بداية الوردية', { required: true });
      const end = timeStr(ctx.body.end, 'نهاية الوردية', { required: true });
      if (domain.timeToMinutes(end) <= domain.timeToMinutes(start)) {
        throw fail(422, 'نهاية الوردية لازم تكون بعد البداية', 'VALIDATION');
      }
      const payload = {
        userId: user.id,
        userName: user.name,
        date: dateStr(ctx.body.date, 'تاريخ الوردية', { required: true }),
        start,
        end,
        role: str(ctx.body.role, { max: 80 }) || 'استقبال',
        status: oneOf(ctx.body.status, ['open', 'closed'], 'حالة الوردية', 'open'),
        note: str(ctx.body.note, { max: 400 }),
      };
      return ctx.mutate((state) => {
        const shift = { id: id('shf'), ...payload, createdAt: nowISO() };
        state.shifts.push(shift);
        log(state, ctx.user, 'shift.create', 'shift', shift.id, `وردية ${user.name} — ${shift.date}`);
        return { shift };
      });
    },
  },
  {
    method: 'PATCH',
    path: '/api/shifts/:id',
    handler: (ctx) => {
      const shiftId = findShift(ctx.state, ctx.params.id).id;
      return ctx.mutate((state) => {
        const shift = findShift(state, shiftId);
        if (ctx.body.start !== undefined) shift.start = timeStr(ctx.body.start, 'بداية الوردية');
        if (ctx.body.end !== undefined) shift.end = timeStr(ctx.body.end, 'نهاية الوردية');
        if (domain.timeToMinutes(shift.end) <= domain.timeToMinutes(shift.start)) {
          throw fail(422, 'نهاية الوردية لازم تكون بعد البداية', 'VALIDATION');
        }
        if (ctx.body.date !== undefined) shift.date = dateStr(ctx.body.date, 'تاريخ الوردية');
        if (ctx.body.status !== undefined)
          shift.status = oneOf(ctx.body.status, ['open', 'closed'], 'حالة الوردية');
        if (ctx.body.note !== undefined) shift.note = str(ctx.body.note, { max: 400 });
        if (ctx.body.role !== undefined) shift.role = str(ctx.body.role, { max: 80 });
        return { shift };
      });
    },
  },
  {
    method: 'DELETE',
    path: '/api/shifts/:id',
    handler: (ctx) => {
      return ctx.mutate((state) => {
        const shift = findShift(state, ctx.params.id);
        state.shifts = state.shifts.filter((s) => s.id !== shift.id);
        log(state, ctx.user, 'shift.delete', 'shift', shift.id, `حذف وردية ${shift.date}`);
        return { ok: true };
      });
    },
  },

  /* ------------------------------ treasury ------------------------------ */
  {
    method: 'GET',
    path: '/api/treasury',
    handler: (ctx) => {
      const summary = features.treasurySummary(ctx.state, { from: ctx.query.from, to: ctx.query.to });
      return summary;
    },
  },
  {
    method: 'POST',
    path: '/api/treasury',
    handler: (ctx) => {
      const payload = {
        type: oneOf(ctx.body.type, TREASURY_TYPES, 'نوع الحركة', 'deposit'),
        title: str(ctx.body.title, { required: true, field: 'البيان', max: 180 }),
        amount: num(ctx.body.amount, { min: 1, max: 10000000, required: true, field: 'المبلغ' }),
        method: oneOf(ctx.body.method, METHODS, 'طريقة الدفع', 'cash'),
        date: dateStr(ctx.body.date, 'التاريخ') || todayISO(),
        note: str(ctx.body.note, { max: 400 }),
      };
      return ctx.mutate((state) => {
        const entry = {
          id: id('trs'),
          ...payload,
          at: nowISO(),
          by: ctx.user.name,
          createdAt: nowISO(),
        };
        state.treasury.push(entry);
        log(
          state,
          ctx.user,
          'treasury.create',
          'treasury',
          entry.id,
          `${entry.type === 'deposit' ? 'إيداع' : 'سحب'} ${entry.amount} — ${entry.title}`,
        );
        return { entry, summary: features.treasurySummary(state) };
      });
    },
  },
  {
    method: 'DELETE',
    path: '/api/treasury/:id',
    handler: (ctx) => {
      return ctx.mutate((state) => {
        const entry = state.treasury.find((t) => t.id === ctx.params.id);
        if (!entry) throw fail(404, 'الحركة مش موجودة', 'NOT_FOUND');
        state.treasury = state.treasury.filter((t) => t.id !== entry.id);
        log(state, ctx.user, 'treasury.delete', 'treasury', entry.id, `حذف حركة ${entry.title}`);
        return { ok: true, summary: features.treasurySummary(state) };
      });
    },
  },
  {
    method: 'GET',
    path: '/api/treasury/csv',
    handler: (ctx) => {
      const summary = features.treasurySummary(ctx.state, { from: ctx.query.from, to: ctx.query.to });
      const text = toCsv(
        ['التاريخ', 'النوع', 'البيان', 'المبلغ', 'الطريقة', 'بواسطة', 'ملاحظة'],
        summary.entries.map((e) => [
          e.date,
          e.type === 'deposit' ? 'إيداع' : 'سحب',
          e.title,
          e.amount,
          e.method,
          e.by,
          e.note,
        ]),
      );
      return csvResult(text, 'treasury.csv');
    },
  },

  /* --------------------------- platform codes --------------------------- */
  {
    method: 'GET',
    path: '/api/platform',
    handler: (ctx) => {
      const status = features.platformStatus(ctx.state);
      return {
        platform: status,
        codes: [...ctx.state.codes].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
        plans: PLANS,
      };
    },
  },
  {
    method: 'POST',
    path: '/api/platform/activate',
    handler: (ctx) => {
      const codeValue = str(ctx.body.code, { required: true, field: 'كود التفعيل', max: 60 }).toUpperCase();
      return ctx.mutate((state) => {
        const code = state.codes.find((c) => String(c.code).toUpperCase() === codeValue);
        if (!code) throw fail(404, 'الكود مش موجود', 'NOT_FOUND');
        if (code.status === 'used') throw fail(422, 'الكود ده مستخدم قبل كده', 'VALIDATION');
        const base =
          state.settings.platform?.expiresAt &&
          new Date(`${state.settings.platform.expiresAt}T00:00:00`) > new Date()
            ? new Date(`${state.settings.platform.expiresAt}T00:00:00`)
            : new Date();
        base.setDate(base.getDate() + Number(code.days || 30));
        const expiresAt = base.toISOString().slice(0, 10);
        code.status = 'used';
        code.usedAt = nowISO();
        code.usedBy = ctx.user.name;
        state.settings.platform = {
          ...(state.settings.platform || {}),
          plan: code.plan,
          status: 'active',
          activatedAt: nowISO(),
          expiresAt,
          licenseKey: code.code,
        };
        log(state, ctx.user, 'platform.activate', 'platform', null, `تفعيل باقة ${code.plan} لحد ${expiresAt}`);
        return { platform: features.platformStatus(state), code };
      });
    },
  },
  {
    method: 'POST',
    path: '/api/codes',
    adminOnly: true,
    handler: (ctx) => {
      const plan = oneOf(ctx.body.plan, PLANS, 'الباقة', 'monthly');
      const days =
        num(ctx.body.days, { min: 1, max: 3650, field: 'عدد الأيام' }) ||
        (plan === 'trial' ? 14 : plan === 'monthly' ? 30 : plan === 'yearly' ? 365 : 3650);
      const count = Math.min(50, Math.max(1, Number(ctx.body.count) || 1));
      return ctx.mutate((state) => {
        const created = [];
        for (let index = 0; index < count; index += 1) {
          let code;
          do {
            code = makeCode(plan);
          } while (state.codes.some((c) => c.code === code));
          const entry = {
            id: id('cod'),
            code,
            plan,
            days,
            status: 'unused',
            usedAt: null,
            usedBy: null,
            createdAt: nowISO(),
          };
          state.codes.push(entry);
          created.push(entry);
        }
        log(state, ctx.user, 'codes.create', 'code', null, `توليد ${created.length} كود ${plan}`);
        return { items: created };
      });
    },
  },
  {
    method: 'DELETE',
    path: '/api/codes/:id',
    adminOnly: true,
    handler: (ctx) => {
      return ctx.mutate((state) => {
        const entry = state.codes.find((c) => c.id === ctx.params.id);
        if (!entry) throw fail(404, 'الكود مش موجود', 'NOT_FOUND');
        state.codes = state.codes.filter((c) => c.id !== entry.id);
        return { ok: true };
      });
    },
  },

  /* ------------------------------- sync -------------------------------- */
  {
    method: 'GET',
    path: '/api/sync',
    handler: (ctx) => ({
      settings: ctx.state.settings.sync,
      logs: [...ctx.state.syncLogs].sort((a, b) => String(b.date).localeCompare(String(a.date))),
    }),
  },
  {
    method: 'PATCH',
    path: '/api/sync',
    adminOnly: true,
    handler: (ctx) => {
      return ctx.mutate((state) => {
        const sync = state.settings.sync || {};
        if (ctx.body.enabled !== undefined) sync.enabled = Boolean(ctx.body.enabled);
        if (ctx.body.folder !== undefined) sync.folder = str(ctx.body.folder, { max: 400 });
        if (ctx.body.intervalMinutes !== undefined)
          sync.intervalMinutes = num(ctx.body.intervalMinutes, { min: 5, max: 1440, field: 'المدة' }) || 60;
        state.settings.sync = sync;
        log(state, ctx.user, 'sync.update', 'settings', null, 'تعديل إعدادات المزامنة');
        return { settings: sync };
      });
    },
  },
  {
    method: 'POST',
    path: '/api/sync/run',
    adminOnly: true,
    handler: (ctx) => {
      return ctx.mutate((state) => {
        const sync = state.settings.sync || {};
        const folder = String(sync.folder || '').trim();
        const folder2 = folder ? path.resolve(folder.replace(/^~(?=$|\/)/, process.env.HOME || '')) : '';
        let status = 'ok';
        let files = 0;
        let message = 'تمت المزامنة بنجاح';
        if (!folder2) {
          status = 'error';
          message = 'مفيش مجلد متحدد — اختار مسار مجلد المزامنة الأول';
        } else if (!fs.existsSync(folder2) || !fs.statSync(folder2).isDirectory()) {
          status = 'error';
          message = 'المجلد مش موجود أو مش متاح';
        } else {
          try {
            files = fs.readdirSync(folder2).length;
          } catch {
            status = 'error';
            message = 'تعذر قراءة المجلد — راجع الصلاحيات';
          }
        }
        const entry = {
          id: id('syn'),
          at: nowISO(),
          date: todayISO(),
          status,
          files,
          message,
        };
        state.syncLogs.unshift(entry);
        if (state.syncLogs.length > 200) state.syncLogs.length = 200;
        if (status === 'ok') sync.lastSyncAt = nowISO();
        state.settings.sync = sync;
        log(state, ctx.user, 'sync.run', 'settings', null, message);
        return { entry, settings: sync, logs: state.syncLogs.slice(0, 40) };
      });
    },
  },
];
