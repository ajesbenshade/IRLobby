import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = process.cwd();

const scanRoots = ['client/src', 'irlobby_mobile/src', 'shared'];
const fileExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
const endpointRegex = /(["'`])((?:https?:\/\/[^"'`]+)?\/api\/[^"'`]*)\1/g;
const djangoPathRegex = /path\(\s*['"]([^'"]*)['"]\s*,\s*([\s\S]*?)\)\s*,?/g;
const djangoIncludeRegex = /include\(\s*(?:\(\s*)?['"]([^'"]+)['"]/;

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function normalizeApiPath(rawPath) {
  if (!rawPath) {
    return '/';
  }
  const withLeadingSlash = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  return withLeadingSlash.replace(/\/{2,}/g, '/');
}

function toApiRelativePath(rawEndpoint) {
  if (!rawEndpoint) {
    return null;
  }

  let endpoint = rawEndpoint;
  if (/^https?:\/\//i.test(endpoint)) {
    try {
      const parsed = new URL(endpoint);
      endpoint = `${parsed.pathname}${parsed.search ?? ''}`;
    } catch {
      return null;
    }
  }

  if (!endpoint.startsWith('/api/')) {
    return null;
  }

  return normalizeApiPath(endpoint);
}

function buildEndpointCandidates(rawEndpoint) {
  const relative = toApiRelativePath(rawEndpoint);
  if (!relative) {
    return [];
  }

  const variants = [relative];
  if (relative.includes('${')) {
    variants.push(relative.replace(/\$\{[^}]+\}/g, '1'));
    variants.push(relative.replace(/\$\{[^}]+\}/g, 'sample'));
    variants.push(relative.replace(/\$\{[^}]+\}/g, '00000000-0000-0000-0000-000000000000'));
  }

  const deduped = new Set();
  for (const variant of variants) {
    const normalized = normalizeApiPath(variant);
    deduped.add(normalized);
    deduped.add(normalized.replace(/\/$/, ''));
  }

  return Array.from(deduped).filter(Boolean);
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

function collectApiRoutes(urlsFile, prefix = '', visited = new Set()) {
  if (!urlsFile || visited.has(urlsFile) || !fs.existsSync(urlsFile)) {
    return [];
  }

  visited.add(urlsFile);
  const entries = collectDjangoPaths(urlsFile);
  const routes = [];

  for (const entry of entries) {
    const fullRoute = joinRoute(prefix, entry.route);

    if (entry.includeModule) {
      const includeFile = moduleToUrlsFile(entry.includeModule);
      routes.push(...collectApiRoutes(includeFile, fullRoute, visited));
      continue;
    }

    routes.push(fullRoute);
  }

  return routes;
}

function buildAllowedPatterns() {
  const rootUrls = path.join(workspaceRoot, 'irlobby_backend', 'irlobby_backend', 'urls.py');
  const routes = new Set(collectApiRoutes(rootUrls));

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
      const endpoint = match[2];
      const candidates = buildEndpointCandidates(endpoint);
      if (candidates.length === 0) {
        continue;
      }
      const allowed = candidates.some((candidate) =>
        allowedPatterns.some((pattern) => pattern.test(candidate))
      );

      if (!allowed) {
        failures.push({
          file: relativeFile,
          line: getLineNumber(content, match.index ?? 0),
          endpoint: candidates[0] ?? endpoint,
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
