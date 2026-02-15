import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = process.cwd();

const scanRoots = ['client/src', 'irlobby_mobile/src'];
const fileExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
const endpointRegex = /["'`]\/(api\/[a-zA-Z0-9_\-/.?=&]+)["'`]/g;
const djangoPathRegex = /path\(\s*['"]([^'"]*)['"]\s*,\s*([^\n]+?)\)/g;
const djangoIncludeRegex = /include\(\s*['"]([^'"]+)['"]/;

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeApiPath(rawPath) {
  if (!rawPath) {
    return '/';
  }
  const withLeadingSlash = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  return withLeadingSlash.replace(/\/{2,}/g, '/');
}

function djangoPathToRegex(pathTemplate) {
  let pattern = normalizeApiPath(pathTemplate)
    .replace(/\//g, '\\/')
    .replace(/<int:[^>]+>/g, '\\d+')
    .replace(/<slug:[^>]+>/g, '[a-zA-Z0-9_-]+')
    .replace(/<str:[^>]+>/g, '[^\\/]+')
    .replace(/<uuid:[^>]+>/g, '[a-fA-F0-9-]+')
    .replace(/<path:[^>]+>/g, '.+')
    .replace(/<[^>]+>/g, '[^\\/]+');

  if (pattern.endsWith('\\/')) {
    pattern = pattern.slice(0, -2);
  }

  return new RegExp(`^${pattern}\\/?(?:\\?.*)?$`);
}

function collectDjangoPaths(filePath) {
  const content = readText(filePath);
  if (!content) {
    return [];
  }

  const results = [];
  for (const match of content.matchAll(djangoPathRegex)) {
    const route = match[1];
    const target = match[2];
    const includeMatch = match[0].match(djangoIncludeRegex);

    results.push({
      route,
      includeModule: includeMatch ? includeMatch[1] : null,
    });
  }

  return results;
}

function moduleToUrlsFile(moduleName) {
  const modulePath = moduleName.replace(/\./g, '/');
  const withUrls = path.join(workspaceRoot, 'irlobby_backend', `${modulePath}.py`);
  if (fs.existsSync(withUrls)) {
    return withUrls;
  }

  const asPackageUrls = path.join(workspaceRoot, 'irlobby_backend', modulePath, 'urls.py');
  if (fs.existsSync(asPackageUrls)) {
    return asPackageUrls;
  }

  return null;
}

function joinRoute(prefix, route) {
  const normalizedPrefix = prefix.replace(/^\/+|\/+$/g, '');
  const normalizedRoute = route.replace(/^\/+|\/+$/g, '');

  if (!normalizedPrefix && !normalizedRoute) {
    return '/';
  }

  if (!normalizedPrefix) {
    return `/${normalizedRoute}/`;
  }

  if (!normalizedRoute) {
    return `/${normalizedPrefix}/`;
  }

  return `/${normalizedPrefix}/${normalizedRoute}/`;
}

function buildAllowedPatterns() {
  const rootUrls = path.join(workspaceRoot, 'irlobby_backend', 'irlobby_backend', 'urls.py');
  const rootEntries = collectDjangoPaths(rootUrls);
  const routes = new Set();

  for (const entry of rootEntries) {
    const rootRoute = entry.route;
    if (!rootRoute.startsWith('api/')) {
      continue;
    }

    if (!entry.includeModule) {
      routes.add(joinRoute('', rootRoute));
      continue;
    }

    const includeFile = moduleToUrlsFile(entry.includeModule);
    if (!includeFile) {
      continue;
    }

    const includeEntries = collectDjangoPaths(includeFile);
    for (const includeEntry of includeEntries) {
      routes.add(joinRoute('', joinRoute(rootRoute, includeEntry.route)));
    }
  }

  return Array.from(routes)
    .filter((route) => route.startsWith('/api/'))
    .map((route) => djangoPathToRegex(route));
}

const allowedPatterns = buildAllowedPatterns();

function walk(directory) {
  const absolute = path.join(workspaceRoot, directory);
  if (!fs.existsSync(absolute)) {
    return [];
  }

  const items = fs.readdirSync(absolute, { withFileTypes: true });
  const files = [];

  for (const item of items) {
    const fullPath = path.join(absolute, item.name);
    if (item.isDirectory()) {
      files.push(...walk(path.join(directory, item.name)));
      continue;
    }

    if (fileExtensions.has(path.extname(item.name))) {
      files.push(path.join(directory, item.name));
    }
  }

  return files;
}

function getLineNumber(content, index) {
  return content.slice(0, index).split('\n').length;
}

const failures = [];

for (const root of scanRoots) {
  const files = walk(root);
  for (const relativeFile of files) {
    const absoluteFile = path.join(workspaceRoot, relativeFile);
    const content = fs.readFileSync(absoluteFile, 'utf8');

    for (const match of content.matchAll(endpointRegex)) {
      const endpoint = `/${match[1]}`;
      const normalized = endpoint.replace(/\/$/, '');
      const allowed = allowedPatterns.some((pattern) => pattern.test(normalized) || pattern.test(endpoint));

      if (!allowed) {
        failures.push({
          file: relativeFile,
          line: getLineNumber(content, match.index ?? 0),
          endpoint,
        });
      }
    }
  }
}

if (failures.length > 0) {
  console.error('API contract check failed. Unsupported endpoints found:');
  for (const failure of failures) {
    console.error(`- ${failure.file}:${failure.line} -> ${failure.endpoint}`);
  }
  process.exit(1);
}

console.log('API contract check passed.');
