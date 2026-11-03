'use strict';

const {
  AppError,
  fail,
  nowISO,
  todayISO,
  dateStr,
  csv,
} = require('../lib/utils');

const MAX_ACTIVITY = 1200;

function log(state, user, action, entity, entityId, detail) {
  state.activities.unshift({
    id: `act_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
    actorId: user ? user.id : 'system',
    actorName: user ? user.name : 'النظام',
    action,
    entity,
    entityId: entityId || null,
    detail: detail || '',
    at: nowISO(),
  });
  if (state.activities.length > MAX_ACTIVITY) state.activities.length = MAX_ACTIVITY;
}

function findStudent(state, id) {
  const student = state.students.find((s) => s.id === id);
  if (!student) throw fail(404, 'الطالب مش موجود', 'NOT_FOUND');
  return student;
}

function findGroup(state, id) {
  const group = state.groups.find((g) => g.id === id);
  if (!group) throw fail(404, 'المجموعة مش موجودة', 'NOT_FOUND');
  return group;
}

function findLesson(state, id) {
  const lesson = state.lessons.find((l) => l.id === id);
  if (!lesson) throw fail(404, 'الحصة مش موجودة', 'NOT_FOUND');
  return lesson;
}

function findCharge(state, id) {
  const charge = state.charges.find((c) => c.id === id);
  if (!charge) throw fail(404, 'المستحق مش موجود', 'NOT_FOUND');
  return charge;
}

function findPayment(state, id) {
  const payment = state.payments.find((p) => p.id === id);
  if (!payment) throw fail(404, 'الدفعة مش موجودة', 'NOT_FOUND');
  return payment;
}

function findAssignment(state, id) {
  const assignment = state.assignments.find((a) => a.id === id);
  if (!assignment) throw fail(404, 'الواجب مش موجود', 'NOT_FOUND');
  return assignment;
}

function findMaterial(state, id) {
  const material = state.materials.find((m) => m.id === id);
  if (!material) throw fail(404, 'المادة مش موجودة', 'NOT_FOUND');
  return material;
}

function paginate(items, query, defaultLimit = 200, maxLimit = 500) {
  const total = items.length;
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || defaultLimit));
  const page = Math.max(1, Number(query.page) || 1);
  const start = (page - 1) * limit;
  return { items: items.slice(start, start + limit), total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

function dateRange(query, fallbackDays = 30) {
  const to = dateStr(query.to) || todayISO();
  const from =
    dateStr(query.from) ||
    todayISO(new Date(new Date(`${to}T00:00:00`).getTime() - fallbackDays * 86400000));
  if (from > to) throw fail(422, 'تاريخ البداية بعد النهاية', 'VALIDATION');
  return { from, to };
}

function csvResult(text, filename) {
  return { __csv: `\ufeff${text}`, filename };
}

function toCsv(headers, rows) {
  return csv(headers, rows);
}

function searchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .trim();
}

function matches(value, needle) {
  if (!needle) return true;
  return searchText(value).includes(needle);
}

function ensureAdmin(user) {
  if (!user || user.role !== 'admin') throw fail(403, 'الصلاحية دي للمدير بس', 'FORBIDDEN');
}

module.exports = {
  AppError,
  fail,
  log,
  findStudent,
  findGroup,
  findLesson,
  findCharge,
  findPayment,
  findAssignment,
  findMaterial,
  paginate,
  dateRange,
  csvResult,
  toCsv,
  searchText,
  matches,
  ensureAdmin,
};
