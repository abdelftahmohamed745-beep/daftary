'use strict';

const crypto = require('crypto');

const KEY_LEN = 64;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const passwordHash = crypto.scryptSync(String(password), salt, KEY_LEN, SCRYPT).toString('hex');
  return { salt, passwordHash };
}

function verifyPassword(password, salt, passwordHash) {
  if (!salt || !passwordHash) return false;
  const candidate = crypto.scryptSync(String(password), salt, KEY_LEN, SCRYPT);
  const known = Buffer.from(passwordHash, 'hex');
  if (known.length !== candidate.length) return false;
  return crypto.timingSafeEqual(candidate, known);
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'الباسورد لازم يكون 8 حروف على الأقل';
  }
  if (password.length > 128) return 'الباسورد طويل أوي';
  if (!/[A-Za-z\u0600-\u06FF]/.test(password) || !/\d/.test(password)) {
    return 'الباسورد لازم يحتوي على حروف وأرقام';
  }
  return null;
}

module.exports = { hashPassword, verifyPassword, randomToken, tokenHash, passwordProblem };
