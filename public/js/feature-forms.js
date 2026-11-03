'use strict';

import { api, escapeHTML, todayISO, money } from './api.js';
import { openModal, formModal, toast, icon } from './ui.js';
import { loadGroups, loadStudents } from './forms.js';

const EXAM_TYPES = [
  { value: 'quiz', label: 'كويز' },
  { value: 'exam', label: 'امتحان' },
  { value: 'monthly', label: 'امتحان شهري' },
  { value: 'final', label: 'امتحان نهائي' },
  { value: 'practical', label: 'عملي' },
];

const EXAM_STATUSES = [
  { value: 'draft', label: 'مسودة' },
  { value: 'open', label: 'مفتوح للتصحيح' },
  { value: 'graded', label: 'مصحح' },
  { value: 'closed', label: 'مغلق' },
];

const CERT_KINDS = [
  { value: 'excellence', label: 'تفوق' },
  { value: 'attendance', label: 'انتظام وحضور' },
  { value: 'completion', label: 'إتمام منهج' },
  { value: 'custom', label: 'مخصصة' },
];

const POINT_CATEGORIES = [
  { value: 'behavior', label: 'سلوك' },
  { value: 'competition', label: 'مسابقة' },
  { value: 'manual', label: 'يدوي' },
  { value: 'attendance', label: 'حضور' },
  { value: 'grade', label: 'درجات' },
];

const METHODS = [
  { value: 'cash', label: 'كاش' },
  { value: 'vodafone', label: 'فودافون كاش' },
  { value: 'instapay', label: 'إنستاباي' },
  { value: 'bank', label: 'تحويل بنكي' },
  { value: 'other', label: 'طريقة تانية' },
];

/* ------------------------------- exams -------------------------------- */
export async function examModal({ exam = null, groupId = '', onSaved = null } = {}) {
  const groups = await loadGroups();
  const isEdit = Boolean(exam);
  return formModal({
    title: isEdit ? 'تعديل الامتحان' : 'امتحان جديد',
    sub: isEdit ? exam.title : 'حدد المجموعة والدرجة والموعد.',
    wide: true,
    fields: [
      {
        name: 'groupId',
        label: 'المجموعة',
        type: 'select',
        required: true,
        span: 2,
        options: groups
          .filter((g) => g.status === 'active' || (exam && g.id === exam.groupId))
          .map((g) => ({ value: g.id, label: `${g.name} — ${g.subject}` })),
      },
      { name: 'title', label: 'عنوان الامتحان', required: true, span: 2, placeholder: 'مثال: امتحان التفاضل — الوحدة ٣' },
      { name: 'type', label: 'النوع', type: 'select', options: EXAM_TYPES },
      { name: 'status', label: 'الحالة', type: 'select', options: EXAM_STATUSES },
      { name: 'date', label: 'التاريخ', type: 'date', required: true },
      { name: 'start', label: 'الوقت', type: 'time' },
      { name: 'duration', label: 'المدة (دقيقة)', type: 'number', min: 5, max: 600 },
      { name: 'maxScore', label: 'الدرجة النهائية', type: 'number', min: 1, max: 500, required: true },
      { name: 'passScore', label: 'درجة النجاح', type: 'number', min: 0, max: 500 },
      { name: 'description', label: 'وصف / ملاحظات', type: 'textarea', span: 2, rows: 2 },
    ],
    values: isEdit
      ? { ...exam }
      : {
          groupId: groupId || (groups.find((g) => g.status === 'active') || {}).id || '',
          title: '',
          type: 'exam',
          status: 'open',
          date: todayISO(),
          start: '16:00',
          duration: 60,
          maxScore: 20,
          passScore: 10,
          description: '',
        },
    onSubmit: async (values) => {
      const payload = { ...values };
      if (!payload.passScore) payload.passScore = Math.round((Number(values.maxScore) || 0) / 2);
      if (isEdit) {
        await api.patch(`/api/exams/${exam.id}`, payload);
        toast('الامتحان اتعدل');
      } else {
        await api.post('/api/exams', payload);
        toast('الامتحان اتضاف');
      }
      if (onSaved) onSaved();
    },
  });
}

/* ---------------------------- certificates ----------------------------- */
export async function certificateModal({ certificate = null, studentId = '', onSaved = null } = {}) {
  const students = await loadStudents();
  const isEdit = Boolean(certificate);
  return formModal({
    title: isEdit ? 'تعديل الشهادة' : 'إصدار شهادة',
    sub: isEdit ? certificate.title : 'اختار الطالب ونوع الشهادة.',
    wide: true,
    fields: [
      {
        name: 'studentId',
        label: 'الطالب',
        type: 'select',
        required: !isEdit,
        span: 2,
        disabled: isEdit,
        options: students.map((s) => ({ value: s.id, label: `${s.name} — ${s.grade || ''}` })),
      },
      { name: 'kind', label: 'نوع الشهادة', type: 'select', options: CERT_KINDS },
      { name: 'issuedAt', label: 'تاريخ الإصدار', type: 'date' },
      { name: 'title', label: 'عنوان الشهادة', required: true, span: 2, placeholder: 'مثال: شهادة تفوق' },
      { name: 'note', label: 'نص الشهادة', type: 'textarea', span: 2, rows: 3 },
      ...(isEdit
        ? [{ name: 'status', label: 'الحالة', type: 'select', options: [{ value: 'active', label: 'سارية' }, { value: 'revoked', label: 'ملغية' }] }]
        : []),
    ],
    values: isEdit
      ? { ...certificate }
      : { studentId: studentId || (students[0] || {}).id || '', kind: 'excellence', title: 'شهادة تفوق', issuedAt: todayISO(), note: 'تقديراً لتفوقه الدراسي وحصوله على أعلى الدرجات.' },
    onSubmit: async (values) => {
      if (isEdit) {
        const payload = { kind: values.kind, title: values.title, note: values.note, issuedAt: values.issuedAt, status: values.status };
        await api.patch(`/api/certificates/${certificate.id}`, payload);
        toast('الشهادة اتعدلت');
      } else {
        await api.post('/api/certificates', values);
        toast('الشهادة اتصدرت');
      }
      if (onSaved) onSaved();
    },
  });
}

export async function bulkCertificateModal({ onSaved = null } = {}) {
  const [students, groups] = await Promise.all([loadStudents(), loadGroups()]);
  const active = students.filter((s) => s.status !== 'left');
  const rowHTML = (student) =>
    `<label class="cert-pick" data-groups="${escapeHTML((student.groups || []).map((g) => g.id).join(' '))}">
      <input type="checkbox" value="${student.id}" data-student>
      <span class="grow"><span class="strong small">${escapeHTML(student.name)}</span>
      <span class="tiny muted" style="display:block">${escapeHTML(student.grade || '')}</span></span>
    </label>`;
  const { close } = openModal({
    title: 'إصدار شهادات جماعي',
    sub: 'اختار الطلبة وهنطلع الشهادات بضغطة واحدة.',
    wide: true,
    body: `<div class="form-grid">
      <div class="field span-2"><label>فلتر بالمجموعة</label>
        <select class="select" data-group-filter><option value="">كل الطلبة</option>
        ${groups.map((g) => `<option value="${g.id}">${escapeHTML(g.name)}</option>`).join('')}</select>
      </div>
      <div class="field span-2"><label>نوع الشهادة</label>
        <select class="select" data-kind>${CERT_KINDS.map((k) => `<option value="${k.value}">${k.label}</option>`).join('')}</select>
      </div>
      <div class="field span-2"><label>عنوان الشهادة</label><input class="input" data-title value="شهادة تفوق"></div>
      <div class="field span-2"><label>نص الشهادة</label><textarea class="textarea" rows="2" data-note>تقديراً لتفوقه الدراسي وحصوله على أعلى الدرجات.</textarea></div>
      <div class="field span-2"><label>الطلبة <span class="muted tiny" data-count></span></label>
        <div class="cert-picks" data-picks>${active.map(rowHTML).join('')}</div>
      </div>
    </div>`,
    footer: `<button class="btn" data-issue>${icon('award')}إصدار الشهادات</button>
      <button class="btn secondary" data-close>إلغاء</button>
      <span class="grow"></span>
      <button class="btn secondary" data-all>تحديد الكل</button>`,
    onMount: ({ root }) => {
      const counter = root.querySelector('[data-count]');
      const update = () => {
        const n = root.querySelectorAll('[data-student]:checked').length;
        counter.textContent = `(${n} محدد)`;
      };
      root.querySelectorAll('[data-student]').forEach((input) => input.addEventListener('change', update));
      root.querySelector('[data-group-filter]').addEventListener('change', (event) => {
        const groupId = event.target.value;
        root.querySelectorAll('.cert-pick').forEach((label) => {
          const belongs = !groupId || String(label.dataset.groups || '').split(' ').includes(groupId);
          label.style.display = belongs ? '' : 'none';
          if (!belongs) label.querySelector('[data-student]').checked = false;
        });
        update();
      });
      root.querySelector('[data-all]').addEventListener('click', () => {
        const visible = [...root.querySelectorAll('.cert-pick')].filter((el) => el.style.display !== 'none');
        const allChecked = visible.every((el) => el.querySelector('[data-student]').checked);
        visible.forEach((el) => {
          el.querySelector('[data-student]').checked = !allChecked;
        });
        update();
      });
      root.querySelector('[data-issue]').addEventListener('click', async (event) => {
        const ids = [...root.querySelectorAll('[data-student]:checked')].map((el) => el.value);
        if (!ids.length) {
          toast('اختار طالب واحد على الأقل', 'error');
          return;
        }
        event.currentTarget.disabled = true;
        try {
          const data = await api.post('/api/certificates/bulk', {
            studentIds: ids,
            kind: root.querySelector('[data-kind]').value,
            title: root.querySelector('[data-title]').value.trim(),
            note: root.querySelector('[data-note]').value.trim(),
            issuedAt: todayISO(),
          });
          toast(`اتصدرت ${data.count} شهادة`);
          close();
          if (onSaved) onSaved();
        } catch (error) {
          toast(error.message, 'error');
        } finally {
          event.currentTarget.disabled = false;
        }
      });
      update();
    },
  });
}

/* ------------------------------- points -------------------------------- */
export async function pointModal({ studentId = '', onSaved = null } = {}) {
  const [students, groups] = await Promise.all([loadStudents(), loadGroups()]);
  return formModal({
    title: 'إضافة نقاط',
    sub: 'نقاط إضافية للسلوك أو المسابقات أو تقدير يدوي.',
    wide: true,
    fields: [
      {
        name: 'studentId',
        label: 'الطالب',
        type: 'select',
        required: true,
        span: 2,
        options: students.map((s) => ({ value: s.id, label: `${s.name} — ${s.grade || ''}` })),
      },
      { name: 'category', label: 'النوع', type: 'select', options: POINT_CATEGORIES },
      { name: 'points', label: 'عدد النقاط', type: 'number', min: -500, max: 500, required: true },
      { name: 'groupId', label: 'المجموعة (اختياري)', type: 'select', span: 2, options: [{ value: '', label: 'من غير مجموعة' }, ...groups.map((g) => ({ value: g.id, label: g.name }))] },
      { name: 'reason', label: 'السبب', type: 'textarea', span: 2, rows: 2, placeholder: 'مثال: مشاركة ممتازة في الحصة' },
    ],
    values: { studentId: studentId || (students[0] || {}).id || '', category: 'behavior', points: 10, groupId: '', reason: '' },
    onSubmit: async (values) => {
      await api.post('/api/points', { ...values, groupId: values.groupId || null });
      toast('النقاط اتضافت');
      if (onSaved) onSaved();
    },
  });
}

/* ------------------------------ treasury ------------------------------- */
export function treasuryModal({ entry = null, onSaved = null } = {}) {
  return formModal({
    title: entry ? 'تعديل الحركة' : 'حركة خزنة جديدة',
    sub: 'إيداع أو سحب من خزنة المركز.',
    fields: [
      { name: 'type', label: 'نوع الحركة', type: 'select', options: [{ value: 'deposit', label: 'إيداع' }, { value: 'withdraw', label: 'سحب' }] },
      { name: 'amount', label: 'المبلغ', type: 'number', min: 1, step: 0.5, required: true },
      { name: 'title', label: 'البيان', required: true, span: 2 },
      { name: 'method', label: 'الطريقة', type: 'select', options: METHODS },
      { name: 'date', label: 'التاريخ', type: 'date', required: true },
      { name: 'note', label: 'ملاحظة', type: 'textarea', span: 2, rows: 2 },
    ],
    values: entry || { type: 'deposit', amount: '', title: '', method: 'cash', date: todayISO(), note: '' },
    onSubmit: async (values) => {
      await api.post('/api/treasury', values);
      toast('الحركة اتسجلت');
      if (onSaved) onSaved();
    },
  });
}

/* ------------------------------- shifts -------------------------------- */
export function shiftModal({ shift = null, staff = [], onSaved = null } = {}) {
  return formModal({
    title: shift ? 'تعديل الوردية' : 'وردية جديدة',
    sub: 'سجّل مواعيد شغل فريق المركز.',
    fields: [
      {
        name: 'userId',
        label: 'الموظف',
        type: 'select',
        required: true,
        span: 2,
        disabled: Boolean(shift),
        options: staff.map((u) => ({ value: u.id, label: `${u.name} — ${u.role === 'admin' ? 'مدير' : 'مساعد'}` })),
      },
      { name: 'date', label: 'التاريخ', type: 'date', required: true },
      { name: 'status', label: 'الحالة', type: 'select', options: [{ value: 'open', label: 'مفتوحة' }, { value: 'closed', label: 'مقفولة' }] },
      { name: 'start', label: 'من', type: 'time', required: true },
      { name: 'end', label: 'لحد', type: 'time', required: true },
      { name: 'role', label: 'الدور', placeholder: 'استقبال / إدارة' },
      { name: 'note', label: 'ملاحظة', placeholder: 'اختياري' },
    ],
    values: shift || { userId: (staff[0] || {}).id || '', date: todayISO(), status: 'open', start: '14:00', end: '20:00', role: 'استقبال', note: '' },
    onSubmit: async (values) => {
      if (shift) await api.patch(`/api/shifts/${shift.id}`, values);
      else await api.post('/api/shifts', { ...values, userId: values.userId || (staff[0] || {}).id });
      toast(shift ? 'الوردية اتعدلت' : 'الوردية اتسجلت');
      if (onSaved) onSaved();
    },
  });
}

export { EXAM_TYPES, EXAM_STATUSES, CERT_KINDS, POINT_CATEGORIES, METHODS };
