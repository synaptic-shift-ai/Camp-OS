# Guest Booking Portal - End-to-End Testing Guide

This guide provides step-by-step instructions for testing the complete guest booking flow.

## Prerequisites

Before testing, ensure:

- ✅ Development server is running: `npm run dev`
- ✅ Supabase project is connected and migrations applied
- ✅ Stripe test keys are configured in `.env.local`
- ✅ Resend email is configured and tested
- ✅ At least one property with:
  - Onboarding completed
  - Booking page slug configured
  - Active sites available
  - Stripe Connect account linked

## Test Environment Setup

### 1. Create Test Property

If you don't have a test property set up:

```sql
-- Check if you have a property with booking enabled
SELECT
  id,
  name,
  booking_page_slug,
  onboarding_completed,
  stripe_account_id
FROM properties
WHERE booking_page_slug IS NOT NULL
  AND onboarding_completed = true;
```

### 2. Create Test Sites

Ensure you have available sites:

```sql
-- Check available sites for your property
SELECT
  id,
  site_number,
  site_name,
  site_type,
  status,
  base_price
FROM sites
WHERE property_id = 'your-property-id'
  AND status = 'available';
```

### 3. Test Payment Methods

Use Stripe test card numbers:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

Any future expiry date and any 3-digit CVC will work.

---

## End-to-End Test Scenarios

### Test 1: Happy Path - Complete Booking

**Objective**: Successfully complete a booking from start to finish.

#### Step 1: Access Booking Portal

1. Navigate to: `http://localhost:3000/book/[your-slug]`
   - Replace `[your-slug]` with your property's `booking_page_slug`
   - Example: `http://localhost:3000/book/pine-valley-campground`

**Expected**:
- ✅ Property hero image displays
- ✅ Property name and location show correctly
- ✅ Check-in/check-out date pickers are visible
- ✅ Guest count selectors work
- ✅ Site type filter displays

#### Step 2: Search for Availability

1. Select check-in date (future date)
2. Select check-out date (at least 1 night later)
3. Set adults: 2
4. Set children: 1
5. Click **"Search Available Sites"**

**Expected**:
- ✅ Loading spinner appears
- ✅ Results section slides in
- ✅ Available sites display with:
  - Site name/number
  - Site type badge
  - Price per night
  - Amenity icons
  - "Book This Site" button

**Debug if fails**:
```bash
# Check server logs for API errors
# Look for: [Guest Availability]

# Verify sites are available
SELECT * FROM sites WHERE property_id = 'your-property-id' AND status = 'available';
```

#### Step 3: Select a Site

1. Review available sites
2. Click **"Book This Site"** on any site

**Expected**:
- ✅ Redirects to `/book/checkout`
- ✅ Progress indicator shows "Guest Info" as current step
- ✅ Order summary (right side) displays:
  - Site image
  - Site name and number
  - Check-in/check-out dates
  - Number of nights
  - Price breakdown
  - Total amount

#### Step 4: Fill Guest Information

Fill out the form with test data:

```
First Name: Test
Last Name: Guest
Email: your-test-email@example.com
Phone: (555) 123-4567
Address: 123 Test Street (optional)
City: Test City (optional)
State: CA (optional)
ZIP: 12345 (optional)
Country: United States
```

Optional fields:
```
Number of Pets: 1
Special Requests: "Please provide a site near the restrooms."
```

5. Check **"I agree to Terms and Conditions"**
6. Click **"Continue to Payment"**

**Expected**:
- ✅ Form validation works (try submitting without required fields)
- ✅ Phone number formats correctly
- ✅ API call succeeds
- ✅ Redirects to `/book/payment`

**Debug if fails**:
```bash
# Check API response
# POST /api/guest/reservations/create

# Expected response:
{
  "success": true,
  "data": {
    "reservation_id": "uuid",
    "confirmation_number": "CAMP-...",
    "total_amount_cents": 15000,
    "price_breakdown": { ... }
  }
}
```

#### Step 5: Complete Payment

1. Review order summary
2. Enter Stripe test card: `4242 4242 4242 4242`
3. Enter expiry: `12/34`
4. Enter CVC: `123`
5. Enter ZIP: `12345`
6. Check **"I agree to the Terms and Conditions"**
7. Click **"Complete Booking - $XXX.XX"**

**Expected**:
- ✅ Stripe Payment Element loads
- ✅ Card fields are interactive
- ✅ Submit button shows loading state
- ✅ Payment processes successfully
- ✅ Redirects to `/book/confirmation?payment_intent=pi_...`

**Debug if fails**:
```bash
# Check browser console for Stripe errors
# Check server logs for payment intent creation

# Verify Stripe keys are correct
echo $STRIPE_SECRET_KEY | head -c 10
```

#### Step 6: View Confirmation

**Expected**:
- ✅ Confirmation page displays:
  - Success checkmark animation
  - Confirmation number: `CAMP-XXXXXXXX`
  - Booking summary
  - Check-in/check-out details
  - Total paid
  - Property contact information
- ✅ "View Confirmation" button is visible

#### Step 7: Verify Email Delivery

1. Check the email inbox for: `your-test-email@example.com`
2. Look for: **"Booking Confirmed - CAMP-XXXXXXXX at [Property Name]"**

**Expected Email Content**:
- ✅ Guest name
- ✅ Confirmation number
- ✅ Property name and site details
- ✅ Check-in/check-out dates
- ✅ Number of nights and guests
- ✅ Payment breakdown
- ✅ Property contact info (phone, email, address if available)
- ✅ Check-in/check-out times
- ✅ Directions (if provided)
- ✅ Special requests (if provided)

**Debug if email not received**:
```bash
# Test email configuration
npm run test:email your-test-email@example.com

# Check Resend logs
# https://resend.com/emails

# Verify environment variables
echo $RESEND_API_KEY | head -c 10
echo $RESEND_FROM_EMAIL
```

#### Step 8: Verify Database Records

```sql
-- Find the reservation
SELECT
  r.id,
  r.confirmation_number,
  r.status,
  r.payment_status,
  r.total_amount,
  r.check_in_date,
  r.check_out_date,
  g.first_name,
  g.last_name,
  g.email
FROM reservations r
JOIN guests g ON r.guest_id = g.id
WHERE r.confirmation_number LIKE 'CAMP-%'
ORDER BY r.created_at DESC
LIMIT 5;

-- Verify payment record
SELECT
  id,
  amount,
  payment_method,
  payment_status,
  stripe_payment_id,
  processed_at
FROM payments
WHERE reservation_id = 'your-reservation-id';
```

**Expected**:
- ✅ Reservation status: `confirmed`
- ✅ Payment status: `paid`
- ✅ Total amount matches what was paid
- ✅ Guest record created with correct info
- ✅ Payment record exists with Stripe PaymentIntent ID

---

### Test 2: Payment Failure Handling

**Objective**: Verify error handling when payment is declined.

#### Steps:

1. Follow Test 1 steps 1-4 (reach payment page)
2. Use declined card: `4000 0000 0000 0002`
3. Enter expiry: `12/34`, CVC: `123`, ZIP: `12345`
4. Check terms and click **"Complete Booking"**

**Expected**:
- ✅ Error message displays: "Your card was declined"
- ✅ User stays on payment page
- ✅ Can try again with different card
- ✅ Reservation remains in `pending` status
- ✅ No confirmation email sent

---

### Test 3: Form Validation

**Objective**: Verify all form validations work correctly.

#### Guest Info Page Tests:

| Field | Test | Expected Error |
|-------|------|----------------|
| First Name | Leave empty | "First name is required" |
| Email | Enter "invalid" | "Invalid email address" |
| Phone | Enter "123" | "Phone number must be at least 10 digits" |
| Check-in Date | Today's date | "Check-in must be at least 1 day in the future" |
| Check-out Date | Same as check-in | "Check-out must be after check-in" |

---

### Test 4: No Available Sites

**Objective**: Verify behavior when no sites match criteria.

#### Steps:

1. Navigate to booking portal
2. Select dates far in the future (e.g., 2 years)
3. Search for availability

**Expected**:
- ✅ Message displays: "No available sites found for your dates"
- ✅ Suggestions shown:
  - Try different dates
  - Try different site type
  - Contact property directly

---

### Test 5: Session Persistence

**Objective**: Verify booking data persists across page refreshes.

#### Steps:

1. Complete steps through guest info (reach payment page)
2. **Refresh the page** (F5)

**Expected**:
- ✅ Order summary still displays correctly
- ✅ Payment form loads successfully
- ✅ Can complete payment after refresh

---

### Test 6: Mobile Responsiveness

**Objective**: Verify booking flow works on mobile devices.

#### Steps:

1. Open Chrome DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select "iPhone 12 Pro" or "Pixel 5"
4. Complete full booking flow

**Expected on Mobile**:
- ✅ Property hero image scales appropriately
- ✅ Date pickers are mobile-friendly
- ✅ Site cards stack vertically
- ✅ Order summary collapses or scrolls
- ✅ Payment form is readable
- ✅ All buttons are easily tappable (44px minimum)

Test these specific viewports:
- **Mobile**: 375px × 667px (iPhone SE)
- **Tablet**: 768px × 1024px (iPad)
- **Desktop**: 1920px × 1080px

---

### Test 7: Concurrent Bookings

**Objective**: Verify that booking the same site simultaneously is handled.

#### Steps:

1. Open two browser windows side-by-side
2. In both windows, navigate to the same property
3. Search for same dates in both
4. Select the SAME site in both windows
5. Complete checkout in Window 1
6. Try to complete checkout in Window 2

**Expected**:
- ✅ Window 1 completes successfully
- ✅ Window 2 shows error: "This site is no longer available"
- ✅ No double-booking occurs in database

---

## Performance Benchmarks

Target performance metrics:

| Action | Target Time | Measurement |
|--------|-------------|-------------|
| Initial page load | < 2s | Time to Interactive |
| Availability search | < 1s | API response time |
| Checkout page load | < 1s | Navigation time |
| Payment processing | < 3s | Stripe confirmation |
| Email delivery | < 5s | Resend API response |

### Measure Performance:

```bash
# Use Lighthouse in Chrome DevTools
1. Open DevTools (F12)
2. Go to "Lighthouse" tab
3. Select "Performance" and "Mobile"
4. Click "Analyze page load"

# Target Scores:
- Performance: > 90
- Accessibility: > 95
- Best Practices: > 90
- SEO: > 90
```

---

## Error Scenarios to Test

### API Errors

**Simulate database down**:
- Expected: Graceful error message, no crash

**Simulate Stripe API error**:
- Expected: Payment error message, can retry

**Simulate email service down**:
- Expected: Booking completes, email error logged (not user-facing)

### Edge Cases

- ✅ Booking with 0 children
- ✅ Booking with maximum guests
- ✅ Very long special requests (test character limit)
- ✅ International phone number formats
- ✅ Same-day check-in (if minimum advance is 1 day, should error)
- ✅ Booking >365 days in advance

---

## Checklist: Definition of Done

Before marking Phase 5 complete, verify:

### Functionality
- [ ] Complete booking flow works end-to-end
- [ ] All form validations function correctly
- [ ] Payment processing succeeds with test cards
- [ ] Payment failures are handled gracefully
- [ ] Confirmation email delivers within 5 seconds
- [ ] Database records are created correctly
- [ ] Concurrent booking conflicts are prevented

### User Experience
- [ ] Mobile responsive (320px - 1920px)
- [ ] Loading states display during async operations
- [ ] Error messages are clear and actionable
- [ ] Success confirmations are prominent
- [ ] No console errors or warnings

### Performance
- [ ] Initial load < 2s
- [ ] Availability search < 1s
- [ ] Payment processing < 3s
- [ ] Lighthouse Performance > 90
- [ ] No memory leaks (test with Chrome DevTools)

### Security
- [ ] Payment data is never logged
- [ ] Tenant isolation is enforced (no cross-property bookings)
- [ ] Guest data is properly validated
- [ ] Stripe API keys are never exposed to frontend

### Email
- [ ] Confirmation email includes all booking details
- [ ] Email formatting is correct (no broken HTML)
- [ ] Property contact info displays when available
- [ ] Email arrives in inbox (not spam)

---

## Known Issues / Limitations

### Current Limitations:

1. **Single Property Testing**: Requires at least one fully onboarded property
2. **Weekend Pricing**: Simple per-night pricing (no weekend differential yet)
3. **Tax Calculation**: Not yet implemented
4. **Cancellation Flow**: Guest-initiated cancellations not yet available
5. **Modification Flow**: Cannot modify existing reservations yet

### Future Enhancements:

- [ ] Guest login to view booking history
- [ ] Guest-initiated cancellations
- [ ] Booking modifications
- [ ] Add-ons (firewood, extra vehicles, etc.)
- [ ] Discount codes
- [ ] Group bookings (multiple sites)
- [ ] Split payments
- [ ] Deposit + balance payments

---

## Troubleshooting Guide

### Issue: "Property not found"
**Cause**: Booking page slug doesn't exist or onboarding incomplete
**Fix**: Verify property setup in dashboard

### Issue: "No available sites"
**Cause**: All sites booked or inactive
**Fix**: Check site status in database, ensure at least one site is `status = 'available'`

### Issue: "Payment intent creation failed"
**Cause**: Stripe not connected or API keys invalid
**Fix**: Verify Stripe Connect account is linked, check `STRIPE_SECRET_KEY`

### Issue: Email not received
**Cause**: Resend not configured or domain not verified
**Fix**: Run `npm run test:email`, check Resend logs

### Issue: TypeScript build errors
**Cause**: TEMP directory included in compilation
**Fix**: Verify `tsconfig.json` excludes TEMP directory

---

## Reporting Issues

When reporting bugs, include:

1. **Steps to reproduce**
2. **Expected behavior**
3. **Actual behavior**
4. **Browser console logs**
5. **Server logs** (check terminal where `npm run dev` is running)
6. **Database state** (relevant SQL queries)
7. **Stripe logs** (if payment-related)
8. **Resend logs** (if email-related)

---

## Next Steps

After Phase 5 testing is complete:

1. Document any bugs found
2. Create GitHub issues for bugs
3. Plan Phase 6: Guest Features (login, history, modifications)
4. Plan Phase 7: Advanced Features (add-ons, discounts, group bookings)
