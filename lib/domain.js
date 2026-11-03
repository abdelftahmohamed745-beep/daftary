'use strict';

const {
  todayISO,
  addDays,
  startOfWeek,
  timeToMinutes,
  monthKey,
  sum,
} = require('./utils');

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const DAY_NAMES = ['الأحد', 'الاتنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTH_NAMES = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

const byId = (list, id) => list.find((item) => item.id === id);
const activeEnrollments = (state, groupId) =>
  state.enrollments.filter((e) => e.groupId === groupId && e.active !== false);
const groupStudents = (state, groupId) =>
  activeEnrollments(state, groupId)
    .map((e) => byId(state.students, e.studentId))
    .filter(Boolean);
const studentGroups = (state, studentId) =>
  state.enrollments
    .filter((e) => e.studentId === studentId && e.active !== false)
    .map((e) => byId(state.groups, e.groupId))
    .filter(Boolean);

function balanceMap(state) {
  const map = new Map();
  for (const student of state.students) {
    map.set(student.id, {
      studentId: student.id,
      charged: round2(Number(student.balanceStart) || 0),
      paid: 0,
      balance: 0,
      lastPaymentAt: null,
      oldestDue: null,
    });
  }
  for (const charge of state.charges) {
    const row = map.get(charge.studentId);
    if (!row) continue;
    row.charged = round2(row.charged + Number(charge.amount || 0));
    if (charge.dueDate && (!row.oldestDue || charge.dueDate < row.oldestDue)) row.oldestDue = charge.dueDate;
  }
  for (const payment of state.payments) {
    const row = map.get(payment.studentId);
    if (!row) continue;
    row.paid = round2(row.paid + Number(payment.amount || 0));
    if (!row.lastPaymentAt || payment.date > row.lastPaymentAt) row.lastPaymentAt = payment.date;
  }
  for (const row of map.values()) {
    row.balance = round2(row.charged - row.paid);
  }
  return map;
}

function studentBalance(state, studentId, map) {
  const row = (map || balanceMap(state)).get(studentId);
  return row ? row.balance : 0;
}

function attendanceMap(state, filter = {}) {
  const lessons = new Map(state.lessons.map((l) => [l.id, l]));
  const stats = new Map();
  for (const record of state.attendance) {
    const lesson = lessons.get(record.lessonId);
    if (!lesson) continue;
    if (filter.from && lesson.date < filter.from) continue;
    if (filter.to && lesson.date > filter.to) continue;
    if (filter.groupId && lesson.groupId !== filter.groupId) continue;
    if (filter.studentId && record.studentId !== filter.studentId) continue;
    const row = stats.get(record.studentId) || {
      studentId: record.studentId,
      total: 0,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
    };
    row.total += 1;
    if (row[record.status] !== undefined) row[record.status] += 1;
    stats.set(record.studentId, row);
  }
  for (const row of stats.values()) {
    row.rate = row.total ? round2(((row.present + row.late) / row.total) * 100) : 0;
  }
  return stats;
}

function groupAttendance(state, groupId, range = {}) {
  const stats = attendanceMap(state, { groupId, ...range });
  let total = 0;
  let attended = 0;
  for (const row of stats.values()) {
    total += row.total;
    attended += row.present + row.late;
  }
  return { total, attended, rate: total ? round2((attended / total) * 100) : 0, byStudent: stats };
}

function lessonStudents(state, lesson) {
  const roster = groupStudents(state, lesson.groupId);
  const records = state.attendance.filter((a) => a.lessonId === lesson.id);
  return roster.map((student) => {
    const record = records.find((r) => r.studentId === student.id);
    return {
      id: student.id,
      name: student.name,
      shortName: student.shortName,
      phone: student.phone,
      parentPhone: student.parentPhone,
      avatarColor: student.avatarColor,
      status: record ? record.status : 'unmarked',
      note: record ? record.note || '' : '',
    };
  });
}

function nextLessonForGroup(state, groupId) {
  const today = todayISO();
  return state.lessons
    .filter((l) => l.groupId === groupId && l.date >= today && l.status !== 'cancelled')
    .sort((a, b) => (a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date)))[0];
}

function groupCard(state, group, balances) {
  const roster = groupStudents(state, group.id);
  const stats = groupAttendance(state, group.id, {
    from: todayISO(addDays(new Date(), -45)),
    to: todayISO(),
  });
  const finances = roster.reduce(
    (acc, student) => {
      const row = balances.get(student.id);
      if (!row) return acc;
      acc.charged += row.charged;
      acc.paid += row.paid;
      acc.balance += row.balance;
      return acc;
    },
    { charged: 0, paid: 0, balance: 0 },
  );
  const next = nextLessonForGroup(state, group.id);
  return {
    ...group,
    studentCount: roster.length,
    attendanceRate: stats.rate,
    nextLesson: next || null,
    finances: {
      charged: round2(finances.charged),
      paid: round2(finances.paid),
      balance: round2(finances.balance),
    },
  };
}

function studentCard(state, student, balances) {
  const row = balances.get(student.id) || {};
  const groups = studentGroups(state, student.id);
  const stats = attendanceMap(state, { studentId: student.id });
  const own = stats.get(student.id) || { total: 0, present: 0, absent: 0, late: 0, excused: 0, rate: 0 };
  return {
    ...student,
    groups: groups.map((g) => ({ id: g.id, name: g.name, color: g.color, subject: g.subject })),
    balance: round2(row.balance || 0),
    charged: round2(row.charged || 0),
    paid: round2(row.paid || 0),
    lastPaymentAt: row.lastPaymentAt || null,
    attendanceRate: own.rate,
    attendance: {
      total: own.total,
      present: own.present,
      absent: own.absent,
      late: own.late,
      excused: own.excused,
    },
  };
}

function allocateLedger(state, studentId) {
  const charges = state.charges
    .filter((c) => c.studentId === studentId)
    .sort((a, b) => (a.dueDate || a.createdAt).localeCompare(b.dueDate || b.createdAt));
  const payments = state.payments
    .filter((p) => p.studentId === studentId)
    .sort((a, b) => a.date.localeCompare(b.date));
  let pool = payments.reduce((total, p) => total + Number(p.amount || 0), 0);
  const ledger = charges.map((charge) => {
    const amount = Number(charge.amount || 0);
    const paid = Math.min(pool, amount);
    pool = round2(pool - paid);
    return {
      ...charge,
      paidAmount: round2(paid),
      remaining: round2(amount - paid),
      settled: paid >= amount - 0.005,
    };
  });
  return { ledger, credit: round2(Math.max(0, pool)) };
}

function chargeStatusMap(state) {
  const map = new Map();
  for (const student of state.students) {
    const { ledger } = allocateLedger(state, student.id);
    for (const charge of ledger) map.set(charge.id, charge);
  }
  return map;
}

function openAssignments(state, groupIds) {
  return state.assignments
    .filter((a) => groupIds.includes(a.groupId))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function studentProfile(state, student) {
  const balances = balanceMap(state);
  const card = studentCard(state, student, balances);
  const groups = studentGroups(state, student.id);
  const { ledger, credit } = allocateLedger(state, student.id);
  const lessons = new Map(state.lessons.map((l) => [l.id, l]));
  const attendance = state.attendance
    .filter((a) => a.studentId === student.id)
    .map((a) => {
      const lesson = lessons.get(a.lessonId);
      const group = lesson ? byId(state.groups, lesson.groupId) : null;
      return {
        ...a,
        date: lesson ? lesson.date : null,
        topic: lesson ? lesson.topic : '',
        groupName: group ? group.name : '',
        groupColor: group ? group.color : '#2f6f5e',
      };
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const grades = state.grades
    .filter((g) => g.studentId === student.id)
    .map((g) => {
      const assignment = byId(state.assignments, g.assignmentId);
      const group = assignment ? byId(state.groups, assignment.groupId) : null;
      return {
        ...g,
        title: assignment ? assignment.title : '',
        type: assignment ? assignment.type : '',
        maxScore: assignment ? assignment.maxScore : 0,
        dueDate: assignment ? assignment.dueDate : null,
        groupName: group ? group.name : '',
        percent:
          assignment && assignment.maxScore
            ? round2((Number(g.score) / Number(assignment.maxScore)) * 100)
            : 0,
      };
    })
    .sort((a, b) => String(b.gradedAt).localeCompare(String(a.gradedAt)));
  const notes = state.notes
    .filter((n) => n.studentId === student.id)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.createdAt).localeCompare(String(a.createdAt)));
  const payments = state.payments
    .filter((p) => p.studentId === student.id)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const upcoming = state.lessons
    .filter(
      (l) =>
        groups.some((g) => g.id === l.groupId) &&
        l.date >= todayISO() &&
        l.status !== 'cancelled',
    )
    .sort((a, b) => (a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date)))
    .slice(0, 8)
    .map((l) => ({ ...l, groupName: (byId(state.groups, l.groupId) || {}).name || '' }));

  return {
    ...card,
    credit,
    groups: groups.map((g) => ({
      ...g,
      balance: round2((balances.get(student.id) || {}).balance || 0),
      studentCount: groupStudents(state, g.id).length,
    })),
    ledger,
    payments,
    attendance,
    grades,
    notes,
    assignments: openAssignments(state, groups.map((g) => g.id)),
    upcoming,
  };
}

function groupProfile(state, group) {
  const balances = balanceMap(state);
  const card = groupCard(state, group, balances);
  const stats = groupAttendance(state, group.id);
  const roster = groupStudents(state, group.id).map((student) => {
    const row = balances.get(student.id) || {};
    const own = stats.byStudent.get(student.id) || { rate: 0, total: 0, present: 0, absent: 0, late: 0, excused: 0 };
    return {
      ...student,
      balance: round2(row.balance || 0),
      attendanceRate: own.rate,
      attendance: { total: own.total, present: own.present, absent: own.absent, late: own.late, excused: own.excused },
    };
  });
  const lessons = state.lessons
    .filter((l) => l.groupId === group.id)
    .sort((a, b) => (a.date === b.date ? b.start.localeCompare(a.start) : b.date.localeCompare(a.date)));
  const assignments = state.assignments
    .filter((a) => a.groupId === group.id)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map((assignment) => {
      const grades = state.grades.filter((g) => g.assignmentId === assignment.id);
      return {
        ...assignment,
        gradedCount: grades.length,
        average: grades.length
          ? round2(grades.reduce((t, g) => t + Number(g.score || 0), 0) / grades.length)
          : 0,
      };
    });
  const materials = state.materials
    .filter((m) => m.groupId === group.id)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return {
    ...card,
    roster,
    lessons,
    assignments,
    materials,
    attendance: { total: stats.total, attended: stats.attended, rate: stats.rate },
  };
}

function attendanceTrend(state, weeks = 8) {
  const out = [];
  const thisWeek = startOfWeek(new Date(), state.settings.weekStart);
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const from = todayISO(addDays(thisWeek, -7 * i));
    const to = todayISO(addDays(thisWeek, -7 * i + 6));
    let total = 0;
    let attended = 0;
    const lessonMap = new Map(state.lessons.map((l) => [l.id, l]));
    for (const record of state.attendance) {
      const lesson = lessonMap.get(record.lessonId);
      if (!lesson || lesson.date < from || lesson.date > to) continue;
      total += 1;
      if (record.status === 'present' || record.status === 'late') attended += 1;
    }
    out.push({ from, to, total, rate: total ? round2((attended / total) * 100) : 0 });
  }
  return out;
}

function incomeTrend(state, months = 6) {
  const now = new Date();
  const out = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    const income = state.payments
      .filter((p) => String(p.date).startsWith(key))
      .reduce((t, p) => t + Number(p.amount || 0), 0);
    const expenses = state.expenses
      .filter((e) => String(e.date).startsWith(key))
      .reduce((t, e) => t + Number(e.amount || 0), 0);
    out.push({
      key,
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
      income: round2(income),
      expenses: round2(expenses),
      net: round2(income - expenses),
    });
  }
  return out;
}

function alerts(state) {
  const balances = balanceMap(state);
  const out = [];
  const today = todayISO();

  const debtors = state.students
    .map((s) => ({ student: s, row: balances.get(s.id) }))
    .filter(({ row }) => row && row.balance > 0 && row.oldestDue && row.oldestDue < today)
    .sort((a, b) => b.row.balance - a.row.balance);
  for (const { student, row } of debtors.slice(0, 4)) {
    out.push({
      id: `debt-${student.id}`,
      type: 'danger',
      icon: 'wallet',
      title: `${student.shortName} عليه ${row.balance} ${state.settings.currency}`,
      detail: `أقدم مستحق من ${row.oldestDue}`,
      href: `#/students/${student.id}`,
    });
  }

  const monthAgo = todayISO(addDays(new Date(), -30));
  const stats = attendanceMap(state, { from: monthAgo, to: today });
  const low = state.students
    .filter((s) => s.status === 'active')
    .map((s) => ({ student: s, row: stats.get(s.id) }))
    .filter(({ row }) => row && row.total >= 3 && row.rate < 70)
    .sort((a, b) => a.row.rate - b.row.rate);
  for (const { student, row } of low.slice(0, 3)) {
    out.push({
      id: `att-${student.id}`,
      type: 'warning',
      icon: 'user',
      title: `${student.shortName} حضوره ${row.rate}%`,
      detail: `غاب ${row.absent} مرات من ${row.total} حصة آخر شهر`,
      href: `#/students/${student.id}`,
    });
  }

  for (const group of state.groups.filter((g) => g.status === 'active')) {
    const count = groupStudents(state, group.id).length;
    if (group.capacity && count / group.capacity >= 0.9) {
      out.push({
        id: `cap-${group.id}`,
        type: 'info',
        icon: 'users',
        title: `${group.name} قربت تمتلي`,
        detail: `${count} من ${group.capacity} طالب`,
        href: `#/groups/${group.id}`,
      });
    }
  }

  const unpaidGroups = state.groups.filter((g) => {
    const roster = groupStudents(state, g.id);
    return roster.some((s) => (balances.get(s.id) || {}).balance > 0);
  });
  if (unpaidGroups.length) {
    out.push({
      id: 'dues-open',
      type: 'info',
      icon: 'receipt',
      title: `${debtors.length} طالب عليهم متأخرات`,
      detail: `إجمالي ${round2(debtors.reduce((t, d) => t + d.row.balance, 0))} ${state.settings.currency} محتاجة متابعة`,
      href: '#/finance',
    });
  }
  return out.slice(0, 8);
}

function dashboard(state) {
  const balances = balanceMap(state);
  const today = todayISO();
  const thisWeek = startOfWeek(new Date(), state.settings.weekStart);
  const weekStart = todayISO(thisWeek);
  const weekEnd = todayISO(addDays(thisWeek, 6));
  const month = monthKey();
  const lessonsToday = state.lessons
    .filter((l) => l.date === today && l.status !== 'cancelled')
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((l) => {
      const group = byId(state.groups, l.groupId) || {};
      const marked = state.attendance.filter((a) => a.lessonId === l.id).length;
      return {
        ...l,
        groupName: group.name || '',
        groupColor: group.color || '#2f6f5e',
        studentCount: groupStudents(state, l.groupId).length,
        marked,
      };
    });
  const weekLessons = state.lessons.filter(
    (l) => l.date >= weekStart && l.date <= weekEnd && l.status !== 'cancelled',
  );
  const monthStats = attendanceMap(state, {
    from: todayISO(addDays(new Date(), -30)),
    to: today,
  });
  let total = 0;
  let attended = 0;
  for (const row of monthStats.values()) {
    total += row.total;
    attended += row.present + row.late;
  }
  const monthIncome = round2(
    sum(
      state.payments.filter((p) => String(p.date).startsWith(month)),
      (p) => p.amount,
    ),
  );
  const monthExpenses = round2(
    sum(
      state.expenses.filter((e) => String(e.date).startsWith(month)),
      (e) => e.amount,
    ),
  );
  let charged = 0;
  let paid = 0;
  let outstanding = 0;
  for (const row of balances.values()) {
    charged += row.charged;
    paid += row.paid;
    if (row.balance > 0) outstanding += row.balance;
  }
  const recentPayments = [...state.payments]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 6)
    .map((p) => {
      const student = byId(state.students, p.studentId) || {};
      return { ...p, studentName: student.shortName || student.name || '', avatarColor: student.avatarColor };
    });
  const debtors = state.students
    .map((s) => ({ student: s, row: balances.get(s.id) }))
    .filter(({ row }) => row && row.balance > 0)
    .sort((a, b) => b.row.balance - a.row.balance)
    .slice(0, 6)
    .map(({ student, row }) => ({
      id: student.id,
      name: student.shortName,
      fullName: student.name,
      phone: student.parentPhone || student.phone,
      avatarColor: student.avatarColor,
      balance: round2(row.balance),
      oldestDue: row.oldestDue,
    }));

  const upcomingExams = state.exams
    .filter((exam) => exam.date >= today && exam.status !== 'graded' && exam.status !== 'closed')
    .sort((a, b) => (a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date)));
  const treasuryBalance = round2(
    state.treasury.reduce(
      (total, entry) => total + (entry.type === 'withdraw' ? -1 : 1) * Number(entry.amount || 0),
      0,
    ),
  );
  const nextExam = upcomingExams[0]
    ? {
        ...upcomingExams[0],
        groupName: (byId(state.groups, upcomingExams[0].groupId) || {}).name || '',
      }
    : null;
  const topPoints = [...state.students]
    .map((student) => ({
      id: student.id,
      name: student.shortName || student.name,
      avatarColor: student.avatarColor,
      points: state.points
        .filter((entry) => entry.studentId === student.id)
        .reduce((total, entry) => total + Number(entry.points || 0), 0),
    }))
    .sort((a, b) => b.points - a.points)[0] || null;
  const platform = state.settings.platform || {};
  const platformDays = platform.expiresAt
    ? Math.ceil(
        (new Date(`${platform.expiresAt}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000,
      )
    : null;

  return {
    today,
    week: { from: weekStart, to: weekEnd },
    kpis: {
      activeStudents: state.students.filter((s) => s.status === 'active').length,
      pausedStudents: state.students.filter((s) => s.status !== 'active').length,
      activeGroups: state.groups.filter((g) => g.status === 'active').length,
      lessonsToday: lessonsToday.length,
      lessonsWeek: weekLessons.length,
      monthIncome,
      monthExpenses,
      monthNet: round2(monthIncome - monthExpenses),
      outstanding: round2(outstanding),
      charged: round2(charged),
      paid: round2(paid),
      attendanceRate: total ? round2((attended / total) * 100) : 0,
      attendanceTotal: total,
      newStudents: state.students.filter((s) => String(s.joinedAt || '').startsWith(month)).length,
      receiptsMonth: state.payments.filter((p) => String(p.date).startsWith(month)).length,
      examsUpcoming: upcomingExams.length,
      examsPending: state.exams.filter((e) => e.status === 'open').length,
      certificatesActive: state.certificates.filter((c) => c.status === 'active').length,
      pointsTotal: state.points.reduce((t, p) => t + Number(p.points || 0), 0),
      treasuryBalance,
      platformDays,
    },
    nextExam,
    topPoints,
    lessonsToday,
    upcoming: state.lessons
      .filter((l) => l.date > today && l.status !== 'cancelled')
      .sort((a, b) => (a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date)))
      .slice(0, 6)
      .map((l) => {
        const group = byId(state.groups, l.groupId) || {};
        return { ...l, groupName: group.name || '', groupColor: group.color };
      }),
    recentPayments,
    debtors,
    alerts: alerts(state),
    attendanceTrend: attendanceTrend(state, 8),
    incomeTrend: incomeTrend(state, 6),
    activity: [...state.activities]
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, 8),
    groups: state.groups
      .filter((g) => g.status === 'active')
      .map((g) => groupCard(state, g, balances))
      .sort((a, b) => (a.nextLesson?.date || '9999').localeCompare(b.nextLesson?.date || '9999')),
  };
}

function reportData(state, { from, to }) {
  const payments = state.payments
    .filter((p) => p.date >= from && p.date <= to)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const expenses = state.expenses
    .filter((e) => e.date >= from && e.date <= to)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const lessons = state.lessons
    .filter((l) => l.date >= from && l.date <= to)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const income = round2(sum(payments, (p) => p.amount));
  const spending = round2(sum(expenses, (e) => e.amount));
  const methods = {};
  for (const payment of payments) {
    methods[payment.method] = round2((methods[payment.method] || 0) + Number(payment.amount || 0));
  }
  const categories = {};
  for (const expense of expenses) {
    categories[expense.category] = round2((categories[expense.category] || 0) + Number(expense.amount || 0));
  }
  const byMonth = {};
  for (const payment of payments) {
    const key = String(payment.date).slice(0, 7);
    byMonth[key] = byMonth[key] || { key, income: 0, expenses: 0 };
    byMonth[key].income = round2(byMonth[key].income + Number(payment.amount || 0));
  }
  for (const expense of expenses) {
    const key = String(expense.date).slice(0, 7);
    byMonth[key] = byMonth[key] || { key, income: 0, expenses: 0 };
    byMonth[key].expenses = round2(byMonth[key].expenses + Number(expense.amount || 0));
  }
  const attendance = groupStatsForRange(state, from, to);
  const balances = balanceMap(state);
  const students = state.students
    .filter((s) => s.status === 'active')
    .map((student) => {
      const att = attendance.byStudent.get(student.id) || { total: 0, rate: 0, present: 0, absent: 0 };
      const groupIds = studentGroups(state, student.id).map((g) => g.id);
      const grades = state.grades.filter((g) => g.studentId === student.id);
      const graded = grades.filter((g) => {
        const assignment = byId(state.assignments, g.assignmentId);
        return assignment && assignment.dueDate >= from && assignment.dueDate <= to;
      });
      const average = graded.length
        ? round2(
            graded.reduce((total, g) => {
              const assignment = byId(state.assignments, g.assignmentId);
              return total + (Number(g.score) / Number(assignment.maxScore || 1)) * 100;
            }, 0) / graded.length,
          )
        : 0;
      const row = balances.get(student.id) || {};
      return {
        id: student.id,
        name: student.name,
        shortName: student.shortName,
        phone: student.phone,
        parentPhone: student.parentPhone,
        grade: student.grade,
        groups: groupIds.map((id) => (byId(state.groups, id) || {}).name).filter(Boolean),
        attendance: att,
        average,
        gradesCount: graded.length,
        balance: round2(row.balance || 0),
      };
    })
    .sort((a, b) => b.attendance.rate - a.attendance.rate);

  const paymentsByStudent = new Map();
  for (const payment of payments) {
    paymentsByStudent.set(
      payment.studentId,
      round2((paymentsByStudent.get(payment.studentId) || 0) + Number(payment.amount || 0)),
    );
  }

  return {
    range: { from, to },
    totals: {
      income,
      expenses: spending,
      net: round2(income - spending),
      payments: payments.length,
      expenseCount: expenses.length,
      lessons: lessons.length,
      doneLessons: lessons.filter((l) => l.status === 'done').length,
      attendanceRate: attendance.rate,
      attendanceTotal: attendance.total,
      newStudents: state.students.filter((s) => s.joinedAt >= from && s.joinedAt <= to).length,
      averagePayment: payments.length ? round2(income / payments.length) : 0,
    },
    methods,
    categories,
    byMonth: Object.values(byMonth).sort((a, b) => a.key.localeCompare(b.key)),
    payments: payments.map((p) => {
      const student = byId(state.students, p.studentId) || {};
      return { ...p, studentName: student.name || '', studentShort: student.shortName || '' };
    }),
    expenses,
    attendance: {
      rate: attendance.rate,
      total: attendance.total,
      byGroup: attendance.byGroup,
      byStudent: students.map((s) => ({
        id: s.id,
        name: s.name,
        rate: s.attendance.rate,
        total: s.attendance.total,
        absent: s.attendance.absent,
      })),
      trend: attendanceTrend(state, 8),
    },
    students,
    balances: [...balances.values()],
    paymentsByStudent,
    dues: [...balances.values()].filter((r) => r.balance > 0).sort((a, b) => b.balance - a.balance),
  };
}

function groupStatsForRange(state, from, to) {
  const lessonMap = new Map(state.lessons.map((l) => [l.id, l]));
  const byGroup = new Map();
  const byStudent = new Map();
  let total = 0;
  let attended = 0;
  for (const record of state.attendance) {
    const lesson = lessonMap.get(record.lessonId);
    if (!lesson || lesson.date < from || lesson.date > to) continue;
    const group = byId(state.groups, lesson.groupId);
    const groupRow = byGroup.get(lesson.groupId) || {
      id: lesson.groupId,
      name: group ? group.name : '',
      color: group ? group.color : '',
      total: 0,
      attended: 0,
      rate: 0,
    };
    const studentRow = byStudent.get(record.studentId) || {
      total: 0,
      attended: 0,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      rate: 0,
    };
    const ok = record.status === 'present' || record.status === 'late';
    groupRow.total += 1;
    studentRow.total += 1;
    if (studentRow[record.status] !== undefined) studentRow[record.status] += 1;
    if (ok) {
      groupRow.attended += 1;
      studentRow.attended += 1;
      attended += 1;
    }
    total += 1;
    byGroup.set(lesson.groupId, groupRow);
    byStudent.set(record.studentId, studentRow);
  }
  for (const row of byGroup.values()) row.rate = row.total ? round2((row.attended / row.total) * 100) : 0;
  for (const row of byStudent.values()) row.rate = row.total ? round2((row.attended / row.total) * 100) : 0;
  return {
    total,
    attended,
    rate: total ? round2((attended / total) * 100) : 0,
    byGroup: [...byGroup.values()].sort((a, b) => b.total - a.total),
    byStudent,
  };
}

function renderTemplate(template, vars) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) =>
    vars[key] === undefined || vars[key] === null ? '' : String(vars[key]),
  );
}

function reminderFor(state, student, kind = 'payment') {
  const balances = balanceMap(state);
  const row = balances.get(student.id) || {};
  const groups = studentGroups(state, student.id);
  const next = state.lessons
    .filter((l) => groups.some((g) => g.id === l.groupId) && l.date >= todayISO())
    .sort((a, b) => (a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date)))[0];
  const group = next ? byId(state.groups, next.groupId) : groups[0];
  const vars = {
    parent: student.parentName || 'ولي الأمر',
    student: student.shortName || student.name,
    teacher: state.settings.teacherName,
    center: state.settings.centerName,
    date: next ? formatArabicDate(next.date) : '',
    time: next ? formatTime(next.start) : '',
    amount: round2(row.balance || 0),
    currency: state.settings.currency,
    phone: state.settings.phone,
    subject: group ? group.subject : '',
  };
  const template =
    kind === 'lesson' ? state.settings.reminderTemplate : state.settings.paymentTemplate;
  const message = renderTemplate(template, vars);
  return {
    kind,
    message,
    whatsapp: `https://wa.me/${String(student.parentPhone || student.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(message)}`,
    balance: round2(row.balance || 0),
  };
}

function formatArabicDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

function formatTime(time) {
  if (!time) return '';
  const [h, m] = String(time).split(':').map(Number);
  const suffix = h >= 12 ? 'م' : 'ص';
  const hour = h % 12 || 12;
  return `${hour}:${String(m || 0).padStart(2, '0')} ${suffix}`;
}

module.exports = {
  DAY_NAMES,
  MONTH_NAMES,
  round2,
  byId,
  balanceMap,
  studentBalance,
  attendanceMap,
  groupAttendance,
  attendanceTrend,
  incomeTrend,
  alerts,
  dashboard,
  studentCard,
  groupCard,
  studentProfile,
  groupProfile,
  lessonStudents,
  groupStudents,
  studentGroups,
  activeEnrollments,
  allocateLedger,
  chargeStatusMap,
  reportData,
  reminderFor,
  renderTemplate,
  formatArabicDate,
  formatTime,
  nextLessonForGroup,
  openAssignments,
  timeToMinutes,
};
