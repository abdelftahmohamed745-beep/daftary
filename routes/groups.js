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
  findGroup,
  findStudent,
  searchText,
  matches,
  ensureAdmin,
} = require('./_helpers');

const TYPES = ['group', 'individual'];
const STATUSES = ['active', 'archived'];
const BILLING = ['monthly', 'per_lesson'];

function validateSchedule(value, fallback) {
  if (value === undefined) return fallback || [];
  if (!Array.isArray(value) || !value.length) {
    throw fail(422, 'لازم تضيف موعد واحد على الأقل', 'VALIDATION', { schedule: 'مطلوب' });
  }
  const slots = value.map((slot) => ({
    day: Number(slot.day),
    start: timeStr(slot.start, 'وقت الحصة', { required: true }),
    duration: num(slot.duration, { min: 15, max: 300, field: 'مدة الحصة' }) || 90,
  }));
  for (const slot of slots) {
    if (!Number.isInteger(slot.day) || slot.day < 0 || slot.day > 6) {
      throw fail(422, 'اليوم غير صحيح', 'VALIDATION', { schedule: 'يوم غير صحيح' });
    }
  }
  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      if (slots[i].day === slots[j].day && overlaps(slots[i].start, slots[i].duration, slots[j].start, slots[j].duration)) {
        throw fail(422, 'في موعدين متداخلين في نفس اليوم', 'VALIDATION', { schedule: 'مواعيد متداخلة' });
      }
    }
  }
  return slots.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
}

function validateGroup(body, { partial = false, group = null } = {}) {
  const data = {};
  const has = (key) => body[key] !== undefined;
  if (!partial || has('name')) data.name = str(body.name, { required: true, field: 'اسم المجموعة', min: 3, max: 80 });
  if (!partial || has('subject')) data.subject = str(body.subject, { required: true, field: 'المادة', min: 2, max: 40 });
  if (!partial || has('level')) data.level = str(body.level, { max: 40, field: 'الصف' });
  if (!partial || has('type')) data.type = oneOf(body.type, TYPES, 'النوع', group?.type || 'group');
  if (!partial || has('capacity')) {
    data.capacity = num(body.capacity, { min: 1, max: 60, field: 'السعة' }) || (data.type === 'individual' ? 1 : 12);
  }
  if (!partial || has('price')) data.price = num(body.price, { min: 0, max: 100000, field: 'السعر' }) || 0;
  if (!partial || has('room')) data.room = str(body.room, { max: 50, field: 'القاعة' });
  if (!partial || has('color')) data.color = str(body.color, { max: 20, field: 'اللون' }) || group?.color || '#2f6f5e';
  if (!partial || has('description')) data.description = str(body.description, { max: 800, field: 'الوصف' });
  if (!partial || has('status')) data.status = oneOf(body.status, STATUSES, 'الحالة', group?.status || 'active');
  if (!partial || has('billing')) data.billing = oneOf(body.billing, BILLING, 'طريقة الدفع', group?.billing || 'monthly');
  if (!partial || has('startDate')) data.startDate = dateStr(body.startDate, 'تاريخ البداية') || group?.startDate || todayISO();
  if (!partial || has('schedule')) data.schedule = validateSchedule(body.schedule, group?.schedule);
  return data;
}

module.exports = [
  {
    method: 'GET',
    path: '/api/groups',
    handler: (ctx) => {
      const { state, query } = ctx;
      const balances = domain.balanceMap(state);
      let items = state.groups.map((g) => domain.groupCard(state, g, balances));
      if (query.status && query.status !== 'all') items = items.filter((g) => g.status === query.status);
      if (query.type) items = items.filter((g) => g.type === query.type);
      if (query.subject) items = items.filter((g) => g.subject === query.subject);
      const needle = searchText(query.search);
      if (needle) {
        items = items.filter((g) => [g.name, g.subject, g.level, g.room].some((v) => matches(v, needle)));
      }
      items.sort((a, b) => (a.nextLesson?.date || '9999').localeCompare(b.nextLesson?.date || '9999'));
      const subjects = [...new Set(state.groups.map((g) => g.subject))].sort();
      return {
        items,
        total: items.length,
        subjects,
        summary: {
          groups: state.groups.filter((g) => g.status === 'active').length,
          students: state.groups
            .filter((g) => g.status === 'active')
            .reduce((total, g) => total + domain.groupStudents(state, g.id).length, 0),
          seats: state.groups
            .filter((g) => g.status === 'active')
            .reduce((total, g) => total + Number(g.capacity || 0), 0),
        },
      };
    },
  },
  {
    method: 'POST',
    path: '/api/groups',
    handler: (ctx) => {
      const data = validateGroup(ctx.body);
      return ctx.mutate((state) => {
        const group = {
          id: id('grp'),
          name: data.name,
          subject: data.subject,
          level: data.level || '',
          type: data.type,
          capacity: data.capacity,
          price: data.price,
          room: data.room || '',
          color: data.color,
          description: data.description || '',
          status: data.status,
          billing: data.billing,
          startDate: data.startDate,
          schedule: data.schedule,
          createdAt: nowISO(),
        };
        state.groups.push(group);
        log(state, ctx.user, 'group.create', 'group', group.id, `إنشاء مجموعة ${group.name}`);
        return { group: domain.groupCard(state, group, domain.balanceMap(state)) };
      });
    },
  },
  {
    method: 'GET',
    path: '/api/groups/:id',
    handler: (ctx) => {
      const group = findGroup(ctx.state, ctx.params.id);
      return domain.groupProfile(ctx.state, group);
    },
  },
  {
    method: 'PATCH',
    path: '/api/groups/:id',
    handler: (ctx) => {
      const group = findGroup(ctx.state, ctx.params.id);
      const data = validateGroup(ctx.body, { partial: true, group });
      return ctx.mutate((state) => {
        const target = findGroup(state, group.id);
        Object.assign(target, data, { updatedAt: nowISO() });
        log(state, ctx.user, 'group.update', 'group', target.id, `تعديل مجموعة ${target.name}`);
        return { group: domain.groupCard(state, target, domain.balanceMap(state)) };
      });
    },
  },
  {
    method: 'DELETE',
    path: '/api/groups/:id',
    adminOnly: true,
    handler: (ctx) => {
      const group = findGroup(ctx.state, ctx.params.id);
      ensureAdmin(ctx.user);
      return ctx.mutate((state) => {
        const groupId = group.id;
        const lessonIds = new Set(state.lessons.filter((l) => l.groupId === groupId).map((l) => l.id));
        const assignmentIds = new Set(
          state.assignments.filter((a) => a.groupId === groupId).map((a) => a.id),
        );
        state.groups = state.groups.filter((g) => g.id !== groupId);
        state.enrollments = state.enrollments.filter((e) => e.groupId !== groupId);
        state.lessons = state.lessons.filter((l) => l.groupId !== groupId);
        state.attendance = state.attendance.filter((a) => !lessonIds.has(a.lessonId));
        state.assignments = state.assignments.filter((a) => a.groupId !== groupId);
        state.grades = state.grades.filter((g) => !assignmentIds.has(g.assignmentId));
        state.materials = state.materials.filter((m) => m.groupId !== groupId);
        state.charges = state.charges.map((c) => (c.groupId === groupId ? { ...c, groupId: null } : c));
        log(state, ctx.user, 'group.delete', 'group', groupId, `حذف مجموعة ${group.name}`);
        return { ok: true };
      });
    },
  },
  {
    method: 'POST',
    path: '/api/groups/:id/enrollments',
    handler: (ctx) => {
      const group = findGroup(ctx.state, ctx.params.id);
      const student = findStudent(ctx.state, ctx.body.studentId);
      return ctx.mutate((state) => {
        const targetGroup = findGroup(state, group.id);
        const existing = state.enrollments.find(
          (e) => e.studentId === student.id && e.groupId === targetGroup.id,
        );
        if (existing && existing.active !== false) {
          throw fail(409, 'الطالب مسجل في المجموعة دي بالفعل', 'ALREADY_ENROLLED');
        }
        if (existing) {
          existing.active = true;
          existing.joinedAt = todayISO();
        } else {
          const count = domain.activeEnrollments(state, targetGroup.id).length;
          if (targetGroup.capacity && count >= targetGroup.capacity) {
            throw fail(409, `المجموعة مليانة (${targetGroup.capacity} طالب)`, 'GROUP_FULL');
          }
          state.enrollments.push({
            id: id('enr'),
            studentId: student.id,
            groupId: targetGroup.id,
            joinedAt: todayISO(),
            active: true,
            note: '',
          });
        }
        log(state, ctx.user, 'enrollment.create', 'group', targetGroup.id, `إضافة ${student.name} لمجموعة ${targetGroup.name}`);
        return { ok: true };
      });
    },
  },
  {
    method: 'DELETE',
    path: '/api/groups/:id/enrollments/:studentId',
    handler: (ctx) => {
      const group = findGroup(ctx.state, ctx.params.id);
      return ctx.mutate((state) => {
        const enrollment = state.enrollments.find(
          (e) => e.groupId === group.id && e.studentId === ctx.params.studentId && e.active !== false,
        );
        if (!enrollment) throw fail(404, 'الطالب مش مسجل في المجموعة دي', 'NOT_FOUND');
        enrollment.active = false;
        enrollment.leftAt = todayISO();
        log(state, ctx.user, 'enrollment.remove', 'group', group.id, `إخراج طالب من ${group.name}`);
        return { ok: true };
      });
    },
  },
  {
    method: 'POST',
    path: '/api/groups/:id/lessons/generate',
    handler: (ctx) => {
      const group = findGroup(ctx.state, ctx.params.id);
      const weeks = Math.min(26, Math.max(1, Number(ctx.body.weeks) || 4));
      const from = dateStr(ctx.body.from) || todayISO();
      return ctx.mutate((state) => {
        const target = findGroup(state, group.id);
        const created = [];
        for (let offset = 0; offset < weeks * 7; offset += 1) {
          const date = todayISO(addDays(new Date(`${from}T00:00:00`), offset));
          const weekday = new Date(`${date}T00:00:00`).getDay();
          for (const slot of target.schedule || []) {
            if (slot.day !== weekday) continue;
            const exists = state.lessons.some(
              (l) => l.groupId === target.id && l.date === date && l.start === slot.start,
            );
            if (exists) continue;
            const lesson = {
              id: id('les'),
              groupId: target.id,
              date,
              start: slot.start,
              duration: slot.duration,
              topic: `حصة ${target.subject}`,
              status: 'scheduled',
              notes: '',
              createdAt: nowISO(),
              updatedAt: nowISO(),
            };
            state.lessons.push(lesson);
            created.push(lesson);
          }
        }
        if (created.length) {
          log(state, ctx.user, 'lesson.generate', 'group', target.id, `توليد ${created.length} حصة لمجموعة ${target.name}`);
        }
        return { created: created.length, lessons: created };
      });
    },
  },
  {
    method: 'GET',
    path: '/api/groups/:id/reminders',
    handler: (ctx) => {
      const group = findGroup(ctx.state, ctx.params.id);
      const kind = ctx.query.kind === 'lesson' ? 'lesson' : 'payment';
      const roster = domain.groupStudents(ctx.state, group.id);
      return {
        group: { id: group.id, name: group.name },
        reminders: roster.map((student) => ({
          student: { id: student.id, name: student.name, shortName: student.shortName },
          ...domain.reminderFor(ctx.state, student, kind),
        })),
      };
    },
  },
];
