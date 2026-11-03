'use strict';

const crypto = require('crypto');
const db = require('./db');
const { verifyPassword, randomToken, tokenHash } = require('./passwords');
const { fail, nowISO } = require('./utils');

const COOKIE = 'daftary_session';
const ID_COOKIE = 'daftary_identity';
const IDENTITY_SECRET = process.env.DAFTARY_SECRET || 'daftary-demo-secret';
const SESSION_HOURS = 12;
const REMEMBER_HOURS = 24 * 30;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

const attempts = new Map();

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function cookieValue(token, maxAgeSeconds) {
  return [
    `${COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
}

function isSecure(req) {
  return Boolean(req.socket.encrypted) || String(req.headers['x-forwarded-proto'] || '') === 'https';
}

function appendCookie(res, cookie) {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) res.setHeader('Set-Cookie', cookie);
  else res.setHeader('Set-Cookie', Array.isArray(existing) ? [...existing, cookie] : [existing, cookie]);
}

function signIdentity(payload) {
  return crypto.createHmac('sha256', IDENTITY_SECRET).update(payload).digest('base64url');
}

function identityCookie(req, user, maxAge) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, exp: Date.now() + maxAge * 1000 })).toString(
    'base64url',
  );
  const parts = [
    `${ID_COOKIE}=${payload}.${signIdentity(payload)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (isSecure(req)) parts.push('Secure');
  return parts.join('; ');
}

function readIdentity(req) {
  const raw = parseCookies(req)[ID_COOKIE];
  if (!raw) return null;
  const index = raw.lastIndexOf('.');
  if (index <= 0) return null;
  const payload = raw.slice(0, index);
  const signature = raw.slice(index + 1);
  const expected = signIdentity(payload);
  if (signature.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data || !data.id || !data.exp || data.exp < Date.now()) return null;
    return data.id;
  } catch {
    return null;
  }
}

function setSessionCookie(req, res, token, remember, user) {
  const maxAge = remember ? REMEMBER_HOURS * 3600 : SESSION_HOURS * 3600;
  const parts = cookieValue(token, maxAge);
  if (isSecure(req)) parts.push('Secure');
  appendCookie(res, parts.join('; '));
  // Serverless platforms may serve the next request from a fresh instance that
  // has no session rows. The signed identity cookie keeps the login valid there.
  if (user) appendCookie(res, identityCookie(req, user, maxAge));
}

function clearSessionCookie(res) {
  appendCookie(res, `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  appendCookie(res, `${ID_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function rateKey(req, email) {
  return `${clientIp(req)}|${String(email || '').toLowerCase()}`;
}

function checkRate(req, email) {
  const key = rateKey(req, email);
  const entry = attempts.get(key);
  const now = Date.now();
  if (entry && entry.blockedUntil && entry.blockedUntil > now) {
    const minutes = Math.ceil((entry.blockedUntil - now) / 60000);
    throw fail(429, `محاولات دخول كتير. استنى ${minutes} دقيقة وجرب تاني.`, 'RATE_LIMIT');
  }
  if (entry && now - entry.firstAt > WINDOW_MS) attempts.delete(key);
}

function noteFailure(req, email) {
  const key = rateKey(req, email);
  const now = Date.now();
  const entry = attempts.get(key) || { count: 0, firstAt: now };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) entry.blockedUntil = now + WINDOW_MS;
  attempts.set(key, entry);
}

function clearFailures(req, email) {
  attempts.delete(rateKey(req, email));
}

function cleanupSessions(state) {
  const now = Date.now();
  state.sessions = state.sessions.filter((s) => new Date(s.expiresAt).getTime() > now);
}

function login(req, email, password, remember = false) {
  const state = db.get();
  checkRate(req, email);
  const user = state.users.find((u) => String(u.email).toLowerCase() === String(email).trim().toLowerCase());
  if (!user || !user.active || !verifyPassword(password, user.salt, user.passwordHash)) {
    noteFailure(req, email);
    throw fail(401, 'الإيميل أو الباسورد مش صح', 'BAD_CREDENTIALS');
  }
  clearFailures(req, email);
  cleanupSessions(state);
  const token = randomToken(32);
  const hours = remember ? REMEMBER_HOURS : SESSION_HOURS;
  state.sessions.push({
    id: `ses_${tokenHash(token).slice(0, 16)}`,
    tokenHash: tokenHash(token),
    userId: user.id,
    createdAt: nowISO(),
    expiresAt: new Date(Date.now() + hours * 3600 * 1000).toISOString(),
    lastSeenAt: nowISO(),
    ip: clientIp(req),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 200),
  });
  user.lastLoginAt = nowISO();
  db.save();
  return { token, user, expiresAt: state.sessions[state.sessions.length - 1].expiresAt };
}

function logout(req) {
  const state = db.get();
  const token = parseCookies(req)[COOKIE];
  if (token) {
    const hash = tokenHash(token);
    state.sessions = state.sessions.filter((s) => s.tokenHash !== hash);
    db.save();
  }
}

function sessionUser(req) {
  const token = parseCookies(req)[COOKIE];
  const state = db.get();
  if (!token) return identitySession(req, state);
  const hash = tokenHash(token);
  const session = state.sessions.find((s) => s.tokenHash === hash);
  if (!session) return identitySession(req, state);
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    state.sessions = state.sessions.filter((s) => s.tokenHash !== hash);
    db.save();
    return null;
  }
  const user = state.users.find((u) => u.id === session.userId);
  if (!user || !user.active) return null;
  const last = new Date(session.lastSeenAt || 0).getTime();
  if (Date.now() - last > 5 * 60 * 1000) {
    session.lastSeenAt = nowISO();
    db.save();
  }
  return { user, session };
}

function identitySession(req, state) {
  const userId = readIdentity(req);
  if (!userId) return null;
  const user = state.users.find((u) => u.id === userId);
  if (!user || !user.active) return null;
  return {
    user,
    session: {
      id: 'identity',
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString(),
      lastSeenAt: nowISO(),
    },
  };
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    role: user.role,
    active: user.active !== false,
    avatarColor: user.avatarColor || '#2f6f5e',
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt,
  };
}

function requireUser(ctx) {
  if (!ctx.user) throw fail(401, 'لازم تسجل دخول الأول', 'UNAUTHORIZED');
  return ctx.user;
}

function requireAdmin(ctx) {
  const user = requireUser(ctx);
  if (user.role !== 'admin') {
    throw fail(403, 'الصلاحية دي للمدير بس', 'FORBIDDEN');
  }
  return user;
}

module.exports = {
  COOKIE,
  clientIp,
  parseCookies,
  setSessionCookie,
  clearSessionCookie,
  login,
  logout,
  sessionUser,
  publicUser,
  requireUser,
  requireAdmin,
  cleanupSessions,
};
