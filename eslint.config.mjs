import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'artifacts/**', 'backups/**'] },
  {
    files: ['backend/src/**/*.ts', 'frontend/src/**/*.{ts,tsx}', 'api/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      // Existing API boundaries accept dynamic JSON; typecheck remains strict.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);
