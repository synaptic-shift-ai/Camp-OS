import { type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateUnsubscribeToken, processUnsubscribe } from '@/lib/communications/unsubscribe'

// ============================================================================
// HTML templates
// ============================================================================

function expiredPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Unsubscribe</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; color: #333; }
    .card { background: #fff; border-radius: 12px; padding: 40px; max-width: 420px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    h1 { font-size: 20px; margin: 0 0 12px; }
    p { font-size: 14px; color: #666; margin: 0; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Link Expired</h1>
    <p>This unsubscribe link has expired or is invalid. Please contact the property directly to manage your email preferences.</p>
  </div>
</body>
</html>`
}

function successPage(propertyName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Unsubscribed</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; color: #333; }
    .card { background: #fff; border-radius: 12px; padding: 40px; max-width: 420px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .check { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 20px; margin: 0 0 12px; }
    p { font-size: 14px; color: #666; margin: 0; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="check">&#10003;</div>
    <h1>You're Unsubscribed</h1>
    <p>You have been unsubscribed from emails from ${escapeHtml(propertyName)}. If this was a mistake, please contact the property directly.</p>
  </div>
</body>
</html>`
}

function errorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Unsubscribe</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; color: #333; }
    .card { background: #fff; border-radius: 12px; padding: 40px; max-width: 420px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    h1 { font-size: 20px; margin: 0 0 12px; }
    p { font-size: 14px; color: #666; margin: 0; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Something Went Wrong</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// ============================================================================
// GET — Process unsubscribe
// ============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params

    // Validate token signature and expiry
    const payload = validateUnsubscribeToken(token)
    if (!payload) {
      return htmlResponse(expiredPage())
    }

    // Record the opt-out
    const supabase = createServiceRoleClient()
    const result = await processUnsubscribe(supabase, token)

    if (!result.success) {
      return htmlResponse(errorPage(result.error ?? 'Unable to process unsubscribe request'))
    }

    // Fetch property name for the success page
    const { data: property } = await supabase
      .from('properties')
      .select('name')
      .eq('id', payload.propertyId)
      .single()

    const propertyName = (property as Record<string, unknown>)?.name as string ?? 'CampOS'
    return htmlResponse(successPage(propertyName))
  } catch (err) {
    console.error('[unsubscribe] Error processing unsubscribe:', err)
    return htmlResponse(errorPage('An unexpected error occurred. Please try again later.'))
  }
}
