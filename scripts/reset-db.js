'use strict';

/**
 * Rebuild the demo database from lib/seed.js.
 *
 *   node scripts/reset-db.js            # reset the normal data folder
 *   node scripts/reset-db.js --yes      # skip confirmation
 *   DAFTARY_DATA_DIR=/tmp/x node scripts/reset-db.js --yes
 *
 * A backup of the current database is written to data/backups before reset.
 */

const readline = require('readline');
const db = require('../lib/db');

async function confirm(question) {
  if (!process.stdin.isTTY) return false;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question(question, resolve));
  rl.close();
  return /^y(es)?$/i.test(answer.trim()) || answer.trim() === 'نعم';
}

async function main() {
  const skip = process.argv.includes('--yes') || process.argv.includes('-y');
  db.load();

  if (!skip) {
    const agreed = await confirm(
      `هيتم مسح البيانات الحالية وإعادة بناء بيانات تجريبية.\nالداتا: ${db.DB_FILE}\nتكمل؟ (y/n) `,
    );
    if (!agreed) {
      console.log('اتلغى — مفيش حاجة اتغيرت.');
      return;
    }
  }

  db.reset();
  const stats = db.stats();
  console.log('\n  تم إعادة بناء الداتا التجريبية.');
  console.log(`  الملف: ${stats.file} (${Math.round(stats.size / 1024)} كيلوبايت)`);
  console.log(
    `  ${stats.counts.students} طالب · ${stats.counts.groups} مجموعة · ${stats.counts.lessons} حصة · ${stats.counts.exams} امتحان`,
  );
  console.log(
    `  ${stats.counts.certificates} شهادة · ${stats.counts.points} سجل نقاط · ${stats.counts.shifts} وردية · ${stats.counts.treasury} حركة خزنة\n`,
  );
  console.log(`  الدخول: admin@daftary.app / ${db.DEFAULT_PASSWORD}\n`);
  console.log('  شغّل السيرفر: node server.js\n');
}

main().catch((error) => {
  console.error(`\n  فشل إعادة البناء: ${error.message}\n`);
  process.exitCode = 1;
});
