import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const load = (rel) => {
  const source = readFileSync(path.resolve(__dirname, rel), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true },
  });
  const module = { exports: {} };
  new Function('exports', 'module', outputText)(module.exports, module);
  return module.exports;
};

const {
  churchHasWebsiteCalendar,
  listOnChurchCalendarValue,
  isChurchCalendarUnavailable,
  CHURCH_CALENDAR_UNAVAILABLE_MESSAGE,
} = load('../src/lib/churchCalendar.ts');
const hostPage = readFileSync(path.resolve(__dirname, '../src/pages/foyer-host.tsx'), 'utf8');

test('churchHasWebsiteCalendar is true only for has_website_calendar === true', () => {
  assert.equal(churchHasWebsiteCalendar({ has_website_calendar: true }), true);
  assert.equal(churchHasWebsiteCalendar({ has_website_calendar: false }), false);
  assert.equal(churchHasWebsiteCalendar({ has_website_calendar: null }), false);
  assert.equal(churchHasWebsiteCalendar({}), false);
  assert.equal(churchHasWebsiteCalendar(null), false);
  assert.equal(churchHasWebsiteCalendar(undefined), false);
});

test('list_on_church_calendar is never true without a website calendar', () => {
  assert.equal(listOnChurchCalendarValue(true, true), true);
  assert.equal(listOnChurchCalendarValue(true, false), false);
  assert.equal(listOnChurchCalendarValue(false, true), false);
  assert.equal(listOnChurchCalendarValue(false, false), false);
});

test('maps only a 400 church_calendar_unavailable', () => {
  const err = (status, body) => Object.assign(new Error(`${status}: x`), { status, body });
  assert.equal(isChurchCalendarUnavailable(err(400, { code: 'church_calendar_unavailable', detail: 'x' })), true);
  assert.equal(isChurchCalendarUnavailable(err(500, { code: 'church_calendar_unavailable' })), false);
  assert.equal(isChurchCalendarUnavailable(err(400, { code: 'other' })), false);
  assert.equal(isChurchCalendarUnavailable(err(400, 'text body')), false);
  assert.equal(isChurchCalendarUnavailable(new Error('400: x')), false);
  assert.equal(isChurchCalendarUnavailable(null), false);
});

test('message is Design copy with curly quotes', () => {
  assert.equal(
    CHURCH_CALENDAR_UNAVAILABLE_MESSAGE,
    "Your church's website calendar isn't connected to The Foyer yet. Turn off \u201cPost to the church website calendar\u201d and try again.",
  );
});

test('host form gates the checkbox, sends the gated value and keeps the form open on the 400', () => {
  assert.match(hostPage, /const churchHasCalendar = churchHasWebsiteCalendar\(user\?\.church\);/);
  assert.match(hostPage, /\{churchHasCalendar \? \(\s*<>\s*<label[^]*?Post to the church website calendar[^]*?CALENDAR_ADDRESS_WARNING[^]*?<\/>\s*\) : null\}/);
  assert.match(hostPage, /list_on_church_calendar: listOnChurchCalendarValue\(churchHasCalendar, calendar\)/);
  assert.match(
    hostPage,
    /if \(isChurchCalendarUnavailable\(submitError\)\) \{\s*\/\/[^\n]*\n\s*setError\(CHURCH_CALENDAR_UNAVAILABLE_MESSAGE\);\s*return;/,
  );
});

test('apiRequest errors carry status and body', () => {
  const client = readFileSync(path.resolve(__dirname, '../src/lib/queryClient.ts'), 'utf8');
  assert.match(client, /throw Object\.assign\(new Error\(`\$\{res\.status\}: \$\{extractApiErrorMessage\(body, res\.statusText\)\}`\), \{\s*status: res\.status,\s*body,\s*\}\);/);
});
