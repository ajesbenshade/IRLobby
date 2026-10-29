import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const load = (relativePath) => {
  const sourcePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), relativePath);
  const transpiled = ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
    },
  });
  const module = { exports: {} };
  const evaluator = new Function('exports', 'module', transpiled.outputText);
  evaluator(module.exports, module);
  return module.exports;
};

const accountAge = load('../src/lib/accountAge.ts');
const foyer = load('../src/lib/foyer.ts');
const now = new Date(2026, 9, 2, 12);

test('signup birth dates under 18 are rejected and exactly 18 today is allowed', () => {
  assert.equal(accountAge.accountBirthDateError('', now), 'Choose your birth date to continue.');
  assert.equal(
    accountAge.accountBirthDateError('2013-10-02', now),
    'Accounts are for voting members 18 and older.',
  );
  assert.equal(
    accountAge.accountBirthDateError('2008-10-03', now),
    'Accounts are for voting members 18 and older.',
  );
  assert.equal(accountAge.accountBirthDateError('2008-10-02', now), null);
  assert.equal(accountAge.accountBirthDateError('1988-03-04', now), null);
  assert.equal(
    accountAge.accountBirthDateError('2026-10-03', now),
    'Accounts are for voting members 18 and older.',
  );
});

test('household children stay under 18', () => {
  assert.equal(accountAge.householdChildBirthDateError('2013-10-02', now), null);
  assert.equal(accountAge.householdChildBirthDateError('2008-10-03', now), null);
  assert.equal(
    accountAge.householdChildBirthDateError('2008-10-02', now),
    'Only children under 18 can be added to a household.',
  );
  assert.equal(accountAge.householdChildBirthDateError('not-a-date', now), null);
});

test('voting-member helper and checkbox match the tip', () => {
  assert.equal(
    accountAge.VOTING_MEMBER_CHECKBOX,
    'I am a voting member of Franconia Mennonite Church.',
  );
  assert.equal(
    accountAge.BIRTH_DATE_HELPER,
    'The Foyer is for Franconia voting members. Children under 18 are added under a parent’s My family.',
  );
  assert.equal(
    accountAge.CHILDREN_RSVP_NOTE,
    "Children under 18 are RSVP names only — they don't have accounts.",
  );
});

test('a new Google or Apple account 400 is the voting-member gate', () => {
  assert.equal(
    accountAge.isVotingGateBody({
      date_of_birth: ['Accounts are for voting members 18 and older.'],
      voting_member_attested: ['You must confirm you are a voting member of Franconia Mennonite Church.'],
    }),
    true,
  );
  assert.equal(accountAge.isVotingGateError({ body: { detail: 'Invalid token.' } }), false);
  assert.equal(accountAge.isVotingGateError(new Error('no')), false);
});

test("who's coming drops the teen-account footnote", () => {
  assert.equal(
    foyer.WHOS_COMING_NOTE,
    'Only children in your household are listed. They don’t have their own accounts.',
  );
  assert.equal(
    foyer.whosComingNote(
      'Only children in your household are listed. Teens with their own account RSVP for themselves.',
    ),
    foyer.WHOS_COMING_NOTE,
  );
  assert.equal(foyer.whosComingNote(''), foyer.WHOS_COMING_NOTE);
  assert.equal(foyer.whosComingNote('A host note'), 'A host note');
});
