/**
 * Unsubscribe Token
 *
 * Generates and validates HMAC-SHA256 tokens for one-click unsubscribe links.
 * Tokens are short-lived (7 days) and tied to a specific guest + property pair.
 */

import { createHmac, timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { recordOptOut } from './opt-out-checker'

// ============================================================================
// Constants
// ============================================================================

const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function getSecret(): Buffer {
  const env = process.env.UNSUBSCRIBE_SECRET
  if (env) return Buffer.from(env, 'utf8')
  // Derive a stable secret from the Supabase service role key so tokens
  // still work without a dedicated env var in development.
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'campos-unsafe-fallback'
  return createHmac('sha256', 'campos-unsubscribe-key').update(fallback).digest()
}

// ============================================================================
// Helpers
// ============================================================================

function base64urlEncode(buf: Buffer): string {
  return buf.toString('base64url')
}

function base64urlDecode(str: string): Buffer {
  return Buffer.from(str, 'base64url')
}

// ============================================================================
// Types
// ============================================================================

export type UnsubscribePayload = {
  guestId: string
  propertyId: string
}

export type UnsubscribeResult = {
  success: boolean
  error?: string
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Generate an HMAC-signed unsubscribe token.
 *
 * Format: base64url(payload) + '.' + base64url(signature)
 * Payload includes an expiry timestamp (7 days from now).
 */
export function generateUnsubscribeToken(
  guestId: string,
  propertyId: string,
): string {
  const payload = JSON.stringify({
    guestId,
    propertyId,
    exp: Date.now() + TOKEN_EXPIRY_MS,
  } as UnsubscribePayload & { exp: number })

  const payloadBuf = Buffer.from(payload, 'utf8')
  const signature = createHmac('sha256', getSecret()).update(payloadBuf).digest()

  return `${base64urlEncode(payloadBuf)}.${base64urlEncode(signature)}`
}

/**
 * Validate an unsubscribe token.
 *
 * Verifies the HMAC signature and checks that the token has not expired.
 * Returns the payload (guestId, propertyId) or null if invalid/expired.
 */
export function validateUnsubscribeToken(
  token: string,
): UnsubscribePayload | null {
  try {
    const dotIndex = token.indexOf('.')
    if (dotIndex === -1) return null

    const payloadB64 = token.slice(0, dotIndex)
    const signatureB64 = token.slice(dotIndex + 1)

    const payloadBuf = base64urlDecode(payloadB64)
    const signatureBuf = base64urlDecode(signatureB64)

    const expectedSig = createHmac('sha256', getSecret()).update(payloadBuf).digest()

    // Constant-time comparison to prevent timing attacks
    if (
      signatureBuf.length !== expectedSig.length ||
      !timingSafeEqual(signatureBuf, expectedSig)
    ) {
      return null
    }

    const parsed = JSON.parse(payloadBuf.toString('utf8')) as UnsubscribePayload & {
      exp: number
    }

    if (typeof parsed.exp !== 'number' || Date.now() > parsed.exp) {
      return null
    }

    return { guestId: parsed.guestId, propertyId: parsed.propertyId }
  } catch {
    return null
  }
}

/**
 * Process an unsubscribe request.
 *
 * Validates the token, then records the opt-out. Returns success/failure status.
 */
export async function processUnsubscribe(
  supabase: SupabaseClient,
  token: string,
): Promise<UnsubscribeResult> {
  const payload = validateUnsubscribeToken(token)

  if (!payload) {
    return { success: false, error: 'Invalid or expired unsubscribe token' }
  }

  // Look up the company_id for this property so we can record the opt-out
  const { data: property, error } = await supabase
    .from('properties')
    .select('company_id')
    .eq('id', payload.propertyId)
    .single()

  if (error || !property) {
    return { success: false, error: 'Property not found' }
  }

  const companyId = (property as Record<string, unknown>).company_id as string

  const ok = await recordOptOut(
    supabase,
    companyId,
    payload.guestId,
    'email',
    'unsubscribe_link',
  )

  if (!ok) {
    return { success: false, error: 'Failed to record opt-out' }
  }

  return { success: true }
}
