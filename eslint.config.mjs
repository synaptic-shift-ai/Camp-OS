import { defineConfig } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  // Use Next.js recommended config
  ...nextVitals,
  ...nextTs,

  // Ignore patterns
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'node_modules/**',
      '.claude/**',
      'scripts/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },

  // Global rules for all files
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
      'react/no-unescaped-entities': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*/types', '../types', './types'],
              message:
                'Import types from @/contracts/* instead of local types files. This ensures type consistency across the codebase.',
            },
          ],
        },
      ],
    },
  },

  // Middleware layer - allow local types imports
  {
    files: ['lib/middleware/**/*.ts', 'tests/integration/middleware-*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            // Allow ./types imports in middleware
            // Middleware has its own type system separate from contracts
          ],
        },
      ],
    },
  },

  // UI layer (app/components) - strict SDK isolation
  {
    files: ['app/**/*.ts', 'app/**/*.tsx', 'components/**/*.ts', 'components/**/*.tsx'],
    ignores: ['app/api/**', 'app/**/actions/**', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@supabase/*'],
              message:
                '⛔ Do not import Supabase directly in UI components. Use server actions (app/*/actions/*.ts) or API routes (app/api/*) instead.',
            },
            {
              group: ['stripe', '@stripe/stripe-js'],
              importNames: ['Stripe'],
              message:
                '⛔ Do not import Stripe SDK in UI components. Only @stripe/react-stripe-js is allowed for UI. Use server actions or API routes for Stripe API calls.',
            },
            {
              group: ['*/types', '../types', './types'],
              message: 'Import types from @/contracts/* instead of local types files.',
            },
          ],
        },
      ],
    },
  },

  // Server layer (API routes and actions) - enforce contracts
  {
    files: ['app/api/**/*.ts', 'app/**/actions/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*/types', '../types', './types'],
              message:
                'Import types from @/contracts/* instead. Server actions and API routes must use canonical contracts.',
            },
          ],
        },
      ],
    },
  },

  // Relax rules for UI pages with animations and error handling
  {
    files: [
      'app/**/confirmation/page.tsx',
      'app/dashboard/analytics/page.tsx',
      'app/global-error.tsx',
      'app/error.tsx',
    ],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn',
      'no-restricted-imports': 'off',
    },
  },
])
