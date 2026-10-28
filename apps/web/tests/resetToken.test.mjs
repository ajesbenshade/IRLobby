import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/resetToken.ts', import.meta.url), 'utf8');
const out = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
});
const module = { exports: {} };
new Function('exports', 'module', out.outputText)(module.exports, module);
const { extractResetToken } = module.exports;

test('bare token is trimmed', () => assert.equal(extractResetToken('  abc123 \n'), 'abc123'));
test('https link', () =>
  assert.equal(extractResetToken('https://irlobby.com/reset-password/abc-123_x'), 'abc-123_x'));
test('query link', () =>
  assert.equal(extractResetToken('https://irlobby.com/reset-password?token=abc%2B1'), 'abc+1'));
test('deep link', () =>
  assert.equal(extractResetToken('irlobby://reset-password/tok42'), 'tok42'));
test('empty', () => {
  assert.equal(extractResetToken(''), '');
  assert.equal(extractResetToken(null), '');
});
