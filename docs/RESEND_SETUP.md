# Resend Email Setup Guide

This guide walks you through configuring Resend for sending booking confirmation emails.

## Prerequisites

✅ You've created a Resend account at https://resend.com

## Step-by-Step Setup

### 1. Get Your API Key

1. Navigate to **API Keys**: https://resend.com/api-keys
2. Click **"Create API Key"**
3. Enter a name: `CampOS Development` (or `CampOS Production`)
4. Keep the default **"Sending access"** permission
5. Click **"Create"**
6. **Copy the API key** (starts with `re_`) - Save it somewhere safe!
   - ⚠️ You won't be able to see this key again
   - If you lose it, you'll need to create a new one

### 2. Choose Your Sending Domain

You have two options:

#### Option A: Test Domain (Recommended for Getting Started)

Resend provides a test domain that works immediately:

- **Email**: `onboarding@resend.dev`
- **Limitation**: Can only send to your own verified email address
- **Use case**: Development and testing
- **Setup**: None required - works immediately!

#### Option B: Your Own Domain (For Production)

To send to any email address with your branding:

1. Go to **Domains**: https://resend.com/domains
2. Click **"Add Domain"**
3. Enter your domain (e.g., `yourdomain.com`)
4. Resend shows you 3 DNS records to add:

   **SPF Record (TXT)**:
   ```
   Name: @
   Type: TXT
   Value: v=spf1 include:resend.com ~all
   ```

   **DKIM Record (TXT or CNAME)**:
   ```
   Name: resend._domainkey
   Type: TXT
   Value: [unique value shown by Resend]
   ```

   **DMARC Record (TXT)** - Optional but recommended:
   ```
   Name: _dmarc
   Type: TXT
   Value: v=DMARC1; p=none; rua=mailto:youremail@yourdomain.com
   ```

5. Add these records in your DNS provider:
   - **Cloudflare**: DNS → Add record
   - **Namecheap**: Advanced DNS → Add New Record
   - **GoDaddy**: DNS → Manage → Add
   - **Vercel**: Domains → DNS Records

6. Wait for verification:
   - Usually: 15-30 minutes
   - Maximum: 48 hours

7. Once verified ✅, you can use any email on your domain:
   - `noreply@yourdomain.com`
   - `bookings@yourdomain.com`
   - `hello@yourdomain.com`

### 3. Configure Environment Variables

1. Open `.env.local` in the project root
2. Add these two lines:

```bash
# Resend Email Configuration
RESEND_API_KEY=re_YOUR_ACTUAL_API_KEY_HERE
RESEND_FROM_EMAIL=onboarding@resend.dev
```

**Replace**:
- `re_YOUR_ACTUAL_API_KEY_HERE` → Your API key from Step 1
- `onboarding@resend.dev` → Your verified domain email (if using Option B)

**Example**:
```bash
RESEND_API_KEY=re_abcd1234_XyZ9876pQrStUvWx
RESEND_FROM_EMAIL=onboarding@resend.dev
```

3. Save the file

### 4. Install Dependencies & Test

Install the `tsx` package (for running the test script):

```bash
npm install
```

Run the email test with **your real email address**:

```bash
npm run test:email your-email@example.com
```

Replace `your-email@example.com` with your actual email address.

**Expected output**:
```
🧪 Testing Resend email configuration...
📧 Sending test booking confirmation to: your-email@example.com

✅ Email sent successfully!
📬 Check your inbox at: your-email@example.com

Email details:
- Confirmation Number: TEST-L9X8K2
- Property: Pine Valley Campground
- Site: Riverside Site A-12
- Check-in: 2025-06-15
- Total: $270.00

✨ All email features tested:
  ✓ Booking details
  ✓ Payment information
  ✓ Property contact info
  ✓ Check-in/check-out times
  ✓ Directions
  ✓ Special requests
```

### 5. Check Your Inbox

1. Check your email inbox (including spam/junk folder)
2. Look for an email with subject: **"Booking Confirmed - TEST-[ID] at Pine Valley Campground"**
3. Verify the email includes:
   - ✅ Booking details (dates, guests, site)
   - ✅ Payment breakdown
   - ✅ Property contact information
   - ✅ Check-in/check-out times
   - ✅ Directions
   - ✅ Special requests

## Troubleshooting

### ❌ Error: "RESEND_API_KEY environment variable is not set"

**Solution**: Make sure you've added the API key to `.env.local` and saved the file.

### ❌ Error: "API key is invalid"

**Solutions**:
1. Check for typos in your API key
2. Ensure there are no extra spaces before/after the key
3. Generate a new API key if needed: https://resend.com/api-keys

### ❌ Error: "Domain not verified"

**Solutions**:
1. If using your own domain: Check DNS records are correct
2. Use `onboarding@resend.dev` temporarily while DNS propagates
3. Wait up to 48 hours for DNS changes

### ❌ Email sent but not received

**Check**:
1. Spam/junk folder
2. If using test domain (`onboarding@resend.dev`):
   - Can only send to the email address you signed up with
3. Check Resend logs: https://resend.com/emails

### 🔄 Switching from Test to Production Domain

Once your domain is verified:

1. Update `.env.local`:
   ```bash
   RESEND_FROM_EMAIL=noreply@yourdomain.com
   ```

2. Restart your development server:
   ```bash
   # Stop the server (Ctrl+C)
   npm run dev
   ```

3. Test again:
   ```bash
   npm run test:email any-email@example.com
   ```

## Production Checklist

Before going to production:

- [ ] Domain verified in Resend
- [ ] Using your own domain (not `onboarding@resend.dev`)
- [ ] Tested emails to multiple recipients
- [ ] Checked spam scores (Resend provides this)
- [ ] Set up DMARC policy
- [ ] Added environment variables to production hosting (Vercel, etc.)

## Resources

- **Resend Dashboard**: https://resend.com/overview
- **API Keys**: https://resend.com/api-keys
- **Domains**: https://resend.com/domains
- **Email Logs**: https://resend.com/emails
- **Documentation**: https://resend.com/docs
- **DNS Setup Help**: https://resend.com/docs/dashboard/domains/introduction

## Next Steps

Once email is working:
1. ✅ Continue to Phase 5: Quality Assurance
2. Test the full booking flow end-to-end
3. Verify mobile responsiveness
4. Test error handling
5. Performance optimization
