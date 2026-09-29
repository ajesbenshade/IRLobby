import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../../../packages/shared/schema.ts', import.meta.url), 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
});
const module = { exports: {} };
new Function('exports', 'module', 'require', transpiled.outputText)(module.exports, module, require);
const { parseActivityListResponse } = module.exports;

for (const paginated of [false, true]) {
  const shape = paginated ? 'paginated' : 'array';
  const wrap = (results) => paginated ? { count: results.length, next: null, previous: null, results } : results;

  test(`${shape} gathering lists preserve unlimited, limited, and omitted capacity`, () => {
    const activities = [
      { id: 1, title: 'Unlimited', capacity: null, maxParticipants: null, max_participants: null },
      { id: 2, title: 'Limited', capacity: 10, maxParticipants: 10, max_participants: 10 },
      { id: 3, title: 'Legacy' },
    ];
    assert.deepEqual(parseActivityListResponse(wrap(activities)), activities);
  });

  test(`${shape} empty gathering lists remain valid`, () => {
    assert.deepEqual(parseActivityListResponse(wrap([])), []);
  });

  for (const field of ['capacity', 'maxParticipants', 'max_participants']) {
    test(`${shape} gathering lists still reject invalid ${field}`, () => {
      assert.throws(() => parseActivityListResponse(wrap([
        { id: 1, title: 'Invalid', [field]: 'unlimited' },
      ])));
    });
  }
}
