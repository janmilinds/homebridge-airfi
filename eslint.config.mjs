// @ts-check

import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  eslintPluginPrettier,
  eslintConfigPrettier,
  {
    rules: {
      'brace-style': ['warn'],
      'comma-dangle': [
        'error',
        {
          arrays: 'always-multiline',
          objects: 'always-multiline',
          imports: 'always-multiline',
          exports: 'always-multiline',
          functions: 'never',
        },
      ],
      curly: ['warn', 'all'],
      'dot-notation': ['off'],
      eqeqeq: ['warn'],
      'lines-between-class-members': [
        'warn',
        'always',
        { exceptAfterSingleLine: true },
      ],
      'max-len': ['warn', { code: 80 }],
      'no-console': ['error'], // use the provided Homebridge log method instead
      'no-multi-spaces': ['warn', { ignoreEOLComments: true }],
      'no-trailing-spaces': ['warn'],
      'prefer-arrow-callback': ['warn'],
      quotes: ['error', 'single'],
    },
  }
);
