#!/usr/bin/env node

/**
 * Seed Analytics Data Script
 *
 * This script populates the database with realistic seed data for testing
 * the analytics dashboard. It creates:
 * - 50 diverse guest records
 * - 100+ historical reservations spanning the past 12 months
 * - Payment records with various methods and statuses
 *
 * Usage:
 *   node scripts/run-seed-data.js
 *
 * Or add to package.json and run:
 *   npm run seed:analytics
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function main() {
  log('\n============================================================', colors.bright);
  log('  Seed Analytics Data for Dashboard', colors.bright);
  log('============================================================\n', colors.bright);

  // Initialize Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    log('❌ Error: Missing Supabase credentials', colors.red);
    log('   Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY', colors.yellow);
    log('   are set in your .env.local file\n', colors.yellow);
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get property by name (defaults to "Ourdoor Haven")
  // Can be overridden with SEED_PROPERTY_NAME environment variable
  const targetPropertyName = process.env.SEED_PROPERTY_NAME || 'Ourdoor Haven';

  log(`📋 Finding property: ${targetPropertyName}...`, colors.blue);
  const { data: properties, error: propError } = await supabase
    .from('properties')
    .select('id, name')
    .ilike('name', targetPropertyName)
    .limit(1);

  if (propError || !properties || properties.length === 0) {
    log('❌ Error: No property found', colors.red);
    log('   Please complete the onboarding wizard first\n', colors.yellow);
    process.exit(1);
  }

  const propertyId = properties[0].id;
  const propertyName = properties[0].name;

  log(`✅ Found property: ${propertyName} (${propertyId})`, colors.green);

  log('\n🚀 Generating seed data...', colors.blue);

  // Check for existing sites
  const { data: sites, error: sitesError } = await supabase
    .from('sites')
    .select('id')
    .eq('property_id', propertyId)
    .eq('status', 'available');

  if (sitesError || !sites || sites.length === 0) {
    log('❌ Error: No available sites found', colors.red);
    log('   Please set up sites first using the setup wizard\n', colors.yellow);
    process.exit(1);
  }

  log(`✅ Found ${sites.length} available sites`, colors.green);

  // Create guests
  log('\n👥 Creating guest records...', colors.blue);
  const guestNames = [
    ['John', 'Smith'], ['Sarah', 'Johnson'], ['Michael', 'Williams'],
    ['Emily', 'Brown'], ['David', 'Jones'], ['Jessica', 'Garcia'],
    ['James', 'Miller'], ['Ashley', 'Davis'], ['Robert', 'Rodriguez'],
    ['Lisa', 'Martinez'], ['William', 'Hernandez'], ['Jennifer', 'Lopez'],
    ['Richard', 'Gonzalez'], ['Amanda', 'Wilson'], ['Christopher', 'Anderson'],
    ['Michelle', 'Thomas'], ['Daniel', 'Taylor'], ['Melissa', 'Moore'],
    ['Matthew', 'Jackson'], ['Laura', 'Martin'], ['Anthony', 'Lee'],
    ['Stephanie', 'Perez'], ['Mark', 'Thompson'], ['Nicole', 'White'],
    ['Steven', 'Harris'], ['Angela', 'Sanchez'], ['Kevin', 'Clark']
  ];

  const guests = [];
  for (let i = 0; i < guestNames.length; i++) {
    const [firstName, lastName] = guestNames[i];
    guests.push({
      property_id: propertyId,
      first_name: firstName,
      last_name: lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com`,
      phone: `555-${String(1000 + i).padStart(4, '0')}`,
      address: `${100 + i} Main Street`,
      city: ['Portland', 'Seattle', 'Denver', 'Austin', 'Phoenix'][i % 5],
      state: ['OR', 'WA', 'CO', 'TX', 'AZ'][i % 5],
      zip_code: String(97000 + i),
      country: 'USA'
    });
  }

  const { data: createdGuests, error: guestsError } = await supabase
    .from('guests')
    .insert(guests)
    .select('id');

  if (guestsError) {
    log(`❌ Error creating guests: ${guestsError.message}`, colors.red);
    process.exit(1);
  }

  log(`✅ Created ${createdGuests.length} guests`, colors.green);

  // Create historical reservations and payments
  log('\n📅 Creating historical reservations...', colors.blue);
  let reservationCount = 0;
  let paymentCount = 0;

  const sources = ['direct', 'direct', 'direct', 'booking_com', 'airbnb'];
  const paymentMethods = ['credit_card', 'debit_card', 'cash', 'bank_transfer'];

  for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
    const reservationsThisMonth = 8 + (monthOffset % 5);

    for (let i = 0; i < reservationsThisMonth; i++) {
      // Generate random reservation dates
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
      const checkInDate = new Date(monthStart);
      checkInDate.setDate(checkInDate.getDate() + Math.floor(Math.random() * 28));

      const nights = 2 + Math.floor(Math.random() * 6);
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + nights);

      // Skip future reservations
      if (checkInDate > today) continue;

      const totalCents = nights * (4500 + Math.floor(Math.random() * 10500));

      // Determine payment based on timing
      let paidCents;
      if (checkInDate < new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)) {
        paidCents = totalCents; // Old reservations fully paid
      } else if (checkInDate < today) {
        paidCents = Math.random() < 0.8 ? totalCents : totalCents / 2;
      } else {
        paidCents = Math.random() < 0.5 ? totalCents / 2 : 0;
      }

      const status = checkOutDate < today ? 'checked_out' :
                    checkInDate <= today ? 'checked_in' :
                    Math.random() < 0.05 ? 'cancelled' : 'confirmed';

      const paymentStatus = paidCents === 0 ? 'unpaid' :
                           paidCents >= totalCents ? 'paid' : 'partial';

      // Create reservation
      const { data: reservation, error: resError } = await supabase
        .from('reservations')
        .insert({
          property_id: propertyId,
          site_id: sites[i % sites.length].id,
          guest_id: createdGuests[(monthOffset * 8 + i) % createdGuests.length].id,
          confirmation_number: `CAMP-${checkInDate.getFullYear()}${String(checkInDate.getMonth() + 1).padStart(2, '0')}-${String(reservationCount + 1).padStart(4, '0')}`,
          check_in_date: checkInDate.toISOString().split('T')[0],
          check_out_date: checkOutDate.toISOString().split('T')[0],
          num_adults: 1 + Math.floor(Math.random() * 4),
          num_children: Math.floor(Math.random() * 3),
          num_pets: Math.random() < 0.3 ? 1 : 0,
          num_vehicles: 1 + Math.floor(Math.random() * 2),
          status,
          total_amount: totalCents,
          paid_amount: paidCents,
          payment_status: paymentStatus,
          source: sources[Math.floor(Math.random() * sources.length)]
        })
        .select('id')
        .single();

      if (resError) {
        log(`⚠️  Warning: Failed to create reservation: ${resError.message}`, colors.yellow);
        continue;
      }

      reservationCount++;

      // Create payment if paid
      if (paidCents > 0) {
        const paymentDate = new Date(checkInDate);
        paymentDate.setDate(paymentDate.getDate() - Math.floor(Math.random() * 29) - 1);

        await supabase.from('payments').insert({
          property_id: propertyId,
          reservation_id: reservation.id,
          amount: Math.min(paidCents, totalCents),
          payment_method: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
          payment_status: 'completed',
          processed_at: paymentDate.toISOString(),
          created_at: paymentDate.toISOString()
        });

        paymentCount++;

        // Second payment if partial
        if (paidCents < totalCents && paidCents === totalCents / 2) {
          await supabase.from('payments').insert({
            property_id: propertyId,
            reservation_id: reservation.id,
            amount: totalCents - paidCents,
            payment_method: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
            payment_status: checkInDate < today ? 'completed' : 'pending',
            processed_at: checkInDate < today ? checkInDate.toISOString() : null,
            created_at: new Date(checkInDate.getTime() - 24 * 60 * 60 * 1000).toISOString()
          });

          paymentCount++;
        }
      }
    }
  }

  // Summary
  log('\n' + '='.repeat(60), colors.bright);
  log('  ✅ Seed data generation complete!', colors.green + colors.bright);
  log('='.repeat(60) + '\n', colors.bright);

  log('📊 Summary:', colors.blue);
  log(`   - Guests created: ${createdGuests.length}`, colors.green);
  log(`   - Reservations created: ${reservationCount}`, colors.green);
  log(`   - Payments created: ${paymentCount}`, colors.green);

  // Get stats
  const { data: stats } = await supabase
    .from('reservations')
    .select('status, payment_status, paid_amount')
    .eq('property_id', propertyId);

  if (stats) {
    const confirmed = stats.filter(r => r.status === 'confirmed').length;
    const checkedIn = stats.filter(r => r.status === 'checked_in').length;
    const checkedOut = stats.filter(r => r.status === 'checked_out').length;
    const cancelled = stats.filter(r => r.status === 'cancelled').length;

    log('\n📈 Reservation Status:', colors.blue);
    log(`   - Confirmed: ${confirmed}`, colors.green);
    log(`   - Checked In: ${checkedIn}`, colors.green);
    log(`   - Checked Out: ${checkedOut}`, colors.green);
    log(`   - Cancelled: ${cancelled}`, colors.green);

    const totalRevenue = stats.reduce((sum, r) => sum + Number(r.paid_amount), 0) / 100;
    log('\n💰 Revenue:', colors.blue);
    log(`   - Total Collected: $${totalRevenue.toFixed(2)}`, colors.green);
  }

  log('\n' + '='.repeat(60), colors.bright);
  log('  🎉 Refresh your analytics dashboard to see the new data!', colors.green + colors.bright);
  log('='.repeat(60) + '\n', colors.bright);
}

main().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
