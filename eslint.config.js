'use strict';

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'src/api/node_modules/**'] },
  js.configs.recommended,
  {
    files: ['src/api/**/*.js', 'tests/**/*.js', 'eslint.config.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
  {
    files: ['src/web/**/*.js'],
    languageOptions: { sourceType: 'script', globals: globals.browser },
  },
];
