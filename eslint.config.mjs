import { FlatCompat } from '@eslint/eslintrc'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

export default [
  // Use Next.js recommended config via compat layer
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

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
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'react/no-unescaped-entities': 'warn',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../types', './types'],
              message:
                'Import types from @/contracts/* instead of local types files. This ensures type consistency across the codebase.',
            },
          ],
        },
      ],
    },
  },

  // Legacy code - allow local types imports (scheduled for deletion)
  {
    files: [
      'src/lib/booking/**',
      'src/lib/config/**',
      'src/lib/middleware/**',
      'src/lib/api/**',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  // Financial repositories use @ts-nocheck because DB tables are not yet in schema
  {
    files: [
      'src/modules/Financial/infrastructure/SupabaseInvoiceRepository.ts',
      'src/modules/Financial/infrastructure/SupabasePaymentPlanRepository.ts',
      'src/modules/Financial/infrastructure/SupabaseSecurityDepositRepository.ts',
      'src/modules/Financial/infrastructure/SupabaseTransactionRepository.ts',
    ],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },

  // Tests - allow local types imports
  {
    files: ['tests/**', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  // UI layer (app/components) - strict SDK isolation
  {
    files: ['src/app/**/*.ts', 'src/app/**/*.tsx', 'src/components/**/*.ts', 'src/components/**/*.tsx'],
    ignores: ['src/app/api/**', 'src/app/**/actions/**', '**/*.test.ts', '**/*.test.tsx'],
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
          ],
        },
      ],
    },
  },

  // Relax rules for UI pages with animations and error handling
  {
    files: [
      'src/app/**/confirmation/page.tsx',
      'src/app/dashboard/analytics/page.tsx',
      'src/app/global-error.tsx',
      'src/app/error.tsx',
    ],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn',
      'no-restricted-imports': 'off',
    },
  },
]
