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
          alias: {
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
          },
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
