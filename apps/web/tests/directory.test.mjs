import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadDirectory = () => {
  const source = readFileSync(
    path.resolve(__dirname, '../../../packages/shared/directory.ts'),
    'utf8',
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  const module = { exports: {} };
  new Function('exports', 'module', outputText)(module.exports, module);
  return module.exports;
};

const directory = loadDirectory();
const nav = readFileSync(path.resolve(__dirname, '../src/components/BottomNavigation.tsx'), 'utf8');
const app = readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf8');
const profile = readFileSync(path.resolve(__dirname, '../src/pages/profile.tsx'), 'utf8');

test('directory rows drop the year and do not list an incomplete child', () => {
  const page = directory.normalizeDirectoryPage({
    count: 1,
    results: [
      {
        id: 1,
        first_name: 'Maria',
        last_initial: 'S',
        avatar_url: '',
        household_children: [
          { id: 9, first_name: 'Noah', birth_month: 3, birth_day: 4, birth_year: 2016 },
        ],
      },
    ],
  });
  assert.equal(page.results[0].householdChildren[0].firstName, 'Noah');
  assert.equal(directory.directoryPayloadLeaksPrivateChildData(page), false);
  assert.equal(JSON.stringify(page).includes('2016'), false);
  assert.equal(directory.directoryDisplayName(page.results[0]), 'Maria S.');
});

test('Directory is a profile route, not a bottom tab', () => {
  assert.equal(nav.includes("label: 'Directory'"), false);
  assert.equal(nav.includes("id: 'directory'"), false);
  assert.match(nav, /\/app\/directory/);
  assert.match(app, /path="directory"/);
  assert.match(profile, /to="\/app\/directory"/);
  assert.match(profile, /People in our church/);
  assert.match(nav, /label: 'Voting'/);
});
