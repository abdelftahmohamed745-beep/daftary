'use strict';

/**
 * Vercel serverless entry point.
 *
 * The app is a plain Node HTTP server. Vercel gives each invocation a
 * read-only project directory, so the demo database lives in /tmp and is
 * seeded from lib/seed.js on a cold start.
 */
process.env.DAFTARY_DATA_DIR = process.env.DAFTARY_DATA_DIR || '/tmp/daftary-data';
process.env.DAFTARY_SHOW_CREDENTIALS = '0';

const db = require('../lib/db');
const { requestListener } = require('../server');

db.load();

module.exports = (req, res) => {
  requestListener(req, res).catch((error) => {
    if (res.headersSent) {
      res.end();
      return;
    }
    res.statusCode = error && error.status ? error.status : 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        error: {
          message: (error && error.message) || 'حصلت مشكلة في السيرفر',
          code: (error && error.code) || 'SERVER_ERROR',
        },
      }),
    );
  });
};
