import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import stylistic from '@stylistic/eslint-plugin';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Stylistic rules showed as warnings during development, errors otherwise
// process.env.NODE_ENV can be undefined during weblint, so we explicitly check for 'development'
const stylisticSeverity = process.env.NODE_ENV === 'development' ? 'warn' : 'error';

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
      'brace-style': [stylisticSeverity, '1tbs'],
      'comma-spacing': [stylisticSeverity, { 'before': false, 'after': true }],
      'curly': [stylisticSeverity],
      'jsx-a11y/anchor-is-valid': 0,
      'jsx-a11y/alt-text' : 0,
      'jsx-quotes': [stylisticSeverity, 'prefer-double'],
      'keyword-spacing': [stylisticSeverity],
      'eqeqeq': 'error',
      'no-multi-spaces': [stylisticSeverity],
      'no-trailing-spaces': [stylisticSeverity],
      'object-curly-spacing': [stylisticSeverity, 'always'],
      'quotes': [stylisticSeverity, 'single'],
      'space-before-blocks': [stylisticSeverity, 'always'],
      'space-in-parens': [stylisticSeverity, 'never'],
      'no-extra-semi': [stylisticSeverity],
      'arrow-spacing': [stylisticSeverity],
      'space-infix-ops': [stylisticSeverity],
      'react/no-unused-prop-types': 'error',
      'react/jsx-equals-spacing': [stylisticSeverity, 'never'],
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
      'react/jsx-wrap-multilines': [stylisticSeverity, {
        'arrow': 'parens-new-line',
        'assignment': 'parens-new-line',
        'condition': 'parens-new-line',
        'logical': 'parens-new-line'
      }],
      '@stylistic/type-generic-spacing': [stylisticSeverity],
      '@stylistic/indent': [stylisticSeverity, 2, { "SwitchCase": 0 }],
      '@stylistic/semi': [stylisticSeverity, "always"],
      '@stylistic/member-delimiter-style': [stylisticSeverity, {
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
