'use strict';

const { todayISO, fail } = require('../lib/utils');
const domain = require('../lib/domain');
const features = require('../lib/features');
const { dateRange, csvResult, toCsv } = require('./_helpers');

const METHOD_LABELS = {
  cash: 'كاش',
  vodafone: 'فودافون كاش',
  instapay: 'إنستاباي',
  bank: 'تحويل بنكي',
  other: 'طريقة تانية',
};
const EXPENSE_LABELS = {
  rent: 'إيجار',
  salaries: 'مرتبات',
  marketing: 'تسويق',
  materials: 'مواد وطباعة',
  transport: 'مواصلات',
  other: 'مصروفات تانية',
};
const ATT_LABELS = { present: 'حاضر', absent: 'غايب', late: 'متأخر', excused: 'بعذر', unmarked: 'لسه' };

module.exports = [
  {
    method: 'GET',
    path: '/api/dashboard',
    handler: (ctx) => domain.dashboard(ctx.state),
  },
  {
    method: 'GET',
    path: '/api/reports',
    handler: (ctx) => {
      const { from, to } = dateRange(ctx.query, 30);
      return domain.reportData(ctx.state, { from, to });
    },
  },
  {
    method: 'GET',
    path: '/api/exports/students.csv',
    handler: (ctx) => {
      const balances = domain.balanceMap(ctx.state);
      const attendance = domain.attendanceMap(ctx.state);
      const rows = ctx.state.students.map((s) => {
        const card = domain.studentCard(ctx.state, s, balances);
        const att = attendance.get(s.id) || { rate: 0, total: 0 };
        return [
          s.name,
          s.phone,
          s.parentName,
          s.parentPhone,
          s.grade,
          card.groups.map((g) => g.name).join(' / '),
          s.status === 'active' ? 'نشط' : s.status === 'paused' ? 'موقوف' : 'منسحب',
          card.balance,
          `${att.rate}%`,
          att.total,
          s.joinedAt,
        ];
      });
      return csvResult(
        toCsv(
          ['الطالب', 'الموبايل', 'ولي الأمر', 'موبايل ولي الأمر', 'الصف', 'المجموعات', 'الحالة', 'الرصيد', 'الحضور', 'عدد الحصص', 'تاريخ الانضمام'],
          rows,
        ),
        'students.csv',
      );
    },
  },
  {
    method: 'GET',
    path: '/api/exports/dues.csv',
    handler: (ctx) => {
      const balances = domain.balanceMap(ctx.state);
      const rows = ctx.state.students
        .map((s) => ({ s, row: balances.get(s.id) }))
        .filter(({ row }) => row && row.balance > 0)
        .sort((a, b) => b.row.balance - a.row.balance)
        .map(({ s, row }) => [
          s.name,
          s.phone,
          s.parentPhone,
          row.charged,
          row.paid,
          row.balance,
          row.oldestDue || '',
          row.lastPaymentAt || '',
        ]);
      return csvResult(
        toCsv(['الطالب', 'الموبايل', 'موبايل ولي الأمر', 'إجمالي المستحق', 'إجمالي المدفوع', 'المتأخر', 'أقدم استحقاق', 'آخر دفعة'], rows),
        'dues.csv',
      );
    },
  },
  {
    method: 'GET',
    path: '/api/exports/payments.csv',
    handler: (ctx) => {
      const { from, to } = dateRange(ctx.query, 365);
      const rows = ctx.state.payments
        .filter((p) => p.date >= from && p.date <= to)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
        .map((p) => {
          const s = domain.byId(ctx.state.students, p.studentId) || {};
          return [p.receiptNo, p.date, s.name || '', p.amount, METHOD_LABELS[p.method] || p.method, p.note || ''];
        });
      return csvResult(toCsv(['رقم الإيصال', 'التاريخ', 'الطالب', 'المبلغ', 'طريقة الدفع', 'ملاحظة'], rows), 'payments.csv');
    },
  },
  {
    method: 'GET',
    path: '/api/exports/charges.csv',
    handler: (ctx) => {
      const statusMap = domain.chargeStatusMap(ctx.state);
      const { from, to } = dateRange(ctx.query, 365);
      const rows = ctx.state.charges
        .filter((c) => c.dueDate >= from && c.dueDate <= to)
        .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
        .map((c) => {
          const s = domain.byId(ctx.state.students, c.studentId) || {};
          const g = c.groupId ? domain.byId(ctx.state.groups, c.groupId) : null;
          const alloc = statusMap.get(c.id);
          return [
            c.dueDate,
            s.name || '',
            g ? g.name : '',
            c.title,
            c.amount,
            alloc ? alloc.paidAmount : 0,
            alloc ? alloc.remaining : c.amount,
            c.month || '',
            c.type,
          ];
        });
      return csvResult(
        toCsv(['الاستحقاق', 'الطالب', 'المجموعة', 'البيان', 'المبلغ', 'مدفوع', 'متبقي', 'الشهر', 'النوع'], rows),
        'charges.csv',
      );
    },
  },
  {
    method: 'GET',
    path: '/api/exports/expenses.csv',
    handler: (ctx) => {
      const { from, to } = dateRange(ctx.query, 365);
      const rows = ctx.state.expenses
        .filter((e) => e.date >= from && e.date <= to)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
        .map((e) => [e.date, e.title, EXPENSE_LABELS[e.category] || e.category, e.amount, e.note || '']);
      return csvResult(toCsv(['التاريخ', 'البيان', 'النوع', 'المبلغ', 'ملاحظة'], rows), 'expenses.csv');
    },
  },
  {
    method: 'GET',
    path: '/api/exports/attendance.csv',
    handler: (ctx) => {
      const { from, to } = dateRange(ctx.query, 30);
      const lessonMap = new Map(ctx.state.lessons.map((l) => [l.id, l]));
      const rows = ctx.state.attendance
        .map((a) => ({ a, lesson: lessonMap.get(a.lessonId) }))
        .filter(({ lesson }) => lesson && lesson.date >= from && lesson.date <= to)
        .filter(({ lesson }) => !ctx.query.groupId || lesson.groupId === ctx.query.groupId)
        .sort((x, y) => String(x.lesson.date).localeCompare(String(y.lesson.date)))
        .map(({ a, lesson }) => {
          const s = domain.byId(ctx.state.students, a.studentId) || {};
          const g = domain.byId(ctx.state.groups, lesson.groupId) || {};
          return [lesson.date, lesson.start, g.name || '', s.name || '', ATT_LABELS[a.status] || a.status, a.note || ''];
        });
      return csvResult(toCsv(['التاريخ', 'الوقت', 'المجموعة', 'الطالب', 'الحضور', 'ملاحظة'], rows), 'attendance.csv');
    },
  },
  {
    method: 'GET',
    path: '/api/exports/report.csv',
    handler: (ctx) => {
      const { from, to } = dateRange(ctx.query, 30);
      const report = domain.reportData(ctx.state, { from, to });
      const lines = [];
      lines.push(['ملخص الفترة', `${from} إلى ${to}`]);
      lines.push(['إجمالي الدخل', report.totals.income]);
      lines.push(['إجمالي المصروفات', report.totals.expenses]);
      lines.push(['الصافي', report.totals.net]);
      lines.push(['عدد الدفعات', report.totals.payments]);
      lines.push(['نسبة الحضور', `${report.totals.attendanceRate}%`]);
      lines.push([]);
      lines.push(['الشهر', 'الدخل', 'المصروفات', 'الصافي']);
      for (const row of report.byMonth) {
        lines.push([row.key, row.income, row.expenses, domain.round2(row.income - row.expenses)]);
      }
      const body = lines.map((row) => row.map((v) => (v === undefined || v === null ? '' : v))).join('\n');
      return csvResult(
        `${body}\n`,
        'report.csv',
      );
    },
  },
  {
    method: 'GET',
    path: '/api/exports/grades.csv',
    handler: (ctx) => {
      const rows = ctx.state.grades.map((g) => {
        const assignment = domain.byId(ctx.state.assignments, g.assignmentId);
        const student = domain.byId(ctx.state.students, g.studentId);
        return [
          assignment ? assignment.title : '',
          student ? student.name : '',
          g.score,
          assignment ? assignment.maxScore : '',
          g.feedback || '',
          g.gradedAt,
        ];
      });
      return csvResult(toCsv(['الواجب', 'الطالب', 'الدرجة', 'من', 'تعليق', 'تاريخ التصحيح'], rows), 'grades.csv');
    },
  },
  {
    method: 'GET',
    path: '/api/calendar',
    handler: (ctx) => {
      const { from, to } = dateRange(ctx.query, 7);
      const items = ctx.state.lessons
        .filter((l) => l.date >= from && l.date <= to)
        .map((l) => {
          const group = domain.byId(ctx.state.groups, l.groupId) || {};
          const marked = ctx.state.attendance.filter((a) => a.lessonId === l.id).length;
          return {
            ...l,
            groupName: group.name || '',
            groupColor: group.color || '#2f6f5e',
            studentCount: domain.groupStudents(ctx.state, l.groupId).length,
            marked,
          };
        })
        .sort((a, b) => (a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date)));
      return { items, total: items.length, range: { from, to } };
    },
  },
  {
    method: 'GET',
    path: '/api/analytics',
    handler: (ctx) => features.analytics(ctx.state),
  },
  {
    method: 'GET',
    path: '/api/absence-archive',
    handler: (ctx) => {
      const { from, to } = dateRange(ctx.query, 60);
      return {
        ...features.absenceArchive(ctx.state, {
          from,
          to,
          groupId: ctx.query.groupId || null,
          studentId: ctx.query.studentId || null,
        }),
        groups: ctx.state.groups
          .filter((g) => g.status === 'active')
          .map((g) => ({ id: g.id, name: g.name, color: g.color })),
      };
    },
  },
  {
    method: 'GET',
    path: '/api/absence-archive/csv',
    handler: (ctx) => {
      const { from, to } = dateRange(ctx.query, 60);
      const data = features.absenceArchive(ctx.state, {
        from,
        to,
        groupId: ctx.query.groupId || null,
        studentId: ctx.query.studentId || null,
      });
      const text = toCsv(
        ['التاريخ', 'الوقت', 'الطالب', 'المجموعة', 'الحالة', 'ملاحظة', 'موبايل ولي الأمر'],
        data.rows.map((r) => [
          r.date,
          r.start,
          r.studentName,
          r.groupName,
          r.status === 'absent' ? 'غايب' : 'متأخر',
          r.note,
          r.parentPhone,
        ]),
      );
      return csvResult(text, `absence-${from}-${to}.csv`);
    },
  },
  {
    method: 'GET',
    path: '/api/id-cards',
    handler: (ctx) => {
      let students = ctx.state.students.filter((s) => s.status === 'active');
      if (ctx.query.groupId) {
        const ids = domain
          .groupStudents(ctx.state, ctx.query.groupId)
          .map((s) => s.id);
        students = students.filter((s) => ids.includes(s.id));
      }
      return {
        items: students.map((s) => features.idCardData(ctx.state, s)),
        settings: {
          centerName: ctx.state.settings.centerName,
          teacherName: ctx.state.settings.teacherName,
          academicYear: ctx.state.settings.academicYear,
          phone: ctx.state.settings.phone,
          barcodePrefix: ctx.state.settings.barcodePrefix,
        },
      };
    },
  },
  {
    method: 'GET',
    path: '/api/id-cards/:studentId',
    handler: (ctx) => {
      const student = domain.byId(ctx.state.students, ctx.params.studentId);
      if (!student) throw fail(404, 'الطالب مش موجود', 'NOT_FOUND');
      return { card: features.idCardData(ctx.state, student) };
    },
  },
];
