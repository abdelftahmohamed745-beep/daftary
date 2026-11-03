'use strict';

const crypto = require('crypto');

class AppError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields || null;
  }
}

const fail = (status, message, code = 'BAD_REQUEST', fields) =>
  new AppError(status, code, message, fields);

const id = (prefix) => `${prefix}_${crypto.randomBytes(8).toString('hex')}`;

const nowISO = () => new Date().toISOString();

const todayISO = (date = new Date()) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
};

const monthKey = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const startOfWeek = (value = new Date(), weekStart = 6) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() - weekStart + 7) % 7;
  return addDays(d, -diff);
};

const timeToMinutes = (time) => {
  const [h, m] = String(time || '00:00').split(':').map(Number);
  return h * 60 + (m || 0);
};

const minutesToTime = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

const overlaps = (aStart, aDuration, bStart, bDuration) => {
  const a1 = timeToMinutes(aStart);
  const a2 = a1 + Number(aDuration || 60);
  const b1 = timeToMinutes(bStart);
  const b2 = b1 + Number(bDuration || 60);
  return a1 < b2 && b1 < a2;
};

const str = (value, { min = 0, max = 500, field = 'القيمة', required = false } = {}) => {
  if (value === undefined || value === null) value = '';
  const out = String(value).trim();
  if (required && !out) throw fail(422, `${field} مطلوب`, 'VALIDATION', { [field]: `${field} مطلوب` });
  if (out.length < min) throw fail(422, `${field} قصير أوي`, 'VALIDATION', { [field]: `${field} قصير أوي` });
  if (out.length > max) throw fail(422, `${field} طويل أوي`, 'VALIDATION', { [field]: `${field} طويل أوي` });
  return out;
};

const num = (value, { min = -Infinity, max = Infinity, field = 'القيمة', required = false } = {}) => {
  if (value === '' || value === undefined || value === null) {
    if (required) throw fail(422, `${field} مطلوب`, 'VALIDATION', { [field]: `${field} مطلوب` });
    return null;
  }
  const out = Number(value);
  if (!Number.isFinite(out)) throw fail(422, `${field} لازم يكون رقم`, 'VALIDATION', { [field]: `${field} لازم يكون رقم` });
  if (out < min) throw fail(422, `${field} لازم يكون ${min} على الأقل`, 'VALIDATION', { [field]: `${field} صغير أوي` });
  if (out > max) throw fail(422, `${field} كبير أوي`, 'VALIDATION', { [field]: `${field} كبير أوي` });
  return out;
};

const oneOf = (value, list, field = 'القيمة', fallback) => {
  if ((value === undefined || value === null || value === '') && fallback !== undefined) return fallback;
  if (!list.includes(value)) throw fail(422, `${field} غير صحيح`, 'VALIDATION', { [field]: 'اختيار غير صحيح' });
  return value;
};

const dateStr = (value, field = 'التاريخ', { required = false } = {}) => {
  if (!value) {
    if (required) throw fail(422, `${field} مطلوب`, 'VALIDATION', { [field]: `${field} مطلوب` });
    return null;
  }
  const out = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out) || Number.isNaN(Date.parse(`${out}T00:00:00`))) {
    throw fail(422, `${field} غير صحيح`, 'VALIDATION', { [field]: `${field} غير صحيح` });
  }
  return out;
};

const timeStr = (value, field = 'الوقت', { required = false } = {}) => {
  if (!value) {
    if (required) throw fail(422, `${field} مطلوب`, 'VALIDATION', { [field]: `${field} مطلوب` });
    return null;
  }
  const out = String(value).slice(0, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(out)) {
    throw fail(422, `${field} غير صحيح`, 'VALIDATION', { [field]: `${field} غير صحيح` });
  }
  return out;
};

const phone = (value, { required = false } = {}) => {
  const out = str(value, { max: 30, field: 'الموبايل' });
  if (!out && !required) return '';
  const digits = out.replace(/[^\d+]/g, '');
  if (digits.length < 8) throw fail(422, 'رقم الموبايل مش صحيح', 'VALIDATION', { phone: 'رقم الموبايل مش صحيح' });
  return out;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const sum = (items, pick) => items.reduce((total, item) => total + (Number(pick(item)) || 0), 0);

const escapeCsv = (value) => {
  const out = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(out) ? `"${out.replace(/"/g, '""')}"` : out;
};

const csv = (headers, rows) => {
  const lines = [headers.map(escapeCsv).join(',')];
  for (const row of rows) lines.push(row.map(escapeCsv).join(','));
  return lines.join('\r\n') + '\r\n';
};

module.exports = {
  AppError,
  fail,
  id,
  nowISO,
  todayISO,
  monthKey,
  addDays,
  startOfWeek,
  timeToMinutes,
  minutesToTime,
  overlaps,
  str,
  num,
  oneOf,
  dateStr,
  timeStr,
  phone,
  clamp,
  sum,
  csv,
};
