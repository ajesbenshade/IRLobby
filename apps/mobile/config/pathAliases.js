const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(projectRoot, '../..');

const projectAliases = {
  '@components': './src/components',
  '@navigation': './src/navigation',
  '@screens': './src/screens',
  '@hooks': './src/hooks',
  '@types': './src/types',
  '@services': './src/services',
  '@providers': './src/providers',
  '@constants': './src/constants',
  '@theme': './src/theme',
  '@utils': './src/utils',
};

const moduleResolverAliases = {
  ...projectAliases,
  '@shared': '../../packages/shared',
};

const metroAliases = {
  '@shared': path.resolve(workspaceRoot, 'packages', 'shared'),
};

module.exports = {
  moduleResolverAliases,
  metroAliases,
};
