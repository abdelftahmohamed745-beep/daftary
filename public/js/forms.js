'use strict';

import {
  api,
  money,
  dateFull,
  todayISO,
  timeLabel,
  escapeHTML,
  STATUS_LABELS,
  ATTENDANCE_LABELS,
} from './api.js';
import {
  icon,
  toast,
  openModal,
  formModal,
  confirmModal,
  collectForm,
  printHTML,
} from './ui.js';

/* ---------------- caches ---------------- */
let groupCache = null;
let studentCache = null;

export async function loadGroups(force = false) {
  if (!force && groupCache) return groupCache;
  const data = await api.get('/api/groups?status=all');
  groupCache = data.items || [];
  return groupCache;
}

export async function loadStudents(force = false) {
  if (!force && studentCache) return studentCache;
  const data = await api.get('/api/students?limit=500');
  studentCache = data.items || [];
  return studentCache;
}

export function clearCaches() {
  groupCache = null;
  studentCache = null;
}

/* ---------------- shared bits ---------------- */
const GENDER_OPTIONS = [
  { value: 'male', label: 'ولد' },
  { value: 'female', label: 'بنت' },
];
const STATUS_OPTIONS = [
  { value: 'active', label: 'نشط' },
  { value: 'paused', label: 'موقوف' },
  { value: 'left', label: 'منسحب' },
];
const METHOD_OPTIONS = [
  { value: 'cash', label: 'كاش' },
  { value: 'vodafone', label: 'فودافون كاش' },
  { value: 'instapay', label: 'إنستاباي' },
  { value: 'bank', label: 'تحويل بنكي' },
  { value: 'other', label: 'طريقة تانية' },
];
const CHARGE_TYPES = [
  { value: 'subscription', label: 'اشتراك' },
  { value: 'manual', label: 'مستحق يدوي' },
  { value: 'material', label: 'ملازم ومواد' },
  { value: 'exam', label: 'امتحان' },
  { value: 'other', label: 'حاجة تانية' },
];
const EXPENSE_CATEGORIES = [
  { value: 'rent', label: 'إيجار' },
  { value: 'salaries', label: 'مرتبات' },
  { value: 'marketing', label: 'تسويق' },
  { value: 'materials', label: 'مواد وطباعة' },
  { value: 'transport', label: 'مواصلات' },
  { value: 'other', label: 'مصروفات تانية' },
];
const ASSIGNMENT_TYPES = [
  { value: 'homework', label: 'واجب' },
  { value: 'quiz', label: 'كويز' },
  { value: 'exam', label: 'امتحان' },
  { value: 'project', label: 'مشروع' },
];

export function studentOptions(students, selected = '') {
  return `<option value="">اختار الطالب…</option>${students
    .map(
      (s) =>
        `<option value="${escapeHTML(s.id)}" ${s.id === selected ? 'selected' : ''}>${escapeHTML(
          s.name,
        )}${s.grade ? ` — ${escapeHTML(s.grade)}` : ''}</option>`,
    )
    .join('')}`;
}

export function groupOptions(groups, selected = '', placeholder = 'من غير مجموعة') {
  return `<option value="">${escapeHTML(placeholder)}</option>${groups
    .map(
      (g) =>
        `<option value="${escapeHTML(g.id)}" ${g.id === selected ? 'selected' : ''}>${escapeHTML(g.name)}</option>`,
    )
    .join('')}`;
}

/* ---------------- Students ---------------- */
export async function studentModal({ student = null, onSaved = null, defaults = {} } = {}) {
  const groups = await loadGroups();
  const isEdit = Boolean(student);
  const values = {
    name: '',
    shortName: '',
    gender: 'male',
    phone: '',
    parentName: '',
    parentPhone: '',
    email: '',
    school: '',
    grade: '',
    birthDate: '',
    address: '',
    status: 'active',
    joinedAt: todayISO(),
    balanceStart: 0,
    notes: '',
    ...defaults,
    ...(student || {}),
  };
  const enrolled = new Set((student?.groups || []).map((g) => g.id));

  const fields = [
    { name: 'name', label: 'اسم الطالب بالكامل', required: true, span: 2, placeholder: 'مثال: يوسف أحمد عبد الرحمن' },
    { name: 'shortName', label: 'الاسم المختصر', placeholder: 'يوسف أحمد' },
    { name: 'gender', label: 'النوع', type: 'select', options: GENDER_OPTIONS },
    { name: 'phone', label: 'موبايل الطالب', type: 'tel', inputmode: 'tel', placeholder: '01xxxxxxxxx', dir: 'ltr' },
    { name: 'grade', label: 'الصف الدراسي', placeholder: 'تانية ثانوي' },
    { name: 'parentName', label: 'اسم ولي الأمر' },
    { name: 'parentPhone', label: 'موبايل ولي الأمر', type: 'tel', inputmode: 'tel', placeholder: '01xxxxxxxxx' },
    { name: 'school', label: 'المدرسة' },
    { name: 'birthDate', label: 'تاريخ الميلاد', type: 'date' },
    { name: 'address', label: 'العنوان', span: 2 },
    { name: 'status', label: 'حالة الطالب', type: 'select', options: STATUS_OPTIONS },
    { name: 'joinedAt', label: 'تاريخ الانضمام', type: 'date' },
    ...(isEdit ? [] : [{ name: 'balanceStart', label: 'رصيد افتتاحي (عليه)', type: 'number', min: 0, step: '0.5', help: 'لو الطالب عليه فلوس من قبل النظام' }]),
    { name: 'email', label: 'الإيميل (اختياري)', type: 'email', dir: 'ltr', span: 2 },
    { name: 'notes', label: 'ملاحظات', type: 'textarea', span: 2, rows: 3 },
  ];

  const groupsHTML = groups.length
    ? `<div class="form-section-title">المجموعات</div>
      <div class="span-2 chips" style="gap:8px">
        ${groups
          .filter((g) => g.status !== 'archived')
          .map(
            (g) => `<label class="checkline" style="background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:7px 10px">
              <input type="checkbox" name="grp_${escapeHTML(g.id)}" ${enrolled.has(g.id) ? 'checked' : ''}>
              <span><span class="dot" style="display:inline-block;width:7px;height:7px;border-radius:3px;background:${escapeHTML(g.color)}"></span>
              ${escapeHTML(g.name)}</span>
            </label>`,
          )
          .join('')}
      </div>`
    : '';

  return formModal({
    title: isEdit ? 'تعديل بيانات الطالب' : 'طالب جديد',
    sub: isEdit ? student.name : 'املأ البيانات الأساسية، وتقدر تضيفه لمجموعة على طول.',
    wide: true,
    fields,
    values,
    extraBody: groupsHTML,
    submitText: isEdit ? 'حفظ التعديلات' : 'إضافة الطالب',
    onSubmit: async (raw) => {
      const groupIds = Object.keys(raw)
        .filter((key) => key.startsWith('grp_') && raw[key])
        .map((key) => key.slice(4));
      delete raw.balanceStart;
      for (const key of Object.keys(raw)) if (key.startsWith('grp_')) delete raw[key];
      const payload = { ...raw };
      if (isEdit) {
        await api.patch(`/api/students/${student.id}`, payload);
        if (groupIds.length || (student.groups || []).length) {
          const before = new Set((student.groups || []).map((g) => g.id));
          for (const id of groupIds) {
            if (!before.has(id)) await api.post(`/api/students/${student.id}/enrollments`, { groupId: id });
          }
          for (const id of before) {
            if (!groupIds.includes(id)) {
              await api.delete(`/api/students/${student.id}/enrollments/${id}`);
            }
          }
        }
        toast('تم تحديث بيانات الطالب');
      } else {
        await api.post('/api/students', { ...payload, groupIds });
        toast('الطالب اتضاف بنجاح');
      }
      clearCaches();
      if (onSaved) await onSaved();
    },
  });
}

/* ---------------- Payments ---------------- */
export async function paymentModal({ studentId = '', onSaved = null, presetAmount = null } = {}) {
  const students = await loadStudents();
  if (!students.length) {
    toast('ضيف طالب الأول', 'error');
    return;
  }
  const selected = students.find((s) => s.id === studentId);
  const balance = selected ? Math.max(0, selected.balance) : 0;
  return formModal({
    title: 'تسجيل دفعة',
    sub: 'الدفعة بتتخصم من أقدم المستحقات تلقائي.',
    fields: [
      {
        name: 'studentId',
        label: 'الطالب',
        type: 'select',
        options: students.map((s) => ({ value: s.id, label: `${s.name}${s.balance > 0 ? ` — عليه ${money(s.balance)}` : ''}` })),
        required: true,
        span: 2,
      },
      { name: 'amount', label: 'المبلغ', type: 'number', min: 0.5, step: '0.5', required: true, value: presetAmount ?? (balance || '') },
      { name: 'method', label: 'طريقة الدفع', type: 'select', options: METHOD_OPTIONS, required: true },
      { name: 'date', label: 'التاريخ', type: 'date', required: true },
      { name: 'note', label: 'ملاحظة (اختياري)', placeholder: 'مثال: دفعة شهر نوفمبر' },
    ],
    values: {
      studentId: studentId || '',
      amount: presetAmount ?? (balance || ''),
      method: 'cash',
      date: todayISO(),
      note: '',
    },
    submitText: 'تسجيل الدفعة',
    note: selected && balance ? `متبقي على <b>${escapeHTML(selected.name)}</b> حوالي <b>${money(balance)}</b>` : '',
    onSubmit: async (values) => {
      const data = await api.post('/api/payments', values);
      toast(`تم تسجيل ${money(data.payment.amount)} — الإيصال ${data.payment.receiptNo}`);
      if (onSaved) await onSaved(data.payment);
      else window.dispatchEvent(new CustomEvent('daftary:data-changed'));
    },
  });
}

/* ---------------- Charges ---------------- */
export async function chargeModal({ studentId = '', onSaved = null } = {}) {
  const [students, groups] = await Promise.all([loadStudents(), loadGroups()]);
  if (!students.length) {
    toast('ضيف طالب الأول', 'error');
    return;
  }
  return formModal({
    title: 'مستحق جديد',
    sub: 'أي مبلغ على الطالب — اشتراك، ملازم، امتحان، أو حاجة يدوية.',
    fields: [
      {
        name: 'studentId',
        label: 'الطالب',
        type: 'select',
        options: students.map((s) => ({ value: s.id, label: s.name })),
        required: true,
        span: 2,
      },
      { name: 'title', label: 'البيان', required: true, placeholder: 'اشتراك نوفمبر — رياضيات', span: 2 },
      { name: 'amount', label: 'المبلغ', type: 'number', min: 1, step: '0.5', required: true },
      { name: 'dueDate', label: 'تاريخ الاستحقاق', type: 'date', required: true },
      { name: 'type', label: 'النوع', type: 'select', options: CHARGE_TYPES },
      {
        name: 'groupId',
        label: 'المجموعة (اختياري)',
        type: 'select',
        options: groups.map((g) => ({ value: g.id, label: g.name })),
      },
      { name: 'month', label: 'شهر الاشتراك', type: 'month', help: 'بس للاشتراكات' },
      { name: 'note', label: 'ملاحظة', span: 2 },
    ],
    values: {
      studentId: studentId || '',
      title: '',
      amount: '',
      dueDate: todayISO(),
      type: 'subscription',
      groupId: '',
      month: todayISO().slice(0, 7),
      note: '',
    },
    submitText: 'إضافة المستحق',
    onSubmit: async (values) => {
      const data = await api.post('/api/charges', values);
      toast(`تم إضافة مستحق ${money(data.charge.amount)}`);
      if (onSaved) await onSaved(data.charge);
      else window.dispatchEvent(new CustomEvent('daftary:data-changed'));
    },
  });
}

/* ---------------- Expenses ---------------- */
export async function expenseModal({ onSaved = null } = {}) {
  return formModal({
    title: 'مصروف جديد',
    sub: 'سجّل أي فلوس خارجة من المركز.',
    fields: [
      { name: 'title', label: 'البيان', required: true, span: 2, placeholder: 'مثال: إيجار القاعة — نوفمبر' },
      { name: 'amount', label: 'المبلغ', type: 'number', min: 0.5, step: '0.5', required: true },
      { name: 'category', label: 'النوع', type: 'select', options: EXPENSE_CATEGORIES, required: true },
      { name: 'date', label: 'التاريخ', type: 'date', required: true },
      { name: 'note', label: 'ملاحظة', span: 2 },
    ],
    values: { title: '', amount: '', category: 'other', date: todayISO(), note: '' },
    submitText: 'تسجيل المصروف',
    onSubmit: async (values) => {
      await api.post('/api/expenses', values);
      toast('تم تسجيل المصروف');
      if (onSaved) await onSaved();
      else window.dispatchEvent(new CustomEvent('daftary:data-changed'));
    },
  });
}

/* ---------------- Lessons ---------------- */
export async function lessonModal({ lesson = null, groupId = '', date = '', onSaved = null } = {}) {
  const groups = await loadGroups();
  const isEdit = Boolean(lesson);
  return formModal({
    title: isEdit ? 'تعديل الحصة' : 'حصة جديدة',
    sub: isEdit ? `${lesson.date} — ${lesson.groupName || ''}` : 'حدد المجموعة والوقت والتاريخ.',
    fields: [
      {
        name: 'groupId',
        label: 'المجموعة',
        type: 'select',
        required: true,
        span: 2,
        options: groups
          .filter((g) => g.status === 'active' || (lesson && g.id === lesson.groupId))
          .map((g) => ({ value: g.id, label: `${g.name} — ${g.subject}` })),
      },
      { name: 'date', label: 'التاريخ', type: 'date', required: true },
      { name: 'start', label: 'وقت البداية', type: 'time', required: true },
      { name: 'duration', label: 'المدة (دقيقة)', type: 'number', min: 15, max: 300, step: 5 },
      { name: 'status', label: 'الحالة', type: 'select', options: [
        { value: 'scheduled', label: 'قادمة' },
        { value: 'done', label: 'خلصت' },
        { value: 'cancelled', label: 'ملغية' },
      ] },
      { name: 'topic', label: 'موضوع الحصة', span: 2, placeholder: 'مثال: مراجعة التفاضل' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea', span: 2, rows: 3 },
    ],
    values: {
      groupId: lesson?.groupId || groupId || '',
      date: lesson?.date || date || todayISO(),
      start: lesson?.start || '17:00',
      duration: lesson?.duration || 90,
      status: lesson?.status || 'scheduled',
      topic: lesson?.topic || '',
      notes: lesson?.notes || '',
    },
    submitText: isEdit ? 'حفظ التعديلات' : 'إضافة الحصة',
    onSubmit: async (values) => {
      if (isEdit) {
        await api.patch(`/api/lessons/${lesson.id}`, values);
        toast('تم تحديث الحصة');
      } else {
        const data = await api.post('/api/lessons', values);
        toast('الحصة اتضافت للجدول');
        if (onSaved) await onSaved(data.lesson);
        else window.dispatchEvent(new CustomEvent('daftary:data-changed'));
        return;
      }
      if (onSaved) await onSaved();
      else window.dispatchEvent(new CustomEvent('daftary:data-changed'));
    },
  });
}

/* ---------------- Groups ---------------- */
const DAY_OPTIONS = [
  { value: '6', label: 'السبت' },
  { value: '0', label: 'الأحد' },
  { value: '1', label: 'الاتنين' },
  { value: '2', label: 'الثلاثاء' },
  { value: '3', label: 'الأربعاء' },
  { value: '4', label: 'الخميس' },
  { value: '5', label: 'الجمعة' },
];

function scheduleRowHTML(slot = { day: 6, start: '17:00', duration: 90 }, index = 0) {
  return `<div class="schedule-row row gap-2" data-schedule-row style="margin-bottom:8px">
    <select class="select" name="sday_${index}" style="max-width:130px">${DAY_OPTIONS.map(
      (d) => `<option value="${d.value}" ${Number(slot.day) === Number(d.value) ? 'selected' : ''}>${d.label}</option>`,
    ).join('')}</select>
    <input class="input" type="time" name="sstart_${index}" value="${escapeHTML(slot.start || '17:00')}" style="max-width:130px">
    <input class="input" type="number" name="sdur_${index}" min="15" max="300" step="5" value="${Number(slot.duration) || 90}" style="max-width:110px" title="المدة بالدقايق">
    <button type="button" class="btn ghost sm" data-del-slot aria-label="حذف الموعد">${icon('trash')}</button>
  </div>`;
}

export async function groupModal({ group = null, onSaved = null } = {}) {
  const isEdit = Boolean(group);
  const schedule = group?.schedule?.length ? group.schedule : [{ day: 6, start: '17:00', duration: 90 }];
  const color = group?.color || '#2f6f5e';
  const extra = `<div class="form-section-title">مواعيد الأسبوع</div>
    <div class="span-2" data-schedule>${schedule.map((slot, i) => scheduleRowHTML(slot, i)).join('')}</div>
    <div class="span-2"><button type="button" class="btn ghost sm" data-add-slot>${icon('plus')}موعد تاني</button></div>`;
  return formModal({
    title: isEdit ? 'تعديل المجموعة' : 'مجموعة جديدة',
    sub: isEdit ? group.name : 'المجموعة هي اللي بتولّد الحصص والاشتراكات.',
    wide: true,
    fields: [
      { name: 'name', label: 'اسم المجموعة', required: true, span: 2, placeholder: 'مثال: رياضيات 3ث — دفعة الصباح' },
      { name: 'subject', label: 'المادة', required: true, placeholder: 'رياضيات' },
      { name: 'level', label: 'الصف', placeholder: 'تالتة ثانوي' },
      { name: 'type', label: 'النوع', type: 'select', options: [
        { value: 'group', label: 'مجموعة' },
        { value: 'individual', label: 'فردي' },
      ] },
      { name: 'capacity', label: 'أقصى عدد طلبة', type: 'number', min: 1, max: 60 },
      { name: 'price', label: 'سعر الاشتراك الشهري', type: 'number', min: 0, step: '0.5' },
      { name: 'billing', label: 'طريقة الدفع', type: 'select', options: [
        { value: 'monthly', label: 'شهري' },
        { value: 'per_lesson', label: 'بالحصة' },
      ] },
      { name: 'room', label: 'القاعة', placeholder: 'قاعة 1' },
      { name: 'color', label: 'لون المجموعة', type: 'color' },
      { name: 'status', label: 'الحالة', type: 'select', options: [
        { value: 'active', label: 'نشطة' },
        { value: 'archived', label: 'مؤرشفة' },
      ] },
      { name: 'startDate', label: 'تاريخ البداية', type: 'date' },
      { name: 'description', label: 'وصف المجموعة', type: 'textarea', span: 2, rows: 3 },
    ],
    values: {
      name: '',
      subject: '',
      level: '',
      type: 'group',
      capacity: 12,
      price: 450,
      billing: 'monthly',
      room: '',
      color,
      status: 'active',
      startDate: todayISO(),
      description: '',
      ...(group || {}),
    },
    extraBody: extra,
    submitText: isEdit ? 'حفظ التعديلات' : 'إنشاء المجموعة',
    onMount: ({ form }) => {
      let counter = schedule.length;
      form.querySelector('[data-add-slot]')?.addEventListener('click', () => {
        const wrap = form.querySelector('[data-schedule]');
        const div = document.createElement('div');
        div.innerHTML = scheduleRowHTML({ day: 6, start: '17:00', duration: 90 }, counter++);
        wrap.appendChild(div.firstElementChild);
      });
      form.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-del-slot]');
        if (!btn) return;
        const rows = form.querySelectorAll('[data-schedule-row]');
        if (rows.length === 1) {
          toast('لازم موعد واحد على الأقل', 'error');
          return;
        }
        btn.closest('[data-schedule-row]').remove();
      });
    },
    onSubmit: async (values) => {
      const scheduleOut = [];
      for (const el of values && Object.keys(values)) {
        const match = el.match(/^sday_(\d+)$/);
        if (!match) continue;
        const index = match[1];
        scheduleOut.push({
          day: Number(values[`sday_${index}`]),
          start: values[`sstart_${index}`],
          duration: Number(values[`sdur_${index}`]) || 90,
        });
      }
      for (const key of Object.keys(values)) {
        if (key.startsWith('sday_') || key.startsWith('sstart_') || key.startsWith('sdur_')) delete values[key];
      }
      const payload = { ...values, schedule: scheduleOut };
      if (isEdit) {
        await api.patch(`/api/groups/${group.id}`, payload);
        toast('تم تحديث المجموعة');
      } else {
        await api.post('/api/groups', payload);
        toast('المجموعة اتضافت');
      }
      clearCaches();
      if (onSaved) await onSaved();
      else window.dispatchEvent(new CustomEvent('daftary:data-changed'));
    },
  });
}

/* ---------------- Assignments ---------------- */
export async function assignmentModal({ assignment = null, groupId = '', onSaved = null } = {}) {
  const groups = await loadGroups();
  const isEdit = Boolean(assignment);
  return formModal({
    title: isEdit ? 'تعديل الواجب' : 'واجب جديد',
    sub: isEdit ? assignment.title : 'حدد المجموعة والدرجة الكاملة وتاريخ التسليم.',
    wide: true,
    fields: [
      {
        name: 'groupId',
        label: 'المجموعة',
        type: 'select',
        required: true,
        span: 2,
        options: groups
          .filter((g) => g.status === 'active' || (assignment && g.id === assignment.groupId))
          .map((g) => ({ value: g.id, label: `${g.name} — ${g.subject}` })),
      },
      { name: 'title', label: 'عنوان الواجب', required: true, span: 2, placeholder: 'مثال: مسائل التفاضل — الوحدة ٢' },
      { name: 'type', label: 'النوع', type: 'select', options: ASSIGNMENT_TYPES },
      { name: 'maxScore', label: 'الدرجة الكاملة', type: 'number', min: 1, max: 1000 },
      { name: 'dueDate', label: 'تاريخ التسليم', type: 'date', required: true },
      { name: 'status', label: 'الحالة', type: 'select', options: [
        { value: 'open', label: 'مفتوح' },
        { value: 'closed', label: 'مقفول' },
      ] },
      { name: 'description', label: 'تفاصيل الواجب', type: 'textarea', span: 2, rows: 4 },
    ],
    values: {
      groupId: assignment?.groupId || groupId || '',
      title: '',
      type: 'homework',
      maxScore: 20,
      dueDate: todayISO(),
      status: 'open',
      description: '',
      ...(assignment || {}),
    },
    submitText: isEdit ? 'حفظ التعديلات' : 'إضافة الواجب',
    onSubmit: async (values) => {
      if (isEdit) {
        await api.patch(`/api/assignments/${assignment.id}`, values);
        toast('تم تحديث الواجب');
        if (onSaved) await onSaved();
      } else {
        const data = await api.post('/api/assignments', values);
        toast('الواجب اتضاف');
        if (onSaved) await onSaved(data.assignment);
        else window.dispatchEvent(new CustomEvent('daftary:data-changed'));
      }
    },
  });
}

/* ---------------- Materials ---------------- */
export async function materialModal({ onSaved = null, groupId = '' } = {}) {
  const groups = await loadGroups();
  const uid = `mat_${Date.now()}`;
  const body = `<div class="segmented mb-3" data-mat-tabs>
      <button type="button" class="active" data-type="link">${icon('link')} رابط</button>
      <button type="button" data-type="note">${icon('note')} ملاحظة</button>
      <button type="button" data-type="file">${icon('upload')} ملف</button>
    </div>
    <div class="form-grid">
      <div class="field span-2"><label>العنوان <span class="req">*</span></label><input class="input" name="title" required placeholder="مثال: ملزمة المراجعة النهائية"></div>
      <div class="field span-2"><label>الوصف</label><textarea class="textarea" name="description" rows="3" placeholder="تفاصيل مختصرة تساعد الطلبة"></textarea></div>
      <div class="field span-2" data-link-field><label>الرابط</label><input class="input" name="url" dir="ltr" placeholder="https://…"></div>
      <div class="field span-2 hidden" data-file-field><label>الملف</label>
        <input class="input" type="file" name="file">
        <div class="help">أقصى حجم ١٠ ميجا. PDF، صور، Word، Excel، أو PowerPoint.</div>
        <div class="progress mt-2 hidden" data-upload-bar><span style="width:0%"></span></div>
      </div>
      <div class="field"><label>المجموعة</label><select class="select" name="groupId"><option value="">لكل الطلبة</option>${groups.map(
        (g) => `<option value="${g.id}" ${g.id === groupId ? 'selected' : ''}>${escapeHTML(g.name)}</option>`,
      ).join('')}</select></div>
      <div class="field"><label>النوع</label><input class="input" name="typeLabel" value="رابط" disabled></div>
    </div>`;

  return openModal({
    title: 'إضافة للمكتبة',
    sub: 'رابط، ملاحظة، أو ملف تشاركه مع الطلبة.',
    body,
    footer: `<button class="btn" data-save>${icon('upload')}إضافة</button>
      <button class="btn secondary" data-close>إلغاء</button>`,
    onMount: ({ body: bodyEl, root, close }) => {
      let type = 'link';
      const tabs = bodyEl.querySelector('[data-mat-tabs]');
      const linkField = bodyEl.querySelector('[data-link-field]');
      const fileField = bodyEl.querySelector('[data-file-field]');
      const typeLabel = bodyEl.querySelector('[name="typeLabel"]');
      tabs.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-type]');
        if (!btn) return;
        type = btn.dataset.type;
        tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
        linkField.classList.toggle('hidden', type !== 'link');
        fileField.classList.toggle('hidden', type !== 'file');
        typeLabel.value = type === 'link' ? 'رابط' : type === 'note' ? 'ملاحظة' : 'ملف';
      });

      root.querySelector('[data-save]').addEventListener('click', async (event) => {
        const button = event.currentTarget;
        const title = bodyEl.querySelector('[name="title"]').value.trim();
        const description = bodyEl.querySelector('[name="description"]').value.trim();
        const url = bodyEl.querySelector('[name="url"]').value.trim();
        const groupId = bodyEl.querySelector('[name="groupId"]').value || null;
        if (!title) {
          toast('اكتب عنوان للمادة', 'error');
          return;
        }
        button.disabled = true;
        button.innerHTML = `${icon('refresh')}بيحفظ…`;
        try {
          let payload = { title, description, type, groupId };
          if (type === 'link') {
            if (!/^https?:\/\//i.test(url)) throw new Error('الرابط لازم يبدأ بـ http أو https');
            payload.url = url;
          }
          if (type === 'note' && !description) throw new Error('اكتب نص الملاحظة في الوصف');
          if (type === 'file') {
            const file = bodyEl.querySelector('[name="file"]').files[0];
            if (!file) throw new Error('اختار ملف الأول');
            if (file.size > 10 * 1024 * 1024) throw new Error('الملف أكبر من ١٠ ميجا');
            const bar = bodyEl.querySelector('[data-upload-bar]');
            bar.classList.remove('hidden');
            const dataUrl = await readFileAsDataURL(file);
            const uploaded = await api.post('/api/uploads', { name: file.name, dataUrl });
            bar.querySelector('span').style.width = '100%';
            payload = {
              ...payload,
              url: uploaded.file.url,
              fileName: uploaded.file.name,
              fileSize: uploaded.file.size,
              mime: uploaded.file.mime,
            };
          }
          const data = await api.post('/api/materials', payload);
          toast('المادة اتضافت للمكتبة');
          close();
          if (onSaved) await onSaved(data.material);
          else window.dispatchEvent(new CustomEvent('daftary:data-changed'));
        } catch (error) {
          toast(error.message, 'error');
          button.disabled = false;
          button.innerHTML = `${icon('upload')}إضافة`;
        }
      });
    },
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('مش قادر أقرا الملف'));
    reader.readAsDataURL(file);
  });
}

/* ---------------- Reminders ---------------- */
export async function reminderModal(studentId, kind = 'payment') {
  const data = await api.get(`/api/students/${studentId}/reminder?kind=${kind}`);
  openModal({
    title: kind === 'payment' ? 'رسالة تذكير بالفلوس' : 'رسالة تذكير بالحصة',
    sub: 'جاهزة — تقدر تنسخها أو تبعتها واتساب.',
    narrow: true,
    body: `<div class="field"><label>نص الرسالة</label>
        <textarea class="textarea" rows="6" data-msg>${escapeHTML(data.message)}</textarea></div>
      <div class="row-between mt-2">
        <button class="btn secondary sm" data-copy>${icon('copy')}نسخ</button>
        <a class="btn sm" href="${escapeHTML(data.whatsapp)}" target="_blank" rel="noopener">${icon('message')}واتساب</a>
      </div>`,
    onMount: ({ body }) => {
      body.querySelector('[data-copy]').addEventListener('click', async () => {
        const text = body.querySelector('[data-msg]').value;
        try {
          await navigator.clipboard.writeText(text);
          toast('الرسالة اتنسخت');
        } catch {
          body.querySelector('[data-msg]').select();
          document.execCommand('copy');
          toast('الرسالة اتنسخت');
        }
      });
    },
  });
}

/* ---------------- Receipt & statement ---------------- */
export async function receiptModal(paymentId) {
  const data = await api.get(`/api/payments/${paymentId}/receipt`);
  const { payment, student, balance, settings } = data;
  const html = receiptHTML({ payment, student, balance, settings });
  openModal({
    title: 'الإيصال',
    sub: `${payment.receiptNo} — ${dateFull(payment.date)}`,
    narrow: true,
    body: `<div class="receipt" id="receipt-body">${html}</div>`,
    footer: `<button class="btn" data-print>${icon('print')}طباعة</button>
      <button class="btn secondary" data-copy-receipt>${icon('copy')}نسخ</button>
      <button class="btn ghost" data-close>قفل</button>`,
    onMount: ({ root }) => {
      root.querySelector('[data-print]').addEventListener('click', () => {
        printHTML(`<div class="print-sheet">${html}</div>`);
      });
      root.querySelector('[data-copy-receipt]').addEventListener('click', async () => {
        const lines = [
          `${settings.centerName} — إيصال ${payment.receiptNo}`,
          `الطالب: ${student.name}`,
          `المبلغ: ${money(payment.amount)}`,
          `التاريخ: ${dateFull(payment.date)}`,
          `طريقة الدفع: ${payment.method}`,
          `المتبقي: ${money(balance)}`,
        ];
        try {
          await navigator.clipboard.writeText(lines.join('\n'));
          toast('بيانات الإيصال اتنسخت');
        } catch {
          toast('مش قادر أنسخ دلوقتي', 'error');
        }
      });
    },
  });
}

function receiptHTML({ payment, student, balance, settings }) {
  return `<div class="receipt-head">
      <div><div class="receipt-title">${escapeHTML(settings.centerName || 'دفتري')}</div>
        <div style="font-size:11px;color:#6b7a73;margin-top:4px">${escapeHTML(settings.address || '')}<br>${escapeHTML(settings.phone || '')}</div></div>
      <div style="text-align:end"><div style="font-weight:700;font-size:14px">إيصال دفع</div>
        <div style="font-size:11px;color:#6b7a73;margin-top:4px">${escapeHTML(payment.receiptNo)}<br>${escapeHTML(dateFull(payment.date))}</div></div>
    </div>
    <div class="receipt-rows">
      <div class="receipt-row"><span>الطالب</span><b>${escapeHTML(student.name)}</b></div>
      <div class="receipt-row"><span>ولي الأمر</span><span>${escapeHTML(student.parentName || '—')}</span></div>
      <div class="receipt-row"><span>طريقة الدفع</span><span>${escapeHTML(payment.method)}</span></div>
      ${payment.note ? `<div class="receipt-row"><span>ملاحظة</span><span>${escapeHTML(payment.note)}</span></div>` : ''}
    </div>
    <div class="receipt-total"><span>المبلغ المدفوع</span><span>${money(payment.amount)}</span></div>
    <div class="row-between" style="margin-top:10px;font-size:12px;color:#6b7a73">
      <span>المتبقي على الطالب</span><b style="color:#1b2b26">${money(balance)}</b>
    </div>
    <div style="margin-top:22px;font-size:10.5px;color:#8a968f;text-align:center">شكراً لتعاملكم مع ${escapeHTML(settings.centerName || 'دفتري')} — الإيصال صادر إلكترونياً.</div>`;
}

export async function printStatement(studentId) {
  const data = await api.get(`/api/students/${studentId}/statement`);
  const rows = data.ledger
    .map(
      (row) => `<tr><td>${escapeHTML(row.title)}</td><td>${escapeHTML(row.dueDate || '')}</td>
      <td>${money(row.amount)}</td><td>${money(row.paidAmount)}</td><td>${money(row.remaining)}</td></tr>`,
    )
    .join('');
  printHTML(`<div class="print-sheet">
    <div class="print-head">
      <div><h1 style="margin:0;font-size:22px">${escapeHTML('كشف حساب')}</h1>
        <div style="font-size:12px;color:#555;margin-top:4px">${escapeHTML(data.student.name)} — ${escapeHTML(data.student.parentName || '')}</div></div>
      <div style="font-size:11px;text-align:end">${escapeHTML(dateFull(todayISO()))}</div>
    </div>
    <table class="print-table"><thead><tr><th>البيان</th><th>الاستحقاق</th><th>المبلغ</th><th>مدفوع</th><th>متبقي</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">مفيش حركات</td></tr>'}</tbody></table>
    <div class="print-totals"><span>إجمالي المستحق ${money(data.charged)}</span><span>المدفوع ${money(data.paid)}</span><span>المتبقي ${money(data.balance)}</span></div>
  </div>`);
}

/* ---------------- Delete helper ---------------- */
export async function deleteConfirm({ title, message, onConfirm, confirmText = 'أيوه، احذف' }) {
  return confirmModal({
    title,
    message,
    danger: true,
    confirmText,
    onConfirm: async () => {
      await onConfirm();
      toast('تم الحذف');
    },
  });
}

export { STATUS_LABELS, ATTENDANCE_LABELS, timeLabel };
