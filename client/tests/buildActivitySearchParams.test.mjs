
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

test('returns empty string when no filters provided', () => {
  assert.equal(buildActivitySearchParams({}), '');
});

test('includes radius and category when provided', () => {
  const params = buildActivitySearchParams({ category: 'Sports', maxDistance: [5] });
  const entries = new URLSearchParams(params);
  assert.equal(entries.get('category'), 'Sports');
  assert.equal(entries.get('radius'), '5');
});

test('serializes complex filters', () => {
  const params = buildActivitySearchParams({
    tags: ['outdoors', 'social'],
    priceRange: [0, 50],
    location: 'Austin',
  });
  const entries = new URLSearchParams(params);
  assert.equal(entries.get('tags'), 'outdoors,social');
  assert.equal(entries.get('price_min'), '0');
  assert.equal(entries.get('price_max'), '50');
  assert.equal(entries.get('location'), 'Austin');
});
