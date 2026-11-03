'use strict';

const {
  id,
  str,
  num,
  oneOf,
  dateStr,
  fail,
  todayISO,
  nowISO,
  monthKey,
} = require('../lib/utils');
const domain = require('../lib/domain');
const {
  log,
  findStudent,
  findGroup,
  findCharge,
  findPayment,
  dateRange,
  ensureAdmin,
  searchText,
  matches,
} = require('./_helpers');

const METHODS = ['cash', 'vodafone', 'instapay', 'bank', 'other'];
const CHARGE_TYPES = ['subscription', 'manual', 'material', 'exam', 'other'];
const EXPENSE_CATEGORIES = ['rent', 'salaries', 'marketing', 'materials', 'transport', 'other'];

function nextReceiptNo(state) {
  const year = new Date().getFullYear();
  const prefix = state.settings.invoicePrefix || 'DFT';
  let max = 0;
  for (const payment of state.payments) {
    const match = String(payment.receiptNo || '').match(/(\d+)$/);
    if (match && String(payment.receiptNo).includes(`-${year}-`)) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return `${prefix}-${year}-${String(max + 1).padStart(4, '0')}`;
}

function chargeView(state, charge, statusMap) {
  const student = domain.byId(state.students, charge.studentId) || {};
  const group = charge.groupId ? domain.byId(state.groups, charge.groupId) : null;
  const allocation = statusMap.get(charge.id);
  return {
    ...charge,
    studentName: student.name || '',
    studentShort: student.shortName || '',
    parentPhone: student.parentPhone || student.phone || '',
    avatarColor: student.avatarColor,
    groupName: group ? group.name : '',
    paidAmount: allocation ? allocation.paidAmount : 0,
    remaining: allocation ? allocation.remaining : Number(charge.amount || 0),
    settled: allocation ? allocation.settled : false,
    overdue: !allocation?.settled && charge.dueDate < todayISO(),
  };
}

module.exports = [
  {
    method: 'GET',
    path: '/api/charges',
    handler: (ctx) => {
      const { state, query } = ctx;
      const statusMap = domain.chargeStatusMap(state);
      let items = state.charges.map((c) => chargeView(state, c, statusMap));
      if (query.studentId) items = items.filter((c) => c.studentId === query.studentId);
      if (query.groupId) items = items.filter((c) => c.groupId === query.groupId);
      if (query.month) items = items.filter((c) => c.month === query.month);
      if (query.from) items = items.filter((c) => c.dueDate >= query.from);
      if (query.to) items = items.filter((c) => c.dueDate <= query.to);
      if (query.type) items = items.filter((c) => c.type === query.type);
      if (query.status === 'paid') items = items.filter((c) => c.settled);
      if (query.status === 'unpaid') items = items.filter((c) => !c.settled);
      if (query.status === 'overdue') items = items.filter((c) => c.overdue);
      const needle = searchText(query.search);
      if (needle) {
        items = items.filter((c) =>
          [c.title, c.studentName, c.groupName].some((v) => matches(v, needle)),
        );
      }
      items.sort((a, b) => String(b.dueDate).localeCompare(String(a.dueDate)));
      const summary = {
        total: domain.round2(items.reduce((t, c) => t + Number(c.amount || 0), 0)),
        paid: domain.round2(items.reduce((t, c) => t + c.paidAmount, 0)),
        remaining: domain.round2(items.reduce((t, c) => t + c.remaining, 0)),
        count: items.length,
        overdue: items.filter((c) => c.overdue).length,
      };
      return {
        items: items.slice(0, Math.min(500, Number(query.limit) || 300)),
        total: items.length,
        summary,
        months: [...new Set(state.charges.map((c) => c.month).filter(Boolean))].sort().reverse(),
      };
    },
  },
  {
    method: 'POST',
    path: '/api/charges',
    handler: (ctx) => {
      const student = findStudent(ctx.state, ctx.body.studentId);
      const title = str(ctx.body.title, { required: true, field: 'البيان', min: 2, max: 120 });
      const amount = num(ctx.body.amount, { required: true, min: 1, max: 1000000, field: 'المبلغ' });
      const type = oneOf(ctx.body.type, CHARGE_TYPES, 'النوع', 'manual');
      const groupId = ctx.body.groupId || null;
      const dueDate = dateStr(ctx.body.dueDate, 'تاريخ الاستحقاق') || todayISO();
      let month = ctx.body.month || null;
      if (month && !/^\d{4}-\d{2}$/.test(month)) throw fail(422, 'الشهر غير صحيح', 'VALIDATION');
      if (!month && type === 'subscription') month = monthKey(new Date(`${dueDate}T00:00:00`));
      if (groupId) findGroup(ctx.state, groupId);
      const note = str(ctx.body.note, { max: 400, field: 'ملاحظة' });
      return ctx.mutate((state) => {
        const charge = {
          id: id('chg'),
          studentId: student.id,
          groupId,
          title,
          amount: domain.round2(amount),
          month,
          dueDate,
          type,
          note,
          createdAt: nowISO(),
          createdBy: ctx.user.id,
        };
        state.charges.push(charge);
        log(state, ctx.user, 'charge.create', 'charge', charge.id, `مستحق ${charge.title} — ${charge.amount}`);
        return { charge: chargeView(state, charge, domain.chargeStatusMap(state)) };
      });
    },
  },
  {
    method: 'PATCH',
    path: '/api/charges/:id',
    handler: (ctx) => {
      const charge = findCharge(ctx.state, ctx.params.id);
      return ctx.mutate((state) => {
        const target = findCharge(state, charge.id);
        if (ctx.body.title !== undefined) {
          target.title = str(ctx.body.title, { required: true, min: 2, max: 120, field: 'البيان' });
        }
        if (ctx.body.amount !== undefined) {
          target.amount = num(ctx.body.amount, { required: true, min: 1, max: 1000000, field: 'المبلغ' });
        }
        if (ctx.body.dueDate !== undefined) target.dueDate = dateStr(ctx.body.dueDate, 'تاريخ الاستحقاق', { required: true });
        if (ctx.body.month !== undefined) {
          target.month = ctx.body.month || null;
          if (target.month && !/^\d{4}-\d{2}$/.test(target.month)) {
            throw fail(422, 'الشهر غير صحيح', 'VALIDATION');
          }
        }
        if (ctx.body.type !== undefined) target.type = oneOf(ctx.body.type, CHARGE_TYPES, 'النوع');
        if (ctx.body.note !== undefined) target.note = str(ctx.body.note, { max: 400, field: 'ملاحظة' });
        if (ctx.body.groupId !== undefined) {
          if (ctx.body.groupId) findGroup(state, ctx.body.groupId);
          target.groupId = ctx.body.groupId || null;
        }
        target.updatedAt = nowISO();
        log(state, ctx.user, 'charge.update', 'charge', target.id, `تعديل مستحق ${target.title}`);
        return { charge: chargeView(state, target, domain.chargeStatusMap(state)) };
      });
    },
  },
  {
    method: 'DELETE',
    path: '/api/charges/:id',
    adminOnly: true,
    handler: (ctx) => {
      const charge = findCharge(ctx.state, ctx.params.id);
      ensureAdmin(ctx.user);
      return ctx.mutate((state) => {
        state.charges = state.charges.filter((c) => c.id !== charge.id);
        log(state, ctx.user, 'charge.delete', 'charge', charge.id, `حذف مستحق ${charge.title}`);
        return { ok: true };
      });
    },
  },
  {
    method: 'POST',
    path: '/api/charges/bulk',
    handler: (ctx) => {
      const month = str(ctx.body.month, { required: true, field: 'الشهر', min: 7, max: 7 });
      if (!/^\d{4}-\d{2}$/.test(month)) throw fail(422, 'الشهر غير صحيح', 'VALIDATION');
      const dueDate = dateStr(ctx.body.dueDate, 'تاريخ الاستحقاق') || `${month}-05`;
      const groupIds = Array.isArray(ctx.body.groupIds) && ctx.body.groupIds.length ? ctx.body.groupIds : null;
      return ctx.mutate((state) => {
        const groups = state.groups.filter(
          (g) => g.status === 'active' && (!groupIds || groupIds.includes(g.id)),
        );
        if (!groups.length) throw fail(422, 'مفيش مجموعات نشطة مختارة', 'VALIDATION');
        let created = 0;
        let skipped = 0;
        let total = 0;
        for (const group of groups) {
          const amount =
            ctx.body.amount !== undefined && ctx.body.amount !== ''
              ? num(ctx.body.amount, { min: 1, max: 1000000, field: 'المبلغ' })
              : Number(group.price || 0);
          if (!amount) {
            skipped += 1;
            continue;
          }
          for (const enrollment of domain.activeEnrollments(state, group.id)) {
            const exists = state.charges.some(
              (c) =>
                c.studentId === enrollment.studentId &&
                c.groupId === group.id &&
                c.month === month &&
                c.type === 'subscription',
            );
            if (exists) {
              skipped += 1;
              continue;
            }
            state.charges.push({
              id: id('chg'),
              studentId: enrollment.studentId,
              groupId: group.id,
              title: `اشتراك ${group.subject} — ${month}`,
              amount: domain.round2(amount),
              month,
              dueDate,
              type: 'subscription',
              note: '',
              createdAt: nowISO(),
              createdBy: ctx.user.id,
            });
            created += 1;
            total += amount;
          }
        }
        log(state, ctx.user, 'charge.bulk', 'charge', null, `توليد ${created} اشتراك لشهر ${month}`);
        return { created, skipped, total: domain.round2(total) };
      });
    },
  },
  {
    method: 'GET',
    path: '/api/payments',
    handler: (ctx) => {
      const { state, query } = ctx;
      let items = state.payments.map((p) => {
        const student = domain.byId(state.students, p.studentId) || {};
        return {
          ...p,
          studentName: student.name || '',
          studentShort: student.shortName || '',
          parentPhone: student.parentPhone || student.phone || '',
          avatarColor: student.avatarColor,
        };
      });
      if (query.studentId) items = items.filter((p) => p.studentId === query.studentId);
      if (query.method) items = items.filter((p) => p.method === query.method);
      if (query.from) items = items.filter((p) => p.date >= query.from);
      if (query.to) items = items.filter((p) => p.date <= query.to);
      const needle = searchText(query.search);
      if (needle) {
        items = items.filter((p) =>
          [p.studentName, p.receiptNo, p.note, p.amount].some((v) => matches(v, needle)),
        );
      }
      items.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)));
      const byMethod = {};
      for (const item of items) {
        byMethod[item.method] = domain.round2((byMethod[item.method] || 0) + Number(item.amount || 0));
      }
      return {
        items: items.slice(0, Math.min(500, Number(query.limit) || 300)),
        total: items.length,
        summary: { amount: domain.round2(items.reduce((t, p) => t + Number(p.amount || 0), 0)), count: items.length, byMethod },
        methods: METHODS,
      };
    },
  },
  {
    method: 'POST',
    path: '/api/payments',
    handler: (ctx) => {
      const student = findStudent(ctx.state, ctx.body.studentId);
      const amount = num(ctx.body.amount, { required: true, min: 0.5, max: 1000000, field: 'المبلغ' });
      const method = oneOf(ctx.body.method, METHODS, 'طريقة الدفع', 'cash');
      const date = dateStr(ctx.body.date, 'التاريخ') || todayISO();
      const note = str(ctx.body.note, { max: 400, field: 'ملاحظة' });
      return ctx.mutate((state) => {
        const payment = {
          id: id('pay'),
          studentId: student.id,
          amount: domain.round2(amount),
          method,
          date,
          note,
          receiptNo: nextReceiptNo(state),
          createdBy: ctx.user.id,
          createdAt: nowISO(),
        };
        state.payments.push(payment);
        log(state, ctx.user, 'payment.create', 'payment', payment.id, `دفعة ${payment.amount} من ${student.name}`);
        const balances = domain.balanceMap(state);
        return {
          payment: { ...payment, studentName: student.name, studentShort: student.shortName },
          balance: domain.round2((balances.get(student.id) || {}).balance || 0),
        };
      });
    },
  },
  {
    method: 'PATCH',
    path: '/api/payments/:id',
    handler: (ctx) => {
      const payment = findPayment(ctx.state, ctx.params.id);
      return ctx.mutate((state) => {
        const target = findPayment(state, payment.id);
        if (ctx.body.amount !== undefined) {
          target.amount = num(ctx.body.amount, { required: true, min: 0.5, max: 1000000, field: 'المبلغ' });
        }
        if (ctx.body.method !== undefined) target.method = oneOf(ctx.body.method, METHODS, 'طريقة الدفع');
        if (ctx.body.date !== undefined) target.date = dateStr(ctx.body.date, 'التاريخ', { required: true });
        if (ctx.body.note !== undefined) target.note = str(ctx.body.note, { max: 400, field: 'ملاحظة' });
        target.updatedAt = nowISO();
        log(state, ctx.user, 'payment.update', 'payment', target.id, `تعديل دفعة ${target.receiptNo}`);
        return { payment: target };
      });
    },
  },
  {
    method: 'DELETE',
    path: '/api/payments/:id',
    adminOnly: true,
    handler: (ctx) => {
      const payment = findPayment(ctx.state, ctx.params.id);
      ensureAdmin(ctx.user);
      return ctx.mutate((state) => {
        state.payments = state.payments.filter((p) => p.id !== payment.id);
        log(state, ctx.user, 'payment.delete', 'payment', payment.id, `حذف دفعة ${payment.receiptNo}`);
        return { ok: true };
      });
    },
  },
  {
    method: 'GET',
    path: '/api/payments/:id/receipt',
    handler: (ctx) => {
      const payment = findPayment(ctx.state, ctx.params.id);
      const student = domain.byId(ctx.state.students, payment.studentId) || {};
      const balances = domain.balanceMap(ctx.state);
      return {
        payment: { ...payment, studentName: student.name, studentShort: student.shortName },
        student,
        balance: domain.round2((balances.get(student.id) || {}).balance || 0),
        settings: ctx.state.settings,
      };
    },
  },
  {
    method: 'GET',
    path: '/api/expenses',
    handler: (ctx) => {
      const { state, query } = ctx;
      let items = [...state.expenses];
      if (query.from) items = items.filter((e) => e.date >= query.from);
      if (query.to) items = items.filter((e) => e.date <= query.to);
      if (query.category) items = items.filter((e) => e.category === query.category);
      const needle = searchText(query.search);
      if (needle) items = items.filter((e) => matches(`${e.title} ${e.note}`, needle));
      items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      const byCategory = {};
      for (const item of items) {
        byCategory[item.category] = domain.round2((byCategory[item.category] || 0) + Number(item.amount || 0));
      }
      return {
        items,
        total: items.length,
        summary: { amount: domain.round2(items.reduce((t, e) => t + Number(e.amount || 0), 0)), byCategory },
        categories: EXPENSE_CATEGORIES,
      };
    },
  },
  {
    method: 'POST',
    path: '/api/expenses',
    handler: (ctx) => {
      const title = str(ctx.body.title, { required: true, field: 'البيان', min: 2, max: 120 });
      const category = oneOf(ctx.body.category, EXPENSE_CATEGORIES, 'النوع', 'other');
      const amount = num(ctx.body.amount, { required: true, min: 0.5, max: 1000000, field: 'المبلغ' });
      const date = dateStr(ctx.body.date, 'التاريخ') || todayISO();
      const note = str(ctx.body.note, { max: 400, field: 'ملاحظة' });
      return ctx.mutate((state) => {
        const expense = {
          id: id('exp'),
          title,
          category,
          amount: domain.round2(amount),
          date,
          note,
          createdBy: ctx.user.id,
          createdAt: nowISO(),
        };
        state.expenses.push(expense);
        log(state, ctx.user, 'expense.create', 'expense', expense.id, `مصروف ${title} — ${amount}`);
        return { expense };
      });
    },
  },
  {
    method: 'PATCH',
    path: '/api/expenses/:id',
    handler: (ctx) => {
      const expense = ctx.state.expenses.find((e) => e.id === ctx.params.id);
      if (!expense) throw fail(404, 'المصروف مش موجود', 'NOT_FOUND');
      return ctx.mutate((state) => {
        const target = state.expenses.find((e) => e.id === expense.id);
        if (ctx.body.title !== undefined) {
          target.title = str(ctx.body.title, { required: true, min: 2, max: 120, field: 'البيان' });
        }
        if (ctx.body.category !== undefined) target.category = oneOf(ctx.body.category, EXPENSE_CATEGORIES, 'النوع');
        if (ctx.body.amount !== undefined) {
          target.amount = num(ctx.body.amount, { required: true, min: 0.5, max: 1000000, field: 'المبلغ' });
        }
        if (ctx.body.date !== undefined) target.date = dateStr(ctx.body.date, 'التاريخ', { required: true });
        if (ctx.body.note !== undefined) target.note = str(ctx.body.note, { max: 400, field: 'ملاحظة' });
        target.updatedAt = nowISO();
        return { expense: target };
      });
    },
  },
  {
    method: 'DELETE',
    path: '/api/expenses/:id',
    adminOnly: true,
    handler: (ctx) => {
      ensureAdmin(ctx.user);
      return ctx.mutate((state) => {
        const before = state.expenses.length;
        state.expenses = state.expenses.filter((e) => e.id !== ctx.params.id);
        if (state.expenses.length === before) throw fail(404, 'المصروف مش موجود', 'NOT_FOUND');
        return { ok: true };
      });
    },
  },
  {
    method: 'GET',
    path: '/api/finance/summary',
    handler: (ctx) => {
      const { from, to } = dateRange(ctx.query, 30);
      const report = domain.reportData(ctx.state, { from, to });
      const balances = domain.balanceMap(ctx.state);
      const dues = [...balances.values()]
        .filter((r) => r.balance > 0)
        .map((row) => {
          const student = domain.byId(ctx.state.students, row.studentId) || {};
          const age = row.oldestDue
            ? Math.floor((Date.now() - new Date(`${row.oldestDue}T00:00:00`).getTime()) / 86400000)
            : 0;
          return {
            ...row,
            studentName: student.name || '',
            studentShort: student.shortName || '',
            phone: student.parentPhone || student.phone || '',
            avatarColor: student.avatarColor,
            ageDays: Math.max(0, age),
            bucket: age <= 0 ? 'current' : age <= 30 ? '30' : age <= 60 ? '60' : '90',
          };
        })
        .sort((a, b) => b.balance - a.balance);
      return {
        range: { from, to },
        totals: {
          ...report.totals,
          outstanding: domain.round2(dues.reduce((t, d) => t + d.balance, 0)),
          debtors: dues.length,
        },
        methods: report.methods,
        categories: report.categories,
        byMonth: report.byMonth,
        dues,
        recentPayments: report.payments.slice(0, 8),
        expenses: report.expenses.slice(0, 8),
      };
    },
  },
];
