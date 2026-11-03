'use strict';

const fs = require('fs');
const path = require('path');
const { id, str, fail, nowISO } = require('../lib/utils');
const db = require('../lib/db');
const domain = require('../lib/domain');
const { log, findMaterial, findGroup, findLesson, searchText, matches, ensureAdmin } = require('./_helpers');

const TYPES = ['link', 'note', 'file'];
const MAX_UPLOAD = 10 * 1024 * 1024;
const EXT_BY_MIME = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/zip': 'zip',
  'application/x-rar-compressed': 'rar',
};

function safeExt(name, mime) {
  const ext = path.extname(String(name || '')).replace(/[^a-zA-Z0-9.]/g, '').slice(1, 8).toLowerCase();
  return ext || EXT_BY_MIME[mime] || 'bin';
}

module.exports = [
  {
    method: 'GET',
    path: '/api/materials',
    handler: (ctx) => {
      const { state, query } = ctx;
      let items = state.materials.map((m) => {
        const group = m.groupId ? domain.byId(state.groups, m.groupId) : null;
        const lesson = m.lessonId ? domain.byId(state.lessons, m.lessonId) : null;
        return {
          ...m,
          groupName: group ? group.name : '',
          groupColor: group ? group.color : '',
          lessonDate: lesson ? lesson.date : null,
        };
      });
      if (query.groupId) items = items.filter((m) => m.groupId === query.groupId);
      if (query.type) items = items.filter((m) => m.type === query.type);
      const needle = searchText(query.search);
      if (needle) items = items.filter((m) => [m.title, m.description, m.groupName].some((v) => matches(v, needle)));
      items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return { items, total: items.length };
    },
  },
  {
    method: 'POST',
    path: '/api/materials',
    handler: (ctx) => {
      const title = str(ctx.body.title, { required: true, field: 'العنوان', min: 2, max: 120 });
      const type = ['link', 'note', 'file'].includes(ctx.body.type) ? ctx.body.type : 'link';
      const description = str(ctx.body.description, { max: 1000, field: 'الوصف' });
      const url = str(ctx.body.url, { max: 500, field: 'الرابط' });
      if (type === 'link' && !/^https?:\/\//i.test(url)) {
        throw fail(422, 'الرابط لازم يبدأ بـ http أو https', 'VALIDATION', { url: 'رابط غير صحيح' });
      }
      if (type === 'note' && !description) {
        throw fail(422, 'اكتب نص الملاحظة', 'VALIDATION', { description: 'مطلوب' });
      }
      if (ctx.body.groupId) findGroup(ctx.state, ctx.body.groupId);
      if (ctx.body.lessonId) findLesson(ctx.state, ctx.body.lessonId);
      return ctx.mutate((state) => {
        const material = {
          id: id('mat'),
          title,
          type,
          url: type === 'file' ? url : type === 'link' ? url : '',
          groupId: ctx.body.groupId || null,
          lessonId: ctx.body.lessonId || null,
          description,
          fileName: str(ctx.body.fileName, { max: 160, field: 'اسم الملف' }),
          fileSize: Number(ctx.body.fileSize) || 0,
          mime: str(ctx.body.mime, { max: 120, field: 'نوع الملف' }),
          createdAt: nowISO(),
          createdBy: ctx.user.id,
        };
        state.materials.unshift(material);
        log(state, ctx.user, 'material.create', 'material', material.id, `إضافة مادة ${material.title}`);
        return { material };
      });
    },
  },
  {
    method: 'PATCH',
    path: '/api/materials/:id',
    handler: (ctx) => {
      const material = findMaterial(ctx.state, ctx.params.id);
      return ctx.mutate((state) => {
        const target = findMaterial(state, material.id);
        if (ctx.body.title !== undefined) {
          target.title = str(ctx.body.title, { required: true, min: 2, max: 120, field: 'العنوان' });
        }
        if (ctx.body.description !== undefined) {
          target.description = str(ctx.body.description, { max: 1000, field: 'الوصف' });
        }
        if (ctx.body.url !== undefined) target.url = str(ctx.body.url, { max: 500, field: 'الرابط' });
        if (ctx.body.groupId !== undefined) target.groupId = ctx.body.groupId || null;
        target.updatedAt = nowISO();
        return { material: target };
      });
    },
  },
  {
    method: 'DELETE',
    path: '/api/materials/:id',
    handler: (ctx) => {
      const material = findMaterial(ctx.state, ctx.params.id);
      return ctx.mutate((state) => {
        state.materials = state.materials.filter((m) => m.id !== material.id);
        if (material.type === 'file' && material.url?.startsWith('/uploads/')) {
          const file = path.join(db.UPLOAD_DIR, path.basename(material.url));
          try {
            fs.unlinkSync(file);
          } catch {
            /* ignore */
          }
        }
        log(state, ctx.user, 'material.delete', 'material', material.id, `حذف مادة ${material.title}`);
        return { ok: true };
      });
    },
  },
  {
    method: 'POST',
    path: '/api/uploads',
    handler: (ctx) => {
      const raw = String(ctx.body.dataUrl || '');
      const match = raw.match(/^data:([\w/+.-]+);base64,(.+)$/s);
      if (!match) throw fail(422, 'الملف غير صحيح', 'VALIDATION');
      const mime = match[1].toLowerCase();
      const buffer = Buffer.from(match[2], 'base64');
      if (!buffer.length) throw fail(422, 'الملف فاضي', 'VALIDATION');
      if (buffer.length > MAX_UPLOAD) {
        throw fail(413, 'حجم الملف أكبر من ١٠ ميجا', 'TOO_LARGE');
      }
      if (!EXT_BY_MIME[mime] && !mime.startsWith('text/')) {
        throw fail(422, 'نوع الملف مش مدعوم', 'VALIDATION');
      }
      db.ensureDirs();
      const original = str(ctx.body.name, { max: 160, field: 'اسم الملف' }) || 'file';
      const name = `${id('upl')}.${safeExt(original, mime)}`;
      fs.writeFileSync(path.join(db.UPLOAD_DIR, name), buffer);
      log(ctx.state, ctx.user, 'upload.create', 'file', name, `رفع ملف ${original}`);
      db.save();
      return {
        file: {
          name: original,
          storedName: name,
          url: `/uploads/${name}`,
          size: buffer.length,
          mime,
          uploadedAt: nowISO(),
        },
      };
    },
  },
];
