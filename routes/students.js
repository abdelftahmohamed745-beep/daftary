'use strict';

const { id, str, num, oneOf, dateStr, phone, fail, todayISO, nowISO } = require('../lib/utils');
const domain = require('../lib/domain');
const {
  log,
  findStudent,
  findGroup,
  paginate,
  searchText,
  matches,
  ensureAdmin,
} = require('./_helpers');

const GENDERS = ['male', 'female'];
const STATUSES = ['active', 'paused', 'left'];

function validateStudent(body, { partial = false, student = null } = {}) {
  const data = {};
  const has = (key) => body[key] !== undefined;

  if (!partial || has('name')) {
    data.name = str(body.name, { required: true, field: 'اسم الطالب', min: 3, max: 80 });
  }
  if (!partial || has('shortName')) {
    const raw = str(body.shortName, { max: 50, field: 'الاسم المختصر' });
    data.shortName = raw || (data.name || student?.name || '').split(' ').slice(0, 2).join(' ');
  }
  if (!partial || has('gender')) data.gender = oneOf(body.gender, GENDERS, 'النوع', student?.gender || 'male');
  if (!partial || has('phone')) data.phone = phone(body.phone, { required: false });
  if (!partial || has('parentName')) data.parentName = str(body.parentName, { max: 80, field: 'اسم ولي الأمر' });
  if (!partial || has('parentPhone')) data.parentPhone = phone(body.parentPhone, { required: false });
  if (!partial || has('email')) data.email = str(body.email, { max: 100, field: 'الإيميل' });
  if (!partial || has('school')) data.school = str(body.school, { max: 100, field: 'المدرسة' });
  if (!partial || has('grade')) data.grade = str(body.grade, { max: 50, field: 'الصف' });
  if (!partial || has('birthDate')) data.birthDate = dateStr(body.birthDate, 'تاريخ الميلاد');
  if (!partial || has('address')) data.address = str(body.address, { max: 160, field: 'العنوان' });
  if (!partial || has('status')) data.status = oneOf(body.status, STATUSES, 'الحالة', student?.status || 'active');
  if (!partial || has('joinedAt')) data.joinedAt = dateStr(body.joinedAt, 'تاريخ الانضمام') || student?.joinedAt || todayISO();
  if (!partial || has('notes')) data.notes = str(body.notes, { max: 1000, field: 'ملاحظات' });
  if (!partial || has('avatarColor')) data.avatarColor = str(body.avatarColor, { max: 20, field: 'اللون' });

  if (!partial && body.balanceStart !== undefined && body.balanceStart !== '') {
    data.balanceStart = num(body.balanceStart, { min: -1000000, max: 1000000, field: 'رصيد افتتاحي' }) || 0;
  }
  return data;
}

function studentEnrollmentCount(state, studentId) {
  return state.enrollments.filter((e) => e.studentId === studentId && e.active !== false).length;
}

function attachEnrollment(state, studentId, groupId, joinedAt) {
  const group = findGroup(state, groupId);
  const existing = state.enrollments.find(
    (e) => e.studentId === studentId && e.groupId === groupId,
  );
  if (existing) {
    existing.active = true;
    return existing;
  }
  const count = state.enrollments.filter((e) => e.groupId === groupId && e.active !== false).length;
  if (group.capacity && count >= group.capacity) {
    throw fail(409, `المجموعة "${group.name}" مليانة (${group.capacity} طالب)`, 'GROUP_FULL');
  }
  const enrollment = {
    id: id('enr'),
    studentId,
    groupId,
    joinedAt: joinedAt || todayISO(),
    active: true,
    note: '',
  };
  state.enrollments.push(enrollment);
  return enrollment;
}

module.exports = [
  {
    method: 'GET',
    path: '/api/students',
    handler: (ctx) => {
      const { query, state } = ctx;
      const needle = searchText(query.search);
      const balances = domain.balanceMap(state);
      let items = state.students.map((s) => domain.studentCard(state, s, balances));
      if (needle) {
        items = items.filter((s) =>
          [s.name, s.shortName, s.phone, s.parentName, s.parentPhone, s.school, s.grade, s.email]
            .some((field) => matches(field, needle)),
        );
      }
      if (query.status && query.status !== 'all') {
        items = items.filter((s) => s.status === query.status);
      }
      if (query.groupId) {
        const ids = new Set(
          state.enrollments
            .filter((e) => e.groupId === query.groupId && e.active !== false)
            .map((e) => e.studentId),
        );
        items = items.filter((s) => ids.has(s.id));
      }
      if (query.grade) items = items.filter((s) => s.grade === query.grade);
      if (query.dues === '1') items = items.filter((s) => s.balance > 0);
      if (query.birthMonth) {
        items = items.filter((s) => String(s.birthDate || '').slice(5, 7) === String(query.birthMonth).padStart(2, '0'));
      }
      const sort = query.sort || 'name';
      const dir = query.dir === 'desc' ? -1 : 1;
      const sorters = {
        name: (a, b) => a.name.localeCompare(b.name, 'ar'),
        balance: (a, b) => a.balance - b.balance,
        joined: (a, b) => String(a.joinedAt).localeCompare(String(b.joinedAt)),
        attendance: (a, b) => a.attendanceRate - b.attendanceRate,
      };
      items.sort(sorters[sort] || sorters.name);
      if (dir === -1) items.reverse();
      const summary = {
        total: state.students.length,
        active: state.students.filter((s) => s.status === 'active').length,
        paused: state.students.filter((s) => s.status === 'paused').length,
        dues: domain.round2(items.reduce((t, s) => t + Math.max(0, s.balance), 0)),
        debtors: items.filter((s) => s.balance > 0).length,
      };
      const page = paginate(items, query, 200, 500);
      return {
        ...page,
        summary,
        grades: [...new Set(state.students.map((s) => s.grade).filter(Boolean))].sort(),
      };
    },
  },
  {
    method: 'POST',
    path: '/api/students',
    handler: (ctx) => {
      const data = validateStudent(ctx.body);
      const groupIds = Array.isArray(ctx.body.groupIds) ? [...new Set(ctx.body.groupIds)] : [];
      return ctx.mutate((state) => {
        if (data.phone && state.students.some((s) => s.phone && s.phone === data.phone)) {
          throw fail(409, 'في طالب تاني مسجل بنفس رقم الموبايل', 'DUPLICATE', {
            phone: 'الرقم مستخدم بالفعل',
          });
        }
        const student = {
          id: id('stu'),
          name: data.name,
          shortName: data.shortName,
          gender: data.gender,
          phone: data.phone || '',
          parentName: data.parentName || '',
          parentPhone: data.parentPhone || '',
          email: data.email || '',
          school: data.school || '',
          grade: data.grade || '',
          birthDate: data.birthDate || '',
          address: data.address || '',
          avatarColor: data.avatarColor || '#2f6f5e',
          status: data.status,
          joinedAt: data.joinedAt,
          balanceStart: data.balanceStart || 0,
          notes: data.notes || '',
          createdAt: nowISO(),
        };
        state.students.push(student);
        for (const groupId of groupIds) attachEnrollment(state, student.id, groupId, student.joinedAt);
        log(state, ctx.user, 'student.create', 'student', student.id, `إضافة الطالب ${student.name}`);
        const balances = domain.balanceMap(state);
        return { student: domain.studentCard(state, student, balances) };
      });
    },
  },
  {
    method: 'GET',
    path: '/api/students/:id',
    handler: (ctx) => {
      const student = findStudent(ctx.state, ctx.params.id);
      return domain.studentProfile(ctx.state, student);
    },
  },
  {
    method: 'PATCH',
    path: '/api/students/:id',
    handler: (ctx) => {
      const student = findStudent(ctx.state, ctx.params.id);
      const data = validateStudent(ctx.body, { partial: true, student });
      return ctx.mutate((state) => {
        const target = findStudent(state, student.id);
        if (
          data.phone &&
          state.students.some((s) => s.id !== target.id && s.phone && s.phone === data.phone)
        ) {
          throw fail(409, 'في طالب تاني مسجل بنفس رقم الموبايل', 'DUPLICATE', {
            phone: 'الرقم مستخدم بالفعل',
          });
        }
        Object.assign(target, data, { updatedAt: nowISO() });
        log(state, ctx.user, 'student.update', 'student', target.id, `تعديل بيانات ${target.name}`);
        return { student: domain.studentCard(state, target, domain.balanceMap(state)) };
      });
    },
  },
  {
    method: 'DELETE',
    path: '/api/students/:id',
    adminOnly: true,
    handler: (ctx) => {
      const student = findStudent(ctx.state, ctx.params.id);
      return ctx.mutate((state) => {
        const studentId = student.id;
        state.students = state.students.filter((s) => s.id !== studentId);
        state.enrollments = state.enrollments.filter((e) => e.studentId !== studentId);
        state.attendance = state.attendance.filter((a) => a.studentId !== studentId);
        state.charges = state.charges.filter((c) => c.studentId !== studentId);
        state.payments = state.payments.filter((p) => p.studentId !== studentId);
        state.grades = state.grades.filter((g) => g.studentId !== studentId);
        state.notes = state.notes.filter((n) => n.studentId !== studentId);
        log(state, ctx.user, 'student.delete', 'student', studentId, `حذف الطالب ${student.name}`);
        return { ok: true };
      });
    },
  },
  {
    method: 'GET',
    path: '/api/students/:id/statement',
    handler: (ctx) => {
      const student = findStudent(ctx.state, ctx.params.id);
      const profile = domain.studentProfile(ctx.state, student);
      return {
        student: {
          id: student.id,
          name: student.name,
          shortName: student.shortName,
          phone: student.phone,
          parentName: student.parentName,
          parentPhone: student.parentPhone,
        },
        balance: profile.balance,
        charged: profile.charged,
        paid: profile.paid,
        credit: profile.credit,
        ledger: profile.ledger,
        payments: profile.payments,
        generatedAt: nowISO(),
      };
    },
  },
  {
    method: 'POST',
    path: '/api/students/:id/enrollments',
    handler: (ctx) => {
      const student = findStudent(ctx.state, ctx.params.id);
      if (!ctx.body.groupId) throw fail(422, 'اختار المجموعة', 'VALIDATION', { groupId: 'مطلوب' });
      return ctx.mutate((state) => {
        const group = findGroup(state, ctx.body.groupId);
        const enrollment = attachEnrollment(state, student.id, group.id, ctx.body.joinedAt);
        log(state, ctx.user, 'enrollment.create', 'group', group.id, `إضافة ${student.name} لمجموعة ${group.name}`);
        return { enrollment, group: domain.groupCard(state, group, domain.balanceMap(state)) };
      });
    },
  },
  {
    method: 'DELETE',
    path: '/api/students/:id/enrollments/:groupId',
    handler: (ctx) => {
      const student = findStudent(ctx.state, ctx.params.id);
      return ctx.mutate((state) => {
        const enrollment = state.enrollments.find(
          (e) => e.studentId === student.id && e.groupId === ctx.params.groupId,
        );
        if (!enrollment) throw fail(404, 'الطالب مش مسجل في المجموعة دي', 'NOT_FOUND');
        enrollment.active = false;
        enrollment.leftAt = todayISO();
        log(state, ctx.user, 'enrollment.remove', 'student', student.id, `إخراج ${student.name} من مجموعة`);
        return { ok: true };
      });
    },
  },
  {
    method: 'POST',
    path: '/api/students/:id/notes',
    handler: (ctx) => {
      const student = findStudent(ctx.state, ctx.params.id);
      const body = str(ctx.body.body, { required: true, field: 'الملاحظة', min: 2, max: 1200 });
      return ctx.mutate((state) => {
        const note = {
          id: id('not'),
          studentId: student.id,
          body,
          pinned: Boolean(ctx.body.pinned),
          createdBy: ctx.user.id,
          createdAt: nowISO(),
        };
        state.notes.unshift(note);
        log(state, ctx.user, 'note.create', 'student', student.id, `ملاحظة على ${student.shortName}`);
        return { note };
      });
    },
  },
  {
    method: 'PATCH',
    path: '/api/students/:id/notes/:noteId',
    handler: (ctx) => {
      const student = findStudent(ctx.state, ctx.params.id);
      return ctx.mutate((state) => {
        const note = state.notes.find((n) => n.id === ctx.params.noteId && n.studentId === student.id);
        if (!note) throw fail(404, 'الملاحظة مش موجودة', 'NOT_FOUND');
        if (ctx.body.body !== undefined) {
          note.body = str(ctx.body.body, { required: true, min: 2, max: 1200, field: 'الملاحظة' });
        }
        if (ctx.body.pinned !== undefined) note.pinned = Boolean(ctx.body.pinned);
        note.updatedAt = nowISO();
        return { note };
      });
    },
  },
  {
    method: 'DELETE',
    path: '/api/students/:id/notes/:noteId',
    handler: (ctx) => {
      const student = findStudent(ctx.state, ctx.params.id);
      return ctx.mutate((state) => {
        const before = state.notes.length;
        state.notes = state.notes.filter(
          (n) => !(n.id === ctx.params.noteId && n.studentId === student.id),
        );
        if (state.notes.length === before) throw fail(404, 'الملاحظة مش موجودة', 'NOT_FOUND');
        return { ok: true };
      });
    },
  },
  {
    method: 'GET',
    path: '/api/students/:id/reminder',
    handler: (ctx) => {
      const student = findStudent(ctx.state, ctx.params.id);
      const kind = ctx.query.kind === 'lesson' ? 'lesson' : 'payment';
      return domain.reminderFor(ctx.state, student, kind);
    },
  },
  {
    method: 'GET',
    path: '/api/students/:id/attendance',
    handler: (ctx) => {
      const student = findStudent(ctx.state, ctx.params.id);
      const profile = domain.studentProfile(ctx.state, student);
      return { attendance: profile.attendance };
    },
  },
  {
    method: 'DELETE',
    path: '/api/notes/:id',
    adminOnly: true,
    handler: (ctx) => {
      ensureAdmin(ctx.user);
      return ctx.mutate((state) => {
        const before = state.notes.length;
        state.notes = state.notes.filter((n) => n.id !== ctx.params.id);
        if (state.notes.length === before) throw fail(404, 'الملاحظة مش موجودة', 'NOT_FOUND');
        return { ok: true };
      });
    },
  },
  {
    method: 'POST',
    path: '/api/students/:id/reenroll',
    handler: (ctx) => {
      const student = findStudent(ctx.state, ctx.params.id);
      return ctx.mutate((state) => {
        const target = findStudent(state, student.id);
        if (target.status === 'active') throw fail(409, 'الطالب نشط بالفعل', 'ALREADY_ACTIVE');
        target.status = 'active';
        target.joinedAt = todayISO();
        target.reenrolledAt = nowISO();
        log(state, ctx.user, 'student.reenroll', 'student', target.id, `إعادة تفعيل ${target.name}`);
        return { student: domain.studentCard(state, target, domain.balanceMap(state)) };
      });
    },
  },
];

module.exports.attachEnrollment = attachEnrollment;
