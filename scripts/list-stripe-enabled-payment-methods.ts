/**
 * Lists Stripe payment method configurations and which methods are available at checkout.
 *
 * Uses the Payment Method Configurations API (dynamic payment methods / Payment Element).
 * See: https://stripe.com/docs/api/payment_method_configurations/list
 *
 * Usage:
 *   npx tsx scripts/list-stripe-enabled-payment-methods.ts <propertyId>
 *
 * Or with npm script:
 *   npm run stripe:list-payment-methods -- <propertyId>
 *
 * Environment:
 *   STRIPE_SECRET_KEY — required (.env or .env.local in project root, or export in shell)
 *   PROPERTY_ID — optional; property id to look up connected stripe account (overrides STRIPE_CONNECTED_ACCOUNT)
 *   STRIPE_CONNECTED_ACCOUNT — optional; connected account ID (acct_...) for Connect context
 */

import { config } from 'dotenv'
import { existsSync } from 'fs'
import { resolve } from 'path'
import Stripe from 'stripe'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

const cwd = process.cwd()
for (const [name, path] of [
  ['.env', resolve(cwd, '.env')],
  ['.env.local', resolve(cwd, '.env.local')],
] as const) {
  if (existsSync(path)) {
    config({ path, override: name === '.env.local' })
  }
}

const STRIPE_API_VERSION = '2025-09-30.clover' as const
const DEFAULT_PROPERTY_ID = '4c925856-9745-4a51-91cf-b957afc03d84'

type PmBlock = {
  available: boolean
  display_preference?: {
    preference?: string
    value?: string
  }
}

function isPaymentMethodBlock(value: unknown): value is PmBlock {
  return (
    value !== null &&
    typeof value === 'object' &&
    'available' in value &&
    typeof (value as PmBlock).available === 'boolean'
  )
}

const CONFIG_METADATA_KEYS = new Set([
  'id',
  'object',
  'active',
  'application',
  'is_default',
  'livemode',
  'name',
  'parent',
])

function collectPaymentMethodsFromConfiguration(
  configuration: Stripe.PaymentMethodConfiguration,
): Array<{ key: string; available: boolean; preference?: string; effective?: string }> {
  const rows: Array<{ key: string; available: boolean; preference?: string; effective?: string }> = []
  for (const [key, value] of Object.entries(configuration)) {
    if (CONFIG_METADATA_KEYS.has(key)) continue
    if (!isPaymentMethodBlock(value)) continue
    rows.push({
      key,
      available: value.available,
      preference: value.display_preference?.preference,
      effective: value.display_preference?.value,
    })
  }
  rows.sort((a, b) => a.key.localeCompare(b.key))
  return rows
}

async function main() {
  const secret = process.env.STRIPE_SECRET_KEY?.trim()
  if (!secret) {
    console.error('Missing STRIPE_SECRET_KEY.')
    console.error(`  Tried loading: ${resolve(cwd, '.env')}, ${resolve(cwd, '.env.local')}`)
    console.error('  Add STRIPE_SECRET_KEY to one of those files (project root) or run: export STRIPE_SECRET_KEY=sk_...')
    process.exit(1)
  }

  const propertyId =
    process.argv[2]?.trim() ||
    process.env.PROPERTY_ID?.trim() ||
    DEFAULT_PROPERTY_ID

  // Prefer resolving from property_id so we always target the tenant’s connected account
  // (and never accidentally hit the platform/default account).
  let stripeAccount: string | undefined

  if (propertyId) {
    const supabase = createServiceRoleClient()
    const { data: property, error } = await supabase
      .from('properties')
      .select('id, stripe_account_id')
      .eq('id', propertyId)
      .single()

    if (error || !property) {
      console.error('Could not find property or load stripe_account_id.', {
        propertyId,
        error: error?.message ?? null,
      })
      process.exit(1)
    }

    const acct = (property as { stripe_account_id: string | null }).stripe_account_id
    if (!acct) {
      console.error('Property does not have a connected Stripe account (stripe_account_id is null).', {
        propertyId,
      })
      process.exit(1)
    }

    stripeAccount = acct
  }

  // Fall back to explicit env override if property resolution was disabled/removed.
  if (!stripeAccount) {
    stripeAccount = process.env.STRIPE_CONNECTED_ACCOUNT?.trim() || undefined
  }

  if (!stripeAccount) {
    console.error('No connected Stripe account resolved.')
    console.error(`  propertyId: ${propertyId}`)
    console.error('  Set STRIPE_CONNECTED_ACCOUNT=acct_... or ensure the property has stripe_account_id set.')
    process.exit(1)
  }

  const requestOptions: Stripe.RequestOptions | undefined = stripeAccount
    ? { stripeAccount }
    : undefined

  console.log(`Using connected account: ${stripeAccount}${propertyId ? ` (property: ${propertyId})` : ''}\n`)

  const stripe = new Stripe(secret, { apiVersion: STRIPE_API_VERSION })

  console.log('=== Account capabilities ===\n')
  try {
    const account = stripeAccount
      ? await stripe.accounts.retrieve(stripeAccount)
      : await stripe.accounts.retrieve()
    const caps = account.capabilities ?? {}
    const entries = Object.entries(caps).sort(([a], [b]) => a.localeCompare(b))
    if (entries.length === 0) {
      console.log('(no capabilities object on account response)\n')
    } else {
      for (const [name, status] of entries) {
        console.log(`  ${name}: ${status}`)
      }
      console.log('')
    }
  } catch (e) {
    console.warn('Could not retrieve account:', e instanceof Error ? e.message : e)
    console.log('')
  }

  console.log('=== Payment method configurations ===\n')
  try {
    const configurations: Stripe.PaymentMethodConfiguration[] = []
    let startingAfter: string | undefined
    do {
      const page = await stripe.paymentMethodConfigurations.list(
        { limit: 100, starting_after: startingAfter },
        requestOptions,
      )
      configurations.push(...page.data)
      startingAfter = page.has_more ? page.data[page.data.length - 1]?.id : undefined
    } while (startingAfter)

    if (configurations.length === 0) {
      console.log(
        'No payment method configurations returned. Your account may use legacy checkout settings only,',
      )
      console.log(
        'or the API may not expose configs for this key. Enable/configure payment methods in the Stripe Dashboard.',
      )
      console.log('')
      process.exit(0)
    }

    for (const cfg of configurations) {
      const methods = collectPaymentMethodsFromConfiguration(cfg)
      const enabled = methods.filter((m) => m.available)
      const disabled = methods.filter((m) => !m.available)

      console.log(`Configuration: ${cfg.name} (${cfg.id})`)
      console.log(`  default: ${cfg.is_default}  active: ${cfg.active}  livemode: ${cfg.livemode}`)
      if (cfg.parent) console.log(`  parent: ${cfg.parent}`)
      console.log('')

      console.log(`  Available at checkout (${enabled.length}):`)
      if (enabled.length === 0) {
        console.log('    (none)')
      } else {
        for (const m of enabled) {
          const pref =
            m.preference != null || m.effective != null
              ? ` [display: ${m.preference ?? '?'} / effective: ${m.effective ?? '?'}]`
              : ''
          console.log(`    - ${m.key}${pref}`)
        }
      }

      console.log(`\n  Not available (${disabled.length}):`)
      if (disabled.length === 0) {
        console.log('    (none)')
      } else {
        for (const m of disabled) {
          const pref =
            m.preference != null || m.effective != null
              ? ` [display: ${m.preference ?? '?'} / effective: ${m.effective ?? '?'}]`
              : ''
          console.log(`    - ${m.key}${pref}`)
        }
      }
      console.log('\n---\n')
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Failed to list payment method configurations:', msg)
    console.error(
      '\nIf you see a permissions error, ensure the key has access to Payment Method Configurations.',
    )
    process.exit(1)
  }
}

main()
