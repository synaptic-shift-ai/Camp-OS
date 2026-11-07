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

  // Modules that keep their domain types alongside the code rather than in
  // src/contracts. Note the restriction only matches relative specifiers, so
  // these same types are already imported freely elsewhere as
  // '@/lib/<module>/types'; the exemption makes that consistent instead of
  // leaving it to which import style a file happens to use.
  {
    files: [
      'src/lib/booking/**',
      'src/lib/config/**',
      'src/lib/middleware/**',
      'src/lib/api/**',
      'src/lib/automations/**',
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
      // The typescript-eslint variant is used here so `allowTypeImports` is
      // available. The goal is to keep SDK *code* out of the client bundle;
      // a type-only import is erased at compile time and ships nothing, so
      // annotating against SupabaseClient/User/Stripe stays allowed while any
      // value import is still an error. The base rule is disabled to avoid
      // both rules reporting the same import.
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@supabase/*'],
              allowTypeImports: true,
              message:
                '⛔ Do not import Supabase directly in UI components. Use server actions (app/*/actions/*.ts) or API routes (app/api/*) instead.',
            },
            {
              group: ['stripe', '@stripe/stripe-js'],
              importNames: ['Stripe'],
              allowTypeImports: true,
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
      '@typescript-eslint/no-restricted-imports': 'off',
    },
  },
]
