'use strict';

const { id, todayISO, addDays, monthKey, nowISO } = require('./utils');

function mulberry32(seed) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261102);
const pick = (list) => list[Math.floor(rand() * list.length)];
const between = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const chance = (p) => rand() < p;

const COLORS = ['#2f6f5e', '#c25a3c', '#3f5f9e', '#8a5a9e', '#b07a2a', '#477a8a', '#9e4f63'];

function makeStudents() {
  const names = [
    ['يوسف أحمد عبد الرحمن', 'يوسف أحمد', 'male'],
    ['ملك محمد السيد', 'ملك محمد', 'female'],
    ['عمر خالد إبراهيم', 'عمر خالد', 'male'],
    ['جنى مصطفى كامل', 'جنى مصطفى', 'female'],
    ['زياد حسام الدين', 'زياد حسام', 'male'],
    ['نور الدين محمود', 'نور محمود', 'male'],
    ['حبيبة أشرف عبد الله', 'حبيبة أشرف', 'female'],
    ['مازن طارق فؤاد', 'مازن طارق', 'male'],
    ['سلمى وليد سمير', 'سلمى وليد', 'female'],
    ['أدم شريف حسن', 'أدم شريف', 'male'],
    ['رقية عمرو عادل', 'رقية عمرو', 'female'],
    ['حمزة سامح رشاد', 'حمزة سامح', 'male'],
    ['ليان هشام فتحي', 'ليان هشام', 'female'],
    ['مروان عصام الدين', 'مروان عصام', 'male'],
    ['تالية ياسر صبري', 'تالية ياسر', 'female'],
    ['كريم وائل منصور', 'كريم وائل', 'male'],
    ['هنا أحمد صلاح', 'هنا أحمد', 'female'],
    ['سيف الدين عاطف', 'سيف عاطف', 'male'],
    ['مريم إسلام رمضان', 'مريم إسلام', 'female'],
    ['عبد الرحمن جمال شعبان', 'عبد الرحمن جمال', 'male'],
    ['فريدة سيد النجار', 'فريدة سيد', 'female'],
    ['طه إيهاب عوض', 'طه إيهاب', 'male'],
    ['دينا أشرف لطفي', 'دينا أشرف', 'female'],
    ['بلال محمد زكي', 'بلال محمد', 'male'],
    ['رقية إبراهيم الشاذلي', 'رقية إبراهيم', 'female'],
    ['أحمد سعيد الغريب', 'أحمد سعيد', 'male'],
    ['لوجين عماد فايز', 'لوجين عماد', 'female'],
    ['محمود إبراهيم عثمان', 'محمود إبراهيم', 'male'],
    ['سارة أيمن مصطفى', 'سارة أيمن', 'female'],
    ['علي حسن البنا', 'علي حسن', 'male'],
    ['نادية شعبان مرسي', 'نادية شعبان', 'female'],
    ['عمر إسلام طلعت', 'عمر إسلام', 'male'],
  ];

  return names.map(([name, shortName, gender], index) => ({
    id: id('stu'),
    name,
    shortName,
    gender,
    phone: `010${between(0, 9)}${String(between(1000000, 9999999))}`,
    parentName: `والد ${shortName.split(' ')[0]}`,
    parentPhone: `011${between(0, 9)}${String(between(1000000, 9999999))}`,
    email: `student${index + 1}@daftary.local`,
    school: pick(['مدرسة الجيزة الثانوية', 'مدرسة النيل الدولية', 'مدرسة الأورمان', 'مدرسة المستقبل', 'مدرسة السعيدية']),
    grade: pick(['أولى ثانوي', 'تانية ثانوي', 'تالتة ثانوي']),
    birthDate: `200${between(6, 9)}-${String(between(1, 12)).padStart(2, '0')}-${String(between(1, 28)).padStart(2, '0')}`,
    address: pick(['الهرم — الجيزة', 'فيصل — الجيزة', 'الدقي — الجيزة', 'المعادي — القاهرة', 'مدينة نصر — القاهرة']),
    avatarColor: COLORS[index % COLORS.length],
    status: chance(0.06) ? 'paused' : 'active',
    joinedAt: todayISO(addDays(new Date(), -between(30, 240))),
    createdAt: nowISO(),
  }));
}

function makeGroups() {
  const base = [
    {
      name: 'رياضيات 3ث — دفعة الصباح',
      subject: 'رياضيات',
      level: 'تالتة ثانوي',
      color: '#2f6f5e',
      type: 'group',
      capacity: 14,
      price: 450,
      room: 'قاعة 1',
      schedule: [
        { day: 6, start: '16:00', duration: 90 },
        { day: 2, start: '16:00', duration: 90 },
      ],
      description: 'منهج التفاضل والتكامل كامل مع حل امتحانات السنوات السابقة.',
    },
    {
      name: 'فيزياء 3ث',
      subject: 'فيزياء',
      level: 'تالتة ثانوي',
      color: '#3f5f9e',
      type: 'group',
      capacity: 16,
      price: 500,
      room: 'قاعة 2',
      schedule: [
        { day: 0, start: '18:00', duration: 90 },
        { day: 3, start: '18:00', duration: 90 },
      ],
      description: 'شرح الفيزياء الحديثة والكهربية بأسلوب مسائل تفاعلي.',
    },
    {
      name: 'كيمياء 2ث',
      subject: 'كيمياء',
      level: 'تانية ثانوي',
      color: '#c25a3c',
      type: 'group',
      capacity: 15,
      price: 450,
      room: 'قاعة 3',
      schedule: [
        { day: 1, start: '17:00', duration: 90 },
        { day: 4, start: '17:00', duration: 90 },
      ],
      description: 'كيمياء تانية ثانوي بالتجارب والرسومات التوضيحية.',
    },
    {
      name: 'لغة عربية 1ث',
      subject: 'لغة عربية',
      level: 'أولى ثانوي',
      color: '#8a5a9e',
      type: 'group',
      capacity: 18,
      price: 400,
      room: 'قاعة 4',
      schedule: [{ day: 6, start: '12:00', duration: 120 }],
      description: 'نحو وبلاغة وأدب مع تدريبات على نمط الامتحان الجديد.',
    },
    {
      name: 'إنجليزي 2ث',
      subject: 'إنجليزي',
      level: 'تانية ثانوي',
      color: '#477a8a',
      type: 'group',
      capacity: 14,
      price: 450,
      room: 'قاعة 2',
      schedule: [{ day: 2, start: '19:30', duration: 90 }],
      description: 'Grammar, vocabulary and writing — مستوى متقدم.',
    },
    {
      name: 'رياضيات 2ث — مجموعة مصغرة',
      subject: 'رياضيات',
      level: 'تانية ثانوي',
      color: '#b07a2a',
      type: 'group',
      capacity: 8,
      price: 550,
      room: 'قاعة 5',
      schedule: [{ day: 3, start: '15:00', duration: 90 }],
      description: 'مجموعة صغيرة بمتابعة فردية وواجب أسبوعي إجباري.',
    },
    {
      name: 'قدرات — فردي',
      subject: 'قدرات',
      level: 'ثانوية عامة',
      color: '#9e4f63',
      type: 'individual',
      capacity: 1,
      price: 1200,
      room: 'أونلاين',
      schedule: [{ day: 5, start: '14:00', duration: 60 }],
      description: 'تدريب فردي على اختبار القدرات والتفكير المنطقي.',
    },
  ];

  return base.map((g) => ({
    id: id('grp'),
    ...g,
    billing: 'monthly',
    startDate: todayISO(addDays(new Date(), -120)),
    status: 'active',
    createdAt: nowISO(),
  }));
}

function makeEnrollments(students, groups) {
  const enrollments = [];
  const add = (studentId, groupId) => {
    if (enrollments.some((e) => e.studentId === studentId && e.groupId === groupId)) return;
    enrollments.push({
      id: id('enr'),
      studentId,
      groupId,
      joinedAt: todayISO(addDays(new Date(), -between(20, 150))),
      active: true,
      note: '',
    });
  };

  const distribution = [
    [0, 6, 13, 19, 26],
    [1, 7, 14, 20, 27],
    [2, 8, 15, 21, 28],
    [3, 9, 16, 22, 29],
    [4, 10, 17, 23, 30],
    [5, 11, 18, 24, 31],
  ];

  distribution.forEach((studentIndexes, groupIndex) => {
    studentIndexes.forEach((studentIndex) => {
      const student = students[studentIndex];
      if (student) add(student.id, groups[groupIndex].id);
    });
  });

  // A few students take two subjects.
  [
    [0, 1],
    [2, 5],
    [5, 2],
    [9, 4],
    [12, 0],
    [16, 5],
    [21, 1],
    [24, 3],
  ].forEach(([studentIndex, groupIndex]) => {
    add(students[studentIndex].id, groups[groupIndex].id);
  });

  add(students[30].id, groups[6].id);
  add(students[31].id, groups[6].id);
  add(students[25].id, groups[0].id);
  return enrollments;
}

function makeLessons(groups) {
  const lessons = [];
  const start = addDays(new Date(), -56);
  const end = addDays(new Date(), 16);
  for (const group of groups) {
    for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
      for (const slot of group.schedule) {
        if (cursor.getDay() !== slot.day) continue;
        const date = todayISO(cursor);
        const isPast = date < todayISO();
        let status = 'scheduled';
        if (isPast) status = chance(0.93) ? 'done' : 'cancelled';
        lessons.push({
          id: id('les'),
          groupId: group.id,
          date,
          start: slot.start,
          duration: slot.duration,
          topic: `حصة ${group.subject} — ${date}`,
          status,
          notes: chance(0.12) ? 'تم حل الواجب السابق وتصحيح الأخطاء.' : '',
          createdAt: nowISO(),
          updatedAt: nowISO(),
        });
      }
    }
  }
  return lessons;
}

function makeAttendance(lessons, enrollments) {
  const records = [];
  for (const lesson of lessons) {
    if (lesson.status !== 'done') continue;
    const roster = enrollments.filter((e) => e.groupId === lesson.groupId && e.active);
    for (const enrollment of roster) {
      const roll = rand();
      const status = roll < 0.79 ? 'present' : roll < 0.9 ? 'absent' : roll < 0.96 ? 'late' : 'excused';
      records.push({
        id: id('att'),
        lessonId: lesson.id,
        studentId: enrollment.studentId,
        status,
        note: status === 'excused' ? pick(['ظرف عائلي', 'مريض', 'سفر']) : '',
        markedAt: nowISO(),
      });
    }
  }
  return records;
}

function makeFinance(students, groups, enrollments) {
  const charges = [];
  const payments = [];
  const now = new Date();
  const months = [-2, -1, 0].map((offset) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return { key: monthKey(d), due: `${monthKey(d)}-05` };
  });

  for (const enrollment of enrollments) {
    const group = groups.find((g) => g.id === enrollment.groupId);
    if (!group) continue;
    for (const month of months) {
      if (chance(0.06)) continue;
      charges.push({
        id: id('chg'),
        studentId: enrollment.studentId,
        groupId: group.id,
        title: `اشتراك ${group.subject} — ${month.key}`,
        amount: group.price,
        month: month.key,
        dueDate: month.due,
        type: 'subscription',
        note: '',
        createdAt: nowISO(),
        createdBy: 'system',
      });
    }
  }

  for (let i = 0; i < 4; i += 1) {
    const student = students[between(0, students.length - 1)];
    charges.push({
      id: id('chg'),
      studentId: student.id,
      groupId: null,
      title: pick(['كتب ومذكرات', 'بوكليت مراجعة', 'رسوم تسجيل']),
      amount: pick([120, 180, 250]),
      month: null,
      dueDate: todayISO(addDays(now, -between(4, 30))),
      type: 'manual',
      note: '',
      createdAt: nowISO(),
      createdBy: 'system',
    });
  }

  const methods = ['cash', 'vodafone', 'instapay', 'bank'];
  let receipt = 1;
  for (const student of students) {
    const total = charges.filter((c) => c.studentId === student.id).reduce((s, c) => s + c.amount, 0);
    if (!total) continue;
    const ratio = chance(0.18) ? 0.35 : chance(0.22) ? 0.68 : chance(0.25) ? 0.9 : 1;
    const count = between(1, 3);
    let remaining = Math.round((total * ratio) / 10) * 10;
    for (let i = 0; i < count && remaining > 0; i += 1) {
      const amount = i === count - 1 ? remaining : Math.max(50, Math.round(remaining * (0.3 + rand() * 0.4)));
      remaining -= amount;
      const monthOffset = between(-40, 0);
      payments.push({
        id: id('pay'),
        studentId: student.id,
        amount,
        method: pick(methods),
        date: todayISO(addDays(now, monthOffset)),
        note: '',
        receiptNo: `DFT-${String(now.getFullYear())}-${String(receipt).padStart(4, '0')}`,
        createdBy: 'system',
        createdAt: nowISO(),
      });
      receipt += 1;
    }
  }

  const expenses = [];
  const categories = [
    ['إيجار المركز', 'rent', 4500],
    ['مرتبات المساعدين', 'salaries', 6000],
    ['تسويق وإعلانات', 'marketing', 850],
    ['طباعة ومذكرات', 'materials', 620],
    ['مواصلات ونثريات', 'other', 380],
  ];
  for (let offset = -5; offset <= 0; offset += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    for (const [title, category, amount] of categories) {
      expenses.push({
        id: id('exp'),
        title,
        category,
        amount: Math.round(amount * (0.9 + rand() * 0.2)),
        date: todayISO(new Date(d.getFullYear(), d.getMonth(), between(1, 27))),
        note: '',
        createdBy: 'system',
        createdAt: nowISO(),
      });
    }
  }

  return { charges, payments, expenses };
}

function makeAcademics(students, groups, enrollments) {
  const assignments = [];
  const grades = [];
  const materials = [];
  const notes = [];

  for (const group of groups) {
    const roster = enrollments.filter((e) => e.groupId === group.id && e.active);
    const sets = [
      { title: `واجب ${group.subject} — الأسبوع اللي فات`, type: 'homework', maxScore: 20 },
      { title: `كويز ${group.subject} — الشهر ده`, type: 'quiz', maxScore: 30 },
    ];
    for (const item of sets) {
      const assignment = {
        id: id('asg'),
        groupId: group.id,
        title: item.title,
        type: item.type,
        dueDate: todayISO(addDays(new Date(), -between(2, 14))),
        maxScore: item.maxScore,
        description: 'راجع الملزمة وحل التدريبات المرفقة قبل الحصة.',
        status: 'closed',
        createdAt: nowISO(),
      };
      assignments.push(assignment);
      for (const enrollment of roster) {
        if (!chance(0.78)) continue;
        grades.push({
          id: id('grd'),
          assignmentId: assignment.id,
          studentId: enrollment.studentId,
          score: Math.round(item.maxScore * (0.55 + rand() * 0.45)),
          feedback: chance(0.2) ? pick(['محتاج مراجعة فقرة كذا', 'شغل ممتاز', 'حل ناقص']) : '',
          gradedAt: nowISO(),
        });
      }
    }

    materials.push({
      id: id('mat'),
      title: `ملزمة ${group.subject} — الترم الحالي`,
      type: 'link',
      url: 'https://drive.google.com/',
      groupId: group.id,
      lessonId: null,
      description: 'الملزمة الكاملة بصيغة PDF — تتحدث كل أسبوع.',
      createdAt: nowISO(),
      createdBy: 'system',
    });
  }

  materials.push({
    id: id('mat'),
    title: 'جدول الحصص والمواعيد',
    type: 'note',
    url: '',
    groupId: null,
    lessonId: null,
    description: 'السبت والثلاثاء رياضيات، الأحد والأربعاء فيزياء، الاثنين والخميس كيمياء.',
    createdAt: nowISO(),
    createdBy: 'system',
  });

  const noteBodies = [
    'يوسف متحسنش في الواجب الأخير — محتاج متابعة مع والده.',
    'ملك عندها التزام ممتاز وحضور كامل الشهر ده.',
    'عمر متأخر في المصروفات، اتكلمت مع والده ووعد يحوّل أول الأسبوع.',
    'جنى بتحتاج تقوية في الفيزياء قبل الامتحان.',
    'مازن غاب 3 حصص متتالية — لازم اتصال سريع.',
    'نور مستواه ثابت وعنده قدرة على الدرجة النهائية.',
  ];
  noteBodies.forEach((body, index) => {
    notes.push({
      id: id('not'),
      studentId: students[index * 3].id,
      body,
      pinned: index < 2,
      createdAt: nowISO(),
      createdBy: 'system',
    });
  });

  return { assignments, grades, materials, notes };
}

function makeActivities(students, groups) {
  const actions = [
    ['payment.create', 'دفعة جديدة', (s) => `تم تسجيل دفعة من ${s.name}`],
    ['attendance.save', 'حضور', (s) => `تم تسجيل حضور حصة ${s.shortName}`],
    ['student.create', 'طالب جديد', (s) => `تم إضافة ${s.name}`],
    ['lesson.create', 'حصة جديدة', () => `تم جدولة حصة جديدة لمجموعة ${groups[0].name}`],
    ['assignment.grade', 'تصحيح', (s) => `تم تصحيح واجب ${s.shortName}`],
  ];
  return Array.from({ length: 18 }, (_, index) => {
    const student = students[(index * 5) % students.length];
    const [action, entity, detail] = actions[index % actions.length];
    return {
      id: id('act'),
      actorId: 'system',
      action,
      entity,
      entityId: student.id,
      detail: detail(student),
      at: nowISO(),
    };
  }).sort((a, b) => (a.at < b.at ? 1 : -1));
}

function makeExams(groups, enrollments) {
  const exams = [];
  const results = [];
  const templates = [
    { type: 'quiz', title: 'كويز سريع', maxScore: 10, status: 'graded' },
    { type: 'exam', title: 'امتحان الشهر', maxScore: 30, status: 'graded' },
    { type: 'final', title: 'امتحان نهاية الترم', maxScore: 60, status: 'open' },
  ];

  for (const group of groups) {
    for (let index = 0; index < templates.length; index += 1) {
      const template = templates[index];
      const date = todayISO(addDays(new Date(), index === 2 ? between(3, 12) : -between(6, 40)));
      const exam = {
        id: id('exm'),
        groupId: group.id,
        title: `${template.title} — ${group.subject}`,
        type: template.type,
        date,
        start: group.schedule[0] ? group.schedule[0].start : '16:00',
        duration: template.type === 'quiz' ? 20 : template.type === 'exam' ? 45 : 60,
        maxScore: template.maxScore,
        passScore: Math.round(template.maxScore * 0.5),
        status: template.status,
        description: 'الامتحان شامل الجزء اللي اتشرح في الحصص السابقة.',
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };
      exams.push(exam);
      if (template.status !== 'graded') continue;
      const roster = enrollments.filter((e) => e.groupId === group.id && e.active);
      for (const enrollment of roster) {
        if (!chance(0.9)) continue;
        const score = Math.round(template.maxScore * (0.5 + rand() * 0.5));
        results.push({
          id: id('exr'),
          examId: exam.id,
          studentId: enrollment.studentId,
          score,
          note: score < template.maxScore * 0.5 ? 'محتاج مراجعة' : '',
          gradedAt: nowISO(),
          gradedBy: 'system',
        });
      }
    }
  }
  return { exams, results };
}

function makePoints(students, groups) {
  const reasons = [
    ['behavior', 10, 'مشاركة ممتازة في الحصة'],
    ['behavior', 15, 'مساعدة زميل في الواجب'],
    ['competition', 25, 'مركز أول في مسابقة المركز'],
    ['competition', 20, 'حل تحدي الرياضيات الأسبوعي'],
    ['manual', 10, 'التزام كامل بالواجبات'],
    ['manual', 5, 'حضور مبكر طول الشهر'],
    ['behavior', 12, 'أخلاق عالية وتعاون'],
    ['competition', 30, 'فوز بمسابقة القدرات'],
  ];
  const points = [];
  students.forEach((student, index) => {
    const count = between(0, 3);
    for (let i = 0; i < count; i += 1) {
      const [category, value, reason] = pick(reasons);
      points.push({
        id: id('pnt'),
        studentId: student.id,
        groupId: groups[index % groups.length].id,
        category,
        points: value,
        reason,
        at: nowISO(),
        createdBy: 'system',
      });
    }
  });
  return points;
}

function makeCertificates(students) {
  const kinds = [
    { kind: 'excellence', title: 'شهادة تفوق', note: 'تقديراً لتفوقه الدراسي وحصوله على أعلى الدرجات.' },
    { kind: 'attendance', title: 'شهادة انتظام وحضور', note: 'تقديراً لحضوره الكامل والتزامه طوال الترم.' },
    { kind: 'completion', title: 'شهادة إتمام المنهج', note: 'بعد إتمام منهج الترم بالكامل والنجاح في التقييم.' },
  ];
  return students.slice(0, 10).map((student, index) => {
    const preset = kinds[index % kinds.length];
    return {
      id: id('crt'),
      studentId: student.id,
      kind: preset.kind,
      title: preset.title,
      note: preset.note,
      code: `CERT-${String(2026).slice(0)}-${String(index + 1).padStart(4, '0')}`,
      issuedAt: todayISO(addDays(new Date(), -between(3, 60))),
      issuedBy: 'system',
      status: 'active',
    };
  });
}

function makeShifts(users) {
  const shifts = [];
  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = todayISO(addDays(new Date(), -offset));
    for (const user of users) {
      if (!chance(0.72)) continue;
      shifts.push({
        id: id('shf'),
        userId: user.id,
        userName: user.name,
        date,
        start: pick(['09:00', '10:00', '14:00', '16:00']),
        end: pick(['15:00', '17:00', '20:00', '22:00']),
        role: user.role === 'admin' ? 'إدارة' : 'استقبال',
        status: offset === 0 ? 'open' : 'closed',
        note: '',
        createdAt: nowISO(),
      });
    }
  }
  return shifts;
}

function makeTreasury(users) {
  const treasury = [];
  const entries = [
    { type: 'deposit', title: 'إيداع تحصيل الأسبوع', amount: 4200, method: 'cash' },
    { type: 'withdraw', title: 'شراء ورق وطباعة ملازم', amount: 780, method: 'cash' },
    { type: 'withdraw', title: 'سلفة مصاريف نظافة', amount: 350, method: 'cash' },
    { type: 'deposit', title: 'تحويل فودافون كاش', amount: 1600, method: 'vodafone' },
    { type: 'withdraw', title: 'صيانة تكييف القاعة 2', amount: 1200, method: 'cash' },
    { type: 'deposit', title: 'إيداع بنكي', amount: 5000, method: 'bank' },
    { type: 'withdraw', title: 'مكافأة فريق الاستقبال', amount: 900, method: 'cash' },
    { type: 'deposit', title: 'تحصيل إنستاباي', amount: 2350, method: 'instapay' },
  ];
  entries.forEach((entry, index) => {
    treasury.push({
      id: id('trs'),
      ...entry,
      at: nowISO(),
      date: todayISO(addDays(new Date(), -index * 4)),
      by: users[index % users.length].name,
      note: entry.type === 'withdraw' ? 'مصروف تشغيلي معتمد' : 'تحصيل من أولياء الأمور',
      createdAt: nowISO(),
    });
  });
  return treasury;
}

function makeCodes(users) {
  const codes = [];
  for (let index = 0; index < 5; index += 1) {
    const plan = index < 2 ? 'monthly' : index < 4 ? 'yearly' : 'trial';
    codes.push({
      id: id('cod'),
      code: `DFT-${plan.slice(0, 3).toUpperCase()}-${String(between(1000, 9999))}-${String(between(1000, 9999))}`,
      plan,
      days: plan === 'trial' ? 14 : plan === 'monthly' ? 30 : 365,
      status: index >= 4 ? 'used' : 'unused',
      usedAt: index >= 4 ? nowISO() : null,
      usedBy: index >= 4 ? users[0].name : null,
      createdAt: nowISO(),
    });
  }
  return codes;
}

function makeSyncLogs() {
  return Array.from({ length: 6 }, (_, index) => ({
    id: id('syn'),
    at: nowISO(),
    date: todayISO(addDays(new Date(), -index * 3)),
    status: index === 2 ? 'error' : 'ok',
    files: between(2, 18),
    message: index === 2 ? 'تعذر الوصول للمجلد — تأكد من صلاحيات المسار' : 'تمت مزامنة الملفات بنجاح',
  }));
}

function seed() {
  const settings = {
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
    createdAt: nowISO(),
  };

  const users = [
    {
      id: 'usr_owner',
      name: 'أ. محمود حسن',
      email: 'admin@daftary.app',
      phone: '01001234567',
      role: 'admin',
      active: true,
      passwordHash: null,
      salt: null,
      avatarColor: '#2f6f5e',
      createdAt: nowISO(),
      lastLoginAt: null,
    },
    {
      id: 'usr_assistant',
      name: 'سارة عبد العال',
      email: 'assistant@daftary.app',
      phone: '01109876543',
      role: 'assistant',
      active: true,
      passwordHash: null,
      salt: null,
      avatarColor: '#c25a3c',
      createdAt: nowISO(),
      lastLoginAt: null,
    },
  ];

  const students = makeStudents();
  const groups = makeGroups();
  const enrollments = makeEnrollments(students, groups);
  const lessons = makeLessons(groups);
  const attendance = makeAttendance(lessons, enrollments);
  const { charges, payments, expenses } = makeFinance(students, groups, enrollments);
  const { assignments, grades, materials, notes } = makeAcademics(students, groups, enrollments);
  const { exams, results: examResults } = makeExams(groups, enrollments);
  const points = makePoints(students, groups);
  const certificates = makeCertificates(students);
  const shifts = makeShifts(users);
  const treasury = makeTreasury(users);
  const codes = makeCodes(users);
  const syncLogs = makeSyncLogs();
  const activities = makeActivities(students, groups);

  return {
    version: 1,
    createdAt: nowISO(),
    settings,
    users,
    students,
    groups,
    enrollments,
    lessons,
    attendance,
    charges,
    payments,
    expenses,
    assignments,
    grades,
    materials,
    notes,
    exams,
    examResults,
    points,
    certificates,
    shifts,
    treasury,
    codes,
    syncLogs,
    activities,
    sessions: [],
  };
}

module.exports = { seed };
