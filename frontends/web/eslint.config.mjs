import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import stylistic from '@stylistic/eslint-plugin';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default tseslint.config(
  {
    'ignores': ['./src/utils/qwebchannel.js']
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    'plugins': {
      react: pluginReact,
      'react-hooks': pluginReactHooks,
      '@stylistic': stylistic,
    },
    'settings': {
      'react': {
        'version': 'detect'
      }
    },
    'rules': {
      'no-param-reassign': ['error'],
      'brace-style': ['error', '1tbs'],
      'comma-spacing': ['error', { 'before': false, 'after': true }],
      'curly': 'error',
      'jsx-a11y/anchor-is-valid': 0,
      'jsx-a11y/alt-text' : 0,
      'jsx-quotes': ['error', 'prefer-double'],
      'keyword-spacing': 'error',
      'eqeqeq': 'error',
      'no-multi-spaces': 'error',
      'no-trailing-spaces': 'error',
      'object-curly-spacing': ['error', 'always'],
      'quotes': ['error', 'single'],
      'space-before-blocks': ['error', 'always'],
      'space-in-parens': ['error', 'never'],
      'no-extra-semi': 'error',
      'arrow-spacing': 'error',
      'space-infix-ops': 'error',
      'react/no-unused-prop-types': 'error',
      'react/jsx-equals-spacing': ['error', 'never'],
      'react/react-in-jsx-scope': 'off',
      'no-case-declarations': 'off',
      'react/no-children-prop': 'off',
      'prefer-const': 'off',
      'react/prop-types': 'off',
      'no-extra-boolean-cast': 'off',
      'no-undef': 'off',
      'no-empty': 'off',
      'react/display-name': 'off',
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'no-async-promise-executor': 'off',
      'react/jsx-wrap-multilines': ['error', {
        'arrow': 'parens-new-line',
        'assignment': 'parens-new-line',
        'condition': 'parens-new-line',
        'logical': 'parens-new-line'
      }],
      '@stylistic/type-generic-spacing': ['error'],
      '@stylistic/indent': ['error', 2, { "SwitchCase": 0 }],
      '@stylistic/semi': ["error", "always"],
      '@stylistic/member-delimiter-style': ['error', {
        "multiline": {
          "delimiter": "semi",
          "requireLast": true
        },
        "singleline": {
          "delimiter": "semi",
          "requireLast": false
        },
        "multilineDetection": "brackets"
      }],
    },
  },
  {
    'files': ['**/*.ts?(x)'],
    'rules': {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/restrict-template-expressions': [
        'error', {
          'allowNumber': true,
          'allowAny': false,
          'allowBoolean': false,
          'allowNullish': false
        }
      ]
    },
    'languageOptions': {
      parserOptions: {
        project: true,
        tsconfigRootDir: __dirname,
      }
    }
  },
  {
    'files': ['**/*.test.ts?(x)'],
    'rules': {
      'import/first': 0
    }
  }
);
