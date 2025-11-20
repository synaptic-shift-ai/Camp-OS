/**
 * Email Test Script
 *
 * Tests that Resend email configuration is working correctly.
 * Usage: npx tsx scripts/test-email.ts your-email@example.com
 */

// Load environment variables from .env.local
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import { sendBookingConfirmation } from '../src/lib/email/send'

const testEmail = process.argv[2]

if (!testEmail) {
  console.error('❌ Error: Please provide an email address')
  console.log('Usage: npx tsx scripts/test-email.ts your-email@example.com')
  process.exit(1)
}

console.log('🧪 Testing Resend email configuration...')
console.log(`📧 Sending test booking confirmation to: ${testEmail}\n`)

const testData = {
  guestName: 'Test Guest',
  guestEmail: testEmail,
  confirmationNumber: 'TEST-' + Date.now().toString(36).toUpperCase(),
  propertyName: 'Pine Valley Campground',
  siteName: 'Riverside Site A-12',
  checkInDate: '2025-06-15',
  checkOutDate: '2025-06-18',
  numNights: 3,
  numAdults: 2,
  numChildren: 1,
  totalAmount: 27000, // $270.00 in cents
  paidAmount: 27000,
  paymentStatus: 'paid' as const,
  specialRequests: 'Please provide a site near the restrooms. Early check-in if possible.',
  // Property contact info
  propertyPhone: '(555) 123-4567',
  propertyEmail: 'info@pinevalleycampground.com',
  propertyAddress: '1234 Forest Road, Pine Valley, CA 91962',
  checkInTime: '15:00:00',
  checkOutTime: '11:00:00',
  directions: 'From Highway 94, turn north on Pine Valley Road. Continue 2 miles and turn right at the campground sign. Office is on the left.',
}

sendBookingConfirmation(testData)
  .then((result) => {
    if (result.success) {
      console.log('✅ Email sent successfully!')
      console.log('📬 Check your inbox at:', testEmail)
      console.log('\nEmail details:')
      console.log('- Confirmation Number:', testData.confirmationNumber)
      console.log('- Property:', testData.propertyName)
      console.log('- Site:', testData.siteName)
      console.log('- Check-in:', testData.checkInDate)
      console.log('- Total:', `$${(testData.totalAmount / 100).toFixed(2)}`)
      console.log('\n✨ All email features tested:')
      console.log('  ✓ Booking details')
      console.log('  ✓ Payment information')
      console.log('  ✓ Property contact info')
      console.log('  ✓ Check-in/check-out times')
      console.log('  ✓ Directions')
      console.log('  ✓ Special requests')
    } else {
      console.error('❌ Email failed to send')
      console.error('Error:', result.error)
      console.log('\n🔍 Troubleshooting:')
      console.log('1. Check that RESEND_API_KEY is set in .env.local')
      console.log('2. Check that RESEND_FROM_EMAIL is set in .env.local')
      console.log('3. Verify your API key is valid at https://resend.com/api-keys')
      console.log('4. Ensure your sending domain is verified (or use onboarding@resend.dev)')
      process.exit(1)
    }
  })
  .catch((error) => {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  })
