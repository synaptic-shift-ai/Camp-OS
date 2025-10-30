# Phase 5: Quick Test Checklist

## Pre-Flight Check (5 minutes)

Before testing the booking flow, verify:

```bash
# 1. Start dev server
npm run dev

# 2. Verify environment variables
grep -E "STRIPE_SECRET_KEY|RESEND_API_KEY|NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" .env.local

# 3. Test email config
npm run test:email your-email@example.com

# 4. Check database connection
# Navigate to: http://localhost:3000/dashboard
# You should see your property dashboard
```

---

## Quick Happy Path Test (10 minutes)

### 1. Find Your Booking Page URL

```sql
-- Run in Supabase SQL Editor
SELECT
  name,
  booking_page_slug,
  onboarding_completed,
  CONCAT('http://localhost:3000/book/', booking_page_slug) as booking_url
FROM properties
WHERE booking_page_slug IS NOT NULL
  AND onboarding_completed = true;
```

### 2. Complete One Booking

1. **Navigate** to your booking URL from above
2. **Search**: Tomorrow → 2 days from now, 2 adults
3. **Select** any available site
4. **Fill form**:
   - Name: Test Guest
   - Email: your-email@example.com
   - Phone: 5551234567
   - Country: United States
5. **Agree** to terms → **Continue to Payment**
6. **Pay** with: `4242 4242 4242 4242`, exp: `12/34`, CVC: `123`
7. **Verify** confirmation page shows
8. **Check** email inbox

### 3. Verify Success

- [ ] Confirmation number starts with `CAMP-`
- [ ] Email received within 30 seconds
- [ ] Database has reservation record:

```sql
SELECT
  confirmation_number,
  status,
  payment_status,
  total_amount / 100.0 as total_dollars
FROM reservations
ORDER BY created_at DESC
LIMIT 1;
```

**Expected**: `status = 'confirmed'`, `payment_status = 'paid'`

---

## Critical Issues to Check

If any of these fail, stop and debug before proceeding:

### ❌ Cannot access booking page
**Debug**:
```sql
SELECT booking_page_slug, onboarding_completed
FROM properties
WHERE id = 'your-property-id';
```
**Fix**: Complete onboarding or set booking_page_slug

### ❌ "No sites available"
**Debug**:
```sql
SELECT site_number, status, base_price
FROM sites
WHERE property_id = 'your-property-id';
```
**Fix**: Set at least one site to `status = 'available'`

### ❌ Payment fails
**Debug**: Check terminal logs for Stripe errors
**Fix**: Verify `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

### ❌ Email not received
**Debug**: Check Resend logs at https://resend.com/emails
**Fix**: Verify `RESEND_API_KEY` and `RESEND_FROM_EMAIL`

---

## Mobile Test (3 minutes)

1. Open Chrome DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select "iPhone 12 Pro"
4. Complete one booking on mobile view

**Check**:
- [ ] All text is readable
- [ ] Buttons are easily tappable
- [ ] Forms work properly
- [ ] No horizontal scrolling

---

## Performance Check (2 minutes)

In Chrome DevTools:
1. Network tab → Reload page
2. Check "Finish" time at bottom

**Targets**:
- Initial load: < 2s
- Availability search: < 1s
- Payment processing: < 3s

---

## Done!

If all checks pass:
- ✅ Phase 5 core testing complete
- ✅ Ready for production deployment
- ✅ Can proceed to advanced features

If issues found:
- 📝 Document in GitHub issues
- 🔧 Fix critical bugs before deployment
- ⏭️ Minor issues can be addressed post-launch

---

## Next: Advanced Testing

For comprehensive testing, see [GUEST_BOOKING_TESTING.md](./GUEST_BOOKING_TESTING.md):
- Payment failure scenarios
- Form validation edge cases
- Concurrent booking conflicts
- Performance benchmarks
- Security verification
