'use strict';

const { str, num, oneOf, fail, nowISO, todayISO } = require('../lib/utils');
const domain = require('../lib/domain');
const features = require('../lib/features');
const { log } = require('./_helpers');

const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'];

function findByCode(state, code) {
  const value = String(code || '').trim().toUpperCase();
  if (!value) return null;
  return state.students.find((s) => String(s.code || '').toUpperCase() === value) || null;
}

module.exports = [
  {
    method: 'GET',
    path: '/api/public/portal',
    public: true,
    handler: (ctx) => {
      const { state } = ctx;
      if (state.settings.enablePortal === false) {
        throw fail(403, 'بوابة الطالب متقفلة حالياً', 'PORTAL_OFF');
      }
      const stages = {};
      for (const group of state.groups.filter((g) => g.status === 'active')) {
        const key = group.level || 'عام';
        stages[key] = stages[key] || [];
        stages[key].push({
          id: group.id,
          name: group.name,
          subject: group.subject,
          color: group.color,
          schedule: group.schedule,
          students: domain.groupStudents(state, group.id).length,
        });
      }
      return {
        settings: {
          centerName: state.settings.centerName,
          teacherName: state.settings.teacherName,
          phone: state.settings.phone,
          email: state.settings.email,
          address: state.settings.address,
          message: state.settings.portalMessage,
          academicYear: state.settings.academicYear,
          theme: state.settings.theme,
        },
        stages,
        stats: {
          students: state.students.filter((s) => s.status === 'active').length,
          groups: state.groups.filter((g) => g.status === 'active').length,
          lessons: state.lessons.filter((l) => l.status === 'done').length,
          certificates: state.certificates.filter((c) => c.status === 'active').length,
        },
      };
    },
  },
  {
    method: 'GET',
    path: '/api/public/portal/:code',
    public: true,
    handler: (ctx) => {
      const { state } = ctx;
      if (state.settings.enablePortal === false) {
        throw fail(403, 'بوابة الطالب متقفلة حالياً', 'PORTAL_OFF');
      }
      const profile = features.portalProfile(state, ctx.params.code);
      if (!profile) throw fail(404, 'مفيش طالب بالكود ده', 'NOT_FOUND');
      return { profile };
    },
  },
  {
    method: 'GET',
    path: '/api/public/certificate/:code',
    public: true,
    handler: (ctx) => {
      const value = String(ctx.params.code || '').trim().toUpperCase();
      const cert = ctx.state.certificates.find((c) => String(c.code).toUpperCase() === value);
      if (!cert) throw fail(404, 'الشهادة مش موجودة — راجع الكود', 'NOT_FOUND');
      const view = features.certificateView(ctx.state, cert);
      return {
        valid: cert.status === 'active',
        certificate: view,
        settings: {
          centerName: ctx.state.settings.centerName,
          teacherName: ctx.state.settings.teacherName,
          certificateSigner: ctx.state.settings.certificateSigner,
          certificateNote: ctx.state.settings.certificateNote,
          academicYear: ctx.state.settings.academicYear,
        },
      };
    },
  },
  {
    method: 'POST',
    path: '/api/scan',
    handler: (ctx) => {
      const code = str(ctx.body.code, { required: true, field: 'كود الطالب', max: 60 });
      const student = findByCode(ctx.state, code);
      if (!student) throw fail(404, 'الكود مش مطابق لأي طالب', 'NOT_FOUND');
      const today = todayISO();
      const groupIds = ctx.state.enrollments
        .filter((e) => e.studentId === student.id && e.active !== false)
        .map((e) => e.groupId);
      const lessons = ctx.state.lessons
        .filter((l) => l.date === today && groupIds.includes(l.groupId) && l.status !== 'cancelled')
        .map((lesson) => {
          const group = domain.byId(ctx.state.groups, lesson.groupId) || {};
          const record = ctx.state.attendance.find(
            (a) => a.lessonId === lesson.id && a.studentId === student.id,
          );
          return {
            ...lesson,
            groupName: group.name || '',
            groupColor: group.color || '#2f6f5e',
            status: record ? record.status : 'unmarked',
          };
        });
      const balances = domain.balanceMap(ctx.state);
      const balance = balances.get(student.id) || { balance: 0 };
      return {
        student: {
          id: student.id,
          name: student.name,
          shortName: student.shortName,
          code: student.code,
          grade: student.grade,
          avatarColor: student.avatarColor,
          parentPhone: student.parentPhone,
          phone: student.phone,
        },
        balance: balance.balance,
        lessons,
        points: features.studentPointRows(ctx.state).find((r) => r.studentId === student.id)?.total || 0,
      };
    },
  },
  {
    method: 'POST',
    path: '/api/scan/attendance',
    handler: (ctx) => {
      const code = str(ctx.body.code, { required: true, field: 'كود الطالب', max: 60 });
      const status = oneOf(ctx.body.status, ATTENDANCE_STATUSES, 'حالة الحضور', 'present');
      const lessonId = str(ctx.body.lessonId, { required: true, field: 'الحصة' });
      return ctx.mutate((state) => {
        const student = findByCode(state, code);
        if (!student) throw fail(404, 'الكود مش مطابق لأي طالب', 'NOT_FOUND');
        const lesson = state.lessons.find((l) => l.id === lessonId);
        if (!lesson) throw fail(404, 'الحصة مش موجودة', 'NOT_FOUND');
        const roster = domain.groupStudents(state, lesson.groupId);
        if (!roster.some((s) => s.id === student.id)) {
          throw fail(422, 'الطالب مش في المجموعة دي', 'VALIDATION');
        }
        const existing = state.attendance.find(
          (a) => a.lessonId === lesson.id && a.studentId === student.id,
        );
        if (existing) {
          existing.status = status;
          existing.markedAt = nowISO();
          existing.markedBy = ctx.user.name;
        } else {
          state.attendance.push({
            id: `att_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
            lessonId: lesson.id,
            studentId: student.id,
            status,
            note: '',
            markedAt: nowISO(),
            markedBy: ctx.user.name,
          });
        }
        log(state, ctx.user, 'attendance.scan', 'lesson', lesson.id, `مسح كود ${student.shortName} — ${status}`);
        return { ok: true, student, status, lessonId: lesson.id };
      });
    },
  },
];
