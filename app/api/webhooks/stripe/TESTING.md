# Stripe Webhook Testing

This guide explains how to test the Stripe webhook handler locally using the Stripe CLI.

## Prerequisites

1. **Install Stripe CLI**: https://stripe.com/docs/stripe-cli
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe

   # Windows
   scoop install stripe

   # Or download from: https://github.com/stripe/stripe-cli/releases/latest
   ```

2. **Login to Stripe**:
   ```bash
   stripe login
   ```

## Local Testing

### 1. Start the Next.js Development Server

```bash
npm run dev
```

The server should be running on `http://localhost:3000`

### 2. Start Stripe Webhook Forwarding

In a new terminal, run:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

This will:
- Create a temporary webhook signing secret
- Forward Stripe events to your local endpoint
- Display the webhook signing secret (starts with `whsec_`)

### 3. Update Environment Variables

Copy the webhook signing secret from the Stripe CLI output and add it to `.env.local`:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
```

**Important**: Restart your Next.js dev server after updating the environment variable.

### 4. Trigger Test Events

Use the Stripe CLI to trigger test payment events:

```bash
# Trigger a successful payment
stripe trigger payment_intent.succeeded

# Trigger with specific metadata (recommended)
stripe trigger payment_intent.succeeded \
  --add payment_intent:metadata[reservation_id]=550e8400-e29b-41d4-a716-446655440000 \
  --add payment_intent:metadata[property_id]=660e8400-e29b-41d4-a716-446655440000 \
  --add payment_intent:metadata[confirmation_number]=CONF-12345 \
  --add payment_intent:metadata[guest_email]=test@example.com
```

### 5. Verify Webhook Processing

Check your terminal running the Stripe CLI - you should see:
- ✅ Event sent to webhook endpoint
- ✅ Response status: 200

Check your Next.js dev server logs for:
```
Reservation <reservation_id> confirmed via webhook
```

## Testing with Real Stripe Dashboard Events

To test the production webhook endpoint:

1. **Create webhook endpoint** in Stripe Dashboard:
   - Go to: https://dashboard.stripe.com/webhooks
   - Click "Add endpoint"
   - Endpoint URL: `https://your-domain.com/api/webhooks/stripe`
   - Events to send: `payment_intent.succeeded`

2. **Copy signing secret** from the webhook details page

3. **Update production environment variables**:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_production_secret_here
   ```

## Troubleshooting

### Webhook Returns 400 "Invalid signature"

**Cause**: The webhook signing secret doesn't match or is missing.

**Fix**:
1. Check `.env.local` has the correct `STRIPE_WEBHOOK_SECRET`
2. Restart the Next.js dev server
3. Make sure you're using the secret from `stripe listen` output (not the dashboard secret)

### Webhook Returns 200 but reservation doesn't update

**Cause**: Invalid event data or database error.

**Fix**:
1. Check the Stripe CLI output for validation warnings
2. Ensure the reservation exists in the database with matching IDs
3. Check server logs for database errors
4. Verify the metadata contains valid UUIDs

### Event Not Received

**Cause**: Webhook forwarding not running or port mismatch.

**Fix**:
1. Ensure `stripe listen` is running
2. Verify Next.js is on port 3000 (or update the forward-to URL)
3. Check firewall settings

## Verification Checklist

Before deploying to production:

- [ ] Webhook signature verification works
- [ ] `payment_intent.succeeded` event updates reservation to `confirmed`
- [ ] Payment status updates to `paid`
- [ ] Paid amount is stored correctly (in cents as BIGINT)
- [ ] Tenant isolation works (property_id in metadata matches DB)
- [ ] Invalid events return 200 with warning (prevents retries)
- [ ] Database errors return 200 with warning (prevents infinite retries)
- [ ] Duplicate events are idempotent (safe to process multiple times)

## Phase 3 Acceptance Criteria

✅ Webhook handler created at `app/api/webhooks/stripe/route.ts`
✅ Stripe webhook signature verification implemented
✅ Payment completion updates reservation status
✅ Input/output validation with Zod schemas
✅ Environment variables documented in `.env.example`
✅ Testing documentation provided
