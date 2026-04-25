import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourcePath = path.resolve(__dirname, '../src/lib/configResolution.ts');
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

const { resolveClientConfig } = module.exports;

test('uses explicit Vite API base URL and derives WebSocket URL', () => {
  const result = resolveClientConfig({ VITE_API_BASE_URL: 'https://api.example.com/' });

  assert.equal(result.apiBaseUrl, 'https://api.example.com');
  assert.equal(result.websocketUrl, 'wss://api.example.com');
  assert.equal(result.diagnostics.apiBaseUrlSource, 'vite');
});

test('falls back to relative API routes when production API base is absent', () => {
  const result = resolveClientConfig(
    { PROD: true },
    { protocol: 'https:', host: 'app.example.com' },
  );

  assert.equal(result.apiBaseUrl, '');
  assert.equal(result.websocketUrl, 'wss://app.example.com');
  assert.equal(result.diagnostics.apiBaseUrlSource, 'relative-fallback');
  assert.equal(result.diagnostics.usingRelativeApiBaseUrl, true);
  assert.equal(result.diagnostics.isProduction, true);
});

test('uses the production API domain on the public cPanel host', () => {
  const result = resolveClientConfig(
    { PROD: true, VITE_API_BASE_URL: '' },
    { protocol: 'https:', host: 'irlobby.com' },
  );

  assert.equal(result.apiBaseUrl, 'https://api.irlobby.com');
  assert.equal(result.websocketUrl, 'wss://api.irlobby.com');
  assert.equal(result.diagnostics.apiBaseUrlSource, 'production-host');
  assert.equal(result.diagnostics.usingRelativeApiBaseUrl, false);
});

test('uses the production API domain on the www cPanel host', () => {
  const result = resolveClientConfig(
    { PROD: true },
    { protocol: 'https:', host: 'www.irlobby.com' },
  );

  assert.equal(result.apiBaseUrl, 'https://api.irlobby.com');
  assert.equal(result.websocketUrl, 'wss://api.irlobby.com');
  assert.equal(result.diagnostics.apiBaseUrlSource, 'production-host');
});

test('prefers explicit WebSocket URL over derived URL', () => {
  const result = resolveClientConfig({
    VITE_API_BASE_URL: 'http://api.example.com',
    VITE_WEBSOCKET_BASE_URL: 'wss://ws.example.com/',
  });

  assert.equal(result.websocketUrl, 'wss://ws.example.com');
  assert.equal(result.diagnostics.websocketUrlSource, 'vite');
  assert.equal(result.diagnostics.hasViteWebsocketBaseUrl, true);
});