/* Config ESLint (legacy) — refuerza la regla de dependencias FSD con boundaries:
   app → features → shared ; features NUNCA importan otra feature (comparten vía shared). */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: {
    'import/resolver': {
      typescript: { alwaysTryTypes: true, project: './tsconfig.app.json' },
    },
    'boundaries/elements': [
      // Los tests van primero para que un *.test.tsx bajo features/ se clasifique
      // como 'test' (que puede importar de cualquier capa) y no como 'feature'.
      { type: 'test', pattern: ['src/**/*.test.{ts,tsx}', 'src/test/**'] },
      { type: 'app', pattern: 'src/app/**' },
      { type: 'feature', pattern: 'src/features/*/**', capture: ['feature'] },
      { type: 'shared', pattern: 'src/shared/**' },
      { type: 'mocks', pattern: 'src/mocks/**' },
    ],
  },
  plugins: ['@typescript-eslint', 'react-refresh', 'boundaries'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  ignorePatterns: [
    'dist',
    'coverage',
    'node_modules',
    'vite.config.ts',
    'vitest.setup.ts',
    '.eslintrc.cjs',
    'src/shared/api/generated/**',
    'public/mockServiceWorker.js',
  ],
  overrides: [
    // Los componentes shadcn/ui exportan variantes (cva) junto al componente.
    { files: ['src/shared/ui/**'], rules: { 'react-refresh/only-export-components': 'off' } },
    // Los tests pueden importar de cualquier capa (features, mocks…).
    {
      files: ['**/*.test.{ts,tsx}'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'boundaries/element-types': 'off',
      },
    },
  ],
  rules: {
    // Ruidosas con instancias nombradas (i18next) y sin valor real aquí.
    'import/no-named-as-default': 'off',
    'import/no-named-as-default-member': 'off',
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'import/order': [
      'warn',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    'boundaries/no-unknown': 'off',
    'boundaries/element-types': [
      'error',
      {
        default: 'disallow',
        rules: [
          { from: 'app', allow: ['app', 'feature', 'shared'] },
          {
            from: 'feature',
            allow: ['shared', ['feature', { feature: '${from.feature}' }]],
          },
          { from: 'shared', allow: ['shared'] },
          { from: 'mocks', allow: ['shared', 'mocks'] },
          { from: 'test', allow: ['app', 'feature', 'shared', 'mocks', 'test'] },
        ],
      },
    ],
  },
};
