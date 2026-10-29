import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourcePath = path.resolve(__dirname, '../src/lib/activityFilters.ts');
const source = readFileSync(sourcePath, 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2019,
    esModuleInterop: true,
  },
});

const module = { exports: {} };
const exports = module.exports;
const evaluator = new Function('exports', 'module', transpiled.outputText);
evaluator(exports, module);

const { buildActivitySearchParams } = module.exports;

const DROPPED = [
  'price_min',
  'price_max',
  'skill_level',
  'tags',
  'age_restriction',
  'category',
  'audience',
  'ages',
];

test('returns empty string when no filters provided', () => {
  assert.equal(buildActivitySearchParams({}), '');
});

test('sends radius and a trimmed location', () => {
  const params = buildActivitySearchParams({ location: '  Franconia  ', maxDistance: [25] });
  const entries = new URLSearchParams(params);
  assert.equal(entries.get('location'), 'Franconia');
  assert.equal(entries.get('radius'), '25');
});

test('sends date_from and date_to when both dates are set', () => {
  const params = buildActivitySearchParams({
    location: 'Austin',
    maxDistance: [5],
    dateFrom: new Date('2030-05-01T00:00:00.000Z'),
    dateTo: new Date('2030-05-02T23:59:59.000Z'),
    priceRange: [0, 50],
    skillLevel: 'Beginner',
    tags: ['outdoors', 'social'],
    ageRestriction: '21+',
    category: 'Nightlife',
    audience: 'men',
  });
  const entries = new URLSearchParams(params);
  assert.equal(entries.get('location'), 'Austin');
  assert.equal(entries.get('radius'), '5');
  assert.equal(entries.get('date_from'), '2030-05-01T00:00:00.000Z');
  assert.equal(entries.get('date_to'), '2030-05-02T23:59:59.000Z');
  for (const key of DROPPED) {
    assert.equal(entries.get(key), null, key);
  }
  assert.equal([...entries.keys()].sort().join(','), 'date_from,date_to,location,radius');
});

test('omits a blank location and does not invent a radius', () => {
  const params = buildActivitySearchParams({ location: '   ', maxDistance: [] });
  assert.equal(params, '');
});
