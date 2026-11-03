'use strict';

const { id, str, num, oneOf, dateStr, fail, nowISO, todayISO } = require('../lib/utils');
const domain = require('../lib/domain');
const features = require('../lib/features');
const { log, findStudent, findGroup, ensureAdmin, searchText, csvResult, toCsv } = require('./_helpers');

const POINT_CATEGORIES = ['attendance', 'grade', 'behavior', 'competition', 'manual'];
const CERT_KINDS = ['excellence', 'attendance', 'completion', 'custom'];
const CERT_STATUSES = ['active', 'revoked'];

function findCertificate(state, certId) {
  const cert = state.certificates.find((c) => c.id === certId);
  if (!cert) throw fail(404, 'الشهادة مش موجودة', 'NOT_FOUND');
  return cert;
}

function nextCertCode(state) {
  const year = new Date().getFullYear();
  const prefix = `CERT-${year}-`;
  let max = 0;
  for (const cert of state.certificates) {
    if (String(cert.code || '').startsWith(prefix)) {
      const n = Number(String(cert.code).slice(prefix.length));
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

function certificatePayload(state, body, kindFallback = 'custom') {
  return {
    kind: oneOf(body.kind, CERT_KINDS, 'نوع الشهادة', kindFallback),
    title: str(body.title, { max: 180 }),
    note: str(body.note, { max: 800 }),
    issuedAt: dateStr(body.issuedAt, 'تاريخ الإصدار') || todayISO(),
  };
}

module.exports = [
  {
    method: 'GET',
    path: '/api/points',
    handler: (ctx) => {
      const { state, query } = ctx;
      const rows = features.studentPointRows(state, {
        from: query.from,
        to: query.to,
        groupId: query.groupId,
      });
      let items = rows;
      if (query.studentId) items = items.filter((r) => r.studentId === query.studentId);
      const needle = searchText(query.q || '');
      if (needle) items = items.filter((r) => searchText(r.fullName).includes(needle));
      items = items.sort((a, b) => b.total - a.total);
      return {
        items,
        summary: {
          total: items.reduce((t, r) => t + r.total, 0),
          average: items.length ? domain.round2(items.reduce((t, r) => t + r.total, 0) / items.length) : 0,
          top: items[0] || null,
          entries: state.points.length,
        },
      };
    },
  },
  {
    method: 'POST',
    path: '/api/points',
    handler: (ctx) => {
      const student = findStudent(ctx.state, str(ctx.body.studentId, { required: true, field: 'الطالب' }));
      const points = num(ctx.body.points, { min: -500, max: 500, required: true, field: 'النقاط' });
      const payload = {
        studentId: student.id,
        groupId: ctx.body.groupId ? findGroup(ctx.state, ctx.body.groupId).id : null,
        category: oneOf(ctx.body.category, POINT_CATEGORIES, 'نوع النقاط', 'manual'),
        points,
        reason: str(ctx.body.reason, { max: 300 }),
      };
      return ctx.mutate((state) => {
        const entry = { id: id('pnt'), ...payload, at: nowISO(), createdBy: ctx.user.name };
        state.points.push(entry);
        log(state, ctx.user, 'points.add', 'student', student.id, `${points} نقطة — ${student.shortName}`);
        const row = features.studentPointRows(state).find((r) => r.studentId === student.id);
        return { entry, row };
      });
    },
  },
  {
    method: 'DELETE',
    path: '/api/points/:id',
    handler: (ctx) => {
      return ctx.mutate((state) => {
        const entry = state.points.find((p) => p.id === ctx.params.id);
        if (!entry) throw fail(404, 'النقاط مش موجودة', 'NOT_FOUND');
        state.points = state.points.filter((p) => p.id !== entry.id);
        log(state, ctx.user, 'points.delete', 'student', entry.studentId, `حذف ${entry.points} نقطة`);
        return { ok: true };
      });
    },
  },
  {
    method: 'GET',
    path: '/api/hall-of-fame',
    handler: (ctx) => {
      const { state, query } = ctx;
      const limit = Math.min(100, Math.max(3, Number(query.limit) || 20));
      const rows = features.studentPointRows(state);
      const filtered = query.groupId ? rows.filter((r) => r.groupIds.includes(query.groupId)) : rows;
      const items = features.leaderboard(state, { limit, groupId: query.groupId || null });
      const groups = state.groups
        .filter((g) => g.status === 'active')
        .map((g) => ({ id: g.id, name: g.name, color: g.color }));
      const average = filtered.length
        ? domain.round2(filtered.reduce((t, r) => t + r.total, 0) / filtered.length)
        : 0;
      const attendanceChampions = features.absenceArchive(state, {});
      return {
        items,
        groups,
        stats: {
          participants: filtered.length,
          average,
          topPoints: items[0]?.total || 0,
          zeroCount: filtered.filter((r) => r.total <= 0).length,
          absentTotal: attendanceChampions.counts.absent,
        },
        archive: attendanceChampions.students.slice(0, 10),
      };
    },
  },
  {
    method: 'GET',
    path: '/api/certificates',
    handler: (ctx) => {
      const { state, query } = ctx;
      let items = state.certificates.map((c) => features.certificateView(state, c));
      if (query.studentId) items = items.filter((c) => c.studentId === query.studentId);
      if (query.kind && query.kind !== 'all') items = items.filter((c) => c.kind === query.kind);
      if (query.status && query.status !== 'all') items = items.filter((c) => c.status === query.status);
      const needle = searchText(query.q || '');
      if (needle) {
        items = items.filter(
          (c) => searchText(c.studentName).includes(needle) || searchText(c.title).includes(needle),
        );
      }
      items.sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)));
      return {
        items,
        summary: {
          total: items.length,
          active: items.filter((c) => c.status === 'active').length,
          excellence: items.filter((c) => c.kind === 'excellence').length,
          thisMonth: items.filter((c) => String(c.issuedAt).startsWith(todayISO().slice(0, 7))).length,
        },
      };
    },
  },
  {
    method: 'POST',
    path: '/api/certificates',
    handler: (ctx) => {
      const student = findStudent(ctx.state, str(ctx.body.studentId, { required: true, field: 'الطالب' }));
      const payload = certificatePayload(ctx.state, ctx.body);
      return ctx.mutate((state) => {
        const cert = {
          id: id('crt'),
          studentId: student.id,
          ...payload,
          code: nextCertCode(state),
          issuedBy: ctx.user.name,
          status: 'active',
        };
        state.certificates.push(cert);
        log(state, ctx.user, 'certificate.issue', 'student', student.id, `إصدار ${cert.title} — ${student.shortName}`);
        return { certificate: features.certificateView(state, cert) };
      });
    },
  },
  {
    method: 'POST',
    path: '/api/certificates/bulk',
    handler: (ctx) => {
      const ids = Array.isArray(ctx.body.studentIds) ? ctx.body.studentIds : [];
      if (!ids.length) throw fail(422, 'اختار طالب واحد على الأقل', 'VALIDATION');
      const payload = certificatePayload(ctx.state, ctx.body, 'excellence');
      return ctx.mutate((state) => {
        const created = [];
        for (const studentId of ids) {
          const student = state.students.find((s) => s.id === studentId);
          if (!student) continue;
          const cert = {
            id: id('crt'),
            studentId: student.id,
            ...payload,
            code: nextCertCode(state),
            issuedBy: ctx.user.name,
            status: 'active',
          };
          state.certificates.push(cert);
          created.push(cert);
        }
        log(state, ctx.user, 'certificate.bulk', 'certificate', null, `إصدار ${created.length} شهادة`);
        return { count: created.length, items: created.map((c) => features.certificateView(state, c)) };
      });
    },
  },
  {
    method: 'GET',
    path: '/api/certificates/:id',
    handler: (ctx) => {
      const cert = findCertificate(ctx.state, ctx.params.id);
      return { certificate: features.certificateView(ctx.state, cert) };
    },
  },
  {
    method: 'PATCH',
    path: '/api/certificates/:id',
    handler: (ctx) => {
      const { id: certId } = ctx.params;
      return ctx.mutate((state) => {
        const cert = findCertificate(state, certId);
        if (ctx.body.title !== undefined) cert.title = str(ctx.body.title, { max: 180 });
        if (ctx.body.note !== undefined) cert.note = str(ctx.body.note, { max: 800 });
        if (ctx.body.kind !== undefined) cert.kind = oneOf(ctx.body.kind, CERT_KINDS, 'نوع الشهادة');
        if (ctx.body.status !== undefined)
          cert.status = oneOf(ctx.body.status, CERT_STATUSES, 'حالة الشهادة');
        if (ctx.body.issuedAt !== undefined)
          cert.issuedAt = dateStr(ctx.body.issuedAt, 'تاريخ الإصدار') || cert.issuedAt;
        log(state, ctx.user, 'certificate.update', 'certificate', cert.id, `تعديل ${cert.title}`);
        return { certificate: features.certificateView(state, cert) };
      });
    },
  },
  {
    method: 'DELETE',
    path: '/api/certificates/:id',
    handler: (ctx) => {
      return ctx.mutate((state) => {
        const cert = findCertificate(state, ctx.params.id);
        state.certificates = state.certificates.filter((c) => c.id !== cert.id);
        log(state, ctx.user, 'certificate.delete', 'certificate', cert.id, `حذف ${cert.title}`);
        return { ok: true };
      });
    },
  },
  {
    method: 'GET',
    path: '/api/certificates/export/csv',
    handler: (ctx) => {
      const rows = ctx.state.certificates.map((c) => features.certificateView(ctx.state, c));
      const text = toCsv(
        ['الكود', 'الطالب', 'الشهادة', 'النوع', 'تاريخ الإصدار', 'الحالة'],
        rows.map((c) => [c.code, c.studentName, c.title, c.kind, c.issuedAt, c.status === 'active' ? 'سارية' : 'ملغية']),
      );
      return csvResult(text, 'certificates.csv');
    },
  },
];
