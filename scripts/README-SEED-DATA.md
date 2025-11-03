# Seed Analytics Data

This directory contains scripts to populate your database with realistic test data for the analytics dashboard.

## Quick Start

```bash
npm run seed:analytics
```

This will automatically:
- Find your property
- Create 27 diverse guest records
- Generate 100+ historical reservations spanning the past 12 months
- Create payment records with varied methods (credit card, debit card, cash, bank transfer)
- Display a summary of created data

## What Gets Created

### Guests (27 records)
Diverse guest profiles with:
- First and last names
- Email addresses
- Phone numbers
- Addresses across multiple US states (OR, WA, CO, TX, AZ)

### Reservations (100+ records)
Historical booking data including:
- Check-in and check-out dates spanning past 12 months
- Various stay lengths (2-7 nights)
- Different statuses: confirmed, checked_in, checked_out, cancelled
- Multiple booking sources: direct, Booking.com, Airbnb
- Realistic pricing ($45-$150 per night)
- Payment statuses: paid, partial, unpaid

### Payments (100+ records)
Payment transactions with:
- Multiple payment methods: credit_card, debit_card, cash, bank_transfer
- Completed and pending statuses
- Associated with reservations
- Realistic timing (payments before check-in dates)

## Expected Results

After running the script, you should see approximately:
- **Total Revenue**: $40,000 - $60,000
- **Reservations**: 100-120
- **Payment Methods**: Evenly distributed across credit_card, debit_card, cash, bank_transfer
- **Booking Sources**: Mostly direct bookings with some from Booking.com and Airbnb

## Viewing the Data

After running the seed script:
1. Refresh your analytics dashboard at `/dashboard/analytics`
2. Use the date range filter to explore different time periods
3. View the Revenue tab to see payment method breakdowns
4. View the Occupancy tab to see monthly historical data

## Files

- `run-seed-data.js` - Main Node.js script that generates the data programmatically
- `seed-analytics-data.sql` - SQL version for manual execution in Supabase (alternative method)
- `README-SEED-DATA.md` - This file

## Troubleshooting

### No available sites found
**Solution**: Run the onboarding wizard to create sites first, or use `setup-test-data.sql` to configure your property.

### Missing Supabase credentials
**Solution**: Ensure your `.env.local` file contains:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Script runs but dashboard shows no data
**Solution**:
1. Hard refresh your browser (Ctrl+Shift+R)
2. Check that your property ID matches
3. Verify data was created: Check Supabase dashboard → Table Editor → reservations

## Running Multiple Times

The script can be run multiple times safely - it will continue adding more data. If you want to start fresh:

```sql
-- In Supabase SQL Editor
DELETE FROM payments WHERE property_id = 'YOUR_PROPERTY_ID';
DELETE FROM reservations WHERE property_id = 'YOUR_PROPERTY_ID';
DELETE FROM guests WHERE property_id = 'YOUR_PROPERTY_ID';
```

## Alternative: Manual SQL Execution

If you prefer to run the SQL directly:

1. Open Supabase SQL Editor
2. Copy contents from `scripts/seed-analytics-data.sql`
3. Replace `86ab6f78-9c2c-45bb-9c6d-4c107a060c3c` with your property ID
4. Execute the script

The SQL script uses PostgreSQL stored procedures for more efficient bulk insertion and provides additional metrics in the output.
