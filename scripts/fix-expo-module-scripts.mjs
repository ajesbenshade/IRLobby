import { access, copyFile } from 'node:fs/promises';
import path from 'node:path';

const workspaceRoot = process.cwd();
const candidateDirs = [
  path.join(workspaceRoot, 'node_modules', 'expo-module-scripts'),
  path.join(workspaceRoot, 'apps', 'mobile', 'node_modules', 'expo-module-scripts'),
];

async function exists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureTsconfigBaseShim(packageDir) {
  const sourcePath = path.join(packageDir, 'tsconfig.base.json');
  const targetPath = path.join(packageDir, 'tsconfig.base');

  if (!(await exists(sourcePath)) || (await exists(targetPath))) {
    return false;
  }

  await copyFile(sourcePath, targetPath);
  return true;
}

let fixedCount = 0;

for (const candidateDir of candidateDirs) {
  if (await exists(candidateDir)) {
    if (await ensureTsconfigBaseShim(candidateDir)) {
      fixedCount += 1;
    }
  }
}

if (fixedCount > 0) {
  console.log(`Created ${fixedCount} expo-module-scripts tsconfig shim${fixedCount === 1 ? '' : 's'}.`);
}
