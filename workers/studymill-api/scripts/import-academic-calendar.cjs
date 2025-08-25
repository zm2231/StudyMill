#!/usr/bin/env node
/*
  Import UGA semester schedule JSON into academic_calendar_dates.
  Usage:
    node scripts/import-academic-calendar.cjs --json "/path/to/uga_semester_schedule.json" --fall-term 202508 --spring-term 202601 > /tmp/uga_calendar.sql
    npx wrangler d1 execute studymill-db --config workers/studymill-api/wrangler.jsonc --local --file=/tmp/uga_calendar.sql
*/
const fs = require('fs');

function esc(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }

function pushHolidayRange(stmts, term, name, start, end, notes) {
  // inclusive range
  const startD = new Date(start);
  const endD = new Date(end);
  for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0,10);
    const id = cryptoRandomId();
    stmts.push(`INSERT INTO academic_calendar_dates (id, term_code, date, name, category, campus, notes) VALUES (${esc(id)}, ${esc(term)}, ${esc(dateStr)}, ${esc(name)}, 'break', NULL, ${esc(notes || '')});`);
  }
}

function cryptoRandomId(){
  // simple UUID-ish
  return 'cal_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function main() {
  const args = process.argv.slice(2);
  const jidx = args.indexOf('--json');
  const fallIdx = args.indexOf('--fall-term');
  const springIdx = args.indexOf('--spring-term');
  if (jidx === -1 || fallIdx === -1 || springIdx === -1) {
    console.error('Usage: node scripts/import-academic-calendar.cjs --json file.json --fall-term 202508 --spring-term 202601');
    process.exit(1);
  }
  const jsonPath = args[jidx + 1];
  const fallTerm = args[fallIdx + 1];
  const springTerm = args[springIdx + 1];

  const raw = fs.readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(raw);

  const stmts = [];
  stmts.push('BEGIN;');

  // Fall 2025
  if (data.fall_2025) {
    const f = data.fall_2025;
    // Important single dates
    if (f.semester_start) stmts.push(`INSERT INTO academic_calendar_dates (id, term_code, date, name, category) VALUES (${esc(cryptoRandomId())}, ${esc(fallTerm)}, ${esc(f.semester_start)}, 'Semester Start', 'event');`);
    if (f.semester_end) stmts.push(`INSERT INTO academic_calendar_dates (id, term_code, date, name, category) VALUES (${esc(cryptoRandomId())}, ${esc(fallTerm)}, ${esc(f.semester_end)}, 'Semester End', 'event');`);
    if (f.finals_start) stmts.push(`INSERT INTO academic_calendar_dates (id, term_code, date, name, category) VALUES (${esc(cryptoRandomId())}, ${esc(fallTerm)}, ${esc(f.finals_start)}, 'Finals Start', 'deadline');`);
    if (f.finals_end) stmts.push(`INSERT INTO academic_calendar_dates (id, term_code, date, name, category) VALUES (${esc(cryptoRandomId())}, ${esc(fallTerm)}, ${esc(f.finals_end)}, 'Finals End', 'deadline');`);
  }

  // Spring 2026
  if (data.spring_2026) {
    const s = data.spring_2026;
    if (s.semester_start) stmts.push(`INSERT INTO academic_calendar_dates (id, term_code, date, name, category) VALUES (${esc(cryptoRandomId())}, ${esc(springTerm)}, ${esc(s.semester_start)}, 'Semester Start', 'event');`);
    if (s.semester_end) stmts.push(`INSERT INTO academic_calendar_dates (id, term_code, date, name, category) VALUES (${esc(cryptoRandomId())}, ${esc(springTerm)}, ${esc(s.semester_end)}, 'Semester End', 'event');`);
    if (s.finals_start) stmts.push(`INSERT INTO academic_calendar_dates (id, term_code, date, name, category) VALUES (${esc(cryptoRandomId())}, ${esc(springTerm)}, ${esc(s.finals_start)}, 'Finals Start', 'deadline');`);
    if (s.finals_end) stmts.push(`INSERT INTO academic_calendar_dates (id, term_code, date, name, category) VALUES (${esc(cryptoRandomId())}, ${esc(springTerm)}, ${esc(s.finals_end)}, 'Finals End', 'deadline');`);
  }

  // Holidays/breaks
  if (data.holidays_and_breaks) {
    // Fall
    for (const h of data.holidays_and_breaks.fall_2025 || []) {
      if (h.date) {
        stmts.push(`INSERT INTO academic_calendar_dates (id, term_code, date, name, category, notes) VALUES (${esc(cryptoRandomId())}, ${esc(fallTerm)}, ${esc(h.date)}, ${esc(h.name)}, ${esc(h.type || 'holiday')}, ${esc(h.notes || '')});`);
      } else if (h.start_date && h.end_date) {
        pushHolidayRange(stmts, fallTerm, h.name, h.start_date, h.end_date, h.notes);
      }
    }
    // Spring
    for (const h of data.holidays_and_breaks.spring_2026 || []) {
      if (h.date) {
        stmts.push(`INSERT INTO academic_calendar_dates (id, term_code, date, name, category, notes) VALUES (${esc(cryptoRandomId())}, ${esc(springTerm)}, ${esc(h.date)}, ${esc(h.name)}, ${esc(h.type || 'holiday')}, ${esc(h.notes || '')});`);
      } else if (h.start_date && h.end_date) {
        pushHolidayRange(stmts, springTerm, h.name, h.start_date, h.end_date, h.notes);
      }
    }
  }

  stmts.push('COMMIT;');
  process.stdout.write(stmts.join('\n'));
}

main();
