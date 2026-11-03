'use strict';

const fs = require('fs');
const path = require('path');
const { seed } = require('./seed');
const { hashPassword } = require('./passwords');
const { nowISO, todayISO, addDays } = require('./utils');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.DAFTARY_DATA_DIR
  ? path.resolve(process.env.DAFTARY_DATA_DIR)
  : path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

const COLLECTIONS = [
  'users',
  'students',
  'groups',
  'enrollments',
  'lessons',
  'attendance',
  'charges',
  'payments',
  'expenses',
  'assignments',
  'grades',
  'materials',
  'notes',
  'exams',
  'examResults',
  'points',
  'certificates',
  'shifts',
  'treasury',
  'codes',
  'syncLogs',
  'activities',
  'sessions',
];

const DEFAULT_PASSWORD = process.env.DAFTARY_DEMO_PASSWORD || 'Daftary@123';
const MAX_BACKUPS = 25;

let state = null;
let loadedAt = null;

function ensureDirs() {
  for (const dir of [DATA_DIR, UPLOAD_DIR, BACKUP_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function normalize(input) {
  const out = input && typeof input === 'object' ? input : {};
  out.version = Number(out.version) || 1;
  out.createdAt = out.createdAt || nowISO();
  out.updatedAt = out.updatedAt || out.createdAt;
  const baseSettings = seedSettingsDefaults();
  const savedSettings = out.settings || {};
  out.settings = {
    ...baseSettings,
    ...savedSettings,
    platform: { ...baseSettings.platform, ...(savedSettings.platform || {}) },
    sync: { ...baseSettings.sync, ...(savedSettings.sync || {}) },
    points: { ...baseSettings.points, ...(savedSettings.points || {}) },
    portal: { ...baseSettings.portal, ...(savedSettings.portal || {}) },
  };
  for (const key of COLLECTIONS) {
    if (!Array.isArray(out[key])) out[key] = [];
  }
  out.users = out.users.map((u) => ({
    active: true,
    role: 'assistant',
    avatarColor: '#2f6f5e',
    ...u,
  }));
  out.students = out.students.map((s) => ({
    status: 'active',
    balanceStart: 0,
    ...s,
  }));

  // Every student gets a stable human-readable code used for ID cards,
  // barcode attendance and the public parent portal.
  const used = new Set(out.students.map((s) => String(s.code || '').trim()).filter(Boolean));
  const year = new Date().getFullYear();
  const prefix = String(out.settings.barcodePrefix || 'DFT').replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'DFT';
  let serial = 0;
  out.students = out.students.map((s) => {
    if (s.code) return s;
    let code;
    do {
      serial += 1;
      code = `${prefix}-${year}-${String(serial).padStart(4, '0')}`;
    } while (used.has(code));
    used.add(code);
    return { ...s, code };
  });

  out.exams = out.exams.map((e) => ({
    type: 'exam',
    status: 'draft',
    duration: 60,
    passScore: 0,
    ...e,
    passScore: Number(e.passScore) || Math.round((Number(e.maxScore) || 20) * 0.5),
  }));
  out.examResults = out.examResults.map((r) => ({ note: '', ...r }));
  out.points = out.points.map((p) => ({
    category: 'manual',
    reason: '',
    ...p,
    points: Number(p.points) || 0,
  }));
  out.certificates = out.certificates.map((c) => ({ status: 'active', kind: 'custom', ...c }));
  out.shifts = out.shifts.map((s) => ({ status: 'open', note: '', ...s }));
  out.treasury = out.treasury.map((t) => ({ type: 'deposit', method: 'cash', ...t }));
  out.codes = out.codes.map((c) => ({ status: 'unused', plan: 'monthly', days: 30, ...c }));
  return out;
}

function seedSettingsDefaults() {
  return {
    centerName: 'مركز دفتري',
    teacherName: 'أ. محمود حسن',
    phone: '01001234567',
    email: 'hello@daftary.app',
    address: '١٢ شارع التحرير — الدقي، الجيزة',
    currency: 'ج.م',
    weekStart: 6,
    invoicePrefix: 'DFT',
    reminderTemplate:
      'أهلاً {parent}، فاكرينك بموعد حصة {student} مع {teacher} يوم {date} الساعة {time}. لو محتاج تأجيل كلمنا.',
    paymentTemplate:
      'أهلاً {parent}، متبقي على {student} مبلغ {amount} {currency}. تقدر تحوّل على {phone} أو تدفع في المركز. شكراً ليك.',
    theme: 'light',
    lessonDuration: 90,
    currencyPosition: 'after',
    academicYear: '٢٠٢٥ / ٢٠٢٦',
    barcodePrefix: 'DFT',
    certificateSigner: 'أ. محمود حسن',
    certificateNote: 'شهادة معتمدة من مركز دفتري — تُطبع نسخة واحدة لكل طالب.',
    portalMessage: 'أهلاً بيكم في بوابة الطالب. اكتب كود الطالب اللي على الكارنيه عشان تشوف الحضور والدرجات والشهادات.',
    enablePortal: true,
    autoBackup: true,
    points: { present: 5, late: 2, absent: -3, excused: 0, grade: 10 },
    portal: { showBalance: false, showExams: true, showAttendance: true, showCertificates: true },
    sync: { enabled: false, folder: '', intervalMinutes: 60, lastSyncAt: null },
    platform: {
      plan: 'trial',
      status: 'active',
      activatedAt: nowISO(),
      expiresAt: todayISO(addDays(new Date(), 30)),
      licenseKey: '',
      device: 'جهاز المركز',
    },
  };
}

function prepareSeed() {
  const fresh = seed();
  fresh.createdAt = nowISO();
  fresh.updatedAt = fresh.createdAt;
  for (const user of fresh.users) {
    const { salt, passwordHash } = hashPassword(DEFAULT_PASSWORD);
    user.salt = salt;
    user.passwordHash = passwordHash;
  }
  fresh.meta = { seededAt: nowISO(), demoPassword: DEFAULT_PASSWORD };
  return normalize(fresh);
}

function pruneBackups() {
  try {
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((name) => name.startsWith('db-') && name.endsWith('.json'))
      .sort();
    for (const name of files.slice(0, Math.max(0, files.length - MAX_BACKUPS))) {
      fs.unlinkSync(path.join(BACKUP_DIR, name));
    }
  } catch {
    /* ignore */
  }
}

function backup(label = 'auto') {
  ensureDirs();
  if (!fs.existsSync(DB_FILE)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = `db-${stamp}-${label}.json`;
  const dest = path.join(BACKUP_DIR, name);
  fs.copyFileSync(DB_FILE, dest);
  pruneBackups();
  return dest;
}

function atomicWrite(file, content) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, file);
}

function save() {
  if (!state) return;
  ensureDirs();
  state.updatedAt = nowISO();
  atomicWrite(DB_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

function load({ backupOnStart = true } = {}) {
  ensureDirs();
  if (!fs.existsSync(DB_FILE)) {
    state = prepareSeed();
    atomicWrite(DB_FILE, `${JSON.stringify(state, null, 2)}\n`);
  } else {
    if (backupOnStart) backup('startup');
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      state = normalize(JSON.parse(raw));
    } catch (error) {
      const broken = path.join(BACKUP_DIR, `db-broken-${Date.now()}.json`);
      try {
        fs.copyFileSync(DB_FILE, broken);
      } catch {
        /* ignore */
      }
      throw new Error(`ملف الداتا بايظ: ${error.message}. نسخة محفوظة في ${broken}`);
    }
    // Make sure seeded users get a usable password if they never had one.
    let changed = false;
    for (const user of state.users) {
      if (!user.passwordHash) {
        const { salt, passwordHash } = hashPassword(DEFAULT_PASSWORD);
        user.salt = salt;
        user.passwordHash = passwordHash;
        changed = true;
      }
    }
    if (changed) save();
  }
  // Drop expired sessions on boot.
  const now = Date.now();
  const before = state.sessions.length;
  state.sessions = state.sessions.filter((s) => new Date(s.expiresAt).getTime() > now);
  if (state.sessions.length !== before) save();
  loadedAt = nowISO();
  return state;
}

function get() {
  if (!state) load();
  return state;
}

function mutate(fn) {
  const current = get();
  const result = fn(current);
  save();
  return result;
}

function replace(next, { label = 'restore' } = {}) {
  ensureDirs();
  backup(label);
  state = normalize(next);
  state.updatedAt = nowISO();
  atomicWrite(DB_FILE, `${JSON.stringify(state, null, 2)}\n`);
  return state;
}

function reset() {
  ensureDirs();
  if (fs.existsSync(DB_FILE)) backup('before-reset');
  state = prepareSeed();
  atomicWrite(DB_FILE, `${JSON.stringify(state, null, 2)}\n`);
  return state;
}

function listBackups() {
  ensureDirs();
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const full = path.join(BACKUP_DIR, name);
      const stat = fs.statSync(full);
      return { name, size: stat.size, at: stat.mtime.toISOString() };
    })
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}

function readBackup(name) {
  const safe = path.basename(String(name || ''));
  if (!safe.endsWith('.json')) throw new Error('اسم النسخة غير صحيح');
  const full = path.join(BACKUP_DIR, safe);
  if (!full.startsWith(BACKUP_DIR) || !fs.existsSync(full)) throw new Error('النسخة مش موجودة');
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function stats() {
  const s = get();
  const counts = {};
  for (const key of COLLECTIONS) counts[key] = s[key].length;
  return {
    file: DB_FILE,
    size: fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE).size : 0,
    loadedAt,
    today: todayISO(),
    counts,
  };
}

module.exports = {
  ROOT,
  DATA_DIR,
  DB_FILE,
  UPLOAD_DIR,
  BACKUP_DIR,
  DEFAULT_PASSWORD,
  COLLECTIONS,
  ensureDirs,
  normalize,
  load,
  get,
  save,
  mutate,
  replace,
  reset,
  backup,
  listBackups,
  readBackup,
  stats,
};
