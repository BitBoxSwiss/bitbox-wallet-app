import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';

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
    },
    'settings': {
      'react': {
        'version': 'detect'
      }
    },
    'rules': {
      'brace-style': ['error', '1tbs'],
      'comma-spacing': ['error', { 'before': false, 'after': true }],
      'curly': 'error',
      'indent': ['error', 2, { 'SwitchCase': 0 }],
      'jsx-a11y/anchor-is-valid': 0,
      'jsx-a11y/alt-text' : 0,
      'jsx-quotes': ['error', 'prefer-double'],
      'keyword-spacing': 'error',
      'eqeqeq': 'error',
      'no-multi-spaces': 'error',
      'no-trailing-spaces': 'error',
      'object-curly-spacing': ['error', 'always'],
      'quotes': ['error', 'single'],
      'semi': 'error',
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
      'no-async-promise-executor': 'off',
      'react/jsx-wrap-multilines': ['error', {
        'arrow': 'parens-new-line',
        'assignment': 'parens-new-line',
        'condition': 'parens-new-line',
        'logical': 'parens-new-line'
      }]
    },
  },
  {
    'files': ['**/*.ts?(x)'],
    'rules': {
      '@typescript-eslint/no-explicit-any': 'off',
      // '@typescript-eslint/type-annotation-spacing': 'error', // TODO use @stylistic/plus/type-generic-spacing: ['error']
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
        tsconfigRootDir: './',
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
