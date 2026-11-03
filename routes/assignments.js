'use strict';

const { id, str, num, oneOf, dateStr, fail, todayISO, nowISO } = require('../lib/utils');
const domain = require('../lib/domain');
const {
  log,
  findAssignment,
  findGroup,
  findStudent,
  csvResult,
  toCsv,
  ensureAdmin,
} = require('./_helpers');

const TYPES = ['homework', 'quiz', 'exam', 'project'];
const STATUSES = ['open', 'closed'];

function decorate(state, assignment) {
  const group = domain.byId(state.groups, assignment.groupId) || {};
  const grades = state.grades.filter((g) => g.assignmentId === assignment.id);
  const average = grades.length
    ? domain.round2(grades.reduce((t, g) => t + Number(g.score || 0), 0) / grades.length)
    : 0;
  return {
    ...assignment,
    groupName: group.name || '',
    groupColor: group.color || '#2f6f5e',
    studentCount: domain.groupStudents(state, assignment.groupId).length,
    gradedCount: grades.length,
    average,
    percent: assignment.maxScore ? domain.round2((average / assignment.maxScore) * 100) : 0,
    overdue: assignment.status === 'open' && assignment.dueDate < todayISO(),
  };
}

module.exports = [
  {
    method: 'GET',
    path: '/api/assignments',
    handler: (ctx) => {
      const { state, query } = ctx;
      let items = state.assignments.map((a) => decorate(state, a));
      if (query.groupId) items = items.filter((a) => a.groupId === query.groupId);
      if (query.status && query.status !== 'all') items = items.filter((a) => a.status === query.status);
      if (query.type) items = items.filter((a) => a.type === query.type);
      if (query.studentId) {
        const groupIds = new Set(
          state.enrollments
            .filter((e) => e.studentId === query.studentId && e.active !== false)
            .map((e) => e.groupId),
        );
        items = items.filter((a) => groupIds.has(a.groupId));
      }
      items.sort((a, b) => String(b.dueDate).localeCompare(String(a.dueDate)));
      return {
        items,
        total: items.length,
        summary: {
          open: items.filter((a) => a.status === 'open').length,
          closed: items.filter((a) => a.status === 'closed').length,
          graded: items.reduce((t, a) => t + a.gradedCount, 0),
        },
      };
    },
  },
  {
    method: 'POST',
    path: '/api/assignments',
    handler: (ctx) => {
      const group = findGroup(ctx.state, ctx.body.groupId);
      const title = str(ctx.body.title, { required: true, field: 'العنوان', min: 2, max: 120 });
      const type = oneOf(ctx.body.type, TYPES, 'النوع', 'homework');
      const dueDate = dateStr(ctx.body.dueDate, 'تاريخ التسليم') || todayISO();
      const maxScore = num(ctx.body.maxScore, { min: 1, max: 1000, field: 'الدرجة الكاملة' }) || 20;
      const status = oneOf(ctx.body.status, STATUSES, 'الحالة', 'open');
      const description = str(ctx.body.description, { max: 1000, field: 'التفاصيل' });
      return ctx.mutate((state) => {
        const assignment = {
          id: id('asg'),
          groupId: group.id,
          title,
          type,
          dueDate,
          maxScore,
          description,
          status,
          createdAt: nowISO(),
          createdBy: ctx.user.id,
        };
        state.assignments.push(assignment);
        log(state, ctx.user, 'assignment.create', 'assignment', assignment.id, `إضافة ${title}`);
        return { assignment: decorate(state, assignment) };
      });
    },
  },
  {
    method: 'GET',
    path: '/api/assignments/:id',
    handler: (ctx) => {
      const assignment = findAssignment(ctx.state, ctx.params.id);
      const group = domain.byId(ctx.state.groups, assignment.groupId) || null;
      const roster = domain.groupStudents(ctx.state, assignment.groupId).map((student) => {
        const grade = ctx.state.grades.find(
          (g) => g.assignmentId === assignment.id && g.studentId === student.id,
        );
        return {
          id: student.id,
          name: student.name,
          shortName: student.shortName,
          avatarColor: student.avatarColor,
          score: grade ? grade.score : null,
          feedback: grade ? grade.feedback || '' : '',
          gradedAt: grade ? grade.gradedAt : null,
        };
      });
      const scored = roster.filter((r) => r.score !== null);
      return {
        assignment: decorate(ctx.state, assignment),
        group,
        roster,
        stats: {
          graded: scored.length,
          total: roster.length,
          average: scored.length
            ? domain.round2(scored.reduce((t, r) => t + Number(r.score), 0) / scored.length)
            : 0,
          highest: scored.length ? Math.max(...scored.map((r) => Number(r.score))) : 0,
          lowest: scored.length ? Math.min(...scored.map((r) => Number(r.score))) : 0,
          percent: assignment.maxScore
            ? domain.round2(
                (scored.reduce((t, r) => t + Number(r.score), 0) /
                  scored.length /
                  assignment.maxScore) *
                  100,
              )
            : 0,
        },
      };
    },
  },
  {
    method: 'PATCH',
    path: '/api/assignments/:id',
    handler: (ctx) => {
      const assignment = findAssignment(ctx.state, ctx.params.id);
      return ctx.mutate((state) => {
        const target = findAssignment(state, assignment.id);
        if (ctx.body.title !== undefined) {
          target.title = str(ctx.body.title, { required: true, min: 2, max: 120, field: 'العنوان' });
        }
        if (ctx.body.type !== undefined) target.type = oneOf(ctx.body.type, TYPES, 'النوع');
        if (ctx.body.dueDate !== undefined) target.dueDate = dateStr(ctx.body.dueDate, 'تاريخ التسليم', { required: true });
        if (ctx.body.maxScore !== undefined) {
          target.maxScore = num(ctx.body.maxScore, { required: true, min: 1, max: 1000, field: 'الدرجة الكاملة' });
        }
        if (ctx.body.description !== undefined) {
          target.description = str(ctx.body.description, { max: 1000, field: 'التفاصيل' });
        }
        if (ctx.body.status !== undefined) target.status = oneOf(ctx.body.status, STATUSES, 'الحالة');
        target.updatedAt = nowISO();
        log(state, ctx.user, 'assignment.update', 'assignment', target.id, `تعديل ${target.title}`);
        return { assignment: decorate(state, target) };
      });
    },
  },
  {
    method: 'DELETE',
    path: '/api/assignments/:id',
    handler: (ctx) => {
      const assignment = findAssignment(ctx.state, ctx.params.id);
      return ctx.mutate((state) => {
        state.assignments = state.assignments.filter((a) => a.id !== assignment.id);
        state.grades = state.grades.filter((g) => g.assignmentId !== assignment.id);
        log(state, ctx.user, 'assignment.delete', 'assignment', assignment.id, `حذف ${assignment.title}`);
        return { ok: true };
      });
    },
  },
  {
    method: 'POST',
    path: '/api/assignments/:id/grades',
    handler: (ctx) => {
      const assignment = findAssignment(ctx.state, ctx.params.id);
      if (!Array.isArray(ctx.body.grades)) throw fail(422, 'مفيش درجات', 'VALIDATION');
      return ctx.mutate((state) => {
        const target = findAssignment(state, assignment.id);
        const roster = new Set(domain.groupStudents(state, target.groupId).map((s) => s.id));
        for (const row of ctx.body.grades) {
          if (!row || !row.studentId) continue;
          if (!roster.has(row.studentId)) throw fail(422, 'الطالب مش في المجموعة', 'VALIDATION');
          const existing = state.grades.find(
            (g) => g.assignmentId === target.id && g.studentId === row.studentId,
          );
          if (row.score === '' || row.score === null || row.score === undefined) {
            if (existing) state.grades = state.grades.filter((g) => g.id !== existing.id);
            continue;
          }
          const score = num(row.score, { required: true, min: 0, max: target.maxScore, field: 'الدرجة' });
          const feedback = str(row.feedback, { max: 400, field: 'تعليق' });
          if (existing) {
            existing.score = score;
            existing.feedback = feedback;
            existing.gradedAt = nowISO();
            existing.gradedBy = ctx.user.id;
          } else {
            state.grades.push({
              id: id('grd'),
              assignmentId: target.id,
              studentId: row.studentId,
              score,
              feedback,
              gradedAt: nowISO(),
              gradedBy: ctx.user.id,
            });
          }
        }
        const graded = state.grades.filter((g) => g.assignmentId === target.id).length;
        log(state, ctx.user, 'assignment.grade', 'assignment', target.id, `تصحيح ${target.title} (${graded})`);
        return { ok: true, graded };
      });
    },
  },
  {
    method: 'GET',
    path: '/api/assignments/:id/csv',
    handler: (ctx) => {
      const assignment = findAssignment(ctx.state, ctx.params.id);
      const roster = domain.groupStudents(ctx.state, assignment.groupId).map((student) => {
        const grade = ctx.state.grades.find(
          (g) => g.assignmentId === assignment.id && g.studentId === student.id,
        );
        return [student.name, student.phone, grade ? grade.score : '', assignment.maxScore, grade ? grade.feedback : ''];
      });
      const text = toCsv(['الطالب', 'الموبايل', 'الدرجة', 'من', 'تعليق'], roster);
      return csvResult(text, `grades-${assignment.title}.csv`);
    },
  },
  {
    method: 'GET',
    path: '/api/grades',
    handler: (ctx) => {
      const { state, query } = ctx;
      let items = state.grades;
      if (query.studentId) items = items.filter((g) => g.studentId === query.studentId);
      if (query.assignmentId) items = items.filter((g) => g.assignmentId === query.assignmentId);
      return {
        items: items.map((g) => {
          const assignment = domain.byId(state.assignments, g.assignmentId);
          const student = domain.byId(state.students, g.studentId);
          return {
            ...g,
            assignmentTitle: assignment ? assignment.title : '',
            maxScore: assignment ? assignment.maxScore : 0,
            studentName: student ? student.name : '',
          };
        }),
        total: items.length,
      };
    },
  },
];
