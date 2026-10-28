import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const load = (rel) => {
  const source = readFileSync(path.resolve(__dirname, rel), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
    },
  });
  const module = { exports: {} };
  const localRequire = (id) => {
    if (id.includes('paginated')) {
      return load('../src/lib/paginated.ts');
    }
    return require(id);
  };
  new Function('exports', 'module', 'require', outputText)(module.exports, module, localRequire);
  return module.exports;
};

const { buildNotificationItems } = load('../src/lib/notificationsInbox.ts');

const emptyPage = { count: 0, next: null, previous: null, results: [] };

test('paginated empty inbox does not throw and stays empty', () => {
  assert.deepEqual(buildNotificationItems(emptyPage, emptyPage), []);
});

test('paginated matches and conversations become an inbox', () => {
  const items = buildNotificationItems(
    {
      count: 1,
      results: [{ id: 7, activity: "Men's Breakfast", created_at: '2026-10-20T12:00:00Z' }],
    },
    {
      count: 1,
      results: [
        {
          id: 3,
          match: 'Breakfast chat',
          matchId: 9,
          messages: [
            {
              id: 1,
              message: 'See you there',
              createdAt: '2026-10-21T15:00:00Z',
              user: { firstName: 'Ada' },
            },
          ],
        },
      ],
    },
  );

  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'New message in Breakfast chat');
  assert.equal(items[0].body, 'Ada: See you there');
  assert.equal(items[0].href, '/app/gatherings/9/chat');
  assert.equal(items[1].title, "You're confirmed");
  assert.equal(items[1].body, "You're going to Men's Breakfast.");
  assert.equal(items[1].href, '/app/gatherings');
});

test('missing messages and invalid dates do not throw', () => {
  const items = buildNotificationItems(
    { results: [{ id: 1, created_at: 'not-a-date' }] },
    {
      results: [
        { id: 2, match: 'Quiet', messages: null },
        { id: 4, match: 'Also quiet' },
        { id: 5, messages: { results: [] } },
      ],
    },
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].body, "You're going.");
  assert.equal(items[0].createdAt, 'not-a-date');
});

test('discover overlays use the phone sheet, not a centered dialog', () => {
  const sheet = readFileSync(
    path.resolve(__dirname, '../src/components/DiscoverSheet.tsx'),
    'utf8',
  );
  const filter = readFileSync(path.resolve(__dirname, '../src/components/FilterModal.tsx'), 'utf8');
  const inbox = readFileSync(
    path.resolve(__dirname, '../src/components/NotificationCenter.tsx'),
    'utf8',
  );

  assert.match(sheet, /inset-x-0 bottom-0/);
  assert.match(sheet, /w-full/);
  assert.match(sheet, /rounded-t-\[22px\]/);
  assert.match(sheet, /env\(safe-area-inset-bottom\)/);
  assert.match(sheet, /rgba\(20, 14, 16, 0\.42\)/);
  assert.match(sheet, /md:-translate-x-1\/2/);
  assert.doesNotMatch(sheet, /translate-x-\[-50%\]/);
  assert.doesNotMatch(filter, /DialogContent/);
  assert.doesNotMatch(inbox, /DialogContent/);
  assert.match(filter, /DiscoverSheet/);
  assert.match(inbox, /buildNotificationItems/);
});
