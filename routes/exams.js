'use strict';

const { id, str, num, oneOf, dateStr, timeStr, fail, nowISO, todayISO } = require('../lib/utils');
const domain = require('../lib/domain');
const features = require('../lib/features');
const {
  log,
  findGroup,
  findStudent,
  ensureAdmin,
  csvResult,
  toCsv,
  matches,
  searchText,
} = require('./_helpers');

const TYPES = ['quiz', 'exam', 'monthly', 'final', 'practical'];
const STATUSES = ['draft', 'open', 'graded', 'closed'];

function findExam(state, examId) {
  const exam = state.exams.find((e) => e.id === examId);
  if (!exam) throw fail(404, 'الامتحان مش موجود', 'NOT_FOUND');
  return exam;
}

function cleanScore(score, exam) {
  const value = num(score, { min: 0, max: Number(exam.maxScore) || 0, field: 'الدرجة' });
  return value === null ? 0 : value;
}

module.exports = [
  {
    method: 'GET',
    path: '/api/exams',
    handler: (ctx) => {
      const { state, query } = ctx;
      const needle = searchText(query.q || '');
      let items = state.exams.map((exam) => features.examView(state, exam));
      if (query.groupId) items = items.filter((e) => e.groupId === query.groupId);
      if (query.status && query.status !== 'all') items = items.filter((e) => e.status === query.status);
      if (query.type && query.type !== 'all') items = items.filter((e) => e.type === query.type);
      if (query.from) items = items.filter((e) => e.date >= query.from);
      if (query.to) items = items.filter((e) => e.date <= query.to);
      if (needle) {
        items = items.filter(
          (e) => searchText(e.title).includes(needle) || searchText(e.groupName).includes(needle),
        );
      }
      items.sort((a, b) => (a.date === b.date ? b.start.localeCompare(a.start) : b.date.localeCompare(a.date)));
      const summary = {
        total: items.length,
        open: items.filter((e) => e.status === 'open').length,
        graded: items.filter((e) => e.status === 'graded').length,
        upcoming: items.filter((e) => e.status !== 'graded' && e.date >= todayISO()).length,
        average: items.length
          ? domain.round2(items.reduce((t, e) => t + e.percent, 0) / items.length)
          : 0,
      };
      return { items, summary };
    },
  },
  {
    method: 'POST',
    path: '/api/exams',
    handler: (ctx) => {
      const group = findGroup(ctx.state, str(ctx.body.groupId, { required: true, field: 'المجموعة' }));
      const maxScore = num(ctx.body.maxScore, { min: 1, max: 500, field: 'الدرجة النهائية', required: true });
      const passScore =
        num(ctx.body.passScore, { min: 0, max: maxScore, field: 'درجة النجاح' }) ??
        Math.round(maxScore * 0.5);
      const payload = {
        groupId: group.id,
        title: str(ctx.body.title, { required: true, field: 'عنوان الامتحان', max: 180 }),
        type: oneOf(ctx.body.type, TYPES, 'نوع الامتحان', 'exam'),
        date: dateStr(ctx.body.date, 'تاريخ الامتحان', { required: true }),
        start: timeStr(ctx.body.start, 'وقت الامتحان') || '16:00',
        duration: num(ctx.body.duration, { min: 5, max: 600, field: 'المدة' }) || 60,
        maxScore,
        passScore,
        status: oneOf(ctx.body.status, STATUSES, 'حالة الامتحان', 'draft'),
        description: str(ctx.body.description, { max: 1000 }),
      };
      return ctx.mutate((state) => {
        const exam = {
          id: id('exm'),
          ...payload,
          createdAt: nowISO(),
          updatedAt: nowISO(),
        };
        state.exams.push(exam);
        log(state, ctx.user, 'exam.create', 'exam', exam.id, `امتحان ${exam.title} — ${group.name}`);
        return { exam: features.examView(state, exam) };
      });
    },
  },
  {
    method: 'GET',
    path: '/api/exams/:id',
    handler: (ctx) => {
      const exam = findExam(ctx.state, ctx.params.id);
      return {
        exam: features.examView(ctx.state, exam),
        results: features.examResultsView(ctx.state, exam),
      };
    },
  },
  {
    method: 'PATCH',
    path: '/api/exams/:id',
    handler: (ctx) => {
      const examId = findExam(ctx.state, ctx.params.id).id;
      return ctx.mutate((state) => {
        const exam = findExam(state, examId);
        const body = ctx.body;
        if (body.title !== undefined)
          exam.title = str(body.title, { required: true, field: 'عنوان الامتحان', max: 180 });
        if (body.type !== undefined) exam.type = oneOf(body.type, TYPES, 'نوع الامتحان');
        if (body.status !== undefined) exam.status = oneOf(body.status, STATUSES, 'حالة الامتحان');
        if (body.date !== undefined) exam.date = dateStr(body.date, 'تاريخ الامتحان', { required: true });
        if (body.start !== undefined) exam.start = timeStr(body.start, 'وقت الامتحان') || exam.start;
        if (body.duration !== undefined)
          exam.duration = num(body.duration, { min: 5, max: 600, field: 'المدة' }) || exam.duration;
        if (body.maxScore !== undefined)
          exam.maxScore = num(body.maxScore, { min: 1, max: 500, field: 'الدرجة النهائية' });
        if (body.passScore !== undefined)
          exam.passScore = num(body.passScore, { min: 0, max: exam.maxScore, field: 'درجة النجاح' });
        if (body.description !== undefined) exam.description = str(body.description, { max: 1000 });
        if (body.groupId !== undefined) exam.groupId = findGroup(state, str(body.groupId, { required: true })).id;
        exam.updatedAt = nowISO();
        log(state, ctx.user, 'exam.update', 'exam', exam.id, `تعديل امتحان ${exam.title}`);
        return { exam: features.examView(state, exam) };
      });
    },
  },
  {
    method: 'DELETE',
    path: '/api/exams/:id',
    handler: (ctx) => {
      const examId = findExam(ctx.state, ctx.params.id).id;
      return ctx.mutate((state) => {
        const exam = findExam(state, examId);
        state.examResults = state.examResults.filter((r) => r.examId !== exam.id);
        state.exams = state.exams.filter((e) => e.id !== exam.id);
        log(state, ctx.user, 'exam.delete', 'exam', exam.id, `حذف امتحان ${exam.title}`);
        return { ok: true };
      });
    },
  },
  {
    method: 'POST',
    path: '/api/exams/:id/results',
    handler: (ctx) => {
      const examId = findExam(ctx.state, ctx.params.id).id;
      if (!Array.isArray(ctx.body.records)) throw fail(422, 'مفيش درجات مرسلة', 'VALIDATION');
      return ctx.mutate((state) => {
        const exam = findExam(state, examId);
        let saved = 0;
        for (const record of ctx.body.records) {
          const student = findStudent(state, record.studentId);
          if (!domain.byId(domain.groupStudents(state, exam.groupId), student.id)) continue;
          const score = cleanScore(record.score, exam);
          const note = str(record.note, { max: 400 });
          const existing = state.examResults.find(
            (r) => r.examId === exam.id && r.studentId === student.id,
          );
          if (existing) {
            if (record.score === null || record.score === undefined || record.score === '') {
              state.examResults = state.examResults.filter((r) => r.id !== existing.id);
              continue;
            }
            existing.score = score;
            existing.note = note;
            existing.gradedAt = nowISO();
            existing.gradedBy = ctx.user.name;
          } else {
            if (record.score === null || record.score === undefined || record.score === '') continue;
            state.examResults.push({
              id: id('exr'),
              examId: exam.id,
              studentId: student.id,
              score,
              note,
              gradedAt: nowISO(),
              gradedBy: ctx.user.name,
            });
          }
          saved += 1;
        }
        if (ctx.body.markGraded !== false) exam.status = 'graded';
        exam.updatedAt = nowISO();
        log(state, ctx.user, 'exam.grade', 'exam', exam.id, `تصحيح ${saved} طالب — ${exam.title}`);
        return {
          ok: true,
          saved,
          exam: features.examView(state, exam),
          results: features.examResultsView(state, exam),
        };
      });
    },
  },
  {
    method: 'POST',
    path: '/api/exams/:id/results/:studentId',
    handler: (ctx) => {
      const examId = findExam(ctx.state, ctx.params.id).id;
      return ctx.mutate((state) => {
        const exam = findExam(state, examId);
        const student = findStudent(state, ctx.params.studentId);
        const score = cleanScore(ctx.body.score, exam);
        const note = str(ctx.body.note, { max: 400 });
        const existing = state.examResults.find(
          (r) => r.examId === exam.id && r.studentId === student.id,
        );
        if (existing) {
          existing.score = score;
          existing.note = note;
          existing.gradedAt = nowISO();
          existing.gradedBy = ctx.user.name;
        } else {
          state.examResults.push({
            id: id('exr'),
            examId: exam.id,
            studentId: student.id,
            score,
            note,
            gradedAt: nowISO(),
            gradedBy: ctx.user.name,
          });
        }
        exam.updatedAt = nowISO();
        log(state, ctx.user, 'exam.grade', 'exam', exam.id, `تصحيح ${student.shortName}`);
        return { ok: true, exam: features.examView(state, exam) };
      });
    },
  },
  {
    method: 'DELETE',
    path: '/api/exams/:id/results/:studentId',
    handler: (ctx) => {
      const examId = findExam(ctx.state, ctx.params.id).id;
      return ctx.mutate((state) => {
        const exam = findExam(state, examId);
        state.examResults = state.examResults.filter(
          (r) => !(r.examId === exam.id && r.studentId === ctx.params.studentId),
        );
        return { ok: true, exam: features.examView(state, exam) };
      });
    },
  },
  {
    method: 'GET',
    path: '/api/exams/:id/csv',
    handler: (ctx) => {
      const exam = findExam(ctx.state, ctx.params.id);
      const rows = features.examResultsView(ctx.state, exam);
      const text = toCsv(
        ['الكود', 'الطالب', 'الدرجة', 'من', 'النسبة', 'الحالة', 'ملاحظة'],
        rows.map((r) => [
          r.code,
          r.fullName,
          r.graded ? r.score : '',
          exam.maxScore,
          r.graded ? `${r.percent}%` : '',
          r.graded ? (r.passed ? 'ناجح' : 'راسب') : 'لم يصحح',
          r.note,
        ]),
      );
      return csvResult(text, `exam-${exam.id}.csv`);
    },
  },
];
