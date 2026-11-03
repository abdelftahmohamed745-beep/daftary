'use strict';

const domain = require('./domain');
const { todayISO, addDays, monthKey, sum } = require('./utils');

const round2 = domain.round2;
const byId = domain.byId;

const PASS_LABELS = {
  draft: 'مسودة',
  open: 'مفتوح للتصحيح',
  graded: 'مصحح',
  closed: 'مغلق',
};

const POINT_CATEGORY_LABELS = {
  attendance: 'حضور',
  grade: 'درجات',
  behavior: 'سلوك',
  competition: 'مسابقة',
  manual: 'يدوي',
};

function studentPointRows(state, filter = {}) {
  const weight = state.settings.points || { present: 5, late: 2, absent: -3, excused: 0, grade: 10 };
  const lessons = new Map(state.lessons.map((l) => [l.id, l]));
  const attendance = new Map();
  for (const record of state.attendance) {
    const lesson = lessons.get(record.lessonId);
    if (!lesson) continue;
    if (filter.from && lesson.date < filter.from) continue;
    if (filter.to && lesson.date > filter.to) continue;
    if (filter.groupId && lesson.groupId !== filter.groupId) continue;
    const row =
      attendance.get(record.studentId) ||
      { points: 0, present: 0, late: 0, absent: 0, excused: 0 };
    const value = Number(weight[record.status] || 0);
    row.points += value;
    if (row[record.status] !== undefined) row[record.status] += 1;
    attendance.set(record.studentId, row);
  }

  const manual = new Map();
  for (const entry of state.points) {
    if (filter.from && String(entry.at || entry.date || '').slice(0, 10) < filter.from) continue;
    if (filter.to && String(entry.at || entry.date || '').slice(0, 10) > filter.to) continue;
    const row = manual.get(entry.studentId) || { points: 0, entries: [] };
    row.points += Number(entry.points || 0);
    row.entries.push(entry);
    manual.set(entry.studentId, row);
  }

  const gradeStats = examAverages(state);

  return state.students.map((student) => {
    const att = attendance.get(student.id) || {
      points: 0,
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
    };
    const man = manual.get(student.id) || { points: 0, entries: [] };
    const grades = gradeStats.get(student.id) || { average: 0, count: 0, percent: 0 };
    const total = Math.round(att.points + man.points);
    return {
      studentId: student.id,
      id: student.id,
      name: student.shortName || student.name,
      fullName: student.name,
      code: student.code,
      avatarColor: student.avatarColor,
      grade: student.grade,
      groupIds: state.enrollments
        .filter((e) => e.studentId === student.id && e.active !== false)
        .map((e) => e.groupId),
      attendancePoints: Math.round(att.points),
      manualPoints: Math.round(man.points),
      total,
      present: att.present,
      late: att.late,
      absent: att.absent,
      excused: att.excused,
      gradeAverage: grades.average,
      gradePercent: grades.percent,
      entries: man.entries
        .slice()
        .sort((a, b) => String(b.at || b.date).localeCompare(String(a.at || a.date))),
    };
  });
}

function leaderboard(state, { limit = 20, groupId = null } = {}) {
  let rows = studentPointRows(state, groupId ? { groupId } : {});
  if (groupId) rows = rows.filter((row) => row.groupIds.includes(groupId));
  const sorted = rows.sort((a, b) => b.total - a.total || b.gradePercent - a.gradePercent);
  return sorted.slice(0, limit).map((row, index) => ({
    ...row,
    rank: index + 1,
    medal: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : null,
  }));
}

function examAverages(state, filter = {}) {
  const map = new Map();
  const exams = new Map(state.exams.map((e) => [e.id, e]));
  for (const result of state.examResults) {
    const exam = exams.get(result.examId);
    if (!exam) continue;
    if (filter.groupId && exam.groupId !== filter.groupId) continue;
    const row = map.get(result.studentId) || { score: 0, max: 0, count: 0 };
    row.score += Number(result.score || 0);
    row.max += Number(exam.maxScore || 0);
    row.count += 1;
    map.set(result.studentId, row);
  }
  for (const [studentId, row] of map.entries()) {
    map.set(studentId, {
      ...row,
      average: row.count ? round2(row.score / row.count) : 0,
      percent: row.max ? round2((row.score / row.max) * 100) : 0,
    });
  }
  return map;
}

function examView(state, exam) {
  const group = byId(state.groups, exam.groupId) || {};
  const results = state.examResults.filter((r) => r.examId === exam.id);
  const roster = domain.groupStudents(state, exam.groupId);
  const scores = results.map((r) => Number(r.score || 0));
  const total = scores.reduce((a, b) => a + b, 0);
  const average = scores.length ? round2(total / scores.length) : 0;
  const passed = scores.filter((score) => score >= (Number(exam.passScore) || 0)).length;
  return {
    ...exam,
    statusLabel: PASS_LABELS[exam.status] || exam.status,
    groupName: group.name || '',
    groupColor: group.color || '#2f6f5e',
    studentCount: roster.length,
    gradedCount: results.length,
    average,
    percent: exam.maxScore ? round2((average / exam.maxScore) * 100) : 0,
    highest: scores.length ? Math.max(...scores) : 0,
    lowest: scores.length ? Math.min(...scores) : 0,
    passCount: passed,
    passRate: scores.length ? round2((passed / scores.length) * 100) : 0,
    pending: Math.max(0, roster.length - results.length),
  };
}

function examResultsView(state, exam) {
  const results = new Map(
    state.examResults.filter((r) => r.examId === exam.id).map((r) => [r.studentId, r]),
  );
  return domain.groupStudents(state, exam.groupId).map((student) => {
    const result = results.get(student.id);
    return {
      studentId: student.id,
      id: student.id,
      name: student.shortName || student.name,
      fullName: student.name,
      code: student.code,
      avatarColor: student.avatarColor,
      score: result ? Number(result.score) : null,
      note: result ? result.note || '' : '',
      graded: Boolean(result),
      passed: result ? Number(result.score) >= (Number(exam.passScore) || 0) : null,
      percent: result && exam.maxScore ? round2((Number(result.score) / exam.maxScore) * 100) : 0,
    };
  });
}

function absenceArchive(state, { from = null, to = null, groupId = null, studentId = null } = {}) {
  const lessons = new Map(state.lessons.map((l) => [l.id, l]));
  const rows = [];
  for (const record of state.attendance) {
    if (record.status !== 'absent' && record.status !== 'late') continue;
    const lesson = lessons.get(record.lessonId);
    if (!lesson) continue;
    if (from && lesson.date < from) continue;
    if (to && lesson.date > to) continue;
    if (groupId && lesson.groupId !== groupId) continue;
    if (studentId && record.studentId !== studentId) continue;
    const student = byId(state.students, record.studentId) || {};
    const group = byId(state.groups, lesson.groupId) || {};
    rows.push({
      id: record.id,
      lessonId: lesson.id,
      date: lesson.date,
      start: lesson.start,
      status: record.status,
      note: record.note || '',
      studentId: student.id,
      studentName: student.name || '',
      studentShort: student.shortName || '',
      avatarColor: student.avatarColor,
      parentPhone: student.parentPhone || student.phone || '',
      groupId: group.id,
      groupName: group.name || '',
      groupColor: group.color || '#2f6f5e',
      subject: group.subject || '',
    });
  }
  rows.sort((a, b) => (a.date === b.date ? b.start.localeCompare(a.start) : b.date.localeCompare(a.date)));

  const byStudent = new Map();
  for (const row of rows) {
    const entry =
      byStudent.get(row.studentId) ||
      {
        studentId: row.studentId,
        name: row.studentShort || row.studentName,
        fullName: row.studentName,
        avatarColor: row.avatarColor,
        parentPhone: row.parentPhone,
        absent: 0,
        late: 0,
        total: 0,
      };
    entry[row.status] += 1;
    entry.total += 1;
    byStudent.set(row.studentId, entry);
  }

  return {
    from,
    to,
    rows,
    students: [...byStudent.values()].sort((a, b) => b.total - a.total),
    counts: {
      absent: rows.filter((r) => r.status === 'absent').length,
      late: rows.filter((r) => r.status === 'late').length,
      total: rows.length,
    },
  };
}

function certificateView(state, certificate) {
  const student = byId(state.students, certificate.studentId) || {};
  return {
    ...certificate,
    studentName: student.name || '',
    studentShort: student.shortName || '',
    avatarColor: student.avatarColor,
    grade: student.grade,
    groupNames: domain
      .studentGroups(state, certificate.studentId)
      .map((g) => g.name)
      .join('، '),
  };
}

function treasurySummary(state, { from = null, to = null } = {}) {
  const entries = state.treasury
    .filter((entry) => (!from || entry.date >= from) && (!to || entry.date <= to))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const deposits = round2(sum(entries.filter((e) => e.type === 'deposit'), (e) => e.amount));
  const withdrawals = round2(sum(entries.filter((e) => e.type === 'withdraw'), (e) => e.amount));
  const byMethod = {};
  for (const entry of entries) {
    const key = entry.method || 'cash';
    byMethod[key] = round2((byMethod[key] || 0) + (entry.type === 'deposit' ? Number(entry.amount) : -Number(entry.amount)));
  }
  const payments = state.payments.filter((p) => (!from || p.date >= from) && (!to || p.date <= to));
  const collected = round2(sum(payments, (p) => p.amount));
  return {
    entries,
    deposits,
    withdrawals,
    balance: round2(deposits - withdrawals),
    collected,
    byMethod,
    count: entries.length,
  };
}

function platformStatus(state) {
  const platform = state.settings.platform || {};
  const expires = platform.expiresAt || null;
  const today = todayISO();
  const daysLeft = expires
    ? Math.ceil((new Date(`${expires}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000)
    : null;
  return {
    ...platform,
    daysLeft,
    expired: daysLeft !== null && daysLeft < 0,
    expiringSoon: daysLeft !== null && daysLeft >= 0 && daysLeft <= 7,
    active: platform.status === 'active' && !(daysLeft !== null && daysLeft < 0),
  };
}

function analytics(state) {
  const balances = domain.balanceMap(state);
  const month = monthKey();
  const totalCharged = [...balances.values()].reduce((t, r) => t + r.charged, 0);
  const totalPaid = [...balances.values()].reduce((t, r) => t + r.paid, 0);
  const outstanding = [...balances.values()].reduce((t, r) => t + Math.max(0, r.balance), 0);
  const collectionRate = totalCharged ? round2((totalPaid / totalCharged) * 100) : 0;
  const attendance = domain.attendanceMap(state);
  let attendanceTotal = 0;
  let attendancePresent = 0;
  const weakStudents = [];
  for (const [studentId, row] of attendance.entries()) {
    attendanceTotal += row.total;
    attendancePresent += row.present + row.late;
    if (row.total >= 4 && row.rate < 70) {
      const student = byId(state.students, studentId) || {};
      weakStudents.push({
        studentId,
        name: student.shortName || student.name,
        avatarColor: student.avatarColor,
        rate: row.rate,
        absent: row.absent,
      });
    }
  }
  const attendanceRate = attendanceTotal
    ? round2((attendancePresent / attendanceTotal) * 100)
    : 0;

  const groups = state.groups
    .filter((g) => g.status === 'active')
    .map((group) => {
      const roster = domain.groupStudents(state, group.id);
      const groupStats = domain.groupAttendance(state, group.id);
      const exams = state.exams.filter((e) => e.groupId === group.id && e.status === 'graded');
      const examRows = exams.map((exam) => examView(state, exam));
      const avgPercent = examRows.length
        ? round2(examRows.reduce((t, e) => t + e.percent, 0) / examRows.length)
        : 0;
      const financials = roster.reduce(
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
      return {
        id: group.id,
        name: group.name,
        subject: group.subject,
        color: group.color,
        students: roster.length,
        attendanceRate: groupStats.rate,
        examPercent: avgPercent,
        exams: examRows.length,
        charged: round2(financials.charged),
        paid: round2(financials.paid),
        balance: round2(financials.balance),
      };
    })
    .sort((a, b) => b.students - a.students);

  const incomeTrend = domain.incomeTrend(state, 6);
  const attendanceTrend = domain.attendanceTrend(state, 8);
  const examRows = state.exams
    .filter((e) => e.status === 'graded')
    .map((exam) => examView(state, exam))
    .sort((a, b) => b.percent - a.percent);

  const averageExam = examRows.length
    ? round2(examRows.reduce((t, e) => t + e.percent, 0) / examRows.length)
    : 0;

  const insights = [];
  if (collectionRate < 80) {
    insights.push({
      tone: 'warn',
      title: 'نسبة التحصيل أقل من المستهدف',
      body: `نسبة التحصيل ${collectionRate}% — محتاج متابعة المتأخرات (${round2(outstanding)} ج.م).`,
    });
  } else {
    insights.push({
      tone: 'good',
      title: 'التحصيل ماشي كويس',
      body: `نسبة التحصيل ${collectionRate}% — استمر على نفس المعدل.`,
    });
  }
  if (attendanceRate < 85) {
    insights.push({
      tone: 'warn',
      title: 'الغياب محتاج وقفة',
      body: `متوسط الحضور ${attendanceRate}% — في ${weakStudents.length} طالب تحت 70%.`,
    });
  } else {
    insights.push({
      tone: 'good',
      title: 'حضور ممتاز',
      body: `متوسط الحضور ${attendanceRate}% على مستوى المركز.`,
    });
  }
  if (examRows.length) {
    const best = examRows[0];
    const worst = examRows[examRows.length - 1];
    insights.push({
      tone: 'info',
      title: 'أفضل وأضعف امتحان',
      body: `أعلى متوسط: ${best.title} (${best.percent}%) — أقل متوسط: ${worst.title} (${worst.percent}%).`,
    });
  }
  if (weakStudents.length) {
    insights.push({
      tone: 'warn',
      title: 'طلاب محتاجين متابعة',
      body: `${weakStudents
        .slice(0, 4)
        .map((s) => s.name)
        .join('، ')} حضورهم أقل من 70%.`,
    });
  }

  const topStudents = leaderboard(state, { limit: 5 });
  const collectionByMonth = incomeTrend.map((row) => ({
    label: row.label,
    value: row.value,
  }));

  return {
    month,
    kpis: {
      collectionRate,
      attendanceRate,
      averageExam,
      outstanding: round2(outstanding),
      totalCharged: round2(totalCharged),
      totalPaid: round2(totalPaid),
      students: state.students.filter((s) => s.status === 'active').length,
    },
    groups,
    weakStudents: weakStudents.sort((a, b) => a.rate - b.rate).slice(0, 8),
    topStudents,
    examRows: examRows.slice(0, 8),
    incomeTrend,
    attendanceTrend,
    collectionByMonth,
    insights,
  };
}

function portalProfile(state, code) {
  const student = state.students.find(
    (s) => String(s.code).toUpperCase() === String(code || '').trim().toUpperCase(),
  );
  if (!student) return null;
  const attendance = domain.attendanceMap(state, { studentId: student.id }).get(student.id) || {
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    rate: 0,
  };
  const exams = state.exams
    .filter((exam) => state.enrollments.some((e) => e.studentId === student.id && e.groupId === exam.groupId))
    .map((exam) => {
      const result = state.examResults.find((r) => r.examId === exam.id && r.studentId === student.id);
      return {
        id: exam.id,
        title: exam.title,
        date: exam.date,
        maxScore: exam.maxScore,
        score: result ? result.score : null,
        percent: result && exam.maxScore ? round2((result.score / exam.maxScore) * 100) : null,
        graded: Boolean(result),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  const certificates = state.certificates
    .filter((c) => c.studentId === student.id && c.status === 'active')
    .map((c) => certificateView(state, c));
  const balances = domain.balanceMap(state);
  const balance = balances.get(student.id) || { balance: 0 };
  const points = studentPointRows(state).find((row) => row.studentId === student.id);
  const groups = domain.studentGroups(state, student.id);
  return {
    student: {
      id: student.id,
      name: student.name,
      shortName: student.shortName,
      code: student.code,
      grade: student.grade,
      school: student.school,
      avatarColor: student.avatarColor,
      parentName: student.parentName,
    },
    groups,
    attendance,
    exams,
    certificates,
    points: points ? points.total : 0,
    balance: state.settings.portal?.showBalance ? balance.balance : null,
    settings: {
      showExams: state.settings.portal?.showExams !== false,
      showAttendance: state.settings.portal?.showAttendance !== false,
      showCertificates: state.settings.portal?.showCertificates !== false,
      message: state.settings.portalMessage,
      centerName: state.settings.centerName,
      academicYear: state.settings.academicYear,
    },
  };
}

function idCardData(state, student) {
  const groups = domain.studentGroups(state, student.id);
  return {
    id: student.id,
    name: student.name,
    shortName: student.shortName,
    code: student.code,
    grade: student.grade,
    school: student.school,
    phone: student.phone,
    parentPhone: student.parentPhone,
    avatarColor: student.avatarColor,
    groupNames: groups.map((g) => g.name).join('، '),
    centerName: state.settings.centerName,
    academicYear: state.settings.academicYear,
    teacherName: state.settings.teacherName,
    phone2: state.settings.phone,
    barcodePrefix: state.settings.barcodePrefix,
  };
}

module.exports = {
  PASS_LABELS,
  POINT_CATEGORY_LABELS,
  studentPointRows,
  leaderboard,
  examAverages,
  examView,
  examResultsView,
  absenceArchive,
  certificateView,
  treasurySummary,
  platformStatus,
  analytics,
  portalProfile,
  idCardData,
};
