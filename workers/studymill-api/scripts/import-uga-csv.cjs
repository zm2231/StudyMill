#!/usr/bin/env node
/*
  Import UGA master CSV into D1 uga_courses_master.
  - Preserves raw values; no normalization beyond splitting TIME and DAYS.
  - Usage:
    node scripts/import-uga-csv.cjs --csv "/path/to/UGA Fall 2025 Course List.csv" --term-code 202508 > /tmp/uga_fall_2025.sql
    npx wrangler d1 execute studymill-db --config workers/studymill-api/wrangler.jsonc --local --file=/tmp/uga_fall_2025.sql

  Repeat for Spring with correct term_code (e.g., 202501 or 202601).
*/
const fs = require('fs');
const { parse } = require('csv-parse/sync');

function toHHMM(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const s = hhmm.trim();
  if (!/^\d{4}$/.test(s)) return null;
  return s.slice(0,2) + ':' + s.slice(2);
}

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

function main() {
  const args = process.argv.slice(2);
  const csvPathIdx = args.indexOf('--csv');
  const termIdx = args.indexOf('--term-code');
  if (csvPathIdx === -1 || termIdx === -1) {
    console.error('Usage: node scripts/import-uga-csv.cjs --csv "/path/file.csv" --term-code 202508');
    process.exit(1);
  }
  const csvPath = args[csvPathIdx + 1];
  const termCode = args[termIdx + 1];

  const raw = fs.readFileSync(csvPath, 'utf8');
  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true
  });

  const stmts = [];
  stmts.push('BEGIN;');

  for (const row of records) {
    const courseNumber = (row['COURSE NUMBER'] ?? '').toString().trim();
    const courseName = (row['COURSE NAME'] ?? '').toString().trim();
    const crn = (row['CRN'] ?? '').toString().trim();
    const instructor = (row['INSTRUCTOR'] ?? '').toString().trim();
    const days = (row['DAYS'] ?? '').toString().trim();
    const time = (row['TIME'] ?? '').toString().trim();
    const building = (row['BUILDING'] ?? '').toString().trim();
    const room = (row['ROOM'] ?? '').toString().trim();

    // Derive subject & catalog from COURSE NUMBER (letters + digits)
    let subject = '';
    let catalog = '';
    const m = courseNumber.match(/^([A-Z&]+)\s*(\d+[A-Z]?)$/i) || courseNumber.match(/^([A-Z&]+)(\d+[A-Z]?)$/i);
    if (m) {
      subject = m[1].toUpperCase();
      catalog = m[2].toUpperCase();
    } else {
      const idx = courseNumber.search(/\d/);
      if (idx > 0) {
        subject = courseNumber.slice(0, idx).toUpperCase();
        catalog = courseNumber.slice(idx).toUpperCase();
      } else {
        subject = courseNumber.toUpperCase();
        catalog = '';
      }
    }

    // TIME split: 1020-1110 -> HH:MM
    let start = null, end = null;
    if (time && time.includes('-')) {
      const [a, b] = time.split('-');
      start = toHHMM((a || '').padStart(4, '0'));
      end = toHHMM((b || '').padStart(4, '0'));
    }

    // Location string (always combine building + room, even if room is 'Not set')
    let location = '';
    if (building) {
      location = building + (room ? ' ' + room : '');
    } else if (room) {
      location = room; // rare fallback
    } else {
      location = 'Not set';
    }

    const sql = `INSERT INTO uga_courses_master (
      term_code, crn, subject, catalog_number, section, course_title, instructor, credits, days, start_time, end_time, location, campus, notes
    ) VALUES (
      ${escapeSql(termCode)}, ${escapeSql(crn)}, ${escapeSql(subject)}, ${escapeSql(catalog)}, NULL, ${escapeSql(courseName)}, ${escapeSql(instructor)}, NULL, ${escapeSql(days)}, ${start ? escapeSql(start) : 'NULL'}, ${end ? escapeSql(end) : 'NULL'}, ${location ? escapeSql(location) : 'NULL'}, NULL, NULL
    );`;
    stmts.push(sql);
  }

  stmts.push('COMMIT;');
  process.stdout.write(stmts.join('\n'));
}

main();
