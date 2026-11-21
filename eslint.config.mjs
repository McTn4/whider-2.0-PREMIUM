// ESLint (configuración plana). La app son scripts clásicos que cuelgan de window.Whider;
// el escritorio, las herramientas y las pruebas son Node (CommonJS), y los .mjs, módulos.
import js from '@eslint/js';
import globals from 'globals';

const reglas = {
  // Variables sin usar: aviso (argumentos y errores capturados no cuentan)
  'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
  // Un catch vacío es una decisión consciente en este proyecto (almacenamiento bloqueado, etc.)
  'no-empty': ['error', { allowEmptyCatch: true }],
  'no-prototype-builtins': 'off',
  eqeqeq: ['error', 'smart'],
  'no-var': 'off',
  'prefer-const': 'off'
};

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'js/vendor/**',
      'desktop/www/**',
      'desktop/dist/**',
      'desktop/node_modules/**',
      'android/**',
      'tools/firebase-bundle/**',
      'tests/e2e/logs/**'
    ]
  },
  js.configs.recommended,
  {
    files: ['js/**/*.js', 'sitio/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: { ...globals.browser, Whider: 'readonly' }
    },
    rules: reglas
  },
  {
    files: ['sw.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'script', globals: { ...globals.serviceworker } },
    rules: reglas
  },
  {
    files: ['desktop/**/*.js', 'tools/**/*.js', 'tests/**/*.js', 'api/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: { ...globals.node } },
    rules: reglas
  },
  {
    // Las pruebas y las capturas ejecutan código en la página (page.evaluate): también vale lo del navegador
    files: ['tests/e2e/**/*.js', 'tools/capturas/**/*.js', 'tools/iconos/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser, Whider: 'readonly', axe: 'readonly' } }
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node } },
    rules: reglas
  }
];
