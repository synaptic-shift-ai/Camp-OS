# MVP Shipment To-Do List

## Future Configuration Tasks

### Email Setup (Resend)
- [ ] Create Resend account and get API key
- [ ] Verify sending domain in Resend
- [ ] Add RESEND_API_KEY to Vercel environment variables
- [ ] Add RESEND_FROM_EMAIL to Vercel environment variables
- [ ] Test booking confirmation emails in production
- [ ] Test cancellation emails in production
- [ ] Set up email deliverability monitoring

### Error Tracking (Sentry)
- [ ] Create Sentry account and project
- [ ] Add NEXT_PUBLIC_SENTRY_DSN to Vercel environment variables
- [ ] Add SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN to Vercel
- [ ] Configure alert rules for critical errors
- [ ] Set up Slack/email notifications for errors
- [ ] Test error tracking in production

## Completed Features

### Day 1: Dashboard Data Integration ✅
- [x] Create server-side data fetching utilities
- [x] Connect reservations dashboard to real Supabase data
- [x] Connect payments dashboard to real Supabase data
- [x] Connect main dashboard to real stats
- [x] Type-safe money handling (integer cents)

### Day 2: Admin Operations ✅
- [x] Reservation cancellation API endpoint
- [x] Cancellation dialog UI component
- [x] Manual booking API for phone/walk-in reservations
- [x] Manual booking form with payment support
- [x] Multi-tenant security enforcement

### Day 3: Email Notifications ✅
- [x] Resend configuration and integration
- [x] Booking confirmation email template
- [x] Cancellation notice email template
- [x] Email sending utilities
- [x] Integration into booking and cancellation flows

### Day 4: Error Tracking & Monitoring ✅
- [x] Sentry client-side configuration
- [x] Sentry server-side configuration
- [x] Sentry edge runtime configuration
- [x] Global error boundary
- [x] Custom error page with user-friendly messaging
- [x] Sentry utility functions for context and tracking
- [x] Instrumented admin API routes with error tracking
- [x] Multi-tenant context tracking
- [x] Session replay integration (10% sample, 100% on errors)
