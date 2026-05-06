const prettier = require('eslint-config-prettier');

module.exports = [
  {
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Date: 'readonly',
        Map: 'readonly',
        Promise: 'readonly',
        Math: 'readonly',
      },
    },
    rules: {
      ...prettier.rules,
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
    },
  },
];
