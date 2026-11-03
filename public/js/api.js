'use strict';

export const DAYS = ['الأحد', 'الاتنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

export const AUTH_EVENT = 'daftary:auth';
let currency = 'ج.م';
let currencyPosition = 'after';

export function setCurrency(value, position = 'after') {
  if (value) currency = value;
  currencyPosition = position || 'after';
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDaysISO(iso, days) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function startOfWeekISO(iso = todayISO(), weekStart = 6) {
  const d = new Date(`${iso}T00:00:00`);
  const diff = (d.getDay() - weekStart + 7) % 7;
  return addDaysISO(iso, -diff);
}

export function parseISO(iso) {
  return new Date(`${String(iso).slice(0, 10)}T00:00:00`);
}

export function formatNumber(value, decimals = 0) {
  const n = Number(value) || 0;
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function money(value, { decimals = 0, sign = false, bare = false } = {}) {
  const n = Number(value) || 0;
  const text = formatNumber(Math.abs(n), decimals);
  const prefix = n < 0 ? '−' : sign && n > 0 ? '+' : '';
  const unit = bare ? '' : currency;
  // Isolate the sign + digits so the minus never swaps sides in RTL text.
  const amount = `\u2066${prefix}${text}\u2069`;
  const body = currencyPosition === 'before' ? `${unit} ${amount}` : `${amount} ${unit}`;
  return body.trim();
}

export function compactMoney(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const prefix = n < 0 ? '−' : '';
  if (abs >= 1000000) return `\u2066${prefix}${formatNumber(abs / 1000000, 1)}\u2069 مليون`;
  if (abs >= 10000) return `\u2066${prefix}${formatNumber(abs / 1000, 1)}\u2069 ألف`;
  return `\u2066${prefix}${formatNumber(abs)}\u2069`;
}

export function chartDayLabel(iso) {
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return iso || '';
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

export function dateLong(iso) {
  if (!iso) return '';
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function dateFull(iso) {
  if (!iso) return '';
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function dateShort(iso) {
  if (!iso) return '';
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const label = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? label : `${label} ${d.getFullYear()}`;
}

export function dayName(iso) {
  const d = parseISO(iso);
  return DAYS[d.getDay()] || '';
}

export function relativeDay(iso) {
  if (!iso) return '';
  const today = todayISO();
  if (iso === today) return 'النهارده';
  if (iso === addDaysISO(today, 1)) return 'بكرة';
  if (iso === addDaysISO(today, -1)) return 'إمبارح';
  return dateLong(iso);
}

export function timeLabel(time) {
  if (!time) return '';
  const [h, m] = String(time).split(':').map(Number);
  const suffix = h >= 12 ? 'م' : 'ص';
  const hour = h % 12 || 12;
  return `${hour}:${String(m || 0).padStart(2, '0')} ${suffix}`;
}

export function monthKey(value = new Date()) {
  const d = value instanceof Date ? value : parseISO(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key) {
  if (!key) return '';
  const [year, month] = String(key).split('-');
  return `${MONTHS[Number(month) - 1] || month} ${year}`;
}

export function relativeTime(isoDateTime) {
  if (!isoDateTime) return '';
  const then = new Date(isoDateTime).getTime();
  const diff = Date.now() - then;
  if (Number.isNaN(then)) return '';
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'دلوقتي';
  if (mins < 60) return `من ${mins} دقيقة`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `من ${hours} ساعة`;
  const days = Math.round(hours / 24);
  if (days < 30) return `من ${days} يوم`;
  return dateFull(String(isoDateTime).slice(0, 10));
}

export function initials(name) {
  const parts = String(name || '')
    .replace(/^(أ\.|م\.|د\.)\s*/, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '؟';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[1][0]}`;
}

export function escapeHTML(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function whatsappLink(phone, text = '') {
  const clean = String(phone || '').replace(/\D/g, '').replace(/^0/, '20');
  return `https://wa.me/${clean}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function telLink(phone) {
  return `tel:${String(phone || '').replace(/[^\d+]/g, '')}`;
}

export const ATTENDANCE_LABELS = {
  present: 'حاضر',
  absent: 'غايب',
  late: 'متأخر',
  excused: 'بعذر',
  unmarked: 'لسه',
};

export const METHOD_LABELS = {
  cash: 'كاش',
  vodafone: 'فودافون كاش',
  instapay: 'إنستاباي',
  bank: 'تحويل بنكي',
  other: 'طريقة تانية',
};

export const EXPENSE_LABELS = {
  rent: 'إيجار',
  salaries: 'مرتبات',
  marketing: 'تسويق',
  materials: 'مواد وطباعة',
  transport: 'مواصلات',
  other: 'مصروفات تانية',
};

export const ASSIGNMENT_LABELS = {
  homework: 'واجب',
  quiz: 'كويز',
  exam: 'امتحان',
  project: 'مشروع',
};

export const STATUS_LABELS = {
  active: 'نشط',
  paused: 'موقوف',
  left: 'منسحب',
  scheduled: 'قادمة',
  done: 'خلصت',
  cancelled: 'ملغية',
  open: 'مفتوح',
  closed: 'مقفول',
};

export function statusBadge(status) {
  const label = STATUS_LABELS[status] || status || '';
  const map = {
    active: 'green',
    done: 'green',
    open: 'green',
    scheduled: 'blue',
    paused: 'amber',
    closed: 'gray',
    left: 'gray',
    cancelled: 'red',
  };
  return `<span class="badge ${map[status] || 'gray'} dot">${escapeHTML(label)}</span>`;
}

export function attendanceBadge(status) {
  const label = ATTENDANCE_LABELS[status] || status;
  const map = { present: 'green', absent: 'red', late: 'amber', excused: 'blue', unmarked: 'gray' };
  return `<span class="badge ${map[status] || 'gray'}">${escapeHTML(label)}</span>`;
}

export function attendanceColor(status) {
  return {
    present: 'var(--teal)',
    absent: 'var(--coral)',
    late: 'var(--saffron)',
    excused: 'var(--blue)',
    unmarked: 'var(--line-strong)',
  }[status] || 'var(--muted)';
}

export function percentage(part, total) {
  if (!total) return 0;
  return Math.round((Number(part) / Number(total)) * 100);
}

export function debounce(fn, wait = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function sortBy(list, picker, direction = 'asc') {
  const factor = direction === 'desc' ? -1 : 1;
  return [...list].sort((a, b) => {
    const av = picker(a);
    const bv = picker(b);
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
    return String(av ?? '').localeCompare(String(bv ?? ''), 'ar') * factor;
  });
}

/* ---------- API ---------- */

export const api = {
  onError: null,
  onUnauthorized: null,

  async request(path, { method = 'GET', body, headers = {}, signal } = {}) {
    const options = {
      method,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...headers },
      signal,
    };
    if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    let response;
    try {
      response = await fetch(path, options);
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      const message = 'مش قادر أوصل للسيرفر. اتأكد إنه شغال وجرب تاني.';
      if (this.onError) this.onError(message);
      throw new Error(message);
    }
    if (response.status === 401) {
      if (this.onUnauthorized) this.onUnauthorized();
      const error = new Error('لازم تسجل دخول');
      error.status = 401;
      throw error;
    }
    const type = response.headers.get('content-type') || '';
    if (!type.includes('application/json')) {
      if (!response.ok) {
        const message = 'حصلت مشكلة غير متوقعة';
        if (this.onError) this.onError(message);
        throw new Error(message);
      }
      return response;
    }
    const payload = await response.json();
    if (!response.ok) {
      const message = payload?.error?.message || 'حصلت مشكلة';
      const error = new Error(message);
      error.status = response.status;
      error.code = payload?.error?.code;
      error.fields = payload?.error?.fields;
      if (this.onError && response.status !== 401) this.onError(message);
      throw error;
    }
    return payload;
  },

  get(path, options) {
    return this.request(path, { ...options, method: 'GET' });
  },
  post(path, body, options) {
    return this.request(path, { ...options, method: 'POST', body });
  },
  patch(path, body, options) {
    return this.request(path, { ...options, method: 'PATCH', body });
  },
  delete(path, options) {
    return this.request(path, { ...options, method: 'DELETE' });
  },
};

export function downloadURL(url) {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
