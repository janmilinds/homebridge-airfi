// @ts-check

import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';
import { defineConfig } from 'eslint/config';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['dist/**'],
  },
  {
    rules: {
      'brace-style': ['error'],
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
      curly: ['error', 'all'],
      'dot-notation': 'error',
      eqeqeq: ['error', 'smart'],
      indent: ['error', 2, { SwitchCase: 0 }],
      'linebreak-style': ['error', 'unix'],
      'lines-between-class-members': [
        'warn',
        'always',
        { exceptAfterSingleLine: true },
      ],
      'max-len': ['warn', { code: 80 }],
      'no-console': ['error'], // use the provided Homebridge log method instead
      'no-multi-spaces': ['warn', { ignoreEOLComments: true }],
      'no-trailing-spaces': ['warn'],
      'no-use-before-define': 'off',
      'object-curly-spacing': ['error', 'always'],
      'prefer-arrow-callback': ['warn'],
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
      '@typescript-eslint/no-use-before-define': [
        'error',
        { classes: false, enums: false },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { caughtErrors: 'none' }],
    },
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  eslintPluginPrettier,
  eslintConfigPrettier
);
