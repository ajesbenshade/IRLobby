const { moduleResolverAliases } = require('./config/pathAliases');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo', 'nativewind/babel'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          extensions: ['.tsx', '.ts', '.js', '.json'],
          alias: moduleResolverAliases,
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
