'use strict';

const {
  id,
  str,
  num,
  oneOf,
  dateStr,
  timeStr,
  fail,
  todayISO,
  nowISO,
  addDays,
  overlaps,
} = require('../lib/utils');
const domain = require('../lib/domain');
const {
  log,
  findLesson,
  findGroup,
  csvResult,
  toCsv,
} = require('./_helpers');

const STATUSES = ['scheduled', 'done', 'cancelled'];
const ATTENDANCE = ['present', 'absent', 'late', 'excused'];

function conflict(state, { date, start, duration, groupId }, excludeId) {
  return state.lessons.find(
    (l) =>
      l.id !== excludeId &&
      l.date === date &&
      l.status !== 'cancelled' &&
      overlaps(start, duration, l.start, l.duration),
  );
}

function decorate(state, lesson) {
  const group = domain.byId(state.groups, lesson.groupId) || {};
  const students = domain.groupStudents(state, lesson.groupId);
  const records = state.attendance.filter((a) => a.lessonId === lesson.id);
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const record of records) {
    if (counts[record.status] !== undefined) counts[record.status] += 1;
  }
  return {
    ...lesson,
    groupName: group.name || '',
    groupColor: group.color || '#2f6f5e',
    subject: group.subject || '',
    room: group.room || '',
    studentCount: students.length,
    marked: records.length,
    attendance: counts,
  };
}

function validateLesson(body, { partial = false, lesson = null, state } = {}) {
  const data = {};
  const has = (key) => body[key] !== undefined;
  if (!partial || has('groupId')) {
    if (!body.groupId && !lesson) throw fail(422, 'اختار المجموعة', 'VALIDATION', { groupId: 'مطلوب' });
    data.groupId = body.groupId || lesson.groupId;
  }
  const group = state ? findGroup(state, data.groupId || lesson?.groupId) : null;
  if (!partial || has('date')) data.date = dateStr(body.date, 'التاريخ', { required: true });
  if (!partial || has('start')) data.start = timeStr(body.start, 'وقت البداية', { required: true });
  if (!partial || has('duration')) {
    data.duration =
      num(body.duration, { min: 15, max: 300, field: 'المدة' }) || group?.schedule?.[0]?.duration || 90;
  }
  if (!partial || has('topic')) {
    data.topic = str(body.topic, { max: 120, field: 'الموضوع' }) || `حصة ${group ? group.subject : ''}`.trim();
  }
  if (!partial || has('notes')) data.notes = str(body.notes, { max: 1000, field: 'ملاحظات' });
  if (!partial || has('status')) data.status = oneOf(body.status, STATUSES, 'الحالة', lesson?.status || 'scheduled');
  return data;
}

function saveAttendance(state, lesson, records, user) {
  const roster = new Set(domain.groupStudents(state, lesson.groupId).map((s) => s.id));
  const saved = [];
  for (const record of records) {
    if (!record || !record.studentId) continue;
    if (!roster.has(record.studentId)) {
      throw fail(422, 'في طالب مش مسجل في المجموعة دي', 'VALIDATION', { studentId: record.studentId });
    }
    const status = oneOf(record.status, ATTENDANCE, 'حالة الحضور');
    const note = str(record.note, { max: 200, field: 'ملاحظة الحضور' });
    let row = state.attendance.find(
      (a) => a.lessonId === lesson.id && a.studentId === record.studentId,
    );
    if (row) {
      row.status = status;
      row.note = note;
      row.markedAt = nowISO();
      row.markedBy = user.id;
    } else {
      row = {
        id: id('att'),
        lessonId: lesson.id,
        studentId: record.studentId,
        status,
        note,
        markedAt: nowISO(),
        markedBy: user.id,
      };
      state.attendance.push(row);
    }
    saved.push(row);
  }
  return saved;
}

function attendanceSummary(state, lesson) {
  const students = domain.lessonStudents(state, lesson);
  const counts = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 };
  for (const student of students) counts[student.status] = (counts[student.status] || 0) + 1;
  return { students, counts, total: students.length };
}

module.exports = [
  {
    method: 'GET',
    path: '/api/lessons',
    handler: (ctx) => {
      const { state, query } = ctx;
      const today = todayISO();
      const from = dateStr(query.from);
      const to = dateStr(query.to);
      let lessons = state.lessons;
      if (from) lessons = lessons.filter((l) => l.date >= from);
      if (to) lessons = lessons.filter((l) => l.date <= to);
      if (query.groupId) lessons = lessons.filter((l) => l.groupId === query.groupId);
      if (query.studentId) {
        const groupIds = new Set(
          state.enrollments
            .filter((e) => e.studentId === query.studentId && e.active !== false)
            .map((e) => e.groupId),
        );
        lessons = lessons.filter((l) => groupIds.has(l.groupId));
      }
      if (query.status && query.status !== 'all') lessons = lessons.filter((l) => l.status === query.status);
      const items = lessons
        .map((l) => decorate(state, l))
        .sort((a, b) => (a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date)));
      return {
        items,
        total: items.length,
        counts: {
          today: items.filter((l) => l.date === today && l.status !== 'cancelled').length,
          scheduled: items.filter((l) => l.status === 'scheduled').length,
          done: items.filter((l) => l.status === 'done').length,
          cancelled: items.filter((l) => l.status === 'cancelled').length,
        },
        range: { from: from || null, to: to || null },
      };
    },
  },
  {
    method: 'POST',
    path: '/api/lessons',
    handler: (ctx) => {
      const data = validateLesson(ctx.body, { state: ctx.state });
      return ctx.mutate((state) => {
        const group = findGroup(state, data.groupId);
        const other = conflict(state, data);
        if (other) {
          const otherGroup = domain.byId(state.groups, other.groupId) || {};
          throw fail(
            409,
            `في حصة تانية في نفس الوقت (${otherGroup.name || 'مجموعة'}) الساعة ${other.start}`,
            'CONFLICT',
          );
        }
        const lesson = {
          id: id('les'),
          groupId: group.id,
          date: data.date,
          start: data.start,
          duration: data.duration,
          topic: data.topic,
          status: data.status,
          notes: data.notes || '',
          createdAt: nowISO(),
          updatedAt: nowISO(),
        };
        state.lessons.push(lesson);
        log(state, ctx.user, 'lesson.create', 'lesson', lesson.id, `إضافة حصة ${group.name} يوم ${lesson.date}`);
        return { lesson: decorate(state, lesson) };
      });
    },
  },
  {
    method: 'GET',
    path: '/api/lessons/:id',
    handler: (ctx) => {
      const lesson = findLesson(ctx.state, ctx.params.id);
      const group = domain.byId(ctx.state.groups, lesson.groupId) || null;
      const summary = attendanceSummary(ctx.state, lesson);
      return {
        lesson: decorate(ctx.state, lesson),
        group,
        students: summary.students,
        counts: summary.counts,
      };
    },
  },
  {
    method: 'PATCH',
    path: '/api/lessons/:id',
    handler: (ctx) => {
      const lesson = findLesson(ctx.state, ctx.params.id);
      const data = validateLesson(ctx.body, { partial: true, lesson, state: ctx.state });
      return ctx.mutate((state) => {
        const target = findLesson(state, lesson.id);
        const merged = { ...target, ...data };
        const other = conflict(state, merged, target.id);
        if (other) {
          const otherGroup = domain.byId(state.groups, other.groupId) || {};
          throw fail(409, `في حصة تانية في نفس الوقت (${otherGroup.name || 'مجموعة'})`, 'CONFLICT');
        }
        if (data.groupId && data.groupId !== target.groupId) {
          state.attendance = state.attendance.filter((a) => a.lessonId !== target.id);
        }
        Object.assign(target, data, { updatedAt: nowISO() });
        log(state, ctx.user, 'lesson.update', 'lesson', target.id, `تعديل حصة ${target.date}`);
        return { lesson: decorate(state, target) };
      });
    },
  },
  {
    method: 'DELETE',
    path: '/api/lessons/:id',
    handler: (ctx) => {
      const lesson = findLesson(ctx.state, ctx.params.id);
      return ctx.mutate((state) => {
        state.lessons = state.lessons.filter((l) => l.id !== lesson.id);
        state.attendance = state.attendance.filter((a) => a.lessonId !== lesson.id);
        log(state, ctx.user, 'lesson.delete', 'lesson', lesson.id, `حذف حصة ${lesson.date}`);
        return { ok: true };
      });
    },
  },
  {
    method: 'POST',
    path: '/api/lessons/:id/duplicate',
    handler: (ctx) => {
      const lesson = findLesson(ctx.state, ctx.params.id);
      const date = dateStr(ctx.body.date, 'التاريخ', { required: true });
      return ctx.mutate((state) => {
        const source = findLesson(state, lesson.id);
        const slot = {
          groupId: source.groupId,
          date,
          start: source.start,
          duration: source.duration,
        };
        const other = conflict(state, slot);
        if (other) throw fail(409, 'في حصة تانية في نفس الوقت', 'CONFLICT');
        const copy = {
          ...source,
          id: id('les'),
          date,
          status: 'scheduled',
          createdAt: nowISO(),
          updatedAt: nowISO(),
        };
        state.lessons.push(copy);
        log(state, ctx.user, 'lesson.create', 'lesson', copy.id, `نسخ حصة إلى ${date}`);
        return { lesson: decorate(state, copy) };
      });
    },
  },
  {
    method: 'POST',
    path: '/api/lessons/:id/attendance',
    handler: (ctx) => {
      const lesson = findLesson(ctx.state, ctx.params.id);
      if (!Array.isArray(ctx.body.records)) {
        throw fail(422, 'مفيش بيانات حضور', 'VALIDATION');
      }
      return ctx.mutate((state) => {
        const target = findLesson(state, lesson.id);
        saveAttendance(state, target, ctx.body.records, ctx.user);
        if (ctx.body.markDone) {
          target.status = 'done';
          target.updatedAt = nowISO();
        }
        const summary = attendanceSummary(state, target);
        log(
          state,
          ctx.user,
          'attendance.save',
          'lesson',
          target.id,
          `تسجيل حضور ${summary.total} طالب — ${target.date}`,
        );
        return {
          ok: true,
          counts: summary.counts,
          students: summary.students,
          lesson: decorate(state, target),
        };
      });
    },
  },
  {
    method: 'POST',
    path: '/api/lessons/:id/attendance/all',
    handler: (ctx) => {
      const lesson = findLesson(ctx.state, ctx.params.id);
      const status = oneOf(ctx.body.status, ATTENDANCE, 'حالة الحضور', 'present');
      return ctx.mutate((state) => {
        const target = findLesson(state, lesson.id);
        const roster = domain.groupStudents(state, target.groupId);
        saveAttendance(
          state,
          target,
          roster.map((student) => ({ studentId: student.id, status, note: '' })),
          ctx.user,
        );
        const summary = attendanceSummary(state, target);
        log(state, ctx.user, 'attendance.save', 'lesson', target.id, `تحضير سريع — ${target.date}`);
        return { ok: true, counts: summary.counts, students: summary.students };
      });
    },
  },
  {
    method: 'DELETE',
    path: '/api/lessons/:id/attendance/:studentId',
    handler: (ctx) => {
      const lesson = findLesson(ctx.state, ctx.params.id);
      return ctx.mutate((state) => {
        state.attendance = state.attendance.filter(
          (a) => !(a.lessonId === lesson.id && a.studentId === ctx.params.studentId),
        );
        return { ok: true };
      });
    },
  },
  {
    method: 'GET',
    path: '/api/lessons/:id/csv',
    handler: (ctx) => {
      const lesson = findLesson(ctx.state, ctx.params.id);
      const group = domain.byId(ctx.state.groups, lesson.groupId) || {};
      const students = domain.lessonStudents(ctx.state, lesson);
      const labels = { present: 'حاضر', absent: 'غايب', late: 'متأخر', excused: 'بعذر', unmarked: 'لسه' };
      const text = toCsv(
        ['الطالب', 'الموبايل', 'الحضور', 'ملاحظة'],
        students.map((s) => [s.name, s.phone, labels[s.status] || s.status, s.note]),
      );
      return csvResult(text, `attendance-${group.name || 'lesson'}-${lesson.date}.csv`);
    },
  },
  {
    method: 'GET',
    path: '/api/attendances',
    handler: (ctx) => {
      const { state, query } = ctx;
      const lessonMap = new Map(state.lessons.map((l) => [l.id, l]));
      let rows = state.attendance;
      if (query.studentId) rows = rows.filter((a) => a.studentId === query.studentId);
      if (query.status) rows = rows.filter((a) => a.status === query.status);
      rows = rows.filter((a) => {
        const lesson = lessonMap.get(a.lessonId);
        if (!lesson) return false;
        if (query.from && lesson.date < query.from) return false;
        if (query.to && lesson.date > query.to) return false;
        if (query.groupId && lesson.groupId !== query.groupId) return false;
        return true;
      });
      return {
        items: rows
          .map((a) => {
            const lesson = lessonMap.get(a.lessonId);
            const student = domain.byId(state.students, a.studentId) || {};
            return {
              ...a,
              date: lesson.date,
              groupId: lesson.groupId,
              studentName: student.name || '',
            };
          })
          .sort((a, b) => String(b.date).localeCompare(String(a.date))),
        total: rows.length,
      };
    },
  },
];
