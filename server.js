'use strict';

// Serverless builds (Vercel) mount the project read-only, so the demo database
// has to live somewhere writable. This must run before lib/db resolves paths.
if (process.env.VERCEL && !process.env.DAFTARY_DATA_DIR) {
  process.env.DAFTARY_DATA_DIR = '/tmp/daftary-data';
}

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { URL } = require('url');

const db = require('./lib/db');
const auth = require('./lib/auth');
const { AppError, fail } = require('./lib/utils');

const PUBLIC_DIR = path.join(__dirname, 'public');
const BODY_LIMIT = 14 * 1024 * 1024;

// Listed explicitly (not with a variable) so bundlers such as Vercel's can
// statically trace every route module into the deployed function.
const ROUTE_MODULES = [
  require('./routes/auth'),
  require('./routes/students'),
  require('./routes/groups'),
  require('./routes/lessons'),
  require('./routes/finance'),
  require('./routes/assignments'),
  require('./routes/materials'),
  require('./routes/exams'),
  require('./routes/achievements'),
  require('./routes/operations'),
  require('./routes/portal'),
  require('./routes/reports'),
  require('./routes/admin'),
];

const routes = [];
for (const list of ROUTE_MODULES) {
  for (const route of list) routes.push(route);
}

for (const route of routes) {
  const keys = [];
  const pattern = route.path
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        keys.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  route.regex = new RegExp(`^${pattern}/?$`);
  route.keys = keys;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

const UPLOAD_MIME = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip',
  '.rar': 'application/vnd.rar',
};

const gzipCache = new Map();

function securityHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  );
  if (req.socket.encrypted || String(req.headers['x-forwarded-proto'] || '') === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data === undefined ? null : data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendError(res, error) {
  if (error instanceof AppError) {
    return sendJson(res, error.status, {
      error: { message: error.message, code: error.code, fields: error.fields || undefined },
    });
  }
  console.error('[daftary]', error);
  return sendJson(res, 500, {
    error: { message: 'حصلت مشكلة في السيرفر، جرب تاني.', code: 'INTERNAL' },
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(fail(413, 'الطلب كبير أوي', 'TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(fail(400, 'البيانات المرسلة مش صحيحة', 'BAD_JSON'));
      }
    });
    req.on('error', reject);
  });
}

function checkOrigin(req) {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return;
  const origin = req.headers.origin || req.headers.referer;
  if (!origin) return;
  try {
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
    if (new URL(origin).host !== host) {
      throw fail(403, 'الطلب مش من نفس الموقع', 'BAD_ORIGIN');
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw fail(403, 'الطلب مش من نفس الموقع', 'BAD_ORIGIN');
  }
}

function serveFile(req, res, filePath, { cache = false, download = null } = {}) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;
  const ext = path.extname(filePath).toLowerCase();
  const type = (download ? UPLOAD_MIME[ext] : MIME[ext]) || 'application/octet-stream';
  const etag = `W/"${stat.size}-${stat.mtimeMs.toString(36)}"`;
  res.setHeader('Content-Type', type);
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', cache ? 'public, max-age=3600' : 'no-cache');
  if (download) {
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(download)}`);
  }
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304);
    res.end();
    return true;
  }
  const compressible = /^(text\/|application\/(json|javascript|xml)|image\/svg)/.test(type);
  const acceptsGzip = String(req.headers['accept-encoding'] || '').includes('gzip');
  if (compressible && acceptsGzip && stat.size > 1400) {
    const key = `${filePath}:${stat.mtimeMs}`;
    let body = gzipCache.get(key);
    if (!body) {
      body = zlib.gzipSync(fs.readFileSync(filePath));
      if (gzipCache.size > 60) gzipCache.clear();
      gzipCache.set(key, body);
    }
    res.writeHead(200, {
      'Content-Encoding': 'gzip',
      'Vary': 'Accept-Encoding',
      'Content-Length': body.length,
    });
    return res.end(req.method === 'HEAD' ? undefined : body), true;
  }
  res.writeHead(200, { 'Content-Length': stat.size });
  if (req.method === 'HEAD') return res.end(), true;
  fs.createReadStream(filePath).pipe(res);
  return true;
}

function serveUpload(req, res, pathname) {
  const session = auth.sessionUser(req);
  if (!session) {
    return sendJson(res, 401, { error: { message: 'لازم تسجل دخول الأول', code: 'UNAUTHORIZED' } });
  }
  const name = decodeURIComponent(pathname.replace(/^\/uploads\//, ''));
  const safe = path.basename(name);
  const full = path.join(db.UPLOAD_DIR, safe);
  if (!full.startsWith(db.UPLOAD_DIR)) {
    return sendJson(res, 400, { error: { message: 'مسار غير صحيح', code: 'BAD_PATH' } });
  }
  if (!serveFile(req, res, full, { cache: true, download: safe })) {
    return sendJson(res, 404, { error: { message: 'الملف مش موجود', code: 'NOT_FOUND' } });
  }
  return null;
}

async function handleApi(req, res, url) {
  const method = req.method === 'HEAD' ? 'GET' : req.method;
  let matched = null;
  for (const route of routes) {
    if (route.method !== method) continue;
    const result = route.regex.exec(url.pathname);
    if (!result) continue;
    matched = { route, params: {} };
    route.keys.forEach((key, index) => {
      matched.params[key] = decodeURIComponent(result[index + 1]);
    });
    break;
  }
  if (!matched) throw fail(404, 'الرابط مش موجود', 'NOT_FOUND');

  const { route, params } = matched;
  const userSession = auth.sessionUser(req);
  if (!route.public && !userSession) {
    throw fail(401, 'لازم تسجل دخول الأول', 'UNAUTHORIZED');
  }
  if (route.adminOnly && userSession?.user.role !== 'admin') {
    throw fail(403, 'الصلاحية دي للمدير بس', 'FORBIDDEN');
  }
  checkOrigin(req);

  let body = {};
  if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
    body = await readBody(req);
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      throw fail(400, 'البيانات لازم تكون JSON object', 'BAD_BODY');
    }
  }

  const query = {};
  for (const [key, value] of url.searchParams.entries()) query[key] = value;

  const ctx = {
    req,
    res,
    params,
    query,
    body,
    user: userSession ? userSession.user : null,
    session: userSession ? userSession.session : null,
    state: db.get(),
    mutate: db.mutate,
  };

  const result = await route.handler(ctx);
  if (res.writableEnded) return;

  if (result && result.__csv !== undefined) {
    const filename = result.filename || 'export.csv';
    const buffer = Buffer.from(result.__csv, 'utf8');
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Length': buffer.length,
      'Content-Disposition': `attachment; filename="${filename.replace(/[^\w.-]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    });
    res.end(buffer);
    return;
  }
  if (result && result.__html !== undefined) {
    const buffer = Buffer.from(result.__html, 'utf8');
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': buffer.length,
      'Cache-Control': 'no-store',
    });
    res.end(buffer);
    return;
  }
  if (result && result.__file) {
    const stat = fs.statSync(result.__file);
    res.setHeader('Content-Type', result.contentType || 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${(result.filename || 'backup.json').replace(/[^\w.-]/g, '_')}"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.writeHead(200);
    fs.createReadStream(result.__file).pipe(res);
    return;
  }
  sendJson(res, 200, result === undefined ? { ok: true } : result);
}

function handleStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  const ext = path.extname(pathname);
  const isAsset = Boolean(ext);
  if (pathname === '/') pathname = '/index.html';
  const safe = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(PUBLIC_DIR, safe);
  if (!full.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('ممنوع');
  }
  if (serveFile(req, res, full, { cache: isAsset })) return;
  if (!isAsset) {
    return serveFile(req, res, path.join(PUBLIC_DIR, 'index.html'), { cache: false });
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('الملف مش موجود');
}

async function requestListener(req, res) {
  securityHeaders(req, res);
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    res.writeHead(400);
    return res.end();
  }
  try {
    if (url.pathname.startsWith('/uploads/')) {
      serveUpload(req, res, url.pathname);
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }
    handleStatic(req, res, url);
  } catch (error) {
    if (!res.headersSent) return sendError(res, error);
    try {
      res.end();
    } catch {
      /* ignore */
    }
  }
}

function createServer() {
  return http.createServer((req, res) => {
    requestListener(req, res).catch((error) => {
      if (!res.headersSent) sendError(res, error);
      else res.end();
    });
  });
}

function listen(server, port, attempts = 0) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.removeListener('listening', onListening);
      if (error.code === 'EADDRINUSE' && attempts < 12) {
        listen(server, port + 1, attempts + 1).then(resolve, reject);
      } else {
        reject(error);
      }
    };
    const onListening = () => {
      server.removeListener('error', onError);
      resolve(port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, process.env.HOST || '0.0.0.0');
  });
}

async function start(port = Number(process.env.PORT) || 3000) {
  db.load();
  const server = createServer();
  const actual = await listen(server, port);
  const stats = db.stats();
  console.log(`\n  دفتري شغال على http://localhost:${actual}`);
  console.log(`  الداتا: ${stats.file} (${stats.counts.students} طالب، ${stats.counts.groups} مجموعة)`);
  if (process.env.DAFTARY_SHOW_CREDENTIALS !== '0' && stats.counts.users && db.DEFAULT_PASSWORD) {
    console.log(`  دخول تجريبي: admin@daftary.app / ${db.DEFAULT_PASSWORD}\n`);
  }
  const shutdown = () => {
    try {
      db.save();
    } catch {
      /* ignore */
    }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  return { server, port: actual };
}

if (require.main === module) {
  start().catch((error) => {
    console.error('مش قادر أشغل السيرفر:', error.message);
    process.exit(1);
  });
}

// Vercel's zero-config Node runtime imports this file directly and expects the
// module itself to be the request handler, so the listener is the default
// export while the named helpers stay attached for scripts and api/index.js.
module.exports = requestListener;
module.exports.default = requestListener;
module.exports.createServer = createServer;
module.exports.start = start;
module.exports.requestListener = requestListener;
module.exports.routes = routes;
