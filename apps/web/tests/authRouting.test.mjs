import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourcePath = path.resolve(__dirname, '../src/lib/authRouting.ts');
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

const { buildLoginRedirect, getAuthRedirect, getSafePostAuthRedirect } = module.exports;

test('does not redirect while auth state is loading', () => {
  assert.equal(
    getAuthRedirect('protected', {
      isAuthenticated: false,
      isLoading: true,
      needsOnboarding: false,
    }),
    null,
  );
});

test('protects app routes from unauthenticated users', () => {
  assert.equal(
    getAuthRedirect('protected', {
      isAuthenticated: false,
      isLoading: false,
      needsOnboarding: false,
    }),
    '/',
  );
});

test('sends authenticated users who need onboarding to onboarding', () => {
  const state = {
    isAuthenticated: true,
    isLoading: false,
    needsOnboarding: true,
  };

  assert.equal(getAuthRedirect('protected', state), '/onboarding');
  assert.equal(getAuthRedirect('public-home', state), '/onboarding');
  assert.equal(getAuthRedirect('onboarding', state), null);
});

test('keeps fully onboarded users in the app', () => {
  const state = {
    isAuthenticated: true,
    isLoading: false,
    needsOnboarding: false,
  };

  assert.equal(getAuthRedirect('protected', state), null);
  assert.equal(getAuthRedirect('public-home', state), '/app');
  assert.equal(getAuthRedirect('onboarding', state), '/app');
});

test('builds a login redirect that preserves protected app links', () => {
  assert.equal(
    buildLoginRedirect('/app/moderation?userId=42&name=IRLobby%20Member'),
    '/?redirect=%2Fapp%2Fmoderation%3FuserId%3D42%26name%3DIRLobby%2520Member#auth',
  );
});

test('allows safe post-auth app redirects', () => {
  assert.equal(
    getSafePostAuthRedirect('/app/moderation?userId=42#report'),
    '/app/moderation?userId=42#report',
  );
});

test('rejects unsafe or non-app post-auth redirects', () => {
  assert.equal(getSafePostAuthRedirect('https://evil.example/app/moderation'), '/app');
  assert.equal(getSafePostAuthRedirect('//evil.example/app/moderation'), '/app');
  assert.equal(getSafePostAuthRedirect('/support'), '/app');
});
